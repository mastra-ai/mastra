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

#include "cluster_credentials.hxx"
#include "cluster_options.hxx"

#include <string>
#include <utility>
#include <vector>

namespace couchbase::core
{
namespace utils
{
struct connection_string;
} // namespace utils

namespace topology
{
struct configuration;
} // namespace topology

struct origin {
  using node_entry = std::pair<std::string, std::string>;
  using node_list = std::vector<node_entry>;

  origin() = default;
  ~origin() = default;

  origin(origin&& other) = default;
  origin(const origin& other);
  origin(origin other, const topology::configuration& config);
  origin(cluster_credentials auth,
         const std::string& hostname,
         std::uint16_t port,
         cluster_options options);
  origin(cluster_credentials auth,
         const std::string& hostname,
         const std::string& port,
         cluster_options options);
  origin(cluster_credentials auth, const utils::connection_string& connstr);
  auto operator=(origin&& other) -> origin& = default;
  auto operator=(const origin& other) -> origin&;

  [[nodiscard]] auto connection_string() const -> const std::string&;
  [[nodiscard]] auto username() const -> const std::string&;
  [[nodiscard]] auto password() const -> const std::string&;
  [[nodiscard]] auto certificate_path() const -> const std::string&;
  [[nodiscard]] auto key_path() const -> const std::string&;

  [[nodiscard]] auto get_hostnames() const -> std::vector<std::string>;
  [[nodiscard]] auto get_nodes() const -> std::vector<std::string>;

  void shuffle_nodes();
  void set_nodes(node_list nodes);
  void set_nodes_from_config(const topology::configuration& config);

  [[nodiscard]] auto next_address() -> std::pair<std::string, std::string>;

  [[nodiscard]] auto exhausted() const -> bool;

  void restart();

  [[nodiscard]] auto options() const -> const couchbase::core::cluster_options&;
  [[nodiscard]] auto options() -> couchbase::core::cluster_options&;
  [[nodiscard]] auto credentials() const -> const couchbase::core::cluster_credentials&;
  [[nodiscard]] auto to_json() const -> std::string;

private:
  couchbase::core::cluster_options options_{};
  cluster_credentials credentials_{};
  node_list nodes_{};
  node_list::iterator next_node_{};
  bool exhausted_{ false };
  std::string connection_string_{};
};

} // namespace couchbase::core
