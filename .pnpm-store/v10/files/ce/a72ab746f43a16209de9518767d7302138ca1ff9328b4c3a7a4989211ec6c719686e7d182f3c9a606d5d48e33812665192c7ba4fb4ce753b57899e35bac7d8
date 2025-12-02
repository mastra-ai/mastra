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

#pragma once

#include "capabilities.hxx"
#include "core/platform/uuid.h"
#include "core/service_type.hxx"

#include <map>
#include <optional>
#include <set>
#include <string>
#include <vector>

namespace couchbase::core::topology
{
struct configuration {
  enum class node_locator_type {
    unknown,
    vbucket,
    ketama,
  };

  struct port_map {
    std::optional<std::uint16_t> key_value{};
    std::optional<std::uint16_t> management{};
    std::optional<std::uint16_t> analytics{};
    std::optional<std::uint16_t> search{};
    std::optional<std::uint16_t> views{};
    std::optional<std::uint16_t> query{};
    std::optional<std::uint16_t> eventing{};
  };

  struct alternate_address {
    std::string name{};
    std::string hostname{};
    port_map services_plain{};
    port_map services_tls{};
  };

  struct node {
    bool this_node{ false };
    size_t index{};
    std::string hostname{};
    port_map services_plain{};
    port_map services_tls{};
    std::map<std::string, alternate_address> alt{};
    std::string server_group{};
    std::optional<std::string> app_telemetry_path{};
    std::string node_uuid{};

    auto operator!=(const node& other) const -> bool
    {
      return hostname != other.hostname ||
             services_plain.key_value != other.services_plain.key_value ||
             services_tls.key_value != other.services_tls.key_value;
    }

    [[nodiscard]] auto port_or(service_type type, bool is_tls, std::uint16_t default_value) const
      -> std::uint16_t;

    [[nodiscard]] auto port_or(const std::string& network,
                               service_type type,
                               bool is_tls,
                               std::uint16_t default_value) const -> std::uint16_t;

    [[nodiscard]] auto hostname_for(const std::string& network) const -> const std::string&;

    [[nodiscard]] auto endpoint(const std::string& network, service_type type, bool is_tls) const
      -> std::optional<std::string>;
  };

  [[nodiscard]] auto select_network(const std::string& bootstrap_hostname) const -> std::string;

  using vbucket_map = typename std::vector<std::vector<std::int16_t>>;

  std::optional<std::int64_t> epoch{};
  std::optional<std::int64_t> rev{};
  couchbase::core::uuid::uuid_t id{};
  std::optional<std::uint32_t> num_replicas{};
  std::vector<node> nodes{};
  std::optional<std::string> uuid{};
  std::optional<std::string> bucket{};
  std::optional<vbucket_map> vbmap{};
  std::optional<std::uint64_t> collections_manifest_uid{};
  configuration_capabilities capabilities{};
  node_locator_type node_locator{ node_locator_type::unknown };
  std::optional<std::string> cluster_name{};
  std::optional<std::string> cluster_uuid{};
  std::optional<std::string> prod{};
  bool force{ false };

  auto operator==(const configuration& other) const -> bool
  {
    return epoch == other.epoch && rev == other.rev;
  }

  auto operator<(const configuration& other) const -> bool
  {
    return epoch < other.epoch || (epoch == other.epoch && rev < other.rev);
  }

  auto operator>(const configuration& other) const -> bool
  {
    return other < *this;
  }

  [[nodiscard]] auto rev_str() const -> std::string;

  [[nodiscard]] auto index_for_this_node() const -> std::size_t;
  [[nodiscard]] auto has_node(const std::string& network,
                              service_type type,
                              bool is_tls,
                              const std::string& hostname,
                              const std::string& port) const -> bool;

  auto map_key(const std::string& key, std::size_t index) const
    -> std::pair<std::uint16_t, std::optional<std::size_t>>;
  auto map_key(const std::vector<std::byte>& key, std::size_t index) const
    -> std::pair<std::uint16_t, std::optional<std::size_t>>;

  auto server_by_vbucket(std::uint16_t vbucket, std::size_t index) const
    -> std::optional<std::size_t>;
};

using endpoint = std::pair<std::string, std::string>;

auto
make_blank_configuration(const std::string& hostname,
                         std::uint16_t plain_port,
                         std::uint16_t tls_port) -> configuration;

auto
make_blank_configuration(const std::vector<endpoint>& endpoints, bool use_tls, bool force = false)
  -> configuration;
} // namespace couchbase::core::topology
