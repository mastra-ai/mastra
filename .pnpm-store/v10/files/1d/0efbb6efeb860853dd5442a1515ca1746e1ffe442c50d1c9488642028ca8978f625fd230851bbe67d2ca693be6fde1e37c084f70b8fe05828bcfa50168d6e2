
include(CheckLibraryExists)
check_library_exists(m ceil "" HAVE_LIBM)
check_library_exists(rt clock_gettime "" HAVE_LIBRT)

if (HDR_LOG_ENABLED)
    set(HDR_LOG_IMPLEMENTATION hdr_histogram_log.c)
    set(HDR_ZLIB ZLIB::ZLIB)
else()
    set(HDR_LOG_IMPLEMENTATION hdr_histogram_log_no_op.c)
    set(HDR_ZLIB "")
endif()

set(HDR_HISTOGRAM_SOURCES
    hdr_encoding.c
    hdr_histogram.c
    ${HDR_LOG_IMPLEMENTATION}
    hdr_interval_recorder.c
    hdr_thread.c
    hdr_time.c
    hdr_writer_reader_phaser.c)

set(HDR_HISTOGRAM_PRIVATE_HEADERS
    hdr_atomic.h
    hdr_encoding.h
    hdr_endian.h
    hdr_tests.h
    hdr_malloc.h)

function(hdr_histogram_add_library NAME LIBRARY_TYPE DO_INSTALL)
    add_library(${NAME} ${LIBRARY_TYPE}
        ${HDR_HISTOGRAM_SOURCES}
        ${HDR_HISTOGRAM_PRIVATE_HEADERS}
        ${HDR_HISTOGRAM_PUBLIC_HEADERS})

    target_link_libraries(${NAME}
        PRIVATE
#            ZLIB::ZLIB
            ${HDR_ZLIB}
#            $<$<BOOL:${ZLIB_FOUND}>ZLIB::ZLIB>
            Threads::Threads
            $<$<BOOL:${HAVE_LIBM}>:m>
            $<$<BOOL:${HAVE_LIBRT}>:rt>
            $<$<BOOL:${WIN32}>:ws2_32>)
    target_include_directories(
        ${NAME}
        PUBLIC
            $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/include>
            $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}/hdr>)
    if(DO_INSTALL)
        install(
            TARGETS ${NAME}
            EXPORT ${PROJECT_NAME}-targets
            RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
            ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
            LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR})
    endif()
endfunction()

option(HDR_HISTOGRAM_BUILD_SHARED "Build shared library" ON)
option(HDR_HISTOGRAM_INSTALL_SHARED "Install shared library" ON)
if(HDR_HISTOGRAM_BUILD_SHARED)
    hdr_histogram_add_library(hdr_histogram SHARED ${HDR_HISTOGRAM_INSTALL_SHARED})
    set_target_properties(hdr_histogram PROPERTIES
        VERSION ${HDR_VERSION}
        SOVERSION ${HDR_SOVERSION})
endif()

option(HDR_HISTOGRAM_BUILD_STATIC "Build static library" ON)
option(HDR_HISTOGRAM_INSTALL_STATIC "Install static library" ON)
if(HDR_HISTOGRAM_BUILD_STATIC)
    hdr_histogram_add_library(hdr_histogram_static STATIC ${HDR_HISTOGRAM_INSTALL_STATIC})
endif()
