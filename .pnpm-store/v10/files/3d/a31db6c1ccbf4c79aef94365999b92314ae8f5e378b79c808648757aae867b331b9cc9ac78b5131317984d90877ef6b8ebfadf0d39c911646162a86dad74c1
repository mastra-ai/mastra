/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "app_telemetry_reporter.hxx"

#include "app_telemetry_address.hxx"
#include "app_telemetry_meter.hxx"
#include "cluster_credentials.hxx"
#include "cluster_options.hxx"
#include "io/streams.hxx"
#include "logger/logger.hxx"
#include "platform/base64.h"
#include "utils/url_codec.hxx"
#include "websocket_codec.hxx"

#include <couchbase/error_codes.hxx>

#include <asio/io_context.hpp>
#include <asio/ip/tcp.hpp>
#include <asio/ssl/context.hpp>
#include <asio/steady_timer.hpp>
#include <llhttp.h>
#include <spdlog/fmt/bin_to_hex.h>
#include <spdlog/fmt/bundled/chrono.h>
#include <spdlog/fmt/bundled/core.h>
#include <tao/json/to_string.hpp>
#include <tao/json/value.hpp>

#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <queue>
#include <random>
#include <utility>

namespace couchbase::core
{

namespace
{
enum class connection_state : std::uint8_t {
  disconnected,
  connecting,
  connected,
  stopped,
};

class connection_state_listener
{
public:
  connection_state_listener() = default;
  connection_state_listener(const connection_state_listener&) = default;
  connection_state_listener(connection_state_listener&&) = default;
  auto operator=(connection_state_listener&&) -> connection_state_listener& = default;
  auto operator=(const connection_state_listener&) -> connection_state_listener& = default;
  virtual ~connection_state_listener() = default;

  virtual void on_connection_pending(const app_telemetry_address& address) = 0;
  virtual void on_connected(const app_telemetry_address& address,
                            std::unique_ptr<io::stream_impl>&& stream) = 0;
  virtual void on_websocket_ready() = 0;
  virtual void on_error(const app_telemetry_address& address,
                        std::error_code ec,
                        const std::string& message) = 0;
};

class telemetry_dialer : public std::enable_shared_from_this<telemetry_dialer>
{
public:
  static auto dial(app_telemetry_address address,
                   cluster_options options,
                   asio::io_context& ctx,
                   asio::ssl::context& tls,
                   std::shared_ptr<connection_state_listener>&& handler)
    -> std::shared_ptr<telemetry_dialer>
  {
    auto dialer = std::make_shared<telemetry_dialer>(
      std::move(address), std::move(options), ctx, tls, std::move(handler));
    dialer->resolve_address();
    return dialer;
  }

  telemetry_dialer(app_telemetry_address address,
                   cluster_options options,
                   asio::io_context& ctx,
                   asio::ssl::context& tls,
                   std::shared_ptr<connection_state_listener>&& handler)
    : address_{ std::move(address) }
    , options_{ std::move(options) }
    , ctx_(ctx)
    , tls_(tls)
    , resolve_deadline_(ctx_)
    , connect_deadline_(ctx_)
    , resolver_(ctx_)
    , handler_{ std::move(handler) }
  {
  }

  void stop()
  {
    resolver_.cancel();
    connect_deadline_.cancel();
    resolve_deadline_.cancel();
    if (stream_) {
      stream_->close([](auto /* ec */) {
      });
    }
    complete_with_error(asio::error::operation_aborted, "stop dialer");
  }

private:
  void complete_with_error(std::error_code ec, const std::string& message)
  {
    connect_deadline_.cancel();
    resolve_deadline_.cancel();
    if (auto handler = std::move(handler_); handler) {
      handler->on_error(address_, ec, message);
    }
  }

  void complete_with_success()
  {
    connect_deadline_.cancel();
    resolve_deadline_.cancel();
    if (auto handler = std::move(handler_); handler) {
      handler->on_connected(address_, std::move(stream_));
    }
  }

