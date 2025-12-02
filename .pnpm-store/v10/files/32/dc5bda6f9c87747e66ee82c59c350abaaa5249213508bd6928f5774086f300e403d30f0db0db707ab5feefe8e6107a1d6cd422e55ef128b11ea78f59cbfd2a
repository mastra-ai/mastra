# Try compiling a test program with std::filesystem or one of its alternatives
function(couchbase_cxx_check_filesystem TARGET FILESYSTEM_HEADER FILESYSTEM_NAMESPACE OPTIONAL_LIBS OUT_RESULT)
    set(TEST_FILE "test_${OUT_RESULT}.cpp")
    configure_file(${PROJECT_SOURCE_DIR}/cmake/test_filesystem.cpp.in ${TEST_FILE} @ONLY)

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
                message(STATUS "Adding ${OPTIONAL_LIB} to the Couchbase C++ Client to build with ${FILESYSTEM_NAMESPACE}.")
                target_link_libraries(${TARGET} INTERFACE ${OPTIONAL_LIB})
                break()
            endif()
        endforeach()
    endif()

    set(${OUT_RESULT} ${TEST_RESULT} PARENT_SCOPE)
endfunction()
