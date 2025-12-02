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

#include <couchbase/date_range_facet_result.hxx>
#include <couchbase/numeric_range_facet_result.hxx>
#include <couchbase/search_meta_data.hxx>
#include <couchbase/search_row.hxx>
#include <couchbase/term_facet_result.hxx>

#include <chrono>
#include <cinttypes>
#include <optional>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_search_result;
#endif

/**
 * Represents result of @ref cluster#search() and @ref scope#search()
 * calls.
 *
 * @since 1.0.0
 * @committed
 */
class search_result
{
public:
  search_result();
  /**
   * @since 1.0.0
   * @volatile
   */
  explicit search_result(internal_search_result internal);
  ~search_result();

  search_result(const search_result&) = delete;
  search_result& operator=(const search_result&) = delete;

  search_result(search_result&&) noexcept;
  search_result& operator=(search_result&&) noexcept;

  /**
   * Returns the {@link search_meta_data} giving access to the additional metadata associated with
   * this search.
   *
   * @return response metadata
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto meta_data() const -> const search_meta_data&;

  [[nodiscard]] auto rows() const -> const std::vector<search_row>&;

  [[nodiscard]] auto facets() const
    -> const std::map<std::string, std::shared_ptr<search_facet_result>>&;

private:
  std::unique_ptr<internal_search_result> internal_;
};
} // namespace couchbase