  void reconnect_socket(std::error_code reconnect_reason, const std::string& message)
  {
    last_error_ = reconnect_reason;
    stream_->close([self = shared_from_this(), message, reconnect_reason](std::error_code ec) {
      if (ec) {
        CB_LOG_WARNING(
          "unable to close app telemetry socket, but continue reconnecting anyway.  {}",
          tao::json::to_string(tao::json::value{
            { "message", message },
            { "reconnect_reason",
              fmt::format("{}, {}", reconnect_reason.value(), reconnect_reason.message()) },
            { "ec", fmt::format("{}, {}", ec.value(), ec.message()) },
          }));
      }
      self->connect_socket();
    });
  }

  void connect_socket()
  {
    if (next_endpoint_ == endpoints_.end()) {
      if (!last_error_) {
        last_error_ = errc::network::no_endpoints_left;
      }
      return complete_with_error(last_error_, "no more endpoints to connect");
    }
    auto endpoint = next_endpoint_++;

    connect_deadline_.expires_after(options_.connect_timeout);
    connect_deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      return self->reconnect_socket(ec, "connect deadline");
    });

    if (options_.enable_tls) {
      stream_ = std::make_unique<io::tls_stream_impl>(ctx_, tls_);
    } else {
      stream_ = std::make_unique<io::plain_stream_impl>(ctx_);
    }
    stream_->async_connect(endpoint->endpoint(), [self = shared_from_this()](auto ec) {
      if (ec) {
        return self->reconnect_socket(ec, "connection failure");
      }
      self->complete_with_success();
    });
  }

  void resolve_address()
  {
    resolve_deadline_.expires_after(options_.resolve_timeout);
    resolve_deadline_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      return self->complete_with_error(errc::common::unambiguous_timeout, "timeout on resolve");
    });
    io::async_resolve(options_.use_ip_protocol,
                      resolver_,
                      address_.hostname,
                      address_.service,
                      [self = shared_from_this()](auto ec, const auto& endpoints) {
                        self->resolve_deadline_.cancel();
                        if (ec) {
                          CB_LOG_DEBUG("failed to resolve address for app telemetry socket.  {}",
                                       tao::json::to_string(tao::json::value{
                                         { "message", ec.message() },
                                         { "hostname", self->address_.hostname },
                                       }));
                          return self->complete_with_error(
                            ec, "failed to resolve app telemetry socket");
                        }

                        self->endpoints_ = endpoints;
                        self->next_endpoint_ = self->endpoints_.begin();
                        self->connect_socket();
                      });
  }

  app_telemetry_address address_;
  cluster_options options_;
  asio::io_context& ctx_;
  asio::ssl::context& tls_;
  asio::steady_timer resolve_deadline_;
  asio::steady_timer connect_deadline_;
  asio::ip::tcp::resolver resolver_;
  std::shared_ptr<connection_state_listener> handler_;
  std::error_code last_error_{};
  std::unique_ptr<io::stream_impl> stream_{};
  asio::ip::tcp::resolver::results_type endpoints_{};
  asio::ip::tcp::resolver::results_type::iterator next_endpoint_{};
};

enum class app_telemetry_opcode : std::uint8_t {
  GET_TELEMETRY = 0x00,
};

constexpr auto
is_valid_app_telemetry_opcode(std::byte opcode) -> bool
{
  return opcode == static_cast<std::byte>(app_telemetry_opcode::GET_TELEMETRY);
}

enum class app_telemetry_status : std::uint8_t {
  SUCCESS = 0x00,
  UNKNOWN_COMMAND = 0x01,
};

