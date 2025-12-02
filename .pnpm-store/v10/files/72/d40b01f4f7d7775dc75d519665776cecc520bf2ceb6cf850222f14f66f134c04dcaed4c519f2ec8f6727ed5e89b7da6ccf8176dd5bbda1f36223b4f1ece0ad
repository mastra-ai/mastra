cmake_minimum_required(VERSION 3.10)

# Defer enabling C and CXX languages.
project(BoringSSL NONE)

# Don't install BoringSSL to system directories by default; it has no stable
# ABI. Instead, default to an "install" directory under the source.
if(CMAKE_INSTALL_PREFIX_INITIALIZED_TO_DEFAULT)
  set(CMAKE_INSTALL_PREFIX ${CMAKE_SOURCE_DIR}/install CACHE PATH "" FORCE)
endif()

if(WIN32)
  # On Windows, prefer cl over gcc if both are available. By default most of
  # the CMake generators prefer gcc, even on Windows.
  set(CMAKE_GENERATOR_CC cl)
endif()

include(sources.cmake)
include(cmake/go.cmake)
include(cmake/paths.cmake)
include(cmake/perlasm.cmake)

enable_language(C)
enable_language(CXX)

include(GNUInstallDirs)

# CMake versions before 3.14 do not have default destination values. Executable
# and library targets that use a default destination should include this
# variable.
if(CMAKE_VERSION VERSION_LESS "3.14")
  set(INSTALL_DESTINATION_DEFAULT
      ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
      LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
      RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
endif()

# Wrap the CMake install function so we can disable it.
set(INSTALL_ENABLED 1)
function(install_if_enabled)
  if(INSTALL_ENABLED)
    install(${ARGV})
  endif()
endfunction()

if(ANDROID)
  # Android-NDK CMake files reconfigure the path and so Perl won't be found.
  # However, ninja will still find them in $PATH if we just name them.
  if(NOT PERL_EXECUTABLE)
    set(PERL_EXECUTABLE "perl")
  endif()
else()
  find_package(Perl REQUIRED)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Linux" AND NOT CMAKE_CROSSCOMPILING)
  find_package(PkgConfig QUIET)
  if (PkgConfig_FOUND)
    pkg_check_modules(LIBUNWIND libunwind-generic)
    if(LIBUNWIND_FOUND)
      add_definitions(-DBORINGSSL_HAVE_LIBUNWIND)
    else()
      message("libunwind not found. Disabling unwind tests.")
    endif()
  else()
    message("pkgconfig not found. Disabling unwind tests.")
  endif()
endif()

if(USE_CUSTOM_LIBCXX)
  set(BORINGSSL_ALLOW_CXX_RUNTIME 1)
endif()

if(BORINGSSL_ALLOW_CXX_RUNTIME)
  add_definitions(-DBORINGSSL_ALLOW_CXX_RUNTIME)
endif()

string(TOLOWER "${CMAKE_BUILD_TYPE}" CMAKE_BUILD_TYPE_LOWER)
if(NOT FIPS)
  if(CMAKE_BUILD_TYPE_LOWER STREQUAL "relwithassert" OR
     NOT CMAKE_BUILD_TYPE_LOWER MATCHES "rel")
    add_definitions(-DBORINGSSL_DISPATCH_TEST)
    # CMake automatically connects include_directories to the NASM
    # command-line, but not add_definitions.
    set(CMAKE_ASM_NASM_FLAGS "${CMAKE_ASM_NASM_FLAGS} -DBORINGSSL_DISPATCH_TEST")
  endif()
endif()

# Add a RelWithAsserts build configuration. It is the same as Release, except it
# does not define NDEBUG, so asserts run.
foreach(VAR CMAKE_C_FLAGS CMAKE_CXX_FLAGS CMAKE_ASM_FLAGS)
  string(REGEX REPLACE "(^| )[/-]DNDEBUG( |$)" " " "${VAR}_RELWITHASSERTS"
         "${${VAR}_RELEASE}")
endforeach()

if(BORINGSSL_PREFIX AND BORINGSSL_PREFIX_SYMBOLS)
  add_definitions(-DBORINGSSL_PREFIX=${BORINGSSL_PREFIX})
  # CMake automatically connects include_directories to the NASM command-line,
  # but not add_definitions.
  set(CMAKE_ASM_NASM_FLAGS "${CMAKE_ASM_NASM_FLAGS} -DBORINGSSL_PREFIX=${BORINGSSL_PREFIX}")

  # Use "symbol_prefix_include" to store generated header files
  include_directories(${CMAKE_CURRENT_BINARY_DIR}/symbol_prefix_include)
  add_custom_command(
    OUTPUT symbol_prefix_include/boringssl_prefix_symbols.h
           symbol_prefix_include/boringssl_prefix_symbols_asm.h
           symbol_prefix_include/boringssl_prefix_symbols_nasm.inc
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_CURRENT_BINARY_DIR}/symbol_prefix_include
    COMMAND ${GO_EXECUTABLE} run ${CMAKE_CURRENT_SOURCE_DIR}/util/make_prefix_headers.go -out ${CMAKE_CURRENT_BINARY_DIR}/symbol_prefix_include ${BORINGSSL_PREFIX_SYMBOLS}
    DEPENDS util/make_prefix_headers.go
            ${BORINGSSL_PREFIX_SYMBOLS})

  # add_dependencies needs a target, not a file, so we add an intermediate
  # target.
  add_custom_target(
    boringssl_prefix_symbols
    DEPENDS symbol_prefix_include/boringssl_prefix_symbols.h
            symbol_prefix_include/boringssl_prefix_symbols_asm.h
            symbol_prefix_include/boringssl_prefix_symbols_nasm.inc)
