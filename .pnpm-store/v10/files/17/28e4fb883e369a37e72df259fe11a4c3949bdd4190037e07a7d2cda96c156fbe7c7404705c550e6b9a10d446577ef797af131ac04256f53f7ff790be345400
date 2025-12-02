# Additional interop for things like macros and inlined functions.
add_library(rust_wrapper STATIC rust_wrapper.c)
target_link_libraries(rust_wrapper crypto)

# Generate architecture-specific wrappers. bindgen must be called from
# ${CMAKE_BINARY_DIR}, with the output path as a relative path. bindgen writes
# the depfile using the same syntax as the command-line argument, and ninja
# requires a path relative to the top-level build directory.
set(wrapper wrapper_${RUST_BINDINGS}.rs)
binary_dir_relative_path(${wrapper} wrapper_relative)
binary_dir_relative_path(${wrapper}.d depfile_relative)

add_custom_command(
  OUTPUT ${wrapper}
  COMMAND ${BINDGEN_EXECUTABLE} ${CMAKE_CURRENT_SOURCE_DIR}/wrapper.h
          -o ${wrapper_relative}
          --depfile=${depfile_relative}
          --no-derive-default
          --enable-function-attribute-detection
          --use-core
          --default-macro-constant-type=signed
          --rustified-enum=point_conversion_form_t
          # These regexes need to accept both / and \ to handle Windows file
          # path differences, due a bindgen issue. See
          # https://crbug.com/boringssl/595. Ideally, we would write [/\\], but
          # there are many layers of escaping here. First, CMake interprets
          # backslashes. Then CMake generates a Ninja or Make file. That, in
          # turn, uses the shell on POSIX, and does something else on Windows.
          #
          # It is unlikely that every layer here has sufficiently well-defined
          # escaping and correctly handled the next layer's escaping. On top of
          # that, we'd likely need to detect Windows vs POSIX hosts and change
          # the input. Instead, just use [[:punct:]] which is more permissive
          # than necessary, but we only need to exclude unwanted libc headers.
          #
          # If bindgen ever supports some file-based config (see
          # https://github.com/rust-lang/rust-bindgen/issues/2508), we can
          # switch to that.
          --allowlist-file=".*[[:punct:]]include[[:punct:]]openssl[[:punct:]].*\\.h"
          --allowlist-file=".*[[:punct:]]rust_wrapper\\.h"
          -- # these are LLVM arg passthroughs
          -I${PROJECT_SOURCE_DIR}/include
          # https://doc.rust-lang.org/nightly/rustc/platform-support.html
          --target=${RUST_BINDINGS}
  DEPENDS wrapper.h
  DEPFILE ${CMAKE_CURRENT_BINARY_DIR}/${wrapper}.d
  WORKING_DIRECTORY ${CMAKE_BINARY_DIR}
)
add_custom_target(bssl_sys ALL DEPENDS ${wrapper})
