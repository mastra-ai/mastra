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

#include "core/logger/logger.hxx"
#include "core/protocol/client_opcode_fmt.hxx"

#include <couchbase/best_effort_retry_strategy.hxx>
#include <couchbase/fmt/retry_reason.hxx>

#include <chrono>
#include <memory>

namespace couchbase::core::io::retry_orchestrator
{

namespace priv
{
template<class Command>
auto
cap_duration(std::chrono::milliseconds uncapped,
             std::shared_ptr<Command> command) -> std::chrono::milliseconds
{
  auto theoretical_deadline = std::chrono::steady_clock::now() + uncapped;
  auto absolute_deadline = command->deadline.expiry();
  if (auto delta = std::chrono::duration_cast<std::chrono::milliseconds>(theoretical_deadline -
                                                                         absolute_deadline);
      delta.count() > 0) {
    auto capped = uncapped - delta;
    if (capped.count() < 0) {
      return uncapped; // something went wrong, return the uncapped one as a safety net
    }
    return capped;
  }
  return uncapped;
}

template<class Manager, class Command>
void
retry_with_duration(std::shared_ptr<Manager> manager,
                    std::shared_ptr<Command> command,
                    retry_reason reason,
                    std::chrono::milliseconds duration)
{
  command->request.retries.record_retry_attempt(reason);
  CB_LOG_TRACE(
    R"({} retrying operation {} (duration={}ms, id="{}", vbucket_id={}, reason={}, attempts={}, last_dispatched_to="{}"))",
    manager->log_prefix(),
    decltype(command->request)::encoded_request_type::body_type::opcode,
    duration.count(),
    command->id_,
    command->request.partition,
    reason,
    command->request.retries.retry_attempts(),
    command->session_ ? command->session_->remote_address() : "");
  manager->schedule_for_retry(command, duration);
}

} // namespace priv

template<class Manager, class Command>
void
maybe_retry(std::shared_ptr<Manager> manager,
            std::shared_ptr<Command> command,
            retry_reason reason,
            std::error_code ec)
{
  if (always_retry(reason)) {
    return priv::retry_with_duration(
      manager, command, reason, controlled_backoff(command->request.retries.retry_attempts()));
  }

  auto retry_strategy = command->request.retries.strategy();
  if (retry_strategy == nullptr) {
    retry_strategy = manager->default_retry_strategy();
  }
  if (retry_action action = retry_strategy->retry_after(command->request.retries, reason);
      action.need_to_retry()) {
    return priv::retry_with_duration(
      manager, command, reason, priv::cap_duration(action.duration(), command));
  }

  CB_LOG_TRACE(R"({} not retrying operation {} (id="{}", reason={}, attempts={}, ec={} ({})))",
               manager->log_prefix(),
               decltype(command->request)::encoded_request_type::body_type::opcode,
               command->id_,
               reason,
               command->request.retries.retry_attempts(),
               ec.value(),
               ec.message());
  return command->invoke_handler(ec);
}

} // namespace couchbase::core::io::retry_orchestrator