elseif(BORINGSSL_PREFIX OR BORINGSSL_PREFIX_SYMBOLS)
  message(FATAL_ERROR "Must specify both or neither of BORINGSSL_PREFIX and BORINGSSL_PREFIX_SYMBOLS")
else()
  add_custom_target(boringssl_prefix_symbols)
endif()

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  set(CLANG 1)
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Emscripten")
  set(EMSCRIPTEN 1)
endif()

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(CMAKE_COMPILER_IS_GNUCXX OR CLANG)
  # Note clang-cl is odd and sets both CLANG and MSVC. We base our configuration
  # primarily on our normal Clang one.
  # TODO(bbe) took out -Wmissing-field-initializers for pki - fix and put back or disable only for pki
  set(C_CXX_FLAGS "-Werror -Wformat=2 -Wsign-compare -Wwrite-strings -Wvla -Wshadow -Wtype-limits")
  if(MSVC)
    # clang-cl sets different default warnings than clang. It also treats -Wall
    # as -Weverything, to match MSVC. Instead -W3 is the alias for -Wall.
    # See http://llvm.org/viewvc/llvm-project?view=revision&revision=319116
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -W3 -Wno-unused-parameter -fmsc-version=1900")
  else()
    if(EMSCRIPTEN)
      # emscripten's emcc/clang does not accept the "-ggdb" flag.
      set(C_CXX_FLAGS "${C_CXX_FLAGS} -g")
    else()
      set(C_CXX_FLAGS "${C_CXX_FLAGS} -ggdb")
    endif()

    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wall -fvisibility=hidden -fno-common")
  endif()

  if(CLANG)
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wnewline-eof -fcolor-diagnostics")
  else()
    # GCC (at least 4.8.4) has a bug where it'll find unreachable free() calls
    # and declare that the code is trying to free a stack pointer.
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wno-free-nonheap-object")
  endif()

  # -Wstring-concatenation was added in Clang 12.0.0, which corresponds to
  # AppleClang 13.0.0 per the table in
  # https://en.wikipedia.org/wiki/Xcode#Toolchain_versions
  if((CMAKE_C_COMPILER_ID STREQUAL "Clang" AND
      CMAKE_C_COMPILER_VERSION VERSION_GREATER_EQUAL "12.0.0") OR
     (CMAKE_C_COMPILER_ID STREQUAL "AppleClang" AND
      CMAKE_C_COMPILER_VERSION VERSION_GREATER_EQUAL "13.0.0"))
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wstring-concatenation")
  endif()

  if(CLANG OR CMAKE_C_COMPILER_VERSION VERSION_GREATER_EQUAL "7.0.0")
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wimplicit-fallthrough")
  endif()

  if(CMAKE_COMPILER_IS_GNUCXX)
    set(C_CXX_FLAGS "${C_CXX_FLAGS} -Wformat-signedness")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${C_CXX_FLAGS} -Wmissing-prototypes -Wold-style-definition -Wstrict-prototypes")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${C_CXX_FLAGS} -Wmissing-declarations")

  if(NOT MSVC AND NOT BORINGSSL_ALLOW_CXX_RUNTIME)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-exceptions -fno-rtti")
  endif()

  # In GCC, -Wmissing-declarations is the C++ spelling of -Wmissing-prototypes
  # and using the wrong one is an error. In Clang, -Wmissing-prototypes is the
  # spelling for both and -Wmissing-declarations is some other warning.
  #
  # https://gcc.gnu.org/onlinedocs/gcc-7.1.0/gcc/Warning-Options.html#Warning-Options
  # https://clang.llvm.org/docs/DiagnosticsReference.html#wmissing-prototypes
  # https://clang.llvm.org/docs/DiagnosticsReference.html#wmissing-declarations
  if(CLANG)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wmissing-prototypes")
  endif()
