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

#include "user_drop.hxx"

#include "core/management/rbac_fmt.hxx"
#include "error_utils.hxx"

namespace couchbase::core::operations::management
{
auto
user_drop_request::encode_to(encoded_request_type& encoded,
                             http_context& /* context */) const -> std::error_code
{
  encoded.method = "DELETE";
  encoded.path = fmt::format("/settings/rbac/users/{}/{}", domain, username);
  return {};
}

auto
user_drop_request::make_response(error_context::http&& ctx,
                                 const encoded_response_type& encoded) const -> user_drop_response
{
  user_drop_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    switch (encoded.status_code) {
      case 200:
        break;
      case 404:
        response.ctx.ec = errc::management::user_not_found;
        break;
      default:
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
        break;
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
