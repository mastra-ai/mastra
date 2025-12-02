
# Add include folders to the library and targets that consume it
# the SYSTEM keyword suppresses warnings for users of the library
#
# By adding this directory as an include directory the user gets a
# namespace effect.
#
# IE:
#   #include <gsl/gsl>
if(GSL_STANDALONE_PROJECT)
    target_include_directories(GSL INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
    )
else()
    target_include_directories(GSL SYSTEM INTERFACE
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}>
        $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>
    )
endif()
