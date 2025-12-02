/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "client_opcode.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::protocol::client_opcode> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::client_opcode opcode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (opcode) {
      case couchbase::core::protocol::client_opcode::get:
        name = "get (0x00)";
        break;
      case couchbase::core::protocol::client_opcode::upsert:
        name = "upsert (0x01)";
        break;
      case couchbase::core::protocol::client_opcode::insert:
        name = "insert (0x02)";
        break;
      case couchbase::core::protocol::client_opcode::replace:
        name = "replace (0x03)";
        break;
      case couchbase::core::protocol::client_opcode::remove:
        name = "remove (0x04)";
        break;
      case couchbase::core::protocol::client_opcode::hello:
        name = "hello (0x1f)";
        break;
      case couchbase::core::protocol::client_opcode::sasl_list_mechs:
        name = "sasl_list_mechs (0x20)";
        break;
      case couchbase::core::protocol::client_opcode::sasl_auth:
        name = "sasl_auth (0x21)";
        break;
      case couchbase::core::protocol::client_opcode::sasl_step:
        name = "sasl_step (0x22)";
        break;
      case couchbase::core::protocol::client_opcode::select_bucket:
        name = "select_bucket (0x89)";
        break;
      case couchbase::core::protocol::client_opcode::subdoc_multi_lookup:
        name = "subdoc_multi_lookup (0xd0)";
        break;
      case couchbase::core::protocol::client_opcode::subdoc_multi_mutation:
        name = "subdoc_multi_mutation (0xd1)";
        break;
      case couchbase::core::protocol::client_opcode::get_cluster_config:
        name = "get_cluster_config (0xb5)";
        break;
      case couchbase::core::protocol::client_opcode::get_error_map:
        name = "get_error_map (0xfe)";
        break;
      case couchbase::core::protocol::client_opcode::invalid:
        name = "invalid (0xff)";
        break;
      case couchbase::core::protocol::client_opcode::get_collections_manifest:
        name = "get_collections_manifest (0xba)";
        break;
      case couchbase::core::protocol::client_opcode::touch:
        name = "touch (0x1c)";
        break;
      case couchbase::core::protocol::client_opcode::observe:
        name = "observe (0x92)";
        break;
      case couchbase::core::protocol::client_opcode::get_and_lock:
        name = "get_and_lock (0x94)";
        break;
      case couchbase::core::protocol::client_opcode::unlock:
        name = "unlock (0x95)";
        break;
      case couchbase::core::protocol::client_opcode::get_and_touch:
        name = "get_and_touch (0x1d)";
        break;
      case couchbase::core::protocol::client_opcode::increment:
        name = "increment (0x05)";
        break;
      case couchbase::core::protocol::client_opcode::decrement:
        name = "decrement (0x06)";
        break;
      case couchbase::core::protocol::client_opcode::get_collection_id:
        name = "get_collection_uid (0xbb)";
        break;
      case couchbase::core::protocol::client_opcode::noop:
        name = "noop (0x0a)";
        break;
      case couchbase::core::protocol::client_opcode::version:
        name = "version (0x0b)";
        break;
      case couchbase::core::protocol::client_opcode::append:
        name = "append (0x0e)";
        break;
      case couchbase::core::protocol::client_opcode::prepend:
        name = "prepend (0x0f)";
        break;
      case couchbase::core::protocol::client_opcode::stat:
        name = "stat (0x10)";
        break;
      case couchbase::core::protocol::client_opcode::verbosity:
        name = "verbosity (0x1b)";
        break;
      case couchbase::core::protocol::client_opcode::get_all_vbucket_seqnos:
        name = "get_all_vbucket_seqnos (0x48)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_open:
        name = "dcp_open (0x50)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_add_stream:
        name = "dcp_add_stream (0x51)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_close_stream:
        name = "dcp_add_stream (0x52)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_stream_request:
        name = "dcp_stream_request (0x53)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_get_failover_log:
        name = "dcp_get_failover_log (0x54)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_stream_end:
        name = "dcp_stream_end (0x55)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_snapshot_marker:
        name = "dcp_snapshot_marker (0x56)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_mutation:
        name = "dcp_mutation (0x57)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_deletion:
        name = "dcp_deletion (0x58)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_expiration:
        name = "dcp_expiration (0x59)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_set_vbucket_state:
        name = "dcp_expiration (0x5b)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_noop:
        name = "dcp_noop (0x5c)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_buffer_acknowledgement:
        name = "dcp_buffer_acknowledgement (0x5d)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_control:
        name = "dcp_control (0x5e)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_system_event:
        name = "dcp_system_event (0x5f)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_prepare:
        name = "dcp_prepare (0x60)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_seqno_acknowledged:
        name = "dcp_seqno_acknowledged (0x61)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_commit:
        name = "dcp_commit (0x62)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_abort:
        name = "dcp_abort (0x63)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_seqno_advanced:
        name = "dcp_seqno_advanced (0x64)";
        break;
      case couchbase::core::protocol::client_opcode::dcp_oso_snapshot:
        name = "dcp_oso_snapshot (0x65)";
        break;
      case couchbase::core::protocol::client_opcode::get_replica:
        name = "get_replica (0x83)";
        break;
      case couchbase::core::protocol::client_opcode::list_buckets:
        name = "list_buckets (0x87)";
        break;
      case couchbase::core::protocol::client_opcode::observe_seqno:
        name = "observe_seqno (0x91)";
        break;
      case couchbase::core::protocol::client_opcode::evict_key:
        name = "evict_key (0x93)";
        break;
      case couchbase::core::protocol::client_opcode::get_failover_log:
        name = "get_failover_log (0x96)";
        break;
      case couchbase::core::protocol::client_opcode::last_closed_checkpoint:
        name = "last_closed_checkpoint (0x97)";
        break;
      case couchbase::core::protocol::client_opcode::get_meta:
        name = "get_meta (0xa0)";
        break;
      case couchbase::core::protocol::client_opcode::upsert_with_meta:
        name = "upsert_with_meta (0xa2)";
        break;
      case couchbase::core::protocol::client_opcode::insert_with_meta:
        name = "insert_with_meta (0xa4)";
        break;
      case couchbase::core::protocol::client_opcode::remove_with_meta:
        name = "remove_with_meta (0xa8)";
        break;
      case couchbase::core::protocol::client_opcode::create_checkpoint:
        name = "create_checkpoint (0xaa)";
        break;
      case couchbase::core::protocol::client_opcode::checkpoint_persistence:
        name = "checkpoint_persistence (0xb1)";
        break;
      case couchbase::core::protocol::client_opcode::return_meta:
        name = "return_meta (0xb2)";
        break;
      case couchbase::core::protocol::client_opcode::get_random_key:
        name = "get_random_key (0xb6)";
        break;
      case couchbase::core::protocol::client_opcode::seqno_persistence:
        name = "seqno_persistence (0xb7)";
        break;
      case couchbase::core::protocol::client_opcode::get_keys:
        name = "get_keys (0xb8)";
        break;
      case couchbase::core::protocol::client_opcode::set_collections_manifest:
        name = "set_collections_manifest (0xb9)";
        break;
      case couchbase::core::protocol::client_opcode::get_scope_id:
        name = "get_scope_id (0xbc)";
        break;
      case couchbase::core::protocol::client_opcode::range_scan_create:
        name = "range_scan_create (0xda)";
        break;
      case couchbase::core::protocol::client_opcode::range_scan_continue:
        name = "range_scan_continue (0xdb)";
        break;
      case couchbase::core::protocol::client_opcode::range_scan_cancel:
        name = "range_scan_cancel (0xdc)";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};

