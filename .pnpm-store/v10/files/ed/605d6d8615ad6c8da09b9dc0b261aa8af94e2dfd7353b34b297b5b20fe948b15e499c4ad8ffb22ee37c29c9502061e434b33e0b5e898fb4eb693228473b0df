#include "constants.hpp"
#include "jstocbpp.hpp"
#include <core/cluster.hxx>
#include <core/impl/subdoc/path_flags.hxx>
#include <core/transactions.hxx>
#include <core/transactions/internal/exceptions_internal.hxx>
#include <core/transactions/transaction_get_multi_mode.hxx>
#include <core/transactions/transaction_get_multi_replicas_from_preferred_server_group_result.hxx>
#include <couchbase/error_context.hxx>
#include <set>
#include <vector>

namespace couchnode
{

template <typename T>
static inline Napi::Object
cbppEnumToJs(Napi::Env env,
             const std::vector<std::pair<std::string, T>> &values)
{
    auto jsVals = Napi::Object::New(env);
    auto dedupValues = std::set<T>();
    for (const auto &value : values) {
        auto dedupRes = dedupValues.emplace(value.second);
        if (!dedupRes.second) {
            throw Napi::Error::New(env,
                                   "duplicate constants during initialization");
        }

        jsVals.Set(value.first,
                   Napi::Number::New(env, static_cast<int64_t>(value.second)));
    }
    return jsVals;
}

void Constants::Init(Napi::Env env, Napi::Object exports)
{
    InitAutogen(env, exports);

    exports.Set(
        "protocol_lookup_in_request_body_doc_flag",
        cbppEnumToJs<uint8_t>(
            env, {
                     {"access_deleted",
                      couchbase::core::protocol::lookup_in_request_body::
                          doc_flag_access_deleted},

                 }));

    exports.Set(
        "protocol_lookup_in_request_body_lookup_in_specs_path_flag",
        cbppEnumToJs<std::byte>(
            env, {
                     {"xattr", couchbase::core::impl::subdoc::path_flag_xattr},
                 }));

    exports.Set(
        "protocol_mutate_in_request_body_doc_flag",
        cbppEnumToJs<std::byte>(
            env, {
                     {"mkdoc", couchbase::core::protocol::
                                   mutate_in_request_body::doc_flag_mkdoc},
                     {"add", couchbase::core::protocol::mutate_in_request_body::
                                 doc_flag_add},
                     {"access_deleted",
                      couchbase::core::protocol::mutate_in_request_body::
                          doc_flag_access_deleted},
                     {"create_as_deleted",
                      couchbase::core::protocol::mutate_in_request_body::
                          doc_flag_create_as_deleted},
                     {"revive_document",
                      couchbase::core::protocol::mutate_in_request_body::
                          doc_flag_revive_document},
                 }));

    exports.Set(
        "protocol_mutate_in_request_body_mutate_in_specs_path_flag",
        cbppEnumToJs<std::byte>(
            env, {
                     {"create_parents",
                      couchbase::core::impl::subdoc::path_flag_create_parents},
                     {"xattr", couchbase::core::impl::subdoc::path_flag_xattr},
                     {"expand_macros",
                      couchbase::core::impl::subdoc::path_flag_expand_macros},
                 }));

    exports.Set(
        "txn_failure_type",
        cbppEnumToJs<couchbase::core::transactions::failure_type>(
            env,
            {
                {"fail", couchbase::core::transactions::failure_type::FAIL},
                {"expiry", couchbase::core::transactions::failure_type::EXPIRY},
                {"commit_ambiguous",
                 couchbase::core::transactions::failure_type::COMMIT_AMBIGUOUS},
            }));

    exports.Set(
        "txn_external_exception",
        cbppEnumToJs<couchbase::core::transactions::external_exception>(
            env,
            {
                {"unknown",
                 couchbase::core::transactions::external_exception::UNKNOWN},
                {"active_transaction_record_entry_not_found",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND},
                {"active_transaction_record_full",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_FULL},
                {"active_transaction_record_not_found",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_NOT_FOUND},
                {"document_already_in_transaction",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_ALREADY_IN_TRANSACTION},
                {"document_exists_exception",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_EXISTS_EXCEPTION},
                {"document_not_found_exception",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_NOT_FOUND_EXCEPTION},
                {"not_set",
                 couchbase::core::transactions::external_exception::NOT_SET},
                {"feature_not_available_exception",
                 couchbase::core::transactions::external_exception::
                     FEATURE_NOT_AVAILABLE_EXCEPTION},
                {"transaction_aborted_externally",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ABORTED_EXTERNALLY},
                {"previous_operation_failed",
                 couchbase::core::transactions::external_exception::
                     PREVIOUS_OPERATION_FAILED},
                {"forward_compatibility_failure",
                 couchbase::core::transactions::external_exception::
                     FORWARD_COMPATIBILITY_FAILURE},
                {"parsing_failure", couchbase::core::transactions::
                                        external_exception::PARSING_FAILURE},
                {"illegal_state_exception",
                 couchbase::core::transactions::external_exception::
                     ILLEGAL_STATE_EXCEPTION},
                {"couchbase_exception",
                 couchbase::core::transactions::external_exception::
                     COUCHBASE_EXCEPTION},
                {"service_not_available_exception",
                 couchbase::core::transactions::external_exception::
                     SERVICE_NOT_AVAILABLE_EXCEPTION},
                {"request_canceled_exception",
                 couchbase::core::transactions::external_exception::
                     REQUEST_CANCELED_EXCEPTION},
                {"concurrent_operations_detected_on_same_document",
                 couchbase::core::transactions::external_exception::
                     CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT},
                {"commit_not_permitted",
                 couchbase::core::transactions::external_exception::
                     COMMIT_NOT_PERMITTED},
                {"rollback_not_permitted",
                 couchbase::core::transactions::external_exception::
                     ROLLBACK_NOT_PERMITTED},
                {"transaction_already_aborted",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ALREADY_ABORTED},
                {"transaction_already_committed",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ALREADY_COMMITTED},
            }));
}

void Constants::InitAutogen(Napi::Env env, Napi::Object exports)
{
    //#region Autogenerated Constants

    exports.Set(
        "management_analytics_couchbase_link_encryption_level",
        cbppEnumToJs<couchbase::core::management::analytics::
                         couchbase_link_encryption_level>(
            env, {
                     {"none", couchbase::core::management::analytics::
                                  couchbase_link_encryption_level::none},
                     {"half", couchbase::core::management::analytics::
                                  couchbase_link_encryption_level::half},
                     {"full", couchbase::core::management::analytics::
                                  couchbase_link_encryption_level::full},
                 }));

    exports.Set(
        "management_cluster_bucket_type",
        cbppEnumToJs<couchbase::core::management::cluster::bucket_type>(
            env,
            {
                {"unknown",
                 couchbase::core::management::cluster::bucket_type::unknown},
                {"couchbase",
                 couchbase::core::management::cluster::bucket_type::couchbase},
                {"memcached",
                 couchbase::core::management::cluster::bucket_type::memcached},
                {"ephemeral",
                 couchbase::core::management::cluster::bucket_type::ephemeral},
            }));

    exports.Set(
        "management_cluster_bucket_compression",
        cbppEnumToJs<couchbase::core::management::cluster::bucket_compression>(
            env,
            {
                {"unknown", couchbase::core::management::cluster::
                                bucket_compression::unknown},
                {"off",
                 couchbase::core::management::cluster::bucket_compression::off},
                {"active", couchbase::core::management::cluster::
                               bucket_compression::active},
                {"passive", couchbase::core::management::cluster::
                                bucket_compression::passive},
            }));

    exports.Set(
        "management_cluster_bucket_eviction_policy",
        cbppEnumToJs<
            couchbase::core::management::cluster::bucket_eviction_policy>(
            env, {
                     {"unknown", couchbase::core::management::cluster::
                                     bucket_eviction_policy::unknown},
                     {"full", couchbase::core::management::cluster::
                                  bucket_eviction_policy::full},
                     {"value_only", couchbase::core::management::cluster::
                                        bucket_eviction_policy::value_only},
                     {"no_eviction", couchbase::core::management::cluster::
                                         bucket_eviction_policy::no_eviction},
                     {"not_recently_used",
                      couchbase::core::management::cluster::
                          bucket_eviction_policy::not_recently_used},
                 }));

    exports.Set(
        "management_cluster_bucket_conflict_resolution",
        cbppEnumToJs<
            couchbase::core::management::cluster::bucket_conflict_resolution>(
            env, {
                     {"unknown", couchbase::core::management::cluster::
                                     bucket_conflict_resolution::unknown},
                     {"timestamp", couchbase::core::management::cluster::
                                       bucket_conflict_resolution::timestamp},
                     {"sequence_number",
                      couchbase::core::management::cluster::
                          bucket_conflict_resolution::sequence_number},
                     {"custom", couchbase::core::management::cluster::
                                    bucket_conflict_resolution::custom},
                 }));

    exports.Set(
        "management_cluster_bucket_storage_backend",
        cbppEnumToJs<
            couchbase::core::management::cluster::bucket_storage_backend>(
            env, {
                     {"unknown", couchbase::core::management::cluster::
                                     bucket_storage_backend::unknown},
                     {"couchstore", couchbase::core::management::cluster::
                                        bucket_storage_backend::couchstore},
                     {"magma", couchbase::core::management::cluster::
                                   bucket_storage_backend::magma},
                 }));

    exports.Set(
        "management_eventing_function_dcp_boundary",
        cbppEnumToJs<
            couchbase::core::management::eventing::function_dcp_boundary>(
            env, {
                     {"everything", couchbase::core::management::eventing::
                                        function_dcp_boundary::everything},
                     {"from_now", couchbase::core::management::eventing::
                                      function_dcp_boundary::from_now},
                 }));

    exports.Set(
        "management_eventing_function_language_compatibility",
        cbppEnumToJs<couchbase::core::management::eventing::
                         function_language_compatibility>(
            env, {
                     {"version_6_0_0",
                      couchbase::core::management::eventing::
                          function_language_compatibility::version_6_0_0},
                     {"version_6_5_0",
                      couchbase::core::management::eventing::
                          function_language_compatibility::version_6_5_0},
                     {"version_6_6_2",
                      couchbase::core::management::eventing::
                          function_language_compatibility::version_6_6_2},
                     {"version_7_2_0",
                      couchbase::core::management::eventing::
                          function_language_compatibility::version_7_2_0},
                 }));

    exports.Set(
        "management_eventing_function_log_level",
        cbppEnumToJs<couchbase::core::management::eventing::function_log_level>(
            env, {
                     {"info", couchbase::core::management::eventing::
                                  function_log_level::info},
                     {"error", couchbase::core::management::eventing::
                                   function_log_level::error},
                     {"warning", couchbase::core::management::eventing::
                                     function_log_level::warning},
                     {"debug", couchbase::core::management::eventing::
                                   function_log_level::debug},
                     {"trace", couchbase::core::management::eventing::
                                   function_log_level::trace},
                 }));

    exports.Set(
        "management_eventing_function_bucket_access",
        cbppEnumToJs<
            couchbase::core::management::eventing::function_bucket_access>(
            env, {
                     {"read_only", couchbase::core::management::eventing::
                                       function_bucket_access::read_only},
                     {"read_write", couchbase::core::management::eventing::
                                        function_bucket_access::read_write},
                 }));

    exports.Set(
        "management_eventing_function_status",
        cbppEnumToJs<couchbase::core::management::eventing::function_status>(
            env, {
                     {"undeployed", couchbase::core::management::eventing::
                                        function_status::undeployed},
                     {"undeploying", couchbase::core::management::eventing::
                                         function_status::undeploying},
                     {"deploying", couchbase::core::management::eventing::
                                       function_status::deploying},
                     {"deployed", couchbase::core::management::eventing::
                                      function_status::deployed},
                     {"paused", couchbase::core::management::eventing::
                                    function_status::paused},
                     {"pausing", couchbase::core::management::eventing::
                                     function_status::pausing},
                 }));

    exports.Set(
        "management_eventing_function_deployment_status",
        cbppEnumToJs<
            couchbase::core::management::eventing::function_deployment_status>(
            env, {
                     {"deployed", couchbase::core::management::eventing::
                                      function_deployment_status::deployed},
                     {"undeployed", couchbase::core::management::eventing::
                                        function_deployment_status::undeployed},
                 }));

    exports.Set(
        "management_eventing_function_processing_status",
        cbppEnumToJs<
            couchbase::core::management::eventing::function_processing_status>(
            env, {
                     {"running", couchbase::core::management::eventing::
                                     function_processing_status::running},
                     {"paused", couchbase::core::management::eventing::
                                    function_processing_status::paused},
                 }));

    exports.Set(
        "management_rbac_auth_domain",
        cbppEnumToJs<couchbase::core::management::rbac::auth_domain>(
            env, {
                     {"unknown",
                      couchbase::core::management::rbac::auth_domain::unknown},
                     {"local",
                      couchbase::core::management::rbac::auth_domain::local},
                     {"external",
                      couchbase::core::management::rbac::auth_domain::external},
                 }));

    exports.Set(
        "retry_reason",
        cbppEnumToJs<couchbase::retry_reason>(
            env,
            {
                {"do_not_retry", couchbase::retry_reason::do_not_retry},
                {"unknown", couchbase::retry_reason::unknown},
                {"socket_not_available",
                 couchbase::retry_reason::socket_not_available},
                {"service_not_available",
                 couchbase::retry_reason::service_not_available},
                {"node_not_available",
                 couchbase::retry_reason::node_not_available},
                {"key_value_not_my_vbucket",
                 couchbase::retry_reason::key_value_not_my_vbucket},
                {"key_value_collection_outdated",
                 couchbase::retry_reason::key_value_collection_outdated},
                {"key_value_error_map_retry_indicated",
                 couchbase::retry_reason::key_value_error_map_retry_indicated},
                {"key_value_locked", couchbase::retry_reason::key_value_locked},
                {"key_value_temporary_failure",
                 couchbase::retry_reason::key_value_temporary_failure},
                {"key_value_sync_write_in_progress",
                 couchbase::retry_reason::key_value_sync_write_in_progress},
                {"key_value_sync_write_re_commit_in_progress",
                 couchbase::retry_reason::
                     key_value_sync_write_re_commit_in_progress},
                {"service_response_code_indicated",
                 couchbase::retry_reason::service_response_code_indicated},
                {"socket_closed_while_in_flight",
                 couchbase::retry_reason::socket_closed_while_in_flight},
                {"circuit_breaker_open",
                 couchbase::retry_reason::circuit_breaker_open},
                {"query_prepared_statement_failure",
                 couchbase::retry_reason::query_prepared_statement_failure},
                {"query_index_not_found",
                 couchbase::retry_reason::query_index_not_found},
                {"analytics_temporary_failure",
                 couchbase::retry_reason::analytics_temporary_failure},
                {"search_too_many_requests",
                 couchbase::retry_reason::search_too_many_requests},
                {"views_temporary_failure",
                 couchbase::retry_reason::views_temporary_failure},
                {"views_no_active_partition",
                 couchbase::retry_reason::views_no_active_partition},
            }));

    exports.Set(
        "protocol_subdoc_opcode",
        cbppEnumToJs<couchbase::core::protocol::subdoc_opcode>(
            env,
            {
                {"get_doc", couchbase::core::protocol::subdoc_opcode::get_doc},
                {"set_doc", couchbase::core::protocol::subdoc_opcode::set_doc},
                {"remove_doc",
                 couchbase::core::protocol::subdoc_opcode::remove_doc},
                {"get", couchbase::core::protocol::subdoc_opcode::get},
                {"exists", couchbase::core::protocol::subdoc_opcode::exists},
                {"dict_add",
                 couchbase::core::protocol::subdoc_opcode::dict_add},
                {"dict_upsert",
                 couchbase::core::protocol::subdoc_opcode::dict_upsert},
                {"remove", couchbase::core::protocol::subdoc_opcode::remove},
                {"replace", couchbase::core::protocol::subdoc_opcode::replace},
                {"array_push_last",
                 couchbase::core::protocol::subdoc_opcode::array_push_last},
                {"array_push_first",
                 couchbase::core::protocol::subdoc_opcode::array_push_first},
                {"array_insert",
                 couchbase::core::protocol::subdoc_opcode::array_insert},
                {"array_add_unique",
                 couchbase::core::protocol::subdoc_opcode::array_add_unique},
                {"counter", couchbase::core::protocol::subdoc_opcode::counter},
                {"get_count",
                 couchbase::core::protocol::subdoc_opcode::get_count},
                {"replace_body_with_xattr",
                 couchbase::core::protocol::subdoc_opcode::
                     replace_body_with_xattr},
            }));

    exports.Set(
        "analytics_scan_consistency",
        cbppEnumToJs<couchbase::core::analytics_scan_consistency>(
            env,
            {
                {"not_bounded",
                 couchbase::core::analytics_scan_consistency::not_bounded},
                {"request_plus",
                 couchbase::core::analytics_scan_consistency::request_plus},
            }));

    exports.Set(
        "design_document_namespace",
        cbppEnumToJs<couchbase::core::design_document_namespace>(
            env, {
                     {"development",
                      couchbase::core::design_document_namespace::development},
                     {"production",
                      couchbase::core::design_document_namespace::production},
                 }));

    exports.Set(
        "diag_cluster_state",
        cbppEnumToJs<couchbase::core::diag::cluster_state>(
            env,
            {
                {"online", couchbase::core::diag::cluster_state::online},
                {"degraded", couchbase::core::diag::cluster_state::degraded},
                {"offline", couchbase::core::diag::cluster_state::offline},
            }));

    exports.Set(
        "diag_endpoint_state",
        cbppEnumToJs<couchbase::core::diag::endpoint_state>(
            env,
            {
                {"disconnected",
                 couchbase::core::diag::endpoint_state::disconnected},
                {"connecting",
                 couchbase::core::diag::endpoint_state::connecting},
                {"connected", couchbase::core::diag::endpoint_state::connected},
                {"disconnecting",
                 couchbase::core::diag::endpoint_state::disconnecting},
            }));

    exports.Set(
        "diag_ping_state",
        cbppEnumToJs<couchbase::core::diag::ping_state>(
            env, {
                     {"ok", couchbase::core::diag::ping_state::ok},
                     {"timeout", couchbase::core::diag::ping_state::timeout},
                     {"error", couchbase::core::diag::ping_state::error},
                 }));

    exports.Set("query_profile",
                cbppEnumToJs<couchbase::query_profile>(
                    env, {
                             {"off", couchbase::query_profile::off},
                             {"phases", couchbase::query_profile::phases},
                             {"timings", couchbase::query_profile::timings},
                         }));

    exports.Set("query_scan_consistency",
                cbppEnumToJs<couchbase::query_scan_consistency>(
                    env, {
                             {"not_bounded",
                              couchbase::query_scan_consistency::not_bounded},
                             {"request_plus",
                              couchbase::query_scan_consistency::request_plus},
                         }));

    exports.Set(
        "search_highlight_style",
        cbppEnumToJs<couchbase::core::search_highlight_style>(
            env, {
                     {"html", couchbase::core::search_highlight_style::html},
                     {"ansi", couchbase::core::search_highlight_style::ansi},
                 }));

    exports.Set(
        "search_scan_consistency",
        cbppEnumToJs<couchbase::core::search_scan_consistency>(
            env, {
                     {"not_bounded",
                      couchbase::core::search_scan_consistency::not_bounded},
                 }));

    exports.Set(
        "service_type",
        cbppEnumToJs<couchbase::core::service_type>(
            env, {
                     {"key_value", couchbase::core::service_type::key_value},
                     {"query", couchbase::core::service_type::query},
                     {"analytics", couchbase::core::service_type::analytics},
                     {"search", couchbase::core::service_type::search},
                     {"view", couchbase::core::service_type::view},
                     {"management", couchbase::core::service_type::management},
                     {"eventing", couchbase::core::service_type::eventing},
                 }));

    exports.Set("view_on_error",
                cbppEnumToJs<couchbase::core::view_on_error>(
                    env, {
                             {"resume", couchbase::core::view_on_error::resume},
                             {"stop", couchbase::core::view_on_error::stop},
                         }));

    exports.Set(
        "view_scan_consistency",
        cbppEnumToJs<couchbase::core::view_scan_consistency>(
            env, {
                     {"not_bounded",
                      couchbase::core::view_scan_consistency::not_bounded},
                     {"update_after",
                      couchbase::core::view_scan_consistency::update_after},
                     {"request_plus",
                      couchbase::core::view_scan_consistency::request_plus},
                 }));

    exports.Set(
        "view_sort_order",
        cbppEnumToJs<couchbase::core::view_sort_order>(
            env,
            {
                {"ascending", couchbase::core::view_sort_order::ascending},
                {"descending", couchbase::core::view_sort_order::descending},
            }));

    exports.Set(
        "analytics_response_analytics_status",
        cbppEnumToJs<
            couchbase::core::operations::analytics_response::analytics_status>(
            env,
            {
                {"running", couchbase::core::operations::analytics_response::
                                analytics_status::running},
                {"success", couchbase::core::operations::analytics_response::
                                analytics_status::success},
                {"errors", couchbase::core::operations::analytics_response::
                               analytics_status::errors},
                {"completed", couchbase::core::operations::analytics_response::
                                  analytics_status::completed},
                {"stopped", couchbase::core::operations::analytics_response::
                                analytics_status::stopped},
                {"timedout", couchbase::core::operations::analytics_response::
                                 analytics_status::timedout},
                {"closed", couchbase::core::operations::analytics_response::
                               analytics_status::closed},
                {"fatal", couchbase::core::operations::analytics_response::
                              analytics_status::fatal},
                {"aborted", couchbase::core::operations::analytics_response::
                                analytics_status::aborted},
                {"unknown", couchbase::core::operations::analytics_response::
                                analytics_status::unknown},
            }));

    exports.Set(
        "durability_level",
        cbppEnumToJs<couchbase::durability_level>(
            env,
            {
                {"none", couchbase::durability_level::none},
                {"majority", couchbase::durability_level::majority},
                {"majority_and_persist_to_active",
                 couchbase::durability_level::majority_and_persist_to_active},
                {"persist_to_majority",
                 couchbase::durability_level::persist_to_majority},
            }));

    exports.Set(
        "errc_common",
        cbppEnumToJs<couchbase::errc::common>(
            env,
            {
                {"request_canceled", couchbase::errc::common::request_canceled},
                {"invalid_argument", couchbase::errc::common::invalid_argument},
                {"service_not_available",
                 couchbase::errc::common::service_not_available},
                {"internal_server_failure",
                 couchbase::errc::common::internal_server_failure},
                {"authentication_failure",
                 couchbase::errc::common::authentication_failure},
                {"temporary_failure",
                 couchbase::errc::common::temporary_failure},
                {"parsing_failure", couchbase::errc::common::parsing_failure},
                {"cas_mismatch", couchbase::errc::common::cas_mismatch},
                {"bucket_not_found", couchbase::errc::common::bucket_not_found},
                {"collection_not_found",
                 couchbase::errc::common::collection_not_found},
                {"unsupported_operation",
                 couchbase::errc::common::unsupported_operation},
                {"ambiguous_timeout",
                 couchbase::errc::common::ambiguous_timeout},
                {"unambiguous_timeout",
                 couchbase::errc::common::unambiguous_timeout},
                {"feature_not_available",
                 couchbase::errc::common::feature_not_available},
                {"scope_not_found", couchbase::errc::common::scope_not_found},
                {"index_not_found", couchbase::errc::common::index_not_found},
                {"index_exists", couchbase::errc::common::index_exists},
                {"encoding_failure", couchbase::errc::common::encoding_failure},
                {"decoding_failure", couchbase::errc::common::decoding_failure},
                {"rate_limited", couchbase::errc::common::rate_limited},
                {"quota_limited", couchbase::errc::common::quota_limited},
            }));

    exports.Set(
        "errc_key_value",
        cbppEnumToJs<couchbase::errc::key_value>(
            env,
            {
                {"document_not_found",
                 couchbase::errc::key_value::document_not_found},
                {"document_irretrievable",
                 couchbase::errc::key_value::document_irretrievable},
                {"document_locked",
                 couchbase::errc::key_value::document_locked},
                {"value_too_large",
                 couchbase::errc::key_value::value_too_large},
                {"document_exists",
                 couchbase::errc::key_value::document_exists},
                {"durability_level_not_available",
                 couchbase::errc::key_value::durability_level_not_available},
                {"durability_impossible",
                 couchbase::errc::key_value::durability_impossible},
                {"durability_ambiguous",
                 couchbase::errc::key_value::durability_ambiguous},
                {"durable_write_in_progress",
                 couchbase::errc::key_value::durable_write_in_progress},
                {"durable_write_re_commit_in_progress",
                 couchbase::errc::key_value::
                     durable_write_re_commit_in_progress},
                {"path_not_found", couchbase::errc::key_value::path_not_found},
                {"path_mismatch", couchbase::errc::key_value::path_mismatch},
                {"path_invalid", couchbase::errc::key_value::path_invalid},
                {"path_too_big", couchbase::errc::key_value::path_too_big},
                {"path_too_deep", couchbase::errc::key_value::path_too_deep},
                {"value_too_deep", couchbase::errc::key_value::value_too_deep},
                {"value_invalid", couchbase::errc::key_value::value_invalid},
                {"document_not_json",
                 couchbase::errc::key_value::document_not_json},
                {"number_too_big", couchbase::errc::key_value::number_too_big},
                {"delta_invalid", couchbase::errc::key_value::delta_invalid},
                {"path_exists", couchbase::errc::key_value::path_exists},
                {"xattr_unknown_macro",
                 couchbase::errc::key_value::xattr_unknown_macro},
                {"xattr_invalid_key_combo",
                 couchbase::errc::key_value::xattr_invalid_key_combo},
                {"xattr_unknown_virtual_attribute",
                 couchbase::errc::key_value::xattr_unknown_virtual_attribute},
                {"xattr_cannot_modify_virtual_attribute",
                 couchbase::errc::key_value::
                     xattr_cannot_modify_virtual_attribute},
                {"xattr_no_access",
                 couchbase::errc::key_value::xattr_no_access},
                {"document_not_locked",
                 couchbase::errc::key_value::document_not_locked},
                {"cannot_revive_living_document",
                 couchbase::errc::key_value::cannot_revive_living_document},
                {"mutation_token_outdated",
                 couchbase::errc::key_value::mutation_token_outdated},
                {"range_scan_completed",
                 couchbase::errc::key_value::range_scan_completed},
            }));

    exports.Set(
        "errc_query",
        cbppEnumToJs<couchbase::errc::query>(
            env,
            {
                {"planning_failure", couchbase::errc::query::planning_failure},
                {"index_failure", couchbase::errc::query::index_failure},
                {"prepared_statement_failure",
                 couchbase::errc::query::prepared_statement_failure},
                {"dml_failure", couchbase::errc::query::dml_failure},
            }));

    exports.Set(
        "errc_analytics",
        cbppEnumToJs<couchbase::errc::analytics>(
            env,
            {
                {"compilation_failure",
                 couchbase::errc::analytics::compilation_failure},
                {"job_queue_full", couchbase::errc::analytics::job_queue_full},
                {"dataset_not_found",
                 couchbase::errc::analytics::dataset_not_found},
                {"dataverse_not_found",
                 couchbase::errc::analytics::dataverse_not_found},
                {"dataset_exists", couchbase::errc::analytics::dataset_exists},
                {"dataverse_exists",
                 couchbase::errc::analytics::dataverse_exists},
                {"link_not_found", couchbase::errc::analytics::link_not_found},
                {"link_exists", couchbase::errc::analytics::link_exists},
            }));

    exports.Set("errc_search",
                cbppEnumToJs<couchbase::errc::search>(
                    env, {
                             {"index_not_ready",
                              couchbase::errc::search::index_not_ready},
                             {"consistency_mismatch",
                              couchbase::errc::search::consistency_mismatch},
                         }));

    exports.Set(
        "errc_view",
        cbppEnumToJs<couchbase::errc::view>(
            env, {
                     {"view_not_found", couchbase::errc::view::view_not_found},
                     {"design_document_not_found",
                      couchbase::errc::view::design_document_not_found},
                 }));

    exports.Set(
        "errc_management",
        cbppEnumToJs<couchbase::errc::management>(
            env,
            {
                {"collection_exists",
                 couchbase::errc::management::collection_exists},
                {"scope_exists", couchbase::errc::management::scope_exists},
                {"user_not_found", couchbase::errc::management::user_not_found},
                {"group_not_found",
                 couchbase::errc::management::group_not_found},
                {"bucket_exists", couchbase::errc::management::bucket_exists},
                {"user_exists", couchbase::errc::management::user_exists},
                {"bucket_not_flushable",
                 couchbase::errc::management::bucket_not_flushable},
                {"eventing_function_not_found",
                 couchbase::errc::management::eventing_function_not_found},
                {"eventing_function_not_deployed",
                 couchbase::errc::management::eventing_function_not_deployed},
                {"eventing_function_compilation_failure",
                 couchbase::errc::management::
                     eventing_function_compilation_failure},
                {"eventing_function_identical_keyspace",
                 couchbase::errc::management::
                     eventing_function_identical_keyspace},
                {"eventing_function_not_bootstrapped",
                 couchbase::errc::management::
                     eventing_function_not_bootstrapped},
                {"eventing_function_deployed",
                 couchbase::errc::management::eventing_function_deployed},
                {"eventing_function_paused",
                 couchbase::errc::management::eventing_function_paused},
            }));

    exports.Set(
        "errc_field_level_encryption",
        cbppEnumToJs<couchbase::errc::field_level_encryption>(
            env,
            {
                {"generic_cryptography_failure",
                 couchbase::errc::field_level_encryption::
                     generic_cryptography_failure},
                {"encryption_failure",
                 couchbase::errc::field_level_encryption::encryption_failure},
                {"decryption_failure",
                 couchbase::errc::field_level_encryption::decryption_failure},
                {"crypto_key_not_found",
                 couchbase::errc::field_level_encryption::crypto_key_not_found},
                {"invalid_crypto_key",
                 couchbase::errc::field_level_encryption::invalid_crypto_key},
                {"decrypter_not_found",
                 couchbase::errc::field_level_encryption::decrypter_not_found},
                {"encrypter_not_found",
                 couchbase::errc::field_level_encryption::encrypter_not_found},
                {"invalid_ciphertext",
                 couchbase::errc::field_level_encryption::invalid_ciphertext},
            }));

    exports.Set(
        "errc_network",
        cbppEnumToJs<couchbase::errc::network>(
            env,
            {
                {"resolve_failure", couchbase::errc::network::resolve_failure},
                {"no_endpoints_left",
                 couchbase::errc::network::no_endpoints_left},
                {"handshake_failure",
                 couchbase::errc::network::handshake_failure},
                {"protocol_error", couchbase::errc::network::protocol_error},
                {"configuration_not_available",
                 couchbase::errc::network::configuration_not_available},
                {"cluster_closed", couchbase::errc::network::cluster_closed},
                {"end_of_stream", couchbase::errc::network::end_of_stream},
                {"need_more_data", couchbase::errc::network::need_more_data},
                {"operation_queue_closed",
                 couchbase::errc::network::operation_queue_closed},
                {"operation_queue_full",
                 couchbase::errc::network::operation_queue_full},
                {"request_already_queued",
                 couchbase::errc::network::request_already_queued},
                {"request_cancelled",
                 couchbase::errc::network::request_cancelled},
                {"bucket_closed", couchbase::errc::network::bucket_closed},
            }));

    exports.Set(
        "key_value_status_code",
        cbppEnumToJs<couchbase::core::key_value_status_code>(
            env,
            {
                {"success", couchbase::core::key_value_status_code::success},
                {"not_found",
                 couchbase::core::key_value_status_code::not_found},
                {"exists", couchbase::core::key_value_status_code::exists},
                {"too_big", couchbase::core::key_value_status_code::too_big},
                {"invalid", couchbase::core::key_value_status_code::invalid},
                {"not_stored",
                 couchbase::core::key_value_status_code::not_stored},
                {"delta_bad_value",
                 couchbase::core::key_value_status_code::delta_bad_value},
                {"not_my_vbucket",
                 couchbase::core::key_value_status_code::not_my_vbucket},
                {"no_bucket",
                 couchbase::core::key_value_status_code::no_bucket},
                {"dcp_stream_not_found",
                 couchbase::core::key_value_status_code::dcp_stream_not_found},
                {"opaque_no_match",
                 couchbase::core::key_value_status_code::opaque_no_match},
                {"locked", couchbase::core::key_value_status_code::locked},
                {"not_locked",
                 couchbase::core::key_value_status_code::not_locked},
                {"config_only",
                 couchbase::core::key_value_status_code::config_only},
                {"auth_stale",
                 couchbase::core::key_value_status_code::auth_stale},
                {"auth_error",
                 couchbase::core::key_value_status_code::auth_error},
                {"auth_continue",
                 couchbase::core::key_value_status_code::auth_continue},
                {"range_error",
                 couchbase::core::key_value_status_code::range_error},
                {"rollback", couchbase::core::key_value_status_code::rollback},
                {"no_access",
                 couchbase::core::key_value_status_code::no_access},
                {"not_initialized",
                 couchbase::core::key_value_status_code::not_initialized},
                {"rate_limited_network_ingress",
                 couchbase::core::key_value_status_code::
                     rate_limited_network_ingress},
                {"rate_limited_network_egress",
                 couchbase::core::key_value_status_code::
                     rate_limited_network_egress},
                {"rate_limited_max_connections",
                 couchbase::core::key_value_status_code::
                     rate_limited_max_connections},
                {"rate_limited_max_commands",
                 couchbase::core::key_value_status_code::
                     rate_limited_max_commands},
                {"scope_size_limit_exceeded",
                 couchbase::core::key_value_status_code::
                     scope_size_limit_exceeded},
                {"unknown_frame_info",
                 couchbase::core::key_value_status_code::unknown_frame_info},
                {"unknown_command",
                 couchbase::core::key_value_status_code::unknown_command},
                {"no_memory",
                 couchbase::core::key_value_status_code::no_memory},
                {"not_supported",
                 couchbase::core::key_value_status_code::not_supported},
                {"internal", couchbase::core::key_value_status_code::internal},
                {"busy", couchbase::core::key_value_status_code::busy},
                {"temporary_failure",
                 couchbase::core::key_value_status_code::temporary_failure},
                {"xattr_invalid",
                 couchbase::core::key_value_status_code::xattr_invalid},
                {"unknown_collection",
                 couchbase::core::key_value_status_code::unknown_collection},
                {"no_collections_manifest",
                 couchbase::core::key_value_status_code::
                     no_collections_manifest},
                {"cannot_apply_collections_manifest",
                 couchbase::core::key_value_status_code::
                     cannot_apply_collections_manifest},
                {"collections_manifest_is_ahead",
                 couchbase::core::key_value_status_code::
                     collections_manifest_is_ahead},
                {"unknown_scope",
                 couchbase::core::key_value_status_code::unknown_scope},
                {"dcp_stream_id_invalid",
                 couchbase::core::key_value_status_code::dcp_stream_id_invalid},
                {"durability_invalid_level",
                 couchbase::core::key_value_status_code::
                     durability_invalid_level},
                {"durability_impossible",
                 couchbase::core::key_value_status_code::durability_impossible},
                {"sync_write_in_progress",
                 couchbase::core::key_value_status_code::
                     sync_write_in_progress},
                {"sync_write_ambiguous",
                 couchbase::core::key_value_status_code::sync_write_ambiguous},
                {"sync_write_re_commit_in_progress",
                 couchbase::core::key_value_status_code::
                     sync_write_re_commit_in_progress},
                {"subdoc_path_not_found",
                 couchbase::core::key_value_status_code::subdoc_path_not_found},
                {"subdoc_path_mismatch",
                 couchbase::core::key_value_status_code::subdoc_path_mismatch},
                {"subdoc_path_invalid",
                 couchbase::core::key_value_status_code::subdoc_path_invalid},
                {"subdoc_path_too_big",
                 couchbase::core::key_value_status_code::subdoc_path_too_big},
                {"subdoc_doc_too_deep",
                 couchbase::core::key_value_status_code::subdoc_doc_too_deep},
                {"subdoc_value_cannot_insert",
                 couchbase::core::key_value_status_code::
                     subdoc_value_cannot_insert},
                {"subdoc_doc_not_json",
                 couchbase::core::key_value_status_code::subdoc_doc_not_json},
                {"subdoc_num_range_error",
                 couchbase::core::key_value_status_code::
                     subdoc_num_range_error},
                {"subdoc_delta_invalid",
                 couchbase::core::key_value_status_code::subdoc_delta_invalid},
                {"subdoc_path_exists",
                 couchbase::core::key_value_status_code::subdoc_path_exists},
                {"subdoc_value_too_deep",
                 couchbase::core::key_value_status_code::subdoc_value_too_deep},
                {"subdoc_invalid_combo",
                 couchbase::core::key_value_status_code::subdoc_invalid_combo},
                {"subdoc_multi_path_failure",
                 couchbase::core::key_value_status_code::
                     subdoc_multi_path_failure},
                {"subdoc_success_deleted",
                 couchbase::core::key_value_status_code::
                     subdoc_success_deleted},
                {"subdoc_xattr_invalid_flag_combo",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_invalid_flag_combo},
                {"subdoc_xattr_invalid_key_combo",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_invalid_key_combo},
                {"subdoc_xattr_unknown_macro",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_unknown_macro},
                {"subdoc_xattr_unknown_vattr",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_unknown_vattr},
                {"subdoc_xattr_cannot_modify_vattr",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_cannot_modify_vattr},
                {"subdoc_multi_path_failure_deleted",
                 couchbase::core::key_value_status_code::
                     subdoc_multi_path_failure_deleted},
                {"subdoc_invalid_xattr_order",
                 couchbase::core::key_value_status_code::
                     subdoc_invalid_xattr_order},
                {"subdoc_xattr_unknown_vattr_macro",
                 couchbase::core::key_value_status_code::
                     subdoc_xattr_unknown_vattr_macro},
                {"subdoc_can_only_revive_deleted_documents",
                 couchbase::core::key_value_status_code::
                     subdoc_can_only_revive_deleted_documents},
                {"subdoc_deleted_document_cannot_have_value",
                 couchbase::core::key_value_status_code::
                     subdoc_deleted_document_cannot_have_value},
                {"range_scan_cancelled",
                 couchbase::core::key_value_status_code::range_scan_cancelled},
                {"range_scan_more",
                 couchbase::core::key_value_status_code::range_scan_more},
                {"range_scan_complete",
                 couchbase::core::key_value_status_code::range_scan_complete},
                {"range_scan_vb_uuid_not_equal",
                 couchbase::core::key_value_status_code::
                     range_scan_vb_uuid_not_equal},
                {"unknown", couchbase::core::key_value_status_code::unknown},
            }));

    exports.Set(
        "impl_subdoc_opcode",
        cbppEnumToJs<couchbase::core::impl::subdoc::opcode>(
            env,
            {
                {"get_doc", couchbase::core::impl::subdoc::opcode::get_doc},
                {"set_doc", couchbase::core::impl::subdoc::opcode::set_doc},
                {"remove_doc",
                 couchbase::core::impl::subdoc::opcode::remove_doc},
                {"get", couchbase::core::impl::subdoc::opcode::get},
                {"exists", couchbase::core::impl::subdoc::opcode::exists},
                {"dict_add", couchbase::core::impl::subdoc::opcode::dict_add},
                {"dict_upsert",
                 couchbase::core::impl::subdoc::opcode::dict_upsert},
                {"remove", couchbase::core::impl::subdoc::opcode::remove},
                {"replace", couchbase::core::impl::subdoc::opcode::replace},
                {"array_push_last",
                 couchbase::core::impl::subdoc::opcode::array_push_last},
                {"array_push_first",
                 couchbase::core::impl::subdoc::opcode::array_push_first},
                {"array_insert",
                 couchbase::core::impl::subdoc::opcode::array_insert},
                {"array_add_unique",
                 couchbase::core::impl::subdoc::opcode::array_add_unique},
                {"counter", couchbase::core::impl::subdoc::opcode::counter},
                {"get_count", couchbase::core::impl::subdoc::opcode::get_count},
                {"replace_body_with_xattr",
                 couchbase::core::impl::subdoc::opcode::
                     replace_body_with_xattr},
            }));

    exports.Set("store_semantics",
                cbppEnumToJs<couchbase::store_semantics>(
                    env, {
                             {"replace", couchbase::store_semantics::replace},
                             {"upsert", couchbase::store_semantics::upsert},
                             {"insert", couchbase::store_semantics::insert},
                             {"revive", couchbase::store_semantics::revive},
                         }));

    exports.Set("persist_to",
                cbppEnumToJs<couchbase::persist_to>(
                    env, {
                             {"none", couchbase::persist_to::none},
                             {"active", couchbase::persist_to::active},
                             {"one", couchbase::persist_to::one},
                             {"two", couchbase::persist_to::two},
                             {"three", couchbase::persist_to::three},
                             {"four", couchbase::persist_to::four},
                         }));

    exports.Set("replicate_to",
                cbppEnumToJs<couchbase::replicate_to>(
                    env, {
                             {"none", couchbase::replicate_to::none},
                             {"one", couchbase::replicate_to::one},
                             {"two", couchbase::replicate_to::two},
                             {"three", couchbase::replicate_to::three},
                         }));

    exports.Set(
        "read_preference",
        cbppEnumToJs<couchbase::read_preference>(
            env,
            {
                {"no_preference", couchbase::read_preference::no_preference},
                {"selected_server_group",
                 couchbase::read_preference::selected_server_group},
                {"selected_server_group_or_all_available",
                 couchbase::read_preference::
                     selected_server_group_or_all_available},
            }));

    exports.Set(
        "vector_query_combination",
        cbppEnumToJs<couchbase::core::vector_query_combination>(
            env,
            {
                {"combination_and",
                 couchbase::core::vector_query_combination::combination_and},
                {"combination_or",
                 couchbase::core::vector_query_combination::combination_or},
            }));

    exports.Set(
        "transactions_failure_type",
        cbppEnumToJs<couchbase::core::transactions::failure_type>(
            env,
            {
                {"FAIL", couchbase::core::transactions::failure_type::FAIL},
                {"EXPIRY", couchbase::core::transactions::failure_type::EXPIRY},
                {"COMMIT_AMBIGUOUS",
                 couchbase::core::transactions::failure_type::COMMIT_AMBIGUOUS},
            }));

    exports.Set(
        "transactions_external_exception",
        cbppEnumToJs<couchbase::core::transactions::external_exception>(
            env,
            {
                {"UNKNOWN",
                 couchbase::core::transactions::external_exception::UNKNOWN},
                {"ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND},
                {"ACTIVE_TRANSACTION_RECORD_FULL",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_FULL},
                {"ACTIVE_TRANSACTION_RECORD_NOT_FOUND",
                 couchbase::core::transactions::external_exception::
                     ACTIVE_TRANSACTION_RECORD_NOT_FOUND},
                {"DOCUMENT_ALREADY_IN_TRANSACTION",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_ALREADY_IN_TRANSACTION},
                {"DOCUMENT_EXISTS_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_EXISTS_EXCEPTION},
                {"DOCUMENT_NOT_FOUND_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_NOT_FOUND_EXCEPTION},
                {"NOT_SET",
                 couchbase::core::transactions::external_exception::NOT_SET},
                {"FEATURE_NOT_AVAILABLE_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     FEATURE_NOT_AVAILABLE_EXCEPTION},
                {"TRANSACTION_ABORTED_EXTERNALLY",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ABORTED_EXTERNALLY},
                {"PREVIOUS_OPERATION_FAILED",
                 couchbase::core::transactions::external_exception::
                     PREVIOUS_OPERATION_FAILED},
                {"FORWARD_COMPATIBILITY_FAILURE",
                 couchbase::core::transactions::external_exception::
                     FORWARD_COMPATIBILITY_FAILURE},
                {"PARSING_FAILURE", couchbase::core::transactions::
                                        external_exception::PARSING_FAILURE},
                {"ILLEGAL_STATE_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     ILLEGAL_STATE_EXCEPTION},
                {"COUCHBASE_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     COUCHBASE_EXCEPTION},
                {"SERVICE_NOT_AVAILABLE_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     SERVICE_NOT_AVAILABLE_EXCEPTION},
                {"REQUEST_CANCELED_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     REQUEST_CANCELED_EXCEPTION},
                {"CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT",
                 couchbase::core::transactions::external_exception::
                     CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT},
                {"COMMIT_NOT_PERMITTED",
                 couchbase::core::transactions::external_exception::
                     COMMIT_NOT_PERMITTED},
                {"ROLLBACK_NOT_PERMITTED",
                 couchbase::core::transactions::external_exception::
                     ROLLBACK_NOT_PERMITTED},
                {"TRANSACTION_ALREADY_ABORTED",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ALREADY_ABORTED},
                {"TRANSACTION_ALREADY_COMMITTED",
                 couchbase::core::transactions::external_exception::
                     TRANSACTION_ALREADY_COMMITTED},
                {"DOCUMENT_UNRETRIEVABLE_EXCEPTION",
                 couchbase::core::transactions::external_exception::
                     DOCUMENT_UNRETRIEVABLE_EXCEPTION},
            }));

    exports.Set(
        "transactions_transaction_get_multi_mode",
        cbppEnumToJs<couchbase::core::transactions::transaction_get_multi_mode>(
            env,
            {
                {"prioritise_latency",
                 couchbase::core::transactions::transaction_get_multi_mode::
                     prioritise_latency},
                {"disable_read_skew_detection",
                 couchbase::core::transactions::transaction_get_multi_mode::
                     disable_read_skew_detection},
                {"prioritise_read_skew_detection",
                 couchbase::core::transactions::transaction_get_multi_mode::
                     prioritise_read_skew_detection},
            }));

    exports.Set(
        "transactions_transaction_get_multi_replicas_from_preferred_server_"
        "group_mode",
        cbppEnumToJs<
            couchbase::core::transactions::
                transaction_get_multi_replicas_from_preferred_server_group_mode>(
            env,
            {
                {"prioritise_latency",
                 couchbase::core::transactions::
                     transaction_get_multi_replicas_from_preferred_server_group_mode::
                         prioritise_latency},
                {"disable_read_skew_detection",
                 couchbase::core::transactions::
                     transaction_get_multi_replicas_from_preferred_server_group_mode::
                         disable_read_skew_detection},
                {"prioritise_read_skew_detection",
                 couchbase::core::transactions::
                     transaction_get_multi_replicas_from_preferred_server_group_mode::
                         prioritise_read_skew_detection},
            }));

    //#endregion Autogenerated Constants
}

} // namespace couchnode
