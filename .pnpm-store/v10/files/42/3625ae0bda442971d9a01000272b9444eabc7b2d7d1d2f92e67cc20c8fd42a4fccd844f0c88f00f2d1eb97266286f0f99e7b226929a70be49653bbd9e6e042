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
#include <couchbase/error_codes.hxx>

#include <optional>
#include <string>

namespace couchbase
{
class drop_primary_query_index_options : public common_options<drop_primary_query_index_options>
{
public:
  /**
   * Name of the primary index
   *
   * If created with an optional name, specify that here as well.
   * @param index_name
   * @return reference to this object, for use in chaining.
   */
  auto index_name(std::string index_name) -> drop_primary_query_index_options&
  {
    index_name_.emplace(index_name);
    return self();
  }
  /**
   * Set flag to ignore error if the index already exists
   *
   * The default is to not ignore the error.
   *
   * @param ignore_if_not_exists  if true, we don't return an error if the index already exists
   * @return reference to this object, for use in chaining.
   *
   * @since 1.0.0
   * @committed
   */
  auto ignore_if_not_exists(bool ignore_if_not_exists) -> drop_primary_query_index_options&
  {
    ignore_if_not_exists_ = ignore_if_not_exists;
    return self();
  }
  /**
   * Immutable value object representing consistent options.
   *
   * @since 1.0.0
   * @internal
   */
  struct built : public common_options<drop_primary_query_index_options>::built {
    std::optional<std::string> index_name;
    bool ignore_if_not_exists{};
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
    return { build_common_options(), index_name_, ignore_if_not_exists_ };
  }

private:
  std::optional<std::string> index_name_{};
  bool ignore_if_not_exists_{ false };
};

/**
 * The signature for the handler of the @ref query_index_manager#get_all_indexes() operation
 *
 * @since 1.0.0
 * @uncommitted
 */

using drop_primary_query_index_handler = std::function<void(error)>;
} // namespace couchbase
