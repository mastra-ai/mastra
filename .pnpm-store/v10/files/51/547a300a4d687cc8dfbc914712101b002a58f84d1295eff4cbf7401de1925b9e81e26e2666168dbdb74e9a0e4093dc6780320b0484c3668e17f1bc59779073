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

#include <couchbase/retry_strategy.hxx>
#include <couchbase/tracing/request_span.hxx>

#include <chrono>
#include <memory>
#include <optional>
#include <type_traits>

namespace couchbase
{
/**
 * Common options that used by most operations.
 *
 * @since 1.0.0
 * @committed
 */
template<typename derived_class>
class common_options
{
public:
  /**
   * Specifies a custom per-operation timeout.
   *
   * @note: if a custom timeout is provided through this builder, it will override the default set
   * on the environment.
   *
   * @param timeout the timeout to use for this operation.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto timeout(const std::chrono::milliseconds timeout) -> derived_class&
  {
    timeout_ = timeout;
    return self();
  }

  /**
   * Specifies a custom {@link couchbase::retry_strategy} for this operation.
   *
   * @param strategy the retry strategy to use for this operation.
   * @return this options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto retry_strategy(const std::shared_ptr<retry_strategy> strategy) -> derived_class&
  {
    retry_strategy_ = strategy;
    return self();
  }

  /**
   * @param span
   *
   * @since 1.0.4
   * @volatile
   */
  auto parent_span(std::shared_ptr<tracing::request_span> span) -> derived_class&
  {
    parent_span_ = std::move(span);
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built {
    const std::optional<std::chrono::milliseconds> timeout;
    const std::shared_ptr<couchbase::retry_strategy> retry_strategy;
    const std::shared_ptr<tracing::request_span> parent_span;
  };

protected:
  /**
   * @return immutable representation of the common options
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build_common_options() const -> built
  {
    return { timeout_, retry_strategy_, parent_span_ };
  }

  /**
   * Allows to return the right options builder instance for child implementations.
   *
   * @return derived_class
   *
   * @since 1.0.0
   * @internal
   */
  auto self() -> derived_class&
  {
    return *static_cast<derived_class*>(this);
  }

private:
  std::optional<std::chrono::milliseconds> timeout_{};
  std::shared_ptr<couchbase::retry_strategy> retry_strategy_{ nullptr };
  std::shared_ptr<tracing::request_span> parent_span_{ nullptr };
};

} // namespace couchbase
