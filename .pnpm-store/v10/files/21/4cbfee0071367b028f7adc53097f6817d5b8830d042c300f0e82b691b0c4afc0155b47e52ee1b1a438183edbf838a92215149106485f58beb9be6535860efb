/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include <couchbase/binary_collection.hxx>
#include <couchbase/codec/default_json_transcoder.hxx>
#include <couchbase/collection_query_index_manager.hxx>
#include <couchbase/error.hxx>
#include <couchbase/exists_options.hxx>
#include <couchbase/expiry.hxx>
#include <couchbase/get_all_replicas_options.hxx>
#include <couchbase/get_and_lock_options.hxx>
#include <couchbase/get_and_touch_options.hxx>
#include <couchbase/get_any_replica_options.hxx>
#include <couchbase/get_options.hxx>
#include <couchbase/insert_options.hxx>
#include <couchbase/lookup_in_all_replicas_options.hxx>
#include <couchbase/lookup_in_any_replica_options.hxx>
#include <couchbase/lookup_in_options.hxx>
#include <couchbase/lookup_in_specs.hxx>
#include <couchbase/mutate_in_options.hxx>
#include <couchbase/mutate_in_specs.hxx>
#include <couchbase/query_options.hxx>
#include <couchbase/remove_options.hxx>
#include <couchbase/replace_options.hxx>
#include <couchbase/scan_options.hxx>
#include <couchbase/scan_result.hxx>
#include <couchbase/scan_type.hxx>
#include <couchbase/touch_options.hxx>
#include <couchbase/unlock_options.hxx>
#include <couchbase/upsert_options.hxx>

#include <future>
#include <memory>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;
} // namespace core
class bucket;
class scope;
class collection_impl;
namespace crypto
{
class manager;
} // namespace crypto
#endif

/**
 * The {@link collection} provides access to all collection APIs.
 *
 * @since 1.0.0
 * @committed
 */
class collection
{
public:
  /**
   * Constant for the name of the default collection in the bucket.
   *
   * @since 1.0.0
   * @committed
   */
  static constexpr auto default_name{ "_default" };

