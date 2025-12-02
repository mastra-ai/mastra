/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2024-Present Couchbase, Inc.
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

#include "service_type.hxx"

#include <chrono>
#include <cstdint>
#include <memory>
#include <shared_mutex>
#include <string>
#include <vector>

namespace couchbase::core
{
namespace topology
{
struct configuration;
} // namespace topology

enum class app_telemetry_latency : std::uint8_t {
  unknown,
  kv_retrieval,
  kv_mutation_nondurable,
  kv_mutation_durable,
  query,
  search,
  analytics,
  management,
  eventing,
  number_of_elements,
};

constexpr auto
latency_for_service_type(service_type value) -> app_telemetry_latency
{
  switch (value) {
    case service_type::key_value:
      return app_telemetry_latency::kv_retrieval;
    case service_type::query:
      return app_telemetry_latency::query;
    case service_type::analytics:
      return app_telemetry_latency::analytics;
    case service_type::search:
      return app_telemetry_latency::search;
    case service_type::management:
      return app_telemetry_latency::management;
    case service_type::eventing:
      return app_telemetry_latency::eventing;
    default:
      break;
  }
  return app_telemetry_latency::unknown;
}

enum class app_telemetry_counter : std::uint8_t {
  unknown,
  kv_r_timedout,
  kv_r_canceled,
  kv_r_total,
  query_r_timedout,
  query_r_canceled,
  query_r_total,
  search_r_timedout,
  search_r_canceled,
  search_r_total,
  analytics_r_timedout,
  analytics_r_canceled,
  analytics_r_total,
  management_r_timedout,
  management_r_canceled,
  management_r_total,
  eventing_r_timedout,
  eventing_r_canceled,
  eventing_r_total,
  number_of_elements,
};

constexpr auto
timedout_counter_for_service_type(service_type value) -> app_telemetry_counter
{
  switch (value) {
    case service_type::key_value:
      return app_telemetry_counter::kv_r_timedout;
    case service_type::query:
      return app_telemetry_counter::query_r_timedout;
    case service_type::analytics:
      return app_telemetry_counter::analytics_r_timedout;
    case service_type::search:
      return app_telemetry_counter::search_r_timedout;
    case service_type::management:
      return app_telemetry_counter::management_r_timedout;
    case service_type::eventing:
      return app_telemetry_counter::eventing_r_timedout;
    default:
      break;
  }
  return app_telemetry_counter::unknown;
}

constexpr auto
canceled_counter_for_service_type(service_type value) -> app_telemetry_counter
{
  switch (value) {
    case service_type::key_value:
      return app_telemetry_counter::kv_r_canceled;
    case service_type::query:
      return app_telemetry_counter::query_r_canceled;
    case service_type::analytics:
      return app_telemetry_counter::analytics_r_canceled;
    case service_type::search:
      return app_telemetry_counter::search_r_canceled;
    case service_type::management:
      return app_telemetry_counter::management_r_canceled;
    case service_type::eventing:
      return app_telemetry_counter::eventing_r_canceled;
    default:
      break;
  }
  return app_telemetry_counter::unknown;
}

constexpr auto
total_counter_for_service_type(service_type value) -> app_telemetry_counter
{
  switch (value) {
    case service_type::key_value:
      return app_telemetry_counter::kv_r_total;
    case service_type::query:
      return app_telemetry_counter::query_r_total;
    case service_type::analytics:
      return app_telemetry_counter::analytics_r_total;
    case service_type::search:
      return app_telemetry_counter::search_r_total;
    case service_type::management:
      return app_telemetry_counter::management_r_total;
    case service_type::eventing:
      return app_telemetry_counter::eventing_r_total;
    default:
      break;
  }
  return app_telemetry_counter::unknown;
}

class app_telemetry_value_recorder
{
public:
  app_telemetry_value_recorder() = default;
  app_telemetry_value_recorder(app_telemetry_value_recorder&&) = default;
  app_telemetry_value_recorder(const app_telemetry_value_recorder&) = delete;
  auto operator=(app_telemetry_value_recorder&&) -> app_telemetry_value_recorder& = default;
  auto operator=(const app_telemetry_value_recorder&) -> app_telemetry_value_recorder& = delete;

  virtual ~app_telemetry_value_recorder() = default;

  virtual void record_latency(app_telemetry_latency name, std::chrono::milliseconds interval) = 0;
  virtual void update_counter(app_telemetry_counter name) = 0;
};

class app_telemetry_meter_impl;

class app_telemetry_meter
{
public:
  app_telemetry_meter();
  app_telemetry_meter(app_telemetry_meter&&) = delete;
  app_telemetry_meter(const app_telemetry_meter&) = delete;
  auto operator=(app_telemetry_meter&&) -> app_telemetry_meter& = delete;
  auto operator=(const app_telemetry_meter&) -> app_telemetry_meter& = delete;
  ~app_telemetry_meter();

  void disable();
  void enable();

  void update_agent(const std::string& extra);
  void update_config(const topology::configuration& config);
  auto value_recorder(const std::string& node_uuid, const std::string& bucket_name)
    -> std::shared_ptr<app_telemetry_value_recorder>;
  void generate_report(std::vector<std::byte>& output_buffer);

private:
  std::string agent_;
  std::unique_ptr<app_telemetry_meter_impl> impl_;
  std::shared_mutex impl_mutex_{};
};

} // namespace couchbase::core
