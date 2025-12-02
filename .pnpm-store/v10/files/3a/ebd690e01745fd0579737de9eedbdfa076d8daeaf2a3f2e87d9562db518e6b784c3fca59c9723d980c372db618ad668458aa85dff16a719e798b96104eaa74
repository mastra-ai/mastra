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

#include <couchbase/codec/encoded_value.hxx>

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/value.hpp>

#include <optional>
#include <ostream>
#include <string>

namespace couchbase::core::transactions
{
/** @internal */
class transaction_links
{
private:
  std::optional<std::string> atr_id_;
  std::optional<std::string> atr_bucket_name_;
  std::optional<std::string> atr_scope_name_;
  std::optional<std::string> atr_collection_name_;
  // id of the transaction that has staged content
  std::optional<std::string> staged_transaction_id_;
  std::optional<std::string> staged_attempt_id_;
  std::optional<std::string> staged_operation_id_;
  std::optional<codec::encoded_value> staged_content_json_;
  std::optional<codec::encoded_value> staged_content_binary_;

  // for {BACKUP_FIELDS}
  std::optional<std::string> cas_pre_txn_;
  std::optional<std::string> revid_pre_txn_;
  std::optional<std::uint32_t> exptime_pre_txn_;
  std::optional<std::string> crc32_of_staging_;
  std::optional<std::string> op_;
  std::optional<tao::json::value> forward_compat_;
  bool is_deleted_{ false };

public:
  transaction_links() = default;
  transaction_links(std::optional<std::string> atr_id,
                    std::optional<std::string> atr_bucket_name,
                    std::optional<std::string> atr_scope_name,
                    std::optional<std::string> atr_collection_name,
                    std::optional<std::string> staged_transaction_id,
                    std::optional<std::string> staged_attempt_id,
                    std::optional<std::string> staged_operation_id,
                    std::optional<codec::encoded_value> staged_content_json,
                    std::optional<codec::encoded_value> staged_content_binary,
                    std::optional<std::string> cas_pre_txn,
                    std::optional<std::string> revid_pre_txn,
                    std::optional<std::uint32_t> exptime_pre_txn,
                    std::optional<std::string> crc32_of_staging,
                    std::optional<std::string> op,
                    std::optional<tao::json::value> forward_compat,
                    bool is_deleted);

  /** @brief create links from query result
   *
   * @param json the returned row object from a txn query response.
   */
  explicit transaction_links(const tao::json::value& json);

  void append_to_json(tao::json::value& obj) const;

  /**
   * Note this doesn't guarantee an active transaction, as it may have expired
   * and need rolling back.
   */
  [[nodiscard]] auto is_document_in_transaction() const -> bool
  {
    return !!(atr_id_);
  }

  [[nodiscard]] auto is_document_being_removed() const -> bool
  {
    return (!!op_ && *op_ == "remove");
  }

  [[nodiscard]] auto is_document_being_inserted() const -> bool
  {
    return (!!op_ && *op_ == "insert");
  }

  [[nodiscard]] auto has_staged_write() const -> bool
  {
    return !!(staged_attempt_id_);
  }

  [[nodiscard]] auto atr_id() const -> std::optional<std::string>
  {
    return atr_id_;
  }

  [[nodiscard]] auto atr_bucket_name() const -> std::optional<std::string>
  {
    return atr_bucket_name_;
  }

  [[nodiscard]] auto atr_scope_name() const -> std::optional<std::string>
  {
    return atr_scope_name_;
  }

  [[nodiscard]] auto atr_collection_name() const -> std::optional<std::string>
  {
    return atr_collection_name_;
  }

  [[nodiscard]] auto staged_transaction_id() const -> std::optional<std::string>
  {
    return staged_transaction_id_;
  }

  [[nodiscard]] auto staged_attempt_id() const -> std::optional<std::string>
  {
    return staged_attempt_id_;
  }

  [[nodiscard]] auto staged_operation_id() const -> std::optional<std::string>
  {
    return staged_operation_id_;
  }

  [[nodiscard]] auto cas_pre_txn() const -> std::optional<std::string>
  {
    return cas_pre_txn_;
  }

  [[nodiscard]] auto revid_pre_txn() const -> std::optional<std::string>
  {
    return revid_pre_txn_;
  }

  [[nodiscard]] auto exptime_pre_txn() const -> std::optional<std::uint32_t>
  {
    return exptime_pre_txn_;
  }

  [[nodiscard]] auto op() const -> std::optional<std::string>
  {
    return op_;
  }

  [[nodiscard]] auto crc32_of_staging() const -> std::optional<std::string>
  {
    return crc32_of_staging_;
  }

  [[nodiscard]] auto has_staged_content() const -> bool
  {
    return staged_content_json_ || staged_content_binary_;
  }

  [[nodiscard]] auto staged_content_json_or_binary() const -> codec::encoded_value
  {
    return staged_content_json_.value_or(staged_content_binary_.value_or(codec::encoded_value{}));
  }

  [[nodiscard]] auto staged_user_flags() const -> std::uint32_t
  {
    return staged_content_json_or_binary().flags;
  }

  [[nodiscard]] auto is_staged_content_binary() const -> bool
  {
    return staged_content_binary_.has_value();
  }

  [[nodiscard]] auto staged_content_json() const -> codec::encoded_value
  {
    return staged_content_json_.value_or(codec::encoded_value{});
  }

  [[nodiscard]] auto staged_content_binary() const -> codec::encoded_value
  {
    return staged_content_binary_.value_or(codec::encoded_value{});
  }

  [[nodiscard]] auto forward_compat() const -> std::optional<tao::json::value>
  {
    return forward_compat_;
  }

  [[nodiscard]] auto is_deleted() const -> bool
  {
    return is_deleted_;
  }

  friend auto operator<<(std::ostream& os, const transaction_links& links) -> std::ostream&;
};

auto
operator<<(std::ostream& os, const transaction_links& links) -> std::ostream&;
} // namespace couchbase::core::transactions

template<>
struct fmt::formatter<couchbase::core::transactions::transaction_links> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  constexpr auto format(const couchbase::core::transactions::transaction_links& r,
                        FormatContext& ctx) const
  {
    return format_to(ctx.out(),
                     "transaction_links:{{ atr: {}.{}.{}.{}, txn_id: {}, attempt_id: {}, "
                     "operation_id: {}, crc32_of_staging: {} }}",
                     r.atr_bucket_name().value_or("none"),
                     r.atr_scope_name().value_or("none"),
                     r.atr_collection_name().value_or("none"),
                     r.atr_id().value_or("none"),
                     r.staged_transaction_id().value_or("none"),
                     r.staged_attempt_id().value_or("none"),
                     r.staged_operation_id().value_or("none"),
                     r.crc32_of_staging().value_or("none"));
  }
};