  /**
   * Returns name of the bucket where the collection is defined.
   *
   * @return name of the bucket
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto bucket_name() const -> const std::string&;

  /**
   * Returns name of the scope where the collection is defined.
   *
   * @return name of the scope
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto scope_name() const -> const std::string&;

  /**
   * Returns name of the collection.
   *
   * @return name of the collection
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto name() const -> const std::string&;

  /**
   * Provides access to the binary APIs, not used for JSON documents.
   *
   * @return the requested collection if successful.
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto binary() const -> binary_collection;

  /**
   * Fetches the full document from this collection.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options options to customize the get request.
   * @param handler the handler that implements @ref get_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void get(std::string document_id, const get_options& options, get_handler&& handler) const;

  /**
   * Fetches the full document from this collection.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options options to customize the get request.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get(std::string document_id, const get_options& options = {}) const
    -> std::future<std::pair<error, get_result>>;

  /**
   * Fetches a full document and resets its expiration time to the value provided.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param duration the new expiration time for the document.
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref get_and_touch_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void get_and_touch(std::string document_id,
                     std::chrono::seconds duration,
                     const get_and_touch_options& options,
                     get_and_touch_handler&& handler) const;

  /**
   * Fetches a full document and resets its expiration time to the value provided.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param duration the new expiration time for the document.
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_and_touch(std::string document_id,
                                   std::chrono::seconds duration,
                                   const get_and_touch_options& options = {}) const
    -> std::future<std::pair<error, get_result>>;

  /**
   * Fetches a full document and resets its expiration time to the absolute value provided.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param time_point the new expiration time point for the document.
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref get_and_touch_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void get_and_touch(std::string document_id,
                     std::chrono::system_clock::time_point time_point,
                     const get_and_touch_options& options,
                     get_and_touch_handler&& handler) const;

  /**
   * Fetches a full document and resets its expiration time to the absolute value provided.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param time_point the new expiration time point for the document.
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_and_touch(std::string document_id,
                                   std::chrono::system_clock::time_point time_point,
                                   const get_and_touch_options& options = {}) const
    -> std::future<std::pair<error, get_result>>;

  /**
   * Updates the expiration a document given an id, without modifying or returning its value.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param duration the new expiration time for the document.
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref touch_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void touch(std::string document_id,
             std::chrono::seconds duration,
             const touch_options& options,
             touch_handler&& handler) const;

  /**
   * Updates the expiration a document given an id, without modifying or returning its value.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param duration the new expiration time for the document.
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto touch(std::string document_id,
                           std::chrono::seconds duration,
                           const touch_options& options = {}) const
    -> std::future<std::pair<error, result>>;

  /**
   * Updates the expiration a document given an id, without modifying or returning its value.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param time_point the new expiration time point for the document.
   * @param options custom options to change the default behavior.
   * @param handler the handler that implements @ref touch_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void touch(std::string document_id,
             std::chrono::system_clock::time_point time_point,
             const touch_options& options,
             touch_handler&& handler) const;

  /**
   * Updates the expiration a document given an id, without modifying or returning its value.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param time_point the new expiration time point for the document.
   * @param options custom options to change the default behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto touch(std::string document_id,
                           std::chrono::system_clock::time_point time_point,
                           const touch_options& options = {}) const
    -> std::future<std::pair<error, result>>;

  /**
   * Reads all available replicas, and returns the first found.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options the custom options
   * @param handler the handler that implements @ref get_any_replica_handler
   *
   * @exception errc::key_value::document_irretrievable
   *    the situation where the SDK got all responses (most likely: key not found) but none of them
   * were successful so it ended up not returning anything
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void get_any_replica(std::string document_id,
                       const get_any_replica_options& options,
                       get_any_replica_handler&& handler) const;

  /**
   * Reads all available replicas, and returns the first found.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options the custom options
   * @return the future object with first available result, might be the active or a replica.
   *
   * Select preferred server group in connection options:
   * @snippet{trimleft} test_integration_read_replica.cxx select-preferred_server_group
   *
   * Restrict get_any_replica to reach nodes that belong to selected server
   * group only:
   * @snippet{trimleft} test_integration_read_replica.cxx get_any_replica-with-read_preference
   *
   * @exception errc::key_value::document_irretrievable
   *    the situation where the SDK got all responses (most likely: key not found) but none of them
   * were successful so it ended up not returning anything
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_any_replica(std::string document_id,
                                     const get_any_replica_options& options = {}) const
    -> std::future<std::pair<error, get_replica_result>>;

  /**
   * Reads from all available replicas and the active node and returns the results as a vector.
   *
   * @note Individual errors are ignored, so you can think of this API as a best effort
   * approach which explicitly emphasises availability over consistency.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options the custom options
   * @param handler the handler that implements @ref get_all_replicas_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void get_all_replicas(std::string document_id,
                        const get_all_replicas_options& options,
                        get_all_replicas_handler&& handler) const;

  /**
   * Reads from all available replicas and the active node and returns the results as a vector.
   *
   * @note Individual errors are ignored, so you can think of this API as a best effort
   * approach which explicitly emphasises availability over consistency.
   *
   * Select preferred server group in connection options:
   * @snippet{trimleft} test_integration_read_replica.cxx select-preferred_server_group
   *
   * Restrict get_all_replicas to reach nodes that belong to selected server
   * group only:
   * @snippet{trimleft} test_integration_read_replica.cxx get_all_replicas-with-read_preference
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options the custom options
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_all_replicas(std::string document_id,
                                      const get_all_replicas_options& options = {}) const
    -> std::future<std::pair<error, get_all_replicas_result>>;

  /**
   * Upserts an encoded body of the document which might or might not exist yet, with custom
   * options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @param handler callable that implements @ref upsert_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  void upsert(std::string document_id,
              codec::encoded_value document,
              const upsert_options& options,
              upsert_handler&& handler) const;

  /**
   * Upserts a full document which might or might not exist yet with custom options.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to upsert.
   * @param options custom options to customize the upsert behavior.
   * @param handler callable that implements @ref upsert_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder, typename Document>
  void upsert(std::string document_id,
              Document document,
              const upsert_options& options,
              upsert_handler&& handler) const
  {
    return upsert(
      std::move(document_id), encode_document<Transcoder>(document), options, std::move(handler));
  }

  /**
   * Upserts an encoded body of the document which might or might not exist yet, with custom
   * options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  [[nodiscard]] auto upsert(std::string document_id,
                            codec::encoded_value document,
                            const upsert_options& options) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Upserts a full document which might or might not exist yet with custom options.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to upsert.
   * @param options custom options to customize the upsert behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder, typename Document>
  [[nodiscard]] auto upsert(std::string document_id,
                            const Document& document,
                            const upsert_options& options = {}) const
    -> std::future<std::pair<error, mutation_result>>
  {
    return upsert(std::move(document_id), encode_document<Transcoder>(document), options);
  }

  /**
   * Inserts an encoded body of the document which does not exist yet with custom options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @param handler callable that implements @ref upsert_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  void insert(std::string document_id,
              codec::encoded_value document,
              const insert_options& options,
              insert_handler&& handler) const;

  /**
   * Inserts a full document which does not exist yet with custom options.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to insert.
   * @param options custom options to customize the insert behavior.
   * @param handler callable that implements @ref insert_handler
   *
   * @exception errc::key_value::document_exists the given document id is already present in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  void insert(std::string document_id,
              Document document,
              const insert_options& options,
              insert_handler&& handler) const
  {
    return insert(
      std::move(document_id), encode_document<Transcoder>(document), options, std::move(handler));
  }

  /**
   * Inserts an encoded body of the document which does not exist yet with custom options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  [[nodiscard]] auto insert(std::string document_id,
                            codec::encoded_value document,
                            const insert_options& options) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Inserts a full document which does not exist yet with custom options.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to insert.
   * @param options custom options to customize the insert behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_exists the given document id is already present in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  [[nodiscard]] auto insert(std::string document_id,
                            const Document& document,
                            const insert_options& options = {}) const
    -> std::future<std::pair<error, mutation_result>>
  {
    return insert(std::move(document_id), encode_document<Transcoder>(document), options);
  }

  /**
   * Replaces a body of the document which already exists with specified encoded body.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @param handler callable that implements @ref upsert_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  void replace(std::string document_id,
               codec::encoded_value document,
               const replace_options& options,
               replace_handler&& handler) const;

  /**
   * Replaces a full document which already exists.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to replace.
   * @param options custom options to customize the replace behavior.
   * @param handler callable that implements @ref replace_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  void replace(std::string document_id,
               Document document,
               const replace_options& options,
               replace_handler&& handler) const
  {
    return replace(
      std::move(document_id), encode_document<Transcoder>(document), options, std::move(handler));
  }

  /**
   * Replaces a body of the document which already exists with specified encoded body.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the encoded content of the document to upsert.
   * @param options custom options to customize the upsert behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @uncommitted
   */
  [[nodiscard]] auto replace(std::string document_id,
                             codec::encoded_value document,
                             const replace_options& options) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Replaces a full document which already exists.
   *
   * @tparam Transcoder type of the transcoder that will be used to encode the document
   * @tparam Document type of the document
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param document the document content to replace.
   * @param options custom options to customize the replace behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  template<typename Transcoder = codec::default_json_transcoder,
           typename Document,
           std::enable_if_t<!std::is_same_v<codec::encoded_value, Document>, bool> = true>
  [[nodiscard]] auto replace(std::string document_id,
                             const Document& document,
                             const replace_options& options = {}) const
    -> std::future<std::pair<error, mutation_result>>
  {
    return replace(std::move(document_id), encode_document<Transcoder>(document), options);
  }

