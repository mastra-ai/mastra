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

#include "core/transactions/attempt_state.hxx"
#include "doc_record.hxx"

#include <tao/json/value.hpp>

#include <chrono>
#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

namespace couchbase::core::transactions
{

struct atr_entry {
public:
  atr_entry() = default;
  atr_entry(std::string atr_bucket,
            std::string atr_id,
            std::string attempt_id,
            attempt_state state,
            std::optional<std::uint64_t> timestamp_start_ms,
            std::optional<std::uint64_t> timestamp_commit_ms,
            std::optional<std::uint64_t> timestamp_complete_ms,
            std::optional<std::uint64_t> timestamp_rollback_ms,
            std::optional<std::uint64_t> timestamp_rolled_back_ms,
            std::optional<std::uint32_t> expires_after_ms,
            std::optional<std::vector<doc_record>> inserted_ids,
            std::optional<std::vector<doc_record>> replaced_ids,
            std::optional<std::vector<doc_record>> removed_ids,
            std::optional<tao::json::value> forward_compat,
            std::uint64_t cas,
            std::optional<std::string> durability_level)
    : atr_bucket_(std::move(atr_bucket))
    , atr_id_(std::move(atr_id))
    , attempt_id_(std::move(attempt_id))
    , state_(state)
    , timestamp_start_ms_(timestamp_start_ms)
    , timestamp_commit_ms_(timestamp_commit_ms)
    , timestamp_complete_ms_(timestamp_complete_ms)
    , timestamp_rollback_ms_(timestamp_rollback_ms)
    , timestamp_rolled_back_ms_(timestamp_rolled_back_ms)
    , expires_after_ms_(expires_after_ms)
    , inserted_ids_(std::move(inserted_ids))
    , replaced_ids_(std::move(replaced_ids))
    , removed_ids_(std::move(removed_ids))
    , forward_compat_(std::move(forward_compat))
    , cas_(cas)
    , durability_level_(std::move(durability_level))
  {
  }

  [[nodiscard]] bool has_expired(std::uint32_t safety_margin = 0) const
  {
    std::uint64_t cas_ms = cas_ / 1000000;
    if (timestamp_start_ms_ && cas_ms > *timestamp_start_ms_) {
      std::uint32_t expires_after_ms = *expires_after_ms_;
      return (cas_ms - *timestamp_start_ms_) > (expires_after_ms + safety_margin);
    }
    return false;
  }

  [[nodiscard]] std::uint32_t age_ms() const
  {
    return static_cast<std::uint32_t>((cas_ / 1000000) - timestamp_start_ms_.value_or(0));
  }

  [[nodiscard]] const std::string& atr_id() const
  {
    return atr_id_;
  }

  [[nodiscard]] const std::string& attempt_id() const
  {
    return attempt_id_;
  }

  [[nodiscard]] std::optional<std::uint64_t> timestamp_start_ms() const
  {
    return timestamp_start_ms_;
  }
  [[nodiscard]] std::optional<std::uint64_t> timestamp_commit_ms() const
  {
    return timestamp_commit_ms_;
  }
  [[nodiscard]] std::optional<std::uint64_t> timestamp_complete_ms() const
  {
    return timestamp_complete_ms_;
  }
  [[nodiscard]] std::optional<std::uint64_t> timestamp_rollback_ms() const
  {
    return timestamp_rollback_ms_;
  }
  [[nodiscard]] std::optional<std::uint64_t> timestamp_rolled_back_ms() const
  {
    return timestamp_rolled_back_ms_;
  }

  /**
   * Returns the CAS of the ATR document containing this entry
   */
  [[nodiscard]] std::uint64_t cas() const
  {
    return cas_;
  }

  [[nodiscard]] std::optional<std::vector<doc_record>> inserted_ids() const
  {
    return inserted_ids_;
  }

  [[nodiscard]] std::optional<std::vector<doc_record>> replaced_ids() const
  {
    return replaced_ids_;
  }

  [[nodiscard]] std::optional<std::vector<doc_record>> removed_ids() const
  {
    return removed_ids_;
  }

  [[nodiscard]] std::optional<tao::json::value> forward_compat() const
  {
    return forward_compat_;
  }

  [[nodiscard]] std::optional<std::uint32_t> expires_after_ms() const
  {
    return expires_after_ms_;
  }

  [[nodiscard]] attempt_state state() const
  {
    return state_;
  }

  [[nodiscard]] std::optional<std::string> durability_level() const
  {
    return durability_level_;
  }

private:
  std::string atr_bucket_;
  std::string atr_id_;
  std::string attempt_id_;
  attempt_state state_ = attempt_state::NOT_STARTED;
  std::optional<std::uint64_t> timestamp_start_ms_;
  std::optional<std::uint64_t> timestamp_commit_ms_;
  std::optional<std::uint64_t> timestamp_complete_ms_;
  std::optional<std::uint64_t> timestamp_rollback_ms_;
  std::optional<std::uint64_t> timestamp_rolled_back_ms_;
  std::optional<std::uint32_t> expires_after_ms_;
  std::optional<std::vector<doc_record>> inserted_ids_;
  std::optional<std::vector<doc_record>> replaced_ids_;
  std::optional<std::vector<doc_record>> removed_ids_;
  std::optional<tao::json::value> forward_compat_;
  std::uint64_t cas_{};
  // ExtStoreDurability
  std::optional<std::string> durability_level_;
};
} // namespace couchbase::core::transactions
