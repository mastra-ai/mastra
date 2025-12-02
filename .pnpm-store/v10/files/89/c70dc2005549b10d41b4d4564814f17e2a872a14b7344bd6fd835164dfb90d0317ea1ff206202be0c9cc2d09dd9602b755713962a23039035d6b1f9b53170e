/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "http_component.hxx"

#include "free_form_http_request.hxx"
#include "io/http_session_manager.hxx"
#include "pending_operation.hxx"
#include "pending_operation_connection_info.hxx"

#include <couchbase/build_config.hxx>

#include <asio/error.hpp>
#include <spdlog/fmt/bundled/chrono.h>
#include <tl/expected.hpp>

#include <memory>
#include <utility>

namespace couchbase::core
{
namespace
{
auto
encode_http_request(const http_request& req) -> io::http_request
{
  return io::http_request{
    req.service, req.method, req.path, req.headers, req.body, {}, req.client_context_id,
  };
}
} // namespace

class pending_http_operation
  : public std::enable_shared_from_this<pending_http_operation>
  , public pending_operation
  , public pending_operation_connection_info
{
public:
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  pending_http_operation(asio::io_context& io,
                         http_request request,
                         std::chrono::milliseconds dispatch_timeout)
    : deadline_{ io }
    , dispatch_deadline_{ io }
    , dispatch_timeout_{ dispatch_timeout }
    , request_{ std::move(request) }
    , encoded_{ encode_http_request(request_) }
  {
  }
#else
  pending_http_operation(asio::io_context& io, http_request request)
    : deadline_{ io }
    , request_{ std::move(request) }
    , encoded_{ encode_http_request(request_) }
  {
  }
#endif

  ~pending_http_operation() override = default;
  pending_http_operation(const pending_http_operation&) = delete;
  pending_http_operation(pending_http_operation&&) = delete;
  auto operator=(const pending_http_operation&) -> pending_http_operation = delete;
  auto operator=(pending_http_operation&&) -> pending_http_operation = delete;

  void start(free_form_http_request_callback&& callback)
  {
    callback_ = std::move(callback);
    encoded_.headers["client-context-id"] = request_.client_context_id;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    dispatch_deadline_.expires_after(dispatch_timeout_);
    dispatch_deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG(
        R"(HTTP request timed out (dispatch): {}, method={}, path="{}", dispatch_timeout={}, client_context_id={})",
        self->encoded_.type,
        self->encoded_.method,
        self->encoded_.path,
        self->dispatch_timeout_,
        self->encoded_.client_context_id);
      self->trigger_timeout();
      if (self->session_) {
        self->session_->stop();
      }
    });
#endif
    deadline_.expires_after(request_.timeout);
    deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG(
        R"(HTTP request timed out: {}, method={}, path="{}", timeout={}, client_context_id={})",
        self->encoded_.type,
        self->encoded_.method,
        self->encoded_.path,
        self->request_.timeout,
        self->encoded_.client_context_id);
      self->trigger_timeout();
      if (self->session_) {
        self->session_->stop();
      }
    });
  }

  void set_stream_end_callback(utils::movable_function<void()>&& stream_end_callback)
  {
    stream_end_callback_ = std::move(stream_end_callback);
  }

  void cancel() override
  {
    if (session_) {
      session_->stop();
    }
    invoke_response_handler(errc::common::request_canceled, {});
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  void invoke_response_handler(error_union err, io::http_streaming_response resp)
  {
    dispatch_deadline_.cancel();
#else
  void invoke_response_handler(std::error_code err, io::http_streaming_response resp)
  {
#endif
    deadline_.cancel();
    free_form_http_request_callback callback{};
    {
      const std::scoped_lock lock(callback_mutex_);
      std::swap(callback, callback_);
    }
    if (callback) {
      callback(http_response{ std::move(resp) }, err);
    }
  }

  void send_to(std::shared_ptr<io::http_session> session)
  {
    if (!callback_) {
      return;
    }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    dispatch_deadline_.cancel();
#endif
    session_ = std::move(session);

    auto start_op = [self = shared_from_this()]() {
      self->session_->write_and_stream(
        self->encoded_,
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        [self](error_union err, io::http_streaming_response resp) {
          if (std::holds_alternative<std::error_code>(err) &&
              std::get<std::error_code>(err) == asio::error::operation_aborted) {
            return;
          }
          self->invoke_response_handler(err, std::move(resp));
        },
#else
        [self](std::error_code ec, io::http_streaming_response resp) {
          if (ec == asio::error::operation_aborted) {
            return;
          }
          self->invoke_response_handler(ec, std::move(resp));
        },
#endif
        [self]() {
          self->stream_end_callback_();
        });
    };

    start_op();
  }

  [[nodiscard]] auto deadline_expiry() const -> std::chrono::time_point<std::chrono::steady_clock>
  {
    return deadline_.expiry();
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  [[nodiscard]] auto dispatch_deadline_expiry() const
    -> std::chrono::time_point<std::chrono::steady_clock>
  {
    return dispatch_deadline_.expiry();
  }
#endif

  [[nodiscard]] auto request() const -> http_request
  {
    return request_;
  }

  [[nodiscard]] auto dispatched_to() const -> std::string override
  {
    return session_->remote_address();
  }

  [[nodiscard]] auto dispatched_from() const -> std::string override
  {
    return session_->local_address();
  }

  [[nodiscard]] auto dispatched_to_host() const -> std::string override
  {
    return fmt::format("{}:{}", session_->hostname(), session_->port());
  }

private:
  void trigger_timeout()
  {
    // TODO(JC):  if triggered from the dispatch timeout, should only be
    // errc::common::unambiguous_timeout?
    auto ec =
      request_.is_read_only ? errc::common::unambiguous_timeout : errc::common::ambiguous_timeout;
    invoke_response_handler(ec, {});
  }

  asio::steady_timer deadline_;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  asio::steady_timer dispatch_deadline_;
  std::chrono::milliseconds dispatch_timeout_;
#endif
  http_request request_;
  io::http_request encoded_;
  free_form_http_request_callback callback_;
  utils::movable_function<void()> stream_end_callback_;
  std::shared_ptr<io::http_session> session_;
  std::mutex callback_mutex_;
};

class pending_buffered_http_operation
  : public std::enable_shared_from_this<pending_buffered_http_operation>
  , public pending_operation
  , public pending_operation_connection_info
{
public:
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  pending_buffered_http_operation(asio::io_context& io,
                                  http_request request,
                                  std::chrono::milliseconds dispatch_timeout)
    : deadline_{ io }
    , dispatch_deadline_{ io }
    , dispatch_timeout_{ dispatch_timeout }
    , request_{ std::move(request) }
    , encoded_{ encode_http_request(request_) }
  {
  }
#else
  pending_buffered_http_operation(asio::io_context& io, http_request request)
    : deadline_{ io }
    , request_{ std::move(request) }
    , encoded_{ encode_http_request(request_) }
  {
  }
#endif

  ~pending_buffered_http_operation() override = default;
  pending_buffered_http_operation(const pending_buffered_http_operation&) = delete;
  pending_buffered_http_operation(pending_buffered_http_operation&&) = delete;
  auto operator=(const pending_buffered_http_operation&)
    -> pending_buffered_http_operation = delete;
  auto operator=(pending_buffered_http_operation&&) -> pending_buffered_http_operation = delete;

  void start(buffered_free_form_http_request_callback&& callback)
  {
    callback_ = std::move(callback);
    encoded_.headers["client-context-id"] = request_.client_context_id;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    dispatch_deadline_.expires_after(dispatch_timeout_);
    dispatch_deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG(
        R"(HTTP request timed out (dispatch): {}, method={}, path="{}", dispatch_timeout={}, client_context_id={})",
        self->encoded_.type,
        self->encoded_.method,
        self->encoded_.path,
        self->dispatch_timeout_,
        self->encoded_.client_context_id);
      self->trigger_timeout();
      if (self->session_) {
        self->session_->stop();
      }
    });
#endif
    deadline_.expires_after(request_.timeout);
    deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG(
        R"(HTTP request timed out: {}, method={}, path="{}", timeout={}, client_context_id={})",
        self->encoded_.type,
        self->encoded_.method,
        self->encoded_.path,
        self->request_.timeout,
        self->encoded_.client_context_id);
      self->trigger_timeout();
      if (self->session_) {
        self->session_->stop();
      }
    });
  }

  void cancel() override
  {
    if (session_) {
      session_->stop();
    }
    invoke_response_handler(errc::common::request_canceled, {});
  }

  void invoke_response_handler(std::error_code ec, io::http_response resp)
  {
    deadline_.cancel();
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    dispatch_deadline_.cancel();
#endif
    buffered_free_form_http_request_callback callback{};
    {
      const std::scoped_lock lock(callback_mutex_);
      std::swap(callback, callback_);
    }
    if (callback) {
      callback(buffered_http_response{ std::move(resp) }, ec);
    }
  }

  void send_to(std::shared_ptr<io::http_session> session)
  {
    if (!callback_) {
      return;
    }
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    dispatch_deadline_.cancel();
#endif
    session_ = std::move(session);

    session_->write_and_subscribe(
      encoded_, [self = shared_from_this()](std::error_code ec, io::http_response resp) {
        if (ec == asio::error::operation_aborted) {
          return;
        }
        self->invoke_response_handler(ec, std::move(resp));
      });
  }

  [[nodiscard]] auto deadline_expiry() const -> std::chrono::time_point<std::chrono::steady_clock>
  {
    return deadline_.expiry();
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  [[nodiscard]] auto dispatch_deadline_expiry() const
    -> std::chrono::time_point<std::chrono::steady_clock>
  {
    return dispatch_deadline_.expiry();
  }
#endif

  [[nodiscard]] auto request() const -> http_request
  {
    return request_;
  }

  [[nodiscard]] auto dispatched_to() const -> std::string override
  {
    return session_->remote_address();
  }

  [[nodiscard]] auto dispatched_from() const -> std::string override
  {
    return session_->local_address();
  }

  [[nodiscard]] auto dispatched_to_host() const -> std::string override
  {
    return fmt::format("{}:{}", session_->hostname(), session_->port());
  }

private:
  void trigger_timeout()
  {
    // TODO(JC):  if triggered from the dispatch timeout, should only be
    // errc::common::unambiguous_timeout?
    auto ec =
      request_.is_read_only ? errc::common::unambiguous_timeout : errc::common::ambiguous_timeout;
    invoke_response_handler(ec, {});
  }

  asio::steady_timer deadline_;
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  asio::steady_timer dispatch_deadline_;
  std::chrono::milliseconds dispatch_timeout_;
#endif
  http_request request_;
  io::http_request encoded_;
  buffered_free_form_http_request_callback callback_;
  std::shared_ptr<io::http_session> session_;
  std::mutex callback_mutex_;
};

