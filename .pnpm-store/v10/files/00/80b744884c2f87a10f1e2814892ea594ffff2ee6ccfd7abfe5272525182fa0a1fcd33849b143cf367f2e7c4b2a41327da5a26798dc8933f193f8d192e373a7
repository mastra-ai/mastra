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

#include "error_list.hxx"
#include "waitable_op_list.hxx"

#include "async_attempt_context.hxx"
#include "attempt_context.hxx"
#include "attempt_state.hxx"
#include "internal/atr_cleanup_entry.hxx"
#include "internal/exceptions_internal.hxx"
#include "transaction_get_multi_mode.hxx"
#include "transaction_get_result.hxx"

// TODO(SA): do not mix public and core APIs in the single class
#include <chrono>
#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/transactions/async_attempt_context.hxx>
#include <couchbase/transactions/attempt_context.hxx>
#include <couchbase/transactions/transaction_get_multi_options.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_options.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_result.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_spec.hxx>
#include <couchbase/transactions/transaction_get_multi_result.hxx>
#include <couchbase/transactions/transaction_get_multi_spec.hxx>
#include <couchbase/transactions/transaction_query_options.hxx>

#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <utility>

// implemented in core::impl::query, to take advantage of the statics over there
namespace couchbase::core
{
class cluster;
class transaction_context;

namespace impl
{
auto
build_transaction_query_result(operations::query_response resp, std::error_code ec = {})
  -> std::pair<couchbase::core::transaction_op_error_context,
               couchbase::transactions::transaction_query_result>;

auto
build_transaction_query_request(couchbase::query_options::built opts)
  -> core::operations::query_request;
} // namespace impl

namespace transactions
{
/**
 * Provides methods to allow an application's transaction logic to read, mutate,
 * insert and delete documents, as well as commit or rollback the transaction.
 */
class transactions;
enum class forward_compat_stage : std::uint8_t;
class staged_mutation_queue;
class staged_mutation;
struct attempt_context_testing_hooks;

class attempt_context_impl
  : public attempt_context
  , public couchbase::transactions::attempt_context
  , public async_attempt_context
  , public couchbase::transactions::async_attempt_context
  , public std::enable_shared_from_this<attempt_context_impl>
{
private:
  std::weak_ptr<transaction_context> overall_;
  std::optional<core::document_id> atr_id_;
  bool is_done_{ false };
  std::unique_ptr<staged_mutation_queue> staged_mutations_;
  attempt_context_testing_hooks& hooks_;
  error_list errors_;
  std::mutex mutex_;
  waitable_op_list op_list_;
  std::string query_context_;

  // commit needs to access the hooks
  friend class staged_mutation_queue;
  // entry needs access to private members
  friend class atr_cleanup_entry;
  // transaction_context needs access to the two functions below
  friend class transaction_context;

  void insert(const core::document_id& id,
              codec::encoded_value content,
              core::transactions::async_attempt_context::Callback&& cb) override;

  auto insert(const core::document_id& id, codec::encoded_value content)
    -> core::transactions::transaction_get_result override;

  void replace(const transaction_get_result& document,
               codec::encoded_value content,
               core::transactions::async_attempt_context::Callback&& cb) override;

  auto replace(const transaction_get_result& document, codec::encoded_value content)
    -> transaction_get_result override;

  auto insert_raw(const collection& coll, const std::string& id, codec::encoded_value content)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result> override;

  void insert_raw(const collection& coll,
                  std::string id,
                  codec::encoded_value content,
                  couchbase::transactions::async_result_handler&& handler) override;

  auto replace_raw(const couchbase::transactions::transaction_get_result& doc,
                   codec::encoded_value content)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result> override;

  void replace_raw(couchbase::transactions::transaction_get_result doc,
                   codec::encoded_value content,
                   couchbase::transactions::async_result_handler&& handler) override;

  void remove_staged_insert(const core::document_id& id, VoidCallback&& cb);

  void get_with_query(
    const core::document_id& id,
    bool optional,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb);
  void insert_raw_with_query(
    const core::document_id& id,
    codec::encoded_value content,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb);
  void replace_raw_with_query(
    const transaction_get_result& document,
    codec::encoded_value content,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb);
  void remove_with_query(const transaction_get_result& document, VoidCallback&& cb);

  void commit_with_query(VoidCallback&& cb);
  void rollback_with_query(VoidCallback&& cb);

  void query_begin_work(const std::optional<std::string>& query_context, VoidCallback&& cb);

  void do_query(const std::string& statement,
                const couchbase::transactions::transaction_query_options& opts,
                const std::optional<std::string>& query_context,
                QueryCallback&& cb);
  auto handle_query_error(const core::operations::query_response& resp) const -> std::exception_ptr;
  void wrap_query(const std::string& statement,
                  const couchbase::transactions::transaction_query_options& opts,
                  std::vector<core::json_string> params,
                  const tao::json::value& txdata,
                  const std::string& hook_point,
                  bool check_expiry,
                  const std::optional<std::string>& query_context,
                  std::function<void(std::exception_ptr, core::operations::query_response)>&& cb);

  void handle_err_from_callback(const std::exception_ptr& e);

  template<typename Cb, typename E, typename T>
  void op_completed_with_callback(Cb&& cb, E e, std::optional<T> t)
  {
    try {
      op_list_.decrement_in_flight();
      std::forward<Cb>(cb)(std::make_exception_ptr(std::forward<E>(e)), t);
      op_list_.decrement_ops();
    } catch (...) {
      handle_err_from_callback(std::current_exception());
    }
  }

  template<typename Cb, typename T>
  void op_completed_with_callback(Cb&& cb, std::optional<T> t)
  {
    try {
      op_list_.decrement_in_flight();
      std::forward<Cb>(cb)({}, t);
      op_list_.decrement_ops();
    } catch (...) {
      handle_err_from_callback(std::current_exception());
    }
  }

  template<typename Cb>
  void op_completed_with_callback(Cb&& cb)
  {
    try {
      op_list_.decrement_in_flight();
      std::forward<Cb>(cb)({});
      op_list_.decrement_ops();
    } catch (...) {
      handle_err_from_callback(std::current_exception());
    }
  }

  template<typename ErrorHandler,
           typename ExceptionType,
           typename std::enable_if_t<!std::is_same_v<ExceptionType, std::exception_ptr>, int> = 0>
  void op_completed_with_error(ErrorHandler&& cb, ExceptionType&& err)
  {
    return op_completed_with_error(std::forward<ErrorHandler>(cb),
                                   std::make_exception_ptr(std::forward<ExceptionType>(err)));
  }

  void op_completed_with_error(const VoidCallback& cb, const std::exception_ptr& err);

  template<typename Ret>
  void op_completed_with_error(std::function<void(std::exception_ptr, std::optional<Ret>)> cb,
                               std::exception_ptr&& err)
  {
    try {
      std::rethrow_exception(err);
    } catch (const transaction_operation_failed& e) {
      // if this is a transaction_operation_failed, we need to cache it before
      // moving on...
      errors_.push_back(e);
      try {
        op_list_.decrement_in_flight();
        cb(std::current_exception(), std::optional<Ret>());
        op_list_.decrement_ops();
      } catch (...) {
        handle_err_from_callback(std::current_exception());
      }
    } catch (...) {
      try {
        op_list_.decrement_in_flight();
        cb(std::current_exception(), std::optional<Ret>());
        op_list_.decrement_ops();
      } catch (...) {
        handle_err_from_callback(std::current_exception());
      }
    }
  }

  template<typename Ret>
  void op_completed_with_error_no_cache(
    std::function<void(std::exception_ptr, std::optional<Ret>)> cb,
    std::exception_ptr err)
  {
    try {
      cb(err, std::optional<Ret>());
    } catch (...) {
      // eat it.
    }
  }

  void op_completed_with_error_no_cache(VoidCallback cb, std::exception_ptr err)
  {
    try {
      cb(std::move(err));
    } catch (...) {
      // just eat it.
    }
  }

  template<typename Handler>
  void cache_error_async(Handler&& cb, std::function<void()> func)
  {
    try {
      op_list_.increment_ops();
      existing_error();
      return func();
    } catch (const async_operation_conflict& e) {
      CB_ATTEMPT_CTX_LOG_ERROR(this,
                               "Attempted to perform txn operation after "
                               "commit/rollback started: {}",
                               e.what());
      // you cannot call op_completed_with_error, as it tries to decrement
      // the op count, however it didn't successfully increment it, so...
      auto err = transaction_operation_failed(FAIL_OTHER, "async operation conflict");
      switch (state()) {
        case attempt_state::ABORTED:
        case attempt_state::ROLLED_BACK:
          err.cause(TRANSACTION_ALREADY_ABORTED);
          break;
        case attempt_state::COMMITTED:
        case attempt_state::COMPLETED:
          err.cause(TRANSACTION_ALREADY_COMMITTED);
          break;
        default:
          err.cause(UNKNOWN);
      }
      op_completed_with_error_no_cache(std::forward<Handler>(cb), std::make_exception_ptr(err));
    } catch (const transaction_operation_failed& e) {
      // thrown only from call_func when previous error exists, so eat it,
      // unless it has PREVIOUS_OP_FAILED or FEATURE_NOT_AVAILABLE_EXCEPTION
      // cause
      if (e.cause() == PREVIOUS_OPERATION_FAILED || e.cause() == FEATURE_NOT_AVAILABLE_EXCEPTION) {
        op_completed_with_error(cb, e);
      }
    } catch (const op_exception& e) {
      op_completed_with_error(cb, e);
    } catch (const std::exception& e) {
      op_completed_with_error(cb, transaction_operation_failed(FAIL_OTHER, e.what()));
    }
  }

  explicit attempt_context_impl(const std::shared_ptr<transaction_context>& transaction_ctx);

public:
  [[nodiscard]] auto cluster_ref() const -> const core::cluster&;
  [[nodiscard]] auto expiry_time() const -> std::chrono::steady_clock::time_point;

  static auto create(const std::shared_ptr<transaction_context>& transaction_ctx)
    -> std::shared_ptr<attempt_context_impl>;

  ~attempt_context_impl() override;
  attempt_context_impl(attempt_context_impl&) = delete;
  attempt_context_impl(attempt_context_impl&&) = delete;
  auto operator=(attempt_context_impl&) -> attempt_context_impl& = delete;
  auto operator=(attempt_context_impl&&) -> attempt_context_impl& = delete;

  auto get(const core::document_id& id) -> transaction_get_result override;
  auto get(const couchbase::collection& coll, const std::string& id)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result> override;
  void get(const couchbase::collection& coll,
           std::string id,
           couchbase::transactions::async_result_handler&& handler) override;
  void get(
    const core::document_id& id,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb) override;

  auto get_optional(const core::document_id& id) -> std::optional<transaction_get_result> override;
  void get_optional(
    const core::document_id& id,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb) override;

  auto get_replica_from_preferred_server_group(const core::document_id& id)
    -> std::optional<transaction_get_result> override;
  void get_replica_from_preferred_server_group(
    const core::document_id& id,
    std::function<void(std::exception_ptr, std::optional<transaction_get_result>)>&& cb) override;
  auto get_replica_from_preferred_server_group(const couchbase::collection& coll,
                                               const std::string& id)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_get_result> override;
  void get_replica_from_preferred_server_group(
    const couchbase::collection& coll,
    const std::string& id,
    couchbase::transactions::async_result_handler&& handler) override;

  auto get_multi(const std::vector<core::document_id>& ids, transaction_get_multi_mode mode)
    -> transaction_get_multi_result override;
  void get_multi(const std::vector<core::document_id>& ids,
                 transaction_get_multi_mode mode,
                 std::function<void(std::exception_ptr,
                                    std::optional<transaction_get_multi_result>)>&& cb) override;
  auto get_multi(const std::vector<couchbase::transactions::transaction_get_multi_spec>& specs,
                 const couchbase::transactions::transaction_get_multi_options& options)
    -> std::pair<error,
                 std::optional<couchbase::transactions::transaction_get_multi_result>> override;
  void get_multi(
    const std::vector<couchbase::transactions::transaction_get_multi_spec>& specs,
    const couchbase::transactions::transaction_get_multi_options& options,
    std::function<void(error,
                       std::optional<couchbase::transactions::transaction_get_multi_result>)>&& cb)
    override;

  auto get_multi_replicas_from_preferred_server_group(
    const std::vector<core::document_id>& ids,
    transaction_get_multi_replicas_from_preferred_server_group_mode mode)
    -> transaction_get_multi_replicas_from_preferred_server_group_result override;
  void get_multi_replicas_from_preferred_server_group(
    const std::vector<core::document_id>& ids,
    transaction_get_multi_replicas_from_preferred_server_group_mode mode,
    std::function<
      void(std::exception_ptr,
           std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
    override;
  auto get_multi_replicas_from_preferred_server_group(
    const std::vector<
      couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_spec>&
      specs,
    const couchbase::transactions::
      transaction_get_multi_replicas_from_preferred_server_group_options& options)
    -> std::pair<
      error,
      std::optional<couchbase::transactions::
                      transaction_get_multi_replicas_from_preferred_server_group_result>> override;
  void get_multi_replicas_from_preferred_server_group(
    const std::vector<
      couchbase::transactions::transaction_get_multi_replicas_from_preferred_server_group_spec>&
      specs,
    const couchbase::transactions::
      transaction_get_multi_replicas_from_preferred_server_group_options& options,
    std::function<void(
      error,
      std::optional<couchbase::transactions::
                      transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb)
    override;

  void remove(const transaction_get_result& document) override;
  auto remove(const couchbase::transactions::transaction_get_result& doc)
    -> couchbase::error override;
  void remove(const transaction_get_result& document, VoidCallback&& cb) override;
  void remove(couchbase::transactions::transaction_get_result doc,
              couchbase::transactions::async_err_handler&& handler) override;

  auto do_core_query(const std::string& statement,
                     const couchbase::transactions::transaction_query_options& options,
                     std::optional<std::string> query_context)
    -> core::operations::query_response override;

  auto do_public_query(const std::string& statement,
                       const couchbase::transactions::transaction_query_options& opts,
                       std::optional<std::string> query_context)
    -> std::pair<couchbase::error, couchbase::transactions::transaction_query_result> override;

  void query(const std::string& statement,
             const couchbase::transactions::transaction_query_options& options,
             std::optional<std::string> query_context,
             QueryCallback&& cb) override;

  void query(std::string statement,
             couchbase::transactions::transaction_query_options opts,
             std::optional<std::string> query_context,
             couchbase::transactions::async_query_handler&& handler) override;

  void commit() override;
  void commit(VoidCallback&& cb) override;
  void rollback() override;
  void rollback(VoidCallback&& cb) override;

  void existing_error(bool prev_op_failed = true);

  [[nodiscard]] auto is_done() const -> bool;

  [[nodiscard]] auto overall() const -> std::shared_ptr<transaction_context>;

  [[nodiscard]] auto transaction_id() const -> const std::string&;

  [[nodiscard]] auto id() const -> const std::string&;

  [[nodiscard]] auto state() const -> attempt_state;

  void state(attempt_state s) const;

  [[nodiscard]] auto atr_id() const -> const std::string&;

  void atr_id(const std::string& atr_id) const;

  [[nodiscard]] auto atr_collection() const -> const std::string&;

  void atr_collection_name(const std::string& coll) const;

  auto has_expired_client_side(std::string place, std::optional<const std::string> doc_id) -> bool;

private:
  std::atomic<bool> expiry_overtime_mode_{ false };

  auto check_expiry_pre_commit(std::string stage, std::optional<const std::string> doc_id) -> bool;

  void check_expiry_during_commit_or_rollback(const std::string& stage,
                                              std::optional<const std::string> doc_id);

  void set_atr_pending_locked(
    const core::document_id& id,
    std::unique_lock<std::mutex>&& lock,
    std::function<void(std::optional<transaction_operation_failed>)>&& fn);

  auto error_if_expired_and_not_in_overtime(const std::string& stage,
                                            std::optional<const std::string> doc_id)
    -> std::optional<error_class>;

  auto check_for_own_write(const core::document_id& id) -> staged_mutation*;

  void check_and_handle_blocking_transactions(
    const transaction_get_result& doc,
    forward_compat_stage stage,
    std::function<void(std::optional<transaction_operation_failed>)>&& cb);

  template<typename Handler, typename Delay>
  void check_atr_entry_for_blocking_document(const transaction_get_result& doc,
                                             Delay delay,
                                             Handler&& cb);

  template<typename Handler>
  void check_if_done(Handler& cb);

  void atr_commit(bool ambiguity_resolution_mode);

  void atr_commit_ambiguity_resolution();

  void atr_complete();

  void atr_abort();

  void atr_rollback_complete();

  void select_atr_if_needed_unlocked(
    const core::document_id& id,
    std::function<void(std::optional<transaction_operation_failed>)>&& cb);

  template<typename Handler>
  void do_get(const core::document_id& id,
              bool allow_replica,
              std::optional<std::string> resolving_missing_atr_entry,
              Handler&& cb);

  void get_doc(const core::document_id& id,
               bool allow_replica,
               std::function<void(std::optional<error_class>,
                                  std::optional<external_exception>,
                                  std::optional<std::string>,
                                  std::optional<transaction_get_result>)>&& cb);

  auto create_document_metadata(const std::string& operation_type,
                                const std::string& operation_id,
                                const std::optional<document_metadata>& document_metadata,
                                std::uint32_t user_flags_to_stage) -> tao::json::value;

  template<typename Handler, typename Delay>
  void create_staged_insert(const core::document_id& id,
                            codec::encoded_value content,
                            uint64_t cas,
                            Delay&& delay,
                            const std::string& op_id,
                            Handler&& cb);

  template<typename Handler>
  void create_staged_replace(const document_id& id,
                             codec::encoded_value content,
                             std::uint32_t original_flags,
                             const couchbase::cas& cas,
                             const std::string& op_id,
                             const std::optional<document_metadata>& document_metadata,
                             Handler&& cb);

  template<typename Handler, typename Delay>
  void create_staged_insert_error_handler(const core::document_id& id,
                                          const codec::encoded_value& content,
                                          std::uint64_t cas,
                                          Delay&& delay,
                                          const std::string& op_id,
                                          Handler&& cb,
                                          error_class ec,
                                          external_exception cause,
                                          const std::string& message);

  void ensure_open_bucket(const std::string& bucket_name,
                          std::function<void(std::error_code)>&& handler) const;

  void supports_replace_body_with_xattr(const std::string& bucket_name,
                                        std::function<void(std::error_code, bool)>&& handler) const;
};

} // namespace transactions
} // namespace couchbase::core