class websocket_session
  : public websocket_callbacks
  , public std::enable_shared_from_this<websocket_session>
{
public:
  static auto start(asio::io_context& ctx,
                    app_telemetry_address address,
                    cluster_credentials credentials,
                    std::unique_ptr<io::stream_impl>&& stream,
                    std::shared_ptr<app_telemetry_meter> meter,
                    std::shared_ptr<connection_state_listener> reporter,
                    std::chrono::milliseconds ping_interval,
                    std::chrono::milliseconds ping_timeout) -> std::shared_ptr<websocket_session>
  {
    auto handler = std::make_shared<websocket_session>(ctx,
                                                       std::move(address),
                                                       std::move(credentials),
                                                       std::move(stream),
                                                       std::move(meter),
                                                       std::move(reporter),
                                                       ping_interval,
                                                       ping_timeout);
    handler->start();
    return handler;
  }

  websocket_session(asio::io_context& ctx,
                    app_telemetry_address address,
                    cluster_credentials credentials,
                    std::unique_ptr<io::stream_impl>&& stream,
                    std::shared_ptr<app_telemetry_meter> meter,
                    std::shared_ptr<connection_state_listener> reporter,
                    std::chrono::milliseconds ping_interval,
                    std::chrono::milliseconds ping_timeout)
    : ctx_{ ctx }
    , address_{ std::move(address) }
    , credentials_{ std::move(credentials) }
    , stream_{ std::move(stream) }
    , meter_{ std::move(meter) }
    , reporter_{ std::move(reporter) }
    , codec_{ this }
    , ping_interval_timer_{ ctx_ }
    , ping_timeout_timer_{ ctx_ }
    , ping_interval_{ ping_interval }
    , ping_timeout_{ ping_timeout }
  {
  }

  void stop()
  {
    is_running_ = false;
    ping_interval_timer_.cancel();
    ping_timeout_timer_.cancel();
    stream_->close([](auto /* ec */) {
    });
  }

  void stop_and_error(std::error_code ec, const std::string& message)
  {
    stop();
    if (auto reporter = std::move(reporter_); reporter) {
      reporter->on_error(address_, ec, message);
    }
  }

  void send_ping(const websocket_codec& ws)
  {
    write_buffer(ws.ping());
    start_write();

    ping_timeout_timer_.expires_after(ping_timeout_);
    ping_timeout_timer_.async_wait([self = shared_from_this()](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      CB_LOG_DEBUG("app telemetry websocket did not respond in time for ping request.  {}",
                   tao::json::to_string(tao::json::value{
                     { "ping_interval", fmt::format("{}", self->ping_interval_) },
                     { "ping_timeout", fmt::format("{}", self->ping_timeout_) },
                     { "hostname", self->address_.hostname },
                   }));
      self->stop_and_error(errc::common::unambiguous_timeout, "server did not respond in time");
    });

    ping_interval_timer_.expires_after(ping_interval_);
    ping_interval_timer_.async_wait([self = shared_from_this(), &ws](auto ec) {
      if (ec == asio::error::operation_aborted) {
        return;
      }
      self->send_ping(ws);
    });
  }

  void on_ready(const websocket_codec& ws) override
  {
    reporter_->on_websocket_ready();
    send_ping(ws);
  }

  void on_text(const websocket_codec& /* ws */, gsl::span<std::byte> payload) override
  {
    CB_LOG_WARNING("text messages are not supported.  {}",
                   tao::json::to_string(tao::json::value{
                     { "payload", base64::encode(payload) },
                     { "hostname", address_.hostname },
                   }));
    return stop_and_error(errc::network::protocol_error, "unsupported frame: text");
  }

  void on_binary(const websocket_codec& ws, gsl::span<std::byte> payload) override
  {
    if (payload.empty()) {
      CB_LOG_WARNING("binary message have to be at least a byte.  {}",
                     tao::json::to_string(tao::json::value{
                       { "payload", base64::encode(payload) },
                       { "hostname", address_.hostname },
                     }));
      return stop_and_error(errc::network::protocol_error, "the paload is too small");
    }
    if (!is_valid_app_telemetry_opcode(payload[0])) {
      CB_LOG_WARNING("binary message has unknown opcode.  {}",
                     tao::json::to_string(tao::json::value{
                       { "payload", base64::encode(payload) },
                       { "hostname", address_.hostname },
                     }));
      return stop_and_error(errc::network::protocol_error,
                            fmt::format("invalid opcode: {}", payload[0]));
    }

    auto opcode = static_cast<app_telemetry_opcode>(payload[0]);
    switch (opcode) {
      case app_telemetry_opcode::GET_TELEMETRY: {
        std::vector<std::byte> response{};
        response.emplace_back(static_cast<std::byte>(app_telemetry_status::SUCCESS));
        meter_->generate_report(response);
        write_buffer(ws.binary({ response.data(), response.size() }));
        start_write();
      } break;
    }
  }

  void on_ping(const websocket_codec& ws, gsl::span<std::byte> payload) override
  {
    write_buffer(ws.pong(payload));
    start_write();
  }

  void on_pong(const websocket_codec& /* ws */, gsl::span<std::byte> /* payload */) override
  {
    ping_timeout_timer_.cancel();
  }

  void on_close(const websocket_codec& /* ws */, gsl::span<std::byte> payload) override
  {
    CB_LOG_DEBUG("remote peer closed WebSocket.  {}",
                 tao::json::to_string(tao::json::value{
                   { "payload", base64::encode(payload) },
                   { "hostname", address_.hostname },
                 }));
    return stop_and_error({}, "server sent close message");
  }

  void on_error(const websocket_codec& /* ws */, const std::string& message) override
  {
    CB_LOG_WARNING("error from WebSocket codec.  {}",
                   tao::json::to_string(tao::json::value{
                     { "message", message },
                     { "hostname", address_.hostname },
                   }));

    return stop_and_error(errc::network::protocol_error,
                          fmt::format("websocket error: {}", message));
  }

private:
  auto build_handshake_message() -> std::vector<std::byte>
  {
    auto credentials = fmt::format("{}:{}", credentials_.username, credentials_.password);
    auto message = fmt::format("GET {} HTTP/1.1\r\n"
                               "Authorization: Basic {}\r\n"
                               "Upgrade: websocket\r\n"
                               "Connection: Upgrade\r\n"
                               "Host: {}:{}\r\n"
                               "Sec-WebSocket-Version: 13\r\n"
                               "Sec-WebSocket-Key: {}\r\n"
                               "\r\n",
                               address_.path,
                               base64::encode(gsl::as_bytes(gsl::span{
                                 credentials.data(),
                                 credentials.size(),
                               })),
                               address_.hostname,
                               address_.service,
                               codec_.session_key());
    return {
      reinterpret_cast<const std::byte*>(message.data()),
      reinterpret_cast<const std::byte*>(message.data()) + message.size(),
    };
  }

  void write_buffer(std::vector<std::byte>&& buffer)
  {
    const std::scoped_lock lock(mutex_);
    buffers_.emplace(std::move(buffer));
  }

  void start()
  {
    is_running_ = true;
    write_buffer(build_handshake_message());
    start_write();
  }

  void start_write()
  {
    if (!is_running_) {
      return;
    }

    if (!is_writing_) {
      asio::post(stream_->get_executor(), [self = shared_from_this()]() {
        self->do_write();
      });
      is_writing_ = true;
    }
  }

  void do_write()
  {
    std::vector<asio::const_buffer> buffers;
    std::vector<std::vector<std::byte>> active_buffers;

    {
      const std::scoped_lock lock(mutex_);

      while (!buffers_.empty()) {
        active_buffers.emplace_back(std::move(buffers_.front()));
        buffers_.pop();
        buffers.emplace_back(asio::buffer(active_buffers.back()));
      }
    }

    if (!buffers.empty()) {
      stream_->async_write(buffers,
                           [self = shared_from_this(), active_buffers = std::move(active_buffers)](
                             auto ec, auto bytes_transferred) mutable {
                             if (ec == asio::error::operation_aborted) {
                               return;
                             }
                             self->handle_write(ec, bytes_transferred);
                           });
      start_read();
    } else {
      is_writing_ = false;
    }
  }

  void handle_write(std::error_code ec, std::size_t /* bytes_transferred */)
  {
    if (!is_running_) {
      return;
    }
    if (ec) {
      is_writing_ = false;
      CB_LOG_DEBUG("unable to write to app telemetry socket.  {}",
                   tao::json::to_string(tao::json::value{
                     { "message", ec.message() },
                     { "hostname", address_.hostname },
                   }));
      return stop_and_error(ec, "failed to write to app telemetry socket");
    }

    if (const std::scoped_lock lock(mutex_); !buffers_.empty()) {
      start_write();
    } else {
      is_writing_ = false;
    }
  }

  void start_read()
  {
    if (!is_running_) {
      return;
    }

    if (!is_reading_) {
      is_reading_ = true;
      do_read();
    }
  }

  void do_read()
  {
    stream_->async_read_some(asio::buffer(read_buffer_),
                             [self = shared_from_this()](auto ec, auto bytes_transferred) {
                               if (ec == asio::error::operation_aborted) {
                                 return;
                               }
                               self->handle_read(ec, bytes_transferred);
                             });
  }

  void handle_read(std::error_code ec, std::size_t bytes_transferred)
  {
    if (!is_running_) {
      return;
    }
    if (ec) {
      is_reading_ = false;
      CB_LOG_DEBUG("unable to read from app telemetry socket.  {}",
                   tao::json::to_string(tao::json::value{
                     { "message", ec.message() },
                     { "hostname", address_.hostname },
                   }));
      return stop_and_error(ec, "unable to read from the app telemetry socket");
    }
    codec_.feed(gsl::span(read_buffer_.data(), bytes_transferred));
    do_read();
  }

  asio::io_context& ctx_;
  app_telemetry_address address_;
  cluster_credentials credentials_;
  std::unique_ptr<io::stream_impl> stream_;
  std::shared_ptr<app_telemetry_meter> meter_;
  std::shared_ptr<connection_state_listener> reporter_;
  websocket_codec codec_;

  asio::steady_timer ping_interval_timer_;
  asio::steady_timer ping_timeout_timer_;
  std::chrono::milliseconds ping_interval_;
  std::chrono::milliseconds ping_timeout_;

  std::atomic<bool> is_running_{ false };
  std::queue<std::vector<std::byte>> buffers_;
  std::mutex mutex_;
  std::atomic<bool> is_writing_{ false };
  std::array<std::byte, 1024> read_buffer_{};
  std::atomic<bool> is_reading_{ false };
};

