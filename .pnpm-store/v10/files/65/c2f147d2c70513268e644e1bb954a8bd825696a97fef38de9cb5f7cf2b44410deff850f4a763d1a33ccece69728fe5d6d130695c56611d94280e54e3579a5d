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

#pragma once

#include <couchbase/ip_protocol.hxx>

#include <chrono>
#include <cstdint>
#include <optional>
#include <string>

namespace couchbase
{
class network_options
{
public:
  static constexpr std::chrono::milliseconds default_tcp_keep_alive_interval{ std::chrono::seconds{
    60 } };
  static constexpr std::chrono::milliseconds default_config_poll_interval{ 2'500 };
  static constexpr std::chrono::milliseconds default_config_poll_floor{ 50 };
  static constexpr std::chrono::milliseconds default_idle_http_connection_timeout{ 4'500 };

  /**
   * Selects network to use.
   *
   * @param name network name as it is exposed in the configuration.
   * @return this object for chaining purposes.
   *
   * @see
   * https://docs.couchbase.com/server/current/learn/clusters-and-availability/connectivity.html#alternate-addresses
   * @see https://docs.couchbase.com/server/current/rest-api/rest-set-up-alternate-address.html
   */
  auto preferred_network(std::string network_name) -> network_options&
  {
    network_ = std::move(network_name);
    return *this;
  }

  auto enable_tcp_keep_alive(bool enable) -> network_options&
  {
    enable_tcp_keep_alive_ = enable;
    return *this;
  }

  auto tcp_keep_alive_interval(std::chrono::milliseconds interval) -> network_options&
  {
    tcp_keep_alive_interval_ = interval;
    return *this;
  }

  auto config_poll_interval(std::chrono::milliseconds interval) -> network_options&
  {
    if (interval < config_poll_floor_) {
      interval = config_poll_floor_;
    }
    config_poll_interval_ = interval;
    return *this;
  }

  auto idle_http_connection_timeout(std::chrono::milliseconds timeout) -> network_options&
  {
    idle_http_connection_timeout_ = timeout;
    return *this;
  }

  auto max_http_connections(std::size_t number_of_connections) -> network_options&
  {
    max_http_connections_ = number_of_connections;
    return *this;
  }

  auto force_ip_protocol(ip_protocol protocol) -> network_options&
  {
    ip_protocol_ = protocol;
    return *this;
  }

  /**
   * Select server group to use for replica APIs.
   *
   * For some use-cases it might be necessary to restrict list of the nodes,
   * that are used in replica read APIs to single server group to optimize
   * network costs.
   *
   * @see read_preference
   *
   * @see collection::get_all_replicas
   * @see collection::get_any_replica
   * @see collection::lookup_in_all_replicas
   * @see collection::lookup_in_any_replica
   * @see transactions::async_attempt_context::get_replica_from_preferred_server_group
   * @see transactions::attempt_context::get_replica_from_preferred_server_group
   *
   * @see https://docs.couchbase.com/server/current/manage/manage-groups/manage-groups.html
   */
  auto preferred_server_group(std::string server_group) -> network_options&
  {
    server_group_ = std::move(server_group);
    return *this;
  }

  struct built {
    std::string network;
    std::string server_group;
    bool enable_tcp_keep_alive;
    couchbase::ip_protocol ip_protocol;
    std::chrono::milliseconds tcp_keep_alive_interval;
    std::chrono::milliseconds config_poll_interval;
    std::chrono::milliseconds idle_http_connection_timeout;
    std::optional<std::size_t> max_http_connections;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      network_,
      server_group_,
      enable_tcp_keep_alive_,
      ip_protocol_,
      tcp_keep_alive_interval_,
      config_poll_interval_,
      idle_http_connection_timeout_,
      max_http_connections_,
    };
  }

private:
  std::string network_{ "auto" };
  std::string server_group_{};
  bool enable_tcp_keep_alive_{ true };
  ip_protocol ip_protocol_{ ip_protocol::any };
  std::chrono::milliseconds tcp_keep_alive_interval_{ default_tcp_keep_alive_interval };
  std::chrono::milliseconds config_poll_interval_{ default_config_poll_interval };
  std::chrono::milliseconds config_poll_floor_{ default_config_poll_floor };
  std::chrono::milliseconds idle_http_connection_timeout_{ default_idle_http_connection_timeout };
  std::optional<std::size_t> max_http_connections_{};
};
} // namespace couchbase