  /**
   * Removes a Document from a collection.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the remove behavior.
   * @param handler callable that implements @ref remove_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void remove(std::string document_id,
              const remove_options& options,
              remove_handler&& handler) const;

  /**
   * Removes a Document from a collection.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the remove behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto remove(std::string document_id, const remove_options& options = {}) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Performs mutations to document fragments
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param specs the spec which specifies the type of mutations to perform.
   * @param options custom options to customize the mutate_in behavior.
   * @param handler callable that implements @ref mutate_in_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::key_value::document_exists the given document id is already present in the
   * collection and insert is was selected.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void mutate_in(std::string document_id,
                 const mutate_in_specs& specs,
                 const mutate_in_options& options,
                 mutate_in_handler&& handler) const;

  /**
   * Performs mutations to document fragments
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param specs the spec which specifies the type of mutations to perform.
   * @param options custom options to customize the mutate_in behavior.
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::key_value::document_exists the given document id is already present in the
   * collection and insert is was selected.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto mutate_in(std::string document_id,
                               const mutate_in_specs& specs,
                               const mutate_in_options& options = {}) const
    -> std::future<std::pair<error, mutate_in_result>>;

  /**
   * Performs lookups to document fragments with default options.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @param handler callable that implements @ref lookup_in_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void lookup_in(std::string document_id,
                 const lookup_in_specs& specs,
                 const lookup_in_options& options,
                 lookup_in_handler&& handler) const;

  /**
   * Performs lookups to document fragments with default options.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto lookup_in(std::string document_id,
                               const lookup_in_specs& specs,
                               const lookup_in_options& options = {}) const
    -> std::future<std::pair<error, lookup_in_result>>;

  /**
   * Performs lookups to document fragments with default options from all replicas and the active
   * node and returns the result as a vector.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @param handler callable that implements @ref lookup_in_all_replicas_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void lookup_in_all_replicas(std::string document_id,
                              const lookup_in_specs& specs,
                              const lookup_in_all_replicas_options& options,
                              lookup_in_all_replicas_handler&& handler) const;

  /**
   * Performs lookups to document fragments with default options from all replicas and the active
   * node and returns the result as a vector.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto lookup_in_all_replicas(std::string document_id,
                                            const lookup_in_specs& specs,
                                            const lookup_in_all_replicas_options& options = {})
    const -> std::future<std::pair<error, lookup_in_all_replicas_result>>;

  /**
   * Performs lookups to document fragments with default options from all replicas and returns the
   * first found.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @param handler callable that implements @ref lookup_in_any_replica_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void lookup_in_any_replica(std::string document_id,
                             const lookup_in_specs& specs,
                             const lookup_in_any_replica_options& options,
                             lookup_in_any_replica_handler&& handler) const;

  /**
   * Performs lookups to document fragments with default options from all replicas and returns the
   * first found.
   *
   * @param document_id the outer document ID
   * @param specs an object that specifies the types of lookups to perform
   * @param options custom options to modify the lookup options
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto lookup_in_any_replica(std::string document_id,
                                           const lookup_in_specs& specs,
                                           const lookup_in_any_replica_options& options = {}) const
    -> std::future<std::pair<error, lookup_in_replica_result>>;

  /**
   * Gets a document for a given id and places a pessimistic lock on it for mutations
   *
   * @param document_id the id of the document
   * @param lock_duration the length of time the lock will be held on the document
   * @param options the options to customize
   * @param handler callable that implements @ref get_and_lock_handler
   *
   * @since 1.0.0
   * @committed
   */
  void get_and_lock(std::string document_id,
                    std::chrono::seconds lock_duration,
                    const get_and_lock_options& options,
                    get_and_lock_handler&& handler) const;

