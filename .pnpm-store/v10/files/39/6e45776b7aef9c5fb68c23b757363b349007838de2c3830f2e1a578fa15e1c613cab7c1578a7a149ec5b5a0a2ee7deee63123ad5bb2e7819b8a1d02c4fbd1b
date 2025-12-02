/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#pragma once

#include "diagnostics.hxx"
#include "operations_fwd.hxx"
#include "origin.hxx"
#include "topology/configuration.hxx"
#include "utils/movable_function.hxx"

#include <asio/io_context.hpp>
#include <chrono>
#include <optional>
#include <utility>

namespace couchbase
{
class cluster;
} // namespace couchbase

namespace couchbase::core
{
class crud_component;
class cluster_impl;

namespace mcbp
{
class queue_request;
} // namespace mcbp

namespace io
{
class http_session_manager;
} // namespace io

namespace o = operations;
namespace om = operations::management;
template<typename T>
using mf = utils::movable_function<T>;

class cluster
{
public:
  explicit cluster(asio::io_context& ctx);

  [[nodiscard]] auto io_context() const -> asio::io_context&;

  [[nodiscard]] auto origin() const -> std::pair<std::error_code, core::origin>;

  void open(core::origin origin, utils::movable_function<void(std::error_code)>&& handler) const;

  void open_in_background(const couchbase::core::origin& origin,
                          utils::movable_function<void(std::error_code)>&& handler) const;

  void close(utils::movable_function<void()>&& handler) const;

  void open_bucket(const std::string& bucket_name,
                   utils::movable_function<void(std::error_code)>&& handler) const;

  void close_bucket(const std::string& bucket_name,
                    utils::movable_function<void(std::error_code)>&& handler) const;

  void with_bucket_configuration(
    const std::string& bucket_name,
    utils::movable_function<void(std::error_code, std::shared_ptr<topology::configuration>)>&&
      handler) const;

  void execute(o::analytics_request request, mf<void(o::analytics_response)>&& handler) const;
  void execute(o::append_request request, mf<void(o::append_response)>&& handler) const;
  void execute(o::decrement_request request, mf<void(o::decrement_response)>&& handler) const;
  void execute(o::exists_request request, mf<void(o::exists_response)>&& handler) const;
  void execute(o::get_request request, mf<void(o::get_response)>&& handler) const;
  void execute(o::get_all_replicas_request request,
               mf<void(o::get_all_replicas_response)>&& handler) const;
  void execute(o::get_and_lock_request request, mf<void(o::get_and_lock_response)>&& handler) const;
  void execute(o::get_and_touch_request request,
               mf<void(o::get_and_touch_response)>&& handler) const;
  void execute(o::get_any_replica_request request,
               mf<void(o::get_any_replica_response)>&& handler) const;
  void execute(o::get_projected_request request,
               mf<void(o::get_projected_response)>&& handler) const;
  void execute(o::increment_request request, mf<void(o::increment_response)>&& handler) const;
  void execute(o::insert_request request, mf<void(o::insert_response)>&& handler) const;
  void execute(o::lookup_in_request request, mf<void(o::lookup_in_response)>&& handler) const;
  void execute(o::lookup_in_any_replica_request request,
               mf<void(o::lookup_in_any_replica_response)>&& handler) const;
  void execute(o::lookup_in_all_replicas_request request,
               mf<void(o::lookup_in_all_replicas_response)>&& handler) const;
  void execute(o::mutate_in_request request, mf<void(o::mutate_in_response)>&& handler) const;
  void execute(o::prepend_request request, mf<void(o::prepend_response)>&& handler) const;
  void execute(o::query_request request, mf<void(o::query_response)>&& handler) const;
  void execute(o::remove_request request, mf<void(o::remove_response)>&& handler) const;
  void execute(o::replace_request request, mf<void(o::replace_response)>&& handler) const;
  void execute(o::search_request request, mf<void(o::search_response)>&& handler) const;
  void execute(o::touch_request request, mf<void(o::touch_response)>&& handler) const;
  void execute(o::unlock_request request, mf<void(o::unlock_response)>&& handler) const;
  void execute(o::upsert_request request, mf<void(o::upsert_response)>&& handler) const;
  void execute(o::upsert_request_with_legacy_durability request,
               mf<void(o::upsert_response)>&& handler) const;
  void execute(o::append_request_with_legacy_durability request,
               mf<void(o::append_response)>&& handler) const;
  void execute(o::decrement_request_with_legacy_durability request,
               mf<void(o::decrement_response)>&& handler) const;
  void execute(o::increment_request_with_legacy_durability request,
               mf<void(o::increment_response)>&& handler) const;
  void execute(o::insert_request_with_legacy_durability request,
               mf<void(o::insert_response)>&& handler) const;
  void execute(o::mutate_in_request_with_legacy_durability request,
               mf<void(o::mutate_in_response)>&& handler) const;
  void execute(o::prepend_request_with_legacy_durability request,
               mf<void(o::prepend_response)>&& handler) const;
  void execute(o::remove_request_with_legacy_durability request,
               mf<void(o::remove_response)>&& handler) const;
  void execute(o::replace_request_with_legacy_durability request,
               mf<void(o::replace_response)>&& handler) const;

