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

#include <functional>
#include <optional>
#include <string>

namespace couchbase
{
/**
 * Options for query_index_manager#build_deferred_indexes().
 *
 * @since 1.0.0
 * @committed
 */
class build_query_index_options : public common_options<build_query_index_options>
{
public:
  struct built : public common_options<build_query_index_options>::built {
    const std::optional<std::string> scope_name{};
    const std::optional<std::string> collection_name{};
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

    return { build_common_options() };
  }
};

/**
 * The signature for the handler of the @ref query_index_manager#build_deferred_indexes() operation
 *
 * @since 1.0.0
 * @uncommitted
 */
using build_deferred_query_indexes_handler = std::function<void(error)>;
} // namespace couchbase
