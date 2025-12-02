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

#include "core/cluster.hxx"

#include "analytics.hxx"
#include "core/agent_group.hxx"
#include "core/agent_group_config.hxx"
#include "core/cluster_options.hxx"
#include "core/core_sdk_shim.hxx"
#include "core/io/ip_protocol.hxx"
#include "core/origin.hxx"
#include "core/tls_verify_mode.hxx"
#include "core/transactions.hxx"
#include "core/utils/connection_string.hxx"
#include "core/utils/movable_function.hxx"
#include "diagnostics.hxx"
#include "error.hxx"
#include "internal_search_result.hxx"
#include "query.hxx"
#include "search.hxx"

#include <couchbase/analytics_index_manager.hxx>
#include <couchbase/analytics_options.hxx>
#include <couchbase/analytics_result.hxx>
#include <couchbase/bucket.hxx>
#include <couchbase/bucket_manager.hxx>
#include <couchbase/cluster.hxx>
#include <couchbase/cluster_options.hxx>
#include <couchbase/diagnostics_options.hxx>
#include <couchbase/diagnostics_result.hxx>
#include <couchbase/fmt/error.hxx>
#include <couchbase/fork_event.hxx>
#include <couchbase/ip_protocol.hxx>
#include <couchbase/ping_options.hxx>
#include <couchbase/ping_result.hxx>
#include <couchbase/query_index_manager.hxx>
#include <couchbase/query_options.hxx>
#include <couchbase/query_result.hxx>
#include <couchbase/search_index_manager.hxx>
#include <couchbase/search_options.hxx>
#include <couchbase/search_request.hxx>
#include <couchbase/tls_verify_mode.hxx>
#include <couchbase/transactions.hxx>

#include <asio/bind_executor.hpp>
#include <asio/detail/concurrency_hint.hpp>
#include <asio/execution_context.hpp>
#include <asio/post.hpp>

#include <functional>
#include <future>
#include <memory>
#include <string>
#include <string_view>
#include <system_error>
#include <utility>

