add_library(couchbase_backtrace OBJECT backtrace.c)
target_include_directories(couchbase_backtrace PRIVATE ${PROJECT_BINARY_DIR}/generated ../..)
target_link_libraries(couchbase_backtrace PRIVATE ${PLATFORM_LIBRARIES})
set_target_properties(couchbase_backtrace PROPERTIES POSITION_INDEPENDENT_CODE ON)