elseif(MSVC)
  set(MSVC_DISABLED_WARNINGS_LIST
      "C4100" # 'exarg' : unreferenced formal parameter
      "C4127" # conditional expression is constant
      "C4244" # 'function' : conversion from 'int' to 'uint8_t',
              # possible loss of data
      "C4267" # conversion from 'size_t' to 'int', possible loss of data
      "C4706" # assignment within conditional expression
      )
  string(REPLACE "C" " -wd" MSVC_DISABLED_WARNINGS_STR
                            ${MSVC_DISABLED_WARNINGS_LIST})
  set(CMAKE_C_FLAGS   "-utf-8 -W4 -WX ${MSVC_DISABLED_WARNINGS_STR}")
  set(CMAKE_CXX_FLAGS "-utf-8 -W4 -WX ${MSVC_DISABLED_WARNINGS_STR}")
endif()

if(WIN32)
  add_definitions(-D_HAS_EXCEPTIONS=0)
  add_definitions(-DWIN32_LEAN_AND_MEAN)
  add_definitions(-DNOMINMAX)
  # Allow use of fopen.
  add_definitions(-D_CRT_SECURE_NO_WARNINGS)
endif()

# pthread_rwlock_t on Linux requires a feature flag. We limit this to Linux
# because, on Apple platforms, it instead disables APIs we use. See compat(5)
# and sys/cdefs.h. Reportedly, FreeBSD also breaks when this is set. See
# https://crbug.com/boringssl/471.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -D_XOPEN_SOURCE=700")
endif()

if(FUZZ)
  if(NOT CLANG)
    message(FATAL_ERROR "You need to build with Clang for fuzzing to work")
  endif()

  if(CMAKE_C_COMPILER_VERSION VERSION_LESS "6.0.0")
    message(FATAL_ERROR "You need Clang ≥ 6.0.0")
  endif()

  add_definitions(-DBORINGSSL_UNSAFE_DETERMINISTIC_MODE)
  set(RUNNER_ARGS "-deterministic")

  if(NOT NO_FUZZER_MODE)
    add_definitions(-DBORINGSSL_UNSAFE_FUZZER_MODE)
    set(RUNNER_ARGS ${RUNNER_ARGS} "-fuzzer" "-shim-config" "fuzzer_mode.json")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=address,fuzzer-no-link -fsanitize-coverage=edge,indirect-calls")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address,fuzzer-no-link -fsanitize-coverage=edge,indirect-calls")
endif()

add_definitions(-DBORINGSSL_IMPLEMENTATION)

if(BUILD_SHARED_LIBS)
  add_definitions(-DBORINGSSL_SHARED_LIBRARY)
  # Enable position-independent code globally. This is needed because
  # some library targets are OBJECT libraries.
  set(CMAKE_POSITION_INDEPENDENT_CODE TRUE)
endif()

