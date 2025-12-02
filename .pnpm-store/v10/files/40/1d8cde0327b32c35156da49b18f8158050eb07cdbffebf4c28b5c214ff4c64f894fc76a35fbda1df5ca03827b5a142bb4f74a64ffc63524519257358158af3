/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "utils/movable_function.hxx"

#include <chrono>
#include <cinttypes>
#include <memory>
#include <optional>
#include <string>
#include <system_error>
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
class analytics_query_options
{
public:
  std::vector<std::byte> payload{};
  std::int32_t priority{};
  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
  std::chrono::milliseconds timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
  } internal{};
};

class analytics_query_row_reader_impl;

class analytics_query_row_reader
{
public:
  analytics_query_row_reader();

  auto next_row() -> std::vector<std::byte>;

  auto error() -> std::error_code;

  auto meta_data() -> std::optional<std::vector<std::byte>>;

  auto close() -> std::error_code;

private:
  std::shared_ptr<analytics_query_row_reader_impl> impl_;
};

using analytics_query_callback =
  utils::movable_function<void(analytics_query_row_reader reader, std::error_code ec)>;

} // namespace couchbase::core
