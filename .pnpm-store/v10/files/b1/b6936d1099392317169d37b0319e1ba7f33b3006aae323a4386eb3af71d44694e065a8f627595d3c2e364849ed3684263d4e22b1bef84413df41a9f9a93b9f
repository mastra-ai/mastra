/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include "document_view.hxx"

#include "core/utils/join_strings.hxx"
#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"

#include <couchbase/error_codes.hxx>

#include <tao/json/value.hpp>

namespace couchbase::core::operations
{
auto
document_view_request::encode_to(document_view_request::encoded_request_type& encoded,
                                 http_context& /* context */) -> std::error_code
{
  if (debug) {
    query_string.emplace_back("debug=true");
  }
  if (limit) {
    query_string.emplace_back(fmt::format("limit={}", *limit));
  }
  if (skip) {
    query_string.emplace_back(fmt::format("skip={}", *skip));
  }
  if (consistency) {
    switch (*consistency) {
      case couchbase::core::view_scan_consistency::not_bounded:
        query_string.emplace_back("stale=ok");
        break;
      case couchbase::core::view_scan_consistency::update_after:
        query_string.emplace_back("stale=update_after");
        break;
      case couchbase::core::view_scan_consistency::request_plus:
        query_string.emplace_back("stale=false");
        break;
    }
  }
  if (key) {
    query_string.emplace_back(fmt::format("key={}", utils::string_codec::form_encode(*key)));
  }
  if (start_key) {
    query_string.emplace_back(
      fmt::format("start_key={}", utils::string_codec::form_encode(*start_key)));
  }
  if (end_key) {
    query_string.emplace_back(
      fmt::format("end_key={}", utils::string_codec::form_encode(*end_key)));
  }
  if (start_key_doc_id) {
    query_string.emplace_back(
      fmt::format("start_key_doc_id={}", utils::string_codec::form_encode(*start_key_doc_id)));
  }
  if (end_key_doc_id) {
    query_string.emplace_back(
      fmt::format("end_key_doc_id={}", utils::string_codec::form_encode(*end_key_doc_id)));
  }
  if (inclusive_end) {
    query_string.emplace_back(
      fmt::format("inclusive_end={}", inclusive_end.value() ? "true" : "false"));
  }
  if (reduce) {
    query_string.emplace_back(fmt::format("reduce={}", reduce.value() ? "true" : "false"));
  }
  if (group) {
    query_string.emplace_back(fmt::format("group={}", group.value() ? "true" : "false"));
  }
  if (group_level) {
    query_string.emplace_back(fmt::format("group_level={}", *group_level));
  }
  if (full_set) {
    query_string.emplace_back(fmt::format("full_set={}", full_set.value() ? "true" : "false"));
  }
  if (order) {
    switch (*order) {
      case couchbase::core::view_sort_order::descending:
        query_string.emplace_back("descending=true");
        break;
      case couchbase::core::view_sort_order::ascending:
        query_string.emplace_back("descending=false");
        break;
    }
  }
  if (on_error) {
    switch (*on_error) {
      case couchbase::core::view_on_error::resume:
        query_string.emplace_back("on_error=continue");
        break;
      case couchbase::core::view_on_error::stop:
        query_string.emplace_back("on_error=stop");
        break;
    }
  }

  tao::json::value body = tao::json::empty_object;
  if (!keys.empty()) {
    tao::json::value keys_array = tao::json::empty_array;
    for (const auto& entry : keys) {
      keys_array.push_back(utils::json::parse(entry));
    }
    body["keys"] = keys_array;
  }
  for (const auto& [name, value] : raw) {
    query_string.emplace_back(fmt::format("{}={}", name, value));
  }

  encoded.type = type;
  encoded.method = "POST";
  encoded.headers["content-type"] = "application/json";
  encoded.path = fmt::format("/{}/_design/{}{}/_view/{}?{}",
                             bucket_name,
                             ns == design_document_namespace::development ? "dev_" : "",
                             document_name,
                             view_name,
                             utils::join_strings(query_string, "&"));
  encoded.body = utils::json::generate(body);
  if (row_callback) {
    encoded.streaming.emplace(couchbase::core::io::streaming_settings{
      "/rows/^",
      4,
      std::move(row_callback.value()),
    });
  }
  return {};
}

auto
document_view_request::make_response(error_context::view&& ctx,
                                     const encoded_response_type& encoded) const
  -> document_view_response
{
  document_view_response response{ std::move(ctx) };
  response.ctx.design_document_name = document_name;
  response.ctx.view_name = view_name;
  response.ctx.query_string = query_string;
  if (!response.ctx.ec) {
    if (encoded.status_code == 200) {
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }

      if (const auto* total_rows = payload.find("total_rows");
          total_rows != nullptr && total_rows->is_unsigned()) {
        response.meta.total_rows = total_rows->get_unsigned();
      }

      if (const auto* debug_info = payload.find("debug_info");
          debug_info != nullptr && debug_info->is_object()) {
        response.meta.debug_info.emplace(utils::json::generate(*debug_info));
      }

      if (const auto* rows = payload.find("rows"); rows != nullptr && rows->is_array()) {
        for (const auto& entry : rows->get_array()) {
          document_view_response::row row{};

          if (const auto* id = entry.find("id"); id != nullptr && id->is_string()) {
            row.id = id->get_string();
          }
          row.key = utils::json::generate(entry.at("key"));
          row.value = utils::json::generate(entry.at("value"));
          response.rows.emplace_back(row);
        }
      }
    } else if (encoded.status_code == 400) {
      tao::json::value payload{};
      try {
        payload = utils::json::parse(encoded.body.data());
      } catch (const tao::pegtl::parse_error&) {
        response.ctx.ec = errc::common::parsing_failure;
        return response;
      }
      document_view_response::problem problem{};

      if (const auto* error = payload.find("error"); error != nullptr && error->is_string()) {
        problem.code = error->get_string();
      }

      if (const auto* reason = payload.find("reason"); reason != nullptr && reason->is_string()) {
        problem.message = reason->get_string();
      }
      response.error.emplace(problem);
      response.ctx.ec = errc::common::invalid_argument;
    } else if (encoded.status_code == 404) {
      response.ctx.ec = errc::view::design_document_not_found;
    } else {
      response.ctx.ec = errc::common::internal_server_failure;
    }
  }
  return response;
}
} // namespace couchbase::core::operations
