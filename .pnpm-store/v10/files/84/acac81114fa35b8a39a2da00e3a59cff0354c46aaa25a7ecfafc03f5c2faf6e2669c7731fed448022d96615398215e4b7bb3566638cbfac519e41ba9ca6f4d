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

#include "core/transactions/async_attempt_context.hxx"
#include "couchbase/transactions/transaction_options.hxx"
#include "couchbase/transactions/transaction_result.hxx"
#include "couchbase/transactions/transactions_config.hxx"

#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace couchbase::core::transactions
{
class attempt_context_impl;
enum class attempt_state;
class transactions;
class transactions_cleanup;
struct transaction_attempt;

using txn_complete_callback =
  std::function<void(std::optional<transaction_exception>,
                     std::optional<::couchbase::transactions::transaction_result>)>;

struct exp_delay;

class transaction_context : public std::enable_shared_from_this<transaction_context>
{
public:
  static auto create(transactions& txns,
                     const couchbase::transactions::transaction_options& config = {})
    -> std::shared_ptr<transaction_context>;

  ~transaction_context();
  transaction_context(const transaction_context&) = delete;
  transaction_context(transaction_context&&) = delete;
  auto operator=(transaction_context&&) -> transaction_context& = delete;
  auto operator=(transaction_context&) -> transaction_context& = delete;

  [[nodiscard]] auto transaction_id() const -> const std::string&;

  [[nodiscard]] auto num_attempts() const -> std::size_t;

  [[nodiscard]] auto current_attempt() const -> const transaction_attempt&;

  void add_attempt();

  void current_attempt_state(attempt_state s);

  [[nodiscard]] auto cluster_ref() const -> const core::cluster&;

  auto config() const -> const couchbase::transactions::transactions_config::built&;

  auto cleanup() -> transactions_cleanup&;

  [[nodiscard]] auto has_expired_client_side() -> bool;

  void after_delay(std::chrono::milliseconds delay, const std::function<void()>& fn);

  [[nodiscard]] auto start_time_client() const
    -> std::chrono::time_point<std::chrono::steady_clock>;

  [[nodiscard]] auto atr_id() const -> const std::string&;

  void atr_id(const std::string& id);

  [[nodiscard]] auto atr_collection() const -> const std::string&;

  void atr_collection(const std::string& coll);

  [[nodiscard]] auto get_transaction_result() const
    -> ::couchbase::transactions::transaction_result;

  void new_attempt_context();

  void new_attempt_context(async_attempt_context::VoidCallback&& cb);

  auto current_attempt_context() -> std::shared_ptr<attempt_context_impl>;

  // These functions just delegate to the current_attempt_context_
  void get(const core::document_id& id, async_attempt_context::Callback&& cb);

  void get_replica_from_preferred_server_group(const core::document_id& id,
                                               async_attempt_context::Callback&& cb);

  void get_multi_replicas_from_preferred_server_group(
    const std::vector<core::document_id>& ids,
    transaction_get_multi_replicas_from_preferred_server_group_mode mode,
    std::function<
      void(std::exception_ptr,
           std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb);

  void get_multi(
    const std::vector<core::document_id>& ids,
    transaction_get_multi_mode mode,
    std::function<void(std::exception_ptr, std::optional<transaction_get_multi_result>)>&& cb);

  void get_optional(const core::document_id& id, async_attempt_context::Callback&& cb);

  void insert(const core::document_id& id,
              codec::encoded_value content,
              async_attempt_context::Callback&& cb);

  void replace(const transaction_get_result& doc,
               codec::encoded_value content,
               async_attempt_context::Callback&& cb);

  void remove(const transaction_get_result& doc, async_attempt_context::VoidCallback&& cb);

  void query(const std::string& statement,
             const couchbase::transactions::transaction_query_options& opts,
             std::optional<std::string> query_context,
             async_attempt_context::QueryCallback&& cb);

  void query(const std::string& statement,
             const couchbase::transactions::transaction_query_options& opts,
             async_attempt_context::QueryCallback&& cb);

  void commit(async_attempt_context::VoidCallback&& cb);

  void rollback(async_attempt_context::VoidCallback&& cb);

  void finalize(txn_complete_callback&& cb);

  void existing_error(bool previous_op_failed = true);

  void handle_error(const std::exception_ptr& err, txn_complete_callback&& callback);

  auto remaining() const -> std::chrono::nanoseconds;
  [[nodiscard]] auto expiry_time() const -> std::chrono::steady_clock::time_point;

private:
  transaction_context(transactions& txns,
                      const couchbase::transactions::transaction_options& config);

  std::string transaction_id_;

  /** The time this overall transaction started */
  const std::chrono::time_point<std::chrono::steady_clock> start_time_client_;

  transactions& transactions_;

  couchbase::transactions::transactions_config::built config_;

  /**
   * Will be non-zero only when resuming a deferred transaction. It records how
   * much time has elapsed in total in the deferred transaction, including the
   * time spent in the original transaction plus any time spent while deferred.
   */
  const std::chrono::nanoseconds deferred_elapsed_;

  std::vector<transaction_attempt> attempts_;
  std::string atr_id_;
  std::string atr_collection_;
  transactions_cleanup& cleanup_;
  std::shared_ptr<attempt_context_impl> current_attempt_context_;
  mutable std::mutex mutex_;

  std::unique_ptr<exp_delay> delay_;
};
} // namespace couchbase::core::transactions
