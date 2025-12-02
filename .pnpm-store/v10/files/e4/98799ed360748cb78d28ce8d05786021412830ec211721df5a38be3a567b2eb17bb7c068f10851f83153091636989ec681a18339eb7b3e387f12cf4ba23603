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

#include "core/error_context/key_value.hxx"
#include "core/io/mcbp_context.hxx"
#include "core/io/mcbp_traits.hxx"
#include "core/io/retry_context.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_unlock.hxx"
#include "core/public_fwd.hxx"
#include "core/timeout_defaults.hxx"

namespace couchbase::core::operations
{

struct unlock_response {
  key_value_error_context ctx;
  couchbase::cas cas{};
};

struct unlock_request {
  using response_type = unlock_response;
  using encoded_request_type = protocol::client_request<protocol::unlock_request_body>;
  using encoded_response_type = protocol::client_response<protocol::unlock_response_body>;

  static const inline std::string observability_identifier = "unlock";

  document_id id;
  std::uint16_t partition{};
  std::uint32_t opaque{};
  couchbase::cas cas{};
  std::optional<std::chrono::milliseconds> timeout{};
  io::retry_context<false> retries{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{ nullptr };

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               mcbp_context&& context) const -> std::error_code;

  [[nodiscard]] auto make_response(key_value_error_context&& ctx,
                                   const encoded_response_type& encoded) const -> unlock_response;
};

} // namespace couchbase::core::operations
namespace couchbase::core::io::mcbp_traits
{
template<>
struct supports_parent_span<couchbase::core::operations::unlock_request> : public std::true_type {
};
} // namespace couchbase::core::io::mcbp_traits