class backoff_calculator
{
public:
  backoff_calculator() = default;
  backoff_calculator(const backoff_calculator&) = default;
  backoff_calculator(backoff_calculator&&) = default;
  auto operator=(backoff_calculator&&) -> backoff_calculator& = default;
  auto operator=(const backoff_calculator&) -> backoff_calculator& = default;
  virtual ~backoff_calculator() = default;

  [[nodiscard]] virtual auto retry_after(std::size_t retry_attempts) const
    -> std::chrono::milliseconds = 0;
};

class no_backoff : public backoff_calculator
{
public:
  [[nodiscard]] auto retry_after(std::size_t /* retry_attempts */) const
    -> std::chrono::milliseconds override
  {
    return std::chrono::milliseconds::zero();
  }
};

class exponential_backoff_with_jitter : public backoff_calculator
{
public:
  exponential_backoff_with_jitter(std::chrono::milliseconds min,
                                  std::chrono::milliseconds max,
                                  double factor,
                                  double jitter_factor)
    : min_{ static_cast<double>(min.count()) }
    , max_{ static_cast<double>(max.count()) }
    , factor_{ factor }
    , jitter_factor_{ jitter_factor }
  {
  }

  [[nodiscard]] auto retry_after(std::size_t retry_attempts) const
    -> std::chrono::milliseconds override
  {
    double backoff = min_ * std::pow(factor_, static_cast<double>(retry_attempts));
    backoff = std::max(std::min(backoff, max_), min_);

    const double jitter = calculate_jitter(backoff);
    backoff += jitter;

    return std::chrono::milliseconds(static_cast<std::uint64_t>(backoff));
  }

private:
  [[nodiscard]] auto calculate_jitter(double backoff) const -> double
  {
    if (backoff == 0) {
      return 0;
    }

    static thread_local std::default_random_engine gen{ std::random_device{}() };

    const double jitter_offset = (backoff * 100.0 * jitter_factor_) / 100.0;
    auto low_bound = static_cast<std::int64_t>(std::max(min_ - backoff, -jitter_offset));
    auto high_bound = static_cast<std::int64_t>(std::min(max_ - backoff, jitter_offset));

    std::uniform_int_distribution<std::int64_t> dis(low_bound, high_bound);
    return static_cast<double>(dis(gen));
  }

