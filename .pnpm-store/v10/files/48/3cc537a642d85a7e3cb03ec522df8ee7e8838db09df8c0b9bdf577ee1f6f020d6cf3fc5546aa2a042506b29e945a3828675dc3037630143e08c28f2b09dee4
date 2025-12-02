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

#include "key_value_error_context.hxx"

namespace couchbase::core
{
/**
 * The error context returned with subdocument key/value operations.
 *
 * @since 1.0.0
 * @committed
 */
class subdocument_error_context : public key_value_error_context
{
public:
  /**
   * Creates empty error context
   *
   * @since 1.0.0
   * @committed
   */
  subdocument_error_context() = default;

  /**
   * Creates and initializes error context with given parameters.
   *
   * @param operation_id
   * @param ec
   * @param last_dispatched_to
   * @param last_dispatched_from
   * @param retry_attempts
   * @param retry_reasons
   * @param id
   * @param bucket
   * @param scope
   * @param collection
   * @param opaque
   * @param status_code
   * @param cas
   * @param error_map_info
   * @param extended_error_info
   * @param first_error_path
   * @param first_error_index
   * @param deleted
   *
   * @since 1.0.0
   * @internal
   */
  subdocument_error_context(std::string operation_id,
                            std::error_code ec,
                            std::optional<std::string> last_dispatched_to,
                            std::optional<std::string> last_dispatched_from,
                            std::size_t retry_attempts,
                            std::set<retry_reason> retry_reasons,
                            std::string id,
                            std::string bucket,
                            std::string scope,
                            std::string collection,
                            std::uint32_t opaque,
                            std::optional<key_value_status_code> status_code,
                            couchbase::cas cas,
                            std::optional<key_value_error_map_info> error_map_info,
                            std::optional<key_value_extended_error_info> extended_error_info,
                            std::optional<std::string> first_error_path,
                            std::optional<std::uint64_t> first_error_index,
                            bool deleted)
    : key_value_error_context{ std::move(operation_id),
                               ec,
                               std::move(last_dispatched_to),
                               std::move(last_dispatched_from),
                               retry_attempts,
                               std::move(retry_reasons),
                               std::move(id),
                               std::move(bucket),
                               std::move(scope),
                               std::move(collection),
                               opaque,
                               status_code,
                               cas,
                               std::move(error_map_info),
                               std::move(extended_error_info) }
    , first_error_path_{ std::move(first_error_path) }
    , first_error_index_{ first_error_index }
    , deleted_{ deleted }
  {
  }

  /**
   * Returns path of the operation that generated first error
   *
   * @return subdocument path
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto first_error_path() const -> const std::optional<std::string>&
  {
    return first_error_path_;
  }

  /**
   * Returns index of the operation that generated first error
   *
   * @return spec index
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto first_error_index() const -> const std::optional<std::size_t>&
  {
    return first_error_index_;
  }

  /**
   * @return true if the document has been deleted
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto deleted() const -> bool
  {
    return deleted_;
  }

private:
  std::optional<std::string> first_error_path_{};
  std::optional<std::size_t> first_error_index_{};
  bool deleted_{};
};
} // namespace couchbase::core
