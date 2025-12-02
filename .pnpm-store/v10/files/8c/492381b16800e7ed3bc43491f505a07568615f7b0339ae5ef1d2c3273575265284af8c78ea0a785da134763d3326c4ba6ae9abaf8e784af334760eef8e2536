/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "service_type.hxx"

#include <chrono>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace couchbase::core::diag
{
enum class cluster_state {
  /** all nodes and their sockets are reachable */
  online,
  /** at least one socket per service is reachable */
  degraded,
  /** not even one socket per service is reachable */
  offline,
};

enum class endpoint_state {
  /** the endpoint is not reachable */
  disconnected,
  /** currently connecting (includes auth, ...) */
  connecting,
  /** connected and ready */
  connected,
  /** disconnecting (after being connected) */
  disconnecting,
};

struct endpoint_diag_info {
  service_type type{};
  std::string id;
  std::optional<std::chrono::microseconds> last_activity{};
  std::string remote;
  std::string local;
  endpoint_state state{};
  /** serialized as "namespace" */
  std::optional<std::string> bucket{};
  std::optional<std::string> details{};
};

struct diagnostics_result {
  std::string id;
  std::string sdk;
  std::map<service_type, std::vector<endpoint_diag_info>> services{};

  int version{ 2 };
};

enum class ping_state {
  ok,
  timeout,
  error,
};

struct endpoint_ping_info {
  service_type type{};
  std::string id;
  std::chrono::microseconds latency;
  std::string remote;
  std::string local;
  ping_state state;
  /** serialized as "namespace" */
  std::optional<std::string> bucket{};
  /** if ping state is error, contains error message */
  std::optional<std::string> error{};
};

struct ping_result {
  std::string id;
  std::string sdk;
  std::map<service_type, std::vector<endpoint_ping_info>> services{};

  int version{ 2 };
};
} // namespace couchbase::core::diag