  double min_;
  double max_;
  double factor_;
  double jitter_factor_;
};

} // namespace

class app_telemetry_reporter_impl
  : public std::enable_shared_from_this<app_telemetry_reporter_impl>
  , public connection_state_listener
{
public:
  app_telemetry_reporter_impl(std::shared_ptr<app_telemetry_meter> meter,
                              cluster_options options,
                              cluster_credentials credentials,
                              asio::io_context& ctx,
                              asio::ssl::context& tls)
    : meter_{ std::move(meter) }
    , options_{ std::move(options) }
    , credentials_{ std::move(credentials) }
    , ctx_{ ctx }
    , tls_{ tls }
    , backoff_{ ctx }
    , exponential_backoff_calculator_{
      std::chrono::milliseconds{ 100 },
      options_.app_telemetry_backoff_interval,
      2 /* backoff factor */,
      0.5 /* jitter factor */,
    }
  {
    if (options_.enable_app_telemetry) {
      if (!options_.app_telemetry_endpoint.empty()) {
        auto url = couchbase::core::utils::string_codec::url_parse(options_.app_telemetry_endpoint);
        if (url.host.empty() || url.scheme != "ws") {
          CB_LOG_WARNING(
            "unable to use \"{}\" as a app telemetry endpoint (expected ws:// and hostname)",
            options_.app_telemetry_endpoint);
          return;
        }
        addresses_.push_back({
          url.host,
          std::to_string(url.port),
          url.path,
          {},
        });
      }
    } else {
      meter_->disable();
    }
  }

  void stop()
  {
    websocket_state_ = connection_state::stopped;

    meter_->disable();
    if (auto dialer = std::move(dialer_); dialer) {
      dialer->stop();
    }
    backoff_.cancel();
    if (auto session = std::move(websocket_session_); session) {
      session->stop();
    }
  }

  void on_connection_pending(const app_telemetry_address& address) override
  {
    websocket_state_ = connection_state::connecting;
    CB_LOG_WARNING("connecting app telemetry WebSocket.  {}",
                   tao::json::to_string(tao::json::value{
                     { "hostname", address.hostname },
                   }));
  }

  void on_connected(const app_telemetry_address& address,
                    std::unique_ptr<io::stream_impl>&& stream) override
  {
    dialer_ = nullptr;
    backoff_.cancel();

    if (websocket_state_ == connection_state::stopped) {
      return;
    }

    websocket_state_ = connection_state::connected;
    CB_LOG_WARNING("connected app telemetry endpoint.  {}",
                   tao::json::to_string(tao::json::value{
                     { "stream", stream->id() },
                     { "hostname", address.hostname },
                   }));
    websocket_session_ = websocket_session::start(ctx_,
                                                  address,
                                                  credentials_,
                                                  std::move(stream),
                                                  meter_,
                                                  shared_from_this(),
                                                  options_.app_telemetry_ping_interval,
                                                  options_.app_telemetry_ping_timeout);
    retry_backoff_calculator_ = &no_backoff_calculator_;
    ++next_address_index_;
  }

  void on_websocket_ready() override
  {
    connection_attempt_ = 0;
  }

  void on_error(const app_telemetry_address& address,
                std::error_code ec,
                const std::string& message) override
  {
    if (ec == asio::error::operation_aborted || websocket_state_ == connection_state::stopped) {
      return;
    }

    websocket_state_ = connection_state::disconnected;
    websocket_session_ = nullptr;

    if (addresses_.empty()) {
      CB_LOG_WARNING("do not reconnect WebSocket for Application Telemetry, none of the nodes "
                     "exposes the collector endpoint. {}",
                     tao::json::to_string(tao::json::value{
                       { "message", ec.message() },
                       { "ec", ec.value() },
                       { "hostname", address.hostname },
                     }));
      return;
    }

    ++connection_attempt_;
    ++next_address_index_;
    if (next_address_index_ >= addresses_.size()) {
      static thread_local std::default_random_engine gen{ std::random_device{}() };
      std::shuffle(addresses_.begin(), addresses_.end(), gen);
      next_address_index_ = 0;
      retry_backoff_calculator_ = &exponential_backoff_calculator_;
    }
    auto next_address = addresses_[next_address_index_];
    auto backoff = retry_backoff_calculator_->retry_after(connection_attempt_);
    CB_LOG_WARNING("error from app telemetry endpoint, reconnecting in {}.  {}",
                   backoff,
                   tao::json::to_string(tao::json::value{
                     { "message", message },
                     { "ec", fmt::format("{}, {}", ec.value(), ec.message()) },
                     { "connection_attempt", connection_attempt_ },
                     { "hostname", address.hostname },
                     { "next_hostname", next_address.hostname },
                   }));
    if (backoff > std::chrono::milliseconds::zero()) {
      backoff_.expires_after(backoff);
      backoff_.async_wait([self = shared_from_this(), next_address](auto ec) {
        if (ec == asio::error::operation_aborted) {
          return;
        }
        if (self->websocket_state_ == connection_state::disconnected) {
          self->dialer_ =
            telemetry_dialer::dial(next_address, self->options_, self->ctx_, self->tls_, self);
        }
      });
      return;
    }
    dialer_ = telemetry_dialer::dial(next_address, options_, ctx_, tls_, shared_from_this());
  }

  void update_config(topology::configuration&& config)
  {
    if (!options_.enable_app_telemetry) {
      meter_->disable();
      return;
    }
    meter_->update_config(config);

    if (options_.app_telemetry_endpoint.empty()) {
      addresses_ = get_app_telemetry_addresses(config, options_.enable_tls, options_.network);
      next_address_index_ = 0;
    }

    if (addresses_.empty()) {
      meter_->disable();
    } else {
      meter_->enable();
      if (websocket_state_ == connection_state::disconnected) {
        dialer_ = telemetry_dialer::dial(
          addresses_[next_address_index_], options_, ctx_, tls_, shared_from_this());
      }
    }
  }

private:
  std::shared_ptr<app_telemetry_meter> meter_;
  cluster_options options_;
  cluster_credentials credentials_;
  asio::io_context& ctx_;
  asio::ssl::context& tls_;
  asio::steady_timer backoff_;
  const exponential_backoff_with_jitter exponential_backoff_calculator_;

  std::shared_ptr<telemetry_dialer> dialer_{ nullptr };

  connection_state websocket_state_{ connection_state::disconnected };
  std::shared_ptr<websocket_session> websocket_session_{};
  std::vector<app_telemetry_address> addresses_{};
  std::size_t next_address_index_{ 0 };

  const no_backoff no_backoff_calculator_{};
  const backoff_calculator* retry_backoff_calculator_{ &no_backoff_calculator_ };
  std::size_t connection_attempt_{ 0 };
};

app_telemetry_reporter::app_telemetry_reporter(std::shared_ptr<app_telemetry_meter> meter,
                                               const cluster_options& options,
                                               const cluster_credentials& credentials,
                                               asio::io_context& ctx,
                                               asio::ssl::context& tls)
  : impl_{
    std::make_shared<app_telemetry_reporter_impl>(std::move(meter), options, credentials, ctx, tls)
  }
{
}

app_telemetry_reporter::~app_telemetry_reporter() = default;

void
app_telemetry_reporter::update_config(topology::configuration config)
{
  return impl_->update_config(std::move(config));
}

void
app_telemetry_reporter::stop()
{
  return impl_->stop();
}

} // namespace couchbase::core
