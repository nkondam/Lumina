package dev.lumina.runtime;

import dev.lumina.bridge.LuminaBridge;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * Bootstrap class for application developers.
 *
 * Routes are additive: each builder().route(...).build() call merges into
 * the global route table. This allows the GraalVM Feature to register system
 * routes at build time without conflicting with user routes added at runtime.
 *
 * Usage:
 *   LuminaRuntime.builder()
 *       .route("greet", (payload) -> "{\"hello\":\"world\"}")
 *       .build();
 */
public final class LuminaRuntime {

    // Global route table -- all build() calls merge into this map.
    private static final ConcurrentHashMap<String, Function<String, String>> ROUTES
            = new ConcurrentHashMap<>();

    // Installed once: the bridge handler that dispatches into ROUTES.
    private static volatile boolean handlerInstalled = false;

    private LuminaRuntime() {}

    public static Builder builder() {
        return new Builder();
    }

    /**
     * Registers a single route directly without using the builder.
     */
    public static void route(String name, Function<String, String> handler) {
        ROUTES.put(name, handler);
        ensureHandlerInstalled();
    }

    private static synchronized void ensureHandlerInstalled() {
        if (!handlerInstalled) {
            LuminaBridge.setHandler((routeName, payload) -> {
                var handler = ROUTES.get(routeName);
                if (handler == null) {
                    return "{\"error\":\"unknown_route\",\"route\":\""
                            + LuminaBridge.escapeJson(routeName) + "\"}";
                }
                return handler.apply(payload);
            });
            handlerInstalled = true;
        }
    }

    public static final class Builder {
        private final java.util.LinkedHashMap<String, Function<String, String>> pending
                = new java.util.LinkedHashMap<>();

        Builder() {}

        /**
         * Register a handler for a named route.
         */
        public Builder route(String name, Function<String, String> handler) {
            pending.put(name, handler);
            return this;
        }

        /**
         * Merges all pending routes into the global route table and ensures
         * the bridge handler is installed.
         */
        public void build() {
            ROUTES.putAll(pending);
            ensureHandlerInstalled();
        }
    }
}
