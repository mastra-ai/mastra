/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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
#include <cstddef>
#include <string>

namespace couchbase
{
class application_telemetry_options
{
public:
  static constexpr std::chrono::milliseconds default_ping_interval{ std::chrono::seconds{ 30 } };
  static constexpr std::chrono::milliseconds default_ping_timeout{ std::chrono::seconds{ 2 } };
  static constexpr std::chrono::milliseconds default_backoff_interval{ std::chrono::hours{ 1 } };

  /**
   * Whether to enable application telemetry.
   *
   * @param enable true if the application service telemetry have to be enabled.
   *
   * @since 1.1.0
   */
  auto enable(bool enable) -> application_telemetry_options&
  {
    enabled_ = enable;
    return *this;
  }

  /**
   * How often the SDK should ping application service telemetry collector.
   *
   * @param interval ping interval in milliseconds.
   *
   * @since 1.1.0
   */
  auto ping_interval(std::chrono::milliseconds interval) -> application_telemetry_options&
  {
    ping_interval_ = interval;
    return *this;
  }

  /**
   * How long the SDK should wait for ping response (pong frame) back from application service
   * telemetry collector.
   *
   * @param timeout ping timeout in milliseconds.
   *
   * @since 1.1.0
   */
  auto ping_timeout(std::chrono::milliseconds timeout) -> application_telemetry_options&
  {
    ping_timeout_ = timeout;
    return *this;
  }

  /**
   * Override the endpoint for the application service telementry.
   *
   * The endpoint must use WebSocket protocol and the string should start from `ws://` and might
   * have URL path.
   *
   * @param endpoint connection string for the telementry collector.
   *
   * @since 1.1.0
   */
  auto override_endpoint(std::string endpoint) -> application_telemetry_options&
  {
    endpoint_ = std::move(endpoint);
    return *this;
  }

  /**
   * How long should the SDK wait between connection attempts to the collector to avoid performance
   * and stability issues on the collector side.
   *
   * @param interval backoff interval in milliseconds
   *
   * @since 1.1.0
   */
  auto backoff_interval(std::chrono::milliseconds interval) -> application_telemetry_options&
  {
    backoff_interval_ = interval;
    return *this;
  }
  struct built {
    bool enabled;
    std::chrono::milliseconds ping_interval;
    std::chrono::milliseconds ping_timeout;
    std::chrono::milliseconds backoff_interval;
    std::string endpoint;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      enabled_, ping_interval_, ping_timeout_, backoff_interval_, endpoint_,
    };
  }

private:
  bool enabled_{ true };
  std::chrono::milliseconds ping_interval_{ default_ping_interval };
  std::chrono::milliseconds ping_timeout_{ default_ping_timeout };
  std::chrono::milliseconds backoff_interval_{ default_backoff_interval };
  std::string endpoint_{};
};
} // namespace couchbase
