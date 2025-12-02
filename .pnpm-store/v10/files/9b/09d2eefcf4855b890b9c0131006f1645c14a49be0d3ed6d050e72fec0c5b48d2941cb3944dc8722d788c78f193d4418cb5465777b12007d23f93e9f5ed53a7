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

#include <couchbase/append_options.hxx>
#include <couchbase/decrement_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/increment_options.hxx>
#include <couchbase/prepend_options.hxx>

#include <future>
#include <memory>

namespace couchbase
{
class collection;
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core
{
class cluster;
} // namespace core
class binary_collection_impl;
#endif

/**
 * Allows to perform certain operations on non-JSON documents.
 *
 * @since 1.0.0
 * @committed
 */
class binary_collection
{
public:
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
   * Appends binary content to the document.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param data the document content to append.
   * @param options custom options to customize the append behavior.
   * @param handler callable that implements @ref append_handler
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
  void append(std::string document_id,
              std::vector<std::byte> data,
              const append_options& options,
              append_handler&& handler) const;

  /**
   * Appends binary content to the document.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param data the document content to append.
   * @param options custom options to customize the append behavior.
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
  [[nodiscard]] auto append(std::string document_id,
                            std::vector<std::byte> data,
                            const append_options& options) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Prepends binary content to the document.
   *
   * @tparam Handler type of the handler that implements @ref prepend_handler
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param data the document content to prepend.
   * @param options custom options to customize the prepend behavior.
   * @param handler callable that implements @ref prepend_handler
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
  void prepend(std::string document_id,
               std::vector<std::byte> data,
               const prepend_options& options,
               prepend_handler&& handler) const;

  /**
   * Prepends binary content to the document.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param data the document content to prepend.
   * @param options custom options to customize the prepend behavior.
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
  [[nodiscard]] auto prepend(std::string document_id,
                             std::vector<std::byte> data,
                             const prepend_options& options) const
    -> std::future<std::pair<error, mutation_result>>;

  /**
   * Increments the counter document by one or the number defined in the options.
   *
   * @tparam Handler type of the handler that implements @ref increment_handler
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the increment behavior.
   * @param handler callable that implements @ref increment_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void increment(std::string document_id,
                 const increment_options& options,
                 increment_handler&& handler) const;

  /**
   * Increments the counter document by one or the number defined in the options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the increment behavior.
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
  [[nodiscard]] auto increment(std::string document_id, const increment_options& options) const
    -> std::future<std::pair<error, counter_result>>;

  /**
   * Decrements the counter document by one or the number defined in the options.
   *
   * @tparam Handler type of the handler that implements @ref decrement_handler
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the decrement behavior.
   * @param handler callable that implements @ref decrement_handler
   *
   * @exception errc::key_value::document_not_found the given document id is not found in the
   * collection.
   * @exception errc::common::ambiguous_timeout
   * @exception errc::common::unambiguous_timeout
   *
   * @since 1.0.0
   * @committed
   */
  void decrement(std::string document_id,
                 const decrement_options& options,
                 decrement_handler&& handler) const;

  /**
   * Decrements the counter document by one or the number defined in the options.
   *
   * @param document_id the document id which is used to uniquely identify it.
   * @param options custom options to customize the decrement behavior.
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
  [[nodiscard]] auto decrement(std::string document_id, const decrement_options& options) const
    -> std::future<std::pair<error, counter_result>>;

private:
  friend class collection;

  binary_collection(core::cluster core,
                    std::string_view bucket_name,
                    std::string_view scope_name,
                    std::string_view name);

  std::shared_ptr<binary_collection_impl> impl_;
};
} // namespace couchbase
