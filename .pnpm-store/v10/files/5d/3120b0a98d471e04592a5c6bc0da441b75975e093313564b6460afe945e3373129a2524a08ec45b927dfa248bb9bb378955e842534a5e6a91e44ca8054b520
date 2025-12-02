cmake_minimum_required(VERSION 3.19)
message(STATUS "CMake version ${CMAKE_VERSION}")

set(couchbase_cxx_client_BUILD_NUMBER 1)
if(DEFINED ENV{BUILD_NUMBER})
  set(couchbase_cxx_client_BUILD_NUMBER $ENV{BUILD_NUMBER})
endif()

if(NOT DEFINED COUCHBASE_CXX_CLIENT_MASTER_PROJECT)
  if(CMAKE_CURRENT_SOURCE_DIR STREQUAL CMAKE_SOURCE_DIR)
    set(COUCHBASE_CXX_CLIENT_MASTER_PROJECT ON)
  else()
    set(COUCHBASE_CXX_CLIENT_MASTER_PROJECT OFF)
  endif()
endif()

option(COUCHBASE_CXX_CLIENT_COLUMNAR "Build with Columnar additions" FALSE)
if(COUCHBASE_CXX_CLIENT_COLUMNAR)
  message(STATUS "COUCHBASE_CXX_CLIENT_COLUMNAR=${COUCHBASE_CXX_CLIENT_COLUMNAR} building with Columnar additions.")
endif()

project(
  couchbase_cxx_client
  VERSION "1.2.0"
  LANGUAGES CXX C)
message(
  STATUS
    "Couchbase C++ client ${couchbase_cxx_client_VERSION} build ${couchbase_cxx_client_BUILD_NUMBER}, master: ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT}"
)
message(STATUS "System: ${CMAKE_SYSTEM_NAME}, ${CMAKE_SYSTEM_VERSION}, ${CMAKE_SYSTEM_PROCESSOR}")
if(WIN32)
  message(STATUS "Windows SDK: ${CMAKE_VS_WINDOWS_TARGET_PLATFORM_VERSION}")
endif()

include(cmake/TarballRelease.cmake OPTIONAL)

include(cmake/PreventInSourceBuilds.cmake)
include(cmake/StandardProjectSettings.cmake)

# enable cache system
include(cmake/Cache.cmake)

# standard compiler warnings
include(cmake/CompilerWarnings.cmake)

include(cmake/CompilerOptions.cmake)

# sanitizer options if supported by compiler
include(cmake/Sanitizers.cmake)

include(cmake/Profiler.cmake)

# allow for static analysis options
include(cmake/StaticAnalyzers.cmake)

if(COUCHBASE_CXX_CLIENT_MASTER_PROJECT)
  if(WIN32)
    add_definitions(-D_WIN32_WINNT=0x0601)
  endif()
endif()

find_package(Threads REQUIRED)

include(cmake/ThirdPartyDependencies.cmake)

include(cmake/VersionInfo.cmake)

include(cmake/RPath.cmake)

