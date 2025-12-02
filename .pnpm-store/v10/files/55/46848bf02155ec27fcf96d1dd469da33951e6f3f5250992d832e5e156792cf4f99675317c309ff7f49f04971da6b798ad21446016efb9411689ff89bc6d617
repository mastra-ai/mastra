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
#pragma once

#include <stdexcept>
#include <string>

namespace couchbase::core::transactions
{
/**
 * The possible states for a transaction attempt.
 */
enum class attempt_state {
  /**
   * The attempt finished very early.
   */
  NOT_STARTED = 0,

  /**
   * Any call to one of the mutation methods - <code>insert</code>, <code>replace</code>,
   * <code>remove</code> - will update the state to PENDING.
   */
  PENDING,

  /**
   * Set once the Active Transaction Record entry for this transaction has been updated to mark the
   * transaction as Aborted.
   */
  ABORTED,

  /**
   * Set once the Active Transaction Record entry for this transaction has been updated to mark the
   * transaction as Committed.
   */
  COMMITTED,

  /**
   * Set once the commit is fully completed.
   */
  COMPLETED,

  /**
   * Set once the commit is fully rolled back.
   */
  ROLLED_BACK,

  /**
   * A state this client doesn't recognise.
   */
  UNKNOWN
};

inline auto
attempt_state_name(attempt_state state) -> const char*
{
  switch (state) {
    case attempt_state::NOT_STARTED:
      return "NOT_STARTED";
    case attempt_state::PENDING:
      return "PENDING";
    case attempt_state::ABORTED:
      return "ABORTED";
    case attempt_state::COMMITTED:
      return "COMMITTED";
    case attempt_state::COMPLETED:
      return "COMPLETED";
    case attempt_state::ROLLED_BACK:
      return "ROLLED_BACK";
    case attempt_state::UNKNOWN:
      return "UNKNOWN";
    default:
      throw std::runtime_error("unknown attempt state");
  }
}

inline auto
attempt_state_value(const std::string& str) -> attempt_state
{
  if (str == "NOT_STARTED") {
    return attempt_state::NOT_STARTED;
  }
  if (str == "PENDING") {
    return attempt_state::PENDING;
  }
  if (str == "ABORTED") {
    return attempt_state::ABORTED;
  }
  if (str == "COMMITTED") {
    return attempt_state::COMMITTED;
  }
  if (str == "COMPLETED") {
    return attempt_state::COMPLETED;
  }
  if (str == "ROLLED_BACK") {
    return attempt_state::ROLLED_BACK;
  }
  return attempt_state::UNKNOWN;
}
} // namespace couchbase::core::transactions
