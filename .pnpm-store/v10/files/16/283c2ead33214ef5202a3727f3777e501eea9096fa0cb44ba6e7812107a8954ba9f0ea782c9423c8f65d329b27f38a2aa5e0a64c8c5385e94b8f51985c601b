/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2020-Present Couchbase, Inc.
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

#include "core/protocol/client_opcode.hxx"
#include "core/service_type.hxx"

#include <gsl/assert>
#include <string_view>

namespace couchbase::core::tracing
{
namespace operation
{
constexpr auto step_dispatch = "cb.dispatch_to_server";
constexpr auto step_request_encoding = "cb.request_encoding";
constexpr auto http_query = "cb.query";
constexpr auto http_analytics = "cb.analytics";
constexpr auto http_search = "cb.search";
constexpr auto http_views = "cb.views";
constexpr auto http_manager = "cb.manager";
constexpr auto http_eventing = "cb.eventing";
constexpr auto http_manager_analytics = "cb.manager_analytics";
constexpr auto http_manager_query = "cb.manager_query";
constexpr auto http_manager_buckets = "cb.manager_buckets";
constexpr auto http_manager_collections = "cb.manager_collections";
constexpr auto http_manager_search = "cb.manager_search";
constexpr auto http_manager_users = "cb.manager_users";
constexpr auto http_manager_views = "cb.manager_views";
constexpr auto mcbp_get = "cb.get";
constexpr auto mcbp_get_replica = "cb.get_replica";
constexpr auto mcbp_upsert = "cb.upsert";
constexpr auto mcbp_replace = "cb.replace";
constexpr auto mcbp_insert = "cb.insert";
constexpr auto mcbp_remove = "cb.remove";
constexpr auto mcbp_get_and_lock = "cb.get_and_lock";
constexpr auto mcbp_get_and_touch = "cb.get_and_touch";
constexpr auto mcbp_exists = "cb.exists";
constexpr auto mcbp_touch = "cb.touch";
constexpr auto mcbp_unlock = "cb.unlock";
constexpr auto mcbp_lookup_in = "cb.lookup_in";
constexpr auto mcbp_mutate_in = "cb.mutate_in";
constexpr auto mcbp_append = "cb.append";
constexpr auto mcbp_prepend = "cb.prepend";
constexpr auto mcbp_increment = "cb.increment";
constexpr auto mcbp_decrement = "cb.decrement";
constexpr auto mcbp_observe = "cb.observe";
constexpr auto mcbp_range_scan_create = "cb.range_scan_create";
constexpr auto mcbp_range_scan_continue = "cb.range_scan_continue";
constexpr auto mcbp_range_scan_cancel = "cb.range_scan_cancel";
/* multi-command operations */
constexpr auto mcbp_get_all_replicas = "cb.get_all_replicas";
constexpr auto mcbp_get_any_replica = "cb.get_any_replica";
constexpr auto mcbp_list = "cb.list";
constexpr auto mcbp_set = "cb.set";
constexpr auto mcbp_map = "cb.map";
constexpr auto mcbp_queue = "cb.queue";
constexpr auto mcbp_ping = "cb.ping";

constexpr auto mcbp_internal = "cb.internal";
} // namespace operation

namespace attributes
{
constexpr auto system = "db.system";
constexpr auto cluster_name = "db.couchbase.cluster_name";
constexpr auto cluster_uuid = "db.couchbase.cluster_uuid";

constexpr auto span_kind = "span.kind";
constexpr auto component = "db.couchbase.component";
constexpr auto instance = "db.instance";

constexpr auto orphan = "cb.orphan";
constexpr auto service = "cb.service";
constexpr auto operation_id = "cb.operation_id";

constexpr auto server_duration = "cb.server_duration";
constexpr auto local_id = "cb.local_id";
constexpr auto local_socket = "cb.local_socket";
constexpr auto remote_socket = "cb.remote_socket";
} // namespace attributes

namespace service
{
constexpr auto key_value = "kv";
constexpr auto query = "query";
constexpr auto search = "search";
constexpr auto view = "views";
constexpr auto analytics = "analytics";
constexpr auto management = "management";
constexpr auto eventing = "eventing";
} // namespace service

constexpr auto
span_name_for_http_service(service_type type)
{
  switch (type) {
    case service_type::query:
      return operation::http_query;

    case service_type::analytics:
      return operation::http_analytics;

    case service_type::search:
      return operation::http_search;

    case service_type::view:
      return operation::http_views;

    case service_type::management:
      return operation::http_manager;

    case service_type::eventing:
      return operation::http_eventing;

    case service_type::key_value:
      return "unexpected_http_service";
  }
  return "unknown_http_service";
}

constexpr auto
service_name_for_http_service(service_type type)
{
  switch (type) {
    case service_type::query:
      return service::query;

    case service_type::analytics:
      return service::analytics;

    case service_type::search:
      return service::search;

    case service_type::view:
      return service::view;

    case service_type::management:
      return service::management;

    case service_type::eventing:
      return service::eventing;

    case service_type::key_value:
      return "unexpected_http_service";
  }
  return "unknown_http_service";
}

constexpr auto
span_name_for_mcbp_command(protocol::client_opcode opcode)
{
  switch (opcode) {
    case protocol::client_opcode::get:
      return operation::mcbp_get;

    case protocol::client_opcode::upsert:
      return operation::mcbp_upsert;

    case protocol::client_opcode::insert:
      return operation::mcbp_insert;

    case protocol::client_opcode::replace:
      return operation::mcbp_replace;

    case protocol::client_opcode::remove:
      return operation::mcbp_remove;

    case protocol::client_opcode::increment:
      return operation::mcbp_increment;

    case protocol::client_opcode::decrement:
      return operation::mcbp_decrement;

    case protocol::client_opcode::append:
      return operation::mcbp_append;

    case protocol::client_opcode::prepend:
      return operation::mcbp_prepend;

    case protocol::client_opcode::touch:
      return operation::mcbp_touch;

    case protocol::client_opcode::get_and_touch:
      return operation::mcbp_get_and_touch;

    case protocol::client_opcode::get_replica:
      return operation::mcbp_get_replica;

    case protocol::client_opcode::get_and_lock:
      return operation::mcbp_get_and_lock;

    case protocol::client_opcode::unlock:
      return operation::mcbp_unlock;

    case protocol::client_opcode::subdoc_multi_lookup:
      return operation::mcbp_lookup_in;

    case protocol::client_opcode::subdoc_multi_mutation:
      return operation::mcbp_mutate_in;

    case protocol::client_opcode::observe:
      return operation::mcbp_exists;

    case protocol::client_opcode::range_scan_create:
      return operation::mcbp_range_scan_create;

    case protocol::client_opcode::range_scan_continue:
      return operation::mcbp_range_scan_continue;

    case protocol::client_opcode::range_scan_cancel:
      return operation::mcbp_range_scan_cancel;

    case protocol::client_opcode::noop:
    case protocol::client_opcode::version:
    case protocol::client_opcode::stat:
    case protocol::client_opcode::verbosity:
    case protocol::client_opcode::hello:
    case protocol::client_opcode::sasl_list_mechs:
    case protocol::client_opcode::sasl_auth:
    case protocol::client_opcode::sasl_step:
    case protocol::client_opcode::get_all_vbucket_seqnos:
    case protocol::client_opcode::dcp_open:
    case protocol::client_opcode::dcp_add_stream:
    case protocol::client_opcode::dcp_close_stream:
    case protocol::client_opcode::dcp_stream_request:
    case protocol::client_opcode::dcp_get_failover_log:
    case protocol::client_opcode::dcp_stream_end:
    case protocol::client_opcode::dcp_snapshot_marker:
    case protocol::client_opcode::dcp_mutation:
    case protocol::client_opcode::dcp_deletion:
    case protocol::client_opcode::dcp_expiration:
    case protocol::client_opcode::dcp_set_vbucket_state:
    case protocol::client_opcode::dcp_noop:
    case protocol::client_opcode::dcp_buffer_acknowledgement:
    case protocol::client_opcode::dcp_control:
    case protocol::client_opcode::dcp_system_event:
    case protocol::client_opcode::dcp_prepare:
    case protocol::client_opcode::dcp_seqno_acknowledged:
    case protocol::client_opcode::dcp_commit:
    case protocol::client_opcode::dcp_abort:
    case protocol::client_opcode::dcp_seqno_advanced:
    case protocol::client_opcode::dcp_oso_snapshot:
    case protocol::client_opcode::list_buckets:
    case protocol::client_opcode::select_bucket:
    case protocol::client_opcode::observe_seqno:
    case protocol::client_opcode::evict_key:
    case protocol::client_opcode::get_failover_log:
    case protocol::client_opcode::last_closed_checkpoint:
    case protocol::client_opcode::get_meta:
    case protocol::client_opcode::upsert_with_meta:
    case protocol::client_opcode::insert_with_meta:
    case protocol::client_opcode::remove_with_meta:
    case protocol::client_opcode::create_checkpoint:
    case protocol::client_opcode::checkpoint_persistence:
    case protocol::client_opcode::return_meta:
    case protocol::client_opcode::get_random_key:
    case protocol::client_opcode::seqno_persistence:
    case protocol::client_opcode::get_keys:
    case protocol::client_opcode::set_collections_manifest:
    case protocol::client_opcode::get_collections_manifest:
    case protocol::client_opcode::get_collection_id:
    case protocol::client_opcode::get_scope_id:
    case protocol::client_opcode::get_cluster_config:
    case protocol::client_opcode::get_error_map:
      return operation::mcbp_internal;

    case protocol::client_opcode::invalid:
      return "invalid_command";
  }
  return "unknown_command";
}

} // namespace couchbase::core::tracing