add_subdirectory(core/platform)
set(couchbase_cxx_client_FILES
    ${CMAKE_CURRENT_BINARY_DIR}/generated/mozilla_ca_bundle.cxx
    core/agent.cxx
    core/agent_config.cxx
    core/agent_group.cxx
    core/agent_group_config.cxx
    core/analytics_query_options.cxx
    core/bucket.cxx
    core/cluster.cxx
    core/cluster_agent.cxx
    core/cluster_agent_config.cxx
    core/cluster_options.cxx
    core/collections_component.cxx
    core/columnar/columnar_agent.cxx
    core/columnar/columnar_agent_config.cxx
    core/columnar/backoff_calculator.cxx
    core/columnar/columnar_error.cxx
    core/columnar/error_codes.cxx
    core/columnar/management_component.cxx
    core/columnar/query_component.cxx
    core/columnar/query_result.cxx
    core/config_profiles.cxx
    core/core_sdk_shim.cxx
    core/crud_component.cxx
    core/crypto/cbcrypto.cc
    core/dispatcher.cxx
    core/document_id.cxx
    core/error_context/key_value.cxx
    core/free_form_http_request.cxx
    core/http_component.cxx
    core/impl/analytics.cxx
    core/impl/analytics_error_category.cxx
    core/impl/analytics_index_manager.cxx
    core/impl/best_effort_retry_strategy.cxx
    core/impl/binary_collection.cxx
    core/impl/boolean_field_query.cxx
    core/impl/boolean_query.cxx
    core/impl/public_bucket.cxx
    core/impl/bucket_manager.cxx
    core/impl/public_cluster.cxx
    core/impl/collection.cxx
    core/impl/collection_manager.cxx
    core/impl/common_error_category.cxx
    core/impl/configuration_profiles_registry.cxx
    core/impl/conjunction_query.cxx
    core/impl/date_range.cxx
    core/impl/date_range_facet.cxx
    core/impl/date_range_facet_result.cxx
    core/impl/date_range_query.cxx
    core/impl/diagnostics.cxx
    core/impl/disjunction_query.cxx
    core/impl/dns_srv_tracker.cxx
    core/impl/doc_id_query.cxx
    core/impl/error.cxx
    core/impl/error_context.cxx
    core/impl/expiry.cxx
    core/impl/fail_fast_retry_strategy.cxx
    core/impl/field_level_encryption_error_category.cxx
    core/impl/geo_bounding_box_query.cxx
    core/impl/geo_distance_query.cxx
    core/impl/geo_polygon_query.cxx
    core/impl/get_replica.cxx
    core/impl/internal_date_range_facet_result.cxx
    core/impl/internal_error_context.cxx
    core/impl/internal_numeric_range_facet_result.cxx
    core/impl/internal_search_error_context.cxx
    core/impl/internal_search_meta_data.cxx
    core/impl/internal_search_result.cxx
    core/impl/internal_search_row.cxx
    core/impl/internal_search_row_locations.cxx
    core/impl/internal_term_facet_result.cxx
    core/impl/key_value_error_category.cxx
    core/impl/key_value_error_context.cxx
    core/impl/public_logger.cxx
    core/impl/lookup_in_replica.cxx
    core/impl/management_error_category.cxx
    core/impl/match_all_query.cxx
    core/impl/match_none_query.cxx
    core/impl/match_phrase_query.cxx
    core/impl/match_query.cxx
    core/impl/network_error_category.cxx
    core/impl/numeric_range.cxx
    core/impl/numeric_range_facet.cxx
    core/impl/numeric_range_facet_result.cxx
    core/impl/numeric_range_query.cxx
    core/impl/observe_poll.cxx
    core/impl/observe_seqno.cxx
    core/impl/phrase_query.cxx
    core/impl/prefix_query.cxx
    core/impl/query.cxx
    core/impl/query_error_category.cxx
    core/impl/query_error_context.cxx
    core/impl/query_index_manager.cxx
    core/impl/query_string_query.cxx
    core/impl/regexp_query.cxx
    core/impl/replica_utils.cxx
    core/impl/retry_action.cxx
    core/impl/retry_reason.cxx
    core/impl/public_scan_result.cxx
    core/impl/scope.cxx
    core/impl/search.cxx
    core/impl/search_error_category.cxx
    core/impl/search_index_manager.cxx
    core/impl/search_meta_data.cxx
    core/impl/search_request.cxx
    core/impl/search_result.cxx
    core/impl/search_row.cxx
    core/impl/search_row_location.cxx
    core/impl/search_row_locations.cxx
    core/impl/search_sort_field.cxx
    core/impl/search_sort_geo_distance.cxx
    core/impl/search_sort_id.cxx
    core/impl/search_sort_score.cxx
    core/impl/streaming_json_lexer_error_category.cxx
    core/impl/subdoc/array_add_unique.cxx
    core/impl/subdoc/array_append.cxx
    core/impl/subdoc/array_insert.cxx
    core/impl/subdoc/array_prepend.cxx
    core/impl/subdoc/count.cxx
    core/impl/subdoc/counter.cxx
    core/impl/subdoc/exists.cxx
    core/impl/subdoc/get.cxx
    core/impl/subdoc/insert.cxx
    core/impl/subdoc/join_values.cxx
    core/impl/subdoc/lookup_in_macro.cxx
    core/impl/subdoc/lookup_in_specs.cxx
    core/impl/subdoc/mutate_in_macro.cxx
    core/impl/subdoc/mutate_in_specs.cxx
    core/impl/subdoc/remove.cxx
    core/impl/subdoc/replace.cxx
    core/impl/subdoc/upsert.cxx
    core/impl/term_facet.cxx
    core/impl/term_facet_result.cxx
    core/impl/term_query.cxx
    core/impl/term_range_query.cxx
    core/impl/transaction_error_category.cxx
    core/impl/transaction_get_multi_replicas_from_preferred_server_group_spec.cxx
    core/impl/transaction_get_multi_spec.cxx
    core/impl/public_transaction_get_result.cxx
    core/impl/transaction_op_error_category.cxx
    core/impl/vector_query.cxx
    core/impl/vector_search.cxx
    core/impl/view_error_category.cxx
    core/impl/wildcard_query.cxx
    core/impl/crypto.cxx
    core/io/config_tracker.cxx
    core/io/dns_client.cxx
    core/io/dns_config.cxx
    core/io/http_parser.cxx
    core/io/http_session.cxx
    core/io/http_streaming_parser.cxx
    core/io/http_streaming_response.cxx
    core/io/mcbp_message.cxx
    core/io/mcbp_parser.cxx
    core/io/mcbp_session.cxx
    core/io/streams.cxx
    core/key_value_config.cxx
    core/logger/custom_rotating_file_sink.cxx
    core/logger/logger.cxx
    core/management/analytics_link_azure_blob_external.cxx
    core/management/analytics_link_couchbase_remote.cxx
    core/management/analytics_link_s3_external.cxx
    core/management/search_index.cxx
    core/mcbp/big_endian.cxx
    core/mcbp/buffer_writer.cxx
    core/mcbp/codec.cxx
    core/mcbp/command_code.cxx
    core/mcbp/operation_consumer.cxx
    core/mcbp/operation_queue.cxx
    core/mcbp/packet.cxx
    core/mcbp/queue_request.cxx
    core/mcbp/server_duration.cxx
    core/meta/version.cxx
    core/metrics/logging_meter.cxx
    core/metrics/meter_wrapper.cxx
    core/n1ql_query_options.cxx
    core/operations/document_analytics.cxx
    core/operations/document_append.cxx
    core/operations/document_decrement.cxx
    core/operations/document_exists.cxx
    core/operations/document_get.cxx
    core/operations/document_get_and_lock.cxx
    core/operations/document_get_and_touch.cxx
    core/operations/document_get_projected.cxx
    core/operations/document_increment.cxx
    core/operations/document_insert.cxx
    core/operations/document_lookup_in.cxx
    core/operations/document_mutate_in.cxx
    core/operations/document_prepend.cxx
    core/operations/document_query.cxx
    core/operations/document_remove.cxx
    core/operations/document_replace.cxx
    core/operations/document_search.cxx
    core/operations/document_touch.cxx
    core/operations/document_unlock.cxx
    core/operations/document_upsert.cxx
    core/operations/document_view.cxx
    core/operations/http_noop.cxx
    core/operations/management/analytics_dataset_create.cxx
    core/operations/management/analytics_dataset_drop.cxx
    core/operations/management/analytics_dataset_get_all.cxx
    core/operations/management/analytics_dataverse_create.cxx
    core/operations/management/analytics_dataverse_drop.cxx
    core/operations/management/analytics_get_pending_mutations.cxx
    core/operations/management/analytics_index_create.cxx
    core/operations/management/analytics_index_drop.cxx
    core/operations/management/analytics_index_get_all.cxx
    core/operations/management/analytics_link_connect.cxx
    core/operations/management/analytics_link_create.cxx
    core/operations/management/analytics_link_disconnect.cxx
    core/operations/management/analytics_link_drop.cxx
    core/operations/management/analytics_link_get_all.cxx
    core/operations/management/analytics_link_replace.cxx
    core/operations/management/bucket_create.cxx
    core/operations/management/bucket_describe.cxx
    core/operations/management/bucket_drop.cxx
    core/operations/management/bucket_flush.cxx
    core/operations/management/bucket_get.cxx
    core/operations/management/bucket_get_all.cxx
    core/operations/management/bucket_update.cxx
    core/operations/management/change_password.cxx
    core/operations/management/cluster_describe.cxx
    core/operations/management/cluster_developer_preview_enable.cxx
    core/operations/management/collection_create.cxx
    core/operations/management/collection_drop.cxx
    core/operations/management/collection_update.cxx
    core/operations/management/collections_manifest_get.cxx
    core/operations/management/error_utils.cxx
    core/operations/management/eventing_deploy_function.cxx
    core/operations/management/eventing_drop_function.cxx
    core/operations/management/eventing_get_all_functions.cxx
    core/operations/management/eventing_get_function.cxx
    core/operations/management/eventing_get_status.cxx
    core/operations/management/eventing_pause_function.cxx
    core/operations/management/eventing_resume_function.cxx
    core/operations/management/eventing_undeploy_function.cxx
    core/operations/management/eventing_upsert_function.cxx
    core/operations/management/freeform.cxx
    core/operations/management/group_drop.cxx
    core/operations/management/group_get.cxx
    core/operations/management/group_get_all.cxx
    core/operations/management/group_upsert.cxx
    core/operations/management/query_index_build.cxx
    core/operations/management/query_index_create.cxx
    core/operations/management/query_index_drop.cxx
    core/operations/management/query_index_get_all.cxx
    core/operations/management/query_index_get_all_deferred.cxx
    core/operations/management/role_get_all.cxx
    core/operations/management/scope_create.cxx
    core/operations/management/scope_drop.cxx
    core/operations/management/scope_get_all.cxx
    core/operations/management/search_get_stats.cxx
    core/operations/management/search_index_analyze_document.cxx
    core/operations/management/search_index_control_ingest.cxx
    core/operations/management/search_index_control_plan_freeze.cxx
    core/operations/management/search_index_control_query.cxx
    core/operations/management/search_index_drop.cxx
    core/operations/management/search_index_get.cxx
    core/operations/management/search_index_get_all.cxx
    core/operations/management/search_index_get_documents_count.cxx
    core/operations/management/search_index_get_stats.cxx
    core/operations/management/search_index_upsert.cxx
    core/operations/management/user_drop.cxx
    core/operations/management/user_get.cxx
    core/operations/management/user_get_all.cxx
    core/operations/management/user_upsert.cxx
    core/operations/management/view_index_drop.cxx
    core/operations/management/view_index_get.cxx
    core/operations/management/view_index_get_all.cxx
    core/operations/management/view_index_upsert.cxx
    core/origin.cxx
    core/platform/base64.cc
    core/platform/dirutils.cc
    core/platform/random.cc
    core/platform/string_hex.cc
    core/platform/terminate_handler.cc
    core/platform/uuid.cc
    core/protocol/client_request.cxx
    core/protocol/client_response.cxx
    core/protocol/cmd_append.cxx
    core/protocol/cmd_cluster_map_change_notification.cxx
    core/protocol/cmd_decrement.cxx
    core/protocol/cmd_get.cxx
    core/protocol/cmd_get_and_lock.cxx
    core/protocol/cmd_get_and_touch.cxx
    core/protocol/cmd_get_cluster_config.cxx
    core/protocol/cmd_get_collection_id.cxx
    core/protocol/cmd_get_collections_manifest.cxx
    core/protocol/cmd_get_error_map.cxx
    core/protocol/cmd_get_meta.cxx
    core/protocol/cmd_get_replica.cxx
    core/protocol/cmd_hello.cxx
    core/protocol/cmd_increment.cxx
    core/protocol/cmd_insert.cxx
    core/protocol/cmd_lookup_in.cxx
    core/protocol/cmd_lookup_in_replica.cxx
    core/protocol/cmd_mutate_in.cxx
    core/protocol/cmd_noop.cxx
    core/protocol/cmd_observe_seqno.cxx
    core/protocol/cmd_prepend.cxx
    core/protocol/cmd_remove.cxx
    core/protocol/cmd_replace.cxx
    core/protocol/cmd_sasl_auth.cxx
    core/protocol/cmd_sasl_list_mechs.cxx
    core/protocol/cmd_sasl_step.cxx
    core/protocol/cmd_select_bucket.cxx
    core/protocol/cmd_touch.cxx
    core/protocol/cmd_unlock.cxx
    core/protocol/cmd_upsert.cxx
    core/protocol/frame_info_utils.cxx
    core/protocol/status.cxx
    core/range_scan_load_balancer.cxx
    core/range_scan_options.cxx
    core/range_scan_orchestrator.cxx
    core/retry_orchestrator.cxx
    core/row_streamer.cxx
    core/sasl/client.cc
    core/sasl/context.cc
    core/sasl/mechanism.cc
    core/sasl/plain/plain.cc
    core/sasl/scram-sha/scram-sha.cc
    core/sasl/scram-sha/stringutils.cc
    core/scan_result.cxx
    core/search_query_options.cxx
    core/seed_config.cxx
    core/topology/capabilities.cxx
    core/topology/configuration.cxx
    core/tracing/threshold_logging_tracer.cxx
    core/tracing/tracer_wrapper.cxx
    core/transactions/active_transaction_record.cxx
    core/transactions/async_attempt_context.cxx
    core/transactions/atr_cleanup_entry.cxx
    core/transactions/atr_ids.cxx
    core/transactions/attempt_context.cxx
    core/transactions/attempt_context_impl.cxx
    core/transactions/attempt_context_testing_hooks.cxx
    core/transactions/cleanup_testing_hooks.cxx
    core/transactions/exceptions.cxx
    core/transactions/forward_compat.cxx
    core/transactions/get_multi_orchestrator.cxx
    core/transactions/internal/doc_record.cxx
    core/transactions/result.cxx
    core/transactions/staged_mutation.cxx
    core/transactions/transaction_attempt.cxx
    core/transactions/transaction_context.cxx
    core/transactions/transaction_get_result.cxx
    core/transactions/transaction_keyspace.cxx
    core/transactions/transaction_links.cxx
    core/transactions/transaction_options.cxx
    core/transactions/transactions.cxx
    core/transactions/transactions_cleanup.cxx
    core/transactions/transactions_config.cxx
    core/transactions/uid_generator.cxx
    core/transactions/utils.cxx
    core/utils/binary.cxx
    core/utils/connection_string.cxx
    core/utils/duration_parser.cxx
    core/utils/json.cxx
    core/utils/json_streaming_lexer.cxx
    core/utils/mutation_token.cxx
    core/utils/split_string.cxx
    core/utils/url_codec.cxx
    core/view_query_options.cxx
    core/websocket_codec.cxx
    core/app_telemetry_address.cxx
    core/app_telemetry_meter.cxx
    core/app_telemetry_reporter.cxx
    core/cluster_credentials.cxx)

