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

#include "analytics_link_create.hxx"

#include "core/utils/json.hxx"
#include "core/utils/name_codec.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management::details
{
auto
make_analytics_link_create_response(error_context::http&& ctx, const io::http_response& encoded)
  -> analytics_link_create_response
{
  management::analytics_link_create_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.body.data().empty() && response.ctx.http_status == 200) {
      return response;
    }
    tao::json::value payload{};
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      auto colon = encoded.body.data().find(':');
      if (colon == std::string::npos) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      auto code = static_cast<std::uint32_t>(std::stoul(encoded.body.data()));
      auto msg = encoded.body.data().substr(colon + 1);
      response.errors.emplace_back(
        management::analytics_link_create_response::problem{ code, msg });
    }
    if (payload.is_object()) {
      response.status = payload.optional<std::string>("status").value_or("unknown");
      if (response.status != "success") {
        if (auto* errors = payload.find("errors"); errors != nullptr && errors->is_array()) {
          for (const auto& error : errors->get_array()) {
            const management::analytics_link_create_response::problem err{
              error.at("code").as<std::uint32_t>(),
              error.at("msg").get_string(),
            };
            response.errors.emplace_back(err);
          }
        }
      }
    }
    bool link_exists = false;
    bool dataverse_does_not_exist = false;
    for (const auto& err : response.errors) {
      switch (err.code) {
        case 24055: /* Link [string] already exists */
          link_exists = true;
          break;
        case 24034: /* Cannot find dataverse with name [string] */
          dataverse_does_not_exist = true;
          break;
        default:
          break;
      }
    }
    if (dataverse_does_not_exist) {
      response.ctx.ec = errc::analytics::dataverse_not_found;
    } else if (link_exists) {
      response.ctx.ec = errc::analytics::link_exists;
    } else {
      response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management::details
