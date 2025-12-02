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

#include <optional>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
struct encoded_search_sort;
#endif

/**
 * Base class for full text sort objects of search queries.
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-search-request.html#sorting-with-objects
 *
 * @since 1.0.0
 */
class search_sort
{
public:
  virtual ~search_sort() = default;

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] virtual auto encode() const -> encoded_search_sort = 0;

protected:
  search_sort() = default;

  explicit search_sort(bool descending)
    : descending_{ descending }
  {
  }

  std::optional<bool> descending_{};
};
} // namespace couchbase
