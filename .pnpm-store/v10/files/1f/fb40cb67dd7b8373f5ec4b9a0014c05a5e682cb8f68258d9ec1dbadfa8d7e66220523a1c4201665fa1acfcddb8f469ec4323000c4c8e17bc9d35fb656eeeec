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

#include "core/error_context/http.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/platform/uuid.h"
#include "core/query_context.hxx"
#include "core/timeout_defaults.hxx"
#include "couchbase/management/query_index.hxx"

namespace couchbase::core::operations::management
{
struct query_index_get_all_deferred_response {
  error_context::http ctx;
  std::string status{};
  std::vector<std::string> index_names{};
};

struct query_index_get_all_deferred_request {
  using response_type = query_index_get_all_deferred_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::http;

  static const inline service_type type = service_type::query;
  static const inline std::string observability_identifier =
    "manager_query_get_all_deferred_indexes";

  static constexpr auto namespace_id = "default";

  std::string bucket_name;
  std::string scope_name;
  std::string collection_name;
  query_context query_ctx;
  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  [[nodiscard]] std::error_code encode_to(encoded_request_type& encoded,
                                          http_context& context) const;

  [[nodiscard]] query_index_get_all_deferred_response make_response(
    error_context::http&& ctx,
    const encoded_response_type& encoded) const;
};
} // namespace couchbase::core::operations::management
