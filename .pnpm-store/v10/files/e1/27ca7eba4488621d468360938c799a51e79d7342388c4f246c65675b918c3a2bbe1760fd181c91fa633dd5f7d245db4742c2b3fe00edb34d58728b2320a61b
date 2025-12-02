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

#include "core/error_context/key_value_status_code.hxx"

#include "client_opcode.hxx"

#include <cstdint>
#include <string>
#include <system_error>

namespace couchbase::core::protocol
{
constexpr auto
is_valid_status(std::uint16_t code) -> bool
{
  switch (static_cast<key_value_status_code>(code)) {
    case key_value_status_code::success:
    case key_value_status_code::not_found:
    case key_value_status_code::exists:
    case key_value_status_code::too_big:
    case key_value_status_code::invalid:
    case key_value_status_code::not_stored:
    case key_value_status_code::delta_bad_value:
    case key_value_status_code::not_my_vbucket:
    case key_value_status_code::no_bucket:
    case key_value_status_code::locked:
    case key_value_status_code::not_locked:
    case key_value_status_code::auth_stale:
    case key_value_status_code::auth_error:
    case key_value_status_code::auth_continue:
    case key_value_status_code::range_error:
    case key_value_status_code::rollback:
    case key_value_status_code::no_access:
    case key_value_status_code::not_initialized:
    case key_value_status_code::unknown_frame_info:
    case key_value_status_code::unknown_command:
    case key_value_status_code::no_memory:
    case key_value_status_code::not_supported:
    case key_value_status_code::internal:
    case key_value_status_code::busy:
    case key_value_status_code::temporary_failure:
    case key_value_status_code::xattr_invalid:
    case key_value_status_code::unknown_collection:
    case key_value_status_code::no_collections_manifest:
    case key_value_status_code::cannot_apply_collections_manifest:
    case key_value_status_code::collections_manifest_is_ahead:
    case key_value_status_code::unknown_scope:
    case key_value_status_code::dcp_stream_id_invalid:
    case key_value_status_code::durability_invalid_level:
    case key_value_status_code::durability_impossible:
    case key_value_status_code::sync_write_in_progress:
    case key_value_status_code::sync_write_ambiguous:
    case key_value_status_code::sync_write_re_commit_in_progress:
    case key_value_status_code::subdoc_path_not_found:
    case key_value_status_code::subdoc_path_mismatch:
    case key_value_status_code::subdoc_path_invalid:
    case key_value_status_code::subdoc_path_too_big:
    case key_value_status_code::subdoc_doc_too_deep:
    case key_value_status_code::subdoc_value_cannot_insert:
    case key_value_status_code::subdoc_doc_not_json:
    case key_value_status_code::subdoc_num_range_error:
    case key_value_status_code::subdoc_delta_invalid:
    case key_value_status_code::subdoc_path_exists:
    case key_value_status_code::subdoc_value_too_deep:
    case key_value_status_code::subdoc_invalid_combo:
    case key_value_status_code::subdoc_multi_path_failure:
    case key_value_status_code::subdoc_success_deleted:
    case key_value_status_code::subdoc_xattr_invalid_flag_combo:
    case key_value_status_code::subdoc_xattr_invalid_key_combo:
    case key_value_status_code::subdoc_xattr_unknown_macro:
    case key_value_status_code::subdoc_xattr_unknown_vattr:
    case key_value_status_code::subdoc_xattr_cannot_modify_vattr:
    case key_value_status_code::subdoc_multi_path_failure_deleted:
    case key_value_status_code::subdoc_invalid_xattr_order:
    case key_value_status_code::dcp_stream_not_found:
    case key_value_status_code::opaque_no_match:
    case key_value_status_code::rate_limited_network_ingress:
    case key_value_status_code::rate_limited_network_egress:
    case key_value_status_code::rate_limited_max_connections:
    case key_value_status_code::rate_limited_max_commands:
    case key_value_status_code::scope_size_limit_exceeded:
    case key_value_status_code::subdoc_xattr_unknown_vattr_macro:
    case key_value_status_code::subdoc_can_only_revive_deleted_documents:
    case key_value_status_code::subdoc_deleted_document_cannot_have_value:
    case key_value_status_code::range_scan_cancelled:
    case key_value_status_code::range_scan_more:
    case key_value_status_code::range_scan_complete:
    case key_value_status_code::range_scan_vb_uuid_not_equal:
    case key_value_status_code::config_only:
      return true;
    case key_value_status_code::unknown:
      return false;
  }
  return false;
}

[[nodiscard]] auto
status_to_string(std::uint16_t code) -> std::string;

[[nodiscard]] auto
map_status_code(protocol::client_opcode opcode, std::uint16_t status) -> std::error_code;

} // namespace couchbase::core::protocol
