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

#include "view_index_upsert.hxx"

#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
view_index_upsert_request::encode_to(encoded_request_type& encoded,
                                     http_context& /* context */) const -> std::error_code
{
  tao::json::value body;
  body["views"] = tao::json::empty_object;
  for (const auto& [name, view] : document.views) {
    tao::json::value view_def;
    if (view.map) {
      view_def["map"] = *view.map;
    }
    if (view.reduce) {
      view_def["reduce"] = *view.reduce;
    }
    body["views"][name] = view_def;
  }

  encoded.headers["content-type"] = "application/json";
  encoded.method = "PUT";
  encoded.path = fmt::format("/{}/_design/{}{}",
                             utils::string_codec::v2::path_escape(bucket_name),
                             document.ns == design_document_namespace::development ? "dev_" : "",
                             document.name);
  encoded.body = utils::json::generate(body);
  return {};
}

auto
view_index_upsert_request::make_response(error_context::http&& ctx,
                                         const encoded_response_type& encoded) const
  -> view_index_upsert_response
{
  view_index_upsert_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    switch (encoded.status_code) {
      case 200:
      case 201:
        break;
      case 400:
        response.ctx.ec = errc::common::invalid_argument;
        break;
      case 404:
        response.ctx.ec = errc::view::design_document_not_found;
        break;
      default:
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
