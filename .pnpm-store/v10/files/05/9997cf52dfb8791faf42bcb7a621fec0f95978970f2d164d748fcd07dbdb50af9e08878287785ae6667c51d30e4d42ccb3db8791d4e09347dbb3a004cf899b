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

#include "core/fmt/key_value_status_code.hxx"

#include "status.hxx"

#include <couchbase/error_codes.hxx>

namespace couchbase::core::protocol
{
auto
status_to_string(std::uint16_t code) -> std::string
{
  if (is_valid_status(code)) {
    return fmt::format("{} ({})", code, static_cast<key_value_status_code>(code));
  }
  return fmt::format("{} (unknown)", code);
}

[[nodiscard]] auto
map_status_code(protocol::client_opcode opcode, std::uint16_t status) -> std::error_code
{
  switch (static_cast<key_value_status_code>(status)) {
    case key_value_status_code::success:
    case key_value_status_code::subdoc_multi_path_failure:
    case key_value_status_code::subdoc_success_deleted:
    case key_value_status_code::subdoc_multi_path_failure_deleted:
    case key_value_status_code::range_scan_complete:
    case key_value_status_code::range_scan_more:
      return {};

    case key_value_status_code::not_found:
      return errc::key_value::document_not_found;

    case key_value_status_code::not_stored:
      if (opcode == protocol::client_opcode::insert) {
        return errc::key_value::document_exists;
      }
      return errc::key_value::document_not_found;

    case key_value_status_code::exists:
      if (opcode == protocol::client_opcode::insert) {
        return errc::key_value::document_exists;
      }
      return errc::common::cas_mismatch;

    case key_value_status_code::too_big:
      return errc::key_value::value_too_large;

    case key_value_status_code::invalid:
    case key_value_status_code::xattr_invalid:
    case key_value_status_code::subdoc_invalid_combo:
    case key_value_status_code::subdoc_deleted_document_cannot_have_value:
      return errc::common::invalid_argument;

    case key_value_status_code::delta_bad_value:
      return errc::key_value::delta_invalid;

    case key_value_status_code::no_bucket:
      return errc::common::bucket_not_found;

    case key_value_status_code::locked:
      if (opcode == protocol::client_opcode::unlock) {
        return errc::common::cas_mismatch;
      }
      return errc::key_value::document_locked;

    case key_value_status_code::not_locked:
      return errc::key_value::document_not_locked;

    case key_value_status_code::auth_stale:
    case key_value_status_code::auth_error:
    case key_value_status_code::no_access:
      return errc::common::authentication_failure;

    case key_value_status_code::not_supported:
    case key_value_status_code::unknown_command:
      return errc::common::unsupported_operation;

    case key_value_status_code::internal:
      return errc::common::internal_server_failure;

    case key_value_status_code::busy:
    case key_value_status_code::temporary_failure:
    case key_value_status_code::no_memory:
    case key_value_status_code::not_initialized:
      return errc::common::temporary_failure;

    case key_value_status_code::unknown_collection:
      return errc::common::collection_not_found;

    case key_value_status_code::unknown_scope:
      return errc::common::scope_not_found;

    case key_value_status_code::durability_invalid_level:
      return errc::key_value::durability_level_not_available;

    case key_value_status_code::durability_impossible:
      return errc::key_value::durability_impossible;

    case key_value_status_code::sync_write_in_progress:
      return errc::key_value::durable_write_in_progress;

    case key_value_status_code::sync_write_ambiguous:
      return errc::key_value::durability_ambiguous;

    case key_value_status_code::sync_write_re_commit_in_progress:
      return errc::key_value::durable_write_re_commit_in_progress;

    case key_value_status_code::subdoc_path_not_found:
      return errc::key_value::path_not_found;

    case key_value_status_code::subdoc_path_mismatch:
      return errc::key_value::path_mismatch;

    case key_value_status_code::subdoc_path_invalid:
      return errc::key_value::path_invalid;

    case key_value_status_code::subdoc_path_too_big:
      return errc::key_value::path_too_big;

    case key_value_status_code::subdoc_doc_too_deep:
      return errc::key_value::path_too_deep;

    case key_value_status_code::subdoc_value_cannot_insert:
      return errc::key_value::value_invalid;

    case key_value_status_code::subdoc_doc_not_json:
      return errc::key_value::document_not_json;

    case key_value_status_code::subdoc_num_range_error:
      return errc::key_value::number_too_big;

    case key_value_status_code::subdoc_delta_invalid:
      return errc::key_value::delta_invalid;

    case key_value_status_code::subdoc_path_exists:
      return errc::key_value::path_exists;

    case key_value_status_code::subdoc_value_too_deep:
      return errc::key_value::value_too_deep;

    case key_value_status_code::subdoc_xattr_invalid_flag_combo:
    case key_value_status_code::subdoc_xattr_invalid_key_combo:
      return errc::key_value::xattr_invalid_key_combo;

    case key_value_status_code::subdoc_xattr_unknown_macro:
    case key_value_status_code::subdoc_xattr_unknown_vattr_macro:
      return errc::key_value::xattr_unknown_macro;

    case key_value_status_code::subdoc_xattr_unknown_vattr:
      return errc::key_value::xattr_unknown_virtual_attribute;

    case key_value_status_code::subdoc_xattr_cannot_modify_vattr:
      return errc::key_value::xattr_cannot_modify_virtual_attribute;

    case key_value_status_code::subdoc_can_only_revive_deleted_documents:
      return errc::key_value::cannot_revive_living_document;

    case key_value_status_code::rate_limited_network_ingress:
    case key_value_status_code::rate_limited_network_egress:
    case key_value_status_code::rate_limited_max_connections:
    case key_value_status_code::rate_limited_max_commands:
      return errc::common::rate_limited;

    case key_value_status_code::scope_size_limit_exceeded:
      return errc::common::quota_limited;

    case key_value_status_code::subdoc_invalid_xattr_order:
    case key_value_status_code::not_my_vbucket:
    case key_value_status_code::auth_continue:
    case key_value_status_code::range_error:
    case key_value_status_code::rollback:
    case key_value_status_code::unknown_frame_info:
    case key_value_status_code::no_collections_manifest:
    case key_value_status_code::cannot_apply_collections_manifest:
    case key_value_status_code::collections_manifest_is_ahead:
    case key_value_status_code::dcp_stream_id_invalid:
    case key_value_status_code::dcp_stream_not_found:
    case key_value_status_code::opaque_no_match:

    case key_value_status_code::range_scan_cancelled:
      return errc::common::request_canceled;

    case key_value_status_code::range_scan_vb_uuid_not_equal:
      return errc::key_value::mutation_token_outdated;

    case key_value_status_code::unknown:
    case key_value_status_code::config_only:
      break;
  }
  return errc::network::protocol_error;
}
} // namespace couchbase::core::protocol