if(MSAN)
  if(NOT CLANG)
    message(FATAL_ERROR "Cannot enable MSAN unless using Clang")
  endif()

  if(ASAN)
    message(FATAL_ERROR "ASAN and MSAN are mutually exclusive")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=memory -fsanitize-memory-track-origins -fno-omit-frame-pointer")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=memory -fsanitize-memory-track-origins -fno-omit-frame-pointer")
  set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -fsanitize=memory -fsanitize-memory-track-origins -fno-omit-frame-pointer")
endif()

if(ASAN)
  if(NOT CLANG)
    message(FATAL_ERROR "Cannot enable ASAN unless using Clang")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=address -fsanitize-address-use-after-scope -fno-omit-frame-pointer")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=address -fsanitize-address-use-after-scope -fno-omit-frame-pointer")
endif()

if(CFI)
  if(NOT CLANG)
    message(FATAL_ERROR "Cannot enable CFI unless using Clang")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=cfi -fno-sanitize-trap=cfi -flto=thin")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=cfi -fno-sanitize-trap=cfi -flto=thin")
  # We use Chromium's copy of clang, which requires -fuse-ld=lld if building
  # with -flto. That, in turn, can't handle -ggdb.
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fuse-ld=lld")
  string(REPLACE "-ggdb" "-g" CMAKE_C_FLAGS "${CMAKE_C_FLAGS}")
  string(REPLACE "-ggdb" "-g" CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS}")
  # -flto causes object files to contain LLVM bitcode. Mixing those with
  # assembly output in the same static library breaks the linker.
  set(OPENSSL_NO_ASM "1")
endif()

if(TSAN)
  if(NOT CLANG)
    message(FATAL_ERROR "Cannot enable TSAN unless using Clang")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=thread")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=thread")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fsanitize=thread")
endif()

if(UBSAN)
  if(NOT CLANG)
    message(FATAL_ERROR "Cannot enable UBSAN unless using Clang")
  endif()

  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fsanitize=undefined")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fsanitize=undefined")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fsanitize=undefined")

  if(NOT UBSAN_RECOVER)
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fno-sanitize-recover=undefined")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-sanitize-recover=undefined")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -fno-sanitize-recover=undefined")
  endif()
endif()

if(GCOV)
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fprofile-arcs -ftest-coverage")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fprofile-arcs -ftest-coverage")
endif()

if(FIPS)
  add_definitions(-DBORINGSSL_FIPS)
  if(FIPS_BREAK_TEST)
    add_definitions("-DBORINGSSL_FIPS_BREAK_${FIPS_BREAK_TEST}=1")
  endif()
  # The FIPS integrity check does not work for ASan and MSan builds.
  if(NOT ASAN AND NOT MSAN)
    if(BUILD_SHARED_LIBS)
      set(FIPS_SHARED "1")
    else()
      set(FIPS_DELOCATE "1")
    endif()
  endif()
  if(FIPS_SHARED)
    # The Android CMake files set -ffunction-sections and -fdata-sections,
    # which is incompatible with FIPS_SHARED.
    set(CMAKE_C_FLAGS
        "${CMAKE_C_FLAGS} -fno-function-sections -fno-data-sections")
    set(CMAKE_CXX_FLAGS
        "${CMAKE_CXX_FLAGS} -fno-function-sections -fno-data-sections")
  endif()
endif()

if(OPENSSL_SMALL)
  add_definitions(-DOPENSSL_SMALL)
endif()

if(CONSTANT_TIME_VALIDATION)
  add_definitions(-DBORINGSSL_CONSTANT_TIME_VALIDATION)
  # Asserts will often test secret data.
  add_definitions(-DNDEBUG)
endif()

if(MALLOC_FAILURE_TESTING)
  add_definitions(-DBORINGSSL_MALLOC_FAILURE_TESTING)
endif()

if(OPENSSL_NO_ASM)
  add_definitions(-DOPENSSL_NO_ASM)
endif()

