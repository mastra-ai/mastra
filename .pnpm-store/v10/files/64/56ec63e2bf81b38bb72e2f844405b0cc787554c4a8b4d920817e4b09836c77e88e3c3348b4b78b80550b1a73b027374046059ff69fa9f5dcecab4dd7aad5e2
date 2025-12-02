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

#include <chrono>
#include <cinttypes>

namespace couchbase
{

/**
 * Search Metrics contains the search result metrics containing counts and timings
 *
 * @since 1.0.0
 * @committed
 */
class search_metrics
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  search_metrics() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  search_metrics(std::chrono::nanoseconds took,
                 std::uint64_t total_rows,
                 std::uint64_t success_partition_count,
                 std::uint64_t error_partition_count,
                 std::uint64_t total_partition_count,
                 double max_score)
    : took_{ took }
    , total_rows_{ total_rows }
    , success_partition_count_{ success_partition_count }
    , error_partition_count_{ error_partition_count }
    , total_partition_count_{ total_partition_count }
    , max_score_{ max_score }
  {
  }

  /**
   * The total time taken for the request, that is the time from when the request was received until
   * the results were returned.
   *
   * @return total time duration
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto took() const -> std::chrono::nanoseconds
  {
    return took_;
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto total_rows() const -> std::uint64_t
  {
    return total_rows_;
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto success_partition_count() const -> std::uint64_t
  {
    return success_partition_count_;
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto error_partition_count() const -> std::uint64_t
  {
    return error_partition_count_;
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto total_partition_count() const -> std::uint64_t
  {
    return total_partition_count_;
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto max_score() const -> double
  {
    return max_score_;
  }

private:
  std::chrono::nanoseconds took_{};
  std::uint64_t total_rows_{};
  std::uint64_t success_partition_count_{};
  std::uint64_t error_partition_count_{};
  std::uint64_t total_partition_count_{};
  double max_score_{};
};

} // namespace couchbase