set(couchbase_cxx_client_LIBRARIES)
set(couchbase_cxx_client_DEFAULT_LIBRARY)

option(COUCHBASE_CXX_CLIENT_BUILD_STATIC "Build with static library" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_STATIC)
  add_library(couchbase_cxx_client_static_intermediate STATIC ${couchbase_cxx_client_FILES})
  add_library(couchbase_cxx_client::couchbase_cxx_client_static_intermediate ALIAS
              couchbase_cxx_client_static_intermediate)
  target_compile_definitions(couchbase_cxx_client_static_intermediate PRIVATE COUCHBASE_CXX_CLIENT_STATIC_TARGET)

  option(COUCHBASE_CXX_CLIENT_STATIC_STDLIB "Statically link C++ standard library" FALSE)
  if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
    if(COUCHBASE_CXX_CLIENT_STATIC_STDLIB)
      target_compile_options(couchbase_cxx_client_static_intermediate PRIVATE -static-libgcc -static-libstdc++)
      target_link_libraries(couchbase_cxx_client_static_intermediate PRIVATE -static-libgcc -static-libstdc++)
    endif()
  endif()
  list(APPEND couchbase_cxx_client_LIBRARIES couchbase_cxx_client_static_intermediate)
  set(couchbase_cxx_client_DEFAULT_LIBRARY couchbase_cxx_client::couchbase_cxx_client_static)
