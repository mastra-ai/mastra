/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "command_code.hxx"

namespace couchbase::core::mcbp
{
auto
is_idempotent(protocol::client_opcode opcode) -> bool
{
  switch (opcode) {
    case protocol::client_opcode::get:
    case protocol::client_opcode::noop:
    case protocol::client_opcode::get_replica:
    case protocol::client_opcode::observe_seqno:
    case protocol::client_opcode::observe:
    case protocol::client_opcode::get_meta:
    case protocol::client_opcode::stat:
    case protocol::client_opcode::get_cluster_config:
    case protocol::client_opcode::get_random_key:
    case protocol::client_opcode::get_collections_manifest:
    case protocol::client_opcode::get_collection_id:
    case protocol::client_opcode::subdoc_multi_lookup:
      return true;
    default:
      break;
  }
  return false;
}

auto
supports_collection_id(protocol::client_opcode command) -> bool
{
  switch (command) {
    case protocol::client_opcode::get:
    case protocol::client_opcode::upsert:
    case protocol::client_opcode::insert:
    case protocol::client_opcode::replace:
    case protocol::client_opcode::remove:
    case protocol::client_opcode::increment:
    case protocol::client_opcode::decrement:
    case protocol::client_opcode::append:
    case protocol::client_opcode::prepend:
    case protocol::client_opcode::touch:
    case protocol::client_opcode::get_and_touch:
    case protocol::client_opcode::dcp_mutation:
    case protocol::client_opcode::dcp_deletion:
    case protocol::client_opcode::dcp_expiration:
    case protocol::client_opcode::get_replica:
    case protocol::client_opcode::get_and_lock:
    case protocol::client_opcode::unlock:
    case protocol::client_opcode::get_meta:
    case protocol::client_opcode::upsert_with_meta:
    case protocol::client_opcode::remove_with_meta:
    case protocol::client_opcode::subdoc_multi_lookup:
    case protocol::client_opcode::subdoc_multi_mutation:
      return true;
    default:
      break;
  }
  return false;
}
} // namespace couchbase::core::mcbp
