/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "range_scan_options.hxx"
#include "timeout_defaults.hxx"

#include <couchbase/best_effort_retry_strategy.hxx>
#include <couchbase/mutation_token.hxx>
#include <couchbase/retry_strategy.hxx>

#include <chrono>
#include <cstdint>
#include <memory>
#include <optional>
#include <vector>

namespace couchbase
{
class retry_strategy;
namespace tracing
{
class request_span;
} // namespace tracing
} // namespace couchbase

namespace couchbase::core
{
struct mutation_state {
  std::vector<couchbase::mutation_token> tokens;
};

struct range_scan_orchestrator_options {
  static constexpr std::uint16_t default_concurrency{ 1 };

  bool ids_only{ false };
  std::optional<mutation_state> consistent_with{};
  std::uint32_t batch_item_limit{ range_scan_continue_options::default_batch_item_limit };
  std::uint32_t batch_byte_limit{ range_scan_continue_options::default_batch_byte_limit };
  std::uint16_t concurrency{ default_concurrency };

  std::shared_ptr<couchbase::retry_strategy> retry_strategy{ make_best_effort_retry_strategy() };
  std::chrono::milliseconds timeout{ timeout_defaults::key_value_scan_timeout };
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};
};
} // namespace couchbase::core
