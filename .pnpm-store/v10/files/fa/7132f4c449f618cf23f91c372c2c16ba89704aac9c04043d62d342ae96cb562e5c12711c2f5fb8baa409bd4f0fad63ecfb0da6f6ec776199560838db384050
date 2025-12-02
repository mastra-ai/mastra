/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2024. Couchbase, Inc.
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

#include "http_session.hxx"

#include "core/logger/logger.hxx"
#include "core/meta/version.hxx"
#include "core/platform/base64.h"
#include "core/platform/uuid.h"
#include "core/service_type_fmt.hxx"

#include <couchbase/error_codes.hxx>

#include <spdlog/fmt/bin_to_hex.h>

#include <utility>

namespace couchbase::core::io
{
http_session_info::http_session_info(const std::string& client_id, const std::string& session_id)
  : log_prefix_(fmt::format("[{}/{}]", client_id, session_id))
{
}

http_session_info::http_session_info(const std::string& client_id,
                                     const std::string& session_id,
                                     asio::ip::tcp::endpoint local_endpoint,
                                     const asio::ip::tcp::endpoint& remote_endpoint)
  : local_endpoint_(std::move(local_endpoint))
{

  local_endpoint_address_ = local_endpoint_.address().to_string();
  if (local_endpoint_.protocol() == asio::ip::tcp::v6()) {
    local_endpoint_address_ =
      fmt::format("[{}]:{}", local_endpoint_address_, local_endpoint_.port());
  } else {
    local_endpoint_address_ = fmt::format("{}:{}", local_endpoint_address_, local_endpoint_.port());
  }

  remote_endpoint_ = remote_endpoint;
  remote_endpoint_address_ = remote_endpoint_.address().to_string();
  if (remote_endpoint_.protocol() == asio::ip::tcp::v6()) {
    remote_endpoint_address_ =
      fmt::format("[{}]:{}", remote_endpoint_address_, remote_endpoint_.port());
  } else {
    remote_endpoint_address_ =
      fmt::format("{}:{}", remote_endpoint_address_, remote_endpoint_.port());
  }

  log_prefix_ = fmt::format("[{}/{}] <{}:{}:{}>",
                            client_id,
                            session_id,
                            local_endpoint_.port(),
                            remote_endpoint_.address().to_string(),
                            remote_endpoint_.port());
}

auto
http_session_info::remote_endpoint() const -> const asio::ip::tcp::endpoint&
{
  return remote_endpoint_;
}

auto
http_session_info::remote_address() const -> const std::string&
{
  return remote_endpoint_address_;
}

auto
http_session_info::local_endpoint() const -> const asio::ip::tcp::endpoint&
{
  return local_endpoint_;
}

auto
http_session_info::local_address() const -> const std::string&
{
  return local_endpoint_address_;
}

auto
http_session_info::log_prefix() const -> const std::string&
{
  return log_prefix_;
}

http_session::http_session(couchbase::core::service_type type,
                           std::string client_id,
                           std::string node_uuid,
                           asio::io_context& ctx,
                           couchbase::core::cluster_credentials credentials,
                           std::string hostname,
                           std::string service,
                           couchbase::core::http_context http_ctx)
  : type_(type)
  , client_id_(std::move(client_id))
  , node_uuid_(std::move(node_uuid))
  , id_(uuid::to_string(uuid::random()))
  , ctx_(ctx)
  , resolver_(ctx_)
  , stream_(std::make_unique<plain_stream_impl>(ctx_))
  , connect_deadline_timer_(stream_->get_executor())
  , idle_timer_(stream_->get_executor())
  , retry_backoff_(stream_->get_executor())
  , credentials_(std::move(credentials))
  , hostname_(std::move(hostname))
  , service_(std::move(service))
  , user_agent_(meta::user_agent_for_http(client_id_, id_, http_ctx.options.user_agent_extra))
  , info_(client_id_, id_)
  , http_ctx_(std::move(http_ctx))
{
}

http_session::http_session(couchbase::core::service_type type,
                           std::string client_id,
                           std::string node_uuid,
                           asio::io_context& ctx,
                           asio::ssl::context& tls,
                           couchbase::core::cluster_credentials credentials,
                           std::string hostname,
                           std::string service,
                           couchbase::core::http_context http_ctx)
  : type_(type)
  , client_id_(std::move(client_id))
  , node_uuid_(std::move(node_uuid))
  , id_(uuid::to_string(uuid::random()))
  , ctx_(ctx)
  , resolver_(ctx_)
  , stream_(std::make_unique<tls_stream_impl>(ctx_, tls))
  , connect_deadline_timer_(ctx_)
  , idle_timer_(ctx_)
  , retry_backoff_(ctx_)
  , credentials_(std::move(credentials))
  , hostname_(std::move(hostname))
  , service_(std::move(service))
  , user_agent_(meta::user_agent_for_http(client_id_, id_, http_ctx.options.user_agent_extra))
  , info_(client_id_, id_)
  , http_ctx_(std::move(http_ctx))
{
}

http_session::~http_session()
{
  stop();
}

auto
http_session::get_executor() const -> asio::strand<asio::io_context::executor_type>
{
  return stream_->get_executor();
}

auto
http_session::http_context() -> couchbase::core::http_context&
{
  return http_ctx_;
}

auto
http_session::remote_address() -> std::string
{
  const std::scoped_lock lock(info_mutex_);
  return info_.remote_address();
}

auto
http_session::local_address() -> std::string
{
  const std::scoped_lock lock(info_mutex_);
  return info_.local_address();
}

auto
http_session::diag_info() -> diag::endpoint_diag_info
{
  return { type_,
           id_,
           last_active_.time_since_epoch().count() == 0
             ? std::nullopt
             : std::make_optional(std::chrono::duration_cast<std::chrono::microseconds>(
                 std::chrono::steady_clock::now() - last_active_)),
           remote_address(),
           local_address(),
           state_ };
}

auto
http_session::log_prefix() -> std::string
{
  const std::scoped_lock lock(info_mutex_);
  return info_.log_prefix();
}

auto
http_session::id() const -> const std::string&
{
  return id_;
}

auto
http_session::node_uuid() const -> const std::string&
{
  return node_uuid_;
}

auto
http_session::credentials() const -> const cluster_credentials&
{
  return credentials_;
}

auto
http_session::is_connected() const -> bool
{
  return connected_;
}

auto
http_session::type() const -> service_type
{
  return type_;
}

auto
http_session::hostname() const -> const std::string&
{
  return hostname_;
}

auto
http_session::port() const -> const std::string&
{
  return service_;
}

auto
http_session::endpoint() -> const asio::ip::tcp::endpoint&
{
  const std::scoped_lock lock(info_mutex_);
  return info_.remote_endpoint();
}

void
http_session::connect(utils::movable_function<void()>&& callback)
{
  {
    const std::scoped_lock lock(connect_callback_mutex_);
    connect_callback_ = std::move(callback);
  }
  initiate_connect();
}

void
http_session::initiate_connect()
{
  if (stopped_) {
    return;
  }
  if (state_ != diag::endpoint_state::connecting) {
    CB_LOG_DEBUG(
      "{} {}:{} attempt to establish HTTP connection", info_.log_prefix(), hostname_, service_);
    state_ = diag::endpoint_state::connecting;
    async_resolve(http_ctx_.options.use_ip_protocol,
                  resolver_,
                  hostname_,
                  service_,
                  [capture0 = shared_from_this()](auto&& PH1, auto&& PH2) {
                    capture0->on_resolve(std::forward<decltype(PH1)>(PH1),
                                         std::forward<decltype(PH2)>(PH2));
                  });
  } else {
    // reset state in case the session is being reused
    state_ = diag::endpoint_state::disconnected;
    auto backoff = std::chrono::milliseconds(500);
    CB_LOG_DEBUG(
      "{} waiting for {}ms before trying to connect", info_.log_prefix(), backoff.count());
    retry_backoff_.expires_after(backoff);
    retry_backoff_.async_wait([self = shared_from_this()](std::error_code ec) mutable {
      if (ec == asio::error::operation_aborted || self->stopped_) {
        return;
      }
      self->invoke_connect_callback();
    });
    return;
  }
}

void
http_session::on_stop(std::function<void()> handler)
{
  on_stop_handler_ = std::move(handler);
}

void
http_session::cancel_current_response(std::error_code ec)
{
  const std::scoped_lock lock(current_response_mutex_);
  if (streaming_response_) {
    auto ctx = std::move(current_streaming_response_);
    if (auto handler = std::move(ctx.resp_handler); handler) {
      handler(ec, {});
    }
    if (auto handler = std::move(ctx.stream_end_handler); handler) {
      handler();
    }
  } else {
    if (auto ctx = std::move(current_response_); ctx.handler) {
      ctx.handler(ec, std::move(ctx.parser.response));
    }
  }
}

void
http_session::invoke_connect_callback()
{
  utils::movable_function<void()> cb;
  {
    const std::scoped_lock lock(connect_callback_mutex_);
    cb = std::move(connect_callback_);
  }
  if (cb) {
    cb();
  }
}

void
http_session::stop()
{
  if (stopped_) {
    return;
  }
  stopped_ = true;
  state_ = diag::endpoint_state::disconnecting;
  stream_->close([](std::error_code) {
  });
  invoke_connect_callback();
  connect_deadline_timer_.cancel();
  idle_timer_.cancel();
  retry_backoff_.cancel();

  cancel_current_response(errc::common::request_canceled);

  if (auto handler = std::move(on_stop_handler_); handler) {
    handler();
  }
  state_ = diag::endpoint_state::disconnected;
}

auto
http_session::keep_alive() const -> bool
{
  return keep_alive_;
}

auto
http_session::is_stopped() const -> bool
{
  return stopped_;
}

void
http_session::write(const std::vector<std::uint8_t>& buf)
{
  if (stopped_) {
    return;
  }
  const std::scoped_lock lock(output_buffer_mutex_);
  output_buffer_.push_back(buf);
}

void
http_session::write(const std::string_view& buf)
{
  if (stopped_) {
    return;
  }
  const std::scoped_lock lock(output_buffer_mutex_);
  output_buffer_.emplace_back(buf.begin(), buf.end());
}

void
http_session::flush()
{
  if (!connected_) {
    return;
  }
  if (stopped_) {
    return;
  }
  asio::post(asio::bind_executor(ctx_, [self = shared_from_this()]() {
    self->do_write();
  }));
}

void
http_session::write_and_stream(
  io::http_request& request,
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
  utils::movable_function<void(couchbase::core::error_union, io::http_streaming_response)>
    resp_handler,
#else
  utils::movable_function<void(std::error_code, io::http_streaming_response)> resp_handler,
#endif
  utils::movable_function<void()> stream_end_handler)
{
  if (stopped_) {
    resp_handler(errc::common::request_canceled, {});
    stream_end_handler();
    return;
  }
  {
    streaming_response_context ctx{ std::move(resp_handler), std::move(stream_end_handler) };
    const std::scoped_lock lock(current_response_mutex_);
    std::swap(current_streaming_response_, ctx);
    streaming_response_ = true;
  }
  if (request.headers["connection"] == "keep-alive") {
    keep_alive_ = true;
  }
  request.headers["user-agent"] = user_agent_;
  auto credentials = fmt::format("{}:{}", credentials_.username, credentials_.password);
  request.headers["authorization"] = fmt::format(
    "Basic {}", base64::encode(gsl::as_bytes(gsl::span{ credentials.data(), credentials.size() })));
  write(fmt::format(
    "{} {} HTTP/1.1\r\nhost: {}:{}\r\n", request.method, request.path, hostname_, service_));
  if (!request.body.empty()) {
    request.headers["content-length"] = std::to_string(request.body.size());
  }
  for (const auto& [name, value] : request.headers) {
    write(fmt::format("{}: {}\r\n", name, value));
  }
  write("\r\n");
  write(request.body);
  flush();
}

void
http_session::set_idle(std::chrono::milliseconds timeout)
{
  idle_timer_.expires_after(timeout);
  return idle_timer_.async_wait([self = shared_from_this()](std::error_code ec) {
    if (ec == asio::error::operation_aborted) {
      return;
    }
    CB_LOG_DEBUG("{} idle timeout expired, stopping session: \"{}:{}\"",
                 self->info_.log_prefix(),
                 self->hostname_,
                 self->service_);
    self->stop();
  });
}

auto
http_session::reset_idle() -> bool
{
  // Return true if cancel() is successful. Since the idle_timer_ has a single pending
  // wait per session, we know the timer has already expired if cancel() returns 0.
  return idle_timer_.cancel() != 0;
}

void
http_session::read_some(
  utils::movable_function<void(std::string, bool, std::error_code)>&& callback)
{
  if (stopped_ || !stream_->is_open()) {
    callback({}, {}, errc::common::request_canceled);
    return;
  }
  std::unique_lock<std::mutex> lock{ read_some_mutex_ };
  return stream_->async_read_some(
    asio::buffer(input_buffer_),
    [self = shared_from_this(), callback = std::move(callback), lck = std::move(lock)](
      std::error_code ec, std::size_t bytes_transferred) mutable {
      if (ec == asio::error::operation_aborted || self->stopped_) {
        CB_LOG_PROTOCOL("[HTTP, IN] type={}, host=\"{}\", rc={}, bytes_received={}",
                        self->type_,
                        self->info_.remote_address(),
                        ec ? ec.message() : "ok",
                        bytes_transferred);
        lck.unlock();
        callback({}, {}, errc::common::request_canceled);
        return;
      }
      CB_LOG_PROTOCOL("[HTTP, IN] type={}, host=\"{}\", rc={}, bytes_received={}{:a}",
                      self->type_,
                      self->info_.remote_address(),
                      ec ? ec.message() : "ok",
                      bytes_transferred,
                      spdlog::to_hex(self->input_buffer_.data(),
                                     self->input_buffer_.data() +
                                       static_cast<std::ptrdiff_t>(bytes_transferred)));

      self->last_active_ = std::chrono::steady_clock::now();
      if (ec) {
        CB_LOG_ERROR(
          "{} IO error while reading from the socket: {}", self->info_.log_prefix(), ec.message());
        lck.unlock();
        callback({}, {}, ec);
        return self->stop();
      }
      http_streaming_parser::feeding_result res{};
      {
        const std::scoped_lock lock(self->current_response_mutex_);
        res = self->current_streaming_response_.parser.feed(
          reinterpret_cast<const char*>(self->input_buffer_.data()), bytes_transferred);
      }
      if (res.failure) {
        self->stop();
        lck.unlock();
        return callback({}, {}, errc::common::parsing_failure);
      }

      std::string data;
      {
        const std::scoped_lock lock(self->current_response_mutex_);
        std::swap(data, self->current_streaming_response_.parser.body_chunk);
      }

      if (res.complete) {
        streaming_response_context ctx{};
        {
          const std::scoped_lock lock(self->current_response_mutex_);
          std::swap(self->current_streaming_response_, ctx);
        }
        if (ctx.stream_end_handler) {
          ctx.stream_end_handler();
        }
        if (ctx.resp->must_close_connection()) {
          self->keep_alive_ = false;
        }
      }
      lck.unlock();
      callback(std::move(data), !res.complete, {});
    });
}

void
http_session::on_resolve(std::error_code ec, const asio::ip::tcp::resolver::results_type& endpoints)
{
  if (ec == asio::error::operation_aborted || stopped_) {
    return;
  }
  if (ec) {
    CB_LOG_ERROR(
      "{} error on resolve \"{}:{}\": {}", info_.log_prefix(), hostname_, service_, ec.message());
    return initiate_connect();
  }
  last_active_ = std::chrono::steady_clock::now();
  endpoints_ = endpoints;
  CB_LOG_TRACE("{} resolved \"{}:{}\" to {} endpoint(s)",
               info_.log_prefix(),
               hostname_,
               service_,
               endpoints_.size());
  do_connect(endpoints_.begin());
}

void
http_session::do_connect(asio::ip::tcp::resolver::results_type::iterator it)
{
  if (stopped_) {
    return;
  }
  if (it != endpoints_.end()) {
    CB_LOG_DEBUG("{} connecting to {}:{} (\"{}:{}\"), timeout={}ms",
                 info_.log_prefix(),
                 it->endpoint().address().to_string(),
                 it->endpoint().port(),
                 hostname_,
                 service_,
                 http_ctx_.options.connect_timeout.count());
    connect_deadline_timer_.expires_after(http_ctx_.options.connect_timeout);
    connect_deadline_timer_.async_wait([self = shared_from_this(),
                                        it](const auto timer_ec) mutable {
      if (timer_ec == asio::error::operation_aborted || self->stopped_) {
        return;
      }
      CB_LOG_DEBUG("{} unable to connect to {}:{} in time, reconnecting",
                   self->info_.log_prefix(),
                   self->hostname_,
                   self->service_);
      return self->stream_->close([self, next_address = ++it](std::error_code ec) {
        if (ec) {
          CB_LOG_WARNING("{} unable to close socket, but continue connecting attempt to {}:{}: {}",
                         self->info_.log_prefix(),
                         next_address->endpoint().address().to_string(),
                         next_address->endpoint().port(),
                         ec.value());
        }
        self->do_connect(next_address);
      });
    });

    stream_->async_connect(it->endpoint(), [capture0 = shared_from_this(), it](auto&& PH1) {
      capture0->on_connect(std::forward<decltype(PH1)>(PH1), it);
    });
  } else {
    CB_LOG_ERROR("{} no more endpoints left to connect, \"{}:{}\" is not reachable",
                 info_.log_prefix(),
                 hostname_,
                 service_);
    return initiate_connect();
  }
}

void
http_session::on_connect(const std::error_code& ec,
                         asio::ip::tcp::resolver::results_type::iterator it)
{
  if (ec == asio::error::operation_aborted || stopped_) {
    return;
  }
  last_active_ = std::chrono::steady_clock::now();
  if (!stream_->is_open() || ec) {
    CB_LOG_WARNING("{} unable to connect to {}:{}: {}{}",
                   info_.log_prefix(),
                   it->endpoint().address().to_string(),
                   it->endpoint().port(),
                   ec.message(),
                   (ec == asio::error::connection_refused)
                     ? ", check server ports and cluster encryption setting"
                     : "");
    if (stream_->is_open()) {
      stream_->close([self = shared_from_this(), next_address = ++it](std::error_code ec) {
        if (ec) {
          CB_LOG_WARNING("{} unable to close socket, but continue connecting attempt to {}:{}: {}",
                         self->info_.log_prefix(),
                         next_address->endpoint().address().to_string(),
                         next_address->endpoint().port(),
                         ec.value());
        }
        self->do_connect(next_address);
      });
    } else {
      do_connect(++it);
    }
  } else {
    state_ = diag::endpoint_state::connected;
    connected_ = true;
    CB_LOG_DEBUG("{} connected to {}:{}",
                 info_.log_prefix(),
                 it->endpoint().address().to_string(),
                 it->endpoint().port());
    {
      const std::scoped_lock lock(info_mutex_);
      info_ = http_session_info(client_id_, id_, stream_->local_endpoint(), it->endpoint());
    }
    connect_deadline_timer_.cancel();
    invoke_connect_callback();
    flush();
  }
}

void
http_session::do_read()
{
  if (stopped_ || reading_ || !stream_->is_open()) {
    return;
  }
  reading_ = true;
  stream_->async_read_some(
    asio::buffer(input_buffer_),
    [self = shared_from_this()](std::error_code ec, std::size_t bytes_transferred) {
      if (ec == asio::error::operation_aborted || self->stopped_) {
        CB_LOG_PROTOCOL("[HTTP, IN] type={}, host=\"{}\", rc={}, bytes_received={}",
                        self->type_,
                        self->info_.remote_address(),
                        ec ? ec.message() : "ok",
                        bytes_transferred);
        return;
      }
      CB_LOG_PROTOCOL("[HTTP, IN] type={}, host=\"{}\", rc={}, bytes_received={}{:a}",
                      self->type_,
                      self->info_.remote_address(),
                      ec ? ec.message() : "ok",
                      bytes_transferred,
                      spdlog::to_hex(self->input_buffer_.data(),
                                     self->input_buffer_.data() +
                                       static_cast<std::ptrdiff_t>(bytes_transferred)));

      self->last_active_ = std::chrono::steady_clock::now();
      if (ec) {
        CB_LOG_ERROR(
          "{} IO error while reading from the socket: {}", self->info_.log_prefix(), ec.message());
        return self->stop();
      }

      if (self->streaming_response_) {
        // If streaming the response, read at least the entire header and then call the
        // streaming handler
        http_streaming_parser::feeding_result res{};
        {
          const std::scoped_lock lock(self->current_response_mutex_);
          res = self->current_streaming_response_.parser.feed(
            reinterpret_cast<const char*>(self->input_buffer_.data()), bytes_transferred);
        }
        if (res.failure) {
          return self->stop();
        }
        if (res.complete || res.headers_complete) {
          streaming_response_context ctx{};
          {
            const std::scoped_lock lock(self->current_response_mutex_);
            std::swap(self->current_streaming_response_, ctx);
          }

          ctx.resp = http_streaming_response{ self->ctx_, ctx.parser, self };
          ctx.parser.body_chunk = "";

          if (res.complete && ctx.resp->must_close_connection()) {
            self->keep_alive_ = false;
          }
          self->reading_ = false;
          if (auto handler = std::move(ctx.resp_handler); handler) {
            handler({}, *ctx.resp);
          }
          if (!res.complete) {
            const std::scoped_lock lock(self->current_response_mutex_);
            std::swap(self->current_streaming_response_, ctx);
          } else {
            if (auto handler = std::move(ctx.stream_end_handler); handler) {
              handler();
            }
          }
          return;
        }
        self->reading_ = false;
        return self->do_read();
      }
      http_parser::feeding_result res{};
      {
        const std::scoped_lock lock(self->current_response_mutex_);
        res = self->current_response_.parser.feed(
          reinterpret_cast<const char*>(self->input_buffer_.data()), bytes_transferred);
      }
      if (res.failure) {
        return self->stop();
      }
      if (res.complete) {
        response_context ctx{};
        {
          const std::scoped_lock lock(self->current_response_mutex_);
          std::swap(self->current_response_, ctx);
        }
        if (ctx.parser.response.must_close_connection()) {
          self->keep_alive_ = false;
        }
        ctx.handler({}, std::move(ctx.parser.response));
        self->reading_ = false;
        return;
      }
      self->reading_ = false;
      return self->do_read();
    });
}

void
http_session::do_write()
{
  if (stopped_) {
    return;
  }
  const std::scoped_lock lock(writing_buffer_mutex_, output_buffer_mutex_);
  if (!writing_buffer_.empty() || output_buffer_.empty()) {
    return;
  }
  std::swap(writing_buffer_, output_buffer_);
  std::vector<asio::const_buffer> buffers;
  buffers.reserve(writing_buffer_.size());
  for (auto& buf : writing_buffer_) {
    CB_LOG_PROTOCOL("[HTTP, OUT] type={}, host=\"{}\", buffer_size={}{:a}",
                    type_,
                    info_.remote_address(),
                    buf.size(),
                    spdlog::to_hex(buf));
    buffers.emplace_back(asio::buffer(buf));
  }
  stream_->async_write(
    buffers, [self = shared_from_this()](std::error_code ec, std::size_t bytes_transferred) {
      CB_LOG_PROTOCOL("[HTTP, OUT] type={}, host=\"{}\", rc={}, bytes_sent={}",
                      self->type_,
                      self->info_.remote_address(),
                      ec ? ec.message() : "ok",
                      bytes_transferred);
      if (ec == asio::error::operation_aborted || self->stopped_) {
        return;
      }
      self->last_active_ = std::chrono::steady_clock::now();
      if (ec) {
        CB_LOG_ERROR(
          "{} IO error while writing to the socket: {}", self->info_.log_prefix(), ec.message());
        return self->stop();
      }
      {
        const std::scoped_lock inner_lock(self->writing_buffer_mutex_);
        self->writing_buffer_.clear();
      }
      bool want_write = false;
      {
        const std::scoped_lock inner_lock(self->output_buffer_mutex_);
        want_write = !self->output_buffer_.empty();
      }
      if (want_write) {
        return self->do_write();
      }
      self->do_read();
    });
}
} // namespace couchbase::core::io
