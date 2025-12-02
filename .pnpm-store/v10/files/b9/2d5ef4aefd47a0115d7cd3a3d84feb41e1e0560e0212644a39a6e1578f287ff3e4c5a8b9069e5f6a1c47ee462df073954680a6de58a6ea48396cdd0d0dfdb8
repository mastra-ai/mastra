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
#include "core/protocol/cmd_get_replica.hxx"
#include "core/timeout_defaults.hxx"

namespace couchbase::core::impl
{
struct get_replica_response {
  key_value_error_context ctx{};
  std::vector<std::byte> value{};
  couchbase::cas cas{};
  std::uint32_t flags{};
};

struct get_replica_request {
  using response_type = get_replica_response;
  using encoded_request_type =
    core::protocol::client_request<core::protocol::get_replica_request_body>;
  using encoded_response_type =
    core::protocol::client_response<core::protocol::get_replica_response_body>;

  static const inline std::string observability_identifier = "get_replica";

  core::document_id id;
  std::optional<std::chrono::milliseconds> timeout{};
  std::uint16_t partition{};
  std::uint32_t opaque{};
  io::retry_context<true> retries{};

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               core::mcbp_context&& context) const -> std::error_code;

  [[nodiscard]] auto make_response(key_value_error_context&& ctx,
                                   const encoded_response_type& encoded) const
    -> get_replica_response;
};
} // namespace couchbase::core::impl
