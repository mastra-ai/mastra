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
#include "core/impl/subdoc/command.hxx"
#include "core/io/mcbp_context.hxx"
#include "core/io/mcbp_traits.hxx"
#include "core/io/retry_context.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_lookup_in.hxx"
#include "core/public_fwd.hxx"
#include "core/timeout_defaults.hxx"

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/lookup_in_result.hxx>

namespace couchbase::core::operations
{

struct lookup_in_response {
  struct entry {
    std::string path;
    codec::binary value;
    std::size_t original_index;
    bool exists;
    protocol::subdoc_opcode opcode;
    key_value_status_code status;
    std::error_code ec{};
  };
  subdocument_error_context ctx;
  couchbase::cas cas{};
  std::vector<entry> fields{};
  bool deleted{ false };
};

struct lookup_in_request {
  using response_type = lookup_in_response;
  using encoded_request_type = protocol::client_request<protocol::lookup_in_request_body>;
  using encoded_response_type = protocol::client_response<protocol::lookup_in_response_body>;

  static const inline std::string observability_identifier = "lookup_in";

  document_id id;
  std::uint16_t partition{};
  std::uint32_t opaque{};
  bool access_deleted{ false };
  std::vector<couchbase::core::impl::subdoc::command> specs{};
  std::optional<std::chrono::milliseconds> timeout{};
  io::retry_context<false> retries{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{ nullptr };

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               mcbp_context&& context) -> std::error_code;

  [[nodiscard]] auto make_response(key_value_error_context&& ctx,
                                   const encoded_response_type& encoded) const
    -> lookup_in_response;
};

} // namespace couchbase::core::operations
namespace couchbase::core::io::mcbp_traits
{

template<>
struct supports_parent_span<couchbase::core::operations::lookup_in_request>
  : public std::true_type {
};
} // namespace couchbase::core::io::mcbp_traits
