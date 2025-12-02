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
 * Represents a single warning returned from the analytics engine.
 *
 * @note warnings are not terminal errors but hints from the engine that something was not as
 * expected.
 *
 * @since 1.0.0
 * @committed
 */
class analytics_warning
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  analytics_warning() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  analytics_warning(std::uint64_t code, std::string message)
    : code_{ code }
    , message_{ std::move(message) }
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

private:
  std::uint64_t code_{};
  std::string message_{};
};

} // namespace couchbase
