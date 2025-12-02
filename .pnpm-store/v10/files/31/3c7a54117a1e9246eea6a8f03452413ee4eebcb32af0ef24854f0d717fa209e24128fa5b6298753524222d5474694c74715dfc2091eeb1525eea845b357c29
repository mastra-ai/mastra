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

#pragma once

#include <couchbase/build_config.hxx>

#include "core/diagnostics.hxx"
#include "core/origin.hxx"
#include "core/platform/base64.h"
#include "core/utils/movable_function.hxx"
#include "http_context.hxx"
#include "http_message.hxx"
#include "http_parser.hxx"
#include "http_streaming_parser.hxx"
#include "http_streaming_response.hxx"
#include "streams.hxx"
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
#include "core/impl/bootstrap_error.hxx"
#endif

#include <asio.hpp>
#include <spdlog/fmt/bundled/chrono.h>

#include <memory>
#include <optional>
#include <string>
#include <utility>

namespace couchbase::core::io
{
class http_session_info
{
public:
  http_session_info(const std::string& client_id, const std::string& session_id);
  http_session_info(const std::string& client_id,
                    const std::string& session_id,
                    asio::ip::tcp::endpoint local_endpoint,
                    const asio::ip::tcp::endpoint& remote_endpoint);

  [[nodiscard]] auto remote_endpoint() const -> const asio::ip::tcp::endpoint&;
  [[nodiscard]] auto remote_address() const -> const std::string&;
  [[nodiscard]] auto local_endpoint() const -> const asio::ip::tcp::endpoint&;
  [[nodiscard]] auto local_address() const -> const std::string&;
  [[nodiscard]] auto log_prefix() const -> const std::string&;

private:
  std::string log_prefix_;
  asio::ip::tcp::endpoint remote_endpoint_{}; // connected endpoint
  std::string remote_endpoint_address_{};     // cached string with endpoint address
  asio::ip::tcp::endpoint local_endpoint_{};
  std::string local_endpoint_address_{};
};

class http_session : public std::enable_shared_from_this<http_session>
{
public:
  http_session(service_type type,
               std::string client_id,
               std::string node_uuid,
               asio::io_context& ctx,
               cluster_credentials credentials,
               std::string hostname,
               std::string service,
               http_context http_ctx);

  http_session(service_type type,
               std::string client_id,
               std::string node_uuid,
               asio::io_context& ctx,
               asio::ssl::context& tls,
               cluster_credentials credentials,
               std::string hostname,
               std::string service,
               http_context http_ctx);

  ~http_session();

  auto get_executor() const -> asio::strand<asio::io_context::executor_type>;
  [[nodiscard]] auto http_context() -> couchbase::core::http_context&;
  [[nodiscard]] auto remote_address() -> std::string;
  [[nodiscard]] auto local_address() -> std::string;
  [[nodiscard]] auto diag_info() -> diag::endpoint_diag_info;
  [[nodiscard]] auto log_prefix() -> std::string;
  [[nodiscard]] auto id() const -> const std::string&;
  [[nodiscard]] auto node_uuid() const -> const std::string&;
  [[nodiscard]] auto credentials() const -> const cluster_credentials&;
  [[nodiscard]] auto is_connected() const -> bool;
  [[nodiscard]] auto type() const -> service_type;
  [[nodiscard]] auto hostname() const -> const std::string&;
  [[nodiscard]] auto port() const -> const std::string&;
  [[nodiscard]] auto endpoint() -> const asio::ip::tcp::endpoint&;

  void connect(utils::movable_function<void()>&& callback);
  void on_stop(std::function<void()> handler);
  void stop();

  auto keep_alive() const -> bool;
  auto is_stopped() const -> bool;