namespace couchbase
{
cluster::cluster(std::shared_ptr<cluster_impl> impl)
  : impl_{ std::move(impl) }
{
}

namespace
{
auto
options_to_origin(const std::string& connection_string, cluster_options::built opts) -> core::origin
{
  core::cluster_credentials auth;
  auth.username = std::move(opts.username);
  auth.password = std::move(opts.password);
  auth.certificate_path = std::move(opts.certificate_path);
  auth.key_path = std::move(opts.key_path);
  auth.allowed_sasl_mechanisms = std::move(opts.allowed_sasl_mechanisms);

  core::cluster_options user_options;

  if (opts.default_retry_strategy != nullptr) {
    user_options.default_retry_strategy_ = std::move(opts.default_retry_strategy);
  }
  user_options.bootstrap_timeout = opts.timeouts.bootstrap_timeout;
  user_options.resolve_timeout = opts.timeouts.resolve_timeout;
  user_options.connect_timeout = opts.timeouts.connect_timeout;
  user_options.key_value_timeout = opts.timeouts.key_value_timeout;
  user_options.key_value_durable_timeout = opts.timeouts.key_value_durable_timeout;
  user_options.key_value_scan_timeout = opts.timeouts.key_value_scan_timeout;
  user_options.view_timeout = opts.timeouts.view_timeout;
  user_options.query_timeout = opts.timeouts.query_timeout;
  user_options.analytics_timeout = opts.timeouts.analytics_timeout;
  user_options.search_timeout = opts.timeouts.search_timeout;
  user_options.management_timeout = opts.timeouts.management_timeout;

  user_options.enable_tls = opts.security.enabled;
  if (opts.security.enabled) {
    if (opts.security.trust_certificate.has_value()) {
      user_options.trust_certificate = opts.security.trust_certificate.value();
    }
    if (opts.security.trust_certificate_value.has_value()) {
      user_options.trust_certificate_value = opts.security.trust_certificate_value.value();
    }
    switch (opts.security.tls_verify) {
      case couchbase::tls_verify_mode::none:
        user_options.tls_verify = core::tls_verify_mode::none;
        break;
      case couchbase::tls_verify_mode::peer:
        user_options.tls_verify = core::tls_verify_mode::peer;
        break;
    }
    user_options.disable_mozilla_ca_certificates = opts.security.disable_mozilla_ca_certificates;
    user_options.tls_disable_deprecated_protocols = opts.security.disable_deprecated_protocols;
    user_options.tls_disable_v1_2 = opts.security.disable_tls_v1_2;
  }

  if (opts.dns.nameserver) {
    user_options.dns_config =
      core::io::dns::dns_config(opts.dns.nameserver.value(),
                                opts.dns.port.value_or(core::io::dns::dns_config::default_port),
                                opts.dns.timeout);
  }
  user_options.enable_clustermap_notification = opts.behavior.enable_clustermap_notification;
  user_options.show_queries = opts.behavior.show_queries;
  user_options.dump_configuration = opts.behavior.dump_configuration;
  user_options.enable_mutation_tokens = opts.behavior.enable_mutation_tokens;
  user_options.enable_unordered_execution = opts.behavior.enable_unordered_execution;
  user_options.user_agent_extra = opts.behavior.user_agent_extra;
  user_options.preserve_bootstrap_nodes_order = opts.behavior.preserve_bootstrap_nodes_order;

  user_options.server_group = opts.network.server_group;
  user_options.enable_tcp_keep_alive = opts.network.enable_tcp_keep_alive;
  user_options.tcp_keep_alive_interval = opts.network.tcp_keep_alive_interval;
  user_options.config_poll_interval = opts.network.config_poll_interval;
  user_options.idle_http_connection_timeout = opts.network.idle_http_connection_timeout;
  if (opts.network.max_http_connections) {
    user_options.max_http_connections = opts.network.max_http_connections.value();
  }
  user_options.network = opts.network.network;
  if (user_options.network.empty()) {
    // this is deprecated option, but use it in case main options is empty
    user_options.network = opts.behavior.network;
  }
  switch (opts.network.ip_protocol) {
    case ip_protocol::any:
      user_options.use_ip_protocol = core::io::ip_protocol::any;
      break;
    case ip_protocol::force_ipv4:
      user_options.use_ip_protocol = core::io::ip_protocol::force_ipv4;
      break;
    case ip_protocol::force_ipv6:
      user_options.use_ip_protocol = core::io::ip_protocol::force_ipv6;
      break;
  }
  user_options.server_group = opts.network.server_group;

  user_options.enable_compression = opts.compression.enabled;

  user_options.enable_metrics = opts.metrics.enabled;
  if (opts.metrics.enabled) {
    user_options.meter = opts.metrics.meter;
    user_options.metrics_options.emit_interval = opts.metrics.emit_interval;
  }

  user_options.enable_tracing = opts.tracing.enabled;
  if (opts.tracing.enabled) {
    user_options.tracer = opts.tracing.tracer;
    user_options.tracing_options.orphaned_emit_interval = opts.tracing.orphaned_emit_interval;
    user_options.tracing_options.orphaned_sample_size = opts.tracing.orphaned_sample_size;

    user_options.tracing_options.threshold_emit_interval = opts.tracing.threshold_emit_interval;
    user_options.tracing_options.threshold_sample_size = opts.tracing.threshold_sample_size;
    user_options.tracing_options.key_value_threshold = opts.tracing.key_value_threshold;
    user_options.tracing_options.query_threshold = opts.tracing.query_threshold;
    user_options.tracing_options.view_threshold = opts.tracing.view_threshold;
    user_options.tracing_options.search_threshold = opts.tracing.search_threshold;
    user_options.tracing_options.analytics_threshold = opts.tracing.analytics_threshold;
    user_options.tracing_options.management_threshold = opts.tracing.management_threshold;
    user_options.tracing_options.eventing_threshold = opts.tracing.eventing_threshold;
  }
  user_options.transactions = opts.transactions;

  user_options.enable_app_telemetry = opts.application_telemetry.enabled;
  if (opts.application_telemetry.enabled) {
    user_options.app_telemetry_endpoint = opts.application_telemetry.endpoint;
    user_options.app_telemetry_ping_interval = opts.application_telemetry.ping_interval;
    user_options.app_telemetry_ping_timeout = opts.application_telemetry.ping_timeout;
    user_options.app_telemetry_backoff_interval = opts.application_telemetry.backoff_interval;
  }

  // connection string might override some user options
  return { auth, core::utils::parse_connection_string(connection_string, user_options) };
}

constexpr auto
fork_event_to_asio(fork_event event) -> asio::execution_context::fork_event
{
  switch (event) {
    case fork_event::parent:
      return asio::execution_context::fork_parent;
    case fork_event::child:
      return asio::execution_context::fork_child;
    case fork_event::prepare:
      return asio::execution_context::fork_prepare;
  }
  return asio::execution_context::fork_prepare;
}

} // namespace

class cluster_impl : public std::enable_shared_from_this<cluster_impl>
{
public:
  cluster_impl(std::string connection_string, const cluster_options& options)
    : connection_string_{ std::move(connection_string) }
    , options_{ options.build() }
  {
  }

