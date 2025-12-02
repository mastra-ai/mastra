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

#include <couchbase/build_config.hxx>

#include "core/protocol/hello_feature.hxx"
#include "core/response_handler.hxx"
#include "core/utils/movable_function.hxx"
#include "mcbp_context.hxx"
#include "mcbp_message.hxx"

#include <chrono>
#include <cinttypes>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
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
struct origin;
class config_listener;

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
namespace columnar
{
class background_bootstrap_listener;
} // namespace columnar
#endif

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
struct bootstrap_error;
class bootstrap_state_listener;
} // namespace impl

namespace io
{
class mcbp_session_impl;

using command_handler = utils::movable_function<
  void(std::error_code, retry_reason, io::mcbp_message&&, std::optional<key_value_error_map_info>)>;

class mcbp_session
{
public:
  mcbp_session() = delete;
  ~mcbp_session() = default;
  mcbp_session(const mcbp_session& other) = default;
  auto operator=(const mcbp_session& other) -> mcbp_session& = default;
  mcbp_session(mcbp_session&& other) = default;
  auto operator=(mcbp_session&& other) -> mcbp_session& = default;

  mcbp_session(const std::string& client_id,
               const std::string& node_uuid,
               asio::io_context& ctx,
               couchbase::core::origin origin,
               std::shared_ptr<impl::bootstrap_state_listener> state_listener,
               std::optional<std::string> bucket_name = {},
               std::vector<protocol::hello_feature> known_features = {});

  mcbp_session(const std::string& client_id,
               const std::string& node_uuid,
               asio::io_context& ctx,
               asio::ssl::context& tls,
               couchbase::core::origin origin,
               std::shared_ptr<impl::bootstrap_state_listener> state_listener,
               std::optional<std::string> bucket_name = {},
               std::vector<protocol::hello_feature> known_features = {});

  [[nodiscard]] auto log_prefix() const -> const std::string&;
  [[nodiscard]] auto cancel(std::uint32_t opaque, std::error_code ec, retry_reason reason) -> bool;
  [[nodiscard]] auto is_stopped() const -> bool;
  [[nodiscard]] auto is_bootstrapped() const -> bool;
  [[nodiscard]] auto next_opaque() -> std::uint32_t;
  [[nodiscard]] auto get_collection_uid(const std::string& collection_path)
    -> std::optional<std::uint32_t>;
  [[nodiscard]] auto context() const -> mcbp_context;
  [[nodiscard]] auto supports_feature(protocol::hello_feature feature) -> bool;
  [[nodiscard]] auto supported_features() const -> std::vector<protocol::hello_feature>;
  [[nodiscard]] auto id() const -> const std::string&;
  [[nodiscard]] auto node_uuid() const -> const std::string&;
  [[nodiscard]] auto remote_address() const -> std::string;
  [[nodiscard]] auto local_address() const -> std::string;
  [[nodiscard]] auto bootstrap_address() const -> const std::string&;
  [[nodiscard]] auto bootstrap_hostname() const -> const std::string&;
  [[nodiscard]] auto bootstrap_port() const -> const std::string&;
  [[nodiscard]] auto bootstrap_port_number() const -> std::uint16_t;
  [[nodiscard]] auto last_bootstrap_error() && -> std::optional<impl::bootstrap_error>;
  [[nodiscard]] auto last_bootstrap_error() const& -> const std::optional<impl::bootstrap_error>&;
  void write_and_flush(std::vector<std::byte>&& buffer);
  void write_and_subscribe(const std::shared_ptr<mcbp::queue_request>&,
                           const std::shared_ptr<response_handler>& handler);
  void write_and_subscribe(std::uint32_t opaque,
                           std::vector<std::byte>&& data,
                           command_handler&& handler);
  void bootstrap(utils::movable_function<void(std::error_code, topology::configuration)>&& handler,
                 bool retry_on_bucket_not_found = false);
  void on_stop(utils::movable_function<void()> handler);
  void stop(retry_reason reason);
  [[nodiscard]] auto index() const -> std::size_t;
  [[nodiscard]] auto has_config() const -> bool;
  [[nodiscard]] auto config() const -> std::optional<topology::configuration>;
  [[nodiscard]] auto diag_info() const -> diag::endpoint_diag_info;
  void on_configuration_update(std::shared_ptr<config_listener> handler);
  void ping(const std::shared_ptr<diag::ping_reporter>& handler,
            std::optional<std::chrono::milliseconds> = {}) const;
  [[nodiscard]] auto supports_gcccp() const -> bool;
  [[nodiscard]] auto decode_error_code(std::uint16_t code)
    -> std::optional<key_value_error_map_info>;
  void handle_not_my_vbucket(const io::mcbp_message& msg) const;
  void update_collection_uid(const std::string& path, std::uint32_t uid);
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void add_background_bootstrap_listener(
    std::shared_ptr<columnar::background_bootstrap_listener> listener);
#endif

private:
  std::shared_ptr<mcbp_session_impl> impl_{ nullptr };
};
} // namespace io
} // namespace couchbase::core
