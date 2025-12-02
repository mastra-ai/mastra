/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include "core/service_type.hxx"

#include <chrono>

namespace couchbase::core::tracing
{
struct threshold_logging_options {
  std::chrono::milliseconds orphaned_emit_interval{ std::chrono::seconds{ 10 } };
  std::size_t orphaned_sample_size{ 64 };

  std::chrono::milliseconds threshold_emit_interval{ std::chrono::seconds{ 10 } };
  std::size_t threshold_sample_size{ 64 };
  std::chrono::milliseconds key_value_threshold{ 500 };
  std::chrono::milliseconds query_threshold{ 1'000 };
  std::chrono::milliseconds view_threshold{ 1'000 };
  std::chrono::milliseconds search_threshold{ 1'000 };
  std::chrono::milliseconds analytics_threshold{ 1'000 };
  std::chrono::milliseconds management_threshold{ 1'000 };
  std::chrono::milliseconds eventing_threshold{ 1'000 };

  [[nodiscard]] auto threshold_for_service(service_type service) const -> std::chrono::milliseconds
  {
    switch (service) {
      case service_type::key_value:
        return key_value_threshold;

      case service_type::query:
        return query_threshold;

      case service_type::analytics:
        return analytics_threshold;

      case service_type::search:
        return search_threshold;

      case service_type::view:
        return view_threshold;

      case service_type::management:
        return management_threshold;

      case service_type::eventing:
        return eventing_threshold;
    }
    return {};
  }
};

} // namespace couchbase::core::tracing
