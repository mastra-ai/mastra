cmake_minimum_required(VERSION 3.1.3...3.16)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake/")
include(guidelineSupportLibrary)

project(GSL
    VERSION 4.0.0
    LANGUAGES CXX
)

# Must include after the project call due to GNUInstallDirs requiring a language be enabled (IE. CXX)
include(GNUInstallDirs)

# Creates a library GSL which is an interface (header files only)
add_library(GSL INTERFACE)

# NOTE: If you want to use GSL prefer to link against GSL using this alias target
# EX:
#   target_link_libraries(foobar PRIVATE Microsoft.GSL::GSL)
#
# Add Microsoft.GSL::GSL alias for GSL so that dependents can be agnostic about
# whether GSL was added via `add_subdirectory` or `find_package`
add_library(Microsoft.GSL::GSL ALIAS GSL)

# Determine whether this is a standalone project or included by other projects
set(GSL_STANDALONE_PROJECT OFF)
if (CMAKE_CURRENT_SOURCE_DIR STREQUAL CMAKE_SOURCE_DIR)
    set(GSL_STANDALONE_PROJECT ON)
endif()

### Project options
option(GSL_INSTALL "Generate and install GSL target" ${GSL_STANDALONE_PROJECT})
option(GSL_TEST "Build and perform GSL tests" ${GSL_STANDALONE_PROJECT})

# This GSL implementation generally assumes a platform that implements C++14 support.
set(gsl_min_cxx_standard "14")

if (GSL_STANDALONE_PROJECT)
    gsl_set_default_cxx_standard(${gsl_min_cxx_standard})
else()
    gsl_client_set_cxx_standard(${gsl_min_cxx_standard})
endif()

# Setup include directory
add_subdirectory(include)

# Add natvis file
gsl_add_native_visualizer_support()

# Add packaging support
gsl_create_packaging_file()

if (GSL_INSTALL)
    # Setup install/export logic
    gsl_install_logic()
endif()

if (GSL_TEST)
    enable_testing()
    add_subdirectory(tests)
endif()
