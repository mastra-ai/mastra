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
#include <couchbase/search_query.hxx>

#include <optional>
#include <string>

namespace couchbase
{
/**
 * This query finds all matches from a given location as @ref geo_point within the given distance.
 * Both the point and the distance are required.
 *
 * The following query specifies a longitude of `-2.235143` and a latitude of `53.482358`. The
 * target-field `geo` is specified, as is a distance of `100 miles`: this is the radius within which
 * target-locations must reside for their documents to be returned.
 * @snippet{trimleft} test_unit_search.cxx search-geo-distance
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-geo-point-distance.html
 * server documentation
 *
 * @since 1.0.0
 * @committed
 */
class geo_distance_query : public search_query
{
public:
  /**
   * Create a new geo distance query.
   *
   * @param location the location represents a point from which the distance is measured.
   * @param distance the distance describes how far from the location the radius should be matched.
   * For example,
   * `"11km"`,
   * `"11kilometers"`, `"3nm"`, `"3nauticalmiles"`, `"17mi"`, `"17miles"`, `"19m"`, `"19meters"`.
   *
   * @see
   * https://github.com/blevesearch/bleve/blob/ae28975038cb25655da968e3f043210749ba382b/geo/geo_dist.go#L29-L37
   * list of distance units.
   *
   * @since 1.0.0
   * @committed
   */
  geo_distance_query(geo_point location, std::string distance)
    : location_{ location }
    , distance_{ std::move(distance) }
  {
  }

  /**
   * Create a new geo distance query.
   *
   * @param latitude the location latitude
   * @param longitude the location longitude
   * @param distance the distance describes how far from the location the radius should be matched.
   * For example,
   * `"11km"`,
   * `"11kilometers"`, `"3nm"`, `"3nauticalmiles"`, `"17mi"`, `"17miles"`, `"19m"`, `"19meters"`.
   *
   * @since 1.0.0
   * @committed
   */
  geo_distance_query(double latitude, double longitude, std::string distance)
    : location_{ geo_point{ latitude, longitude } }
    , distance_{ std::move(distance) }
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
  auto field(std::string field_name) -> geo_distance_query&
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
  geo_point location_;
  std::string distance_;
  std::optional<std::string> field_{};
};
} // namespace couchbase
