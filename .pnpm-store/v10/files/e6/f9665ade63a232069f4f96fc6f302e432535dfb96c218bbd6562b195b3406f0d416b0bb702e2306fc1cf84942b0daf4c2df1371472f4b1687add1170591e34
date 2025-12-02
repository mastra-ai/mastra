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

#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/mutation_state.hxx>
#include <couchbase/mutation_token.hxx>
#include <couchbase/scan_result.hxx>

#include <cstdint>
#include <functional>
#include <optional>
#include <vector>

namespace couchbase
{

/**
 * Options for @ref collection#scan().
 *
 * @since 1.0.0
 * @committed
 */
struct scan_options : public common_options<scan_options> {
public:
  /**
   * Specifies whether only document IDs should be included in the results. Defaults to false.
   *
   * @param ids_only if set to true the content will not be included in the results
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto ids_only(bool ids_only) -> scan_options&
  {
    ids_only_ = ids_only;
    return self();
  }

  /**
   * Sets the {@link mutation_token}s this scan should be consistent with.
   *
   * These mutation tokens are returned from mutations (i.e. as part of a {@link mutation_result})
   * and if you want your scan to include those you need to pass the mutation tokens into a {@link
   * mutation_state}.
   *
   * @param state the mutation state containing the mutation tokens.
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto consistent_with(const mutation_state& state) -> scan_options&
  {
    mutation_state_ = state.tokens();
    return self();
  }

  /**
   * Allows to limit the maximum amount of bytes that are sent from the server in each partition
   * batch. Defaults to 15,000.
   *
   * @param batch_byte_limit the byte limit
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto batch_byte_limit(std::uint32_t batch_byte_limit) -> scan_options&
  {
    batch_byte_limit_ = batch_byte_limit;
    return self();
  }

  /**
   * Allows to limit the maximum number of scan items that are sent from the server in each
   * partition batch. Defaults to 50.
   *
   * @param batch_item_limit the item limit
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto batch_item_limit(std::uint32_t batch_item_limit) -> scan_options&
  {
    batch_item_limit_ = batch_item_limit;
    return self();
  }

  /**
   * Specifies the maximum number of partitions that can be scanned concurrently. Defaults to 1.
   *
   * @param concurrency the maximum number of concurrent partition scans
   * @return the options builder for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto concurrency(std::uint16_t concurrency) -> scan_options&
  {
    concurrency_ = concurrency;
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<scan_options>::built {
    bool ids_only;
    std::vector<mutation_token> mutation_state;
    std::optional<std::uint32_t> batch_byte_limit;
    std::optional<std::uint32_t> batch_item_limit;
    std::optional<std::uint16_t> concurrency;
  };

  /**
   * Validates options and returns them as an immutable value.
   *
   * @return consistent options as an immutable value.
   *
   * @exception std::system_error with code @ref errc::common::invalid_argument if the options are
   * not valid.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    return { build_common_options(), ids_only_,         mutation_state_,
             batch_byte_limit_,      batch_item_limit_, concurrency_ };
  }

private:
  bool ids_only_{ false };
  std::vector<mutation_token> mutation_state_{};
  std::optional<std::uint32_t> batch_byte_limit_{};
  std::optional<std::uint32_t> batch_item_limit_{};
  std::optional<std::uint16_t> concurrency_{};
};

/**
 * The signature for the handler of the @ref collection#scan() operation.
 *
 * @since 1.0.0
 * @volatile
 */
using scan_handler = std::function<void(error, scan_result)>;
} // namespace couchbase
