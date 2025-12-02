/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include <couchbase/best_effort_retry_strategy.hxx>

#include <couchbase/retry_action.hxx>
#include <couchbase/retry_reason.hxx>
#include <couchbase/retry_request.hxx>

#include <spdlog/fmt/bundled/core.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <string>
#include <utility>

namespace couchbase
{
auto
controlled_backoff(std::size_t retry_attempts) -> std::chrono::milliseconds
{
  switch (retry_attempts) {
    case 0:
      return std::chrono::milliseconds(1);

    case 1:
      return std::chrono::milliseconds(10);

    case 2:
      return std::chrono::milliseconds(50);

    case 3:
      return std::chrono::milliseconds(100);

    case 4:
      return std::chrono::milliseconds(500);

    default:
      break;
  }
  return std::chrono::milliseconds(1'000);
}

auto
exponential_backoff(std::chrono::milliseconds min_backoff,
                    std::chrono::milliseconds max_backoff,
                    double backoff_factor) -> backoff_calculator
{
  double min = 1;   // 1 millisecond
  double max = 500; // 500 milliseconds
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

  return [min, max, factor](std::size_t retry_attempts) {
    double backoff = min * std::pow(factor, static_cast<double>(retry_attempts));
    backoff = std::max(std::min(backoff, max), min);
    return std::chrono::milliseconds(static_cast<std::uint64_t>(backoff));
  };
}

best_effort_retry_strategy::best_effort_retry_strategy(backoff_calculator calculator)
  : backoff_calculator_{ std::move(calculator) }
{
}

auto
best_effort_retry_strategy::retry_after(const retry_request& request,
                                        retry_reason reason) -> retry_action
{
  if (request.idempotent() || allows_non_idempotent_retry(reason)) {
    return retry_action{ backoff_calculator_(request.retry_attempts()) };
  }
  return retry_action::do_not_retry();
}

auto
best_effort_retry_strategy::to_string() const -> std::string
{
  return fmt::format(R"(#<best_effort_retry_strategy:{} backoff_calculator=#<{}:{}>>)",
                     static_cast<const void*>(this),
                     typeid(backoff_calculator_).name(),
                     typeid(backoff_calculator_).hash_code());
}

auto
make_best_effort_retry_strategy(backoff_calculator calculator)
  -> std::shared_ptr<best_effort_retry_strategy>
{
  return std::make_shared<best_effort_retry_strategy>(std::move(calculator));
}
} // namespace couchbase
