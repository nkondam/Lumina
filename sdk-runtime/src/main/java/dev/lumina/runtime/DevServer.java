package dev.lumina.runtime;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * Lightweight HTTP JSON-RPC server for dev mode.
 *
 * This is a STANDALONE dev server that does NOT depend on GraalVM classes.
 * It maintains its own route table for development purposes.
 *
 * Accepts POST /rpc with JSON body: {"route":"...", "payload":"..."}
 * Includes CORS headers so Vite dev server (localhost:5173) can call it.
 *
 * Started via: ./gradlew run
 * 
 * NOTE: This dev server is part of the Lumina framework. Application-specific
 * routes should be registered by the application code, not in this file.
 */
public final class DevServer {

    private static final int PORT = 8080;

    // Dev-mode route table (independent of LuminaBridge to avoid GraalVM deps)
    private static final Map<String, Function<String, String>> ROUTES = new ConcurrentHashMap<>();

    /**
     * Register a route handler for dev mode.
     * Applications call this to register their routes.
     */
    public static void route(String name, Function<String, String> handler) {
        ROUTES.put(name, handler);
    }

    /**
     * Get all registered routes (for introspection).
     */
    public static Map<String, Function<String, String>> getRoutes() {
        return ROUTES;
    }

    public static void main(String[] args) throws IOException {
        // Register framework-level routes only
        route("ping", payload -> "{\"pong\":true}");

        // Discover and load application routes via ServiceLoader or classpath scanning
        loadApplicationRoutes();

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

        server.createContext("/rpc", DevServer::handleRpc);

        server.setExecutor(null); // default single-thread executor
        server.start();

        System.out.println("╔══════════════════════════════════════════════════════════╗");
        System.out.println("║  Lumina DevServer running on http://localhost:" + PORT + "/rpc  ║");
        System.out.println("╚══════════════════════════════════════════════════════════╝");
        System.out.println();
        System.out.println("Available routes:");
        ROUTES.keySet().stream().sorted().forEach(r -> System.out.println("  • " + r));
        System.out.println();
        System.out.println("Press Ctrl+C to stop.");
    }

    /**
     * Load application routes from the classpath.
     * Applications can register routes by:
     * 1. Creating a class that implements LuminaRouteProvider
     * 2. Registering it via
     * META-INF/services/dev.lumina.runtime.LuminaRouteProvider
     */
    private static void loadApplicationRoutes() {
        // Try to load via ServiceLoader (for properly packaged apps)
        try {
            var loader = java.util.ServiceLoader.load(LuminaRouteProvider.class);
            for (var provider : loader) {
                System.out.println("Loading routes from: " + provider.getClass().getName());
                provider.registerRoutes(DevServer::route);
            }
        } catch (Exception e) {
            // ServiceLoader not available or no providers found - that's OK
        }
    }

    /**
     * Interface for applications to register routes with the DevServer.
     */
    public interface LuminaRouteProvider {
        void registerRoutes(java.util.function.BiConsumer<String, Function<String, String>> registrar);
    }

    private static void handleRpc(HttpExchange exchange) throws IOException {
        // CORS preflight
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }

        // Read request body
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);

        // Parse route and payload from JSON body
        String routeName = extractJsonString(body, "route");
        String payload = extractJsonString(body, "payload");

        if (routeName == null || routeName.isEmpty()) {
            sendResponse(exchange, 400, "{\"error\":\"missing_route\"}");
            return;
        }

        if (payload == null) {
            payload = "{}";
        }

        // Dispatch to registered handler
        String response;
        try {
            var handler = ROUTES.get(routeName);
            if (handler == null) {
                response = "{\"error\":\"unknown_route\",\"route\":\"" + escapeJson(routeName) + "\"}";
            } else {
                response = handler.apply(payload);
            }
        } catch (Throwable t) {
            response = "{\"error\":\"" + escapeJson(
                    t.getClass().getSimpleName() + ": " + t.getMessage()) + "\"}";
        }

        if (response == null) {
            response = "{}";
        }

        sendResponse(exchange, 200, response);
    }

    private static void sendResponse(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    /**
     * Extracts a string value for a given key from a flat JSON object.
     */
    static String extractJsonString(String json, String key) {
        String search = "\"" + key + "\"";
        int keyIdx = json.indexOf(search);
        if (keyIdx < 0)
            return null;

        int colonIdx = json.indexOf(':', keyIdx + search.length());
        if (colonIdx < 0)
            return null;

        int openQuote = json.indexOf('"', colonIdx + 1);
        if (openQuote < 0)
            return null;

        StringBuilder value = new StringBuilder();
        int i = openQuote + 1;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) {
                char next = json.charAt(i + 1);
                switch (next) {
                    case '"':
                        value.append('"');
                        break;
                    case '\\':
                        value.append('\\');
                        break;
                    case 'n':
                        value.append('\n');
                        break;
                    case 'r':
                        value.append('\r');
                        break;
                    case 't':
                        value.append('\t');
                        break;
                    default:
                        value.append('\\').append(next);
                        break;
                }
                i += 2;
            } else if (c == '"') {
                break;
            } else {
                value.append(c);
                i++;
            }
        }

        return value.toString();
    }

    static String escapeJson(String s) {
        if (s == null)
            return "null";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private DevServer() {
    }
}