  /**
   * Gets a document for a given id and places a pessimistic lock on it for mutations
   *
   * @param document_id the id of the document
   * @param lock_duration the length of time the lock will be held on the document
   * @param options the options to customize
   * @return future object that carries result of the operation
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_and_lock(std::string document_id,
                                  std::chrono::seconds lock_duration,
                                  const get_and_lock_options& options = {}) const
    -> std::future<std::pair<error, get_result>>;

  /**
   * Unlocks a document if it has been locked previously, with default options.
   *
   * @param document_id the id of the document
   * @param cas the CAS value which is needed to unlock it
   * @param options the options to customize
   * @param handler callable that implements @ref unlock_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void unlock(std::string document_id,
              couchbase::cas cas,
              const unlock_options& options,
              unlock_handler&& handler) const;

  /**
   * Unlocks a document if it has been locked previously, with default options.
   *
   * @param document_id the id of the document
   * @param cas the CAS value which is needed to unlock it
   * @param options the options to customize
   * @return future object that carries result of the operation
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::cas_mismatch if the document has been concurrently modified on the
   * server.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto unlock(std::string document_id,
                            couchbase::cas cas,
                            const unlock_options& options = {}) const -> std::future<error>;

  /**
   * Checks if the document exists on the server.
   *
   * @param document_id the id of the document
   * @param options the options to customize
   * @param handler callable that implements @ref exists_handler
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void exists(std::string document_id,
              const exists_options& options,
              exists_handler&& handler) const;

  /**
   * Checks if the document exists on the server.
   *
   * @param document_id the id of the document
   * @param options the options to customize
   * @return future object that carries result of the operation
   *
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto exists(std::string document_id, const exists_options& options = {}) const
    -> std::future<std::pair<error, exists_result>>;

  /**
   * Performs a key-value scan operation on the collection.
   *
   * @param scan_type the type of the scan. Can be @ref range_scan, @ref prefix_scan or @ref
   * sampling_scan
   * @param options the options to customize
   * @param handler callable that implements @ref scan_handler
   *
   * @note Use this API for low concurrency batch queries where latency is not critical as the
   * system may have to scan a lot of documents to find the matching documents. For low latency
   * range queries, it is recommended that you use SQL++ with the necessary indexes.
   *
   * @since 1.0.0
   * @volatile
   */
  void scan(const scan_type& scan_type, const scan_options& options, scan_handler&& handler) const;