if(FIPS_DELOCATE OR NOT OPENSSL_NO_ASM)
  # On x86 and x86_64 Windows, we use the NASM output.
  if(WIN32 AND CMAKE_SYSTEM_PROCESSOR MATCHES "AMD64|x86_64|amd64|x86|i[3-6]86")
    enable_language(ASM_NASM)
    set(OPENSSL_NASM TRUE)
    set(CMAKE_ASM_NASM_FLAGS "${CMAKE_ASM_NASM_FLAGS} -gcv8")
  else()
    enable_language(ASM)
    set(OPENSSL_ASM TRUE)
    # Work around https://gitlab.kitware.com/cmake/cmake/-/issues/20771 in older
    # CMake versions.
    if(APPLE AND CMAKE_VERSION VERSION_LESS 3.19)
      if(CMAKE_OSX_SYSROOT)
        set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -isysroot \"${CMAKE_OSX_SYSROOT}\"")
      endif()
      foreach(arch ${CMAKE_OSX_ARCHITECTURES})
        set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -arch ${arch}")
      endforeach()
    endif()
    if(NOT WIN32)
      set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -Wa,--noexecstack")
    endif()
    # Clang's integerated assembler does not support debug symbols.
    if(NOT CMAKE_ASM_COMPILER_ID MATCHES "Clang")
      set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -Wa,-g")
    endif()
  endif()
endif()

if(OPENSSL_NO_SSE2_FOR_TESTING)
  add_definitions(-DOPENSSL_NO_SSE2_FOR_TESTING)
endif()

if(USE_CUSTOM_LIBCXX)
  if(NOT CLANG)
    message(FATAL_ERROR "USE_CUSTOM_LIBCXX only supported with Clang")
  endif()

  # CMake does not allow installing a library without installing dependencies.
  # If we installed libcrypto, we'd have to install our custom libc++, which
  # does not make sense. As this is a test-only configuration, disable
  # installing.
  set(INSTALL_ENABLED 0)

  # CMAKE_CXX_FLAGS ends up in the linker flags as well, so use
  # add_compile_options. There does not appear to be a way to set
  # language-specific compile-only flags.
  add_compile_options("-nostdinc++")
  set(CMAKE_CXX_LINK_FLAGS "${CMAKE_CXX_LINK_FLAGS} -nostdlib++")
  include_directories(
    SYSTEM
    util/bot/libcxx-config
    util/bot/libcxx/include
    util/bot/libcxxabi/include
  )

  # This is patterned after buildtools/third_party/libc++/BUILD.gn and
  # buildtools/third_party/libc++abi/BUILD.gn in Chromium.

  file(GLOB LIBCXX_SOURCES "util/bot/libcxx/src/*.cpp")
  file(GLOB LIBCXXABI_SOURCES "util/bot/libcxxabi/src/*.cpp")

  # This file is meant for exception-less builds.
  list(REMOVE_ITEM LIBCXXABI_SOURCES "trunk/src/cxa_noexception.cpp")
  # libc++ also defines new and delete.
  list(REMOVE_ITEM LIBCXXABI_SOURCES "trunk/src/stdlib_new_delete.cpp")
  if(TSAN)
    # ThreadSanitizer tries to intercept these symbols. Skip them to avoid
    # symbol conflicts.
    list(REMOVE_ITEM LIBCXXABI_SOURCES "trunk/src/cxa_guard.cpp")
  endif()

  add_library(libcxxabi ${LIBCXXABI_SOURCES})
  target_compile_definitions(
    libcxxabi PRIVATE
    -D_LIBCPP_ENABLE_CXX17_REMOVED_UNEXPECTED_FUNCTIONS
  )

  add_library(libcxx ${LIBCXX_SOURCES})
  if(ASAN OR MSAN OR TSAN)
    # Sanitizers try to intercept new and delete.
    target_compile_definitions(
      libcxx PRIVATE
      -D_LIBCPP_DISABLE_NEW_DELETE_DEFINITIONS
    )
  endif()
  target_compile_definitions(
    libcxx PRIVATE
    -D_LIBCPP_BUILDING_LIBRARY
    -DLIBCXX_BUILDING_LIBCXXABI
  )
  set_target_properties(
    libcxx libcxxabi PROPERTIES
    COMPILE_FLAGS "-Wno-missing-prototypes -Wno-implicit-fallthrough"
    # libc++ and libc++abi must be built in C++20 mode.
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED TRUE
  )
  # libc++abi depends on libc++ internal headers.
  set_property(TARGET libcxx libcxxabi APPEND PROPERTY INCLUDE_DIRECTORIES "${CMAKE_CURRENT_SOURCE_DIR}/util/bot/libcxx/src")
  target_link_libraries(libcxx libcxxabi)
