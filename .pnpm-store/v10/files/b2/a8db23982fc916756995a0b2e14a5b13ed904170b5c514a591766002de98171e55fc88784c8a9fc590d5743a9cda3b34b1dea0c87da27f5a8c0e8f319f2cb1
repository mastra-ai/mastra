cmake_minimum_required(VERSION 3.12)
if(POLICY CMP0135)
    cmake_policy(SET CMP0135 NEW)
    set(CMAKE_POLICY_DEFAULT_CMP0135 NEW)
endif()

file(STRINGS "include/hdr/hdr_histogram_version.h" HDR_VERSION_HEADER)
string(REGEX MATCH ".*#define HDR_HISTOGRAM_VERSION \"(.*)\".*" HDR_BLACK_HOLE ${HDR_VERSION_HEADER})

project(hdr_histogram
    VERSION ${CMAKE_MATCH_1}
    LANGUAGES C
    DESCRIPTION "C port of the HdrHistogram"
    HOMEPAGE_URL "http://hdrhistogram.github.io/HdrHistogram/")

set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH} "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

# Follow all steps below in order to calculate new ABI version when updating the library
# NOTE: THIS IS UNRELATED to the actual project version
#
# 1. If the library source code has changed at all since the last update, then increment revision
# 2. If any interfaces have been added, removed, or changed since the last update, increment current and set revision to 0.
# 3. If any interfaces have been added since the last public release, then increment age.
# 4. If any interfaces have been removed since the last public release, then set age to 0.

set(HDR_SOVERSION_CURRENT   6)
set(HDR_SOVERSION_AGE       1)
set(HDR_SOVERSION_REVISION  3)

set(HDR_VERSION ${HDR_SOVERSION_CURRENT}.${HDR_SOVERSION_AGE}.${HDR_SOVERSION_REVISION})
set(HDR_SOVERSION ${HDR_SOVERSION_CURRENT})
option(HDR_LOG_REQUIRED "HDR Logging component required" ON)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(UNIX)
    add_compile_options(
        -Wall
        -Wno-unknown-pragmas
        -Wextra
        -Wshadow
        -Winit-self
        -Wpedantic
        $<$<COMPILE_LANGUAGE:C>:-Wmissing-prototypes>)
    add_definitions(-D_GNU_SOURCE)
endif()

find_package(ZLIB)
find_package(Threads REQUIRED)

if (HDR_LOG_REQUIRED STREQUAL "DISABLED")
    set(HDR_LOG_ENABLED "FALSE")
else()
    set(HDR_LOG_ENABLED ${ZLIB_FOUND})
    if (${HDR_LOG_REQUIRED} AND NOT HDR_LOG_ENABLED)
        message(SEND_ERROR "HDR_LOG_REQUIRED=ON and unable to find zlib library")
    endif()
endif()

add_subdirectory(include)
add_subdirectory(src)

option(HDR_HISTOGRAM_BUILD_PROGRAMS "Build tests and examples" ON)
if(HDR_HISTOGRAM_BUILD_PROGRAMS)
    include(CTest)

    if(BUILD_TESTING)
        add_subdirectory(test)
    endif()

    add_subdirectory(examples)
endif()

write_basic_package_version_file(
    ${PROJECT_BINARY_DIR}/${PROJECT_NAME}-config-version.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY AnyNewerVersion)
configure_file(
    config.cmake.in
    ${PROJECT_NAME}-config.cmake
    @ONLY)
if(HDR_HISTOGRAM_INSTALL_SHARED OR HDR_HISTOGRAM_INSTALL_STATIC)
    install(
        EXPORT ${PROJECT_NAME}-targets
        DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME}
        NAMESPACE ${PROJECT_NAME}::)
endif()
install(
    FILES
        ${PROJECT_BINARY_DIR}/${PROJECT_NAME}-config.cmake
        ${PROJECT_BINARY_DIR}/${PROJECT_NAME}-config-version.cmake
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/${PROJECT_NAME})

set(CPACK_GENERATOR "TGZ")
include(CPack)

include(JoinPaths)

join_paths(includedir_for_pc_file "\${prefix}" "${CMAKE_INSTALL_INCLUDEDIR}")
join_paths(libdir_for_pc_file "\${prefix}" "${CMAKE_INSTALL_LIBDIR}")

if(${ZLIB_FOUND})
    set(PC_REQUIRES_PRIVATE_ZLIB "zlib")
else()
    set(PC_REQUIRES_PRIVATE_ZLIB "")
endif()
configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/${PROJECT_NAME}.pc.in
    ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}.pc
    @ONLY
)
install(
    FILES ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}.pc
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/pkgconfig
)
