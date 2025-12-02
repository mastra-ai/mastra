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

#include <couchbase/common_durability_options.hxx>
#include <couchbase/counter_result.hxx>
#include <couchbase/error.hxx>
#include <couchbase/expiry.hxx>

#include <chrono>
#include <functional>
#include <memory>
#include <optional>

namespace couchbase
{
/**
 * Options for binary_collection#increment().
 *
 * @since 1.0.0
 * @committed
 */
struct increment_options : public common_durability_options<increment_options> {
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_durability_options<increment_options>::built {
    const std::uint32_t expiry;
    const std::uint64_t delta;
    const std::optional<std::uint64_t> initial_value;
  };

  /**
   * Validates options and returns them as an immutable value.
   *
   * @return consistent options as an immutable value
   *
   * @exception std::system_error with code errc::common::invalid_argument if the options are not
   * valid
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    auto base = build_common_durability_options();
    return { base, expiry_, delta_, initial_value_ };
  }

  /**
   * Sets the expiry for the document. By default the document will never expire.
   *
   * The duration must be less than 50 years. For expiry further in the future, use
   * {@link #expiry(std::chrono::system_clock::time_point)}.
   *
   * @param duration the duration after which the document will expire (zero duration means never
   * expire).
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto expiry(std::chrono::seconds duration) -> increment_options&
  {
    expiry_ = core::impl::expiry_relative(duration);
    return self();
  }

  /**
   * Sets the expiry for the document. By default the document will never expire.
   *
   * @param time_point the point in time when the document will expire (epoch second zero means
   * never expire).
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto expiry(std::chrono::system_clock::time_point time_point) -> increment_options&
  {
    expiry_ = core::impl::expiry_absolute(time_point);
    return self();
  }

  /**
   * The amount of which the document value should be incremented.
   *
   * @param delta the amount to increment.
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto delta(std::uint64_t delta) -> increment_options&
  {
    delta_ = delta;
    return self();
  }

  /**
   * The initial value that should be used if the document has not been created yet.
   *
   * @param value the initial value to use.
   * @return this options class for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto initial(std::uint64_t value) -> increment_options&
  {
    initial_value_ = value;
    return self();
  }

private:
  std::uint32_t expiry_{ 0 };
  std::uint64_t delta_{ 1 };
  std::optional<std::uint64_t> initial_value_{};
};

/**
 * The signature for the handler of the @ref binary_collection#increment() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using increment_handler = std::function<void(error, counter_result)>;
} // namespace couchbase
