/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023 Couchbase, Inc.
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

#include "change_password.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>

namespace couchbase::core::operations::management
{
auto
change_password_request::encode_to(encoded_request_type& encoded,
                                   http_context& /* context */) const -> std::error_code
{
  encoded.method = "POST";
  encoded.path = "/controller/changePassword";
  encoded.headers["content-type"] = "application/x-www-form-urlencoded";
  encoded.body = fmt::format("password={}", utils::string_codec::form_encode(newPassword));

  return {};
}

auto
change_password_request::make_response(error_context::http&& ctx,
                                       const encoded_response_type& encoded) const
  -> change_password_response
{
  change_password_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    switch (encoded.status_code) {
      case 200:
        break;
      case 400:
        if (encoded.body.data().find("Not allowed on this version of cluster") !=
            std::string::npos) {
          response.ctx.ec = errc::common::feature_not_available;
        }
        break;
      default:
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
        break;
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
