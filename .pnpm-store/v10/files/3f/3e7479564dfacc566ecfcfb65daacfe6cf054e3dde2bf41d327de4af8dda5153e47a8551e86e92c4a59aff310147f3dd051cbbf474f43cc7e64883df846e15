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

#include "query_index_drop.hxx"

#include "core/utils/json.hxx"
#include "core/utils/keyspace.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

#include <regex>

namespace couchbase::core::operations::management
{
auto
query_index_drop_request::encode_to(encoded_request_type& encoded,
                                    http_context& /*context*/) const -> std::error_code
{
  if (!utils::check_query_management_request(*this)) {
    return errc::common::invalid_argument;
  }
  encoded.headers["content-type"] = "application/json";
  auto keyspace = utils::build_keyspace(*this);
  std::string drop_index_stmt;
  if (is_primary && index_name.empty()) {
    drop_index_stmt = fmt::format(R"(DROP PRIMARY INDEX ON {} USING GSI)", keyspace);
  } else if (bucket_name.empty() || (!collection_name.empty() && !scope_name.empty())) {
    drop_index_stmt = fmt::format(R"(DROP INDEX `{}` ON {} USING GSI)", index_name, keyspace);
  } else {
    // this works on 6.6 and earlier
    drop_index_stmt = fmt::format(R"(DROP INDEX `{}`.`{}` USING GSI)", bucket_name, index_name);
  }

  tao::json::value body{ { "statement", drop_index_stmt },
                         { "client_context_id", encoded.client_context_id } };
  if (query_ctx.has_value()) {
    body["query_context"] = query_ctx.value();
  }
  encoded.method = "POST";
  encoded.path = "/query/service";
  encoded.body = utils::json::generate(body);
  return {};
}

auto
query_index_drop_request::make_response(error_context::http&& ctx,
                                        const encoded_response_type& encoded) const
  -> query_index_drop_response
{
  query_index_drop_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    tao::json::value payload{};
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      response.ctx.ec = errc::common::parsing_failure;
      return response;
    }
    response.status = payload.at("status").get_string();

    if (response.status != "success") {
      bool bucket_not_found = false;
      bool index_not_found = false;
      bool collection_not_found = false;
      bool scope_not_found = false;
      bool authentication_failure = false;
      std::optional<std::error_code> common_ec{};
      for (const auto& entry : payload.at("errors").get_array()) {
        query_index_drop_response::query_problem error;
        error.code = entry.at("code").get_unsigned();
        error.message = entry.at("msg").get_string();
        switch (error.code) {
          case 5000: /* IKey: "Internal Error" */
            if (std::regex_search(error.message, std::regex{ ".*[iI]ndex .*[nN]ot [fF]ound.*" })) {
              index_not_found = true;
            }
            break;

          case 12003: /* IKey: "datastore.couchbase.keyspace_not_found" */
            if (error.message.find("missing_collection") != std::string::npos) {
              collection_not_found = true;
            } else {
              bucket_not_found = true;
            }
            break;

          case 12021:
            scope_not_found = true;
            break;

          case 12004: /* IKey: "datastore.couchbase.primary_idx_not_found" */
          case 12016: /* IKey: "datastore.couchbase.index_not_found" */
            index_not_found = true;
            break;

          case 13014:
            if (error.message.find("User does not have credentials") != std::string::npos) {
              authentication_failure = true;
            }
            break;

          default:
            common_ec = management::extract_common_query_error_code(error.code, error.message);
            break;
        }
        response.errors.emplace_back(error);
      }
      if (index_not_found) {
        if (!ignore_if_does_not_exist) {
          response.ctx.ec = errc::common::index_not_found;
        }
      } else if (bucket_not_found) {
        response.ctx.ec = errc::common::bucket_not_found;
      } else if (collection_not_found) {
        response.ctx.ec = errc::common::collection_not_found;
      } else if (scope_not_found) {
        response.ctx.ec = errc::common::scope_not_found;
      } else if (authentication_failure) {
        response.ctx.ec = errc::common::authentication_failure;
      } else if (common_ec) {
        response.ctx.ec = common_ec.value();
      } else if (!response.errors.empty()) {
        response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
      }
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
