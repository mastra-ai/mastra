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

#pragma once

#include "core/error_context/http.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/management/bucket_settings.hxx"
#include "core/platform/uuid.h"
#include "core/timeout_defaults.hxx"

namespace couchbase::core::operations::management
{
struct server_node_address {
  std::string hostname{};
  std::uint16_t kv_plain{};
  std::uint16_t kv_tls{};
};

struct server_node {
  std::string server_group_name{};
  std::size_t server_index{};
  server_node_address default_network{};
  server_node_address external_network{};
  std::set<std::uint16_t> active_vbuckets{};
  std::set<std::uint16_t> replica_vbuckets{};
};

struct server_group {
  std::string name{};
  std::vector<server_node> nodes{};
};

struct bucket_describe_response {
  struct bucket_info {
    std::string name{};
    std::string uuid{};
    std::size_t number_of_nodes{ 0 };
    std::size_t number_of_replicas{ 0 };
    std::vector<std::string> bucket_capabilities{};
    std::map<std::string, server_group> server_groups{};

    couchbase::core::management::cluster::bucket_storage_backend storage_backend{
      couchbase::core::management::cluster::bucket_storage_backend::unknown
    };
    std::string config_json{};

    [[nodiscard]] auto has_capability(const std::string& capability) const -> bool;
  };

  error_context::http ctx;
  bucket_info info{};
};

struct bucket_describe_request {
  using response_type = bucket_describe_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::http;

  std::string name;

  static const inline service_type type = service_type::management;
  static const inline std::string observability_identifier = "manager_buckets_describe_bucket";

  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  [[nodiscard]] std::error_code encode_to(encoded_request_type& encoded,
                                          http_context& context) const;

  [[nodiscard]] bucket_describe_response make_response(error_context::http&& ctx,
                                                       const encoded_response_type& encoded) const;
};
} // namespace couchbase::core::operations::management
