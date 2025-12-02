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

#include <chrono>
#include <optional>
#include <string>
#include <vector>

namespace couchbase::core
{
struct key_value_config {
  static constexpr std::chrono::milliseconds default_connect_timeout{ std::chrono::seconds{ 7 } };
  static constexpr std::chrono::milliseconds default_reconnect_wait_backoff{ std::chrono::seconds{
    5 } };
  static constexpr std::size_t default_pool_size{ 1 };
  static constexpr std::size_t default_max_queue_size{ 2048 };
  static constexpr std::size_t default_connection_buffer_size{ 0 };

  std::chrono::milliseconds connect_timeout{ default_connect_timeout };
  std::chrono::milliseconds reconnect_wait_backoff{ default_reconnect_wait_backoff };
  std::size_t pool_size{ default_pool_size };
  std::size_t max_queue_size{ default_max_queue_size };
  std::size_t connection_buffer_size{ default_connection_buffer_size };

  [[nodiscard]] auto to_string() const -> std::string;
};
} // namespace couchbase::core
