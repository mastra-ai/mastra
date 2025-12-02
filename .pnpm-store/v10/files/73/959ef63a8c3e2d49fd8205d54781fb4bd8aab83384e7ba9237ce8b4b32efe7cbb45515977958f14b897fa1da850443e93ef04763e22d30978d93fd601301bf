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

#include "service_type.hxx"
#include "utils/movable_function.hxx"

#include <chrono>
#include <cinttypes>
#include <map>
#include <memory>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase::tracing
{
class request_span;
} // namespace couchbase::tracing

namespace couchbase::core
{
class ping_options
{
public:
  std::chrono::milliseconds key_value_timeout{};
  std::chrono::milliseconds analytics_timeout{};
  std::chrono::milliseconds n1ql_timeout{};
  std::chrono::milliseconds search_timeout{};
  std::chrono::milliseconds capi_timeout{};
  std::chrono::milliseconds management_timeout{};

  std::vector<service_type> services{
    service_type::query,
    service_type::analytics,
    service_type::search,
    service_type::management,
  };

  bool ignore_missing_services{ false };

  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
  } internal{};
};

enum class ping_state {
  ok,
  timeout,
  error,
};

struct endpoint_ping_result {
  std::string endpoint;
  std::error_code error;
  std::chrono::milliseconds latency;
  std::string id;
  std::string scope;
  ping_state state;
};

class ping_result
{
public:
  std::uint64_t config_revision;
  std::map<service_type, std::vector<endpoint_ping_result>> services;
};

using ping_callback = utils::movable_function<void(ping_result result, std::error_code ec)>;

} // namespace couchbase::core