  template<typename Handler>
  void write_and_subscribe(io::http_request& request, Handler&& handler)
  {
    if (stopped_) {
      return;
    }
    {
      response_context ctx{ std::forward<Handler>(handler) };
      if (request.streaming) {
        ctx.parser.response.body.use_json_streaming(std::move(request.streaming.value()));
      }
      std::scoped_lock lock(current_response_mutex_);
      streaming_response_ = false;
      std::swap(current_response_, ctx);
    }
    if (request.headers["connection"] == "keep-alive") {
      keep_alive_ = true;
    }
    request.headers["user-agent"] = user_agent_;
    auto credentials = fmt::format("{}:{}", credentials_.username, credentials_.password);
    request.headers["authorization"] = fmt::format(
      "Basic {}",
      base64::encode(gsl::as_bytes(gsl::span{ credentials.data(), credentials.size() })));
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

  void write_and_stream(io::http_request& request,
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
                        utils::movable_function<void(couchbase::core::error_union,
                                                     io::http_streaming_response)> resp_handler,
#else
                        utils::movable_function<void(std::error_code, io::http_streaming_response)>
                          resp_handler,
#endif
                        utils::movable_function<void()> stream_end_handler);

  void set_idle(std::chrono::milliseconds timeout);
  auto reset_idle() -> bool;

  /**
   * Reads some bytes from the body of the HTTP response. Should only be used in streaming mode.
   */
  void read_some(utils::movable_function<void(std::string, bool, std::error_code)>&& callback);

private:
  struct streaming_response_context {
#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
    utils::movable_function<void(couchbase::core::error_union, io::http_streaming_response)>
      resp_handler{};
#else
    utils::movable_function<void(std::error_code, io::http_streaming_response)> resp_handler{};
#endif
    utils::movable_function<void()> stream_end_handler{};
    std::optional<io::http_streaming_response> resp{};
    http_streaming_parser parser{};
    bool complete{ false };
  };

  struct response_context {
    utils::movable_function<void(std::error_code, io::http_response&&)> handler{};
    http_parser parser{};
  };

  void on_resolve(std::error_code ec, const asio::ip::tcp::resolver::results_type& endpoints);
  void do_connect(asio::ip::tcp::resolver::results_type::iterator it);
  void on_connect(const std::error_code& ec, asio::ip::tcp::resolver::results_type::iterator it);
  void initiate_connect();
  void do_read();
  void do_write();
  void write(const std::vector<std::uint8_t>& buf);
  void write(const std::string_view& buf);
  void flush();
  void cancel_current_response(std::error_code ec);
  void invoke_connect_callback();

  service_type type_{};
  std::string client_id_;
  std::string node_uuid_;
  std::string id_;
  asio::io_context& ctx_;
  asio::ip::tcp::resolver resolver_;
  std::unique_ptr<stream_impl> stream_;
  asio::steady_timer connect_deadline_timer_;
  asio::steady_timer idle_timer_;
  asio::steady_timer retry_backoff_;

  cluster_credentials credentials_;
  std::string hostname_;
  std::string service_;
  std::string user_agent_;

  std::atomic_bool stopped_{ false };
  std::atomic_bool connected_{ false };
  std::atomic_bool keep_alive_{ false };
  std::atomic_bool reading_{ false };

  utils::movable_function<void()> connect_callback_{};
  std::mutex connect_callback_mutex_{};
  std::function<void()> on_stop_handler_{ nullptr };

  response_context current_response_{};
  streaming_response_context current_streaming_response_{};
  bool streaming_response_{ false };
  std::mutex current_response_mutex_{};
  std::mutex read_some_mutex_{};

  std::array<std::uint8_t, 16384> input_buffer_{};
  std::vector<std::vector<std::uint8_t>> output_buffer_{};
  std::vector<std::vector<std::uint8_t>> writing_buffer_{};
  std::mutex output_buffer_mutex_{};
  std::mutex writing_buffer_mutex_{};
  asio::ip::tcp::resolver::results_type endpoints_{};
  http_session_info info_;
  std::mutex info_mutex_{};
  couchbase::core::http_context http_ctx_;

  std::chrono::time_point<std::chrono::steady_clock> last_active_{};
  diag::endpoint_state state_{ diag::endpoint_state::disconnected };
};
} // namespace couchbase::core::io
