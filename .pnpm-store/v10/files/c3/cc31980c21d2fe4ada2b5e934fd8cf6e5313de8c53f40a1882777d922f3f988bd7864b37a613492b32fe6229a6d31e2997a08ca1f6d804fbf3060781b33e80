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
 * This query finds all @ref geo_point indexed matches within a given area (identified by the list
 * of @ref geo_point coordinates). Each of the pairs is taken to indicate one corner of a polygon.
 * Documents are returned if they reference a location within the area of the polygon.
 *
 * The following query-body uses an array of @ref geo_point to specify the latitude and longitude of
 * each of the corners of a polygon, known as polygon points. Here, the last-specified entry is
 * identical to the initial, thus explicitly closing the box. However, specifying an explicit
 * closure in this way is optional: the closure will be inferred by the Couchbase Server if not
 * explicitly specified.
 * @snippet{trimleft} test_unit_search.cxx search-geo-bounding-box
 *
 * @see
 * https://docs.couchbase.com/server/current/fts/fts-supported-queries-geo-bounded-rectangle.html
 * server documentation
 *
 * @since 1.0.0
 * @committed
 */
class geo_bounding_box_query : public search_query
{
public:
  /**
   * Create a new geo bounding box query.
   *
   * @param top_left the top left coordinates signify the bounding box area
   * @param bottom_right the bottom right coordinates signify the bounding box area
   *
   * @since 1.0.0
   * @committed
   */
  geo_bounding_box_query(geo_point top_left, geo_point bottom_right)
    : top_left_{ top_left }
    , bottom_right_{ bottom_right }
  {
  }

  /**
   * Create a new geo distance query.
   *
   * @param top_left_latitude  latitude of the top left coordinate
   * @param top_left_longitude  longitude of the top left coordinate
   * @param bottom_right_latitude  latitude of the bottom right coordinate
   * @param bottom_right_longitude  latitude of the bottom right coordinate
   *
   * @since 1.0.0
   * @committed
   */
  geo_bounding_box_query(double top_left_latitude,
                         double top_left_longitude,
                         double bottom_right_latitude,
                         double bottom_right_longitude)
    : top_left_{ geo_point{ top_left_latitude, top_left_longitude } }
    , bottom_right_{ geo_point{ bottom_right_latitude, bottom_right_longitude } }
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
  auto field(std::string field_name) -> geo_bounding_box_query&
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
  geo_point top_left_;
  geo_point bottom_right_;
  std::optional<std::string> field_{};
};
} // namespace couchbase