  void execute(o::document_view_request request,
               mf<void(o::document_view_response)>&& handler) const;
  void execute(o::http_noop_request request, mf<void(o::http_noop_response)>&& handler) const;

  void execute(om::analytics_dataset_create_request request,
               mf<void(om::analytics_dataset_create_response)>&& handler) const;
  void execute(om::analytics_dataset_drop_request request,
               mf<void(om::analytics_dataset_drop_response)>&& handler) const;
  void execute(om::analytics_dataset_get_all_request request,
               mf<void(om::analytics_dataset_get_all_response)>&& handler) const;
  void execute(om::analytics_dataverse_create_request request,
               mf<void(om::analytics_dataverse_create_response)>&& handler) const;
  void execute(om::analytics_dataverse_drop_request request,
               mf<void(om::analytics_dataverse_drop_response)>&& handler) const;
  void execute(om::analytics_get_pending_mutations_request request,
               mf<void(om::analytics_get_pending_mutations_response)>&& handler) const;
  void execute(om::analytics_index_create_request request,
               mf<void(om::analytics_index_create_response)>&& handler) const;
  void execute(om::analytics_index_drop_request request,
               mf<void(om::analytics_index_drop_response)>&& handler) const;
  void execute(om::analytics_index_get_all_request request,
               mf<void(om::analytics_index_get_all_response)>&& handler) const;
  void execute(om::analytics_link_connect_request request,
               mf<void(om::analytics_link_connect_response)>&& handler) const;
  void execute(om::analytics_link_disconnect_request request,
               mf<void(om::analytics_link_disconnect_response)>&& handler) const;
  void execute(om::analytics_link_drop_request request,
               mf<void(om::analytics_link_drop_response)>&& handler) const;
  void execute(om::analytics_link_get_all_request request,
               mf<void(om::analytics_link_get_all_response)>&& handler) const;
  void execute(om::bucket_create_request request,
               mf<void(om::bucket_create_response)>&& handler) const;
  void execute(om::bucket_drop_request request, mf<void(om::bucket_drop_response)>&& handler) const;
  void execute(om::bucket_flush_request request,
               mf<void(om::bucket_flush_response)>&& handler) const;
  void execute(om::bucket_get_request request, mf<void(om::bucket_get_response)>&& handler) const;
  void execute(om::bucket_get_all_request request,
               mf<void(om::bucket_get_all_response)>&& handler) const;
  void execute(om::bucket_update_request request,
               mf<void(om::bucket_update_response)>&& handler) const;
  void execute(om::cluster_developer_preview_enable_request request,
               mf<void(om::cluster_developer_preview_enable_response)>&& handler) const;
  void execute(om::collection_create_request request,
               mf<void(om::collection_create_response)>&& handler) const;
  void execute(om::collection_update_request request,
               mf<void(om::collection_update_response)>&& handler) const;
  void execute(om::collection_drop_request request,
               mf<void(om::collection_drop_response)>&& handler) const;
  void execute(om::collections_manifest_get_request request,
               mf<void(om::collections_manifest_get_response)>&& handler) const;
  void execute(om::scope_create_request request,
               mf<void(om::scope_create_response)>&& handler) const;
  void execute(om::scope_drop_request request, mf<void(om::scope_drop_response)>&& handler) const;
  void execute(om::scope_get_all_request request,
               mf<void(om::scope_get_all_response)>&& handler) const;
  void execute(om::eventing_deploy_function_request request,
               mf<void(om::eventing_deploy_function_response)>&& handler) const;
  void execute(om::eventing_drop_function_request request,
               mf<void(om::eventing_drop_function_response)>&& handler) const;
  void execute(om::eventing_get_all_functions_request request,
               mf<void(om::eventing_get_all_functions_response)>&& handler) const;
  void execute(om::eventing_get_function_request request,
               mf<void(om::eventing_get_function_response)>&& handler) const;
  void execute(om::eventing_get_status_request request,
               mf<void(om::eventing_get_status_response)>&& handler) const;
  void execute(om::eventing_pause_function_request request,
               mf<void(om::eventing_pause_function_response)>&& handler) const;
  void execute(om::eventing_resume_function_request request,
               mf<void(om::eventing_resume_function_response)>&& handler) const;
  void execute(om::eventing_undeploy_function_request request,
               mf<void(om::eventing_undeploy_function_response)>&& handler) const;
  void execute(om::eventing_upsert_function_request request,
               mf<void(om::eventing_upsert_function_response)>&& handler) const;
  void execute(om::view_index_drop_request request,
               mf<void(om::view_index_drop_response)>&& handler) const;
  void execute(om::view_index_get_request request,
               mf<void(om::view_index_get_response)>&& handler) const;
  void execute(om::view_index_get_all_request request,
               mf<void(om::view_index_get_all_response)>&& handler) const;
  void execute(om::view_index_upsert_request request,
               mf<void(om::view_index_upsert_response)>&& handler) const;
  void execute(om::change_password_request request,
               mf<void(om::change_password_response)>&& handler) const;
  void execute(om::group_drop_request request, mf<void(om::group_drop_response)>&& handler) const;
  void execute(om::group_get_request request, mf<void(om::group_get_response)>&& handler) const;
  void execute(om::group_get_all_request request,
               mf<void(om::group_get_all_response)>&& handler) const;
  void execute(om::group_upsert_request request,
               mf<void(om::group_upsert_response)>&& handler) const;
  void execute(om::role_get_all_request request,
               mf<void(om::role_get_all_response)>&& handler) const;
  void execute(om::user_drop_request request, mf<void(om::user_drop_response)>&& handler) const;
  void execute(om::user_get_request request, mf<void(om::user_get_response)>&& handler) const;
  void execute(om::user_get_all_request request,
               mf<void(om::user_get_all_response)>&& handler) const;
  void execute(om::user_upsert_request request, mf<void(om::user_upsert_response)>&& handler) const;
  void execute(om::search_get_stats_request request,
               mf<void(om::search_get_stats_response)>&& handler) const;
  void execute(om::search_index_analyze_document_request request,
               mf<void(om::search_index_analyze_document_response)>&& handler) const;
  void execute(om::search_index_control_ingest_request request,
               mf<void(om::search_index_control_ingest_response)>&& handler) const;
  void execute(om::search_index_control_plan_freeze_request request,
               mf<void(om::search_index_control_plan_freeze_response)>&& handler) const;
  void execute(om::search_index_control_query_request request,
               mf<void(om::search_index_control_query_response)>&& handler) const;
  void execute(om::search_index_drop_request request,
               mf<void(om::search_index_drop_response)>&& handler) const;
  void execute(om::search_index_get_request request,
               mf<void(om::search_index_get_response)>&& handler) const;
  void execute(om::search_index_get_all_request request,
               mf<void(om::search_index_get_all_response)>&& handler) const;
  void execute(om::search_index_get_documents_count_request request,
               mf<void(om::search_index_get_documents_count_response)>&& handler) const;
  void execute(om::search_index_get_stats_request request,
               mf<void(om::search_index_get_stats_response)>&& handler) const;
  void execute(om::search_index_upsert_request request,
               mf<void(om::search_index_upsert_response)>&& handler) const;
  void execute(om::query_index_build_request request,
               mf<void(om::query_index_build_response)>&& handler) const;
  void execute(om::query_index_build_deferred_request request,
               mf<void(om::query_index_build_deferred_response)>&& handler) const;
  void execute(om::query_index_create_request request,
               mf<void(om::query_index_create_response)>&& handler) const;
  void execute(om::query_index_drop_request request,
               mf<void(om::query_index_drop_response)>&& handler) const;
  void execute(om::query_index_get_all_request request,
               mf<void(om::query_index_get_all_response)>&& handler) const;
  void execute(om::query_index_get_all_deferred_request request,
               mf<void(om::query_index_get_all_deferred_response)>&& handler) const;

