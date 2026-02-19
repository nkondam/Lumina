package dev.lumina.runtime;

import org.graalvm.nativeimage.hosted.Feature;

/**
 * GraalVM Native Image Feature that runs at build time.
 * Registered via META-INF/services so native-image discovers it automatically.
 *
 * This is the hook for future build-time optimizations (pre-computing route
 * tables, resource embedding, reflection registration, etc.).
 */
public class LuminaFeature implements Feature {

    @Override
    public String getDescription() {
        return "Lumina Runtime Feature";
    }

    @Override
    public void beforeAnalysis(BeforeAnalysisAccess access) {
        // Initialize default routes so they're reachable during static analysis.
        LuminaRuntime.builder()
                .route("ping", payload -> "{\"pong\":true}")
                .build();
    }
}
