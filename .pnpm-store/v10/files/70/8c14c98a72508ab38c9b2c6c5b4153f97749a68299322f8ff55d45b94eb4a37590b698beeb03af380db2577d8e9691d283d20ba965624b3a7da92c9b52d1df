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
#include "core/topology/configuration.hxx"

#include <couchbase/tracing/request_span.hxx>
#include <couchbase/tracing/request_tracer.hxx>

#include <memory>
#include <optional>
#include <shared_mutex>
#include <string>

namespace couchbase::core::tracing
{
class tracer_wrapper : public config_listener
{
public:
  explicit tracer_wrapper(std::shared_ptr<couchbase::tracing::request_tracer> tracer);

  void start();
  void stop();

  auto create_span(std::string span_name,
                   std::shared_ptr<couchbase::tracing::request_span> parent_span)
    -> std::shared_ptr<couchbase::tracing::request_span>;

  void update_config(topology::configuration config) override;

  [[nodiscard]] static auto create(std::shared_ptr<couchbase::tracing::request_tracer> tracer)
    -> std::shared_ptr<tracer_wrapper>;

private:
  std::shared_ptr<couchbase::tracing::request_tracer> tracer_;

  std::optional<std::string> cluster_name_{};
  std::optional<std::string> cluster_uuid_{};
  std::shared_mutex cluster_labels_mutex_{};
};
} // namespace couchbase::core::tracing