  void execute(om::freeform_request request, mf<void(om::freeform_response)>&& handler) const;
  void execute(om::bucket_describe_request request,
               mf<void(om::bucket_describe_response)>&& handler) const;
  void execute(om::cluster_describe_request request,
               mf<void(om::cluster_describe_response)>&& handler) const;

  void execute(impl::get_replica_request request,
               mf<void(impl::get_replica_response)>&& handler) const;
  void execute(impl::lookup_in_replica_request request,
               mf<void(impl::lookup_in_replica_response)>&& handler) const;
  void execute(impl::observe_seqno_request request,
               mf<void(impl::observe_seqno_response)>&& handler) const;

  void execute(
    om::analytics_link_replace_request<management::analytics::azure_blob_external_link> request,
    mf<void(om::analytics_link_replace_response)>&& handler) const;
  void execute(
    om::analytics_link_replace_request<management::analytics::couchbase_remote_link> request,
    mf<void(om::analytics_link_replace_response)>&& handler) const;
  void execute(om::analytics_link_replace_request<management::analytics::s3_external_link> request,
               mf<void(om::analytics_link_replace_response)>&& handler) const;
  void execute(
    om::analytics_link_create_request<management::analytics::azure_blob_external_link> request,
    mf<void(om::analytics_link_create_response)>&& handler) const;
  void execute(
    om::analytics_link_create_request<management::analytics::couchbase_remote_link> request,
    mf<void(om::analytics_link_create_response)>&& handler) const;
  void execute(om::analytics_link_create_request<management::analytics::s3_external_link> request,
               mf<void(om::analytics_link_create_response)>&& handler) const;

  void diagnostics(std::optional<std::string> report_id,
                   mf<void(diag::diagnostics_result)>&& handler) const;

  void ping(std::optional<std::string> report_id,
            std::optional<std::string> bucket_name,
            std::set<service_type> services,
            std::optional<std::chrono::milliseconds> timeout,
            utils::movable_function<void(diag::ping_result)>&& handler) const;

  [[nodiscard]] auto direct_dispatch(
    const std::string& bucket_name,
    std::shared_ptr<couchbase::core::mcbp::queue_request> req) const -> std::error_code;

  [[nodiscard]] auto direct_re_queue(const std::string& bucket_name,
                                     std::shared_ptr<mcbp::queue_request> req,
                                     bool is_retry) const -> std::error_code;

  [[nodiscard]] auto http_session_manager() const
    -> std::pair<std::error_code, std::shared_ptr<io::http_session_manager>>;

  [[nodiscard]] auto to_string() const -> std::string;

private:
  std::shared_ptr<cluster_impl> impl_;
};

// FIXME: temporary solution for the core API migration. FIT performer needs to access core for KV
// range APIs
auto
get_core_cluster(couchbase::cluster public_api_cluster) -> core::cluster;
} // namespace couchbase::core
