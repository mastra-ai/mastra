/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2024 Couchbase, Inc.
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

#include "streams.hxx"

#include "core/platform/uuid.h"

#include <asio.hpp>
#include <asio/error.hpp>
#include <asio/ssl.hpp>

namespace couchbase::core::io
{
stream_impl::stream_impl(asio::io_context& ctx, bool is_tls)
  : strand_(asio::make_strand(ctx))
  , tls_(is_tls)
  , id_(uuid::to_string(uuid::random()))
{
}

auto
stream_impl::log_prefix() const -> std::string_view
{
  return tls_ ? "tls" : "plain";
}

auto
stream_impl::id() const -> const std::string&
{
  return id_;
}

plain_stream_impl::plain_stream_impl(asio::io_context& ctx)
  : stream_impl(ctx, false)
  , stream_(std::make_shared<asio::ip::tcp::socket>(strand_))
{
}

auto
plain_stream_impl::local_endpoint() const -> asio::ip::tcp::endpoint
{
  if (!stream_) {
    return {};
  }
  std::error_code ec;
  auto res = stream_->local_endpoint(ec);
  if (ec) {
    return {};
  }
  return res;
}

auto
plain_stream_impl::is_open() const -> bool
{
  if (stream_) {
    return stream_->is_open();
  }
  return false;
}

void
plain_stream_impl::close(utils::movable_function<void(std::error_code)>&& handler)
{
  if (!stream_) {
    return handler(asio::error::bad_descriptor);
  }
  return asio::post(strand_, [stream = std::move(stream_), handler = std::move(handler)]() {
    asio::error_code ec{};
    stream->shutdown(asio::socket_base::shutdown_both, ec);
    stream->close(ec);
    handler(ec);
  });
}

void
plain_stream_impl::set_options()
{
  if (!is_open()) {
    return;
  }
  std::error_code ec{};
  stream_->set_option(asio::ip::tcp::no_delay{ true }, ec);
  stream_->set_option(asio::socket_base::keep_alive{ true }, ec);
}

void
plain_stream_impl::async_connect(
  const asio::ip::tcp::resolver::results_type::endpoint_type& endpoint,
  utils::movable_function<void(std::error_code)>&& handler)
{
  if (!stream_) {
    id_ = uuid::to_string(uuid::random());
    stream_ = std::make_shared<asio::ip::tcp::socket>(strand_);
  }
  return stream_->async_connect(endpoint,
                                [stream = stream_, handler = std::move(handler)](auto ec) {
                                  return handler(ec);
                                });
}

void
plain_stream_impl::async_write(
  std::vector<asio::const_buffer>& buffers,
  utils::movable_function<void(std::error_code, std::size_t)>&& handler)
{
  if (!is_open()) {
    return handler(asio::error::bad_descriptor, {});
  }
  return asio::async_write(
    *stream_,
    buffers,
    [stream = stream_, handler = std::move(handler)](auto ec, auto bytes_transferred) {
      return handler(ec, bytes_transferred);
    });
}

void
plain_stream_impl::async_read_some(
  asio::mutable_buffer buffer,
  utils::movable_function<void(std::error_code, std::size_t)>&& handler)
{
  if (!is_open()) {
    return handler(asio::error::bad_descriptor, {});
  }
  return stream_->async_read_some(buffer, std::move(handler));
}

tls_stream_impl::tls_stream_impl(asio::io_context& ctx, asio::ssl::context& tls)
  : stream_impl(ctx, true)
  , tls_(tls)
  , stream_(
      std::make_shared<asio::ssl::stream<asio::ip::tcp::socket>>(asio::ip::tcp::socket(strand_),
                                                                 tls_))
{
}

auto
tls_stream_impl::local_endpoint() const -> asio::ip::tcp::endpoint
{
  if (!stream_) {
    return {};
  }
  std::error_code ec;
  auto res = stream_->lowest_layer().local_endpoint(ec);
  if (ec) {
    return {};
  }
  return res;
}

auto
tls_stream_impl::is_open() const -> bool
{
  if (stream_) {
    return stream_->lowest_layer().is_open();
  }
  return false;
}

void
tls_stream_impl::close(utils::movable_function<void(std::error_code)>&& handler)
{
  if (!stream_) {
    return handler(asio::error::bad_descriptor);
  }
  return asio::post(strand_, [stream = std::move(stream_), handler = std::move(handler)]() {
    asio::error_code ec{};
    stream->lowest_layer().shutdown(asio::socket_base::shutdown_both, ec);
    stream->lowest_layer().close(ec);
    handler(ec);
  });
}

void
tls_stream_impl::set_options()
{
  if (!is_open()) {
    return;
  }
  std::error_code ec{};
  stream_->lowest_layer().set_option(asio::ip::tcp::no_delay{ true }, ec);
  stream_->lowest_layer().set_option(asio::socket_base::keep_alive{ true }, ec);
}

void
tls_stream_impl::async_connect(const asio::ip::tcp::resolver::results_type::endpoint_type& endpoint,
                               utils::movable_function<void(std::error_code)>&& handler)
{
  if (!stream_) {
    id_ = uuid::to_string(uuid::random());
    stream_ = std::make_shared<asio::ssl::stream<asio::ip::tcp::socket>>(
      asio::ip::tcp::socket(strand_), tls_);
  }
  return stream_->lowest_layer().async_connect(
    endpoint, [stream = stream_, handler = std::move(handler)](std::error_code ec_connect) mutable {
      if (ec_connect == asio::error::operation_aborted) {
        return;
      }
      if (ec_connect) {
        return handler(ec_connect);
      }
      stream->async_handshake(
        asio::ssl::stream_base::client,
        [stream, handler = std::move(handler)](std::error_code ec_handshake) mutable {
          if (ec_handshake == asio::error::operation_aborted) {
            return;
          }
          return handler(ec_handshake);
        });
    });
}

void
tls_stream_impl::async_write(std::vector<asio::const_buffer>& buffers,
                             utils::movable_function<void(std::error_code, std::size_t)>&& handler)
{
  if (!is_open()) {
    return handler(asio::error::bad_descriptor, {});
  }
  return asio::async_write(
    *stream_,
    buffers,
    [stream = stream_, handler = std::move(handler)](auto ec, auto bytes_transferred) {
      return handler(ec, bytes_transferred);
    });
}

void
tls_stream_impl::async_read_some(
  asio::mutable_buffer buffer,
  utils::movable_function<void(std::error_code, std::size_t)>&& handler)
{
  if (!is_open()) {
    return handler(asio::error::bad_descriptor, {});
  }
  return stream_->async_read_some(
    buffer, [stream = stream_, handler = std::move(handler)](auto ec, auto bytes_transferred) {
      return handler(ec, bytes_transferred);
    });
}
} // namespace couchbase::core::io
