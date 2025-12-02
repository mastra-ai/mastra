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

#include "configuration.hxx"

#include "core/logger/logger.hxx"
#include "core/service_type_fmt.hxx"
#include "core/utils/crc32.hxx"

#include <gsl/narrow>

#include <algorithm>
#include <stdexcept>

namespace couchbase::core::topology
{
auto
configuration::node::port_or(service_type type, bool is_tls, std::uint16_t default_value) const
  -> std::uint16_t
{
  if (is_tls) {
    switch (type) {
      case service_type::query:
        return services_tls.query.value_or(default_value);

      case service_type::analytics:
        return services_tls.analytics.value_or(default_value);

      case service_type::search:
        return services_tls.search.value_or(default_value);

      case service_type::view:
        return services_tls.views.value_or(default_value);

      case service_type::management:
        return services_tls.management.value_or(default_value);

      case service_type::key_value:
        return services_tls.key_value.value_or(default_value);

      case service_type::eventing:
        return services_tls.eventing.value_or(default_value);
    }
  }
  switch (type) {
    case service_type::query:
      return services_plain.query.value_or(default_value);

    case service_type::analytics:
      return services_plain.analytics.value_or(default_value);

    case service_type::search:
      return services_plain.search.value_or(default_value);

    case service_type::view:
      return services_plain.views.value_or(default_value);

    case service_type::management:
      return services_plain.management.value_or(default_value);

    case service_type::key_value:
      return services_plain.key_value.value_or(default_value);

    case service_type::eventing:
      return services_plain.eventing.value_or(default_value);
  }
  return default_value;
}

auto
configuration::node::hostname_for(const std::string& network) const -> const std::string&
{
  if (network == "default") {
    return hostname;
  }
  const auto& address = alt.find(network);
  if (address == alt.end()) {
    CB_LOG_DEBUG(R"(requested network "{}" is not found, fallback to "default" host)", network);
    return hostname;
  }
  return address->second.hostname;
}

auto
configuration::node::port_or(const std::string& network,
                             service_type type,
                             bool is_tls,
                             std::uint16_t default_value) const -> std::uint16_t
{
  if (network == "default") {
    return port_or(type, is_tls, default_value);
  }
  const auto& address = alt.find(network);
  if (address == alt.end()) {
    CB_LOG_DEBUG(R"(requested network "{}" is not found, fallback to "default" port of {} service)",
                 network,
                 type);
    return port_or(type, is_tls, default_value);
  }
  if (is_tls) {
    switch (type) {
      case service_type::query:
        return address->second.services_tls.query.value_or(default_value);

      case service_type::analytics:
        return address->second.services_tls.analytics.value_or(default_value);

      case service_type::search:
        return address->second.services_tls.search.value_or(default_value);

      case service_type::view:
        return address->second.services_tls.views.value_or(default_value);

      case service_type::management:
        return address->second.services_tls.management.value_or(default_value);

      case service_type::key_value:
        return address->second.services_tls.key_value.value_or(default_value);

      case service_type::eventing:
        return address->second.services_tls.eventing.value_or(default_value);
    }
  }
  switch (type) {
    case service_type::query:
      return address->second.services_plain.query.value_or(default_value);

    case service_type::analytics:
      return address->second.services_plain.analytics.value_or(default_value);

    case service_type::search:
      return address->second.services_plain.search.value_or(default_value);

    case service_type::view:
      return address->second.services_plain.views.value_or(default_value);

    case service_type::management:
      return address->second.services_plain.management.value_or(default_value);

    case service_type::key_value:
      return address->second.services_plain.key_value.value_or(default_value);

    case service_type::eventing:
      return address->second.services_plain.eventing.value_or(default_value);
  }
  return default_value;
}

auto
configuration::node::endpoint(const std::string& network, service_type type, bool is_tls) const
  -> std::optional<std::string>
{
  auto p = port_or(type, is_tls, 0);
  if (p == 0) {
    return {};
  }
  return fmt::format("{}:{}", hostname_for(network), p);
}

auto
configuration::has_node(const std::string& network,
                        service_type type,
                        bool is_tls,
                        const std::string& hostname,
                        const std::string& port) const -> bool
{
  std::uint16_t port_number{ 0 };
  try {
    port_number = gsl::narrow_cast<std::uint16_t>(std::stoul(port, nullptr, 10));
  } catch (const std::invalid_argument&) {
    return false;
  } catch (const std::out_of_range&) {
    return false;
  }
  return std::any_of(nodes.begin(), nodes.end(), [&](const auto& n) {
    return n.hostname_for(network) == hostname &&
           n.port_or(network, type, is_tls, 0) == port_number;
  });
}

namespace
{
struct evanescent_config {
  std::vector<std::pair<std::string, std::uint16_t>> kv_plain_endpoints;
  std::vector<std::pair<std::string, std::uint16_t>> kv_tls_endpoints;
  std::vector<std::pair<std::string, std::uint16_t>> mgmt_plain_endpoints;
  std::vector<std::pair<std::string, std::uint16_t>> mgmt_tls_endpoints;

