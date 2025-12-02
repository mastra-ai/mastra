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
 * Query Metrics contains the query result metrics containing counts and timings
 *
 * @since 1.0.0
 * @committed
 */
class query_metrics
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  query_metrics() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  query_metrics(std::chrono::nanoseconds elapsed_time,
                std::chrono::nanoseconds execution_time,
                std::uint64_t result_count,
                std::uint64_t result_size,
                std::uint64_t sort_count,
                std::uint64_t mutation_count,
                std::uint64_t error_count,
                std::uint64_t warning_count)
    : elapsed_time_{ elapsed_time }
    , execution_time_{ execution_time }
    , result_count_{ result_count }
    , result_size_{ result_size }
    , sort_count_{ sort_count }
    , mutation_count_{ mutation_count }
    , error_count_{ error_count }
    , warning_count_{ warning_count }
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
  [[nodiscard]] auto elapsed_time() const -> std::chrono::nanoseconds
  {
    return elapsed_time_;
  }

  /**
   * The time taken for the execution of the request, that is the time from when query execution
   * started until the results were returned.
   *
   * @return the execution time duration
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto execution_time() const -> std::chrono::nanoseconds
  {
    return execution_time_;
  }

  /**
   * The total number of objects in the results.
   *
   * @return number of results
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto result_count() const -> std::uint64_t
  {
    return result_count_;
  }

  /**
   * The total number of bytes in the results
   *
   * @return number of bytes
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto result_size() const -> std::uint64_t
  {
    return result_size_;
  }

  /**
   * The total number of results selected by the engine before restriction through LIMIT clause.
   *
   * @return number of results
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto sort_count() const -> std::uint64_t
  {
    return sort_count_;
  }

  /**
   * The number of mutations that were made during the request
   *
   * @return number of mutations
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto mutation_count() const -> std::uint64_t
  {
    return mutation_count_;
  }

  /**
   * The number of errors that occurred during the request
   *
   * @return number of errors
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto error_count() const -> std::uint64_t
  {
    return error_count_;
  }

  /**
   * The number of warnings that occurred during the request.
   *
   * @return number of warnings
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto warning_count() const -> std::uint64_t
  {
    return warning_count_;
  }

private:
  std::chrono::nanoseconds elapsed_time_{};
  std::chrono::nanoseconds execution_time_{};
  std::uint64_t result_count_{};
  std::uint64_t result_size_{};
  std::uint64_t sort_count_{};
  std::uint64_t mutation_count_{};
  std::uint64_t error_count_{};
  std::uint64_t warning_count_{};
};

} // namespace couchbase
