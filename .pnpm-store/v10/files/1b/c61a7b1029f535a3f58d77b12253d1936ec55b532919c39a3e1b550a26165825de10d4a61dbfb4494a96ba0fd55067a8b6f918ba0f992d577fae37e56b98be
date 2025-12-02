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

#include "config_listener.hxx"

#include <memory>

namespace asio
{
class io_context;
namespace ssl
{
class context;
} // namespace ssl
} // namespace asio

namespace couchbase::core
{
class app_telemetry_reporter_impl;
class app_telemetry_meter;
struct cluster_options;
struct cluster_credentials;

class app_telemetry_reporter : public config_listener
{
public:
  app_telemetry_reporter() = delete;
  app_telemetry_reporter(app_telemetry_reporter&&) = default;
  app_telemetry_reporter(const app_telemetry_reporter&) = delete;
  auto operator=(app_telemetry_reporter&&) -> app_telemetry_reporter& = default;
  auto operator=(const app_telemetry_reporter&) -> app_telemetry_reporter& = delete;

  app_telemetry_reporter(std::shared_ptr<app_telemetry_meter> meter,
                         const cluster_options& options,
                         const cluster_credentials& credentials,
                         asio::io_context& ctx,
                         asio::ssl::context& tls);
  ~app_telemetry_reporter() override;
  void update_config(topology::configuration config) override;
  void stop();

private:
  std::shared_ptr<app_telemetry_reporter_impl> impl_{};
};
} // namespace couchbase::core
