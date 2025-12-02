/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include <couchbase/build_config.hxx>

#include "core/impl/bootstrap_error.hxx"
#include "service_type.hxx"
#include "utils/movable_function.hxx"

#include <chrono>
#include <cinttypes>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase
{
class retry_strategy;
namespace tracing
{
class request_span;
} // namespace tracing
} // namespace couchbase

namespace couchbase::core
{
class http_request
{
public:
  service_type service{};
  std::string method{};
  std::string endpoint{};
  std::string path{};
  std::string username{};
  std::string password{};
  std::string body{};
  std::map<std::string, std::string> headers{};
  std::string content_type{};
  std::string client_context_id{};
  bool is_idempotent{};
  bool is_read_only{};
  std::string unique_id{};
  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
  std::chrono::milliseconds timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
    std::string undesired_endpoint{};
  } internal{};
};

namespace io
{
class http_streaming_response;
struct http_response;
} // namespace io

class http_response_impl;

class http_response_body
{
public:
  explicit http_response_body(std::shared_ptr<http_response_impl> impl);

  void next(utils::movable_function<void(std::string, std::error_code)> callback);
  void cancel();

private:
  std::shared_ptr<http_response_impl> impl_;
};

class http_response
{
public:
  http_response() = default;
  explicit http_response(io::http_streaming_response resp);

  [[nodiscard]] auto endpoint() const -> std::string;
  [[nodiscard]] auto status_code() const -> std::uint32_t;
  [[nodiscard]] auto content_length() const -> std::size_t;

  [[nodiscard]] auto body() const -> http_response_body;
  void close();

private:
  std::shared_ptr<http_response_impl> impl_;
};

#ifdef COUCHBASE_CXX_CLIENT_COLUMNAR
using free_form_http_request_callback =
  utils::movable_function<void(http_response response, couchbase::core::error_union err)>;
#else
using free_form_http_request_callback =
  utils::movable_function<void(http_response response, std::error_code ec)>;
#endif

class buffered_http_response_impl;

class buffered_http_response
{
public:
  buffered_http_response() = default;
  explicit buffered_http_response(io::http_response resp);

  [[nodiscard]] auto endpoint() const -> std::string;
  [[nodiscard]] auto status_code() const -> std::uint32_t;
  [[nodiscard]] auto content_length() const -> std::size_t;

  [[nodiscard]] auto body() -> std::string;

private:
  std::shared_ptr<buffered_http_response_impl> impl_;
};

using buffered_free_form_http_request_callback =
  utils::movable_function<void(buffered_http_response response, std::error_code ec)>;
} // namespace couchbase::core
