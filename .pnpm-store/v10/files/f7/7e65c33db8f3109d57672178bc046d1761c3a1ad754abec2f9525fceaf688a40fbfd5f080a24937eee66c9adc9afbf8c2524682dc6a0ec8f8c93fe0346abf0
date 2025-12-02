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

#include "core/app_telemetry_meter.hxx"
#include "core/config_listener.hxx"
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
#include "core/columnar/bootstrap_notification_subscriber.hxx"
#endif
#include "core/logger/logger.hxx"
#include "core/metrics/meter_wrapper.hxx"
#include "core/operations/http_noop.hxx"
#include "core/service_type.hxx"
#include "core/tracing/noop_tracer.hxx"
#include "core/tracing/tracer_wrapper.hxx"
#include "http_command.hxx"
#include "http_context.hxx"
#include "http_session.hxx"
#include "http_traits.hxx"

#include <gsl/narrow>

#include <chrono>
#include <optional>
#include <queue>
#include <random>

namespace couchbase::core::io
{

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
class http_session_manager
  : public std::enable_shared_from_this<http_session_manager>
  , public config_listener
  , public columnar::bootstrap_notification_subscriber
{
#else
class http_session_manager
  : public std::enable_shared_from_this<http_session_manager>
  , public config_listener
{
#endif
public:
  http_session_manager(std::string client_id, asio::io_context& ctx, asio::ssl::context& tls)
    : client_id_(std::move(client_id))
    , ctx_(ctx)
    , tls_(tls)
  {
  }

  void set_tracer(std::shared_ptr<tracing::tracer_wrapper> tracer)
  {
    tracer_ = std::move(tracer);
  }

  void set_meter(std::shared_ptr<metrics::meter_wrapper> meter)
  {
    meter_ = std::move(meter);
  }

  void set_app_telemetry_meter(std::shared_ptr<core::app_telemetry_meter> app_telemetry_meter)
  {
    app_telemetry_meter_ = std::move(app_telemetry_meter);
  }

  auto configuration_capabilities() const -> configuration_capabilities
  {
    std::scoped_lock config_lock(config_mutex_);
    return config_.capabilities;
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void notify_bootstrap_error(const impl::bootstrap_error& error) override
  {
    CB_LOG_DEBUG("Received bootstrap error notification. code={}, ec_message={}, message={}, "
                 "allow_fast_fail={}.",
                 error.ec.value(),
                 error.ec.message(),
                 error.error_message,
                 allow_fast_fail_ ? "true" : "false");
    if (allow_fast_fail_) {
      std::scoped_lock bootstrap_error_lock(last_bootstrap_error_mutex_);
      last_bootstrap_error_ = error;
      drain_deferred_queue(last_bootstrap_error_.value());
    }
  }

  void notify_bootstrap_success(const std::string& session_id) override
  {
    CB_LOG_DEBUG("Received successful bootstrap notification.  Session={}.", session_id);
    std::scoped_lock bootstrap_error_lock(last_bootstrap_error_mutex_);
    allow_fast_fail_ = false;
    last_bootstrap_error_.reset();
  }
#endif

  void update_config(topology::configuration config) override
  {
    {
      std::scoped_lock config_lock(config_mutex_, sessions_mutex_, next_index_mutex_);
      config_ = std::move(config);
      if (!config_.nodes.empty() && next_index_ >= config_.nodes.size()) {
        next_index_ = 0;
      }
      for (auto& [type, sessions] : idle_sessions_) {
        sessions.remove_if([&opts = options_, &cfg = config_](const auto& session) {
          return session && !cfg.has_node(opts.network,
                                          session->type(),
                                          opts.enable_tls,
                                          session->hostname(),
                                          session->port());
        });
      }
    }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    drain_deferred_queue({});
#endif
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void set_dispatch_timeout(const std::chrono::milliseconds timeout)
  {
    dispatch_timeout_ = timeout;
  }
#endif

  void set_configuration(const topology::configuration& config, const cluster_options& options)
  {
    std::size_t next_index = 0;
    if (config.nodes.size() > 1) {
      std::random_device rd;
      std::mt19937 gen(rd());
      std::uniform_int_distribution<std::size_t> dis(0, config.nodes.size() - 1);
      next_index = dis(gen);
    }
    {
      std::scoped_lock lock(config_mutex_, next_index_mutex_);
      options_ = options;
      next_index_ = next_index;
      config_ = config;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
      if (!configured_) {
        configured_ = true;
      }
      if (allow_fast_fail_) {
        allow_fast_fail_ = false;
      }
#endif
    }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    drain_deferred_queue({});
#endif
  }

  void export_diag_info(diag::diagnostics_result& res)
  {
    std::scoped_lock lock(sessions_mutex_);

    for (const auto& [type, sessions] : busy_sessions_) {
      for (const auto& session : sessions) {
        if (session) {
          res.services[type].emplace_back(session->diag_info());
        }
      }
    }
    for (const auto& [type, sessions] : idle_sessions_) {
      for (const auto& session : sessions) {
        if (session) {
          res.services[type].emplace_back(session->diag_info());
        }
      }
    }
  }

  template<typename Collector>
  void ping(std::set<service_type> services,
            std::optional<std::chrono::milliseconds> timeout,
            std::shared_ptr<Collector> collector,
            const couchbase::core::cluster_credentials& credentials)
  {
    std::array known_types{
      service_type::query, service_type::analytics, service_type::search,
      service_type::view,  service_type::eventing,  service_type::management,
    };
    std::vector<topology::configuration::node> nodes{};
    {
      std::scoped_lock lock(config_mutex_);
      nodes = config_.nodes;
    }
    for (const auto& node : nodes) {
      for (auto type : known_types) {
        if (services.find(type) == services.end()) {
          continue;
        }
        std::uint16_t port = node.port_or(options_.network, type, options_.enable_tls, 0);
        if (port != 0) {
          const auto& hostname = node.hostname_for(options_.network);
          auto session = create_session(type, credentials, hostname, port, node.node_uuid);
          if (session->is_connected()) {
            std::scoped_lock lock(sessions_mutex_);
            busy_sessions_[type].push_back(session);
          }
          operations::http_noop_request request{};
          request.type = type;
          request.timeout = timeout;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
          auto cmd = std::make_shared<operations::http_command<operations::http_noop_request>>(
            ctx_,
            request,
            tracer_,
            meter_,
            app_telemetry_meter_,
            options_.default_timeout_for(request.type),
            dispatch_timeout_);
#else
          auto cmd = std::make_shared<operations::http_command<operations::http_noop_request>>(
            ctx_,
            request,
            tracer_,
            meter_,
            app_telemetry_meter_,
            options_.default_timeout_for(request.type));
#endif

          cmd->start([start = std::chrono::steady_clock::now(),
                      self = shared_from_this(),
                      type,
                      cmd,
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
                      handler = collector->build_reporter()](error_union err,
                                                             io::http_response&& msg) {
            diag::ping_state state = diag::ping_state::ok;
            std::optional<std::string> error{};
            if (!std::holds_alternative<std::monostate>(err)) {
              auto ec = std::holds_alternative<impl::bootstrap_error>(err)
                          ? std::get<impl::bootstrap_error>(err).ec
                          : std::get<std::error_code>(err);
              if (ec) {
                if (ec == errc::common::unambiguous_timeout ||
                    ec == errc::common::ambiguous_timeout) {
                  state = diag::ping_state::timeout;
                } else {
                  state = diag::ping_state::error;
                }
                error.emplace(fmt::format(
                  "code={}, message={}, http_code={}", ec.value(), ec.message(), msg.status_code));
              }
            }
#else
                      handler = collector->build_reporter()](std::error_code ec,
                                                             io::http_response&& msg) {
            diag::ping_state state = diag::ping_state::ok;
            std::optional<std::string> error{};
            if (ec) {
              if (ec == errc::common::unambiguous_timeout ||
                  ec == errc::common::ambiguous_timeout) {
                state = diag::ping_state::timeout;
              } else {
                state = diag::ping_state::error;
              }
              error.emplace(fmt::format(
                "code={}, message={}, http_code={}", ec.value(), ec.message(), msg.status_code));
            }
#endif
            auto remote_address = cmd->session_->remote_address();
            // If not connected, the remote address will be empty.  Better to
            // give the user some context on the "attempted" remote address.
            if (remote_address.empty()) {
              remote_address =
                fmt::format("{}:{}", cmd->session_->hostname(), cmd->session_->port());
            }
            handler->report(
              diag::endpoint_ping_info{ type,
                                        cmd->session_->id(),
                                        std::chrono::duration_cast<std::chrono::microseconds>(
                                          std::chrono::steady_clock::now() - start),
                                        remote_address,
                                        cmd->session_->local_address(),
                                        state,
                                        {},
                                        error });
            self->check_in(type, cmd->session_);
          });

          cmd->set_command_session(session);
          if (!session->is_connected()) {
            connect_then_send(session, cmd, {}, true);
          } else {
            cmd->send_to();
          }
        }
      }
    }
  }

  auto check_out(service_type type,
                 const couchbase::core::cluster_credentials& credentials,
                 std::string preferred_node,
                 const std::string& undesired_node = {})
    -> std::pair<std::error_code, std::shared_ptr<http_session>>
  {
    std::string node_uuid{};

    if (preferred_node.empty() && !undesired_node.empty()) {
      auto [hostname, port, uuid] = pick_random_node(type, undesired_node);
      if (port != 0) {
        preferred_node = fmt::format("{}:{}", hostname, port);
        node_uuid = uuid;
      }
    }

    const std::scoped_lock lock(sessions_mutex_);
    idle_sessions_[type].remove_if([](const auto& s) {
      return !s;
    });
    busy_sessions_[type].remove_if([](const auto& s) {
      return !s;
    });
    pending_sessions_[type].remove_if([](const auto& s) {
      return !s;
    });
    std::shared_ptr<http_session> session{};
    while (!idle_sessions_[type].empty()) {
      if (preferred_node.empty()) {
        session = idle_sessions_[type].front();
        idle_sessions_[type].pop_front();
        if (session->reset_idle()) {
          break;
        }
      } else {
        auto [hostname, port] = split_host_port(preferred_node);

        auto ptr = std::find_if(idle_sessions_[type].begin(),
                                idle_sessions_[type].end(),
                                [&preferred_node, &h = hostname, &p = port](const auto& s) {
                                  // Check for a match using both the unresolved hostname & IP
                                  // address
                                  return (s->remote_address() == preferred_node ||
                                          (s->hostname() == h && s->port() == std::to_string(p)));
                                });
        if (ptr != idle_sessions_[type].end()) {
          session = *ptr;
          idle_sessions_[type].erase(ptr);
          if (session->reset_idle()) {
            break;
          }
        } else {
          session = create_session(type, credentials, hostname, port, node_uuid);
          break;
        }
      }
      CB_LOG_TRACE(
        "{} Idle timer has expired for \"{}:{}\".  Attempting to select another session.",
        session->log_prefix(),
        session->hostname(),
        session->port());
      session.reset();
    }
    if (!session) {
      auto [hostname, port, uuid] =
        preferred_node.empty() ? next_node(type) : lookup_node(type, preferred_node);
      if (port == 0) {
        return { errc::common::service_not_available, nullptr };
      }
      session = create_session(type, credentials, hostname, port, uuid);
    }
    if (session->is_connected()) {
      busy_sessions_[type].push_back(session);
    } else {
      pending_sessions_[type].push_back(session);
    }
    return { {}, session };
  }

  void check_in(service_type type, std::shared_ptr<http_session> session)
  {
    if (!session) {
      return;
    }
    if (!session->is_connected()) {
      CB_LOG_DEBUG("{} HTTP session never connected.  Skipping check-in", session->log_prefix());
      return session.reset();
    }
    {
      std::scoped_lock lock(config_mutex_);
      if (!session->keep_alive() || !config_.has_node(options_.network,
                                                      session->type(),
                                                      options_.enable_tls,
                                                      session->hostname(),
                                                      session->port())) {
        return asio::post(session->get_executor(), [session]() {
          session->stop();
        });
      }
    }
    if (!session->is_stopped()) {
      session->set_idle(options_.idle_http_connection_timeout);
      CB_LOG_DEBUG("{} put HTTP session back to idle connections", session->log_prefix());
      std::scoped_lock lock(sessions_mutex_);
      idle_sessions_[type].push_back(session);
      busy_sessions_[type].remove_if([id = session->id()](const auto& s) -> bool {
        return !s || s->id() == id;
      });
      pending_sessions_[type].remove_if([id = session->id()](const auto& s) -> bool {
        return !s || s->id() == id;
      });
    }
  }

  void close()
  {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    drain_deferred_queue(errc::common::request_canceled);
#endif
    std::map<service_type, std::list<std::shared_ptr<http_session>>> busy_sessions, idle_sessions,
      pending_sessions;
    {
      const std::scoped_lock lock(sessions_mutex_);
      busy_sessions = std::move(busy_sessions_);
      idle_sessions = std::move(idle_sessions_);
      pending_sessions = std::move(pending_sessions_);
    }
    for (auto& [type, sessions] : idle_sessions) {
      for (auto& s : sessions) {
        if (s) {
          s->reset_idle();
          s.reset();
        }
      }
    }
    for (auto& [type, sessions] : busy_sessions) {
      for (auto& s : sessions) {
        if (s) {
          s->stop();
        }
      }
    }
    for (auto& [type, sessions] : pending_sessions) {
      for (auto& s : sessions) {
        if (s) {
          s->stop();
        }
      }
    }
  }

  template<typename Request, typename Handler>
  void execute(Request request,
               Handler&& handler,
               const couchbase::core::cluster_credentials& credentials)
  {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    if (!configured_) {
      return defer_command(request, std::move(handler), credentials);
    }
#endif
    std::string preferred_node;
    if constexpr (http_traits::supports_sticky_node_v<Request>) {
      if (request.send_to_node) {
        preferred_node = *request.send_to_node;
      }
    }
    auto [error, session] = check_out(request.type, credentials, preferred_node);
    if (error) {
      typename Request::error_context_type ctx{};
      ctx.ec = error;
      using response_type = typename Request::encoded_response_type;
      return handler(request.make_response(std::move(ctx), response_type{}));
    }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    auto cmd = std::make_shared<operations::http_command<Request>>(
      ctx_,
      request,
      tracer_,
      meter_,
      app_telemetry_meter_,
      options_.default_timeout_for(request.type),
      dispatch_timeout_);
    cmd->start([self = shared_from_this(), cmd, handler = std::forward<Handler>(handler)](
                 error_union err, io::http_response&& msg) mutable {
#else
    auto cmd = std::make_shared<operations::http_command<Request>>(
      ctx_,
      request,
      tracer_,
      meter_,
      app_telemetry_meter_,
      options_.default_timeout_for(request.type));
    cmd->start([self = shared_from_this(), cmd, handler = std::forward<Handler>(handler)](
                 std::error_code ec, io::http_response&& msg) mutable {
#endif
      using command_type = typename decltype(cmd)::element_type;
      using encoded_response_type = typename command_type::encoded_response_type;
      using error_context_type = typename command_type::error_context_type;
      encoded_response_type resp{ std::move(msg) };
      error_context_type ctx{};
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
      if (!std::holds_alternative<std::monostate>(err)) {
        if (std::holds_alternative<impl::bootstrap_error>(err)) {
          auto bootstrap_error = std::get<impl::bootstrap_error>(err);
          if (bootstrap_error.ec == errc::common::unambiguous_timeout) {
            CB_LOG_DEBUG("Timeout caused by bootstrap error. code={}, ec_message={}, message={}.",
                         bootstrap_error.ec.value(),
                         bootstrap_error.ec.message(),
                         bootstrap_error.error_message);
          }
          ctx.ec = bootstrap_error.ec;
        } else {
          ctx.ec = std::get<std::error_code>(err);
        }
      }
#else
      ctx.ec = ec;
#endif
      ctx.client_context_id = cmd->client_context_id_;
      ctx.method = cmd->encoded.method;
      ctx.path = cmd->encoded.path;
      ctx.http_status = resp.status_code;
      ctx.http_body = resp.body.data();
      ctx.last_dispatched_from = cmd->session_->local_address();
      ctx.last_dispatched_to = cmd->session_->remote_address();
      ctx.hostname = cmd->session_->http_context().hostname;
      ctx.port = cmd->session_->http_context().port;
      handler(cmd->request.make_response(std::move(ctx), std::move(resp)));
      self->check_in(cmd->request.type, cmd->session_);
    });
    cmd->set_command_session(session);
    if (!session->is_connected()) {
      connect_then_send(session, cmd, preferred_node);
    } else {
      cmd->send_to();
    }
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void connect_then_send_pending_op(
    std::shared_ptr<http_session> session,
    const std::string& preferred_node,
    std::chrono::time_point<std::chrono::steady_clock> dispatch_deadline,
    std::chrono::time_point<std::chrono::steady_clock> deadline,
    utils::movable_function<void(std::error_code, std::shared_ptr<http_session>)> callback)
#else
  void connect_then_send_pending_op(
    std::shared_ptr<http_session> session,
    const std::string& preferred_node,
    std::chrono::time_point<std::chrono::steady_clock> deadline,
    utils::movable_function<void(std::error_code, std::shared_ptr<http_session>)> callback)
#endif
  {
    session->connect([self = shared_from_this(),
                      session,
                      preferred_node,
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
                      dispatch_deadline,
#endif
                      deadline,
                      cb = std::move(callback)]() mutable {
      if (!session->is_connected()) {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        auto now = std::chrono::steady_clock::now();
        if (session->is_stopped()) {
          // Session was forced to stop (e.g. due to cluster being closed or cancellation)
          cb(errc::common::request_canceled, {});
          return;
        }
        if (dispatch_deadline < now || deadline < now) {
          session->stop();
          cb(errc::common::unambiguous_timeout, {});
          return;
        }
#else
        if (deadline < std::chrono::steady_clock::now()) {
          session->stop();
          return cb(errc::common::unambiguous_timeout, {});
          return;
        }
#endif

        // stop this session and create a new one w/ new hostname + port
        session->stop();
        auto [hostname, port, node_uuid] = preferred_node.empty()
                                             ? self->next_node(session->type())
                                             : self->lookup_node(session->type(), preferred_node);
        if (port == 0) {
          cb(errc::common::service_not_available, {});
          return;
        }
        auto new_session =
          self->create_session(session->type(), session->credentials(), hostname, port, node_uuid);
        if (new_session->is_connected()) {
          {
            const std::scoped_lock inner_lock(self->sessions_mutex_);
            self->busy_sessions_[new_session->type()].push_back(new_session);
          }
          cb({}, new_session);
        } else {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
          {
            const std::scoped_lock inner_lock(self->sessions_mutex_);
            self->pending_sessions_[new_session->type()].push_back(new_session);
          }
          self->connect_then_send_pending_op(
            new_session, preferred_node, dispatch_deadline, deadline, cb);
#else
          self->connect_then_send_pending_op(new_session, preferred_node, deadline, cb);
#endif
        }
      } else {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        auto now = std::chrono::steady_clock::now();
        if (dispatch_deadline < now || deadline < now) {
          session->stop();
          cb(errc::common::unambiguous_timeout, {});
          return;
        }
#else
        if (deadline < std::chrono::steady_clock::now()) {
          session->stop();
          cb(errc::common::unambiguous_timeout, {});
          return;
        }
#endif
        {
          const std::scoped_lock inner_lock(self->sessions_mutex_);
          self->busy_sessions_[session->type()].push_back(session);
          self->pending_sessions_[session->type()].remove_if(
            [id = session->id()](const auto& s) -> bool {
              return !s || s->id() == id;
            });
        }
        cb({}, session);
      }
    });
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void add_to_deferred_queue(utils::movable_function<void(error_union)> command)
  {
    const std::scoped_lock lock_for_deferred_commands(deferred_commands_mutex_);
    deferred_commands_.emplace(std::move(command));
  }

  [[nodiscard]] auto dispatch_timeout() const -> std::chrono::milliseconds
  {
    return dispatch_timeout_;
  }

  [[nodiscard]] auto is_configured() const -> bool
  {
    return configured_;
  }

  [[nodiscard]] auto last_bootstrap_error() const -> std::optional<impl::bootstrap_error>
  {
    return last_bootstrap_error_;
  }
#endif

private:
  template<typename Request>
  void connect_then_send(std::shared_ptr<http_session> session,
                         std::shared_ptr<operations::http_command<Request>> cmd,
                         const std::string& preferred_node,
                         bool reuse_session = false)
  {
    session->connect([self = shared_from_this(),
                      session,
                      cmd,
                      preferred_node = std::move(preferred_node),
                      reuse_session]() mutable {
      if (!session->is_connected()) {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        auto now = std::chrono::steady_clock::now();
        if (cmd->dispatch_deadline_expiry() < now || cmd->deadline_expiry() < now) {
          // The http command will stop its session when the deadline expires.
          return;
        }
#else
        if (cmd->deadline_expiry() < std::chrono::steady_clock::now()) {
          // The http command will stop its session when the deadline expires.
          return;
        }
#endif
        if (reuse_session) {
          return self->connect_then_send(session, cmd, preferred_node, reuse_session);
        }
        // stop this session and create a new one w/ new hostname + port
        session->stop();
        auto [hostname, port, node_uuid] = preferred_node.empty()
                                             ? self->next_node(session->type())
                                             : self->lookup_node(session->type(), preferred_node);
        if (port == 0) {
          cmd->invoke_handler(errc::common::service_not_available, {});
          return;
        }
        auto new_session =
          self->create_session(session->type(), session->credentials(), hostname, port, node_uuid);
        cmd->set_command_session(new_session);
        if (new_session->is_connected()) {
          std::scoped_lock inner_lock(self->sessions_mutex_);
          self->busy_sessions_[new_session->type()].push_back(new_session);
          cmd->send_to();
        } else {
          self->connect_then_send(new_session, cmd, preferred_node);
        }
      } else {
        std::scoped_lock inner_lock(self->sessions_mutex_);
        self->busy_sessions_[session->type()].push_back(session);
        cmd->send_to();
      }
    });
  }

  auto create_session(service_type type,
                      const couchbase::core::cluster_credentials& credentials,
                      const std::string& hostname,
                      std::uint16_t port,
                      const std::string& node_uuid) -> std::shared_ptr<http_session>
  {
    std::shared_ptr<http_session> session;
    if (options_.enable_tls) {
      session = std::make_shared<http_session>(
        type,
        client_id_,
        node_uuid,
        ctx_,
        tls_,
        credentials,
        hostname,
        std::to_string(port),
        http_context{ config_, options_, query_cache_, hostname, port });
    } else {
      session = std::make_shared<http_session>(
        type,
        client_id_,
        node_uuid,
        ctx_,
        credentials,
        hostname,
        std::to_string(port),
        http_context{ config_, options_, query_cache_, hostname, port });
    }

    session->on_stop([type, id = session->id(), self = this->shared_from_this()]() {
      std::scoped_lock inner_lock(self->sessions_mutex_);
      self->busy_sessions_[type].remove_if([&id](const auto& s) {
        return !s || s->id() == id;
      });
      self->idle_sessions_[type].remove_if([&id](const auto& s) {
        return !s || s->id() == id;
      });
    });
    return session;
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  template<typename Request, typename Handler>
  void defer_command(Request request,
                     Handler&& handler,
                     const couchbase::core::cluster_credentials& credentials)
  {
    {
      std::scoped_lock bootstrap_error_lock(last_bootstrap_error_mutex_);
      if (last_bootstrap_error_.has_value()) {
        typename Request::error_context_type ctx{};
        ctx.ec = last_bootstrap_error_.value().ec;
        using response_type = typename Request::encoded_response_type;
        return handler(request.make_response(std::move(ctx), response_type{}));
      }
    }
    auto cmd = std::make_shared<operations::http_command<Request>>(
      ctx_,
      request,
      tracer_,
      meter_,
      app_telemetry_meter_,
      options_.default_timeout_for(request.type),
      dispatch_timeout_);
    cmd->start([self = shared_from_this(), cmd, handler = std::forward<Handler>(handler)](
                 error_union err, io::http_response&& msg) mutable {
      using command_type = typename decltype(cmd)::element_type;
      using encoded_response_type = typename command_type::encoded_response_type;
      using error_context_type = typename command_type::error_context_type;
      encoded_response_type resp{ std::move(msg) };
      error_context_type ctx{};
      if (!std::holds_alternative<std::monostate>(err)) {
        if (std::holds_alternative<impl::bootstrap_error>(err)) {
          auto bootstrap_error = std::get<impl::bootstrap_error>(err);
          if (bootstrap_error.ec == errc::common::unambiguous_timeout) {
            CB_LOG_DEBUG("Timeout caused by bootstrap error. code={}, ec_message={}, message={}.",
                         bootstrap_error.ec.value(),
                         bootstrap_error.ec.message(),
                         bootstrap_error.error_message);
          }
          ctx.ec = bootstrap_error.ec;
        } else {
          ctx.ec = std::get<std::error_code>(err);
        }
      }
      ctx.client_context_id = cmd->client_context_id_;
      ctx.method = cmd->encoded.method;
      ctx.path = cmd->encoded.path;
      ctx.http_status = resp.status_code;
      ctx.http_body = resp.body.data();
      if (cmd->session_) {
        ctx.last_dispatched_from = cmd->session_->local_address();
        ctx.last_dispatched_to = cmd->session_->remote_address();
        ctx.hostname = cmd->session_->http_context().hostname;
        ctx.port = cmd->session_->http_context().port;
      }
      handler(cmd->request.make_response(std::move(ctx), std::move(resp)));
      self->check_in(cmd->request.type, cmd->session_);
    });
    CB_LOG_DEBUG(R"(Adding HTTP request to deferred queue: {}, client_context_id="{}")",
                 cmd->request.type,
                 cmd->client_context_id_);
    add_to_deferred_queue(
      [self = shared_from_this(), cmd, request, credentials](error_union err) mutable {
        if (!std::holds_alternative<std::monostate>(err)) {
          using response_type = typename Request::encoded_response_type;
          return cmd->invoke_handler(err, response_type{});
        }

        // don't do anything if the command wasn't dispatched or has already timed out
        auto now = std::chrono::steady_clock::now();
        if (cmd->dispatch_deadline_expiry() < now || cmd->deadline_expiry() < now) {
          return;
        }
        std::string preferred_node;
        if constexpr (http_traits::supports_sticky_node_v<Request>) {
          if (request.send_to_node) {
            preferred_node = *request.send_to_node;
          }
        }
        auto [error, session] = self->check_out(request.type, credentials, preferred_node);
        if (error) {
          using response_type = typename Request::encoded_response_type;
          return cmd->invoke_handler(error, response_type{});
        }
        cmd->set_command_session(session);
        if (!session->is_connected()) {
          self->connect_then_send(session, cmd, preferred_node);
        } else {
          cmd->send_to();
        }
      });
  }

  void drain_deferred_queue(error_union err)
  {
    std::queue<utils::movable_function<void(error_union)>> commands{};
    {
      const std::scoped_lock lock(deferred_commands_mutex_);
      std::swap(deferred_commands_, commands);
    }
    if (!commands.empty()) {
      CB_LOG_TRACE("Draining deferred operation queue, size={}", commands.size());
    }
    while (!commands.empty()) {
      commands.front()(err);
      commands.pop();
    }
  }
#endif

  auto next_node(service_type type) -> std::tuple<std::string, std::uint16_t, std::string>
  {
    std::scoped_lock lock(config_mutex_);
    auto candidates = config_.nodes.size();
    while (candidates > 0) {
      --candidates;
      std::scoped_lock index_lock(next_index_mutex_);
      const auto& node = config_.nodes[next_index_];
      next_index_ = (next_index_ + 1) % config_.nodes.size();
      std::uint16_t port = node.port_or(options_.network, type, options_.enable_tls, 0);
      if (port != 0) {
        return {
          node.hostname_for(options_.network),
          port,
          node.node_uuid,
        };
      }
    }
    return {
      "",
      static_cast<std::uint16_t>(0U),
      "",
    };
  }

  auto split_host_port(const std::string& address) -> std::pair<std::string, std::uint16_t>
  {
    auto last_colon = address.find_last_of(':');
    if (last_colon == std::string::npos || address.size() - 1 == last_colon) {
      return { "", static_cast<std::uint16_t>(0U) };
    }
    auto hostname = address.substr(0, last_colon);
    auto port = gsl::narrow_cast<std::uint16_t>(std::stoul(address.substr(last_colon + 1)));
    return { hostname, port };
  }

  auto lookup_node(service_type type, const std::string& preferred_node)
    -> std::tuple<std::string, std::uint16_t, std::string>
  {
    std::scoped_lock lock(config_mutex_);
    auto [hostname, port] = split_host_port(preferred_node);
    for (const auto& node : config_.nodes) {
      if (node.hostname_for(options_.network) == hostname &&
          node.port_or(options_.network, type, options_.enable_tls, 0) == port) {
        return {
          hostname,
          port,
          node.node_uuid,
        };
      }
    }
    return {
      "",
      static_cast<std::uint16_t>(0U),
      "",
    };
  }

  auto pick_random_node(service_type type, const std::string& undesired_node)
    -> std::tuple<std::string, std::uint16_t, std::string>
  {
    std::vector<topology::configuration::node> candidate_nodes{};
    {
      const std::scoped_lock lock(config_mutex_);
      std::copy_if(config_.nodes.begin(),
                   config_.nodes.end(),
                   std::back_inserter(candidate_nodes),
                   [this, type, &undesired_node](const topology::configuration::node& node) {
                     auto endpoint = node.endpoint(options_.network, type, options_.enable_tls);
                     return endpoint.has_value() && (endpoint.value() != undesired_node);
                   });
    }

    if (candidate_nodes.empty()) {
      // Could not find any other nodes
      return {
        "",
        static_cast<std::uint16_t>(0U),
        "",
      };
    }

    std::vector<topology::configuration::node> selected{};
    std::sample(candidate_nodes.begin(),
                candidate_nodes.end(),
                std::back_inserter(selected),
                1,
                std::mt19937{ std::random_device{}() });
    const auto& first_selected = selected.at(0);
    return {
      first_selected.hostname_for(options_.network),
      first_selected.port_or(options_.network, type, options_.enable_tls, 0),
      first_selected.node_uuid,
    };
  }

  std::string client_id_;
  asio::io_context& ctx_;
  asio::ssl::context& tls_;
  std::shared_ptr<tracing::tracer_wrapper> tracer_{ nullptr };
  std::shared_ptr<metrics::meter_wrapper> meter_{ nullptr };
  std::shared_ptr<core::app_telemetry_meter> app_telemetry_meter_{ nullptr };
  cluster_options options_{};

  topology::configuration config_{};
  mutable std::mutex config_mutex_{};
  std::map<service_type, std::list<std::shared_ptr<http_session>>> busy_sessions_{};
  std::map<service_type, std::list<std::shared_ptr<http_session>>> idle_sessions_{};
  std::map<service_type, std::list<std::shared_ptr<http_session>>> pending_sessions_{};
  std::size_t next_index_{ 0 };
  std::mutex next_index_mutex_{};
  std::mutex sessions_mutex_{};
  query_cache query_cache_{};
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  std::atomic_bool configured_{ false };
  std::chrono::milliseconds dispatch_timeout_{};
  std::atomic_bool allow_fast_fail_{ true };
  std::queue<utils::movable_function<void(error_union)>> deferred_commands_{};
  std::mutex deferred_commands_mutex_{};
  std::optional<impl::bootstrap_error> last_bootstrap_error_;
  std::mutex last_bootstrap_error_mutex_{};
#endif
};
} // namespace couchbase::core::io
