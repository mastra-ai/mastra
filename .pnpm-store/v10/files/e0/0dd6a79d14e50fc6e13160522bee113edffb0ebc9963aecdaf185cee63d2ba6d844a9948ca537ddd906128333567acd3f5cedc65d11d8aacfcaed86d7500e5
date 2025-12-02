cmake_minimum_required(VERSION 3.8...3.19)

# Read version from version.hpp
file(READ "${CMAKE_CURRENT_LIST_DIR}/include/tao/pegtl/version.hpp" version_hpp_data)
string(REGEX MATCH "#define TAO_PEGTL_VERSION \"([^\"]+)\"" _ ${version_hpp_data})
set(PEGTL_VERSION "${CMAKE_MATCH_1}")

project(pegtl VERSION ${PEGTL_VERSION} LANGUAGES CXX)

set(PEGTL_IS_MAIN_PROJECT OFF)
if(CMAKE_CURRENT_SOURCE_DIR STREQUAL CMAKE_SOURCE_DIR)
  set(PEGTL_IS_MAIN_PROJECT ON)
endif()

if(PEGTL_HAS_PARENT)
  # Multiple versions of PEGTL can't co-exist
  if(NOT ${PROJECT_NAME}_VERSION STREQUAL ${PROJECT_VERSION})
    message(FATAL_ERROR "Multiple mismatched PEGTL versions")
  endif()

  # Only include if this is the first include
  if(NOT ${PROJECT_NAME}_DIR STREQUAL "${PROJECT_BINARY_DIR}")
    return()
  endif()
endif()

# Keep track of pegtl version
set(${PROJECT_NAME}_FOUND TRUE CACHE BOOL "" FORCE)
set(${PROJECT_NAME}_VERSION "${PROJECT_VERSION}" CACHE STRING "" FORCE)
set(${PROJECT_NAME}_DIR "${PROJECT_BINARY_DIR}" CACHE PATH "" FORCE)

mark_as_advanced(${PROJECT_NAME}_FOUND)
mark_as_advanced(${PROJECT_NAME}_VERSION)
mark_as_advanced(${PROJECT_NAME}_DIR)

# installation directories
set(PEGTL_INSTALL_INCLUDE_DIR "include" CACHE STRING "The installation include directory")
set(PEGTL_INSTALL_DOC_DIR "share/doc/tao/pegtl" CACHE STRING "The installation doc directory")
set(PEGTL_INSTALL_CMAKE_DIR "share/pegtl/cmake" CACHE STRING "The installation cmake directory")

# define a header-only library
add_library(pegtl INTERFACE)
add_library(taocpp::pegtl ALIAS pegtl)
target_include_directories(pegtl INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:${PEGTL_INSTALL_INCLUDE_DIR}>
)

# require C++17
target_compile_features(pegtl INTERFACE cxx_std_17)

option(PEGTL_USE_BOOST_FILESYSTEM "Override the auto-detection of std::filesystem and use Boost.Filesystem" OFF)

# Try compiling a test program with std::filesystem or one of its alternatives
function(check_filesystem_impl FILESYSTEM_HEADER FILESYSTEM_NAMESPACE OPTIONAL_LIBS OUT_RESULT)
  set(TEST_FILE "test_${OUT_RESULT}.cpp")
  configure_file(.cmake/test_filesystem.cpp.in ${TEST_FILE} @ONLY)

  try_compile(TEST_RESULT
    ${CMAKE_CURRENT_BINARY_DIR}
    ${CMAKE_CURRENT_BINARY_DIR}/${TEST_FILE}
    CXX_STANDARD 17)

  if(NOT TEST_RESULT)
    # Retry with each of the optional libraries
    foreach(OPTIONAL_LIB IN LISTS OPTIONAL_LIBS)
      try_compile(TEST_RESULT
        ${CMAKE_CURRENT_BINARY_DIR}
        ${CMAKE_CURRENT_BINARY_DIR}/${TEST_FILE}
        LINK_LIBRARIES ${OPTIONAL_LIB}
        CXX_STANDARD 17)

      if(TEST_RESULT)
        # Looks like the optional library was required, go ahead and add it to the link options.
        message(STATUS "Adding ${OPTIONAL_LIB} to the PEGTL to build with ${FILESYSTEM_NAMESPACE}.")
        target_link_libraries(${PROJECT_NAME} INTERFACE ${OPTIONAL_LIB})
        break()
      endif()
    endforeach()
  endif()

  set(${OUT_RESULT} ${TEST_RESULT} PARENT_SCOPE)
