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

#include <spdlog/fmt/bundled/core.h>

#include <string>

namespace couchbase::core::utils
{
template<typename Request>
static auto
check_query_management_request(const Request& req) -> bool
{
  // if there is a query_context, then bucket and scope will be ignored
  if (req.query_ctx.has_value()) {
    return true;
  }

  // otherwise, both scope and collection must be specified, if one is
  // and bucket _must_ be there as well.
  return !req.bucket_name.empty() && ((req.scope_name.empty() && req.collection_name.empty()) ||
                                      (!req.scope_name.empty() && !req.collection_name.empty()));
}

template<typename Request>
static auto
build_keyspace(const Request& req) -> std::string
{
  // keyspace is just the collection if we have a query_context.
  if (req.query_ctx.has_value()) {
    return fmt::format("{}.`{}`", req.query_ctx.value(), req.collection_name);
  }
  // otherwise, build from the bucket, scope and collection names in request...
  if (req.scope_name.empty() && req.collection_name.empty()) {
    return fmt::format("{}:`{}`", req.namespace_id, req.bucket_name);
  }
  return fmt::format(
    "{}:`{}`.`{}`.`{}`", req.namespace_id, req.bucket_name, req.scope_name, req.collection_name);
}

} // namespace couchbase::core::utils
