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

#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/error_codes.hxx>

#include <optional>
#include <string>

namespace couchbase
{
class create_query_index_options : public common_options<create_query_index_options>
{
public:
  /**
   * Set flag to ignore error if the index already exists
   *
   * The default is to not ignore the error.
   *
   * @param ignore_if_exists  if true, we don't return an error if the index already exists
   * @return reference to this object, for use in chaining.
   *
   * @since 1.0.0
   * @committed
   */
  auto ignore_if_exists(bool ignore_if_exists) -> create_query_index_options&
  {
    ignore_if_exists_ = ignore_if_exists;
    return self();
  }
  /**
   * Set flag to defer building of the index
   *
   * The default is false, meaning start building the index immediately.
   *
   * @param deferred
   * @return reference to this object, for use in chaining.
   *
   * @since 1.0.0
   * @committed
   */
  auto build_deferred(bool deferred) -> create_query_index_options&
  {
    deferred_ = deferred;
    return self();
  }

  /**
   * Set the number of replicas the index will have.
   *
   *
   * @param num_replicas
   * @return reference to this object, for use in chaining.
   *
   * @since 1.0.0
   * @committed
   */
  auto num_replicas(uint8_t num_replicas) -> create_query_index_options&
  {
    num_replicas_ = num_replicas;
    return self();
  }
  /**
   * Supply an extra condition on this index.
   *
   * This is the contents of the WHERE clause when creating the index.
   *
   * @param condition
   * @return reference to this object, for use in chaining.
   */
  auto condition(std::string condition) -> create_query_index_options&
  {
    condition_.emplace(std::move(condition));
    return self();
  }

  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<create_query_index_options>::built {
    bool ignore_if_exists{};
    bool deferred{};
    std::optional<std::string> condition{};
    std::optional<uint8_t> num_replicas{};
  };

  /**
   * Validates options and returns them as an immutable value.
   *
   * @return consistent options as an immutable value
   *
   * @exception std::system_error with code errc::common::invalid_argument if the options are not
   * valid
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto build() const -> built
  {
    return { build_common_options(), ignore_if_exists_, deferred_, condition_, num_replicas_ };
  }

private:
  std::optional<std::string> scope_name_{};
  std::optional<std::string> collection_name_{};
  bool ignore_if_exists_{ false };
  bool deferred_{ false };
  std::optional<uint8_t> num_replicas_{};
  std::optional<std::string> condition_{};
};

/**
 * The signature for the handler of the @ref query_index_manager#get_all_indexes() operation
 *
 * @since 1.0.0
 * @uncommitted
 */

using create_query_index_handler = std::function<void(error)>;
} // namespace couchbase