endfunction()

if(PEGTL_USE_BOOST_FILESYSTEM)
  # Force the use of Boost.Filesystem: #include <boost/filesystem.hpp> // boost::filesystem
  find_package(Boost REQUIRED COMPONENTS filesystem)
  target_link_libraries(${PROJECT_NAME} INTERFACE Boost::filesystem)
  target_compile_definitions(${PROJECT_NAME} INTERFACE TAO_PEGTL_BOOST_FILESYSTEM)
else()
  # Try compiling a minimal program with each header/namespace, in order of preference:
  #   C++17: #include <filesystem> // std::filesystem
  #   Experimental C++17: #include <experimental/filesystem> // std::experimental::filesystem
  #   Boost.Filesystem: #include <boost/filesystem.hpp> // boost::filesystem
  check_filesystem_impl("filesystem" "std::filesystem" "stdc++fs;c++fs" STD_FILESYSTEM)
  if(STD_FILESYSTEM)
    message(STATUS "Using std::filesystem")
  else()
    check_filesystem_impl("experimental/filesystem" "std::experimental::filesystem" "stdc++fs;c++fs" STD_EXPERIMENTAL_FILESYSTEM)
    if(STD_EXPERIMENTAL_FILESYSTEM)
      target_compile_definitions(${PROJECT_NAME} INTERFACE TAO_PEGTL_STD_EXPERIMENTAL_FILESYSTEM)
      message(WARNING "Using std::experimental::filesystem as a fallback")
    else()
      find_package(Boost COMPONENTS filesystem)
      check_filesystem_impl("boost/filesystem.hpp" "boost::filesystem" Boost::filesystem BOOST_FILESYSTEM)
      if(BOOST_FILESYSTEM)
        target_compile_definitions(${PROJECT_NAME} INTERFACE TAO_PEGTL_BOOST_FILESYSTEM)
        message(WARNING "Using Boost.Filesystem as a fallback")
      else()
        message(FATAL_ERROR "PEGTL requires C++17, including an implementation of std::filesystem, which your compiler toolchain does not seem to support. You can try installing Boost.Filesystem as a temporary workaround, but there's no guarantee the PEGTL will keep working with your project. Consider upgrading your compiler toolchain or downgrading the PEGTL to the previous version.")
      endif()
    endif()
  endif()
endif()

# testing
option(PEGTL_BUILD_TESTS "Build test programs" ${PEGTL_IS_MAIN_PROJECT})
if(PEGTL_BUILD_TESTS)
  enable_testing()
  add_subdirectory(src/test/pegtl)
endif()

# examples
option(PEGTL_BUILD_EXAMPLES "Build example programs" ${PEGTL_IS_MAIN_PROJECT})
if(PEGTL_BUILD_EXAMPLES)
  add_subdirectory(src/example/pegtl)
endif()

# Make package findable
configure_file(.cmake/pegtl-config.cmake.in pegtl-config.cmake @ONLY)

# Ignore pointer width differences since this is a header-only library
unset(CMAKE_SIZEOF_VOID_P)

# Enable version checks in find_package
include(CMakePackageConfigHelpers)
write_basic_package_version_file(pegtl-config-version.cmake COMPATIBILITY SameMajorVersion)

# install and export target
install(TARGETS pegtl EXPORT pegtl-targets)

install(EXPORT pegtl-targets
  FILE pegtl-config.cmake
  NAMESPACE taocpp::
  DESTINATION ${PEGTL_INSTALL_CMAKE_DIR}
)

install(FILES ${CMAKE_CURRENT_BINARY_DIR}/pegtl-config-version.cmake DESTINATION ${PEGTL_INSTALL_CMAKE_DIR})
install(DIRECTORY include/ DESTINATION ${PEGTL_INSTALL_INCLUDE_DIR})
install(FILES LICENSE DESTINATION ${PEGTL_INSTALL_DOC_DIR})

export(EXPORT pegtl-targets
  FILE ${pegtl_BINARY_DIR}/pegtl-targets.cmake
  NAMESPACE taocpp::
)
