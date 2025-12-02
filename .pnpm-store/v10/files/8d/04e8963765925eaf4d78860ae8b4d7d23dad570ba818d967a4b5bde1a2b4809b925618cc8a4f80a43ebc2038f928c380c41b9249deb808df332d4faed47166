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

#include <couchbase/search_sort.hxx>

namespace couchbase
{
/**
 * Sorts by the hit score.
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-search-request.html#sorting-with-objects
 *
 * @since 1.0.0
 */
class search_sort_score : public search_sort
{
public:
  search_sort_score() = default;

  explicit search_sort_score(bool descending)
    : search_sort{ descending }
  {
  }

  /**
   * Set the sorting direction.
   *
   * @param desc `true` for descending order, `false` for ascending
   * @return pointer to this
   *
   * @since 1.0.0
   * @committed
   */
  auto descending(bool desc) -> search_sort_score&;

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_sort override;
};
} // namespace couchbase
