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

#include "core/core_sdk_shim.hxx"
#include "core/key_value_config.hxx"
#include "core/seed_config.hxx"

#include <memory>
#include <string>

namespace couchbase
{
class retry_strategy;
} // namespace couchbase

namespace couchbase::core::columnar
{
struct timeout_config {
  static constexpr std::chrono::milliseconds default_connect_timeout{ 10'000 };
  static constexpr std::chrono::milliseconds default_dispatch_timeout{ 30'000 };
  static constexpr std::chrono::milliseconds default_query_timeout{ 600'000 };
  static constexpr std::chrono::milliseconds default_management_timeout{ 30'000 };

  // TODO(DC): Use connect_timeout and dispatch_timeout once the agent provides an entry point for
  // opening the cluster
  std::chrono::milliseconds connect_timeout{ default_connect_timeout };   // Not currently used
  std::chrono::milliseconds dispatch_timeout{ default_dispatch_timeout }; // Not currently used

  std::chrono::milliseconds query_timeout{ default_query_timeout };
  std::chrono::milliseconds management_timeout{ default_management_timeout };

  [[nodiscard]] auto to_string() const -> std::string;
};

struct agent_config {
  core_sdk_shim shim; // TODO: remove once refactoring will be finished.

  timeout_config timeouts{};
  std::string user_agent{};

  [[nodiscard]] auto to_string() const -> std::string;
};
} // namespace couchbase::core::columnar
