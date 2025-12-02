cmake_minimum_required(VERSION 3.19)
cmake_policy(SET CMP0042 NEW)
cmake_policy(SET CMP0048 NEW)
include(FetchContent)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

project (couchbase_impl)

function(get_couchnode_version)
  execute_process(COMMAND node -e "console.log(JSON.parse(fs.readFileSync('${PROJECT_SOURCE_DIR}/package.json')).version)"
                  OUTPUT_VARIABLE sdk_version)
  string(STRIP "${sdk_version}" SDK_VERSION)
  set(COUCHNODE_VERSION "${SDK_VERSION}" PARENT_SCOPE)
endfunction()

function(download_nodejs_headers)
  message("Finding Node.js headers SHA for version: ${NODE_RUNTIMEVERSION}")
  file(DOWNLOAD
    https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/SHASUMS256.txt
    "${CMAKE_CURRENT_BINARY_DIR}/SHASUM256.txt"
    TLS_VERIFY ON)

  file(READ "${CMAKE_CURRENT_BINARY_DIR}/SHASUM256.txt" HASH_FILE_CONTENT)
  set(REGEX_CHECK "node-v${NODE_RUNTIMEVERSION}-headers.tar.gz")
  string(REPLACE "\n" ";" HASH_FILE_CONTENT ${HASH_FILE_CONTENT})
  FOREACH(HASH ${HASH_FILE_CONTENT})
    string(FIND ${HASH} ${REGEX_CHECK} FOUND_FILE)
    if("${FOUND_FILE}" GREATER_EQUAL "0")
      string(REGEX MATCH
            "^[0-9a-f]+"
            CB_NODE_VERSION_SHA256
            ${HASH})
      break()
    endif()
  ENDFOREACH()

  if(NOT CB_NODE_VERSION_SHA256)
    message(FATAL_ERROR "Failed to extract expected hash from node shasum file.")
  else()
    message("Using SHA=${CB_NODE_VERSION_SHA256}")
  endif()
  if(${CMAKE_VERSION} VERSION_GREATER_EQUAL "3.24.0")
    # see https://cmake.org/cmake/help/latest/policy/CMP0135.html
    # and Externalproject_add - DOWNLOAD_EXTRACT_TIMESTAMP
    FetchContent_Declare(
      nodejs_headers
      URL https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/node-v${NODE_RUNTIMEVERSION}-headers.tar.gz
      URL_HASH SHA256=${CB_NODE_VERSION_SHA256}
      DOWNLOAD_EXTRACT_TIMESTAMP FALSE
      )
  else()
    FetchContent_Declare(
      nodejs_headers
      URL https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/node-v${NODE_RUNTIMEVERSION}-headers.tar.gz
      URL_HASH SHA256=${CB_NODE_VERSION_SHA256}
      )
  endif()

  message("Downloading Node.js ${NODE_RUNTIMEVERSION} headers...")
  FetchContent_MakeAvailable(nodejs_headers)
  message("Downloaded Node.js ${NODE_RUNTIMEVERSION} headers to ${nodejs_headers_SOURCE_DIR}")
  set(NODEJS_INC_DIR "${nodejs_headers_SOURCE_DIR}/include/node" PARENT_SCOPE)
endfunction()

function(download_nodejs_win_lib)
  if(NODE_RUNTIME STREQUAL "electron")
    set(NODE_LIB_URL "https://artifacts.electronjs.org/headers/dist/v${NODE_RUNTIMEVERSION}")
    if(NODE_ARCH STREQUAL "x64")
      set(NODE_LIB_URL "${NODE_LIB_URL}/x64")
    endif()
  else()
    set(NODE_LIB_URL "https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}")
    if(NODE_ARCH STREQUAL "x64")
      set(NODE_LIB_URL "${NODE_LIB_URL}/win-x64")
    else()
      set(NODE_LIB_URL "${NODE_LIB_URL}/win-x86")
    endif()
  endif()
  set(NODE_LIB_URL "${NODE_LIB_URL}/node.lib")

  FetchContent_Declare(
    nodejs_win_lib
    URL ${NODE_LIB_URL}
    DOWNLOAD_NO_EXTRACT TRUE
    )

  message("Downloading ${NODE_RUNTIME} v${NODE_RUNTIMEVERSION} win lib...")
  FetchContent_MakeAvailable(nodejs_win_lib)
  message("Downloaded ${NODE_RUNTIME} v${NODE_RUNTIMEVERSION} win lib to ${nodejs_win_lib_SOURCE_DIR}")
  set(NODEJS_LIB "${nodejs_win_lib_SOURCE_DIR}/node.lib" PARENT_SCOPE)
