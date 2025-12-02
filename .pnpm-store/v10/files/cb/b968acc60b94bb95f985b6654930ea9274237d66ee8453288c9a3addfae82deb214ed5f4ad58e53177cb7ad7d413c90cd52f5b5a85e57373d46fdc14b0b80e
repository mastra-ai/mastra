# NOTE: This file MUST be in sync with couchbase-sdk-cxx-black-duck-manifest.yaml

include(cmake/CPM.cmake)

set(CPM_USE_LOCAL_PACKAGES OFF)

# https://cmake.org/cmake/help/v3.28/policy/CMP0063.html
set(CMAKE_POLICY_DEFAULT_CMP0063 NEW)

function(declare_system_library target)
  get_target_property(target_aliased_name ${target} ALIASED_TARGET)
  if(target_aliased_name)
    set(target ${target_aliased_name})
  endif()
  set_target_properties(${target} PROPERTIES INTERFACE_SYSTEM_INCLUDE_DIRECTORIES
                                             $<TARGET_PROPERTY:${target},INTERFACE_INCLUDE_DIRECTORIES>)
endfunction()

include(cmake/OpenSSL.cmake)

if(NOT TARGET spdlog::spdlog)
  # https://github.com/gabime/spdlog/releases
  cpmaddpackage(
    NAME
    spdlog
    VERSION
    1.15.0
    GITHUB_REPOSITORY
    "gabime/spdlog"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO
    OPTIONS
    "SPDLOG_INSTALL OFF"
    "BUILD_SHARED_LIBS OFF"
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON"
    "SPDLOG_BUILD_SHARED OFF"
    "SPDLOG_FMT_EXTERNAL OFF")
endif()

