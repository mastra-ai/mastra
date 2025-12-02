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
#include <couchbase/search_sort_field_missing.hxx>
#include <couchbase/search_sort_field_mode.hxx>
#include <couchbase/search_sort_field_type.hxx>

#include <string>

namespace couchbase
{
/**
 * Sorts by a field in the hits.
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-search-request.html#sorting-with-objects
 *
 * @since 1.0.0
 */
class search_sort_field : public search_sort
{
public:
  explicit search_sort_field(std::string field)
    : field_{ std::move(field) }
  {
  }

  search_sort_field(std::string field, bool descending)
    : search_sort{ descending }
    , field_{ std::move(field) }
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
  auto descending(bool desc) -> search_sort_field&;

  /**
   * Specifies the type of the search-order field value.
   *
   * For example, @ref search_sort_field_type::string for text fields, @ref
   * search_sort_field_type::date for DateTime fields, or @ref search_sort_field_type::number for
   * numeric/geo fields.
   *
   * @param value field type
   * @return pointer to this
   *
   * @since 1.0.0
   * @committed
   */
  auto type(search_sort_field_type value) -> search_sort_field&;

  /**
   * Specifies the search-order for index-fields that contain multiple values (in consequence of
   * arrays or multi-token analyzer-output).
   *
   * The default order is undefined but deterministic, allowing the paging of results, with reliable
   * ordering. To sort using the minimum or maximum value, the value of mode should be set to either
   * @ref search_sort_field_mode::min or
   * @ref search_sort_field_mode::max.
   *
   * @param value strategy for multi-value fields.
   * @return pointer to this
   *
   * @since 1.0.0
   * @committed
   */
  auto mode(search_sort_field_mode value) -> search_sort_field&;

  /**
   * Specifies the sort-procedure for documents with a missing value in a field specified for
   * sorting.
   *
   * The value of missing can be @ref search_sort_field_missing::first, in which case results with
   * missing values appear before other results; or @ref search_sort_field_missing::last (the server
   * default), in which case they appear after.
   *
   * @param value strategy for missing values
   * @return pointer to this
   *
   * @since 1.0.0
   * @committed
   */
  auto missing(search_sort_field_missing value) -> search_sort_field&;

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_sort override;

private:
  std::string field_;
  std::optional<search_sort_field_type> type_{};
  std::optional<search_sort_field_mode> mode_{};
  std::optional<search_sort_field_missing> missing_{};
};
} // namespace couchbase
