/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

namespace couchbase
{
enum class vector_query_combination {
  combination_and,
  combination_or
};

/**
 * Options related to executing a @ref vector_search
 *
 * @since 1.0.0
 * @volatile
 */
struct vector_search_options {

  /**
   * Immutable value object representing consistent options
   *
   * @since 1.0.0
   * @internal
   */
  struct built {
    std::optional<vector_query_combination> combination;
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
    return { combination_ };
  }

  /**
   * Sets how the vector query results are combined.
   *
   * @param combination @ref vector_query_combination
   * @return this for chaining purposes
   *
   * @since 1.0.0
   * @volatile
   *
   */
  auto query_combination(vector_query_combination combination) -> vector_search_options&
  {
    combination_ = combination;
    return *this;
  }

private:
  std::optional<vector_query_combination> combination_{};
};
} // namespace couchbase
