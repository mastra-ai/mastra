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

#include "tracer_wrapper.hxx"

#include "constants.hxx"

#include <mutex>

namespace couchbase::core::tracing
{
tracer_wrapper::tracer_wrapper(std::shared_ptr<couchbase::tracing::request_tracer> tracer)
  : tracer_{ std::move(tracer) }
{
}

void
tracer_wrapper::start()
{
  tracer_->start();
}

void
tracer_wrapper::stop()
{
  tracer_->stop();
}

auto
tracer_wrapper::create_span(std::string span_name,
                            std::shared_ptr<couchbase::tracing::request_span> parent_span)
  -> std::shared_ptr<couchbase::tracing::request_span>
{
  auto span = tracer_->start_span(std::move(span_name), std::move(parent_span));
  span->add_tag(attributes::system, "couchbase");

  std::optional<std::string> cluster_name;
  std::optional<std::string> cluster_uuid;
  {
    const std::shared_lock lock{ cluster_labels_mutex_ };
    cluster_name = cluster_name_;
    cluster_uuid = cluster_uuid_;
  }

  if (cluster_name) {
    span->add_tag(attributes::cluster_name, cluster_name.value());
  }
  if (cluster_uuid) {
    span->add_tag(attributes::cluster_uuid, cluster_uuid.value());
  }

  return span;
}

void
tracer_wrapper::update_config(topology::configuration config)
{
  const std::scoped_lock<std::shared_mutex> lock{ cluster_labels_mutex_ };
  if (config.cluster_uuid.has_value()) {
    cluster_uuid_ = config.cluster_uuid;
  }
  if (config.cluster_name.has_value()) {
    cluster_name_ = config.cluster_name;
  }
}

auto
tracer_wrapper::create(std::shared_ptr<couchbase::tracing::request_tracer> tracer)
  -> std::shared_ptr<tracer_wrapper>
{
  return std::make_shared<tracer_wrapper>(std::move(tracer));
}
} // namespace couchbase::core::tracing