  [[nodiscard]] auto is_valid() const -> bool
  {
    if (!kv_tls_endpoints.empty() && !mgmt_tls_endpoints.empty()) {
      return true;
    }
    if (!kv_plain_endpoints.empty() && !mgmt_plain_endpoints.empty()) {
      return true;
    }
    return false;
  }
};
} // namespace

auto
configuration::select_network(const std::string& bootstrap_hostname) const -> std::string
{
  evanescent_config alt_conf;

  for (const auto& n : nodes) {
    if (n.hostname == bootstrap_hostname) {
      return "default";
    }
    if (auto network = n.alt.find("external"); network != n.alt.end()) {
      if (network->second.hostname == bootstrap_hostname) {
        // we have a match with bootstrap host, external network is definitely usable
        return "external";
      }

      // try to build endpoints for temporary config
      if (auto port = n.services_plain.key_value; port) {
        alt_conf.kv_plain_endpoints.emplace_back(network->second.hostname, *port);
      }
      if (auto port = n.services_tls.key_value; port) {
        alt_conf.kv_tls_endpoints.emplace_back(network->second.hostname, *port);
      }
      if (auto port = n.services_plain.management; port) {
        alt_conf.mgmt_plain_endpoints.emplace_back(network->second.hostname, *port);
      }
      if (auto port = n.services_tls.management; port) {
        alt_conf.mgmt_tls_endpoints.emplace_back(network->second.hostname, *port);
      }
    }
  }

  // check if external network allow us to use the cluster regardless bootstrap_hostname
  if (alt_conf.is_valid()) {
    return "external";
  }

  return "default";
}

auto
configuration::rev_str() const -> std::string
{
  if (epoch) {
    return fmt::format("{}:{}", epoch.value(), rev.value_or(0));
  }
  return rev ? fmt::format("{}", *rev) : "(none)";
}

auto
configuration::index_for_this_node() const -> std::size_t
{
  for (const auto& n : nodes) {
    if (n.this_node) {
      return n.index;
    }
  }
  throw std::runtime_error("no nodes marked as this_node");
}

auto
configuration::server_by_vbucket(std::uint16_t vbucket, std::size_t index) const
  -> std::optional<std::size_t>
{
  if (!vbmap.has_value() || vbucket >= vbmap->size()) {
    return {};
  }
  if (auto server_index = vbmap->at(vbucket)[index]; server_index >= 0) {
    return static_cast<std::size_t>(server_index);
  }
  return {};
}

auto
configuration::map_key(const std::string& key, std::size_t index) const
  -> std::pair<std::uint16_t, std::optional<std::size_t>>
{
  if (!vbmap.has_value()) {
    return { 0, {} };
  }
  const std::uint32_t crc = utils::hash_crc32(key.data(), key.size());
  auto vbucket = static_cast<std::uint16_t>(crc % vbmap->size());
  return { vbucket, server_by_vbucket(vbucket, index) };
}

auto
configuration::map_key(const std::vector<std::byte>& key, std::size_t index) const
  -> std::pair<std::uint16_t, std::optional<std::size_t>>
{
  if (!vbmap.has_value()) {
    return { 0, {} };
  }
  const std::uint32_t crc = utils::hash_crc32(key.data(), key.size());
  auto vbucket = static_cast<std::uint16_t>(crc % vbmap->size());
  return { vbucket, server_by_vbucket(vbucket, index) };
}

auto
make_blank_configuration(const std::string& hostname,
                         std::uint16_t plain_port,
                         std::uint16_t tls_port) -> configuration
{
  configuration result;
  result.id = couchbase::core::uuid::random();
  result.epoch = 0;
  result.rev = 0;
  result.nodes.resize(1);
  result.nodes[0].hostname = hostname;
  result.nodes[0].this_node = true;
  result.nodes[0].services_plain.key_value = plain_port;
  result.nodes[0].services_tls.key_value = tls_port;
  return result;
}

auto
make_blank_configuration(const std::vector<std::pair<std::string, std::string>>& endpoints,
                         bool use_tls,
                         bool force) -> configuration
{
  configuration result;
  result.force = force;
  result.id = couchbase::core::uuid::random();
  result.epoch = 0;
  result.rev = 0;
  result.nodes.resize(endpoints.size());
  std::size_t idx{ 0 };
  for (const auto& [hostname, port] : endpoints) {
    configuration::node node{ false, idx++, hostname };
    if (use_tls) {
      node.services_tls.key_value = static_cast<std::uint16_t>(std::stol(port));
    } else {
      node.services_plain.key_value = static_cast<std::uint16_t>(std::stol(port));
    }
    result.nodes.emplace_back(node);
  }
  return result;
}
} // namespace couchbase::core::topology
