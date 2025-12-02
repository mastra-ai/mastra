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

#include "http_noop.hxx"

#include <couchbase/error_codes.hxx>

namespace couchbase::core::operations
{
auto
http_noop_request::encode_to(http_noop_request::encoded_request_type& encoded,
                             http_context& /* context */) -> std::error_code
{
  encoded.type = type;
  encoded.headers["connection"] = "keep-alive";
  encoded.method = "GET";
  encoded.path = "/";
  switch (type) {
    case service_type::query:
      timeout = timeout_defaults::query_timeout;
      encoded.path = "/admin/ping";
      break;
    case service_type::analytics:
      timeout = timeout_defaults::analytics_timeout;
      encoded.path = "/admin/ping";
      break;
    case service_type::search:
      timeout = timeout_defaults::search_timeout;
      encoded.path = "/api/ping";
      break;
    case service_type::view:
      timeout = timeout_defaults::view_timeout;
      break;
    case service_type::management:
      timeout = timeout_defaults::management_timeout;
      break;
    case service_type::eventing:
      timeout = timeout_defaults::eventing_timeout;
      break;
    case service_type::key_value:
      return errc::common::feature_not_available;
  }
  return {};
}

auto
http_noop_request::make_response(error_context::http&& ctx,
                                 const encoded_response_type& /* encoded */) const
  -> http_noop_response
{
  http_noop_response response{ std::move(ctx) };
  return response;
}
} // namespace couchbase::core::operations
