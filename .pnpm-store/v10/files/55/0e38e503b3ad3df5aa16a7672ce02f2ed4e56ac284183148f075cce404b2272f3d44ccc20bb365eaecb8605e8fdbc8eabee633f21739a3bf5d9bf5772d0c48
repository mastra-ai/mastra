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
#include <couchbase/transactions/async_attempt_context.hxx>

#include <spdlog/fmt/bundled/core.h>

namespace couchbase::transactions
{
void
async_attempt_context::query(const scope& scope,
                             std::string statement,
                             transaction_query_options opts,
                             async_query_handler&& handler)
{
  return query(std::move(statement),
               std::move(opts),
               fmt::format("{}.{}", scope.bucket_name(), scope.name()),
               std::move(handler));
}
} // namespace couchbase::transactions
