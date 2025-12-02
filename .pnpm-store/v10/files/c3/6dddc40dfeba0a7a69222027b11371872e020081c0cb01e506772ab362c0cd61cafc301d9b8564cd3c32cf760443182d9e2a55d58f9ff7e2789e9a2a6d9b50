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

#include "backoff_calculator.hxx"

#include <random>

namespace couchbase::core::columnar
{
auto
exponential_backoff_with_full_jitter(std::chrono::milliseconds min_backoff,
                                     std::chrono::milliseconds max_backoff,
                                     double backoff_factor) -> backoff_calculator
{

  double min = 100;   // 100 milliseconds
  double max = 60000; // 1 minute
  double factor = 2;

  if (min_backoff > std::chrono::milliseconds::zero()) {
    min = static_cast<double>(min_backoff.count());
  }
  if (max_backoff > std::chrono::milliseconds::zero()) {
    max = static_cast<double>(max_backoff.count());
  }
  if (backoff_factor > 0) {
    factor = backoff_factor;
  }

  return [min, max, factor](std::size_t retry_attempts) -> std::chrono::milliseconds {
    const std::int32_t max_backoff =
      static_cast<std::int32_t>(std::round(std::min(max, min * std::pow(factor, retry_attempts))));

    std::mt19937 gen(std::random_device{}());
    std::uniform_int_distribution<std::int32_t> distrib(0, max_backoff);

    return std::chrono::milliseconds(distrib(gen));
  };
}

auto
default_backoff_calculator(std::size_t retry_attempts) -> std::chrono::milliseconds
{
  auto calculator = exponential_backoff_with_full_jitter(
    std::chrono::milliseconds(100), std::chrono::minutes(1), 2);
  return calculator(retry_attempts);
}
} // namespace couchbase::core::columnar
