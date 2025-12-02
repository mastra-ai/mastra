/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "core/config_listener.hxx"
#include "core/service_type.hxx"
#include "core/topology/configuration.hxx"

#include <couchbase/metrics/meter.hxx>

#include <chrono>
#include <map>
#include <optional>
#include <shared_mutex>
#include <string>
#include <system_error>

namespace couchbase::core::metrics
{
struct metric_attributes {
  couchbase::core::service_type service;
  std::string operation;
  std::error_code ec;
  std::optional<std::string> bucket_name{};
  std::optional<std::string> scope_name{};
  std::optional<std::string> collection_name{};

  struct {
    std::optional<std::string> cluster_name{};
    std::optional<std::string> cluster_uuid{};
  } internal{};

  [[nodiscard]] auto encode() const -> std::map<std::string, std::string>;
};

class meter_wrapper : public config_listener
{
public:
  explicit meter_wrapper(std::shared_ptr<couchbase::metrics::meter> meter);

  void start();
  void stop();

  void record_value(metric_attributes attrs, std::chrono::steady_clock::time_point start_time);

  void update_config(topology::configuration config) override;

  [[nodiscard]] static auto create(std::shared_ptr<couchbase::metrics::meter> meter)
    -> std::shared_ptr<meter_wrapper>;

private:
  std::shared_ptr<couchbase::metrics::meter> meter_;

  std::optional<std::string> cluster_name_{};
  std::optional<std::string> cluster_uuid_{};
  std::shared_mutex cluster_labels_mutex_{};
};
} // namespace couchbase::core::metrics
