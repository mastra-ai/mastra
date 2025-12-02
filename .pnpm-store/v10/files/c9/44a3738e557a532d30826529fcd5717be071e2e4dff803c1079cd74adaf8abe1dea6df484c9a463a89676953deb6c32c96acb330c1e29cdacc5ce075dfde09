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

#include "core/utils/movable_function.hxx"
#include "ip_protocol.hxx"

#include <asio/error.hpp>
#include <asio/io_context.hpp>
#include <asio/ip/tcp.hpp>
#include <asio/ssl/context.hpp>
#include <asio/ssl/stream.hpp>
#include <asio/strand.hpp>

#include <string>
#include <vector>

namespace couchbase::core::io
{

template<typename Resolver, typename Handler>
static void
async_resolve(ip_protocol protocol,
              Resolver& resolver,
              const std::string& hostname,
              const std::string& service,
              Handler&& handler)
{

  switch (protocol) {
    case ip_protocol::force_ipv4:
      return resolver.async_resolve(
        asio::ip::tcp::v4(), hostname, service, std::forward<Handler>(handler));
    case ip_protocol::force_ipv6:
      return resolver.async_resolve(
        asio::ip::tcp::v6(), hostname, service, std::forward<Handler>(handler));
    case ip_protocol::any:
      [[fallthrough]];
    default:
      /* use any protocol */
      break;
  }
  return resolver.async_resolve(hostname, service, std::forward<Handler>(handler));
}

class stream_impl
{
protected:
  asio::strand<asio::io_context::executor_type> strand_;
  bool tls_;
  std::string id_{};

public:
  stream_impl(asio::io_context& ctx, bool is_tls);

  virtual ~stream_impl() = default;

  [[nodiscard]] auto log_prefix() const -> std::string_view;

  [[nodiscard]] auto id() const -> const std::string&;

  [[nodiscard]] auto get_executor() const noexcept
  {
    return strand_;
  }

  [[nodiscard]] virtual auto local_endpoint() const -> asio::ip::tcp::endpoint = 0;

  [[nodiscard]] virtual auto is_open() const -> bool = 0;

  virtual void close(utils::movable_function<void(std::error_code)>&& handler) = 0;

  virtual void set_options() = 0;

  virtual void async_connect(const asio::ip::tcp::resolver::results_type::endpoint_type& endpoint,
                             utils::movable_function<void(std::error_code)>&& handler) = 0;

  virtual void async_write(
    std::vector<asio::const_buffer>& buffers,
    utils::movable_function<void(std::error_code, std::size_t)>&& handler) = 0;

  virtual void async_read_some(
    asio::mutable_buffer buffer,
    utils::movable_function<void(std::error_code, std::size_t)>&& handler) = 0;
};

class plain_stream_impl : public stream_impl
{
private:
  std::shared_ptr<asio::ip::tcp::socket> stream_;

public:
  explicit plain_stream_impl(asio::io_context& ctx);

  [[nodiscard]] auto local_endpoint() const -> asio::ip::tcp::endpoint override;

  [[nodiscard]] auto is_open() const -> bool override;

  void close(utils::movable_function<void(std::error_code)>&& handler) override;

  void set_options() override;

  void async_connect(const asio::ip::tcp::resolver::results_type::endpoint_type& endpoint,
                     utils::movable_function<void(std::error_code)>&& handler) override;

  void async_write(std::vector<asio::const_buffer>& buffers,
                   utils::movable_function<void(std::error_code, std::size_t)>&& handler) override;

  void async_read_some(
    asio::mutable_buffer buffer,
    utils::movable_function<void(std::error_code, std::size_t)>&& handler) override;
};

class tls_stream_impl : public stream_impl
{
private:
  asio::ssl::context& tls_;
  std::shared_ptr<asio::ssl::stream<asio::ip::tcp::socket>> stream_;

public:
  tls_stream_impl(asio::io_context& ctx, asio::ssl::context& tls);

  [[nodiscard]] auto local_endpoint() const -> asio::ip::tcp::endpoint override;

  [[nodiscard]] auto is_open() const -> bool override;

  void close(utils::movable_function<void(std::error_code)>&& handler) override;

  void set_options() override;

  void async_connect(const asio::ip::tcp::resolver::results_type::endpoint_type& endpoint,
                     utils::movable_function<void(std::error_code)>&& handler) override;

  void async_write(std::vector<asio::const_buffer>& buffers,
                   utils::movable_function<void(std::error_code, std::size_t)>&& handler) override;

  void async_read_some(
    asio::mutable_buffer buffer,
    utils::movable_function<void(std::error_code, std::size_t)>&& handler) override;
};

} // namespace couchbase::core::io
