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

#include <cstdint>
#include <optional>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
struct encoded_search_query;
#endif

/**
 * Base class for full text search queries.
 */
class search_query
{
public:
  virtual ~search_query() = default;

  /**
   * The boost parameter is used to increase the relative weight of a clause (with a boost greater
   * than 1) or decrease the relative weight (with a boost between 0 and 1).
   *
   * @param boost boost value
   * @tparam derived_query by default it returns `this` as @ref search_query, but it can also
   * down-cast to derived query class.
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  template<typename derived_query = search_query,
           std::enable_if_t<std::is_base_of_v<search_query, derived_query>, bool> = true>
  auto boost(double boost) -> derived_query&
  {
    boost_ = boost;
    return *static_cast<derived_query*>(this);
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] virtual auto encode() const -> encoded_search_query = 0;

protected:
  search_query() = default;

  std::optional<double> boost_{};
};
} // namespace couchbase
