/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include <couchbase/scope.hxx>
#include <couchbase/transactions/attempt_context.hxx>

#include <spdlog/fmt/bundled/core.h>

namespace couchbase::transactions
{
auto
attempt_context::query(const scope& scope,
                       const std::string& statement,
                       const transaction_query_options& opts)
  -> std::pair<error, transaction_query_result>
{
  return do_public_query(statement, opts, fmt::format("{}.{}", scope.bucket_name(), scope.name()));
}

auto
attempt_context::query(const std::string& statement, const transaction_query_options& options)
  -> std::pair<error, transaction_query_result>
{
  return do_public_query(statement, options, {});
}
} // namespace couchbase::transactions
