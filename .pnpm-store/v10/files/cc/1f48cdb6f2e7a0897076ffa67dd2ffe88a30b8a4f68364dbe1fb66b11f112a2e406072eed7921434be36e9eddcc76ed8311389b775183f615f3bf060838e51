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

#include "error.hxx"
#include "query_result.hxx"

#include "core/json_string.hxx"
#include "core/utils/movable_function.hxx"

#include <chrono>
#include <map>
#include <optional>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase::core::columnar
{
enum class query_scan_consistency : std::uint8_t {
  not_bounded,
  request_plus,
};

struct query_options {
  // Required
  std::string statement;

  // Optional - should be set if query is at scope-level
  std::optional<std::string> database_name{};
  std::optional<std::string> scope_name{};

  // Optional - not sent on the wire if unset
  std::optional<bool> priority{};
  std::vector<couchbase::core::json_string> positional_parameters{};
  std::map<std::string, couchbase::core::json_string> named_parameters{};
  std::optional<bool> read_only{};
  std::optional<query_scan_consistency> scan_consistency{};
  std::map<std::string, couchbase::core::json_string> raw{};
  std::optional<std::chrono::milliseconds> timeout{};
};

using query_callback = utils::movable_function<void(query_result result, error err)>;
} // namespace couchbase::core::columnar
