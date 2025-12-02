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

#include "bucket.hxx"

#include "collection_id_cache_entry.hxx"
#include "core/app_telemetry_meter.hxx"
#include "core/config_listener.hxx"
#include "core/document_id.hxx"
#include "core/error_context/key_value_error_map_info.hxx"
#include "core/error_context/key_value_status_code.hxx"
#include "core/io/mcbp_message.hxx"
#include "core/logger/logger.hxx"
#include "core/mcbp/codec.hxx"
#include "core/metrics/meter_wrapper.hxx"
#include "core/protocol/client_opcode.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/hello_feature.hxx"
#include "core/response_handler.hxx"
#include "core/service_type.hxx"
#include "core/tracing/tracer_wrapper.hxx"
#include "core/utils/movable_function.hxx"
#include "dispatcher.hxx"
#include "impl/bootstrap_state_listener.hxx"
#include "mcbp/operation_queue.hxx"
#include "mcbp/queue_request.hxx"
#include "mcbp/queue_response.hxx"
#include "origin.hxx"
#include "ping_collector.hxx"
#include "protocol/cmd_get_cluster_config.hxx"
#include "retry_orchestrator.hxx"

#include <couchbase/error_codes.hxx>
#include <couchbase/retry_reason.hxx>
#include <couchbase/retry_strategy.hxx>

#include <asio/bind_executor.hpp>
#include <asio/error.hpp>
#include <asio/io_context.hpp>
#include <asio/post.hpp>
#include <asio/ssl/context.hpp>
#include <gsl/span>
#include <spdlog/fmt/bundled/core.h>

#include <algorithm>
#include <chrono>
#include <cstddef>
#include <cstdint>

#include <iterator>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

