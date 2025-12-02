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

#include "analytics_link_get_all.hxx"

#include "core/management/analytics_link_azure_blob_external_json.hxx"
#include "core/management/analytics_link_couchbase_remote_json.hxx"
#include "core/management/analytics_link_s3_external_json.hxx"
#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
analytics_link_get_all_request::encode_to(encoded_request_type& encoded,
                                          http_context& /* context */) const -> std::error_code
{
  std::map<std::string, std::string> values{};

  encoded.headers["content-type"] = "application/x-www-form-urlencoded";
  encoded.headers["accept"] = "application/json";
  encoded.method = "GET";
  if (link_type.has_value() && !link_type.value().empty()) {
    values["type"] = link_type.value();
  }
  if ((link_name.has_value() && !link_name.value().empty()) &&
      (!dataverse_name.has_value() || dataverse_name.value().empty())) {
    return couchbase::errc::common::invalid_argument;
  }

  if (dataverse_name.has_value() && !dataverse_name.value().empty()) {
    if (std::count(dataverse_name.value().begin(), dataverse_name.value().end(), '/') == 0) {
      values["dataverse"] = dataverse_name.value();
      if (link_name.has_value() && !link_name.value().empty()) {
        values["name"] = link_name.value();
      }
      encoded.path = "/analytics/link";
    } else {
      if (!link_name.has_value() || link_name.value().empty()) {
        encoded.path = fmt::format("/analytics/link/{}",
                                   utils::string_codec::v2::path_escape(dataverse_name.value()));
      } else {
        encoded.path = fmt::format("/analytics/link/{}/{}",
                                   utils::string_codec::v2::path_escape(dataverse_name.value()),
                                   link_name.value());
      }
    }
  } else {
    encoded.path = "/analytics/link";
  }
  if (!values.empty()) {
    encoded.path.append(fmt::format("?{}", utils::string_codec::v2::form_encode(values)));
  }
  return {};
}

auto
analytics_link_get_all_request::make_response(error_context::http&& ctx,
                                              const encoded_response_type& encoded) const
  -> analytics_link_get_all_response
{
  analytics_link_get_all_response response{ std::move(ctx) };
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
      response.errors.emplace_back(analytics_link_get_all_response::problem{ code, msg });
    }
    if (payload.is_object()) {
      response.status = payload.optional<std::string>("status").value_or("unknown");
      if (response.status != "success") {
        if (auto* errors = payload.find("errors"); errors != nullptr && errors->is_array()) {
          for (const auto& error : errors->get_array()) {
            const analytics_link_get_all_response::problem err{
              error.at("code").as<std::uint32_t>(),
              error.at("msg").get_string(),
            };
            response.errors.emplace_back(err);
          }
        }
      }
    } else if (payload.is_array()) {
      for (const auto& link : payload.get_array()) {
        if (const std::string& type_ = link.at("type").get_string(); type_ == "couchbase") {
          response.couchbase.emplace_back(
            link.as<couchbase::core::management::analytics::couchbase_remote_link>());
        } else if (type_ == "s3") {
          response.s3.emplace_back(
            link.as<couchbase::core::management::analytics::s3_external_link>());
        } else if (type_ == "azureblob") {
          response.azure_blob.emplace_back(
            link.as<couchbase::core::management::analytics::azure_blob_external_link>());
        }
      }
    }
    bool link_not_found = false;
    bool dataverse_does_not_exist = false;
    for (const auto& err : response.errors) {
      switch (err.code) {
        case 24006: /* Link [string] does not exist */
          link_not_found = true;
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
    } else if (link_not_found) {
      response.ctx.ec = errc::analytics::link_not_found;
    } else if (response.ctx.http_status != 200) {
      response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
