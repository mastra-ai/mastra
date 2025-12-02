/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include "eventing_get_status.hxx"
#include "core/logger/logger.hxx"
#include "core/management/eventing_status_json.hxx"
#include "core/utils/json.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
eventing_get_status_request::encode_to(encoded_request_type& encoded,
                                       http_context& /* context */) const -> std::error_code
{
  encoded.method = "GET";
  encoded.path = "/api/v1/status";
  return {};
}

auto
eventing_get_status_request::make_response(error_context::http&& ctx,
                                           const encoded_response_type& encoded) const
  -> eventing_get_status_response
{
  eventing_get_status_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    tao::json::value payload{};
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      response.ctx.ec = errc::common::parsing_failure;
      return response;
    }
    auto [ec, problem] = extract_eventing_error_code(payload);
    if (ec) {
      response.ctx.ec = ec;
      response.error.emplace(problem);
      return response;
    }
    response.status = payload.as<core::management::eventing::status>();
    std::vector<core::management::eventing::function_state> filtered_functions{};
    for (const auto& function : response.status.functions) {
      bool include{};
      if (bucket_name.has_value() && scope_name.has_value()) {
        include = function.internal.bucket_name.has_value() &&
                  function.internal.scope_name.has_value() &&
                  function.internal.bucket_name.value() == bucket_name.value() &&
                  function.internal.scope_name.value() == scope_name.value();
      } else {
        include =
          (!function.internal.bucket_name.has_value() &&
           !function.internal.scope_name.has_value()) ||
          (function.internal.bucket_name.has_value() && function.internal.scope_name.has_value() &&
           function.internal.bucket_name.value() == "*" &&
           function.internal.scope_name.value() == "*");
      }
      if (include) {
        filtered_functions.push_back(function);
      }
    }
    response.status.functions = std::move(filtered_functions);
  }
  return response;
}
} // namespace couchbase::core::operations::management