namespace couchbase::core
{
class bucket_impl
  : public std::enable_shared_from_this<bucket_impl>
  , public config_listener
  , public response_handler
{
public:
  bucket_impl(std::string client_id,
              std::string name,
              couchbase::core::origin origin,
              std::shared_ptr<tracing::tracer_wrapper> tracer,
              std::shared_ptr<metrics::meter_wrapper> meter,
              std::shared_ptr<core::app_telemetry_meter> app_telemetry,
              std::vector<protocol::hello_feature> known_features,
              std::shared_ptr<impl::bootstrap_state_listener> state_listener,
              asio::io_context& ctx,
              asio::ssl::context& tls)
    : client_id_{ std::move(client_id) }
    , name_{ std::move(name) }
    , log_prefix_{ fmt::format("[{}/{}]", client_id_, name_) }
    , origin_{ std::move(origin) }
    , tracer_{ std::move(tracer) }
    , meter_{ std::move(meter) }
    , app_telemetry_meter_{ std::move(app_telemetry) }
    , known_features_{ std::move(known_features) }
    , state_listener_{ std::move(state_listener) }
    , codec_{ { known_features_.begin(), known_features_.end() } }
    , ctx_{ ctx }
    , tls_{ tls }
    , heartbeat_timer_(ctx_)
    , heartbeat_interval_{ origin_.options().config_poll_floor >
                               origin_.options().config_poll_interval
                             ? origin_.options().config_poll_floor
                             : origin_.options().config_poll_interval }
  {
  }

  auto resolve_response(const std::shared_ptr<mcbp::queue_request>& req,
                        const std::shared_ptr<mcbp::queue_response>& resp,
                        std::error_code ec,
                        retry_reason reason,
                        std::optional<key_value_error_map_info> error_info)
  {
    // TODO(SA): copy from mcbp_command, subject to refactor later
    metrics::metric_attributes attrs{
      service_type::key_value, fmt::format("{}", req->command_), ec, name_, req->scope_name_,
      req->collection_name_,
    };
    meter_->record_value(std::move(attrs), req->dispatched_time_);

    if (ec == asio::error::operation_aborted) {
      // TODO(SA): fix tracing
      //  self->span_->add_tag(tracing::attributes::orphan, "aborted");
      return req->try_callback(resp,
                               req->idempotent() ? errc::common::unambiguous_timeout
                                                 : errc::common::ambiguous_timeout);
    }
    if (ec == errc::common::request_canceled) {
      if (!req->idempotent() && !allows_non_idempotent_retry(reason)) {
        // TODO(SA): fix tracing
        // self->span_->add_tag(tracing::attributes::orphan, "canceled");
        return req->try_callback(resp, ec);
      }
      backoff_and_retry(
        req, reason == retry_reason::do_not_retry ? retry_reason::node_not_available : reason);
      return;
    }
    key_value_status_code status{ key_value_status_code::unknown };
    if (resp) {
      status = resp->status_code_;
    }
    if (status == key_value_status_code::not_my_vbucket) {
      reason = retry_reason::key_value_not_my_vbucket;
    }
    if (status == key_value_status_code::unknown && error_info &&
        error_info.value().has_retry_attribute()) {
      reason = retry_reason::key_value_error_map_retry_indicated;
    } else {
      switch (status) {
        case key_value_status_code::locked:
          if (req->command_ != protocol::client_opcode::unlock) {
            /**
             * special case for unlock command, when it should not be retried, because it does not
             * make sense (someone else unlocked the document)
             */
            reason = retry_reason::key_value_locked;
          }
          break;
        case key_value_status_code::temporary_failure:
          reason = retry_reason::key_value_temporary_failure;
          break;
        case key_value_status_code::sync_write_in_progress:
          reason = retry_reason::key_value_sync_write_in_progress;
          break;
        case key_value_status_code::sync_write_re_commit_in_progress:
          reason = retry_reason::key_value_sync_write_re_commit_in_progress;
          break;
        default:
          break;
      }
    }
    if (reason == retry_reason::do_not_retry || !backoff_and_retry(req, reason)) {
      return req->try_callback(resp, ec);
    }
  }

  void handle_response(std::shared_ptr<mcbp::queue_request> req,
                       std::error_code error,
                       retry_reason reason,
                       io::mcbp_message msg,
                       std::optional<key_value_error_map_info> error_info) override
  {
    std::shared_ptr<mcbp::queue_response> resp{};
    auto header = msg.header_data();
    auto [packet, size, err] =
      codec_.decode_packet(gsl::span(header.data(), header.size()), msg.body);
    if (err) {
      error = errc::network::protocol_error;
    } else {
      resp = std::make_shared<mcbp::queue_response>(std::move(packet));
    }
    resolve_response(req, resp, error, reason, std::move(error_info));
  }

  auto direct_dispatch(std::shared_ptr<mcbp::queue_request> req) -> std::error_code
  {
    if (closed_) {
      req->cancel(errc::network::bucket_closed);
      return errc::network::bucket_closed;
    }
    if (!configured_) {
      return defer_command([self = shared_from_this(), req](std::error_code ec) {
        if (ec == errc::common::request_canceled) {
          return req->cancel(ec);
        }
        self->direct_dispatch(req);
      });
    }

    req->dispatched_time_ = std::chrono::steady_clock::now();

    auto session = route_request(req);
    if (!session || !session->has_config()) {
      return defer_command([self = shared_from_this(), req](std::error_code ec) mutable {
        if (ec == errc::common::request_canceled) {
          return req->cancel(ec);
        }
        self->direct_dispatch(std::move(req));
      });
    }
    if (session->is_stopped()) {
      if (backoff_and_retry(req, retry_reason::node_not_available)) {
        return {};
      }
      return errc::common::service_not_available;
    }
    req->opaque_ = session->next_opaque();
    session->write_and_subscribe(req, shared_from_this());
    return {};
  }

  auto direct_re_queue(const std::shared_ptr<mcbp::queue_request>& req, bool is_retry)
    -> std::error_code
  {
    auto handle_error = [is_retry, req](std::error_code ec) {
      // We only want to log an error on retries if the error isn't cancelled.
      if (!is_retry || (is_retry && ec != errc::common::request_canceled)) {
        CB_LOG_ERROR("reschedule failed, failing request ({})", ec.message());
      }

      req->try_callback({}, ec);
    };

    CB_LOG_DEBUG("request being re-queued. opaque={}, opcode={}", req->opaque_, req->command_);

    auto session = route_request(req);
    if (!session || !session->has_config()) {
      return defer_command([self = shared_from_this(), req](std::error_code ec) {
        if (ec == errc::common::request_canceled) {
          return req->cancel(ec);
        }
        self->direct_dispatch(req);
      });
    }
    if (session->is_stopped()) {
      if (backoff_and_retry(req, retry_reason::node_not_available)) {
        return {};
      }
      handle_error(errc::common::service_not_available);
      return errc::common::service_not_available;
    }
    req->opaque_ = session->next_opaque();
    auto data = codec_.encode_packet(*req);
    if (!data) {
      CB_LOG_DEBUG("unable to encode packet. ec={}", data.error().message());
      handle_error(data.error());
      return data.error();
    }
    session->write_and_subscribe(
      req->opaque_,
      std::move(data.value()),
      [self = shared_from_this(), req, session](
        std::error_code error,
        retry_reason reason,
        io::mcbp_message msg,
        std::optional<key_value_error_map_info> error_info) {
        std::shared_ptr<mcbp::queue_response> resp{};
        auto header = msg.header_data();
        auto [packet, size, err] =
          self->codec_.decode_packet(gsl::span(header.data(), header.size()), msg.body);
        if (err) {
          error = errc::network::protocol_error;
        } else {
          resp = std::make_shared<mcbp::queue_response>(std::move(packet));
        }
        return self->resolve_response(req, resp, error, reason, std::move(error_info));
      });
    return {};
  }

  auto backoff_and_retry(const std::shared_ptr<mcbp::queue_request>& request, retry_reason reason)
    -> bool
  {
    auto action = retry_orchestrator::should_retry(request, reason);
    auto retried = action.need_to_retry();
    if (retried) {
      auto timer = std::make_shared<asio::steady_timer>(ctx_);
      timer->expires_after(action.duration());
      timer->async_wait([self = shared_from_this(), request](auto error) {
        if (error == asio::error::operation_aborted) {
          return;
        }
        self->direct_re_queue(request, true);
      });
      request->set_retry_backoff(timer);
    }
    return retried;
  }

  auto route_request(const std::shared_ptr<mcbp::queue_request>& req)
    -> std::optional<io::mcbp_session>
  {
    if (req->key_.empty()) {
      if (auto server = server_by_vbucket(req->vbucket_, req->replica_index_); server) {
        return find_session_by_index(server.value());
      }
    } else if (auto [partition, server] = map_id(req->key_, req->replica_index_); server) {
      req->vbucket_ = partition;
      return find_session_by_index(server.value());
    }
    return std::nullopt;
  }

  [[nodiscard]] auto server_by_vbucket(std::uint16_t vbucket, std::size_t node_index)
    -> std::optional<std::size_t>
  {
    const std::scoped_lock lock(config_mutex_);
    if (config_) {
      return config_->server_by_vbucket(vbucket, node_index);
    }
    return std::nullopt;
  }

  [[nodiscard]] auto map_id(const document_id& id)
    -> std::pair<std::uint16_t, std::optional<std::size_t>>
  {
    const std::scoped_lock lock(config_mutex_);
    if (config_) {
      return config_->map_key(id.key(), id.node_index());
    }
    return { 0, std::nullopt };
  }

  auto config_rev() const -> std::string
  {
    const std::scoped_lock lock(config_mutex_);
    if (config_) {
      return config_->rev_str();
    }
    return "<no-config>";
  }

  [[nodiscard]] auto map_id(const std::vector<std::byte>& key, std::size_t node_index)
    -> std::pair<std::uint16_t, std::optional<std::size_t>>
  {
    const std::scoped_lock lock(config_mutex_);
    if (config_) {
      return config_->map_key(key, node_index);
    }
    return { 0, std::nullopt };
  }

  void restart_sessions()
  {
    const std::scoped_lock lock(config_mutex_, sessions_mutex_);
    if (!config_) {
      return;
    }

    std::size_t kv_node_index{ 0 };
    for (std::size_t index = 0; index < config_->nodes.size(); ++index) {
      const auto& node = config_->nodes[index];

      const auto& hostname = node.hostname_for(origin_.options().network);
      auto port = node.port_or(
        origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
      if (port == 0) {
        continue;
      }

      auto ptr =
        std::find_if(sessions_.begin(), sessions_.end(), [&hostname, &port](const auto& session) {
          return session.second.bootstrap_hostname() == hostname &&
                 session.second.bootstrap_port_number() == port;
        });
      if (ptr != sessions_.end()) {

        if (auto found_kv_node_index = ptr->first; found_kv_node_index != kv_node_index) {
          if (auto current = sessions_.find(kv_node_index); current == sessions_.end()) {
            CB_LOG_WARNING(
              R"({} KV node index mismatch: config rev={} states that address="{}:{}" should be at idx={}, )"
              R"(but it is at idx={} ("{}"). Moving session to idx={}.)",
              log_prefix_,
              config_->rev_str(),
              hostname,
              port,
              kv_node_index,
              found_kv_node_index,
              ptr->second.id(),
              kv_node_index);
            sessions_.insert_or_assign(kv_node_index, std::move(ptr->second));
            sessions_.erase(ptr);
          } else {
            CB_LOG_WARNING(
              R"({} KV node index mismatch: config rev={} states that address="{}:{}" should be at idx={}, )"
              R"(but it is at idx={} ("{}"). Slot with idx={} is holds session with address="{}" ("{}"), swapping them.)",
              log_prefix_,
              config_->rev_str(),
              hostname,
              port,
              kv_node_index,
              found_kv_node_index,
              ptr->second.id(),
              kv_node_index,
              current->second.bootstrap_address(),
              current->second.id());
            std::swap(current->second, ptr->second);
          }
        }
        ++kv_node_index;
        continue;
      }
      const couchbase::core::origin origin(
        origin_.credentials(), hostname, port, origin_.options());
      io::mcbp_session session =
        origin_.options().enable_tls
          ? io::mcbp_session(client_id_,
                             node.node_uuid,
                             ctx_,
                             tls_,
                             origin,
                             state_listener_,
                             name_,
                             known_features_)
          : io::mcbp_session(
              client_id_, node.node_uuid, ctx_, origin, state_listener_, name_, known_features_);
      CB_LOG_DEBUG(R"({} rev={}, restart idx={}, session="{}", address="{}:{}")",
                   log_prefix_,
                   config_->rev_str(),
                   node.index,
                   session.id(),
                   hostname,
                   port);
      session.bootstrap(
        [self = shared_from_this(), session](std::error_code err,
                                             topology::configuration cfg) mutable {
          if (err) {
            return self->remove_session(session.id());
          }
          self->update_config(std::move(cfg));
          session.on_configuration_update(self);
          session.on_stop([id = session.id(), self]() {
            self->remove_session(id);
          });
          self->drain_deferred_queue({});
        },
        true);
      sessions_.insert_or_assign(index, std::move(session));
      ++kv_node_index;
    }
  }

  void remove_session(const std::string& id)
  {
    bool found{ false };
    const std::scoped_lock lock(sessions_mutex_);
    for (auto ptr = sessions_.cbegin(); ptr != sessions_.cend();) {
      if (ptr->second.id() == id) {
        CB_LOG_DEBUG(R"({} removed session id="{}", address="{}", bootstrap_address="{}:{}")",
                     log_prefix_,
                     ptr->second.id(),
                     ptr->second.remote_address(),
                     ptr->second.bootstrap_hostname(),
                     ptr->second.bootstrap_port());
        ptr = sessions_.erase(ptr);
        found = true;
      } else {
        ptr = std::next(ptr);
      }
    }

    if (found) {
      asio::post(asio::bind_executor(ctx_, [self = shared_from_this()]() {
        return self->restart_sessions();
      }));
    }
  }

  void bootstrap(utils::movable_function<void(std::error_code, topology::configuration)>&& handler)
  {
    if (state_listener_) {
      state_listener_->register_config_listener(shared_from_this());
    }
    io::mcbp_session new_session =
      origin_.options().enable_tls
        ? io::mcbp_session(
            client_id_, {}, ctx_, tls_, origin_, state_listener_, name_, known_features_)
        : io::mcbp_session(client_id_, {}, ctx_, origin_, state_listener_, name_, known_features_);
    new_session.bootstrap([self = shared_from_this(), new_session, h = std::move(handler)](
                            std::error_code ec, topology::configuration cfg) mutable {
      if (ec) {
        CB_LOG_WARNING(R"({} failed to bootstrap session ec={}, bucket="{}")",
                       new_session.log_prefix(),
                       ec.message(),
                       self->name_);
        self->remove_session(new_session.id());
      } else {
        const std::size_t this_index = new_session.index();
        new_session.on_configuration_update(self);
        new_session.on_stop([id = new_session.id(), self]() {
          self->remove_session(id);
        });

        {
          const std::scoped_lock lock(self->sessions_mutex_);
          self->sessions_.insert_or_assign(this_index, std::move(new_session));
        }
        self->update_config(cfg);
        self->drain_deferred_queue({});
        self->poll_config({});
      }
      asio::post(
        asio::bind_executor(self->ctx_, [h = std::move(h), ec, cfg = std::move(cfg)]() mutable {
          h(ec, cfg);
        }));
    });
  }

  void with_configuration(
    utils::movable_function<void(std::error_code, std::shared_ptr<topology::configuration>)>&&
      handler)
  {
    if (closed_) {
      return handler(errc::network::configuration_not_available, nullptr);
    }
    if (configured_) {
      std::shared_ptr<topology::configuration> config{};
      {
        const std::scoped_lock config_lock(config_mutex_);
        config = config_;
      }
      if (config) {
        return handler({}, config);
      }
      return handler(errc::network::configuration_not_available, nullptr);
    }
    const std::scoped_lock lock(deferred_commands_mutex_);
    deferred_commands_.emplace(
      [self = shared_from_this(), handler = std::move(handler)](std::error_code ec) mutable {
        if (ec == errc::common::request_canceled || self->closed_ || !self->configured_) {
          return handler(errc::network::configuration_not_available, nullptr);
        }

        std::shared_ptr<topology::configuration> config{};
        {
          const std::scoped_lock config_lock(self->config_mutex_);
          config = self->config_;
        }
        if (config) {
          return handler({}, config);
        }
        return handler(errc::network::configuration_not_available, nullptr);
      });
  }

  void drain_deferred_queue(std::error_code ec)
  {
    std::queue<utils::movable_function<void(std::error_code)>> commands{};
    {
      const std::scoped_lock lock(deferred_commands_mutex_);
      std::swap(deferred_commands_, commands);
    }
    if (!commands.empty()) {
      CB_LOG_TRACE(
        R"({} draining deferred operation queue, size={})", log_prefix_, commands.size());
    }
    while (!commands.empty()) {
      commands.front()(ec);
      commands.pop();
    }
  }

  void fetch_config()
  {
    if (closed_) {
      return;
    }
    std::optional<io::mcbp_session> session{};
    {
      const std::scoped_lock lock(sessions_mutex_);
      if (sessions_.empty()) {
        CB_LOG_WARNING(R"({} unable to find connected session (sessions_ is empty), retry in {})",
                       log_prefix_,
                       heartbeat_interval_);
        return;
      }

      const std::size_t start = heartbeat_next_index_.fetch_add(1);
      std::size_t i = start;
      do {
        auto ptr = sessions_.find(i % sessions_.size());
        if (ptr != sessions_.end() && ptr->second.is_bootstrapped() &&
            ptr->second.supports_gcccp()) {
          session = ptr->second;
        }
        i = heartbeat_next_index_.fetch_add(1);
      } while (start % sessions_.size() != i % sessions_.size());
    }
    if (session) {
      protocol::client_request<protocol::get_cluster_config_request_body> req;
      req.opaque(session->next_opaque());
      session->write_and_flush(req.data());
    } else {
      CB_LOG_WARNING(R"({} unable to find connected session with GCCCP support, retry in {})",
                     log_prefix_,
                     heartbeat_interval_);
    }
  }

  void poll_config(std::error_code ec)
  {
    if (ec == asio::error::operation_aborted || closed_) {
      return;
    }
    if (heartbeat_timer_.expiry() > std::chrono::steady_clock::now()) {
      return;
    }

    fetch_config();

    heartbeat_timer_.expires_after(heartbeat_interval_);
    return heartbeat_timer_.async_wait([self = shared_from_this()](std::error_code e) {
      if (e == asio::error::operation_aborted) {
        return;
      }
      self->poll_config(e);
    });
  }

  void close()
  {
    if (bool expected_state{ false }; !closed_.compare_exchange_strong(expected_state, true)) {
      return;
    }

    heartbeat_timer_.cancel();

    drain_deferred_queue(errc::common::request_canceled);

    if (state_listener_ != nullptr) {
      state_listener_->unregister_config_listener(shared_from_this());
    }

    {
      const std::scoped_lock lock(config_listeners_mutex_);
      config_listeners_.clear();
    }

    std::map<size_t, io::mcbp_session> old_sessions;
    {
      const std::scoped_lock lock(sessions_mutex_);
      std::swap(old_sessions, sessions_);
    }
    for (auto& [index, session] : old_sessions) {
      session.stop(retry_reason::do_not_retry);
    }
  }

  /**
   * copies nodes from rhs that are not in lhs to output vector
   */
  void diff_nodes(const std::vector<topology::configuration::node>& lhs,
                  const std::vector<topology::configuration::node>& rhs,
                  std::vector<topology::configuration::node>& output)
  {
    for (const auto& re : rhs) {
      bool known = false;
      const auto& rhost = re.hostname_for(origin_.options().network);
      const auto rport = re.port_or(
        origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
      for (const auto& le : lhs) {
        const auto& lhost = le.hostname_for(origin_.options().network);
        const auto lport = le.port_or(
          origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
        if (rhost == lhost && rport == lport) {
          known = true;
          break;
        }
      }
      if (!known) {
        output.push_back(re);
      }
    }
  }

  void update_config(topology::configuration config) override
  {
    std::vector<topology::configuration::node> added{};
    std::vector<topology::configuration::node> removed{};
    bool sequence_changed = false;
    {
      const std::scoped_lock lock(config_mutex_);
      // MB-60405 fixes this for 7.6.2, but for earlier versions we need to protect against using a
      // config that has an empty vbucket map.  Ideally we only run into this condition on initial
      // bootstrap and that is handled in the session's update_config(), but just in case, only
      // accept a config w/ a non-empty vbucket map.
      if (config.vbmap && config.vbmap->empty()) {
        if (!config_) {
          CB_LOG_WARNING(
            "{} will not initialize configuration rev={} because config has an empty partition map",
            log_prefix_,
            config.rev_str());
        } else {
          CB_LOG_WARNING("{} will not update the configuration old={} -> new={}, because new "
                         "config has an empty partition map",
                         log_prefix_,
                         config_->rev_str(),
                         config.rev_str());
        }
        // this is to make sure we can get a correct config soon
        poll_config(errc::network::configuration_not_available);
        return;
      }
      if (!config_) {
        CB_LOG_DEBUG("{} initialize configuration rev={}", log_prefix_, config.rev_str());
      } else if (config.force) {
        CB_LOG_DEBUG("{} forced to accept configuration rev={}", log_prefix_, config.rev_str());
      } else if (!config.vbmap) {
        CB_LOG_DEBUG("{} will not update the configuration old={} -> new={}, because new config "
                     "does not have partition map",
                     log_prefix_,
                     config_->rev_str(),
                     config.rev_str());
        return;
      } else if (*config_ < config) {
        CB_LOG_DEBUG("{} will update the configuration old={} -> new={}",
                     log_prefix_,
                     config_->rev_str(),
                     config.rev_str());
      } else {
        return;
      }

      if (config_) {
        diff_nodes(config_->nodes, config.nodes, added);
        diff_nodes(config.nodes, config_->nodes, removed);
        if (added.empty() && removed.empty() && config.nodes.size() == config_->nodes.size()) {
          for (std::size_t i = 0; i < config.nodes.size(); ++i) {
            if (config.nodes[i] != config_->nodes[i]) {
              sequence_changed = true;
              break;
            }
          }
        } else {
          sequence_changed = true;
        }
      } else {
        sequence_changed = true;
        added = config.nodes;
      }
      config_.reset();
      config_ = std::make_shared<topology::configuration>(config);
      configured_ = true;

      {
        const std::scoped_lock listeners_lock(config_listeners_mutex_);
        for (const auto& listener : config_listeners_) {
          listener->update_config(*config_);
        }
      }
    }
    if (!added.empty() || !removed.empty() || sequence_changed) {
      const std::scoped_lock lock(sessions_mutex_);
      std::map<size_t, io::mcbp_session> new_sessions{};

      std::size_t next_index{ 0 };
      for (const auto& node : config.nodes) {
        const auto& hostname = node.hostname_for(origin_.options().network);
        auto port = node.port_or(
          origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
        if (port == 0) {
          continue;
        }

        bool reused_session{ false };
        for (auto it = sessions_.begin(); it != sessions_.end(); ++it) {
          if (it->second.bootstrap_hostname() == hostname &&
              it->second.bootstrap_port_number() == port) {
            CB_LOG_DEBUG(R"({} rev={}, preserve session="{}", address="{}:{}", index={}->{})",
                         log_prefix_,
                         config.rev_str(),
                         it->second.id(),
                         it->second.bootstrap_hostname(),
                         it->second.bootstrap_port(),
                         it->first,
                         next_index);
            new_sessions.insert_or_assign(next_index, std::move(it->second));
            reused_session = true;
            ++next_index;
            sessions_.erase(it);
            break;
          }
        }
        if (reused_session) {
          continue;
        }

        const couchbase::core::origin origin(
          origin_.credentials(), hostname, port, origin_.options());
        io::mcbp_session session =
          origin_.options().enable_tls
            ? io::mcbp_session(client_id_,
                               node.node_uuid,
                               ctx_,
                               tls_,
                               origin,
                               state_listener_,
                               name_,
                               known_features_)
            : io::mcbp_session(
                client_id_, node.node_uuid, ctx_, origin, state_listener_, name_, known_features_);
        CB_LOG_DEBUG(R"({} rev={}, add session="{}", address="{}:{}", index={})",
                     log_prefix_,
                     config.rev_str(),
                     session.id(),
                     hostname,
                     port,
                     node.index);
        session.bootstrap(
          [self = shared_from_this(), session, idx = next_index](
            std::error_code err, topology::configuration cfg) mutable {
            if (err) {
              CB_LOG_WARNING(
                R"({} failed to bootstrap session="{}", address="{}:{}", index={}, ec={})",
                session.log_prefix(),
                session.id(),
                session.bootstrap_hostname(),
                session.bootstrap_port(),
                idx,
                err.message());
              return self->remove_session(session.id());
            }
            self->update_config(std::move(cfg));
            session.on_configuration_update(self);
            session.on_stop([id = session.id(), self]() {
              self->remove_session(id);
            });
            self->drain_deferred_queue({});
          },
          true);
        new_sessions.insert_or_assign(next_index, std::move(session));
        ++next_index;
      }
      std::swap(sessions_, new_sessions);

      for (auto it = new_sessions.begin(); it != new_sessions.end(); ++it) {
        CB_LOG_DEBUG(R"({} rev={}, drop session="{}", address="{}:{}", index={})",
                     log_prefix_,
                     config.rev_str(),
                     it->second.id(),
                     it->second.bootstrap_hostname(),
                     it->second.bootstrap_port(),
                     it->first);
        asio::post(asio::bind_executor(ctx_, [session = std::move(it->second)]() mutable {
          return session.stop(retry_reason::do_not_retry);
        }));
      }
    }
  }

  [[nodiscard]] auto find_session_by_index(std::size_t index) const
    -> std::optional<io::mcbp_session>
  {
    const std::scoped_lock lock(sessions_mutex_);
    if (auto ptr = sessions_.find(index); ptr != sessions_.end()) {
      return ptr->second;
    }
    return {};
  }

  [[nodiscard]] auto next_session_index() -> std::size_t
  {
    const std::scoped_lock lock(sessions_mutex_);

    if (auto index = round_robin_next_.fetch_add(1); index < sessions_.size()) {
      return index;
    }
    round_robin_next_ = 0;
    return 0;
  }

  [[nodiscard]] auto default_timeout() const -> std::chrono::milliseconds
  {
    return origin_.options().default_timeout_for(service_type::key_value);
  }

  [[nodiscard]] auto name() const -> const std::string&
  {
    return name_;
  }

  [[nodiscard]] auto log_prefix() const -> const std::string&
  {
    return client_id_;
  }

  [[nodiscard]] auto is_closed() const -> bool
  {
    return closed_;
  }

  [[nodiscard]] auto is_configured() const -> bool
  {
    return configured_;
  }

  [[nodiscard]] auto tracer() const -> std::shared_ptr<tracing::tracer_wrapper>
  {
    return tracer_;
  }

  [[nodiscard]] auto meter() const -> std::shared_ptr<metrics::meter_wrapper>
  {
    return meter_;
  }

  [[nodiscard]] auto app_telemetry_meter() const -> std::shared_ptr<core::app_telemetry_meter>
  {
    return app_telemetry_meter_;
  }

  void export_diag_info(diag::diagnostics_result& res) const
  {
    std::map<size_t, io::mcbp_session> sessions;
    {
      const std::scoped_lock lock(sessions_mutex_);
      sessions = sessions_;
    }
    for (const auto& [index, session] : sessions) {
      res.services[service_type::key_value].emplace_back(session.diag_info());
    }
  }

  void ping(const std::shared_ptr<diag::ping_collector>& collector,
            std::optional<std::chrono::milliseconds> timeout)
  {
    std::map<size_t, io::mcbp_session> sessions;
    {
      const std::scoped_lock lock(sessions_mutex_);
      sessions = sessions_;
    }
    for (const auto& [index, session] : sessions) {
      session.ping(collector->build_reporter(), timeout);
    }
  }

  auto default_retry_strategy() const -> std::shared_ptr<couchbase::retry_strategy>
  {
    return origin_.options().default_retry_strategy_;
  }

  void on_configuration_update(std::shared_ptr<config_listener> handler)
  {
    const std::scoped_lock lock(config_listeners_mutex_);
    config_listeners_.emplace_back(std::move(handler));
  }

  auto defer_command(utils::movable_function<void(std::error_code)> command) -> std::error_code
  {
    const std::scoped_lock lock_for_deferred_commands(deferred_commands_mutex_);
    deferred_commands_.emplace(std::move(command));
    return {};
  }

private:
  const std::string client_id_;
  const std::string name_;
  const std::string log_prefix_;
  const origin origin_;
  const std::shared_ptr<tracing::tracer_wrapper> tracer_;
  const std::shared_ptr<metrics::meter_wrapper> meter_;
  const std::shared_ptr<core::app_telemetry_meter> app_telemetry_meter_;
  const std::vector<protocol::hello_feature> known_features_;
  const std::shared_ptr<impl::bootstrap_state_listener> state_listener_;
  mcbp::codec codec_;

  asio::io_context& ctx_;
  asio::ssl::context& tls_;

  asio::steady_timer heartbeat_timer_;
  std::chrono::milliseconds heartbeat_interval_;
  std::atomic_size_t heartbeat_next_index_{ 0 };

  std::atomic_bool closed_{ false };
  std::atomic_bool configured_{ false };

  std::shared_ptr<topology::configuration> config_{};
  mutable std::mutex config_mutex_{};

  std::vector<std::shared_ptr<config_listener>> config_listeners_{};
  std::mutex config_listeners_mutex_{};

  std::queue<utils::movable_function<void(std::error_code)>> deferred_commands_{};
  std::mutex deferred_commands_mutex_{};

  std::map<size_t, io::mcbp_session> sessions_{};
  mutable std::mutex sessions_mutex_{};
  std::atomic_size_t round_robin_next_{ 0 };
};

bucket::bucket(std::string client_id,
               asio::io_context& ctx,
               asio::ssl::context& tls,
               std::shared_ptr<tracing::tracer_wrapper> tracer,
               std::shared_ptr<metrics::meter_wrapper> meter,
               std::shared_ptr<core::app_telemetry_meter> app_telemetry_meter,
               std::string name,
               couchbase::core::origin origin,
               std::vector<protocol::hello_feature> known_features,
               std::shared_ptr<impl::bootstrap_state_listener> state_listener)

  : ctx_(ctx)
  , impl_{ std::make_shared<bucket_impl>(std::move(client_id),
                                         std::move(name),
                                         std::move(origin),
                                         std::move(tracer),
                                         std::move(meter),
                                         std::move(app_telemetry_meter),
                                         std::move(known_features),
                                         std::move(state_listener),
                                         ctx,
                                         tls) }
{
}

bucket::~bucket()
{
  impl_->close();
}

void
bucket::export_diag_info(diag::diagnostics_result& res) const
{
  return impl_->export_diag_info(res);
}

void
bucket::ping(const std::shared_ptr<diag::ping_collector>& collector,
             std::optional<std::chrono::milliseconds> timeout)
{
  return impl_->ping(collector, timeout);
}

void
bucket::fetch_config()
{
  return impl_->fetch_config();
}

void
bucket::update_config(topology::configuration config)
{
  return impl_->update_config(std::move(config));
}

auto
bucket::name() const -> const std::string&
{
  return impl_->name();
}

void
bucket::close()
{
  return impl_->close();
}

auto
bucket::log_prefix() const -> const std::string&
{
  return impl_->log_prefix();
}

auto
bucket::tracer() const -> std::shared_ptr<tracing::tracer_wrapper>
{
  return impl_->tracer();
}

auto
bucket::meter() const -> std::shared_ptr<metrics::meter_wrapper>
{
  return impl_->meter();
}

auto
bucket::app_telemetry_meter() const -> std::shared_ptr<core::app_telemetry_meter>
{
  return impl_->app_telemetry_meter();
}

auto
bucket::default_retry_strategy() const -> std::shared_ptr<couchbase::retry_strategy>
{
  return impl_->default_retry_strategy();
}

void
bucket::on_configuration_update(std::shared_ptr<config_listener> handler)
{
  return impl_->on_configuration_update(std::move(handler));
}

void
bucket::bootstrap(utils::movable_function<void(std::error_code, topology::configuration)>&& handler)
{
  return impl_->bootstrap(std::move(handler));
}

void
bucket::with_configuration(
  utils::movable_function<void(std::error_code, std::shared_ptr<topology::configuration>)>&&
    handler)
{
  return impl_->with_configuration(std::move(handler));
}

auto
bucket::is_closed() const -> bool
{
  return impl_->is_closed();
}

auto
bucket::is_configured() const -> bool
{
  return impl_->is_configured();
}

void
bucket::defer_command(utils::movable_function<void(std::error_code)> command)
{
  impl_->defer_command(std::move(command));
}

auto
bucket::default_timeout() const -> std::chrono::milliseconds
{
  return impl_->default_timeout();
}

auto
bucket::find_session_by_index(std::size_t index) const -> std::optional<io::mcbp_session>
{
  return impl_->find_session_by_index(index);
}

auto
bucket::next_session_index() -> std::size_t
{
  return impl_->next_session_index();
}

auto
bucket::map_id(const document_id& id) -> std::pair<std::uint16_t, std::optional<std::size_t>>
{
  return impl_->map_id(id);
}

auto
bucket::config_rev() const -> std::string
{
  return impl_->config_rev();
}

auto
bucket::direct_dispatch(std::shared_ptr<mcbp::queue_request> req) -> std::error_code
{
  return impl_->direct_dispatch(std::move(req));
}

auto
bucket::direct_re_queue(const std::shared_ptr<mcbp::queue_request>& req, bool is_retry)
  -> std::error_code
{
  return impl_->direct_re_queue(req, is_retry);
}
} // namespace couchbase::core
