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

#include <couchbase/tracing/request_tracer.hxx>

#include <chrono>
#include <cstddef>
#include <memory>

namespace couchbase
{
class tracing_options
{
public:
  static constexpr std::size_t default_orphaned_sample_size{ 64 };
  static constexpr std::chrono::milliseconds default_orphaned_emit_interval{ std::chrono::seconds{
    10 } };

  static constexpr std::size_t default_threshold_sample_size{ 64 };
  static constexpr std::chrono::milliseconds default_threshold_emit_interval{ std::chrono::seconds{
    10 } };
  static constexpr std::chrono::milliseconds default_key_value_threshold{ 500 };
  static constexpr std::chrono::milliseconds default_query_threshold{ std::chrono::seconds{ 1 } };
  static constexpr std::chrono::milliseconds default_view_threshold{ std::chrono::seconds{ 1 } };
  static constexpr std::chrono::milliseconds default_search_threshold{ std::chrono::seconds{ 1 } };
  static constexpr std::chrono::milliseconds default_analytics_threshold{ std::chrono::seconds{
    1 } };
  static constexpr std::chrono::milliseconds default_management_threshold{ std::chrono::seconds{
    1 } };
  static constexpr std::chrono::milliseconds default_eventing_threshold{ std::chrono::seconds{
    1 } };

  auto enable(bool enable) -> tracing_options&
  {
    enabled_ = enable;
    return *this;
  }

  auto orphaned_emit_interval(std::chrono::milliseconds interval) -> tracing_options&
  {
    orphaned_emit_interval_ = interval;
    return *this;
  }

  auto orphaned_sample_size(std::size_t number_or_samples) -> tracing_options&
  {
    orphaned_sample_size_ = number_or_samples;
    return *this;
  }

  auto threshold_emit_interval(std::chrono::milliseconds interval) -> tracing_options&
  {
    threshold_emit_interval_ = interval;
    return *this;
  }

  auto threshold_sample_size(std::size_t number_or_samples) -> tracing_options&
  {
    threshold_sample_size_ = number_or_samples;
    return *this;
  }

  auto key_value_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    key_value_threshold_ = duration;
    return *this;
  }

  auto query_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    query_threshold_ = duration;
    return *this;
  }

  auto view_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    view_threshold_ = duration;
    return *this;
  }

  auto search_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    search_threshold_ = duration;
    return *this;
  }

  auto analytics_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    analytics_threshold_ = duration;
    return *this;
  }

  auto management_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    management_threshold_ = duration;
    return *this;
  }

  auto eventing_threshold(std::chrono::milliseconds duration) -> tracing_options&
  {
    eventing_threshold_ = duration;
    return *this;
  }

  auto tracer(std::shared_ptr<tracing::request_tracer> custom_tracer) -> tracing_options&
  {
    tracer_ = std::move(custom_tracer);
    return *this;
  }

  struct built {
    bool enabled;
    std::chrono::milliseconds orphaned_emit_interval;
    std::size_t orphaned_sample_size;
    std::chrono::milliseconds threshold_emit_interval;
    std::size_t threshold_sample_size;
    std::chrono::milliseconds key_value_threshold;
    std::chrono::milliseconds query_threshold;
    std::chrono::milliseconds view_threshold;
    std::chrono::milliseconds search_threshold;
    std::chrono::milliseconds analytics_threshold;
    std::chrono::milliseconds management_threshold;
    std::chrono::milliseconds eventing_threshold;
    std::shared_ptr<tracing::request_tracer> tracer;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      enabled_,
      orphaned_emit_interval_,
      orphaned_sample_size_,
      threshold_emit_interval_,
      threshold_sample_size_,
      key_value_threshold_,
      query_threshold_,
      view_threshold_,
      search_threshold_,
      analytics_threshold_,
      management_threshold_,
      eventing_threshold_,
      tracer_,
    };
  }

private:
  bool enabled_{ true };
  std::chrono::milliseconds orphaned_emit_interval_{ default_orphaned_emit_interval };
  std::size_t orphaned_sample_size_{ default_orphaned_sample_size };

  std::chrono::milliseconds threshold_emit_interval_{ default_threshold_emit_interval };
  std::size_t threshold_sample_size_{ default_threshold_sample_size };
  std::chrono::milliseconds key_value_threshold_{ default_key_value_threshold };
  std::chrono::milliseconds query_threshold_{ default_query_threshold };
  std::chrono::milliseconds view_threshold_{ default_view_threshold };
  std::chrono::milliseconds search_threshold_{ default_search_threshold };
  std::chrono::milliseconds analytics_threshold_{ default_analytics_threshold };
  std::chrono::milliseconds management_threshold_{ default_management_threshold };
  std::chrono::milliseconds eventing_threshold_{ default_eventing_threshold };

  std::shared_ptr<tracing::request_tracer> tracer_{ nullptr };
};
} // namespace couchbase
