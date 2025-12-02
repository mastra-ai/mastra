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

#include "config_listener.hxx"
#include "io/mcbp_command.hxx"
#include "operations.hxx"

#include <asio/bind_executor.hpp>
#include <asio/io_context.hpp>
#include <asio/post.hpp>
#include <asio/ssl.hpp>

#include <chrono>
#include <optional>
#include <utility>
#include <vector>

namespace couchbase::core
{
namespace mcbp
{
class queue_request;
} // namespace mcbp
namespace diag
{
class ping_collector;
struct diagnostics_result;
} // namespace diag
namespace tracing
{
class tracer_wrapper;
} // namespace tracing
namespace metrics
{
class meter_wrapper;
} // namespace metrics
namespace impl
{
class bootstrap_state_listener;
} // namespace impl

class app_telemetry_meter;

class bucket_impl;
struct origin;

class bucket
  : public std::enable_shared_from_this<bucket>
  , public config_listener
{
public:
  bucket(std::string client_id,
         asio::io_context& ctx,
         asio::ssl::context& tls,
         std::shared_ptr<tracing::tracer_wrapper> tracer,
         std::shared_ptr<metrics::meter_wrapper> meter,
         std::shared_ptr<core::app_telemetry_meter> app_telemetry_meter,
         std::string name,
         couchbase::core::origin origin,
         std::vector<protocol::hello_feature> known_features,
         std::shared_ptr<impl::bootstrap_state_listener> state_listener);
  ~bucket() override;

  template<typename Request, typename Handler>
  void execute(Request request, Handler&& handler)
  {
    if (is_closed()) {
      return;
    }
    auto cmd = std::make_shared<operations::mcbp_command<bucket, Request>>(
      ctx_, shared_from_this(), request, default_timeout());
    cmd->start([cmd, handler = std::forward<Handler>(handler)](
                 std::error_code ec, std::optional<io::mcbp_message>&& msg) mutable {
      using encoded_response_type = typename Request::encoded_response_type;
      std::uint16_t status_code = msg ? msg->header.status() : 0xffffU;
      auto resp = msg ? encoded_response_type(std::move(*msg)) : encoded_response_type{};
      auto ctx = make_key_value_error_context(ec, status_code, cmd, resp);
      handler(cmd->request.make_response(std::move(ctx), std::move(resp)));
    });
    if (is_configured()) {
      return map_and_send(cmd);
    }
    return defer_command([self = shared_from_this(), cmd](std::error_code ec) {
      if (ec == errc::common::request_canceled) {
        return cmd->cancel(retry_reason::do_not_retry);
      }
      self->map_and_send(cmd);
    });
  }

  template<typename Request>
  void map_and_send(std::shared_ptr<operations::mcbp_command<bucket, Request>> cmd)
  {
    if (is_closed()) {
      return cmd->cancel(retry_reason::do_not_retry);
    }
    std::size_t index;
    if (cmd->request.id.use_any_session()) {
      index = next_session_index();
    } else {
      auto [partition, server] = map_id(cmd->request.id);
      if (!server.has_value()) {
        CB_LOG_TRACE(R"([{}] unable to map key="{}" to the node, id={}, partition={}, rev={})",
                     log_prefix(),
                     cmd->request.id,
                     cmd->id_,
                     partition,
                     config_rev());
        return io::retry_orchestrator::maybe_retry(
          cmd->manager_, cmd, retry_reason::node_not_available, errc::common::request_canceled);
      }
      cmd->request.partition = partition;
      index = server.value();
    }
    auto session = find_session_by_index(index);
    if (!session || !session->has_config()) {
      CB_LOG_TRACE(
        R"([{}] defer operation id="{}", key="{}", partition={}, index={}, session={}, address="{}", has_config={}, rev={})",
        log_prefix(),
        cmd->id_,
        cmd->request.id,
        cmd->request.partition,
        index,
        session.has_value(),
        session.has_value() ? session->bootstrap_address() : "",
        session.has_value() && session->has_config(),
        config_rev());
      return defer_command([self = shared_from_this(), cmd](std::error_code ec) {
        if (ec == errc::common::request_canceled) {
          return cmd->cancel(retry_reason::do_not_retry);
        }
        self->map_and_send(cmd);
      });
    }
    if (session->is_stopped()) {
      CB_LOG_TRACE(
        R"([{}] the session has been found for idx={}, but it is stopped, retrying id={}, key="{}", partition={}, session={}, address="{}", rev={})",
        log_prefix(),
        index,
        cmd->id_,
        cmd->request.id,
        cmd->request.partition,
        session->id(),
        session->bootstrap_address(),
        config_rev());
      return io::retry_orchestrator::maybe_retry(
        cmd->manager_, cmd, retry_reason::node_not_available, errc::common::request_canceled);
    }
    cmd->last_dispatched_from_ = session->local_address();
    cmd->last_dispatched_to_ = session->bootstrap_address();
    CB_LOG_TRACE(
      R"({} send operation id="{}", key="{}", partition={}, index={}, address="{}", rev={})",
      session->log_prefix(),
      cmd->id_,
      cmd->request.id,
      cmd->request.partition,
      index,
      session->bootstrap_address(),
      config_rev());
    cmd->send_to(session.value());
  }

  template<typename Request>
  void schedule_for_retry(std::shared_ptr<operations::mcbp_command<bucket, Request>> cmd,
                          std::chrono::milliseconds duration)
  {
    if (is_closed()) {
      return cmd->cancel(retry_reason::do_not_retry);
    }
    cmd->retry_backoff.expires_after(duration);
    cmd->retry_backoff.async_wait([self = shared_from_this(), cmd](std::error_code ec) mutable {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      self->map_and_send(cmd);
    });
  }

  void fetch_config();
  void update_config(topology::configuration config) override;
  void bootstrap(utils::movable_function<void(std::error_code, topology::configuration)>&& handler);
  void with_configuration(
    utils::movable_function<void(std::error_code, std::shared_ptr<topology::configuration>)>&&
      handler);

  void on_configuration_update(std::shared_ptr<config_listener> handler);
  void close();
  void export_diag_info(diag::diagnostics_result& res) const;
  void ping(const std::shared_ptr<diag::ping_collector>& collector,
            std::optional<std::chrono::milliseconds> timeout);
  void defer_command(utils::movable_function<void(std::error_code)> command);

  [[nodiscard]] auto name() const -> const std::string&;
  [[nodiscard]] auto log_prefix() const -> const std::string&;
  [[nodiscard]] auto tracer() const -> std::shared_ptr<tracing::tracer_wrapper>;
  [[nodiscard]] auto meter() const -> std::shared_ptr<metrics::meter_wrapper>;
  [[nodiscard]] auto app_telemetry_meter() const -> std::shared_ptr<app_telemetry_meter>;
  [[nodiscard]] auto default_retry_strategy() const -> std::shared_ptr<couchbase::retry_strategy>;
  [[nodiscard]] auto is_closed() const -> bool;
  [[nodiscard]] auto is_configured() const -> bool;

  auto direct_dispatch(std::shared_ptr<mcbp::queue_request> req) -> std::error_code;
  auto direct_re_queue(const std::shared_ptr<mcbp::queue_request>& req, bool is_retry)
    -> std::error_code;

private:
  [[nodiscard]] auto default_timeout() const -> std::chrono::milliseconds;
  [[nodiscard]] auto next_session_index() -> std::size_t;
  [[nodiscard]] auto find_session_by_index(std::size_t index) const
    -> std::optional<io::mcbp_session>;
  [[nodiscard]] auto map_id(const document_id& id)
    -> std::pair<std::uint16_t, std::optional<std::size_t>>;
  [[nodiscard]] auto config_rev() const -> std::string;

  asio::io_context& ctx_;
  std::shared_ptr<bucket_impl> impl_;
};
} // namespace couchbase::core
