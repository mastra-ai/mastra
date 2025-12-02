/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "cluster_options.hxx"

#include "config_profiles.hxx"
#include "core/service_type.hxx"

#include <couchbase/best_effort_retry_strategy.hxx>

#include <chrono>
#include <stdexcept>
#include <string_view>

namespace couchbase::core
{
auto
cluster_options::default_timeout_for(service_type type) const -> std::chrono::milliseconds
{
  switch (type) {
    case service_type::key_value:
      return key_value_timeout;
    case service_type::query:
      return query_timeout;
    case service_type::analytics:
      return analytics_timeout;
    case service_type::search:
      return search_timeout;
    case service_type::view:
      return view_timeout;
    case service_type::management:
    case service_type::eventing:
      return management_timeout;
  }
  throw std::runtime_error("unexpected service type");
}
void
cluster_options::apply_profile(std::string_view profile_name)
{
  known_profiles().apply(profile_name, *this);
}

cluster_options::cluster_options()
  : default_retry_strategy_{ make_best_effort_retry_strategy() }
{
}
} // namespace couchbase::core
