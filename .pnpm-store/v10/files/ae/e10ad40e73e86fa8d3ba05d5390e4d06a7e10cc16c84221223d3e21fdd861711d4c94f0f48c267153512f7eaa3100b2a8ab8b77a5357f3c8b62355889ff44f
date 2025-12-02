/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
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

#include "retry_orchestrator.hxx"

#include "core/logger/logger.hxx"
#include "couchbase/best_effort_retry_strategy.hxx"
#include "mcbp/queue_request.hxx"

#include <couchbase/fmt/retry_reason.hxx>

#include <spdlog/fmt/bundled/chrono.h>

namespace couchbase::core
{
auto
retry_orchestrator::should_retry(const std::shared_ptr<mcbp::queue_request>& request,
                                 retry_reason reason) -> retry_action
{
  if (always_retry(reason)) {
    auto duration = controlled_backoff(request->retry_attempts());
    CB_LOG_DEBUG("will retry request. backoff={}, operation_id={}, reason={}",
                 duration,
                 request->identifier(),
                 reason);
    request->record_retry_attempt(reason);
    return retry_action{ duration };
  }

  auto strategy = request->retry_strategy();
  if (strategy == nullptr) {
    return retry_action::do_not_retry();
  }

  auto action = strategy->retry_after(*request, reason);
  if (!action.need_to_retry()) {
    CB_LOG_DEBUG(
      "will not retry request. operation_id={}, reason={}", request->identifier(), reason);
    return retry_action::do_not_retry();
  }
  CB_LOG_DEBUG("will retry request. backoff={}, operation_id={}, reason={}",
               action.duration(),
               request->identifier(),
               reason);
  request->record_retry_attempt(reason);
  return action;
}
} // namespace couchbase::core
