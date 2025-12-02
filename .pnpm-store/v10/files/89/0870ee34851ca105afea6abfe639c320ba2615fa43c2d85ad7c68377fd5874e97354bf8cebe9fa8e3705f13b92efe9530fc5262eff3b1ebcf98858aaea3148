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

#include <couchbase/build_config.hxx>
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
#include "core/columnar/background_bootstrap_listener.hxx"
#endif
#include "core/config_listener.hxx"
#include "core/protocol/hello_feature.hxx"
#include "core/utils/movable_function.hxx"

#include <mutex>
#include <optional>
#include <string>
#include <system_error>
#include <vector>

namespace asio
{
class io_context;
namespace ssl
{
class context;
} // namespace ssl
} // namespace asio

namespace couchbase::core
{
struct cluster_options;
struct origin;

namespace protocol
{
class get_cluster_config_request_body;
} // namespace protocol

namespace topology
{
struct configuration;
} // namespace topology

namespace diag
{
class ping_reporter;
struct endpoint_diag_info;
} // namespace diag

namespace impl
{
class bootstrap_state_listener;
} // namespace impl

namespace io
{

class http_session_manager;
class mcbp_session;
class cluster_config_tracker_impl;
class bucket_config_tracker_impl;

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
class cluster_config_tracker
  : public std::enable_shared_from_this<cluster_config_tracker>
  , public config_listener
  , public columnar::background_bootstrap_listener
{
#else
class cluster_config_tracker
  : public std::enable_shared_from_this<cluster_config_tracker>
  , public config_listener
{
#endif
public:
  cluster_config_tracker(std::string client_id,
                         couchbase::core::origin origin,
                         asio::io_context& ctx,
                         asio::ssl::context& tls,
                         std::shared_ptr<impl::bootstrap_state_listener> state_listener);
  ~cluster_config_tracker() override;

  void create_sessions(
    utils::movable_function<void(std::error_code,
                                 const topology::configuration&,
                                 const couchbase::core::cluster_options&)>&& handler);
  void on_configuration_update(std::shared_ptr<config_listener> handler);
  void close();
  void register_state_listener();
  void update_config(topology::configuration config) override;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void notify_bootstrap_error(const impl::bootstrap_error& error) override;
  void notify_bootstrap_success(const std::string& session_id) override;
  void register_bootstrap_notification_subscriber(
    std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber) override;
  void unregister_bootstrap_notification_subscriber(
    std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber) override;
#endif
  [[nodiscard]] auto has_config() const -> bool;
  [[nodiscard]] auto config() const -> std::optional<topology::configuration>;
  [[nodiscard]] auto supported_features() const -> std::vector<protocol::hello_feature>;

private:
  std::shared_ptr<cluster_config_tracker_impl> impl_{ nullptr };
};

} // namespace io
} // namespace couchbase::core