endif()

option(COUCHBASE_CXX_CLIENT_BUILD_SHARED "Build with shared library" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_SHARED OR BUILD_SHARED_LIBS)
  add_library(couchbase_cxx_client SHARED ${couchbase_cxx_client_FILES})
  add_library(couchbase_cxx_client::couchbase_cxx_client ALIAS couchbase_cxx_client)

  set_target_properties(couchbase_cxx_client PROPERTIES VERSION ${couchbase_cxx_client_VERSION_MAJOR}
                                                        SOVERSION ${couchbase_cxx_client_VERSION})
  list(APPEND couchbase_cxx_client_LIBRARIES couchbase_cxx_client)
  if(NOT WIN32)
    set(couchbase_cxx_client_DEFAULT_LIBRARY couchbase_cxx_client::couchbase_cxx_client)
  endif()
endif()

if(NOT couchbase_cxx_client_DEFAULT_LIBRARY)
  message(FATAL_ERROR "Either static or shared version of couchbase-cxx-client
have to be selected")
endif()

foreach(TARGET ${couchbase_cxx_client_LIBRARIES})
  include(cmake/DetectStandardFilesystem.cmake)
  couchbase_cxx_check_filesystem(
    ${TARGET}
    "filesystem"
    "std::filesystem"
    "stdc++fs;c++fs"
    STD_FILESYSTEM)
  if(STD_FILESYSTEM)
    message(STATUS "Using std::filesystem")
  else()
    message(FATAL_ERROR "Couchbase C++ Client requires C++17, including an implementation of std::filesystem.")
  endif()

  set_target_properties(${TARGET} PROPERTIES POSITION_INDEPENDENT_CODE ON)

  target_include_directories(${TARGET} PRIVATE $<BUILD_INTERFACE:${PROJECT_BINARY_DIR}/generated>
                                               $<BUILD_INTERFACE:${PROJECT_BINARY_DIR}/generated_$<CONFIG>>)

  target_include_directories(
    ${TARGET} SYSTEM
    PRIVATE $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/third_party/cxx_function>
            $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/third_party/expected/include>
            $<BUILD_INTERFACE:$<TARGET_PROPERTY:jsonsl,INTERFACE_INCLUDE_DIRECTORIES>>
            $<BUILD_INTERFACE:$<TARGET_PROPERTY:asio,INTERFACE_INCLUDE_DIRECTORIES>>)

  target_include_directories(${TARGET} PUBLIC $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}>)
  target_include_directories(${TARGET} PUBLIC $<INSTALL_INTERFACE:${CMAKE_INSTALL_INCLUDEDIR}>)

  enable_sanitizers(${TARGET})
  enable_profiler(${TARGET})
  set_project_warnings(${TARGET})
  set_project_options(${TARGET})
  target_link_libraries(${TARGET} PUBLIC $<BUILD_INTERFACE:spdlog::spdlog>)
  target_link_libraries(
    ${TARGET}
    PRIVATE $<BUILD_INTERFACE:llhttp::llhttp>
            $<BUILD_INTERFACE:taocpp::json>
            $<BUILD_INTERFACE:snappy>
            $<BUILD_INTERFACE:hdr_histogram_static>
            $<BUILD_INTERFACE:Microsoft.GSL::GSL>
            $<BUILD_INTERFACE:asio>
            $<BUILD_INTERFACE:couchbase_backtrace>
            $<BUILD_INTERFACE:jsonsl>)

  if(HAVE_BACKTRACE)
    target_link_libraries(${TARGET} PRIVATE ${PLATFORM_LIBRARIES})
  endif()
  if(WIN32)
    target_link_libraries(${TARGET} PRIVATE iphlpapi)
  endif()

  if(NOT COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL)
    if(COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL)
      if(COUCHBASE_CXX_CLIENT_USE_BORINGSSL_PREFIX)
        target_compile_definitions(${TARGET} PUBLIC BORINGSSL_PREFIX=${COUCHBASE_CXX_CLIENT_BORINGSSL_PREFIX})
      endif()
      if(WIN32 AND NOT CMAKE_MSVC_RUNTIME_LIBRARY)
        # BoringSSL uses the /MD compile flag, so we need to do the same
        set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
        message(STATUS "CMAKE_MSVC_RUNTIME_LIBRARY=${CMAKE_MSVC_RUNTIME_LIBRARY}")
      endif()
      if(MINGW)
        target_link_libraries(${TARGET} PUBLIC ws2_32)
      endif()
      target_link_libraries(${TARGET} PRIVATE $<BUILD_INTERFACE:ssl> $<BUILD_INTERFACE:crypto>)
      target_include_directories(
        ${TARGET} PRIVATE $<BUILD_INTERFACE:$<TARGET_PROPERTY:ssl,INTERFACE_INCLUDE_DIRECTORIES>>
                          $<BUILD_INTERFACE:$<TARGET_PROPERTY:crypto,INTERFACE_INCLUDE_DIRECTORIES>>)
    else()
      if(TARGET PkgConfig::PKG_CONFIG_OPENSSL)
        target_link_libraries(${TARGET} PUBLIC PkgConfig::PKG_CONFIG_OPENSSL)
      else()
        target_link_libraries(${TARGET} PUBLIC OpenSSL::SSL OpenSSL::Crypto)
      endif()
    endif()
  endif()

  if(COUCHBASE_CXX_CLIENT_CLANG_TIDY)
    set_target_properties(${TARGET} PROPERTIES CXX_CLANG_TIDY "${COUCHBASE_CXX_CLIENT_CLANG_TIDY}")
    message(STATUS "clang-tidy: ${COUCHBASE_CXX_CLIENT_CLANG_TIDY}")
  endif()