  /**
   * Performs a key-value scan operation on the collection.
   *
   * @param scan_type the type of the scan. Can be @ref range_scan, @ref prefix_scan or @ref
   * sampling_scan
   * @param options the options to customize
   * @return future object that carries result of the operation
   *
   * @note Use this API for low concurrency batch queries where latency is not critical as the
   * system may have to scan a lot of documents to find the matching documents. For low latency
   * range queries, it is recommended that you use SQL++ with the necessary indexes.
   *
   * @since 1.0.0
   * @volatile
   */
  [[nodiscard]] auto scan(const scan_type& scan_type, const scan_options& options = {}) const
    -> std::future<std::pair<error, scan_result>>;

  [[nodiscard]] auto query_indexes() const -> collection_query_index_manager;

private:
  friend class bucket;
  friend class scope;

  [[nodiscard]] auto crypto_manager() const -> const std::shared_ptr<crypto::manager>&;

  template<typename Transcoder, typename Document>
  [[nodiscard]] auto encode_document(const Document& document) const -> codec::encoded_value
  {
    if constexpr (codec::is_crypto_transcoder_v<Transcoder>) {
      return Transcoder::encode(document, crypto_manager());
    } else {
      return Transcoder::encode(document);
    }
  }

  collection(core::cluster core,
             std::string_view bucket_name,
             std::string_view scope_name,
             std::string_view name,
             std::shared_ptr<crypto::manager> crypto_manager);

  std::shared_ptr<collection_impl> impl_;
};
} // namespace couchbase
