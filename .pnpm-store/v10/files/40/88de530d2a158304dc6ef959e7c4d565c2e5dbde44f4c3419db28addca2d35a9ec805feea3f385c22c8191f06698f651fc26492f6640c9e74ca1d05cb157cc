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

#include <couchbase/search_query.hxx>

#include <optional>
#include <string>

namespace couchbase
{
/**
 * The prefix query finds documents containing terms that start with the provided prefix. Usual
 * better alternative is
 * @ref match_query.
 *
 * Match documents where field `reviews.content` contains words starting with `"inter"`:
 * @snippet{trimleft} test_unit_search.cxx search-prefix
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-prefix-query.html server
 * documentation
 *
 * @since 1.0.0
 * @committed
 */
class prefix_query : public search_query
{
public:
  /**
   * Create a new prefix query.
   *
   * @param prefix prefix to match
   *
   * @since 1.0.0
   * @committed
   */
  explicit prefix_query(std::string prefix)
    : prefix_{ std::move(prefix) }
  {
  }

  /**
   * If a field is specified, only terms in that field will be matched.
   *
   * @param field_name name of the field to be matched
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto field(std::string field_name) -> prefix_query&
  {
    field_ = std::move(field_name);
    return *this;
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query override;

private:
  std::string prefix_;
  std::optional<std::string> field_{};
};
} // namespace couchbase
