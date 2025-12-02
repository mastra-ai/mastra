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
#pragma once

#include <couchbase/error_codes.hxx>

#include "core/utils/movable_function.hxx"

#include <asio/steady_timer.hpp>

#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <system_error>

namespace couchbase::core::io
{
class http_session;
struct http_streaming_parser;
class http_streaming_response_body_impl;

class http_streaming_response_body
{
public:
  http_streaming_response_body() = default;
  http_streaming_response_body(asio::io_context& io,
                               std::shared_ptr<http_session> session,
                               std::string cached_data = {},
                               bool reading_complete = false);

  void set_deadline(std::chrono::time_point<std::chrono::steady_clock> deadline_tp);
  void next(utils::movable_function<void(std::string, std::error_code)>&& callback);
  void close(std::error_code ec = couchbase::errc::common::request_canceled);

private:
  std::shared_ptr<http_streaming_response_body_impl> impl_;
};

class http_streaming_response_impl;

class http_streaming_response
{
public:
  http_streaming_response() = default;
  http_streaming_response(asio::io_context& io,
                          const http_streaming_parser& parser,
                          std::shared_ptr<http_session> session);

  [[nodiscard]] auto status_code() const -> const std::uint32_t&;
  [[nodiscard]] auto status_message() const -> const std::string&;
  [[nodiscard]] auto headers() const -> const std::map<std::string, std::string>&;
  [[nodiscard]] auto body() -> http_streaming_response_body&;
  [[nodiscard]] auto must_close_connection() const -> bool;

private:
  std::shared_ptr<http_streaming_response_impl> impl_;
};
} // namespace couchbase::core::io
