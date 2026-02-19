plugins {
    java
    application
    id("org.graalvm.buildtools.native") version "0.10.4"
}

application {
    mainClass.set("dev.lumina.runtime.DevServer")
}

group = "dev.lumina"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    compileOnly("org.graalvm.sdk:nativeimage:24.1.1")
}

graalvmNative {
    binaries {
        named("main") {
            sharedLibrary.set(true)
            imageName.set("sdk_runtime")
            buildArgs.addAll(
                "--no-fallback",
                "-H:+ReportExceptionStackTraces",
                "-march=native",
                // Minimize binary size
                "-O2",
                "--gc=serial",
            )
        }
    }
}

tasks.register<Copy>("copyNativeLib") {
    description = "Copies the native shared library to a known output directory"
    dependsOn("nativeCompile")

    from(layout.buildDirectory.dir("native/nativeCompile"))
    into(layout.buildDirectory.dir("native"))

    include("*.so", "*.dylib", "*.dll", "*.h")
}
