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

#include <cstdint>
#include <string>
#include <vector>

namespace couchbase::core::protocol
{
enum class client_opcode : std::uint8_t {
  get = 0x00,
  upsert = 0x01,
  insert = 0x02,
  replace = 0x03,
  remove = 0x04,
  increment = 0x05,
  decrement = 0x06,
  noop = 0x0a,
  version = 0x0b,
  append = 0x0e,
  prepend = 0x0f,
  stat = 0x10,
  verbosity = 0x1b,
  touch = 0x1c,
  get_and_touch = 0x1d,
  hello = 0x1f,
  sasl_list_mechs = 0x20,
  sasl_auth = 0x21,
  sasl_step = 0x22,
  get_all_vbucket_seqnos = 0x48,

  /**
   * Open connection
   * Sent by an external entity to a producer or a consumer to create a logical channel.
   */
  dcp_open = 0x50,

  /**
   * Add Stream
   * Sent to the consumer to tell the consumer to initiate a stream request with the producer.
   */
  dcp_add_stream = 0x51,

  /**
   * Close Stream
   * Sent to server controling an DCP stream to close the stream for a named vbucket as soon as
   * possible.
   */
  dcp_close_stream = 0x52,

  /**
   * Stream Request
   * Sent by the consumer side to the producer specifying that the consumer wants to create a
   * vbucket stream
   */
  dcp_stream_request = 0x53,

  /**
   * Failover Log Request
   * The Failover log request is used by the consumer to request all known failover ids a client may
   * use to continue from.
   */
  dcp_get_failover_log = 0x54,

  /**
   * Stream End
   * Sent to the consumer to indicate that the producer has no more messages to stream for the
   * specified vbucket.
   */
  dcp_stream_end = 0x55,

  /**
   * Snapshot Marker
   * Sent by the producer to tell the consumer that a new snapshot is being sent.
   */
  dcp_snapshot_marker = 0x56,

  /**
   * Mutation
   * Tells the consumer that the message contains a key mutation.
   */
  dcp_mutation = 0x57,

  /**
   * Deletion
   * Tells the consumer that the message contains a key deletion.
   */
  dcp_deletion = 0x58,

  /**
   * Expiration
   * Tells the consumer that the message contains a key expiration
   */
  dcp_expiration = 0x59,

  /**
   * Set VBucket State
   * The Set VBucket message is used during the VBucket takeover process to hand off ownership of a
   * VBucket between two nodes
   */
  dcp_set_vbucket_state = 0x5b,

  /**
   * No-Op
   * A No-Op message is sent by the Producer to the Consumer if the Producer has not sent any
   * messages for a given interval of time
   */
  dcp_noop = 0x5c,

  /**
   * Buffer Acknowledgement
   * Sent to by the Consumer to the Producer in order to inform the Producer that the Consumer has
   * consumed some or all of the data the the Producer has sent and that the Consumer is ready for
   * more data
   */
  dcp_buffer_acknowledgement = 0x5d,

  /**
   * Control
   * Sent by the Consumer to the Producer in order to configure connection settings.
   */
  dcp_control = 0x5e,

  /**
   * System Event
   * Tells the consumer that the message contains a system event.
   */
  dcp_system_event = 0x5f,

  dcp_prepare = 0x60,
  dcp_seqno_acknowledged = 0x61,
  dcp_commit = 0x62,
  dcp_abort = 0x63,

  /**
   * Seqno Advanced
   * Sent by the producer to tell the consumer that the vbucket seqno has advanced due to an event
   * that the consumer is not subscribed too.
   */
  dcp_seqno_advanced = 0x64,

  /**
   * OSO Snapshot
   * Sent by the producer to tell the consumer that a Out of Sequence Order snapshot is to be
   * transmitted or has now been completed.
   */
  dcp_oso_snapshot = 0x65,

  get_replica = 0x83,
  list_buckets = 0x87,
  select_bucket = 0x89,
  observe_seqno = 0x91,
  observe = 0x92,
  evict_key = 0x93,
  get_and_lock = 0x94,
  unlock = 0x95,
  get_failover_log = 0x96,

  /**
   * Return the last closed checkpoint Id for a given VBucket.
   */
  last_closed_checkpoint = 0x97,

  get_meta = 0xa0,
  upsert_with_meta = 0xa2,
  insert_with_meta = 0xa4,
  remove_with_meta = 0xa8,

  /**
   * Command to create a new checkpoint on a given vbucket by force
   */
  create_checkpoint = 0xaa,

  /**
   * Command to wait for the checkpoint persistence
   */
  checkpoint_persistence = 0xb1,

  /**
   * Command that returns meta data for typical memcached ops
   */
  return_meta = 0xb2,

  get_random_key = 0xb6,

  /**
   * Command to wait for the dcp sequence number persistence
   */
  seqno_persistence = 0xb7,

  /**
   * Command to get all keys
   */
  get_keys = 0xb8,

  /**
   * Command to set collections manifest
   */
  set_collections_manifest = 0xb9,

  /**
   * Command to get collections manifest
   */
  get_collections_manifest = 0xba,

  /**
   * Command to get a collection ID
   */
  get_collection_id = 0xbb,

