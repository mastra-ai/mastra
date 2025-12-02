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

#include "core/operations/document_query.hxx"
#include "transaction_get_multi_mode.hxx"
#include "transaction_get_multi_replicas_from_preferred_server_group_mode.hxx"
#include "transaction_get_multi_replicas_from_preferred_server_group_result.hxx"
#include "transaction_get_multi_result.hxx"
#include "transaction_get_result.hxx"

// TODO(SA): remove public API from core interfaces
#include <couchbase/transactions/transaction_query_options.hxx>

#include <optional>
#include <string>

namespace couchbase::core::transactions
{
/**
 * @brief Provides methods to perform transactional operations.
 *
 * An @ref attempt_context object makes all the transactional kv operations
 * available.  Note they can throw a @ref transaction_operation_failed
 * exception, which needs to NOT be caught, or if caught, rethrown, for
 * transactions to work properly.
 */
class attempt_context
{
public:
  attempt_context() = default;
  attempt_context(attempt_context&&) noexcept = default;
  attempt_context(const attempt_context&) = default;
  auto operator=(attempt_context&&) noexcept -> attempt_context& = default;
  auto operator=(const attempt_context&) -> attempt_context& = default;
  virtual ~attempt_context() = default;

  /**
   * Gets a document from the specified Couchbase collection matching the
   * specified id.
   *
   * @param bucket name of the bucket to use
   * @param collection the collection the document exists in (specified as
   * <scope_name>.<collection_name>
   * @param id the document's ID
   * @return an TransactionDocument containing the document
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual auto get(const core::document_id& id) -> transaction_get_result = 0;

  /**
   * Gets a document from the specified Couchbase collection matching the
   * specified id.
   *
   * @param bucket name of the bucket to use
   * @param collection the collection the document exists in (specified as
   * <scope_name>.<collection_name>
   * @param id the document's ID
   * @return a TransactionDocument containing the document, if it exists.
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual auto get_optional(const core::document_id& id)
    -> std::optional<transaction_get_result> = 0;

  /**
   * Get a document copy from the selected server group.
   *
   * @param id the document's ID
   *
   * @see network_options::preferred_server_group
   * @see https://docs.couchbase.com/server/current/manage/manage-groups/manage-groups.html
   */
  virtual auto get_replica_from_preferred_server_group(const core::document_id& id)
    -> std::optional<transaction_get_result> = 0;

  virtual auto get_multi(const std::vector<core::document_id>& ids, transaction_get_multi_mode mode)
    -> transaction_get_multi_result = 0;

  virtual auto get_multi_replicas_from_preferred_server_group(
    const std::vector<core::document_id>& ids,
    transaction_get_multi_replicas_from_preferred_server_group_mode mode)
    -> transaction_get_multi_replicas_from_preferred_server_group_result = 0;

  /**
   * Mutates the specified document with new content, using the document's last
   * TransactionDocument#cas().
   *
   * The mutation is staged until the transaction is committed.  That is, any
   * read of the document by any Couchbase component will see the document's
   * current value, rather than this staged or 'dirty' data.  If the attempt is
   * rolled back, the staged mutation will be removed.
   *
   * This staged data effectively locks the document from other transactional
   * writes until the attempt completes (commits or rolls back).
   *
   * If the mutation fails, the transaction will automatically rollback this
   * attempt, then retry.
   * @param document the doc to be updated
   * @param content the content to replace the doc with.
   * @return the document, updated with its new CAS value.
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual auto replace(const transaction_get_result& document, codec::encoded_value content)
    -> transaction_get_result = 0;

  /**
   * Inserts a new document into the specified Couchbase collection.
   *
   * As with #replace, the insert is staged until the transaction is committed.
   * Due to technical limitations it is not as possible to completely hide the
   * staged data from the rest of the Couchbase platform, as an empty document
   * must be created.
   *
   * This staged data effectively locks the document from other transactional
   * writes until the attempt completes (commits or rolls back).
   *
   * @param collection the Couchbase collection in which to insert the doc
   * @param id the document's unique ID
   * @param content the content to insert
   * @return the doc, updated with its new CAS value and ID, and converted to a
   * TransactionDocument
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual auto insert(const core::document_id& id, codec::encoded_value content)
    -> transaction_get_result = 0;

  /**
   * Removes the specified document, using the document's last
   * TransactionDocument#cas
   *
   * As with {@link #replace}, the remove is staged until the transaction is
   * committed.  That is, the document will continue to exist, and the rest of
   * the Couchbase platform will continue to see it.
   *
   * This staged data effectively locks the document from other transactional
   * writes until the attempt completes (commits or rolls back).
   *
   * @param document the document to be removed
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual void remove(const transaction_get_result& document) = 0;

  /**
   * Performs a Query, within the current transaction.
   *
   * @param statement query statement to execute.
   * @param options options to apply to the query.
   * @param query_context query context, if any.
   * @returns result of the query.
   */
  auto query(const std::string& statement,
             const couchbase::transactions::transaction_query_options& opts,
             std::optional<std::string> query_context = {}) -> core::operations::query_response
  {
    return do_core_query(statement, opts, std::move(query_context));
  };

  /**
   * Performs a Query, within the current transaction.
   *
   * @param statement query statement to execute.
   * @return result of the query
   */
  auto query(const std::string& statement) -> core::operations::query_response
  {
    couchbase::transactions::transaction_query_options opts;
    return query(statement, opts);
  }

  /**
   * Commits the transaction.  All staged replaces, inserts and removals will be
   * written.
   *
   * After this, no further operations are permitted on this instance, and they
   * will result in an exception that will, if not caught in the transaction
   * logic, cause the transaction to fail.
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual void commit() = 0;

  /**
   * Rollback the transaction.  All staged mutations will be unstaged.
   *
   * Typically, this is called internally to rollback transaction when errors
   * occur in the lambda. Though it can be called explicitly from the app logic
   * within the transaction as well, perhaps that is better modeled as a custom
   * exception that you raise instead.
   *
   * @throws transaction_operation_failed which either should not be caught by
   * the lambda, or rethrown if it is caught.
   */
  virtual void rollback() = 0;

protected:
  virtual auto do_core_query(const std::string&,
                             const couchbase::transactions::transaction_query_options& opts,
                             std::optional<std::string> query_context)
    -> core::operations::query_response = 0;
};

} // namespace couchbase::core::transactions
