/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "queue_request.hxx"
#include "../operation_map.hxx"
#include "core/logger/logger.hxx"
#include "operation_queue.hxx"
#include "queue_response.hxx"

#include <couchbase/error_codes.hxx>

#include <atomic>

namespace couchbase::core::mcbp
{
queue_request::queue_request(protocol::magic magic,
                             protocol::client_opcode opcode,
                             queue_callback&& callback)
  : mcbp::packet{ magic, opcode }
  , callback_{ std::move(callback) }
{
}

auto
queue_request::retry_attempts() const -> std::size_t
{
  const std::scoped_lock lock(retry_mutex_);
  return retry_count_;
}

auto
queue_request::identifier() const -> std::string
{
  return std::to_string(opaque_);
}

auto
queue_request::idempotent() const -> bool
{
  return mcbp::is_idempotent(command_);
}

auto
queue_request::retry_reasons() const -> std::set<retry_reason>
{
  const std::scoped_lock lock(retry_mutex_);
  return retry_reasons_;
}

void
queue_request::record_retry_attempt(retry_reason reason)
{
  const std::scoped_lock lock(retry_mutex_);
  ++retry_count_;
  retry_reasons_.insert(reason);
}

auto
queue_request::retries() const -> std::pair<std::size_t, std::set<retry_reason>>
{
  const std::scoped_lock lock(retry_mutex_);
  return { retry_count_, retry_reasons_ };
}

auto
queue_request::connection_info() const -> queue_request_connection_info
{
  const std::scoped_lock lock(connection_info_mutex_);
  return connection_info_;
}

auto
queue_request::is_cancelled() const -> bool
{
  return is_completed_.load();
}

namespace
{
inline void
cancel_timer(std::shared_ptr<asio::steady_timer> timer)
{
  if (auto t = std::move(timer); t) {
    t->cancel();
  }
}
} // namespace

auto
queue_request::internal_cancel() -> bool
{
  const std::scoped_lock lock(processing_mutex_);

  if (bool expected_state{ false }; !is_completed_.compare_exchange_strong(expected_state, true)) {
    // someone already completed this request
    return false;
  }

  cancel_timer(deadline_);
  cancel_timer(retry_backoff_);

  if (auto* queued_with = queued_with_.load(); queued_with) {
    queued_with->remove(shared_from_this());
  }
  if (auto* waiting_in = waiting_in_.load(); waiting_in) {
    waiting_in->remove_request(shared_from_this());
  }

  return true;
}

void
queue_request::cancel(std::error_code error)
{
  if (internal_cancel()) {
    callback_({}, shared_from_this(), error);
  }
}

void
queue_request::set_deadline(std::shared_ptr<asio::steady_timer> timer)
{
  deadline_ = std::move(timer);
}

void
queue_request::set_retry_backoff(std::shared_ptr<asio::steady_timer> timer)
{
  retry_backoff_ = std::move(timer);
}

void
queue_request::try_callback(std::shared_ptr<queue_response> response, std::error_code error)
{
  cancel_timer(deadline_);
  cancel_timer(retry_backoff_);

  if (persistent_) {
    if (error) {
      if (internal_cancel()) {
        return callback_(std::move(response), shared_from_this(), error);
      }
    } else if (!is_completed_) {
      return callback_(std::move(response), shared_from_this(), error);
    }
    return;
  }
  if (bool expected_state{ false }; is_completed_.compare_exchange_strong(expected_state, true)) {
    return callback_(std::move(response), shared_from_this(), error);
  }
}

void
queue_request::cancel()
{
  // Try to perform the cancellation, if it succeeds, we call the callback immediately on the user's
  // behalf.
  return cancel(errc::common::request_canceled);
}

auto
queue_request::retry_strategy() const -> std::shared_ptr<couchbase::retry_strategy>
{
  return retry_strategy_;
}
} // namespace couchbase::core::mcbp
