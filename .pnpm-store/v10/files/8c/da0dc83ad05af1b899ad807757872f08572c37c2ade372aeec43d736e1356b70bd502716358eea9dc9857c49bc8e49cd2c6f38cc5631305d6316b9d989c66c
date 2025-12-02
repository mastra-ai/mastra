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

#include "search_index_analyze_document.hxx"

#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
search_index_analyze_document_request::encode_to(encoded_request_type& encoded,
                                                 http_context& /* context */) const
  -> std::error_code
{
  if (index_name.empty()) {
    return errc::common::invalid_argument;
  }
  encoded.method = "POST";
  encoded.headers["cache-control"] = "no-cache";
  encoded.headers["content-type"] = "application/json";
  if (bucket_name.has_value() && scope_name.has_value()) {
    encoded.path = fmt::format("/api/bucket/{}/scope/{}/index/{}/analyzeDoc",
                               utils::string_codec::v2::path_escape(bucket_name.value()),
                               utils::string_codec::v2::path_escape(scope_name.value()),
                               index_name);
  } else {
    encoded.path = fmt::format("/api/index/{}/analyzeDoc", index_name);
  }
  encoded.body = encoded_document;
  return {};
}

auto
search_index_analyze_document_request::make_response(error_context::http&& ctx,
                                                     const encoded_response_type& encoded) const
  -> search_index_analyze_document_response
{
  search_index_analyze_document_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.status_code == 200) {
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      response.status = payload.at("status").get_string();
      if (response.status == "ok") {
        response.analysis = utils::json::generate(payload.at("analyzed"));
        return response;
      }
    } else if (encoded.status_code == 400) {
      if (encoded.body.data().find("no indexName:") != std::string::npos) {
        response.ctx.ec = errc::common::index_not_found;
        return response;
      }
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      response.status = payload.at("status").get_string();
      response.error = payload.at("error").get_string();
      if (response.error.find("index not found") != std::string::npos) {
        response.ctx.ec = errc::common::index_not_found;
        return response;
      }
      if (response.error.find("index with the same name already exists") != std::string::npos) {
        response.ctx.ec = errc::common::index_exists;
        return response;
      }
    } else if (encoded.status_code == 404) {
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      response.status = payload.at("status").get_string();
      response.error = payload.at("error").get_string();
      response.ctx.ec = errc::common::feature_not_available;
      return response;
    }
    response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
  }
  return response;
}
} // namespace couchbase::core::operations::management
