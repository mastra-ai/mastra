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

#include "config_tracker.hxx"

#include <couchbase/build_config.hxx>

#include "core/impl/bootstrap_state_listener.hxx"
#include "core/logger/logger.hxx"
#include "core/origin.hxx"
#include "core/protocol/client_request.hxx"
#include "core/protocol/cmd_get_cluster_config.hxx"
#include "core/utils/join_strings.hxx"
#include "http_session_manager.hxx"
#include "mcbp_session.hxx"

#include <asio/steady_timer.hpp>
#include <spdlog/fmt/bundled/chrono.h>

namespace couchbase::core::io
{

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
class cluster_config_tracker_impl
  : public std::enable_shared_from_this<cluster_config_tracker_impl>
  , public config_listener
  , public columnar::background_bootstrap_listener
{
#else
class cluster_config_tracker_impl
  : public std::enable_shared_from_this<cluster_config_tracker_impl>
  , public config_listener
{
#endif
public:
  cluster_config_tracker_impl(std::string client_id,
                              couchbase::core::origin origin,
                              asio::io_context& ctx,
                              asio::ssl::context& tls,
                              std::shared_ptr<impl::bootstrap_state_listener> state_listener,
                              std::vector<protocol::hello_feature> supported_features = {})
    : client_id_{ std::move(client_id) }
    , origin_{ std::move(origin) }
    , ctx_{ ctx }
    , tls_{ tls }
    , heartbeat_timer_(ctx_)
    , heartbeat_interval_{ origin_.options().config_poll_floor >
                               origin_.options().config_poll_interval
                             ? origin_.options().config_poll_floor
                             : origin_.options().config_poll_interval }
    , state_listener_{ std::move(state_listener) }
    , supported_features_{ std::move(supported_features) }
  {
    log_prefix_ = fmt::format("[{}/-]", client_id_);
  }

  void close()
  {
    if (bool expected_state{ false }; !closed_.compare_exchange_strong(expected_state, true)) {
      return;
    }
    heartbeat_timer_.cancel();
    if (state_listener_ != nullptr) {
      state_listener_->unregister_config_listener(shared_from_this());
    }

    {
      const std::scoped_lock lock(config_listeners_mutex_);
      config_listeners_.clear();
    }

    std::vector<io::mcbp_session> old_sessions;
    {
      const std::scoped_lock lock(sessions_mutex_);
      std::swap(old_sessions, sessions_);
    }
    for (auto& session : old_sessions) {
      session.stop(retry_reason::do_not_retry);
    }
  }

  void create_sessions(
    utils::movable_function<
      void(std::error_code, const topology::configuration&, const cluster_options&)>&& handler)
  {
    io::mcbp_session new_session =
      origin_.options().enable_tls
        ? io::mcbp_session(client_id_, {}, ctx_, tls_, origin_, state_listener_)
        : io::mcbp_session(client_id_, {}, ctx_, origin_, state_listener_);
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    new_session.add_background_bootstrap_listener(shared_from_this());
#endif
    new_session.bootstrap([self = shared_from_this(), new_session, h = std::move(handler)](
                            std::error_code ec, const topology::configuration& cfg) mutable {
      if (!ec) {
        if (self->origin_.options().network == "auto") {
          self->origin_.options().network = cfg.select_network(new_session.bootstrap_hostname());
          if (self->origin_.options().network == "default") {
            CB_LOG_DEBUG(R"({} detected network is "{}")",
                         new_session.log_prefix(),
                         self->origin_.options().network);
          } else {
            CB_LOG_INFO(R"({} detected network is "{}")",
                        new_session.log_prefix(),
                        self->origin_.options().network);
          }
        }
        if (self->origin_.options().network != "default") {
          self->origin_.set_nodes_from_config(cfg);
          CB_LOG_INFO(
            "replace list of bootstrap nodes with addresses of alternative network \"{}\": [{}]",
            self->origin_.options().network,
            utils::join_strings(self->origin_.get_nodes(), ","));
        }

        new_session.on_configuration_update(self);
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        self->notify_bootstrap_success(new_session.id());
#endif
        new_session.on_stop([id = new_session.id(), self]() {
          self->remove_session(id);
        });
        {
          const std::scoped_lock lock(self->sessions_mutex_);
          self->sessions_.emplace_back(std::move(new_session));
        }
        self->update_config(cfg);
        self->poll_config({});
      } else {
        // don't need to stop the session as if we hit this point the session will stop itself
        CB_LOG_WARNING(R"({} failed to bootstrap cluster session ec={}")",
                       new_session.log_prefix(),
                       ec.message());
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        if (new_session.last_bootstrap_error().has_value()) {
          self->notify_bootstrap_error(std::move(new_session).last_bootstrap_error().value());
        } else {
          self->notify_bootstrap_error(
            { ec, ec.message(), new_session.bootstrap_hostname(), new_session.bootstrap_port() });
        }
#endif
      }
      h(ec, cfg, self->origin_.options());
    });
  }

  void on_configuration_update(std::shared_ptr<config_listener> handler)
  {
    const std::scoped_lock lock(config_listeners_mutex_);
    config_listeners_.emplace_back(std::move(handler));
  }

  [[nodiscard]] auto supported_features() const -> std::vector<protocol::hello_feature>
  {
    if (!supported_features_.empty()) {
      return supported_features_;
    }
    std::vector<io::mcbp_session> sessions;
    std::vector<protocol::hello_feature> supported_features;
    {
      const std::scoped_lock lock(sessions_mutex_);
      sessions = sessions_;
    }
    for (const auto& session : sessions) {
      if (supported_features.empty()) {
        supported_features = session.supported_features();
      } else {
        // TODO(JC):  this seems like a larger problem....
        if (supported_features != session.supported_features()) {
          CB_LOG_WARNING("Supported features mismatch between sessions.");
        }
      }
    }
    return supported_features;
  }

  void register_state_listener()
  {
    if (state_listener_) {
      state_listener_->register_config_listener(shared_from_this());
    }
  }

  void update_config(topology::configuration config) override
  {
    update_cluster_config(config);
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void notify_bootstrap_error(const impl::bootstrap_error& error) override
  {
    std::set<std::shared_ptr<columnar::bootstrap_notification_subscriber>> subscribers;
    {
      const std::scoped_lock lock(bootstrap_notification_subscribers_mutex_);
      subscribers = bootstrap_notification_subscribers_;
    }
    for (const auto& subscriber : subscribers) {
      subscriber->notify_bootstrap_error(error);
    }
  }

  void notify_bootstrap_success(const std::string& session_id) override
  {
    std::set<std::shared_ptr<columnar::bootstrap_notification_subscriber>> subscribers;
    {
      const std::scoped_lock lock(bootstrap_notification_subscribers_mutex_);
      subscribers = bootstrap_notification_subscribers_;
    }
    for (const auto& subscriber : subscribers) {
      subscriber->notify_bootstrap_success(session_id);
    }
  }

  void register_bootstrap_notification_subscriber(
    std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber) override
  {
    const std::scoped_lock lock(bootstrap_notification_subscribers_mutex_);
    bootstrap_notification_subscribers_.insert(subscriber);
  }

  void unregister_bootstrap_notification_subscriber(
    std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber) override
  {
    const std::scoped_lock lock(bootstrap_notification_subscribers_mutex_);
    bootstrap_notification_subscribers_.erase(subscriber);
  }
#endif

  [[nodiscard]] auto has_config() const -> bool
  {
    return configured_;
  }

  [[nodiscard]] auto config() -> std::optional<topology::configuration>
  {
    const std::scoped_lock lock(config_mutex_);
    return config_;
  }

private:
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
        const std::size_t session_idx = i % sessions_.size();
        if (sessions_[session_idx].is_bootstrapped() && sessions_[session_idx].supports_gcccp()) {
          session = sessions_[session_idx];
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

  auto should_update_config(const topology::configuration& config) -> bool
  {
    if (!config_) {
      CB_LOG_DEBUG("{} initialize configuration rev={}", log_prefix_, config.rev_str());
    } else {
      if (config.force) {
        CB_LOG_DEBUG("{} forced to accept configuration rev={}", log_prefix_, config.rev_str());
      } else if (config_ < config) {
        CB_LOG_DEBUG("{} will update the configuration old={} -> new={}",
                     log_prefix_,
                     config_->rev_str(),
                     config.rev_str());
      } else {
        return false;
      }
    }
    return true;
  }

  void update_config_sessions(const topology::configuration& config)
  {
    const std::scoped_lock lock(sessions_mutex_);
    std::vector<io::mcbp_session> new_sessions{};

    for (const auto& node : config.nodes) {
      const auto& hostname = node.hostname_for(origin_.options().network);
      auto port = node.port_or(
        origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
      if (port == 0) {
        continue;
      }

      bool reused_session{ false };
      for (auto it = sessions_.begin(); it != sessions_.end(); ++it) {
        CB_LOG_DEBUG(R"({} rev={}, checking cluster session="{}", address="{}:{}")",
                     log_prefix_,
                     config.rev_str(),
                     it->id(),
                     it->bootstrap_hostname(),
                     it->bootstrap_port());
        if (it->bootstrap_hostname() == hostname && it->bootstrap_port_number() == port) {
          CB_LOG_DEBUG(R"({} rev={}, preserve cluster session="{}", address="{}:{}")",
                       log_prefix_,
                       config.rev_str(),
                       it->id(),
                       it->bootstrap_hostname(),
                       it->bootstrap_port());
          new_sessions.emplace_back(std::move(*it));
          reused_session = true;
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
          ? io::mcbp_session(client_id_, node.node_uuid, ctx_, tls_, origin, state_listener_)
          : io::mcbp_session(client_id_, node.node_uuid, ctx_, origin, state_listener_);
      CB_LOG_DEBUG(R"({} rev={}, add cluster session="{}", address="{}:{}")",
                   log_prefix_,
                   config.rev_str(),
                   session.id(),
                   hostname,
                   port);
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
      session.add_background_bootstrap_listener(shared_from_this());
#endif
      session.bootstrap([self = shared_from_this(), session](std::error_code err,
                                                             topology::configuration cfg) mutable {
        if (err) {
          CB_LOG_WARNING(R"({} failed to bootstrap cluster session="{}", address="{}:{}", ec={})",
                         session.log_prefix(),
                         session.id(),
                         session.bootstrap_hostname(),
                         session.bootstrap_port(),
                         err.message());
          return self->remove_session(session.id());
        }
        self->update_config(std::move(cfg));
        session.on_configuration_update(self);
        session.on_stop([id = session.id(), self]() {
          self->remove_session(id);
        });
      });
      new_sessions.emplace_back(std::move(session));
    }
    std::swap(sessions_, new_sessions);

    for (auto it = new_sessions.begin(); it != new_sessions.end(); ++it) {
      CB_LOG_DEBUG(R"({} rev={}, drop cluster session="{}", address="{}:{}")",
                   log_prefix_,
                   config.rev_str(),
                   it->id(),
                   it->bootstrap_hostname(),
                   it->bootstrap_port());
      asio::post(asio::bind_executor(ctx_, [session = std::move(*it)]() mutable {
        return session.stop(retry_reason::do_not_retry);
      }));
    }
  }

  void update_cluster_config(const topology::configuration& config)
  {
    std::vector<topology::configuration::node> added{};
    std::vector<topology::configuration::node> removed{};
    {
      const std::scoped_lock lock(config_mutex_);
      if (!should_update_config(config)) {
        return;
      }
      if (auto current_config = config_; current_config) {
        diff_nodes(current_config->nodes, config.nodes, added);
        diff_nodes(config.nodes, current_config->nodes, removed);
      } else {
        added = config.nodes;
      }
      config_.reset();
      config_ = config;
      configured_ = true;

      {
        const std::scoped_lock listeners_lock(config_listeners_mutex_);
        for (const auto& listener : config_listeners_) {
          listener->update_config(*config_);
        }
      }
    }
    if (!added.empty() || !removed.empty()) {
      update_config_sessions(config);
    }
  }

  void restart_sessions()
  {
    const std::scoped_lock lock(config_mutex_, sessions_mutex_);

    std::optional<topology::configuration> current_config = config_;
    if (!current_config.has_value()) {
      return;
    }

    for (std::size_t index = 0; index < current_config->nodes.size(); ++index) {
      const auto& node = current_config->nodes[index];

      const auto& hostname = node.hostname_for(origin_.options().network);
      auto port = node.port_or(
        origin_.options().network, service_type::key_value, origin_.options().enable_tls, 0);
      if (port == 0) {
        continue;
      }

      auto ptr =
        std::find_if(sessions_.begin(), sessions_.end(), [&hostname, &port](const auto& session) {
          return session.bootstrap_hostname() == hostname &&
                 session.bootstrap_port_number() == port;
        });
      if (ptr != sessions_.end()) {
        continue;
      }
      const couchbase::core::origin origin(
        origin_.credentials(), hostname, port, origin_.options());
      io::mcbp_session session =
        origin_.options().enable_tls
          ? io::mcbp_session(client_id_, node.node_uuid, ctx_, tls_, origin, state_listener_)
          : io::mcbp_session(client_id_, node.node_uuid, ctx_, origin, state_listener_);
      CB_LOG_DEBUG(R"({} rev={}, restart cluster session="{}", address="{}:{}")",
                   log_prefix_,
                   current_config->rev_str(),
                   session.id(),
                   hostname,
                   port);
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
      session.add_background_bootstrap_listener(shared_from_this());
#endif
      session.bootstrap([self = shared_from_this(), session](std::error_code err,
                                                             topology::configuration cfg) mutable {
        if (err) {
          return self->remove_session(session.id());
        }
        self->update_config(std::move(cfg));
        session.on_configuration_update(self);
        session.on_stop([id = session.id(), self]() {
          self->remove_session(id);
        });
      });
      sessions_.emplace_back(std::move(session));
    }
  }

  void remove_session(const std::string& id)
  {
    bool found{ false };
    const std::scoped_lock lock(sessions_mutex_);
    for (auto ptr = sessions_.cbegin(); ptr != sessions_.cend();) {
      if (ptr->id() == id) {
        CB_LOG_DEBUG(
          R"({} removed cluster session id="{}", address="{}", bootstrap_address="{}:{}")",
          log_prefix_,
          ptr->id(),
          ptr->remote_address(),
          ptr->bootstrap_hostname(),
          ptr->bootstrap_port());
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

  const std::string client_id_;
  couchbase::core::origin origin_{};
  std::string log_prefix_{};
  asio::io_context& ctx_;
  asio::ssl::context& tls_;

  asio::steady_timer heartbeat_timer_;
  std::chrono::milliseconds heartbeat_interval_;
  std::atomic_size_t heartbeat_next_index_{ 0 };

  std::atomic_bool configured_{ false };
  std::atomic_bool closed_{ false };

  const std::shared_ptr<impl::bootstrap_state_listener> state_listener_;
  const std::vector<protocol::hello_feature> supported_features_;

  std::mutex config_listeners_mutex_{};
  std::vector<std::shared_ptr<config_listener>> config_listeners_{};

  mutable std::mutex config_mutex_{};
  std::optional<topology::configuration> config_{};

  std::vector<io::mcbp_session> sessions_{};
  mutable std::mutex sessions_mutex_{};

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  std::set<std::shared_ptr<columnar::bootstrap_notification_subscriber>>
    bootstrap_notification_subscribers_{};
  std::mutex bootstrap_notification_subscribers_mutex_;
#endif
};

cluster_config_tracker::cluster_config_tracker(
  std::string client_id,
  couchbase::core::origin origin,
  asio::io_context& ctx,
  asio::ssl::context& tls,
  std::shared_ptr<impl::bootstrap_state_listener> state_listener)
  : impl_{ std::make_shared<cluster_config_tracker_impl>(std::move(client_id),
                                                         std::move(origin),
                                                         ctx,
                                                         tls,
                                                         std::move(state_listener)) }
{
}

cluster_config_tracker::~cluster_config_tracker()
{
  impl_->close();
}

void
cluster_config_tracker::close()
{
  return impl_->close();
}

void
cluster_config_tracker::create_sessions(
  utils::movable_function<
    void(std::error_code, const topology::configuration&, const cluster_options&)>&& handler)
{
  return impl_->create_sessions(std::move(handler));
}

void
cluster_config_tracker::on_configuration_update(std::shared_ptr<config_listener> handler)
{
  return impl_->on_configuration_update(std::move(handler));
}

void
cluster_config_tracker::register_state_listener()
{
  return impl_->register_state_listener();
}

void
cluster_config_tracker::update_config(topology::configuration config)
{
  return impl_->update_config(std::move(config));
}

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
void
cluster_config_tracker::notify_bootstrap_error(const impl::bootstrap_error& error)
{
  return impl_->notify_bootstrap_error(error);
}

void
cluster_config_tracker::notify_bootstrap_success(const std::string& session_id)
{
  return impl_->notify_bootstrap_success(session_id);
}

void
cluster_config_tracker::register_bootstrap_notification_subscriber(
  std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber)
{
  return impl_->register_bootstrap_notification_subscriber(std::move(subscriber));
}

void
cluster_config_tracker::unregister_bootstrap_notification_subscriber(
  std::shared_ptr<columnar::bootstrap_notification_subscriber> subscriber)
{
  return impl_->unregister_bootstrap_notification_subscriber(std::move(subscriber));
}
#endif

auto
cluster_config_tracker::has_config() const -> bool
{
  return impl_->has_config();
}

auto
cluster_config_tracker::config() const -> std::optional<topology::configuration>
{
  return impl_->config();
}

auto
cluster_config_tracker::supported_features() const -> std::vector<protocol::hello_feature>
{
  return impl_->supported_features();
}

} // namespace couchbase::core::io
