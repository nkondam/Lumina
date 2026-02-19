plugins {
    id("java")
    id("application")
}
group = "app"
version = "1.0.0"

repositories {
    mavenCentral()
}

val luminaFramework = file("../../../")
val sdkLibsDir = luminaFramework.resolve("sdk-runtime/build/libs")

dependencies {
    implementation(fileTree(sdkLibsDir) { include("*.jar") })
    implementation("com.h2database:h2:2.2.224")
    implementation("com.google.code.gson:gson:2.10.1")
}

application {
    mainClass.set("app.HabitTrackerApp")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.named("compileJava") {
    doFirst {
        val jars = sdkLibsDir.listFiles()?.filter { it.extension == "jar" } ?: emptyList()
        if (jars.isEmpty()) {
            throw GradleException("Lumina SDK jar not found in $sdkLibsDir")
        }
    }
}
