cmake_minimum_required(VERSION 3.8...3.19)

project(taocpp-json VERSION 1.0.0 LANGUAGES CXX)

set(TAOCPP_JSON_IS_MAIN_PROJECT OFF)
if(CMAKE_CURRENT_SOURCE_DIR STREQUAL CMAKE_SOURCE_DIR)
  set(TAOCPP_JSON_IS_MAIN_PROJECT ON)
endif()

# installation directories
include(GNUInstallDirs)

set(TAOCPP_JSON_INSTALL_DOC_DIR "${CMAKE_INSTALL_DOCDIR}/tao/json" CACHE STRING "The installation doc directory")
set(TAOCPP_JSON_INSTALL_CMAKE_DIR "${CMAKE_INSTALL_DATAROOTDIR}/${PROJECT_NAME}/cmake" CACHE STRING "The installation cmake directory")

# define a header-only library
add_library(taocpp-json INTERFACE)
add_library(taocpp::json ALIAS taocpp-json)
target_include_directories(taocpp-json INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
)

# require C++17
target_compile_features(taocpp-json INTERFACE cxx_std_17)

# find a suitable PEGTL
set(TAOCPP_JSON_PEGTL_MIN_VERSION 3.1.0)
find_package(pegtl ${TAOCPP_JSON_PEGTL_MIN_VERSION} QUIET CONFIG)
if(NOT pegtl_FOUND)
  # if a compatible version of PEGTL is not already installed, build and install it from the submodule directory
  message(STATUS "Adding PEGTL as submodule from external/PEGTL")
  set(PEGTL_INSTALL_INCLUDE_DIR ${CMAKE_INSTALL_INCLUDEDIR} CACHE STRING "Override PEGTL include install directory")
  set(PEGTL_INSTALL_CMAKE_DIR ${CMAKE_INSTALL_DATAROOTDIR}/pegtl/cmake CACHE STRING "Override PEGTL cmake install directory")
  add_subdirectory(external/PEGTL)
endif()

# add pegtl as a dependency
target_link_libraries(taocpp-json INTERFACE taocpp::pegtl)

# testing
option(TAOCPP_JSON_BUILD_TESTS "Build test programs" ${TAOCPP_JSON_IS_MAIN_PROJECT})
if(TAOCPP_JSON_BUILD_TESTS)
  enable_testing()
  add_subdirectory(src/test/json)
endif()

# examples
option(TAOCPP_JSON_BUILD_EXAMPLES "Build example programs" ${TAOCPP_JSON_IS_MAIN_PROJECT})
if(TAOCPP_JSON_BUILD_EXAMPLES)
  add_subdirectory(src/example/json)
endif()

option(TAOCPP_JSON_INSTALL "Generate the install target" ${TAOCPP_JSON_IS_MAIN_PROJECT})
if(TAOCPP_JSON_INSTALL)
  include(CMakePackageConfigHelpers)

  # Make package findable
  configure_package_config_file(.cmake/taocpp-json-config.cmake.in ${PROJECT_NAME}-config.cmake
    INSTALL_DESTINATION ${TAOCPP_JSON_INSTALL_CMAKE_DIR}
    NO_CHECK_REQUIRED_COMPONENTS_MACRO
    NO_SET_AND_CHECK_MACRO
  )

  # Ignore pointer width differences since this is a header-only library
  unset(CMAKE_SIZEOF_VOID_P)

  # Enable version checks in find_package
  write_basic_package_version_file(${PROJECT_NAME}-config-version.cmake COMPATIBILITY SameMajorVersion)

  # keep taocpp::json target compatibility
  set_target_properties(taocpp-json PROPERTIES EXPORT_NAME json)

  # install and export target
  install(TARGETS taocpp-json EXPORT ${PROJECT_NAME}-targets)
  install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}-config.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/${PROJECT_NAME}-config-version.cmake
    DESTINATION ${TAOCPP_JSON_INSTALL_CMAKE_DIR}
  )
  install(EXPORT ${PROJECT_NAME}-targets
    NAMESPACE taocpp::
    DESTINATION ${TAOCPP_JSON_INSTALL_CMAKE_DIR}
  )

  install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})
  install(FILES LICENSE DESTINATION ${TAOCPP_JSON_INSTALL_DOC_DIR})

  export(EXPORT ${PROJECT_NAME}-targets
    FILE ${taocpp-json_BINARY_DIR}/${PROJECT_NAME}-targets.cmake
    NAMESPACE taocpp::
  )
endif()
