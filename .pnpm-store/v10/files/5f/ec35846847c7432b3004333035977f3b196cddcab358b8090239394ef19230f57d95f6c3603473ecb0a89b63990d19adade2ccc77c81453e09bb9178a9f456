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

#include "bootstrap_state_listener.hxx"
#include "core/io/dns_client.hxx"
#include "core/origin.hxx"
#include "core/utils/movable_function.hxx"

#include <mutex>
#include <set>
#include <string>
#include <vector>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase::core::impl
{
class dns_srv_tracker
  : public std::enable_shared_from_this<dns_srv_tracker>
  , public bootstrap_state_listener
{
public:
  dns_srv_tracker(asio::io_context& ctx,
                  std::string address,
                  io::dns::dns_config config,
                  bool use_tls);
  void get_srv_nodes(
    utils::movable_function<void(origin::node_list nodes, std::error_code ec)> callback);

  void report_bootstrap_error(const std::string& endpoint, std::error_code ec) override;
  void report_bootstrap_success(const std::vector<std::string>& endpoints) override;

  void register_config_listener(std::shared_ptr<config_listener> listener) override;
  void unregister_config_listener(std::shared_ptr<config_listener> listener) override;

private:
  void do_dns_refresh();

  asio::io_context& ctx_;
  io::dns::dns_client dns_client_;
  std::string address_;
  io::dns::dns_config config_;
  bool use_tls_;
  std::string service_;
  std::set<std::string, std::less<>> known_endpoints_{};
  std::mutex known_endpoints_mutex_;

  std::set<std::shared_ptr<config_listener>> config_listeners_{};
  std::mutex config_listeners_mutex_;

  std::atomic_bool refresh_in_progress_{ false };
};
} // namespace couchbase::core::impl
