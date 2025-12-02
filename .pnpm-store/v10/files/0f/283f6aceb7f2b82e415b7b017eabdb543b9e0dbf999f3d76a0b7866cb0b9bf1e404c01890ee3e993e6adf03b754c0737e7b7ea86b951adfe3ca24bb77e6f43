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

#include <cstdint>
#include <optional>
#include <string>

namespace couchbase
{

/**
 * Represents a single warning returned from the query engine.
 *
 * @note warnings are not terminal errors but hints from the engine that something was not as
 * expected.
 *
 * @since 1.0.0
 * @committed
 */
class query_warning
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  query_warning() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  query_warning(std::uint64_t code,
                std::string message,
                std::optional<std::uint64_t> reason,
                std::optional<bool> retry)
    : code_{ code }
    , message_{ std::move(message) }
    , reason_{ std::move(reason) }
    , retry_{ std::move(retry) }
  {
  }

  /**
   * Error code.
   *
   * @return error code
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto code() const -> std::uint64_t
  {
    return code_;
  }

  /**
   * Error message.
   *
   * @return human readable explanation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto message() const -> const std::string&
  {
    return message_;
  }

  /**
   * Optional reason code that clarifies the error code.
   *
   * @return clarification of the error code
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto reason() const -> const std::optional<std::uint64_t>&
  {
    return reason_;
  }

  /**
   * Optional flag that indicates whether the request should be retried.
   *
   * @return non empty optional with `true` if the server requested retry.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto retry() const -> const std::optional<bool>&
  {
    return retry_;
  }

private:
  std::uint64_t code_{};
  std::string message_{};
  std::optional<std::uint64_t> reason_{};
  std::optional<bool> retry_{};
};

} // namespace couchbase
