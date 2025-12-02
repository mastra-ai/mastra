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

#include "analytics_link_utils.hxx"
#include "core/error_context/http.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/platform/uuid.h"
#include "core/timeout_defaults.hxx"

namespace couchbase::core::operations::management
{
struct analytics_link_replace_response {
  struct problem {
    std::uint32_t code;
    std::string message;
  };

  error_context::http ctx;
  std::string status{};
  std::vector<problem> errors{};
};

namespace details
{
analytics_link_replace_response
make_analytics_link_replace_response(error_context::http&& ctx, const io::http_response& encoded);
} // namespace details

template<typename analytics_link_type>
struct analytics_link_replace_request {
  using response_type = analytics_link_replace_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::http;

  static const inline service_type type = service_type::analytics;
  static const inline std::string observability_identifier = "manager_analytics_replace_link";

  analytics_link_type link{};

  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  [[nodiscard]] std::error_code encode_to(encoded_request_type& encoded,
                                          http_context& /* context */) const
  {
    if (std::error_code ec = link.validate()) {
      return ec;
    }
    encoded.headers["content-type"] = "application/x-www-form-urlencoded";
    encoded.headers["accept"] = "application/json";
    encoded.method = "PUT";
    encoded.path = endpoint_from_analytics_link(link);
    encoded.body = link.encode();
    return {};
  }

  [[nodiscard]] analytics_link_replace_response make_response(
    error_context::http&& ctx,
    const encoded_response_type& encoded) const
  {
    return details::make_analytics_link_replace_response(std::move(ctx), encoded);
  }
};
} // namespace couchbase::core::operations::management