template<>
struct fmt::formatter<couchbase::core::protocol::subdoc_opcode> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::subdoc_opcode opcode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (opcode) {
      case couchbase::core::protocol::subdoc_opcode::get:
        name = "get (0xc5)";
        break;
      case couchbase::core::protocol::subdoc_opcode::exists:
        name = "exists (0xc6)";
        break;
      case couchbase::core::protocol::subdoc_opcode::dict_add:
        name = "dict_add (0xc7)";
        break;
      case couchbase::core::protocol::subdoc_opcode::dict_upsert:
        name = "dict_upsert (0xc8)";
        break;
      case couchbase::core::protocol::subdoc_opcode::remove:
        name = "remove (0xc9)";
        break;
      case couchbase::core::protocol::subdoc_opcode::replace:
        name = "replace (0xca)";
        break;
      case couchbase::core::protocol::subdoc_opcode::array_push_last:
        name = "array_push_last (0xcb)";
        break;
      case couchbase::core::protocol::subdoc_opcode::array_push_first:
        name = "array_push_first (0xcc)";
        break;
      case couchbase::core::protocol::subdoc_opcode::array_insert:
        name = "array_insert (0xcd)";
        break;
      case couchbase::core::protocol::subdoc_opcode::array_add_unique:
        name = "array_add_unique (0xce)";
        break;
      case couchbase::core::protocol::subdoc_opcode::counter:
        name = "counter (0xcf)";
        break;
      case couchbase::core::protocol::subdoc_opcode::get_count:
        name = "get_count (0xd2)";
        break;
      case couchbase::core::protocol::subdoc_opcode::get_doc:
        name = "get_doc (0x00)";
        break;
      case couchbase::core::protocol::subdoc_opcode::set_doc:
        name = "set_doc (0x01)";
        break;
      case couchbase::core::protocol::subdoc_opcode::replace_body_with_xattr:
        name = "replace_body_with_xattr (0xd3)";
        break;
      case couchbase::core::protocol::subdoc_opcode::remove_doc:
        name = "remove_doc (0x04)";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
