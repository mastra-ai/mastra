/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "app_telemetry_address.hxx"

#include "topology/configuration.hxx"

#include <algorithm>
#include <random>

namespace couchbase::core
{
auto
get_app_telemetry_addresses(const topology::configuration& config,
                            bool use_tls,
                            const std::string& network) -> std::vector<app_telemetry_address>
{
  std::vector<app_telemetry_address> addresses;
  addresses.reserve(config.nodes.size());
  for (const auto& node : config.nodes) {
    if (auto app_telemetry_path = node.app_telemetry_path; app_telemetry_path) {
      auto node_uuid = node.node_uuid;
      if (node_uuid.empty()) {
        continue;
      }

      if (auto port = node.port_or(network, service_type::management, use_tls, 0); port != 0) {
        addresses.push_back({
          node.hostname_for(network),
          std::to_string(port),
          app_telemetry_path.value(),
          node_uuid,
        });
      }
    }
  }

  static thread_local std::default_random_engine gen{ std::random_device{}() };
  std::shuffle(addresses.begin(), addresses.end(), gen);
  return addresses;
}

} // namespace couchbase::core