endfunction()

option(USE_STATIC_OPENSSL "Statically link OpenSSL instead of BoringSSL" TRUE)

if(USE_STATIC_OPENSSL AND "${NODE_RUNTIME}" STREQUAL "electron")
  message(STATUS "Found electron runtime, using BoringSSL.")
  set(USE_STATIC_OPENSSL FALSE)
endif()

message(STATUS "USE_STATIC_OPENSSL=${USE_STATIC_OPENSSL}")
if(NOT USE_STATIC_OPENSSL)
  set(COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL OFF CACHE BOOL "" FORCE)
  set(COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL ON CACHE BOOL "" FORCE)
  if(WIN32)
    # Using /MD compile flag as that is what BoringSSL uses and since we cannot override their CMake config
	  # (see link below), we need to use the DLL-specific version of the run-time library.
    # REF: https://github.com/google/boringssl/blob/f86dd185939a0a81dbbaea4f26d95f299d26811b/CMakeLists.txt#L203-L216
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
    SET(NODEJS_LIB "${CMAKE_JS_LIB}")
  endif()
else()
  set(COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL ON CACHE BOOL "" FORCE)
  # cmake-js >= v7.0 no longer downloads the full Node.js headers and utilizes the https://github.com/nodejs/node-api-headers
  # project.  Since we rely on Node's OpenSSL we need to pull in more than just the node-api headers, so lets download
  # the headers ourselves.
  if(CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
    set(NODEJS_INC_DIR "")
    download_nodejs_headers()
    set(NODEJS_INC_DIR "${NODEJS_INC_DIR};${CMAKE_JS_INC}")
    if(WIN32)
      # cmake-js >= v7.0 no longer downloads the full Node.js Windows lib and utilizes the https://github.com/nodejs/node-api-headers
      # project to build the lib.  We need to pull in more than just the node-api headers, so lets download the node.lib ourselves.
      SET(NODEJS_LIB "")
      download_nodejs_win_lib()
    endif()
  else()
    set(NODEJS_INC_DIR "${CMAKE_JS_INC}")
    SET(NODEJS_LIB "${CMAKE_JS_LIB}")
  endif()
  if(WIN32)
    # /MT compile flag: use static version of run-time library
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
  endif()
endif()

if(CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
  set(NODEJS_INC_DIR "${NODEJS_INC_DIR};${CMAKE_JS_INC}")
else()
  set(NODEJS_INC_DIR "${CMAKE_JS_INC}")
endif()
list(REMOVE_DUPLICATES NODEJS_INC_DIR)

message(STATUS "NODEJS_INC_DIR=${NODEJS_INC_DIR}")
message(STATUS "NODEJS_LIB=${NODEJS_LIB}")

# Set up some build requirements for Windows.
if(WIN32)
  add_definitions(/bigobj)
  add_definitions(-D_WIN32_WINNT=0x0601)
endif()

# We need to import headers globally for our dependant libraries such as couchbase-cxx-client.
include_directories(SYSTEM ${NODEJS_INC_DIR})

get_couchnode_version()
message(STATUS "COUCHNODE_VERSION=${COUCHNODE_VERSION}")

set(COUCHBASE_CXX_CLIENT_WRAPPER_UNIFIED_ID "nodejs/${COUCHNODE_VERSION}" CACHE STRING "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_STATIC ON CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_SHARED OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_INSTALL OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_DOCS OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_TOOLS OFF CACHE BOOL "" FORCE)

# In case we need to build the SDK on RHEL >= RHEL8, allow users to dynamically link C++ std libs.
option(USE_DYNAMIC_STDLIB "Dynamically link C++ standard library" FALSE)
if(DEFINED ENV{CN_USE_DYNAMIC_STDLIB})
  set(USE_DYNAMIC_STDLIB $ENV{CN_USE_DYNAMIC_STDLIB})
endif()

if(USE_DYNAMIC_STDLIB)
  set(COUCHBASE_CXX_CLIENT_STATIC_STDLIB OFF CACHE BOOL "" FORCE)
else()
  set(COUCHBASE_CXX_CLIENT_STATIC_STDLIB ON CACHE BOOL "" FORCE)
endif()
message(STATUS "USE_DYNAMIC_STDLIB=${USE_DYNAMIC_STDLIB}")

# handle CPM cache dir
if(DEFINED COUCHBASE_CXX_CPM_CACHE_DIR AND NOT COUCHBASE_CXX_CPM_CACHE_DIR STREQUAL "")
  set(CPM_SOURCE_CACHE "${COUCHBASE_CXX_CPM_CACHE_DIR}")
endif()

if(DEFINED CPM_SOURCE_CACHE)
  message(STATUS "CPM_SOURCE_CACHE=${CPM_SOURCE_CACHE}")
endif()

add_subdirectory(deps/couchbase-cxx-client)

set(COUCHBASE_CXX_BINARY_DIR "${CMAKE_BINARY_DIR}/deps/couchbase-cxx-client")
message(STATUS "COUCHBASE_CXX_BINARY_DIR=${COUCHBASE_CXX_BINARY_DIR}")
if(DEFINED COUCHBASE_CXX_CPM_CACHE_DIR AND NOT COUCHBASE_CXX_CPM_CACHE_DIR STREQUAL "")
  file(COPY "${COUCHBASE_CXX_BINARY_DIR}/mozilla-ca-bundle.crt" "${COUCHBASE_CXX_BINARY_DIR}/mozilla-ca-bundle.sha256"
    DESTINATION "${COUCHBASE_CXX_CPM_CACHE_DIR}")
  message(STATUS "Copied Mozilla cert bundle to cache.  COUCHBASE_CXX_CPM_CACHE_DIR=${COUCHBASE_CXX_CPM_CACHE_DIR}")
endif()

file(GLOB SOURCE_FILES "src/*.cpp")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

add_definitions(-DNAPI_VERSION=6)
set(COUCHBASE_CXX_SOURCE_DIR "${PROJECT_SOURCE_DIR}/deps/couchbase-cxx-client")
if(CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
  target_include_directories(${PROJECT_NAME}
    PRIVATE ${NODEJS_INC_DIR}
            "${COUCHBASE_CXX_BINARY_DIR}/generated"
            "${COUCHBASE_CXX_SOURCE_DIR}"
            "${COUCHBASE_CXX_SOURCE_DIR}/third_party/cxx_function"
            "${COUCHBASE_CXX_SOURCE_DIR}/third_party/expected/include")
else()
  execute_process(COMMAND node -p "require('node-addon-api').include"
          WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
          OUTPUT_VARIABLE NODE_ADDON_API_DIR
          )
  string(REPLACE "\n" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
  string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

  target_include_directories(${PROJECT_NAME}
    PRIVATE ${NODEJS_INC_DIR}
            ${NODE_ADDON_API_DIR}
            "${COUCHBASE_CXX_BINARY_DIR}/generated"
            "${COUCHBASE_CXX_SOURCE_DIR}"
            "${COUCHBASE_CXX_SOURCE_DIR}/third_party/cxx_function"
            "${COUCHBASE_CXX_SOURCE_DIR}/third_party/expected/include")
endif()
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_link_libraries(${PROJECT_NAME}
  ${NODEJS_LIB}
  couchbase_cxx_client_static_intermediate
  asio
  Microsoft.GSL::GSL
  taocpp::json
  spdlog::spdlog
)

if(MSVC)
  # If using BoringSSL we need to generate node.lib, if using OpenSSL we download node.lib.
  if(NOT USE_STATIC_OPENSSL AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
    execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
  endif()

  # Workaround a bug in cmake-js with removal of used references:
  # https://github.com/cmake-js/cmake-js/issues/205
  target_link_options(${PROJECT_NAME} PUBLIC /OPT:NOREF)

  # since we only care about the *.PDB for a command line build, this _should_ be okay.
  if(CMAKE_BUILD_TYPE STREQUAL "Release")
      target_compile_options(${PROJECT_NAME} PUBLIC /Zi)

      # Do we want /OPT:ICF?
      set_target_properties(${PROJECT_NAME} PROPERTIES
        LINK_FLAGS "/INCREMENTAL:NO /DEBUG"
        COMPILE_PDB_NAME ${PROJECT_NAME}
        COMPILE_PDB_OUTPUT_DIR ${CMAKE_BINARY_DIR}
      )
  endif()
endif()
