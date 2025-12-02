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

#include <couchbase/transactions/transaction_get_multi_options.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_options.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_result.hxx>
#include <couchbase/transactions/transaction_get_multi_replicas_from_preferred_server_group_spec.hxx>
#include <couchbase/transactions/transaction_get_multi_result.hxx>
#include <couchbase/transactions/transaction_get_multi_spec.hxx>
#include <couchbase/transactions/transaction_get_result.hxx>
#include <couchbase/transactions/transaction_query_options.hxx>
#include <couchbase/transactions/transaction_query_result.hxx>

namespace couchbase
{
class collection;
class scope;

namespace transactions
{
using async_result_handler = std::function<void(error, transaction_get_result)>;
using async_query_handler = std::function<void(error, transaction_query_result)>;
using async_err_handler = std::function<void(error)>;

/**
 * The async_attempt_context is used for all asynchronous transaction operations
 *
 * In the example below, we get 3 documents in parallel, and update each when
 * the get returns the document:
 *
 * @snippet{trimleft} test/test_transaction_examples.cxx simple-async-txn
 */
class async_attempt_context
{
public:
  virtual ~async_attempt_context() = default;
  async_attempt_context() = default;
  async_attempt_context(async_attempt_context&&) noexcept = default;
  async_attempt_context(const async_attempt_context&) = default;
  auto operator=(async_attempt_context&&) -> async_attempt_context& = default;
  auto operator=(const async_attempt_context&) -> async_attempt_context& = default;

  /**
   * Get document from a collection.
   *
   * Fetch the document contents, in the form of a @ref transaction_get_result.
   * This can be used in subsequent calls to @ref async_attempt_context::replace
   * or @ref async_attempt_context::remove
   *
   * @param coll The collection which contains the document.
   * @param id The document id which is used to uniquely identify it.
   * @param handler The handler which implements @ref async_result_handler
   */
  virtual void get(const collection& coll, std::string id, async_result_handler&& handler) = 0;

  /**
   * Get a document copy from the selected server group.
   *
   * Fetch the document contents, in the form of a @ref transaction_get_result.
   * It might be either replica or active copy of the document. One of the use
   * cases for this method is to save on network costs by deploying SDK in the
   * same availability zone as corresponding server group of the nodes.
   *
   * @param coll The collection which contains the document.
   * @param id The unique id of the document.
   * @param handler The handler which implements @ref async_result_handler
   *
   * Select preferred server group in connection options:
   * @snippet{trimleft} test_integration_read_replica.cxx select-preferred_server_group
   *
   * Fetch document from the nodes that belong to selected server group only:
   * @snippet{trimleft} test_transaction_examples.cxx get_replica_from_preferred_server_group-async
   *
   * @see network_options::preferred_server_group
   * @see https://docs.couchbase.com/server/current/manage/manage-groups/manage-groups.html
   */
  virtual void get_replica_from_preferred_server_group(const couchbase::collection& coll,
                                                       const std::string& id,
                                                       async_result_handler&& handler) = 0;

  virtual void get_multi(
    const std::vector<transaction_get_multi_spec>& specs,
    const transaction_get_multi_options& options,
    std::function<void(error, std::optional<transaction_get_multi_result>)>&& cb) = 0;

  virtual void get_multi_replicas_from_preferred_server_group(
    const std::vector<transaction_get_multi_replicas_from_preferred_server_group_spec>& specs,
    const transaction_get_multi_replicas_from_preferred_server_group_options& options,
    std::function<void(
      error,
      std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>)>&& cb) = 0;

  /**
   * Remove a document from a collection.
   *
   * Removes a document from a collection, where the document was gotten from a
   * previous call to
   * @ref async_attempt_context::get
   *
   * @param doc The document to remove.
   * @param handler The handler which implements @ref async_err_handler
   */
  virtual void remove(transaction_get_result doc, async_err_handler&& handler) = 0;

  /**
   * Insert a document into a collection.
   *
   * Given an id and the content, this inserts a new document into a collection.
   * Note that currently this content can be either a <std::vector<std::byte>>
   * or an object which can be serialized with the @ref
   * codec::tao_json_serializer.
   *
   * @tparam Content type of the document.
   * @param coll Collection to insert the document into.
   * @param id The document id.
   * @param content The content of the document.
   * @param handler The handler which implements @ref async_result_handler
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  void insert(const collection& coll,
              std::string id,
              Document&& content,
              async_result_handler&& handler)
  {
    return insert_raw(
      coll, id, Transcoder::encode(std::forward<Document>(content)), std::move(handler));
  }
  /**
   * Replace the contents of a document in a collection.
   *
   * Replaces the contents of an existing document. Note that currently this
   * content can be either a <std::vector<std::byte>> or an object which can be
   * serialized with the @ref codec::tao_json_serializer.
   *
   * @tparam Content type of the document
   * @param doc Document whose content will be replaced.  This is gotten from a
   * call to @ref async_attempt_context::get
   * @param content New content of the document
   * @param handler The handler which implements @ref async_result_handler
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  void replace(transaction_get_result doc, Document&& content, async_result_handler&& handler)
  {
    return replace_raw(
      std::move(doc), Transcoder::encode(std::forward<Document>(content)), std::move(handler));
  }
  /**
   * Perform a query, within a scope.
   *
   * Performs a query given a specific scope.   Note that all subsequent
   * transaction operations will be handled by the query service.
   *
   * @param scope Scope for the query.
   * @param statement The query statement
   * @param opts Options for the query
   * @param handler Handler which implements @ref async_query_handler.
   */
  void query(const scope& scope,
             std::string statement,
             transaction_query_options opts,
             async_query_handler&& handler);

  /**
   * Perform a query.
   *
   * Performs an unscoped query.
   *
   * @param statement The query statement.
   * @param opts Options for the query.
   * @param handler Handler which implements @ref async_query_handler.
   */
  void query(std::string statement, transaction_query_options opts, async_query_handler&& handler)
  {
    return query(std::move(statement), std::move(opts), {}, std::move(handler));
  };
  /**
   * Perform a query.
   *
   * Performs an unscoped query.
   *
   * @param statement The query statement.
   * @param handler Handler which implements @ref async_query_handler
   */
  void query(std::string statement, async_query_handler&& handler)
  {
    return query(std::move(statement), {}, std::move(handler));
  }

protected:
  /** @private */
  virtual void insert_raw(const collection& coll,
                          std::string id,
                          codec::encoded_value content,
                          async_result_handler&& handler) = 0;
  /** @private */
  virtual void replace_raw(transaction_get_result doc,
                           codec::encoded_value content,
                           async_result_handler&& handler) = 0;
  /** @private */
  virtual void query(std::string statement,
                     transaction_query_options opts,
                     std::optional<std::string> query_context,
                     async_query_handler&&) = 0;
};
} // namespace transactions
} // namespace couchbase