  cluster_impl(std::string connection_string, cluster_options::built options)
    : connection_string_{ std::move(connection_string) }
    , options_{ std::move(options) }
  {
  }

  cluster_impl(const cluster_impl&) = delete;
  cluster_impl(cluster_impl&&) = delete;
  auto operator=(const cluster_impl&) = delete;
  auto operator=(cluster_impl&&) = delete;

  [[nodiscard]] auto connection_string() const -> const std::string&
  {
    return connection_string_;
  }

  [[nodiscard]] auto options() const -> const cluster_options::built&
  {
    return options_;
  }

  ~cluster_impl()
  {
    std::promise<void> barrier;
    auto future = barrier.get_future();

    // Spawn new thread to avoid joining IO thread from the same thread
    // We cannot use close() method here, as it is capturing self as a shared
    // pointer to extend lifetime for the user's callback. Here the reference
    // counter has reached zero already, so we can only capture `*this`.
    std::thread([this, barrier = std::move(barrier)]() mutable {
      do_close();
      barrier.set_value();
    }).detach();

    future.get();
  }

  static auto do_close_on_open(std::shared_ptr<cluster_impl>&& impl,
                               cluster_connect_handler&& handler,
                               std::error_code ec)
  {
    auto& io_context = impl->core_.io_context();
    asio::post(asio::bind_executor(
      io_context, [ec, impl = std::move(impl), handler = std::move(handler)]() mutable {
        std::thread([ec, impl = std::move(impl), handler = std::move(handler)]() mutable {
          {
            auto tmp = std::move(impl);
            auto barrier = std::make_shared<std::promise<void>>();
            auto future = barrier->get_future();
            tmp->close([barrier] {
              barrier->set_value();
            });
            future.get();
          }
          handler(ec, {});
        }).detach();
      }));
  }

  void open(cluster_connect_handler&& handler)
  {
    core_.open(
      options_to_origin(connection_string_, options_),
      [impl = shared_from_this(), handler = std::move(handler)](std::error_code ec) mutable {
        if (ec) {
          return do_close_on_open(std::move(impl), std::move(handler), ec);
        }
        return core::transactions::transactions::create(
          impl->core_,
          impl->core_.origin().second.options().transactions,
          [impl, handler = std::move(handler)](auto ec, auto txns) mutable {
            if (ec) {
              // Transactions need to open meta bucket, and this handler might be
              // called in the context of bootstrapping MCBP connection.
              // In case of error, we should be sure that the handler is scheduled
              // for execution after it returns from bootstrap, so that connection
              // will have chance to cleanup, and also we have to spawn separate
              // thread to actually deallocate the half-baked connection and stop
              // IO thread.
              return do_close_on_open(std::move(impl), std::move(handler), ec);
            }
            impl->transactions_ = std::move(txns);
            handler(ec, couchbase::cluster(std::move(impl)));
          });
      });
  }

  void query(std::string statement, query_options::built options, query_handler&& handler) const
  {
    return core_.execute(
      core::impl::build_query_request(std::move(statement), {}, std::move(options)),
      [handler = std::move(handler)](auto resp) {
        return handler(core::impl::make_error(resp.ctx), core::impl::build_result(resp));
      });
  }

  void analytics_query(std::string statement,
                       analytics_options::built options,
                       analytics_handler&& handler) const
  {
    return core_.execute(
      core::impl::build_analytics_request(std::move(statement), std::move(options), {}, {}),
      [handler = std::move(handler)](auto resp) {
        return handler(core::impl::make_error(resp.ctx), core::impl::build_result(resp));
      });
  }

  void ping(const ping_options::built& options, ping_handler&& handler) const
  {
    return core_.ping(options.report_id,
                      {},
                      core::impl::to_core_service_types(options.service_types),
                      options.timeout,
                      [handler = std::move(handler)](const auto& resp) mutable {
                        return handler({}, core::impl::build_result(resp));
                      });
  };

  void diagnostics(const diagnostics_options::built& options, diagnostics_handler&& handler) const
  {
    return core_.diagnostics(options.report_id,
                             [handler = std::move(handler)](const auto& resp) mutable {
                               return handler({}, core::impl::build_result(resp));
                             });
  }

