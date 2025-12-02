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

#include "atr_entry.hxx"
#include "core/document_id_fmt.hxx"
#include "core/transactions/transaction_get_result.hxx"
#include "logging.hxx"

#include <spdlog/fmt/bundled/core.h>

#include <chrono>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <string>
#include <thread>

namespace couchbase::core::transactions
{

// need forward declaration to avoid circular dep.
class transactions_cleanup;
class transactions_cleanup_attempt;
class attempt_context;

// need forward declaration for compare
class atr_cleanup_entry;

// comparator class for ordering queue
class compare_atr_entries
{
public:
  bool operator()(atr_cleanup_entry& lhs, atr_cleanup_entry& rhs);
};

// represents an atr entry we would like to clean
class atr_cleanup_entry
{
  friend class transactions_cleanup_attempt;

private:
  core::document_id atr_id_;
  std::string attempt_id_;
  std::chrono::time_point<std::chrono::steady_clock> min_start_time_;
  bool check_if_expired_;
  const transactions_cleanup* cleanup_;
  static const std::uint32_t safety_margin_ms_;

  // we may construct from an atr_entry -- if so hold on to it and avoid lookup
  // later.
  const atr_entry* atr_entry_;

  friend class compare_atr_entries;

  void check_atr_and_cleanup(transactions_cleanup_attempt* result);
  void cleanup_docs(durability_level dl);
  void cleanup_entry(durability_level dl);
  void commit_docs(std::optional<std::vector<doc_record>> docs, durability_level dl);
  void remove_docs(std::optional<std::vector<doc_record>> docs, durability_level dl);
  void remove_docs_staged_for_removal(std::optional<std::vector<doc_record>> docs,
                                      durability_level dl);
  void remove_txn_links(std::optional<std::vector<doc_record>> docs, durability_level dl);
  void do_per_doc(const std::vector<doc_record>& docs,
                  bool require_crc_to_match,
                  const std::function<void(transaction_get_result&, bool)>& call);

public:
  explicit atr_cleanup_entry(const std::shared_ptr<attempt_context>& ctx);
  explicit atr_cleanup_entry(const atr_entry& entry,
                             core::document_id atr_id,
                             const transactions_cleanup& cleanup,
                             bool check_if_expired = true);

  explicit atr_cleanup_entry(core::document_id atr_id,
                             std::string attempt_id,
                             const transactions_cleanup& cleanup);

  void clean(transactions_cleanup_attempt* result = nullptr);
  [[nodiscard]] auto ready() const -> bool;
  [[nodiscard]] auto atr_id() const -> couchbase::core::document_id
  {
    return atr_id_;
  }

  [[nodiscard]] auto attempt_id() const -> std::string
  {
    return attempt_id_;
  }

  [[nodiscard]] auto check_if_expired() const -> bool
  {
    return check_if_expired_;
  }

  [[nodiscard]] auto min_start_time() const -> std::chrono::time_point<std::chrono::steady_clock>
  {
    return min_start_time_;
  };

  template<typename OStream>
  friend OStream& operator<<(OStream& os, const atr_cleanup_entry& e)
  {
    os << "atr_cleanup_entry{";
    os << "atr_id:" << e.atr_id_.key() << ",";
    os << "attempt_id:" << e.attempt_id_ << ",";
    os << "check_if_expired:" << e.check_if_expired_;
    os << "min_start_time:"
       << std::chrono::duration_cast<std::chrono::milliseconds>(
            e.min_start_time_.time_since_epoch())
            .count();
    os << "}";
    return os;
  }

  void min_start_time(std::chrono::time_point<std::chrono::steady_clock> new_time)
  {
    min_start_time_ = new_time;
  }
};

// holds sorted atr entries for cleaning
class atr_cleanup_queue
{
private:
  mutable std::mutex mutex_;
  std::priority_queue<atr_cleanup_entry, std::vector<atr_cleanup_entry>, compare_atr_entries>
    queue_;

public:
  // pop, but only if the front entry's min_start_time_ is before now
  std::optional<atr_cleanup_entry> pop(bool check_time = true);
  void push(const std::shared_ptr<attempt_context>& ctx);
  std::size_t size() const;
};

} // namespace couchbase::core::transactions

template<>
struct fmt::formatter<couchbase::core::transactions::atr_cleanup_entry> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::core::transactions::atr_cleanup_entry& e, FormatContext& ctx) const
  {
    return format_to(
      ctx.out(),
      "atr_cleanup_entry{{ atr_id: {}, attempt_id: {}, check_if_expired: {}, min_start_time: {} }}",
      e.atr_id(),
      e.attempt_id(),
      e.check_if_expired(),
      std::chrono::duration_cast<std::chrono::milliseconds>(e.min_start_time().time_since_epoch())
        .count());
  }
};
