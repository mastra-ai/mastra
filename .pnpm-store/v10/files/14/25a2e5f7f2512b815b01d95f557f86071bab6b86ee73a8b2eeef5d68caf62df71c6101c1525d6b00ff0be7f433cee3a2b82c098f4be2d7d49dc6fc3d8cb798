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

#include "freeform.hxx"

#include "error_utils.hxx"

namespace couchbase::core::operations::management
{
auto
freeform_request::encode_to(encoded_request_type& encoded,
                            http_context& /* context */) const -> std::error_code
{
  switch (type) {
    case service_type::query:
    case service_type::analytics:
    case service_type::search:
    case service_type::view:
    case service_type::management:
    case service_type::eventing:
      break;
    default:
      return errc::common::invalid_argument;
  }
  encoded.method = method;
  encoded.headers = headers;
  encoded.path = path;
  encoded.body = body;
  return {};
}

auto
freeform_request::make_response(error_context::http&& ctx,
                                const encoded_response_type& encoded) const -> freeform_response
{
  freeform_response response{ std::move(ctx) };
  response.status = encoded.status_code;
  response.headers = encoded.headers;
  response.body = encoded.body.data();
  return response;
}
} // namespace couchbase::core::operations::management
