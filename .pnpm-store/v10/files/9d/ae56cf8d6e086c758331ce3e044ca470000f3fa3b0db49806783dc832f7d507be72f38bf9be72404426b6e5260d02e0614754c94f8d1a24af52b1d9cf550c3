
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

#include "replica_utils.hxx"

#include "core/logger/logger.hxx"

namespace couchbase::core::impl
{

auto
effective_nodes(const document_id& id,
                const std::shared_ptr<topology::configuration>& config,
                const read_preference& preference,
                const std::string& preferred_server_group) -> std::vector<readable_node>
{
  if (preference == read_preference::selected_server_group && preferred_server_group.empty()) {
    CB_LOG_WARNING("Preferred server group is required for zone-aware replica reads");
    return {};
  }

  std::vector<readable_node> available_nodes{};
  std::vector<readable_node> local_nodes{};

  for (std::size_t idx = 0U; idx <= config->num_replicas.value_or(0U); ++idx) {
    auto [vbid, server] = config->map_key(id.key(), idx);
    if (server.has_value() && server.value() < config->nodes.size()) {
      const bool is_replica = idx != 0;
      available_nodes.emplace_back(readable_node{ is_replica, idx });
      if (preferred_server_group == config->nodes[server.value()].server_group) {
        local_nodes.emplace_back(readable_node{ is_replica, idx });
      }
    }
  }

  switch (preference) {
    case read_preference::no_preference:
      return available_nodes;

    case read_preference::selected_server_group:
      return local_nodes;

    case read_preference::selected_server_group_or_all_available:
      if (local_nodes.empty()) {
        return available_nodes;
      }
      return local_nodes;
  }
  return available_nodes;
}
} // namespace couchbase::core::impl
