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

#pragma once

#include "core/cluster_options_fwd.hxx"
#include "core/topology/configuration.hxx"
#include "query_cache.hxx"

namespace couchbase::core
{
struct http_context {
  const topology::configuration& config;
  const cluster_options& options;
  query_cache& cache;
  std::string hostname;
  std::uint16_t port;
};

namespace priv
{
class retry_http_request : public std::exception
{
};
} // namespace priv
} // namespace couchbase::core
