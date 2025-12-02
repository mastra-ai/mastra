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

#include <stdexcept>
#include <vector>

namespace couchbase
{
class collection;
class scope;

namespace transactions
{
/**
 * The attempt_context is used for all synchronous transaction operations
 *
 * In the example below, we get a document then replace its content:
 *
 * @snippet{trimleft} test/test_transaction_examples.cxx simple-blocking-txn
 */

class attempt_context
{
public:
  /**
   * Get a document from a collection.
   *
   * Fetch the document contents, in the form of a @ref transaction_get_result.
   * This can be used in subsequent calls to @ref attempt_context::replace or
   * @ref attempt_context::remove
   *
   * @param coll The collection which contains the document.
   * @param id The unique id of the document.
   * @return The result of the operation, which is an @ref error and a @ref
   * transaction_get_result.
   *
   * The example below shows how to use custom transcoder with transactions.
   *
   * The type should have transcoder to be defined. The only restriction is
   * that the transcoder should mark encoded value with either
   * codec::codec_flags::json_common_flags or codec::codec_flags::binary_common_flags.
   * Behavior of transcoders with any other flags is not defined.
   *
   * @snippet{trimleft} test_transaction_examples.cxx binary_object_in_transactions-sync_get
   *
   * @see transactions::transaction_get_result for more complete example
   */
  virtual auto get(const couchbase::collection& coll, const std::string& id)
    -> std::pair<error, transaction_get_result> = 0;

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
   * @return The result of the operation, which is an @ref error and a @ref
   * transaction_get_result.
   *
   * Select preferred server group in connection options:
   * @snippet{trimleft} test_integration_read_replica.cxx select-preferred_server_group
   *
   * Fetch document from the nodes that belong to selected server group only:
   * @snippet{trimleft} test_transaction_examples.cxx get_replica_from_preferred_server_group-sync
   *
   * @see network_options::preferred_server_group
   * @see https://docs.couchbase.com/server/current/manage/manage-groups/manage-groups.html
   */
  virtual auto get_replica_from_preferred_server_group(const couchbase::collection& coll,
                                                       const std::string& id)
    -> std::pair<error, transaction_get_result> = 0;

  virtual auto get_multi(const std::vector<transaction_get_multi_spec>& specs,
                         const transaction_get_multi_options& options)
    -> std::pair<error, std::optional<transaction_get_multi_result>> = 0;

  virtual auto get_multi_replicas_from_preferred_server_group(
    const std::vector<transaction_get_multi_replicas_from_preferred_server_group_spec>& specs,
    const transaction_get_multi_replicas_from_preferred_server_group_options& options)
    -> std::pair<
      error,
      std::optional<transaction_get_multi_replicas_from_preferred_server_group_result>> = 0;

  /**
   * Insert a document into a collection.
   *
   * Given an id and the content, this inserts a new document into a collection.
   * Note that currently this content can be either a <std::vector<std::byte>>
   * or an object which can be serialized with the @ref
   * codec::tao_json_serializer.
   *
   * @tparam Document Type of the contents of the document.
   * @param coll Collection in which to insert document.
   * @param id The unique id of the document.
   * @param content The content of the document.
   * @return The result of the operation, which is an @ref error and a @ref
   * transaction_get_result.
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  auto insert(const couchbase::collection& coll, const std::string& id, const Document& content)
    -> std::pair<error, transaction_get_result>
  {
    codec::encoded_value data;
    try {
      data = Transcoder::encode(content);
    } catch (std::system_error& e) {
      return { error(e.code(), e.what()), {} };
    } catch (std::runtime_error& e) {
      return { error(errc::common::encoding_failure, e.what()), {} };
    }
    return insert_raw(coll, id, data);
  }

  /**
   * Replace the contents of a document in a collection.
   *
   * Replaces the contents of an existing document. Note that currently this content can be either a
   * std::vector<std::byte> or an object which can be serialized with the @ref
   * codec::tao_json_serializer.
   *
   * @tparam Content Type of the contents of the document.
   * @param doc Document whose content will be replaced.  This is gotten from a call to @ref
   * attempt_context::get
   * @param content New content of the document.
   * @return The result of the operation, which is an @ref error and a @ref transaction_get_result.
   *
   * The example below shows how to use custom transcoder with transactions.
   *
   * The type should have transcoder to be defined. The only restriction is
   * that the transcoder should mark encoded value with either
   * codec::codec_flags::json_common_flags or codec::codec_flags::binary_common_flags.
   * Behavior of transcoders with any other flags is not defined.
   *
   * @snippet{trimleft} test_transaction_examples.cxx binary_object_in_transactions-sync_replace
   *
   * @see transactions::transaction_get_result for more complete example
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  auto replace(const transaction_get_result& doc, const Document& content)
    -> std::pair<error, transaction_get_result>
  {
    codec::encoded_value data;
    try {
      data = Transcoder::encode(content);
    } catch (std::system_error& e) {
      return { error(e.code(), e.what()), {} };
    } catch (std::runtime_error& e) {
      return { error(errc::common::encoding_failure, e.what()), {} };
    }
    return replace_raw(doc, data);
  }

  /**
   * Remove a document.
   *
   * Removes a document from a collection, where the document was gotten from a
   * previous call to
   * @ref attempt_context::get
   *
   * @param doc The document to remove.
   * @return The result of the operation.
   */
  virtual auto remove(const transaction_get_result& doc) -> error = 0;

  /**
   * Perform an unscoped query.
   *
   * @param statement The query statement.
   * @param options Options for the query.
   * @return The result of the operation, with is an @ref error and a @ref
   * transaction_query_result.
   */
  auto query(const std::string& statement, const transaction_query_options& options = {})
    -> std::pair<error, transaction_query_result>;

  /**
   * Perform a scoped query.
   *
   * @param scope Scope for the query.
   * @param statement The query statement.
   * @param opts Options for the query.
   * @return The result of the operation, with is an @ref error and a @ref
   * transaction_query_result.
   */
  auto query(const scope& scope,
             const std::string& statement,
             const transaction_query_options& opts = {})
    -> std::pair<error, transaction_query_result>;

  virtual ~attempt_context() = default;

protected:
  /** @private */
  virtual auto replace_raw(const transaction_get_result& doc, codec::encoded_value content)
    -> std::pair<error, transaction_get_result> = 0;
  /** @private */
  virtual auto insert_raw(const couchbase::collection& coll,
                          const std::string& id,
                          codec::encoded_value document)
    -> std::pair<error, transaction_get_result> = 0;
  /** @private */
  virtual auto do_public_query(const std::string& statement,
                               const transaction_query_options& options,
                               std::optional<std::string> query_context)
    -> std::pair<error, transaction_query_result> = 0;
};
} // namespace transactions
} // namespace couchbase
