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

#include <couchbase/geo_point.hxx>
#include <couchbase/search_geo_distance_units.hxx>
#include <couchbase/search_sort.hxx>

#include <string>

namespace couchbase
{
/**
 * Sorts by location in the hits
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-search-request.html#sorting-with-objects
 *
 * @since 1.0.0
 */
class search_sort_geo_distance : public search_sort
{
public:
  search_sort_geo_distance(geo_point location, std::string field)
    : location_{ location }
    , field_{ std::move(field) }
  {
  }

  search_sort_geo_distance(double latitude, double longitude, std::string field)
    : location_{ geo_point{ latitude, longitude } }
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
  auto descending(bool desc) -> search_sort_geo_distance&;

  /**
   * Specifies the unit used for sorting
   *
   * @param unit the unit used
   *
   * @since 1.0.0
   * @committed
   */
  auto unit(search_geo_distance_units unit) -> search_sort_geo_distance&;

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_sort override;

private:
  geo_point location_;
  std::string field_;
  std::optional<search_geo_distance_units> unit_;
};
} // namespace couchbase
