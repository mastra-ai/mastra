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

#include "user_get_all.hxx"

#include "core/management/rbac_fmt.hxx"
#include "core/management/rbac_json.hxx"
#include "core/utils/json.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
user_get_all_request::encode_to(encoded_request_type& encoded,
                                http_context& /* context */) const -> std::error_code
{
  encoded.method = "GET";
  encoded.path = fmt::format("/settings/rbac/users/{}", domain);
  encoded.headers["content-type"] = "application/x-www-form-urlencoded";
  return {};
}

auto
user_get_all_request::make_response(error_context::http&& ctx, const encoded_response_type& encoded)
  const -> user_get_all_response
{
  user_get_all_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.status_code == 200) {
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      for (const auto& entry : payload.get_array()) {
        response.users.emplace_back(
          entry.as<couchbase::core::management::rbac::user_and_metadata>());
      }
    } else {
      response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
