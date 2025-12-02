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

#include "core/error_context/key_value_error_context.hxx"

#include "core/io/mcbp_context.hxx"
#include "core/io/retry_context.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_observe_seqno.hxx"
#include "core/timeout_defaults.hxx"

namespace couchbase::core::impl
{
struct observe_seqno_response {
  key_value_error_context ctx{};
  bool active{};
  std::uint16_t partition{};
  std::uint64_t partition_uuid{};
  std::uint64_t last_persisted_sequence_number{};
  std::uint64_t current_sequence_number{};
  std::optional<std::uint64_t> old_partition_uuid{};
  std::optional<std::uint64_t> last_received_sequence_number{};

  [[nodiscard]] auto failed_over() const -> bool
  {
    return old_partition_uuid.has_value();
  }
};

struct observe_seqno_request {
  using response_type = observe_seqno_response;
  using encoded_request_type =
    core::protocol::client_request<core::protocol::observe_seqno_request_body>;
  using encoded_response_type =
    core::protocol::client_response<core::protocol::observe_seqno_response_body>;

  static const inline std::string observability_identifier = "observe_seqno";

  core::document_id id;
  bool active{};
  std::uint64_t partition_uuid{};
  std::optional<std::chrono::milliseconds> timeout{};
  std::uint16_t partition{};
  std::uint32_t opaque{};
  io::retry_context<true> retries{};

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               core::mcbp_context&& context) const -> std::error_code;

  [[nodiscard]] auto make_response(key_value_error_context&& ctx,
                                   const encoded_response_type& encoded) const
    -> observe_seqno_response;
};
} // namespace couchbase::core::impl