class http_component_impl
{
public:
  http_component_impl(asio::io_context& io,
                      core_sdk_shim shim,
                      std::shared_ptr<retry_strategy> default_retry_strategy)
    : io_{ io }
    , shim_{ std::move(shim) }
    , default_retry_strategy_{ std::move(default_retry_strategy) }
  {
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  auto do_http_request(const http_request& request, free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error_union>
#else
  auto do_http_request(const http_request& request, free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
#endif
  {
    std::shared_ptr<io::http_session_manager> session_manager;
    {
      auto [ec, sm] = shim_.cluster.http_session_manager();
      if (ec) {
        return tl::unexpected(ec);
      }
      session_manager = std::move(sm);
    }

    cluster_credentials credentials;
    if (request.username.empty() && request.password.empty()) {
      auto [ec, origin] = shim_.cluster.origin();
      if (ec) {
        return tl::unexpected(ec);
      }
      credentials = origin.credentials();
    } else {
      credentials = cluster_credentials{ request.username, request.password };
    }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    auto op =
      std::make_shared<pending_http_operation>(io_, request, session_manager->dispatch_timeout());
    if (!session_manager->is_configured()) {
      auto err = defer_command(op, session_manager, credentials, std::move(callback));
      if (!std::holds_alternative<std::monostate>(err)) {
        return tl::unexpected{ err };
      }
      return op;
    }
#else
    auto op = std::make_shared<pending_http_operation>(io_, request);
#endif

    send_http_operation(op, session_manager, credentials, std::move(callback));
    return op;
  }

  auto do_http_request_buffered(const http_request& request,
                                buffered_free_form_http_request_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
  {
    std::shared_ptr<io::http_session_manager> session_manager;
    {
      auto [ec, sm] = shim_.cluster.http_session_manager();
      if (ec) {
        return tl::unexpected(ec);
      }
      session_manager = std::move(sm);
    }

    cluster_credentials credentials;
    if (request.username.empty() && request.password.empty()) {
      auto [ec, origin] = shim_.cluster.origin();
      if (ec) {
        return tl::unexpected(ec);
      }
      credentials = origin.credentials();
    } else {
      credentials = cluster_credentials{ request.username, request.password };
    }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    auto op = std::make_shared<pending_buffered_http_operation>(
      io_, request, session_manager->dispatch_timeout());
    if (!session_manager->is_configured()) {
      auto err = defer_command(op, session_manager, credentials, std::move(callback));
      if (!std::holds_alternative<std::monostate>(err)) {
        auto ec = std::holds_alternative<impl::bootstrap_error>(err)
                    ? std::get<impl::bootstrap_error>(err).ec
                    : std::get<std::error_code>(err);
        return tl::unexpected{ ec };
      }
      return op;
    }
#else
    auto op = std::make_shared<pending_buffered_http_operation>(io_, request);
#endif

    send_http_operation(op, session_manager, credentials, std::move(callback));
    return op;
  }

private:
  void send_http_operation(const std::shared_ptr<pending_http_operation>& op,
                           const std::shared_ptr<io::http_session_manager>& session_manager,
                           const couchbase::core::cluster_credentials& credentials,
                           free_form_http_request_callback&& callback)
  {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    op->start([callback = std::move(callback)](auto resp, error_union err) mutable {
      callback(std::move(resp), err);
    });
    // don't do anything if the op wasn't dispatched or has already timed out
    auto now = std::chrono::steady_clock::now();
    if (op->dispatch_deadline_expiry() < now || op->deadline_expiry() < now) {
      return;
    }
#else
    op->start([callback = std::move(callback)](auto resp, auto ec) mutable {
      callback(std::move(resp), ec);
    });
#endif
    std::shared_ptr<io::http_session> session;
    {
      auto [check_out_ec, s] =
        session_manager->check_out(op->request().service,
                                   credentials,
                                   op->request().endpoint,
                                   op->request().internal.undesired_endpoint);
      if (check_out_ec) {
        return op->invoke_response_handler(check_out_ec, {});
      }
      session = std::move(s);
    }
    op->set_stream_end_callback(
      [session_manager, session, service = op->request().service]() mutable {
        session_manager->check_in(service, session);
      });
    if (!session->is_connected()) {
      session_manager->connect_then_send_pending_op(
        session,
        {},
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        op->dispatch_deadline_expiry(),
#endif
        op->deadline_expiry(),
        [op](std::error_code ec, std::shared_ptr<io::http_session> http_session) {
          if (ec) {
            return op->invoke_response_handler(ec, {});
          }
          op->send_to(std::move(http_session));
        });
    } else {
      op->send_to(session);
    }
  }

  void send_http_operation(const std::shared_ptr<pending_buffered_http_operation>& op,
                           const std::shared_ptr<io::http_session_manager>& session_manager,
                           const couchbase::core::cluster_credentials& credentials,
                           buffered_free_form_http_request_callback&& callback)
  {
    std::shared_ptr<io::http_session> session;
    {
      auto [check_out_ec, s] =
        session_manager->check_out(op->request().service,
                                   credentials,
                                   op->request().endpoint,
                                   op->request().internal.undesired_endpoint);
      if (check_out_ec) {
        return op->invoke_response_handler(check_out_ec, {});
      }
      session = std::move(s);
    }
    op->start(
      [callback = std::move(callback), session_manager, session, service = op->request().service](
        auto resp, auto ec) mutable {
        callback(std::move(resp), ec);
        session_manager->check_in(service, session);
      });

    if (!session->is_connected()) {
      session_manager->connect_then_send_pending_op(
        session,
        {},
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
        op->dispatch_deadline_expiry(),
#endif
        op->deadline_expiry(),
        [op](std::error_code ec, std::shared_ptr<io::http_session> http_session) {
          if (ec) {
            return op->invoke_response_handler(ec, {});
          }
          op->send_to(std::move(http_session));
        });
    } else {
      op->send_to(session);
    }
  }

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  template<typename Callback, typename PendingHttpOp>
  auto defer_command(std::shared_ptr<PendingHttpOp> pending_op,
                     const std::shared_ptr<io::http_session_manager>& session_manager,
                     const couchbase::core::cluster_credentials& credentials,
                     Callback&& callback) -> error_union
  {
    if (auto last_error = session_manager->last_bootstrap_error(); last_error.has_value()) {
      return last_error.value();
    }
    CB_LOG_DEBUG(
      R"(Adding pending HTTP operation to deferred queue: service={}, client_context_id={})",
      pending_op->request().service,
      pending_op->request().client_context_id);
    session_manager->add_to_deferred_queue([this,
                                            callback = std::forward<Callback>(callback),
                                            op = std::move(pending_op),
                                            session_manager,
                                            credentials](error_union err) mutable {
      if (!std::holds_alternative<std::monostate>(err)) {
        // The deferred operation was cancelled - currently this can happen due to closing the
        // cluster
        return callback({}, err);
      }

      return send_http_operation(
        op, session_manager, credentials, std::forward<Callback>(callback));
    });
    return std::monostate{};
  }

  auto defer_command(std::shared_ptr<pending_buffered_http_operation> pending_op,
                     const std::shared_ptr<io::http_session_manager>& session_manager,
                     const couchbase::core::cluster_credentials& credentials,
                     buffered_free_form_http_request_callback&& callback) -> error_union
  {
    if (auto last_error = session_manager->last_bootstrap_error(); last_error.has_value()) {
      return last_error.value();
    }
    CB_LOG_DEBUG(
      R"(Adding pending HTTP operation to deferred queue: service={}, client_context_id={})",
      pending_op->request().service,
      pending_op->request().client_context_id);
    session_manager->add_to_deferred_queue([this,
                                            callback = std::move(callback),
                                            op = std::move(pending_op),
                                            session_manager,
                                            credentials](error_union err) mutable {
      if (!std::holds_alternative<std::monostate>(err)) {
        auto ec = std::holds_alternative<impl::bootstrap_error>(err)
                    ? std::get<impl::bootstrap_error>(err).ec
                    : std::get<std::error_code>(err);
        // The deferred operation was cancelled - currently this can happen due to closing the
        // cluster
        return callback({}, ec);
      }

      return send_http_operation(op, session_manager, credentials, std::move(callback));
    });
    return std::monostate{};
  }
#endif

  asio::io_context& io_;
  core_sdk_shim shim_;
  std::shared_ptr<retry_strategy> default_retry_strategy_;
};

http_component::http_component(asio::io_context& io,
                               core_sdk_shim shim,
                               std::shared_ptr<retry_strategy> default_retry_strategy)
  : impl_{
    std::make_shared<http_component_impl>(io, std::move(shim), std::move(default_retry_strategy))
  }
{
}

auto
http_component::do_http_request(const http_request& request,
                                free_form_http_request_callback&& callback)
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  -> tl::expected<std::shared_ptr<pending_operation>, error_union>
#else
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
#endif
{
  return impl_->do_http_request(request, std::move(callback));
}

auto
http_component::do_http_request_buffered(const couchbase::core::http_request& request,
                                         buffered_free_form_http_request_callback&& callback)
  -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>
{
  return impl_->do_http_request_buffered(request, std::move(callback));
}

} // namespace couchbase::core