endforeach()

if(COUCHBASE_CXX_CLIENT_BUILD_STATIC)
  if(COUCHBASE_CXX_CLIENT_INSTALL)
    include(cmake/Bundler.cmake)
    bundle_static_library(couchbase_cxx_client_static_intermediate couchbase_cxx_client_static)
    add_library(couchbase_cxx_client::couchbase_cxx_client_static ALIAS couchbase_cxx_client_static)
  else()
    add_library(couchbase_cxx_client::couchbase_cxx_client_static ALIAS couchbase_cxx_client_static_intermediate)
  endif()
endif()

option(COUCHBASE_CXX_CLIENT_BUILD_TESTS "Build test programs" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_TESTS)
  include(cmake/Testing.cmake)
endif()

option(COUCHBASE_CXX_CLIENT_BUILD_DOCS "Build API documentation" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_DOCS)
  include(cmake/Documentation.cmake)
endif()

option(COUCHBASE_CXX_CLIENT_BUILD_EXAMPLES "Build example programs" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_EXAMPLES)
  add_subdirectory(examples)
endif()

option(COUCHBASE_CXX_CLIENT_BUILD_TOOLS "Build tools" ${COUCHBASE_CXX_CLIENT_MASTER_PROJECT})
if(COUCHBASE_CXX_CLIENT_BUILD_TOOLS)
  add_subdirectory(tools)
endif()

option(COUCHBASE_CXX_CLIENT_INSTALL "Install library" OFF)
if(COUCHBASE_CXX_CLIENT_INSTALL)
  include(cmake/Packaging.cmake)
endif()
