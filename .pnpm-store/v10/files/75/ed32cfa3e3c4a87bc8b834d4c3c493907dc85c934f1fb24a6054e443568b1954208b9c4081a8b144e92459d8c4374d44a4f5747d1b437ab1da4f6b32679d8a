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

#pragma once

#include <couchbase/retry_strategy.hxx>

#include <chrono>
#include <functional>
#include <memory>

namespace couchbase
{
using backoff_calculator = std::function<std::chrono::milliseconds(std::size_t retry_attempts)>;

/**
 * calculates a backoff time duration from the retry attempts on a given request.
 */
auto
controlled_backoff(std::size_t retry_attempts) -> std::chrono::milliseconds;

/**
 * calculates a backoff time duration from the retry attempts on a given request.
 *
 * @param min_backoff
 * @param max_backoff
 * @param backoff_factor
 * @return backoff calculator
 */
auto
exponential_backoff(std::chrono::milliseconds min_backoff,
                    std::chrono::milliseconds max_backoff,
                    double backoff_factor) -> backoff_calculator;

class best_effort_retry_strategy : public retry_strategy
{
public:
  explicit best_effort_retry_strategy(backoff_calculator calculator);
  ~best_effort_retry_strategy() override = default;

  auto retry_after(const retry_request& request, retry_reason reason) -> retry_action override;

  [[nodiscard]] auto to_string() const -> std::string override;

private:
  backoff_calculator backoff_calculator_;
};

[[nodiscard]] auto
make_best_effort_retry_strategy(backoff_calculator calculator = controlled_backoff)
  -> std::shared_ptr<best_effort_retry_strategy>;
} // namespace couchbase