  void search(std::string index_name,
              couchbase::search_request request,
              const search_options::built& options,
              search_handler&& handler) const
  {
    return core_.execute(
      core::impl::build_search_request(std::move(index_name), std::move(request), options, {}, {}),
      [handler = std::move(handler)](const auto& resp) mutable {
        return handler(core::impl::make_error(resp.ctx),
                       search_result{ internal_search_result{ resp } });
      });
  }

  void notify_fork(fork_event event)
  {
    if (event == fork_event::prepare) {
      io_.stop();
      io_thread_.join();
    } else {
      // TODO(SA): close all sockets in fork_event::child
      io_.restart();
      io_thread_ = std::thread{ [&io = io_] {
        io.run();
      } };
    }
    io_.notify_fork(fork_event_to_asio(event));

    if (event != fork_event::child && transactions_) {
      transactions_->notify_fork(event);
    }
  }

  void close(core::utils::movable_function<void()> handler)
  {
    // Spawn new thread to avoid joining IO thread from the same thread
    std::thread([self = shared_from_this(), handler = std::move(handler)]() mutable {
      self->do_close();
      handler();
    }).detach();
  }

  [[nodiscard]] auto core() const -> const core::cluster&
  {
    return core_;
  }

  [[nodiscard]] auto transactions() const -> std::shared_ptr<core::transactions::transactions>
  {
    return transactions_;
  }

private:
  void do_close()
  {
    if (auto txns = std::move(transactions_); txns != nullptr) {
      // blocks until cleanup is finished
      txns->close();
    }
    std::promise<void> core_stopped;
    auto f = core_stopped.get_future();
    core_.close([core_stopped = std::move(core_stopped)]() mutable {
      core_stopped.set_value();
    });
    f.get();
    io_.stop();
    if (io_thread_.joinable()) {
      io_thread_.join();
    }
  }

