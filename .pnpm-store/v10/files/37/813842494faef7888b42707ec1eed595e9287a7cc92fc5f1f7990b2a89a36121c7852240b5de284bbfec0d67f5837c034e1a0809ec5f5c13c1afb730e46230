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

#include "analytics_index_create.hxx"

#include "core/utils/join_strings.hxx"
#include "core/utils/json.hxx"
#include "core/utils/name_codec.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
analytics_index_create_request::encode_to(encoded_request_type& encoded,
                                          http_context& /* context */) const -> std::error_code
{
  std::string if_not_exists_clause = ignore_if_exists ? "IF NOT EXISTS" : "";
  std::vector<std::string> field_specs;
  field_specs.reserve(fields.size());
  for (const auto& [field_name, field_type] : fields) {
    field_specs.emplace_back(fmt::format("{}:{}", field_name, field_type));
  }

  const tao::json::value body{
    { "statement",
      fmt::format("CREATE INDEX `{}` {} ON {}.`{}` ({})",
                  index_name,
                  if_not_exists_clause,
                  utils::analytics::uncompound_name(dataverse_name),
                  dataset_name,
                  utils::join_strings(field_specs, ",")) },
  };
  encoded.headers["content-type"] = "application/json";
  encoded.method = "POST";
  encoded.path = "/analytics/service";
  encoded.body = utils::json::generate(body);
  return {};
}

auto
analytics_index_create_request::make_response(error_context::http&& ctx,
                                              const encoded_response_type& encoded) const
  -> analytics_index_create_response
{
  analytics_index_create_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    tao::json::value payload{};
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      response.ctx.ec = errc::common::parsing_failure;
      return response;
    }
    response.status = payload.optional<std::string>("status").value_or("unknown");

    if (response.status != "success") {
      bool index_exists = false;
      bool dataset_not_found = false;
      bool link_not_found = false;

      if (auto* errors = payload.find("errors"); errors != nullptr && errors->is_array()) {
        for (const auto& error : errors->get_array()) {
          const analytics_problem err{
            error.at("code").as<std::uint32_t>(),
            error.at("msg").get_string(),
          };
          switch (err.code) {
            case 24048: /* An index with this name [string] already exists */
              index_exists = true;
              break;
            case 24025: /* Cannot find dataset with name [string] in dataverse [string] */
              dataset_not_found = true;
              break;
            case 24006: /* Link [string] does not exist */
              link_not_found = true;
              break;
            default:
              break;
          }
          response.errors.emplace_back(err);
        }
      }
      if (index_exists) {
        response.ctx.ec = errc::common::index_exists;
      } else if (dataset_not_found) {
        response.ctx.ec = errc::analytics::dataset_not_found;
      } else if (link_not_found) {
        response.ctx.ec = errc::analytics::link_not_found;
      } else {
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
      }
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
