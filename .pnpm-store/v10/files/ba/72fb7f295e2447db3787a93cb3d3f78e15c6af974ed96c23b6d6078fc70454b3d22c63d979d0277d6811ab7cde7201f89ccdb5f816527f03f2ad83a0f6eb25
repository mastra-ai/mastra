/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2023 Couchbase, Inc.
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

namespace couchbase::core::timeout_defaults
{
constexpr std::chrono::milliseconds bootstrap_timeout{ 10'000 };
constexpr std::chrono::milliseconds dispatch_timeout{ 30'000 };

constexpr std::chrono::milliseconds resolve_timeout{ 2'000 };
constexpr std::chrono::milliseconds connect_timeout{ 2'000 };
constexpr std::chrono::milliseconds key_value_timeout{ 2'500 };
constexpr std::chrono::milliseconds key_value_durable_timeout{ 10'000 };
constexpr std::chrono::milliseconds key_value_scan_timeout{ 75'000 };
constexpr std::chrono::milliseconds view_timeout{ 75'000 };
constexpr std::chrono::milliseconds query_timeout{ 75'000 };
constexpr std::chrono::milliseconds analytics_timeout{ 75'000 };
constexpr std::chrono::milliseconds search_timeout{ 75'000 };
constexpr std::chrono::milliseconds management_timeout{ 75'000 };
constexpr std::chrono::milliseconds eventing_timeout{ 75'000 };

constexpr std::chrono::milliseconds dns_srv_timeout{ 500 };
constexpr std::chrono::milliseconds tcp_keep_alive_interval{ 60'000 };
constexpr std::chrono::milliseconds config_poll_interval{ 2'500 };
constexpr std::chrono::milliseconds config_poll_floor{ 50 };
constexpr std::chrono::milliseconds config_idle_redial_timeout{ 5 * 60'000 };
constexpr std::chrono::milliseconds idle_http_connection_timeout{ 1'000 };

constexpr std::chrono::milliseconds app_telemetry_ping_interval{ 30'000 };
constexpr std::chrono::milliseconds app_telemetry_ping_timeout{ 2'000 };
constexpr std::chrono::milliseconds app_telemetry_backoff_interval{ std::chrono::hours{ 1 } };
} // namespace couchbase::core::timeout_defaults