  std::string connection_string_;
  cluster_options::built options_;
  asio::io_context io_{ ASIO_CONCURRENCY_HINT_SAFE };
  core::cluster core_{ io_ };
  std::shared_ptr<core::transactions::transactions> transactions_{ nullptr };
  std::thread io_thread_{ [&io = io_] {
    io.run();
  } };
};

/*
 * This function exists only for usage in the unit tests, and might be removed at any moment.
 * Avoid using it unless it is absolutely necessary.
 */
auto
extract_core_cluster(const couchbase::cluster& cluster) -> const core::cluster&
{
  static_assert(
    alignof(couchbase::cluster) == alignof(std::shared_ptr<cluster_impl>),
    "expected alignment of couchbase::cluster and std::shared_ptr<cluster_impl> to match");
  static_assert(sizeof(couchbase::cluster) == sizeof(std::shared_ptr<cluster_impl>),
                "expected size of couchbase::cluster and std::shared_ptr<cluster_impl> to match");
  return reinterpret_cast<const std::shared_ptr<cluster_impl>*>(&cluster)->get()->core();
}

void
cluster::query(std::string statement, const query_options& options, query_handler&& handler) const
{
  return impl_->query(std::move(statement), options.build(), std::move(handler));
}

auto
cluster::query(std::string statement, const query_options& options) const
  -> std::future<std::pair<error, query_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, query_result>>>();
  auto future = barrier->get_future();
  query(std::move(statement), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
cluster::analytics_query(std::string statement,
                         const analytics_options& options,
                         analytics_handler&& handler) const
{
  impl_->analytics_query(std::move(statement), options.build(), std::move(handler));
}

auto
cluster::analytics_query(std::string statement, const analytics_options& options) const
  -> std::future<std::pair<error, analytics_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, analytics_result>>>();
  auto future = barrier->get_future();
  analytics_query(std::move(statement), options, [barrier](auto err, auto result) {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return future;
}

void
cluster::ping(const couchbase::ping_options& options, couchbase::ping_handler&& handler) const
{
  return impl_->ping(options.build(), std::move(handler));
}

auto
cluster::ping(const couchbase::ping_options& options) const
  -> std::future<std::pair<error, ping_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, ping_result>>>();
  ping(options, [barrier](auto err, auto result) mutable {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return barrier->get_future();
}

void
cluster::diagnostics(const couchbase::diagnostics_options& options,
                     couchbase::diagnostics_handler&& handler) const
{
  return impl_->diagnostics(options.build(), std::move(handler));
}

auto
cluster::diagnostics(const couchbase::diagnostics_options& options) const
  -> std::future<std::pair<error, diagnostics_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, diagnostics_result>>>();
  diagnostics(options, [barrier](auto err, auto result) mutable {
    barrier->set_value({ std::move(err), std::move(result) });
  });
  return barrier->get_future();
}

void
cluster::search(std::string index_name,
                search_request request,
                const search_options& options,
                search_handler&& handler) const
{
  return impl_->search(
    std::move(index_name), std::move(request), options.build(), std::move(handler));
}

auto
cluster::search(std::string index_name, search_request request, const search_options& options) const
  -> std::future<std::pair<error, search_result>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, search_result>>>();
  search(
    std::move(index_name), std::move(request), options, [barrier](auto error, auto result) mutable {
      barrier->set_value(std::make_pair(std::move(error), std::move(result)));
    });
  return barrier->get_future();
}

auto
cluster::connect(const std::string& connection_string, const cluster_options& options)
  -> std::future<std::pair<error, cluster>>
{
  auto barrier = std::make_shared<std::promise<std::pair<error, cluster>>>();
  auto future = barrier->get_future();
  connect(connection_string, options, [barrier](auto err, auto c) {
    barrier->set_value({ std::move(err), std::move(c) });
  });
  return future;
}

void
cluster::connect(const std::string& connection_string,
                 const cluster_options& options,
                 cluster_connect_handler&& handler)
{
  // Spawn new thread for connection to ensure that cluster_impl pointer will
  // not be deallocated in IO thread in case of error.
  std::thread([connection_string, options, handler = std::move(handler)]() {
    auto barrier = std::make_shared<std::promise<std::pair<error, cluster>>>();
    auto future = barrier->get_future();
    {
      auto impl = std::make_shared<cluster_impl>(connection_string, options);
      impl->open([barrier](auto err, auto c) {
        barrier->set_value({ std::move(err), std::move(c) });
      });
    }

    auto [err, c] = future.get();
    handler(std::move(err), std::move(c));
  }).detach();
}

auto
cluster::notify_fork(fork_event event) -> void
{
  if (!impl_) {
    return;
  }
  impl_->notify_fork(event);
  if (event != fork_event::child) {
    return;
  }

  auto new_impl = std::make_shared<cluster_impl>(impl_->connection_string(), impl_->options());
  impl_.reset();

  {
    auto barrier = std::make_shared<std::promise<void>>();
    auto future = barrier->get_future();

    new_impl->open([this, barrier, new_impl](const auto& err, const auto& /* c */) {
      if (err.ec()) {
        // TODO(SA): we should fall to background reconnect loop similar to Columnar build
        CB_LOG_ERROR("Unable to reconnect instance after fork: {}", err.ec().message());
        return;
      }
      impl_ = new_impl;
      barrier->set_value();
    });

    future.get();
  }
}

void
cluster::close(std::function<void()>&& handler)
{
  if (!impl_) {
    return handler();
  }
  impl_->close(std::move(handler));
}

auto
cluster::close() -> std::future<void>
{
  auto barrier = std::make_shared<std::promise<void>>();
  auto future = barrier->get_future();
  close([barrier] {
    barrier->set_value();
  });
  return future;
}

auto
cluster::query_indexes() const -> query_index_manager
{
  return query_index_manager{ impl_->core() };
}

auto
cluster::analytics_indexes() const -> analytics_index_manager
{
  return analytics_index_manager{ impl_->core() };
}

auto
cluster::bucket(std::string_view bucket_name) const -> couchbase::bucket
{
  return { impl_->core(), bucket_name, impl_->options().crypto_manager };
}

auto
cluster::transactions() const -> std::shared_ptr<couchbase::transactions::transactions>
{
  return impl_->transactions();
}

auto
cluster::buckets() const -> bucket_manager
{
  return bucket_manager{ impl_->core() };
}

auto
cluster::search_indexes() const -> search_index_manager
{
  return search_index_manager{ impl_->core() };
}

namespace core
{
auto
get_core_cluster(couchbase::cluster public_api_cluster) -> core::cluster
{
  auto* impl_ptr = reinterpret_cast<std::shared_ptr<couchbase::cluster_impl>*>(&public_api_cluster);
  return (*impl_ptr)->core();
}

auto
make_agent_group(couchbase::cluster public_api_cluster) -> core::agent_group
{
  auto core_cluster = get_core_cluster(std::move(public_api_cluster));
  return { core_cluster.io_context(),
           core::agent_group_config{ core::core_sdk_shim{ core_cluster } } };
}

} // namespace core
} // namespace couchbase
