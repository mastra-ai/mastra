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

#include "core/row_streamer.hxx"
#include "core/utils/movable_function.hxx"
#include "error.hxx"

#include <chrono>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <system_error>
#include <variant>
#include <vector>

namespace couchbase::core::columnar
{
struct query_warning {
  std::int32_t code;
  std::string message;
};

struct query_metrics {
  std::chrono::nanoseconds elapsed_time{};
  std::chrono::nanoseconds execution_time{};
  std::uint64_t result_count{};
  std::uint64_t result_size{};
  std::uint64_t processed_objects{};
};

struct query_metadata {
  std::string request_id{};
  std::vector<query_warning> warnings{};
  query_metrics metrics{};
};

struct query_result_row {
  std::string content;
};

struct query_result_end {
};

class query_result_impl;

class query_result
{
public:
  query_result() = default;
  explicit query_result(row_streamer rows);

  void next_row(
    utils::movable_function<void(std::variant<std::monostate, query_result_row, query_result_end>,
                                 error)> handler);
  void cancel();
  auto metadata() -> std::optional<query_metadata>;

private:
  std::shared_ptr<query_result_impl> impl_{};
};
} // namespace couchbase::core::columnar
