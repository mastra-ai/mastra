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

#include "query_index_get_all.hxx"

#include "core/utils/json.hxx"
#include "error_utils.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::operations::management
{
auto
query_index_get_all_request::encode_to(encoded_request_type& encoded,
                                       couchbase::core::http_context& /* context */) const
  -> std::error_code
{
  const std::string bucket_cond = "bucket_id = $bucket_name";
  const std::string scope_cond = "(" + bucket_cond + " AND scope_id = $scope_name)";
  const std::string collection_cond = "(" + scope_cond + " AND keyspace_id = $collection_name)";

  std::string where;
  if (!collection_name.empty()) {
    where = collection_cond;
  } else if (!scope_name.empty()) {
    where = scope_cond;
  } else {
    where = bucket_cond;
  }

  if (collection_name == "_default" || collection_name.empty()) {
    const std::string default_collection_cond =
      "(bucket_id IS MISSING AND keyspace_id = $bucket_name)";
    where = "(" + where + " OR " + default_collection_cond + ")";
  }

  std::string statement = "SELECT `idx`.* FROM system:indexes AS idx"
                          " WHERE " +
                          where +
                          " AND `using` = \"gsi\""
                          " ORDER BY is_primary DESC, name ASC";

  encoded.headers["content-type"] = "application/json";
  tao::json::value body{
    { "statement", statement },
    { "client_context_id", encoded.client_context_id },
    { "$bucket_name", query_ctx.has_value() ? query_ctx.bucket_name() : bucket_name },
    { "$scope_name", query_ctx.has_value() ? query_ctx.scope_name() : scope_name },
    { "$collection_name", collection_name }
  };

  if (query_ctx.has_value()) {
    body["query_context"] = query_ctx.value();
  }
  encoded.method = "POST";
  encoded.path = "/query/service";
  encoded.body = utils::json::generate(body);
  return {};
}

auto
query_index_get_all_request::make_response(couchbase::core::error_context::http&& ctx,
                                           const encoded_response_type& encoded) const
  -> query_index_get_all_response
{
  query_index_get_all_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.status_code != 200) {
      response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
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
    if (response.status != "success") {
      return response;
    }
    if (encoded.body.data().find("insufficient user permissions") != std::string::npos) {
      response.ctx.ec = couchbase::errc::common::authentication_failure;
      return response;
    }
    for (const auto& entry : payload.at("results").get_array()) {
      couchbase::management::query_index index;
      index.type = entry.at("using").get_string();
      index.name = entry.at("name").get_string();
      index.state = entry.at("state").get_string();
      if (const auto* prop = entry.find("is_primary")) {
        index.is_primary = prop->get_boolean();
      }
      if (const auto* prop = entry.find("condition")) {
        index.condition = prop->get_string();
      }
      if (const auto* prop = entry.find("partition")) {
        index.partition = prop->get_string();
      }
      for (const auto& key : entry.at("index_key").get_array()) {
        index.index_key.emplace_back(key.get_string());
      }

      std::string bucket_id;
      std::string scope_id;
      std::string keyspace_id;
      if (const auto* prop = entry.find("bucket_id")) {
        bucket_id = prop->get_string();
      }
      if (const auto* prop = entry.find("scope_id")) {
        scope_id = prop->get_string();
      }
      if (const auto* prop = entry.find("keyspace_id")) {
        keyspace_id = prop->get_string();
      }
      if (bucket_id.empty()) {
        index.bucket_name = keyspace_id;
      } else {
        index.bucket_name = bucket_id;
        index.scope_name = scope_id;
        index.collection_name = keyspace_id;
      }

      response.indexes.emplace_back(index);
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
