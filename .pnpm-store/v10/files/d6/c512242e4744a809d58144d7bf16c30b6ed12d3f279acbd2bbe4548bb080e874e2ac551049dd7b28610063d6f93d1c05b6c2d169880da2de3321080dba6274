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

#include "core/document_id.hxx"
#include "core/error_context/key_value.hxx"
#include "core/io/mcbp_context.hxx"
#include "core/io/retry_context.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_get_collections_manifest.hxx"
#include "core/timeout_defaults.hxx"
#include "core/topology/collections_manifest.hxx"

namespace couchbase::core::operations::management
{
struct collections_manifest_get_response {
  key_value_error_context ctx;
  topology::collections_manifest manifest{};
};

struct collections_manifest_get_request {
  using response_type = collections_manifest_get_response;
  using encoded_request_type =
    protocol::client_request<protocol::get_collections_manifest_request_body>;
  using encoded_response_type =
    protocol::client_response<protocol::get_collections_manifest_response_body>;

  static const inline std::string observability_identifier = "get_collection_manifest";

  document_id id{};
  std::uint16_t partition{};
  std::uint32_t opaque{};

  std::optional<std::chrono::milliseconds> timeout{};
  io::retry_context<true> retries{};

  [[nodiscard]] std::error_code encode_to(encoded_request_type& encoded,
                                          mcbp_context&& /* context */) const;

  [[nodiscard]] collections_manifest_get_response make_response(
    key_value_error_context&& ctx,
    const encoded_response_type& encoded) const;
};
} // namespace couchbase::core::operations::management