endif()

# Add minimal googletest targets. The provided one has many side-effects, and
# googletest has a very straightforward build.
add_library(boringssl_gtest third_party/googletest/src/gtest-all.cc)
if(USE_CUSTOM_LIBCXX)
  target_link_libraries(boringssl_gtest libcxx)
endif()
target_include_directories(
    boringssl_gtest
    PUBLIC third_party/googletest/include
    PRIVATE third_party/googletest
)

# Declare a dummy target to build all unit tests. Test targets should inject
# themselves as dependencies next to the target definition.
add_custom_target(all_tests)

# On Windows, CRYPTO_TEST_DATA is too long to fit in command-line limits.
# TODO(davidben): CMake 3.12 has a list(JOIN) command. Use that when we've
# updated the minimum version.
set(EMBED_TEST_DATA_ARGS "")
foreach(arg ${CRYPTO_TEST_DATA})
  set(EMBED_TEST_DATA_ARGS "${EMBED_TEST_DATA_ARGS}${arg}\n")
endforeach()
file(WRITE "${CMAKE_CURRENT_BINARY_DIR}/embed_test_data_args.txt"
     "${EMBED_TEST_DATA_ARGS}")

add_custom_command(
  OUTPUT crypto_test_data.cc
  COMMAND ${GO_EXECUTABLE} run util/embed_test_data.go -file-list
          "${CMAKE_CURRENT_BINARY_DIR}/embed_test_data_args.txt" >
          "${CMAKE_CURRENT_BINARY_DIR}/crypto_test_data.cc"
  DEPENDS util/embed_test_data.go ${CRYPTO_TEST_DATA}
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})

add_library(crypto_test_data OBJECT crypto_test_data.cc)

add_subdirectory(crypto)
add_subdirectory(ssl)
add_subdirectory(ssl/test)
add_subdirectory(util/fipstools)
add_subdirectory(util/fipstools/acvp/modulewrapper)
add_subdirectory(decrepit)

add_library(test_support_lib STATIC ${TEST_SUPPORT_SOURCES})
if (LIBUNWIND_FOUND)
  target_compile_options(test_support_lib PRIVATE ${LIBUNWIND_CFLAGS_OTHER})
  target_include_directories(test_support_lib PRIVATE ${LIBUNWIND_INCLUDE_DIRS})
  target_link_libraries(test_support_lib ${LIBUNWIND_LDFLAGS})
endif()
if(WIN32)
  target_link_libraries(test_support_lib dbghelp)
endif()
target_link_libraries(test_support_lib boringssl_gtest crypto)

# urandom_test is a separate binary because it needs to be able to observe the
# PRNG initialisation, which means that it can't have other tests running before
# it does.
add_executable(urandom_test ${URANDOM_TEST_SOURCES})
target_link_libraries(urandom_test test_support_lib boringssl_gtest crypto)
add_dependencies(all_tests urandom_test)

add_executable(crypto_test ${CRYPTO_TEST_SOURCES} $<TARGET_OBJECTS:crypto_test_data>)
target_link_libraries(crypto_test test_support_lib boringssl_gtest crypto)
add_dependencies(all_tests crypto_test)

add_executable(ssl_test ${SSL_TEST_SOURCES})
target_link_libraries(ssl_test test_support_lib boringssl_gtest ssl crypto)
add_dependencies(all_tests ssl_test)

add_executable(decrepit_test ${DECREPIT_TEST_SOURCES})
target_link_libraries(decrepit_test test_support_lib boringssl_gtest
                      decrepit crypto)
add_dependencies(all_tests decrepit_test)

if(APPLE)
  set(PKI_CXX_FLAGS "-fno-aligned-new")
endif()

add_library(pki ${PKI_SOURCES})
target_compile_definitions(pki PRIVATE _BORINGSSL_LIBPKI_)
target_link_libraries(pki crypto)

add_executable(pki_test ${PKI_TEST_SOURCES})
target_compile_definitions(pki_test PRIVATE _BORINGSSL_LIBPKI_)
target_link_libraries(pki_test test_support_lib boringssl_gtest pki crypto)
add_dependencies(all_tests pki_test)

