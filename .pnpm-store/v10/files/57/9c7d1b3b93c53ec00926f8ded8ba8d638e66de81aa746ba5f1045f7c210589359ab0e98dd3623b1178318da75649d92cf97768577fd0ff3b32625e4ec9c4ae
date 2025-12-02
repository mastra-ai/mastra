/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-present Couchbase, Inc.
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

#include "capabilities.hxx"

#include "core/logger/logger.hxx"

namespace couchbase::core
{
auto
configuration_capabilities::is_analytics_cluster(const cluster_options& options) const -> bool
{
  if (options.allow_enterprise_analytics) {
    CB_LOG_DEBUG("Bypassing cluster prod check as allow_enterprise_analytics is enabled");
    return false;
  }

  if (!prod.has_value()) {
    return false;
  }

  if (prod.value() != "analytics") {
    return false;
  }

  CB_LOG_ERROR("This analytics cluster cannot be used with this SDK, which is intended for use "
               "with operational clusters. "
               "For this cluster, an Enterprise Analytics SDK should be used. ");

  return true;
}
} // namespace couchbase::core
