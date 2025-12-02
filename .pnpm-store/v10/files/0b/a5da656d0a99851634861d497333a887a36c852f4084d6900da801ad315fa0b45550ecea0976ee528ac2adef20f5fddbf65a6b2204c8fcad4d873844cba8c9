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

#include "eventing_pause_function.hxx"

#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
eventing_pause_function_request::encode_to(encoded_request_type& encoded,
                                           http_context& /* context */) const -> std::error_code
{
  encoded.method = "POST";
  encoded.path = fmt::format("/api/v1/functions/{}/pause", name);
  if (bucket_name.has_value() && scope_name.has_value()) {
    encoded.path += fmt::format("?bucket={}&scope={}",
                                utils::string_codec::v2::path_escape(bucket_name.value()),
                                utils::string_codec::v2::path_escape(scope_name.value()));
  }
  return {};
}

auto
eventing_pause_function_request::make_response(error_context::http&& ctx,
                                               const encoded_response_type& encoded) const
  -> eventing_pause_function_response
{
  eventing_pause_function_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.body.data().empty()) {
      return response;
    }
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
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
