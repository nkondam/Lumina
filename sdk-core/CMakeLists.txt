cmake_minimum_required(VERSION 3.20)
project(lumina-host LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ─── Fetch webview (single-header, v0.10.0) ────────────────────────────────
include(FetchContent)
FetchContent_Declare(
    webview
    GIT_REPOSITORY https://github.com/webview/webview.git
    GIT_TAG        0.10.0
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(webview)

# ─── Paths ──────────────────────────────────────────────────────────────────
set(LUMINA_ROOT       "${CMAKE_CURRENT_SOURCE_DIR}/..")
set(SDK_RUNTIME_LIB   "${LUMINA_ROOT}/sdk-runtime/build/native" CACHE PATH
    "Directory containing the GraalVM native-image shared library")
set(UI_BUILD_DIR       "${LUMINA_ROOT}/ui-template/dist" CACHE PATH
    "Directory containing built UI assets")
set(GENERATED_DIR      "${CMAKE_CURRENT_BINARY_DIR}/generated")

file(MAKE_DIRECTORY ${GENERATED_DIR})

# ─── Generate embedded_assets.h from UI build output ───────────────────────
find_package(Python3 REQUIRED COMPONENTS Interpreter)

add_custom_command(
    OUTPUT  "${GENERATED_DIR}/embedded_assets.h"
    COMMAND ${Python3_EXECUTABLE}
            "${LUMINA_ROOT}/scripts/embed_assets.py"
            "${UI_BUILD_DIR}"
            "${GENERATED_DIR}/embedded_assets.h"
    DEPENDS "${UI_BUILD_DIR}/index.html"
    COMMENT "Embedding UI assets into C++ header"
)

add_custom_target(embedded_assets DEPENDS "${GENERATED_DIR}/embedded_assets.h")

# ─── Main executable ───────────────────────────────────────────────────────
add_executable(lumina-host src/main.cpp)
add_dependencies(lumina-host embedded_assets)

target_include_directories(lumina-host PRIVATE
    "${webview_SOURCE_DIR}"                     # webview.h (fetched)
    "${SDK_RUNTIME_LIB}"                        # libsdk_runtime.h (GraalVM generated)
    "${GENERATED_DIR}"                          # embedded_assets.h
)

# Link the GraalVM shared library (GraalVM outputs sdk_runtime.dylib without lib prefix)
set(SDK_RUNTIME_DYLIB "${SDK_RUNTIME_LIB}/sdk_runtime.dylib")
if(UNIX AND NOT APPLE)
    set(SDK_RUNTIME_DYLIB "${SDK_RUNTIME_LIB}/sdk_runtime.so")
elseif(WIN32)
    set(SDK_RUNTIME_DYLIB "${SDK_RUNTIME_LIB}/sdk_runtime.dll")
endif()

if(NOT EXISTS "${SDK_RUNTIME_DYLIB}")
    message(FATAL_ERROR
        "Could not find ${SDK_RUNTIME_DYLIB}. "
        "Run the Java native-image build first.")
endif()

target_link_libraries(lumina-host PRIVATE "${SDK_RUNTIME_DYLIB}")

# ─── Platform-specific WebView dependencies ────────────────────────────────
if(APPLE)
    find_library(COCOA_LIB Cocoa REQUIRED)
    find_library(WEBKIT_LIB WebKit REQUIRED)
    target_link_libraries(lumina-host PRIVATE ${COCOA_LIB} ${WEBKIT_LIB})
    target_compile_definitions(lumina-host PRIVATE WEBVIEW_COCOA)
elseif(UNIX)
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK3    REQUIRED gtk+-3.0)
    pkg_check_modules(WEBKIT2 REQUIRED webkit2gtk-4.1)
    target_include_directories(lumina-host PRIVATE
        ${GTK3_INCLUDE_DIRS} ${WEBKIT2_INCLUDE_DIRS})
    target_link_libraries(lumina-host PRIVATE
        ${GTK3_LIBRARIES} ${WEBKIT2_LIBRARIES})
    target_compile_definitions(lumina-host PRIVATE WEBVIEW_GTK)
elseif(WIN32)
    target_link_libraries(lumina-host PRIVATE
        advapi32 ole32 shell32 shlwapi user32 version)
    target_compile_definitions(lumina-host PRIVATE WEBVIEW_EDGE)
endif()
