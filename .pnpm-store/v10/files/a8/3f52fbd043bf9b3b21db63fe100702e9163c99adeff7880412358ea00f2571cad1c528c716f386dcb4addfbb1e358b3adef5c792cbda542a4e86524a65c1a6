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

#include <string>

namespace couchbase
{
class behavior_options
{
public:
  auto append_to_user_agent(std::string extra) -> behavior_options&
  {
    user_agent_extra_ = std::move(extra);
    return *this;
  }

  auto show_queries(bool enable) -> behavior_options&
  {
    show_queries_ = enable;
    return *this;
  }

  auto enable_clustermap_notification(bool enable) -> behavior_options&
  {
    enable_clustermap_notification_ = enable;
    return *this;
  }

  auto enable_mutation_tokens(bool enable) -> behavior_options&
  {
    enable_mutation_tokens_ = enable;
    return *this;
  }

  auto enable_unordered_execution(bool enable) -> behavior_options&
  {
    enable_unordered_execution_ = enable;
    return *this;
  }

  auto dump_configuration(bool enable) -> behavior_options&
  {
    dump_configuration_ = enable;
    return *this;
  }

  [[deprecated("Use couchbase::network_options#preferred_network() instead.")]]
  auto network(std::string name) -> behavior_options&
  {
    network_ = std::move(name);
    return *this;
  }

  auto preserve_bootstrap_nodes_order(bool enable) -> behavior_options&
  {
    preserve_bootstrap_nodes_order_ = enable;
    return *this;
  }

  struct built {
    std::string user_agent_extra;
    bool show_queries;
    bool enable_clustermap_notification;
    bool enable_mutation_tokens;
    bool enable_unordered_execution;
    bool dump_configuration;
    std::string network;
    bool preserve_bootstrap_nodes_order;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      user_agent_extra_,
      show_queries_,
      enable_clustermap_notification_,
      enable_mutation_tokens_,
      enable_unordered_execution_,
      dump_configuration_,
      network_,
      preserve_bootstrap_nodes_order_,
    };
  }

private:
  std::string user_agent_extra_{};
  bool show_queries_{ false };
  bool enable_clustermap_notification_{ true };
  bool enable_mutation_tokens_{ true };
  bool enable_unordered_execution_{ true };
  bool dump_configuration_{ false };
  std::string network_{ "auto" };
  bool preserve_bootstrap_nodes_order_{ false };
};
} // namespace couchbase