  /**
   * Command to get a scope ID
   */
  get_scope_id = 0xbc,

  subdoc_multi_lookup = 0xd0,
  subdoc_multi_mutation = 0xd1,

  get_cluster_config = 0xb5,

  get_error_map = 0xfe,

  range_scan_create = 0xda,
  range_scan_continue = 0xdb,
  range_scan_cancel = 0xdc,

  invalid = 0xff,
};

/**
 * subdocument opcodes are listed separately, because we are not going to implement/support
 * single-op messages
 */
enum class subdoc_opcode : std::uint8_t {
  get_doc = 0x00,
  set_doc = 0x01,
  remove_doc = 0x04,
  get = 0xc5,
  exists = 0xc6,
  dict_add = 0xc7,
  dict_upsert = 0xc8,
  remove = 0xc9,
  replace = 0xca,
  array_push_last = 0xcb,
  array_push_first = 0xcc,
  array_insert = 0xcd,
  array_add_unique = 0xce,
  counter = 0xcf,
  get_count = 0xd2,
  replace_body_with_xattr = 0xd3,
};

constexpr auto
is_valid_client_opcode(std::uint8_t code) -> bool
{
  switch (static_cast<client_opcode>(code)) {
    case client_opcode::get:
    case client_opcode::upsert:
    case client_opcode::insert:
    case client_opcode::replace:
    case client_opcode::remove:
    case client_opcode::hello:
    case client_opcode::sasl_list_mechs:
    case client_opcode::sasl_auth:
    case client_opcode::sasl_step:
    case client_opcode::select_bucket:
    case client_opcode::subdoc_multi_lookup:
    case client_opcode::subdoc_multi_mutation:
    case client_opcode::get_cluster_config:
    case client_opcode::get_error_map:
    case client_opcode::invalid:
    case client_opcode::get_collections_manifest:
    case client_opcode::touch:
    case client_opcode::observe:
    case client_opcode::get_and_lock:
    case client_opcode::unlock:
    case client_opcode::get_and_touch:
    case client_opcode::increment:
    case client_opcode::decrement:
    case client_opcode::get_collection_id:
    case client_opcode::noop:
    case client_opcode::version:
    case client_opcode::append:
    case client_opcode::prepend:
    case client_opcode::stat:
    case client_opcode::verbosity:
    case client_opcode::get_all_vbucket_seqnos:
    case client_opcode::dcp_open:
    case client_opcode::dcp_add_stream:
    case client_opcode::dcp_close_stream:
    case client_opcode::dcp_stream_request:
    case client_opcode::dcp_get_failover_log:
    case client_opcode::dcp_stream_end:
    case client_opcode::dcp_snapshot_marker:
    case client_opcode::dcp_mutation:
    case client_opcode::dcp_deletion:
    case client_opcode::dcp_expiration:
    case client_opcode::dcp_set_vbucket_state:
    case client_opcode::dcp_noop:
    case client_opcode::dcp_buffer_acknowledgement:
    case client_opcode::dcp_control:
    case client_opcode::dcp_system_event:
    case client_opcode::dcp_prepare:
    case client_opcode::dcp_seqno_acknowledged:
    case client_opcode::dcp_commit:
    case client_opcode::dcp_abort:
    case client_opcode::dcp_seqno_advanced:
    case client_opcode::dcp_oso_snapshot:
    case client_opcode::get_replica:
    case client_opcode::list_buckets:
    case client_opcode::observe_seqno:
    case client_opcode::evict_key:
    case client_opcode::get_failover_log:
    case client_opcode::last_closed_checkpoint:
    case client_opcode::get_meta:
    case client_opcode::upsert_with_meta:
    case client_opcode::insert_with_meta:
    case client_opcode::remove_with_meta:
    case client_opcode::create_checkpoint:
    case client_opcode::checkpoint_persistence:
    case client_opcode::return_meta:
    case client_opcode::get_random_key:
    case client_opcode::seqno_persistence:
    case client_opcode::get_keys:
    case client_opcode::set_collections_manifest:
    case client_opcode::get_scope_id:
    case client_opcode::range_scan_create:
    case client_opcode::range_scan_continue:
    case client_opcode::range_scan_cancel:
      return true;
  }
  return false;
}

constexpr auto
is_valid_subdoc_opcode(std::uint8_t code) -> bool
{
  switch (static_cast<subdoc_opcode>(code)) {
    case subdoc_opcode::get:
    case subdoc_opcode::exists:
    case subdoc_opcode::dict_add:
    case subdoc_opcode::dict_upsert:
    case subdoc_opcode::remove:
    case subdoc_opcode::replace:
    case subdoc_opcode::array_push_last:
    case subdoc_opcode::array_push_first:
    case subdoc_opcode::array_insert:
    case subdoc_opcode::array_add_unique:
    case subdoc_opcode::counter:
    case subdoc_opcode::get_count:
    case subdoc_opcode::get_doc:
    case subdoc_opcode::set_doc:
    case subdoc_opcode::remove_doc:
    case subdoc_opcode::replace_body_with_xattr:
      return true;
  }
  return false;
}

const inline static std::vector<std::byte> empty_buffer;
const inline static std::string empty_string;
} // namespace couchbase::core::protocol
