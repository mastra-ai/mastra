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

#include "group_upsert.hxx"

#include "core/utils/join_strings.hxx"
#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
group_upsert_request::encode_to(encoded_request_type& encoded,
                                http_context& /* context */) const -> std::error_code
{
  encoded.method = "PUT";
  encoded.path = fmt::format("/settings/rbac/groups/{}", group.name);
  std::vector<std::string> params{};
  if (group.description) {
    params.push_back(
      fmt::format("description={}", utils::string_codec::url_encode(group.description.value())));
  }
  if (group.ldap_group_reference) {
    params.push_back(fmt::format(
      "ldap_group_ref={}", utils::string_codec::url_encode(group.ldap_group_reference.value())));
  }
  std::vector<std::string> encoded_roles{};
  encoded_roles.reserve(group.roles.size());
  for (const auto& role : group.roles) {
    std::string spec = role.name;
    if (role.bucket) {
      spec += fmt::format("[{}", utils::string_codec::v2::path_escape(role.bucket.value()));
      if (role.scope) {
        spec += fmt::format(":{}", utils::string_codec::v2::path_escape(role.scope.value()));
        if (role.collection) {
          spec += fmt::format(":{}", utils::string_codec::v2::path_escape(role.collection.value()));
        }
      }
      spec += "]";
    }
    encoded_roles.push_back(spec);
  }
  if (!encoded_roles.empty()) {
    const std::string concatenated = fmt::format("{}", utils::join_strings(encoded_roles, ","));
    params.push_back(fmt::format("roles={}", utils::string_codec::url_encode(concatenated)));
  }
  encoded.body = utils::join_strings(params, "&");
  encoded.headers["content-type"] = "application/x-www-form-urlencoded";
  return {};
}

auto
group_upsert_request::make_response(error_context::http&& ctx, const encoded_response_type& encoded)
  const -> group_upsert_response
{
  group_upsert_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    switch (encoded.status_code) {
      case 200:
        break;
      case 400: {
        response.ctx.ec = errc::common::invalid_argument;
        tao::json::value payload{};
        try {
          payload = utils::json::parse(encoded.body.data());
        } catch (const tao::pegtl::parse_error&) {
          response.ctx.ec = errc::common::parsing_failure;
          return response;
        }

        if (const auto* errors = payload.find("errors"); errors != nullptr && errors->is_object()) {
          for (const auto& [code, message] : errors->get_object()) {
            response.errors.emplace_back(fmt::format("{}: {}", code, message.get_string()));
          }
        }
      } break;
      default:
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
        break;
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
