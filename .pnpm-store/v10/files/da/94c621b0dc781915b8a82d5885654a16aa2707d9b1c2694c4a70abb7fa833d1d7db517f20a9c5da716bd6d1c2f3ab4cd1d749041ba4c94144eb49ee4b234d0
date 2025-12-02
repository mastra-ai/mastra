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

#include "bucket_describe.hxx"

#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

#include <algorithm>
#include <cstdint>

namespace couchbase::core::operations::management
{
auto
bucket_describe_request::encode_to(encoded_request_type& encoded,
                                   http_context& /* context */) const -> std::error_code
{
  encoded.method = "GET";
  encoded.path = fmt::format("/pools/default/b/{}", utils::string_codec::v2::path_escape(name));
  return {};
}

auto
normalize_capability(const std::string& capability) -> std::string
{
  std::string normalized;
  normalized.reserve(capability.size());
  for (auto ch : capability) {
    if (ch != '_') {
      normalized.push_back(static_cast<char>(std::tolower(ch)));
    }
  }
  return normalized;
}

auto
bucket_describe_request::make_response(error_context::http&& ctx,
                                       const encoded_response_type& encoded) const
  -> bucket_describe_response
{
  bucket_describe_response response{ std::move(ctx) };
  if (!response.ctx.ec && encoded.status_code != 200) {
    response.ctx.ec = extract_common_error_code(encoded.status_code, encoded.body.data());
  }
  if (response.ctx.ec) {
    return response;
  }
  response.info.config_json = encoded.body.data();

  auto payload = utils::json::parse(response.info.config_json);

  response.info.name = payload.at("name").get_string();
  response.info.uuid = payload.at("uuid").get_string();
  if (const auto* nodes_ext = payload.find("nodesExt");
      nodes_ext != nullptr && nodes_ext->is_array()) {
    response.info.number_of_nodes = nodes_ext->get_array().size();
  }
  std::vector<std::vector<std::int32_t>> vbucket_map{};
  if (const auto* vbs_map = payload.find("vBucketServerMap");
      vbs_map != nullptr && vbs_map->is_object()) {
    if (const auto* num_replicas = vbs_map->find("numReplicas");
        num_replicas != nullptr && num_replicas->is_number()) {
      response.info.number_of_replicas = num_replicas->get_unsigned();
    }
    if (const auto* map = vbs_map->find("vBucketMap"); map != nullptr && map->is_array()) {
      for (const auto& vb : map->get_array()) {
        std::vector<std::int32_t> vbucket;
        for (const auto& v : vb.get_array()) {
          vbucket.emplace_back(v.as<std::int32_t>());
        }
        vbucket_map.emplace_back(vbucket);
      }
    }
  }
  if (const auto* nodes = payload.find("nodesExt"); nodes != nullptr && nodes->is_array()) {
    std::size_t server_index = 0;
    for (const auto& node : nodes->get_array()) {
      if (const auto* server_group_name = node.find("serverGroup");
          server_group_name != nullptr && server_group_name->is_string()) {
        const std::string group_name = server_group_name->get_string();
        auto& group = response.info.server_groups[group_name];
        group.name = group_name;
        server_node server;
        server.server_index = server_index;
        server.server_group_name = group_name;
        if (const auto* hostname = node.find("hostname");
            hostname != nullptr && hostname->is_string()) {
          server.default_network.hostname = hostname->get_string();
        }
        if (const auto* services = node.find("services");
            services != nullptr && services->is_object()) {
          server.default_network.kv_plain =
            services->template optional<std::uint16_t>("kv").value_or(0);
          server.default_network.kv_tls =
            services->template optional<std::uint16_t>("kvSSL").value_or(0);
        }
        if (const auto* alt = node.find("alternateAddresses"); alt != nullptr && alt->is_object()) {
          if (const auto* external = alt->find("external");
              external != nullptr && external->is_object()) {
            if (const auto* hostname = external->find("hostname");
                hostname != nullptr && hostname->is_string()) {
              server.external_network.hostname = hostname->get_string();
              if (const auto* services = external->find("ports");
                  services != nullptr && services->is_object()) {
                server.external_network.kv_plain =
                  services->template optional<std::uint16_t>("kv").value_or(0);
                server.external_network.kv_tls =
                  services->template optional<std::uint16_t>("kvSSL").value_or(0);
              }
            }
          }
        }

        for (std::size_t vbid = 0; vbid < vbucket_map.size(); ++vbid) {
          for (std::size_t idx = 0; idx < vbucket_map[vbid].size(); ++idx) {
            if (vbucket_map[vbid][idx] == static_cast<std::int32_t>(server_index)) {
              if (idx == 0) {
                server.active_vbuckets.insert(static_cast<std::uint16_t>(vbid));
              } else {
                server.replica_vbuckets.insert(static_cast<std::uint16_t>(vbid));
              }
            }
          }
        }
        group.nodes.emplace_back(server);
        ++server_index;
      }
    }
  }

  if (const auto* storage_backend = payload.find("storageBackend");
      storage_backend != nullptr && storage_backend->is_string()) {
    if (const auto& str = storage_backend->get_string(); str == "couchstore") {
      response.info.storage_backend =
        couchbase::core::management::cluster::bucket_storage_backend::couchstore;
    } else if (str == "magma") {
      response.info.storage_backend =
        couchbase::core::management::cluster::bucket_storage_backend::magma;
    }
  }

  if (const auto* bucket_caps = payload.find("bucketCapabilities");
      bucket_caps != nullptr && bucket_caps->is_array()) {
    for (const auto& cap : bucket_caps->get_array()) {
      if (cap.is_string()) {
        response.info.bucket_capabilities.emplace_back(normalize_capability(cap.get_string()));
      }
    }
  }

  return response;
}

auto
bucket_describe_response::bucket_info::has_capability(const std::string& capability) const -> bool
{
  return std::any_of(
    bucket_capabilities.begin(), bucket_capabilities.end(), [&capability](const auto& cap) {
      return cap == normalize_capability(capability);
    });
}
} // namespace couchbase::core::operations::management
