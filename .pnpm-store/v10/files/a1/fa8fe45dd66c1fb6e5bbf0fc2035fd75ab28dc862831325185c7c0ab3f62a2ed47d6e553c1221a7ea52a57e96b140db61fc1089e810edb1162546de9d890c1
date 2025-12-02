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

namespace couchbase::core
{
namespace management::analytics
{
struct azure_blob_external_link;
struct couchbase_remote_link;
struct s3_external_link;
} // namespace management::analytics

namespace impl
{
struct get_replica_request;
struct get_replica_response;
struct lookup_in_replica_request;
struct lookup_in_replica_response;
struct observe_seqno_request;
struct observe_seqno_response;
template<typename mutation_request>
struct with_legacy_durability;
} // namespace impl

namespace operations
{
struct analytics_request;
struct analytics_response;
struct append_request;
struct append_response;
struct decrement_request;
struct decrement_response;
struct exists_request;
struct exists_response;
struct get_request;
struct get_response;
struct get_all_replicas_request;
struct get_all_replicas_response;
struct get_and_lock_request;
struct get_and_lock_response;
struct get_and_touch_request;
struct get_and_touch_response;
struct get_any_replica_request;
struct get_any_replica_response;
struct get_projected_request;
struct get_projected_response;
struct increment_request;
struct increment_response;
struct insert_request;
struct insert_response;
struct lookup_in_request;
struct lookup_in_response;
struct lookup_in_any_replica_request;
struct lookup_in_any_replica_response;
struct lookup_in_all_replicas_request;
struct lookup_in_all_replicas_response;
struct mutate_in_request;
struct mutate_in_response;
struct prepend_request;
struct prepend_response;
struct query_request;
struct query_response;
struct remove_request;
struct remove_response;
struct replace_request;
struct replace_response;
struct search_request;
struct search_response;
struct touch_request;
struct touch_response;
struct unlock_request;
struct unlock_response;
struct upsert_request;
struct upsert_response;
struct document_view_request;
struct document_view_response;
struct http_noop_request;
struct http_noop_response;

using append_request_with_legacy_durability = impl::with_legacy_durability<append_request>;
using decrement_request_with_legacy_durability = impl::with_legacy_durability<decrement_request>;
using increment_request_with_legacy_durability = impl::with_legacy_durability<increment_request>;
using insert_request_with_legacy_durability = impl::with_legacy_durability<insert_request>;
using mutate_in_request_with_legacy_durability = impl::with_legacy_durability<mutate_in_request>;
using prepend_request_with_legacy_durability = impl::with_legacy_durability<prepend_request>;
using remove_request_with_legacy_durability = impl::with_legacy_durability<remove_request>;
using replace_request_with_legacy_durability = impl::with_legacy_durability<replace_request>;
using upsert_request_with_legacy_durability = impl::with_legacy_durability<upsert_request>;

namespace management
{
struct analytics_dataset_create_request;
struct analytics_dataset_create_response;
struct analytics_dataset_drop_request;
struct analytics_dataset_drop_response;
struct analytics_dataset_get_all_request;
struct analytics_dataset_get_all_response;
struct analytics_dataverse_create_request;
struct analytics_dataverse_create_response;
struct analytics_dataverse_drop_request;
struct analytics_dataverse_drop_response;
struct analytics_get_pending_mutations_request;
struct analytics_get_pending_mutations_response;
struct analytics_index_create_request;
struct analytics_index_create_response;
struct analytics_index_drop_request;
struct analytics_index_drop_response;
struct analytics_index_get_all_request;
struct analytics_index_get_all_response;
struct analytics_link_connect_request;
struct analytics_link_connect_response;
template<typename analytics_link_type>
struct analytics_link_create_request;
struct analytics_link_create_response;
struct analytics_link_disconnect_request;
struct analytics_link_disconnect_response;
struct analytics_link_drop_request;
struct analytics_link_drop_response;
struct analytics_link_get_all_request;
struct analytics_link_get_all_response;
template<typename analytics_link_type>
struct analytics_link_replace_request;
struct analytics_link_replace_response;
struct bucket_create_request;
struct bucket_create_response;
struct bucket_drop_request;
struct bucket_drop_response;
struct bucket_flush_request;
struct bucket_flush_response;
struct bucket_get_request;
struct bucket_get_response;
struct bucket_get_all_request;
struct bucket_get_all_response;
struct bucket_update_request;
struct bucket_update_response;
struct cluster_developer_preview_enable_request;
struct cluster_developer_preview_enable_response;
struct collection_create_request;
struct collection_create_response;
struct collection_drop_request;
struct collection_drop_response;
struct collection_update_request;
struct collection_update_response;
struct collections_manifest_get_request;
struct collections_manifest_get_response;
struct scope_create_request;
struct scope_create_response;
struct scope_drop_request;
struct scope_drop_response;
struct scope_get_all_request;
struct scope_get_all_response;
struct eventing_deploy_function_request;
struct eventing_deploy_function_response;
struct eventing_drop_function_request;
struct eventing_drop_function_response;
struct eventing_get_all_functions_request;
struct eventing_get_all_functions_response;
struct eventing_get_function_request;
struct eventing_get_function_response;
struct eventing_get_status_request;
struct eventing_get_status_response;
struct eventing_pause_function_request;
struct eventing_pause_function_response;
struct eventing_resume_function_request;
struct eventing_resume_function_response;
struct eventing_undeploy_function_request;
struct eventing_undeploy_function_response;
struct eventing_upsert_function_request;
struct eventing_upsert_function_response;
struct view_index_drop_request;
struct view_index_drop_response;
struct view_index_get_request;
struct view_index_get_response;
struct view_index_get_all_request;
struct view_index_get_all_response;
struct view_index_upsert_request;
struct view_index_upsert_response;
struct change_password_request;
struct change_password_response;
struct group_drop_request;
struct group_drop_response;
struct group_get_request;
struct group_get_response;
struct group_get_all_request;
struct group_get_all_response;
struct group_upsert_request;
struct group_upsert_response;
struct role_get_all_request;
struct role_get_all_response;
struct user_drop_request;
struct user_drop_response;
struct user_get_request;
struct user_get_response;
struct user_get_all_request;
struct user_get_all_response;
struct user_upsert_request;
struct user_upsert_response;
struct search_get_stats_request;
struct search_get_stats_response;
struct search_index_analyze_document_request;
struct search_index_analyze_document_response;
struct search_index_control_ingest_request;
struct search_index_control_ingest_response;
struct search_index_control_plan_freeze_request;
struct search_index_control_plan_freeze_response;
struct search_index_control_query_request;
struct search_index_control_query_response;
struct search_index_drop_request;
struct search_index_drop_response;
struct search_index_get_request;
struct search_index_get_response;
struct search_index_get_all_request;
struct search_index_get_all_response;
struct search_index_get_documents_count_request;
struct search_index_get_documents_count_response;
struct search_index_get_stats_request;
struct search_index_get_stats_response;
struct search_index_upsert_request;
struct search_index_upsert_response;
struct query_index_build_request;
struct query_index_build_response;
struct query_index_build_deferred_request;
struct query_index_build_deferred_response;
struct query_index_create_request;
struct query_index_create_response;
struct query_index_drop_request;
struct query_index_drop_response;
struct query_index_get_all_request;
struct query_index_get_all_response;
struct query_index_get_all_deferred_request;
struct query_index_get_all_deferred_response;

struct bucket_describe_request;
struct bucket_describe_response;
struct cluster_describe_request;
struct cluster_describe_response;
struct freeform_request;
struct freeform_response;
struct search_index_stats_request;
struct search_index_stats_response;
} // namespace management
} // namespace operations

} // namespace couchbase::core
