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

#include <couchbase/cluster_options.hxx>
#include <couchbase/configuration_profile.hxx>

#include <chrono>

namespace couchbase
{
class wan_development_configuration_profile : public configuration_profile
{
public:
  void apply(cluster_options& options) override
  {
    auto& timeouts = options.timeouts();
    timeouts.key_value_timeout(std::chrono::seconds(20));
    timeouts.key_value_durable_timeout(std::chrono::seconds(20));
    timeouts.key_value_scan_timeout(std::chrono::minutes(2));
    timeouts.connect_timeout(std::chrono::seconds(20));
    timeouts.view_timeout(std::chrono::minutes(2));
    timeouts.query_timeout(std::chrono::minutes(2));
    timeouts.analytics_timeout(std::chrono::minutes(2));
    timeouts.search_timeout(std::chrono::minutes(2));
    timeouts.management_timeout(std::chrono::minutes(2));
    timeouts.resolve_timeout(std::chrono::seconds(20));  // timeout to resolve hostnames
    timeouts.bootstrap_timeout(std::chrono::minutes(2)); // overall timeout to bootstrap
  }
};
} // namespace couchbase
