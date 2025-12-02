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

#include <couchbase/metrics/meter.hxx>

#include <chrono>
#include <cstddef>
#include <memory>

namespace couchbase
{
class metrics_options
{
public:
  static constexpr std::chrono::milliseconds default_emit_interval{ std::chrono::minutes{ 10 } };

  auto enable(bool enable) -> metrics_options&
  {
    enabled_ = enable;
    return *this;
  }

  auto emit_interval(std::chrono::milliseconds interval) -> metrics_options&
  {
    emit_interval_ = interval;
    return *this;
  }

  auto meter(std::shared_ptr<metrics::meter> custom_meter) -> metrics_options&
  {
    meter_ = std::move(custom_meter);
    return *this;
  }

  struct built {
    bool enabled;
    std::chrono::milliseconds emit_interval;
    std::shared_ptr<metrics::meter> meter;
  };

  [[nodiscard]] auto build() const -> built
  {
    return {
      enabled_,
      emit_interval_,
      meter_,
    };
  }

private:
  bool enabled_{ true };
  std::chrono::milliseconds emit_interval_{ default_emit_interval };
  std::shared_ptr<metrics::meter> meter_{ nullptr };
};
} // namespace couchbase
