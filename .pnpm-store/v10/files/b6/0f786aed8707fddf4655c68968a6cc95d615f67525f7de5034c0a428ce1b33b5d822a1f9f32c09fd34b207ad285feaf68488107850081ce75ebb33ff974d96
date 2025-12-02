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

#pragma once

#include "base_error_context.hxx"

#include <cstdint>
#include <optional>

namespace couchbase::core
{
/**
 * The error context returned with Query operations.
 *
 * @since 1.0.0
 * @committed
 */
class query_error_context : public base_error_context
{
public:
  /**
   * Creates empty error context
   *
   * @since 1.0.0
   * @committed
   */
  query_error_context() = default;

  query_error_context(std::error_code ec,
                      std::optional<std::string> last_dispatched_to,
                      std::optional<std::string> last_dispatched_from,
                      std::size_t retry_attempts,
                      std::set<retry_reason> retry_reasons,
                      std::uint64_t first_error_code,
                      std::string first_error_message,
                      std::string client_context_id,
                      std::string statement,
                      std::optional<std::string> parameters,
                      std::string method,
                      std::string path,
                      std::uint32_t http_status,
                      std::string http_body,
                      std::string hostname,
                      std::uint16_t port)
    : base_error_context{ {},
                          ec,
                          std::move(last_dispatched_to),
                          std::move(last_dispatched_from),
                          retry_attempts,
                          std::move(retry_reasons) }
    , first_error_code_{ first_error_code }
    , first_error_message_{ std::move(first_error_message) }
    , client_context_id_{ std::move(client_context_id) }
    , statement_{ std::move(statement) }
    , parameters_{ std::move(parameters) }
    , method_{ std::move(method) }
    , path_{ std::move(path) }
    , http_status_{ http_status }
    , http_body_{ std::move(http_body) }
    , hostname_{ std::move(hostname) }
    , port_{ port }
  {
  }

  [[nodiscard]] auto first_error_code() const -> std::uint64_t
  {
    return first_error_code_;
  }

  [[nodiscard]] auto first_error_message() const -> const std::string&
  {
    return first_error_message_;
  }

  [[nodiscard]] auto client_context_id() const -> const std::string&
  {
    return client_context_id_;
  }

  [[nodiscard]] auto statement() const -> const std::string&
  {
    return statement_;
  }

  [[nodiscard]] auto parameters() const -> const std::optional<std::string>&
  {
    return parameters_;
  }

  [[nodiscard]] auto method() const -> const std::string&
  {
    return method_;
  }

  [[nodiscard]] auto path() const -> const std::string&
  {
    return path_;
  }

  [[nodiscard]] auto http_status() const -> std::uint32_t
  {
    return http_status_;
  }

  [[nodiscard]] auto http_body() const -> const std::string&
  {
    return http_body_;
  }

  [[nodiscard]] auto hostname() const -> const std::string&
  {
    return hostname_;
  }

  [[nodiscard]] auto port() const -> std::uint16_t
  {
    return port_;
  }

  [[nodiscard]] auto to_json() const -> std::string;

private:
  std::uint64_t first_error_code_{};
  std::string first_error_message_{};
  std::string client_context_id_{};
  std::string statement_{};
  std::optional<std::string> parameters_{};
  std::string method_{};
  std::string path_{};
  std::uint32_t http_status_{};
  std::string http_body_{};
  std::string hostname_{};
  std::uint16_t port_{};
};
} // namespace couchbase::core
