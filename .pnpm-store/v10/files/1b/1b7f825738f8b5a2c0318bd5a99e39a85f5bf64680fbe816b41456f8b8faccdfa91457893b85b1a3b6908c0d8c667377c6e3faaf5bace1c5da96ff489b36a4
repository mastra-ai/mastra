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

#include <chrono>
#include <functional>

namespace couchbase::core::columnar
{
using backoff_calculator = std::function<std::chrono::milliseconds(std::size_t retry_attempts)>;

auto
exponential_backoff_with_full_jitter(std::chrono::milliseconds min_backoff,
                                     std::chrono::milliseconds max_backoff,
                                     double backoff_factor) -> backoff_calculator;

auto
default_backoff_calculator(std::size_t retry_attempts) -> std::chrono::milliseconds;
} // namespace couchbase::core::columnar