# The PKI library requires C++17.
set_target_properties(
  pki pki_test
  PROPERTIES
  CXX_STANDARD 17
  CXX_STANDARD_REQUIRED YES
  COMPILE_FLAGS "${PKI_CXX_FLAGS}")

add_executable(bssl ${BSSL_SOURCES})
install_if_enabled(TARGETS bssl DESTINATION ${INSTALL_DESTINATION_DEFAULT})
target_link_libraries(bssl ssl crypto)

# Historically, targets were built in subdirectories. For compatibility with
# existing tools, we, for now, copy the targets into the subdirectories. This
# will be removed sometime in 2024.
copy_post_build(crypto crypto_test urandom_test)
copy_post_build(ssl ssl_test)
copy_post_build(decrepit decrepit_test)
copy_post_build(tool bssl)

if(FUZZ)
  if(LIBFUZZER_FROM_DEPS)
    file(GLOB LIBFUZZER_SOURCES "util/bot/libFuzzer/*.cpp")
    add_library(Fuzzer STATIC ${LIBFUZZER_SOURCES})
    # libFuzzer does not pass our aggressive warnings. It also must be built
    # without -fsanitize-coverage options or clang crashes.
    set_target_properties(Fuzzer PROPERTIES COMPILE_FLAGS "-Wno-shadow -Wno-format-nonliteral -Wno-missing-prototypes -fsanitize-coverage=0")
  endif()

  add_subdirectory(fuzz)
endif()

if(RUST_BINDINGS)
  find_program(BINDGEN_EXECUTABLE bindgen)
  if(NOT BINDGEN_EXECUTABLE)
    message(FATAL_ERROR "Could not find bindgen but was asked to generate Rust bindings.")
  else()
    add_subdirectory(rust)
  endif()
endif()

if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  set(HANDSHAKER_ARGS "-handshaker-path" $<TARGET_FILE:handshaker>)
endif()

if(FIPS)
  add_custom_target(
    acvp_tests
    COMMAND ${GO_EXECUTABLE} build -o ${CMAKE_CURRENT_BINARY_DIR}/acvptool
            boringssl.googlesource.com/boringssl/util/fipstools/acvp/acvptool
    COMMAND ${GO_EXECUTABLE} build -o ${CMAKE_CURRENT_BINARY_DIR}/testmodulewrapper
            boringssl.googlesource.com/boringssl/util/fipstools/acvp/acvptool/testmodulewrapper
    COMMAND cd util/fipstools/acvp/acvptool/test &&
            ${GO_EXECUTABLE} run check_expected.go
            -tool ${CMAKE_CURRENT_BINARY_DIR}/acvptool
            -module-wrappers modulewrapper:$<TARGET_FILE:modulewrapper>,testmodulewrapper:${CMAKE_CURRENT_BINARY_DIR}/testmodulewrapper
            -tests tests.json
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DEPENDS modulewrapper
    USES_TERMINAL)

  add_custom_target(
    fips_specific_tests_if_any
    DEPENDS acvp_tests
  )
else()
  add_custom_target(fips_specific_tests_if_any)
endif()

file(STRINGS util/go_tests.txt GO_TESTS)
set_property(DIRECTORY APPEND PROPERTY CMAKE_CONFIGURE_DEPENDS
             util/go_tests.txt)

add_custom_target(
    run_tests
    COMMAND ${GO_EXECUTABLE} test ${GO_TESTS}
    COMMAND ${GO_EXECUTABLE} run util/all_tests.go -build-dir
            ${CMAKE_CURRENT_BINARY_DIR}
    COMMAND cd ssl/test/runner &&
            ${GO_EXECUTABLE} test -shim-path $<TARGET_FILE:bssl_shim>
              ${HANDSHAKER_ARGS} ${RUNNER_ARGS}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DEPENDS all_tests bssl_shim handshaker fips_specific_tests_if_any
    USES_TERMINAL)

install_if_enabled(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})

install_if_enabled(EXPORT OpenSSLTargets
  FILE OpenSSLTargets.cmake
  NAMESPACE OpenSSL::
  DESTINATION lib/cmake/OpenSSL
)
install_if_enabled(FILES cmake/OpenSSLConfig.cmake DESTINATION lib/cmake/OpenSSL)