if(NOT TARGET Microsoft.GSL::GSL)
  # https://github.com/microsoft/GSL/releases
  cpmaddpackage(
    NAME
    gsl
    VERSION
    4.0.0
    GITHUB_REPOSITORY
    "microsoft/gsl"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO
    OPTIONS
    "GSL_INSTALL OFF"
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON")
endif()

if(NOT TARGET hdr_histogram_static)
  # https://github.com/HdrHistogram/HdrHistogram_c/releases
  cpmaddpackage(
    NAME
    hdr_histogram
    GIT_TAG
    0.11.8
    VERSION
    0.11.8
    GITHUB_REPOSITORY
    "HdrHistogram/HdrHistogram_c"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO
    OPTIONS
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON"
    "HDR_LOG_REQUIRED OFF"
    "HDR_HISTOGRAM_BUILD_SHARED OFF"
    "HDR_HISTOGRAM_BUILD_PROGRAMS OFF")
endif()

if(NOT TARGET llhttp::llhttp)
  # https://github.com/nodejs/llhttp/releases
  cpmaddpackage(
    NAME
    llhttp
    GIT_TAG
    release/v9.3.0
    VERSION
    9.3.0
    GITHUB_REPOSITORY
    "nodejs/llhttp"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO
    OPTIONS
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON"
    "BUILD_SHARED_LIBS OFF"
    "BUILD_STATIC_LIBS ON")
endif()

if(NOT TARGET snappy)
  # https://github.com/google/snappy/releases
  cpmaddpackage(
    NAME
    snappy
    GIT_TAG
    1.2.2
    VERSION
    1.2.2
    GITHUB_REPOSITORY
    "google/snappy"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO
    OPTIONS
    "SNAPPY_INSTALL OFF"
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON"
    "BUILD_SHARED_LIBS OFF"
    "SNAPPY_BUILD_TESTS OFF"
    "SNAPPY_BUILD_BENCHMARKS OFF")
endif()
if(NOT MSVC)
  # https://github.com/google/snappy/pull/156
  target_compile_options(snappy PRIVATE -Wno-sign-compare)
endif()

if(NOT TARGET taocpp::json)
  # https://github.com/taocpp/json/releases
  cpmaddpackage(
    NAME
    json
    GIT_TAG
    1.0.0-beta.14
    VERSION
    1.0.0-beta.14
    GITHUB_REPOSITORY
    "taocpp/json"
    OPTIONS
    "CMAKE_C_VISIBILITY_PRESET hidden"
    "CMAKE_CXX_VISIBILITY_PRESET hidden"
    "CMAKE_POSITION_INDEPENDENT_CODE ON"
    "BUILD_SHARED_LIBS OFF"
    "PEGTL_INSTALL ${COUCHBASE_CXX_CLIENT_INSTALL}"
    "PEGTL_INSTALL_CMAKE_DIR ${CMAKE_INSTALL_LIBDIR}/cmake/pegtl"
    "PEGTL_INSTALL_DOC_DIR ${CMAKE_INSTALL_DATAROOTDIR}/doc/tao/pegtl"
    "PEGTL_BUILD_TESTS OFF"
    "PEGTL_BUILD_EXAMPLES OFF"
    "PEGTL_USE_BOOST_FILESYSTEM OFF"
    "TAOCPP_JSON_INSTALL ${COUCHBASE_CXX_CLIENT_INSTALL}"
    "TAOCPP_JSON_INSTALL_CMAKE_DIR ${CMAKE_INSTALL_LIBDIR}/cmake/taocpp-json"
    "TAOCPP_JSON_INSTALL_DOC_DIR ${CMAKE_INSTALL_DATAROOTDIR}/doc/tao/json"
    "TAOCPP_JSON_BUILD_TESTS OFF"
    "TAOCPP_JSON_BUILD_EXAMPLES OFF")
endif()

if(NOT TARGET asio::asio)
  # https://github.com/chriskohlhoff/asio/tags
  cpmaddpackage(
    NAME
    asio
    GIT_TAG
    asio-1-34-2
    VERSION
    1.34.2
    GITHUB_REPOSITORY
    "chriskohlhoff/asio"
    EXCLUDE_FROM_ALL ON
    SYSTEM NO)
endif()

# ASIO doesn't use CMake, we have to configure it manually. Extra notes for using on Windows:
#
# 1) If _WIN32_WINNT is not set, ASIO assumes _WIN32_WINNT=0x0501, i.e. Windows XP target, which is definitely not the
# platform which most users target.
#
# 2) WIN32_LEAN_AND_MEAN is defined to make Winsock2 work.
if(asio_ADDED)
  add_library(asio STATIC ${asio_SOURCE_DIR}/asio/src/asio.cpp ${asio_SOURCE_DIR}/asio/src/asio_ssl.cpp)

  target_include_directories(asio SYSTEM PUBLIC ${asio_SOURCE_DIR}/asio/include)
  target_compile_definitions(asio PUBLIC ASIO_STANDALONE=1 ASIO_NO_DEPRECATED=1 ASIO_SEPARATE_COMPILATION=1)
  target_link_libraries(asio PRIVATE Threads::Threads)
  if(COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL)
    target_link_libraries(asio PUBLIC $<TARGET_OBJECTS:ssl> $<TARGET_OBJECTS:crypto>)
    target_include_directories(
      asio SYSTEM PRIVATE $<BUILD_INTERFACE:$<TARGET_PROPERTY:ssl,INTERFACE_INCLUDE_DIRECTORIES>>
                          $<BUILD_INTERFACE:$<TARGET_PROPERTY:crypto,INTERFACE_INCLUDE_DIRECTORIES>>)
  elseif(NOT COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL)
    target_link_libraries(asio PRIVATE OpenSSL::SSL OpenSSL::Crypto)
  endif()
  set_target_properties(
    asio
    PROPERTIES C_VISIBILITY_PRESET hidden
               CXX_VISIBILITY_PRESET hidden
               POSITION_INDEPENDENT_CODE TRUE)

  if(WIN32)
    # macro see @ https://stackoverflow.com/a/40217291/1746503
    macro(get_win32_winnt version)
      if(CMAKE_SYSTEM_VERSION)
        set(ver ${CMAKE_SYSTEM_VERSION})
        string(
          REGEX MATCH
                "^([0-9]+).([0-9])"
                ver
                ${ver})
        string(
          REGEX MATCH
                "^([0-9]+)"
                verMajor
                ${ver})
        # Check for Windows 10, b/c we'll need to convert to hex 'A'.
        if("${verMajor}" MATCHES "10")
          set(verMajor "A")
          string(
            REGEX
            REPLACE "^([0-9]+)"
                    ${verMajor}
                    ver
                    ${ver})
        endif("${verMajor}" MATCHES "10")
        # Remove all remaining '.' characters.
        string(
          REPLACE "."
                  ""
                  ver
                  ${ver})
        # Prepend each digit with a zero.
        string(
          REGEX
          REPLACE "([0-9A-Z])"
                  "0\\1"
                  ver
                  ${ver})
        set(${version} "0x${ver}")
      endif()
    endmacro()

    if(NOT DEFINED _WIN32_WINNT)
      get_win32_winnt(ver)
      set(_WIN32_WINNT ${ver})
    endif()

    message(STATUS "Set _WIN32_WINNT=${_WIN32_WINNT}")

    target_compile_definitions(asio INTERFACE _WIN32_WINNT=${_WIN32_WINNT} WIN32_LEAN_AND_MEAN)
    target_compile_options(asio INTERFACE /bigobj)
  endif()

  add_library(asio::asio ALIAS asio)
endif()

add_library(jsonsl OBJECT ${PROJECT_SOURCE_DIR}/third_party/jsonsl/jsonsl.c)
set_target_properties(jsonsl PROPERTIES C_VISIBILITY_PRESET hidden POSITION_INDEPENDENT_CODE TRUE)
target_include_directories(jsonsl SYSTEM PUBLIC ${PROJECT_SOURCE_DIR}/third_party/jsonsl)

declare_system_library(snappy)
declare_system_library(llhttp::llhttp)
declare_system_library(hdr_histogram_static)
declare_system_library(Microsoft.GSL::GSL)
declare_system_library(spdlog::spdlog)
declare_system_library(asio)
declare_system_library(taocpp::json)
