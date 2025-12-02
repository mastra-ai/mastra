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

namespace couchbase
{
class timeout_options
{
public:
  static constexpr std::chrono::milliseconds default_analytics_timeout{ std::chrono::seconds{
    75 } };
  static constexpr std::chrono::milliseconds default_connect_timeout{ std::chrono::seconds{ 10 } };
  static constexpr std::chrono::milliseconds default_eventing_timeout{ std::chrono::seconds{ 75 } };
  static constexpr std::chrono::milliseconds default_key_value_durable_timeout{
    std::chrono::seconds{ 10 }
  };
  static constexpr std::chrono::milliseconds default_key_value_timeout{ 2'500 };
  static constexpr std::chrono::milliseconds default_key_value_scan_timeout{ std::chrono::seconds{
    75 } };
  static constexpr std::chrono::milliseconds default_management_timeout{ std::chrono::seconds{
    75 } };
  static constexpr std::chrono::milliseconds default_query_timeout{ std::chrono::seconds{ 75 } };
  static constexpr std::chrono::milliseconds default_search_timeout{ std::chrono::seconds{ 75 } };
  static constexpr std::chrono::milliseconds default_view_timeout{ std::chrono::seconds{ 75 } };
  static constexpr std::chrono::milliseconds default_bootstrap_timeout{ std::chrono::seconds{
    10 } };
  static constexpr std::chrono::milliseconds default_resolve_timeout{ std::chrono::seconds{ 2 } };

  auto analytics_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    analytics_timeout_ = timeout;
    return *this;
  }

  auto connect_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    connect_timeout_ = timeout;
    return *this;
  }

  auto eventing_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    eventing_timeout_ = timeout;
    return *this;
  }

  auto key_value_durable_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    key_value_durable_timeout_ = timeout;
    return *this;
  }

  auto key_value_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    key_value_timeout_ = timeout;
    return *this;
  }

  auto key_value_scan_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    key_value_scan_timeout_ = timeout;
    return *this;
  }

  auto management_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    management_timeout_ = timeout;
    return *this;
  }

  auto query_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    query_timeout_ = timeout;
    return *this;
  }

  auto search_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    search_timeout_ = timeout;
    return *this;
  }

  auto view_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    view_timeout_ = timeout;
    return *this;
  }

  auto bootstrap_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    bootstrap_timeout_ = timeout;
    return *this;
  }

  auto resolve_timeout(std::chrono::milliseconds timeout) -> timeout_options&
  {
    resolve_timeout_ = timeout;
    return *this;
  }

  struct built {
    std::chrono::milliseconds analytics_timeout;
    std::chrono::milliseconds connect_timeout;
    std::chrono::milliseconds eventing_timeout;
    std::chrono::milliseconds key_value_durable_timeout;
    std::chrono::milliseconds key_value_timeout;
    std::chrono::milliseconds key_value_scan_timeout;
    std::chrono::milliseconds management_timeout;
    std::chrono::milliseconds query_timeout;
    std::chrono::milliseconds search_timeout;
    std::chrono::milliseconds view_timeout;
    std::chrono::milliseconds bootstrap_timeout;
    std::chrono::milliseconds resolve_timeout;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      analytics_timeout_, connect_timeout_,        eventing_timeout_,   key_value_durable_timeout_,
      key_value_timeout_, key_value_scan_timeout_, management_timeout_, query_timeout_,
      search_timeout_,    view_timeout_,           bootstrap_timeout_,  resolve_timeout_,
    };
  }

private:
  std::chrono::milliseconds analytics_timeout_{ default_analytics_timeout };
  std::chrono::milliseconds connect_timeout_{ default_connect_timeout };
  std::chrono::milliseconds eventing_timeout_{ default_eventing_timeout };
  std::chrono::milliseconds key_value_durable_timeout_{ default_key_value_durable_timeout };
  std::chrono::milliseconds key_value_timeout_{ default_key_value_timeout };
  std::chrono::milliseconds key_value_scan_timeout_{ default_key_value_scan_timeout };
  std::chrono::milliseconds management_timeout_{ default_management_timeout };
  std::chrono::milliseconds query_timeout_{ default_query_timeout };
  std::chrono::milliseconds search_timeout_{ default_search_timeout };
  std::chrono::milliseconds view_timeout_{ default_view_timeout };
  std::chrono::milliseconds bootstrap_timeout_{ default_bootstrap_timeout };
  std::chrono::milliseconds resolve_timeout_{ default_resolve_timeout };
};
} // namespace couchbase
