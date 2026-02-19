package dev.lumina.bridge;

import org.graalvm.nativeimage.IsolateThread;
import org.graalvm.nativeimage.c.function.CEntryPoint;
import org.graalvm.nativeimage.c.type.CCharPointer;
import org.graalvm.nativeimage.c.type.CTypeConversion;

/**
 * LuminaBridge exposes Java backend logic to the C++ native host via GraalVM's C API.
 *
 * Each @CEntryPoint method is callable from C/C++ after compiling with native-image --shared.
 * The IsolateThread parameter is required by GraalVM to identify the execution context.
 */
public final class LuminaBridge {

    private static volatile RequestHandler handler = LuminaBridge::defaultHandler;

    @FunctionalInterface
    public interface RequestHandler {
        String handle(String route, String payload);
    }

    /**
     * Called from C++ when the webview invokes window.lumina.send(route, payload).
     * Returns a C string (caller must free it via lumina_free_string).
     */
    @CEntryPoint(name = "lumina_handle_request")
    public static CCharPointer handleRequest(
            IsolateThread thread,
            CCharPointer routePtr,
            CCharPointer payloadPtr) {

        String route = CTypeConversion.toJavaString(routePtr);
        String payload = CTypeConversion.toJavaString(payloadPtr);

        String response;
        try {
            response = handler.handle(route, payload);
        } catch (Throwable t) {
            response = "{\"error\":\"" + escapeJson(t.getClass().getSimpleName()
                    + ": " + t.getMessage()) + "\"}";
        }

        if (response == null) {
            response = "{}";
        }

        try (CTypeConversion.CCharPointerHolder holder = CTypeConversion.toCString(response)) {
            return copyToUnmanaged(holder.get(), response.length());
        }
    }

    /**
     * Frees a string previously returned by lumina_handle_request.
     */
    @CEntryPoint(name = "lumina_free_string")
    public static void freeString(IsolateThread thread, CCharPointer ptr) {
        if (ptr.isNonNull()) {
            org.graalvm.nativeimage.UnmanagedMemory.free(ptr);
        }
    }

    /**
     * Registers a user-defined request handler. Called by application code at startup.
     */
    public static void setHandler(RequestHandler h) {
        if (h == null) {
            throw new IllegalArgumentException("handler must not be null");
        }
        handler = h;
    }

    /**
     * Returns the current request handler. Used by DevServer to dispatch
     * HTTP JSON-RPC requests through the same route table.
     */
    public static RequestHandler getHandler() {
        return handler;
    }

    // -- internals --

    private static String defaultHandler(String route, String payload) {
        return "{\"status\":\"ok\",\"route\":\"" + escapeJson(route) + "\"}";
    }

    private static CCharPointer copyToUnmanaged(CCharPointer src, int javaLen) {
        // Walk the C string to find its actual byte length (may differ from javaLen for
        // multi-byte UTF-8 characters). The src is null-terminated by toCString().
        int byteLen = 0;
        while (src.read(byteLen) != 0) {
            byteLen++;
        }

        int size = byteLen + 1; // +1 for null terminator
        CCharPointer dest = org.graalvm.nativeimage.UnmanagedMemory.malloc(
                org.graalvm.word.WordFactory.unsigned(size));
        if (dest.isNull()) {
            // OOM -- return null. The C++ side handles null by falling back to "{}".
            return org.graalvm.word.WordFactory.nullPointer();
        }
        for (int i = 0; i < size; i++) {
            dest.write(i, src.read(i));
        }
        return dest;
    }

    public static String escapeJson(String s) {
        if (s == null) return "null";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private LuminaBridge() {}
}
