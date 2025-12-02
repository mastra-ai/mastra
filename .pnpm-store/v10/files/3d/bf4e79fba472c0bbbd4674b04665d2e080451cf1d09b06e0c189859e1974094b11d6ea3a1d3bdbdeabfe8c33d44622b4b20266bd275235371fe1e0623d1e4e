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

#include "encoded_search_sort.hxx"

#include <couchbase/search_sort_geo_distance.hxx>

namespace couchbase
{
auto
search_sort_geo_distance::descending(bool desc) -> search_sort_geo_distance&
{
  descending_ = desc;
  return *this;
}

auto
search_sort_geo_distance::unit(couchbase::search_geo_distance_units unit)
  -> search_sort_geo_distance&
{
  unit_ = unit;
  return *this;
}

auto
search_sort_geo_distance::encode() const -> encoded_search_sort
{
  encoded_search_sort built;
  built.sort = {
    { "by", "geo_distance" },
    { "field", field_ },
  };
  built.sort["location"] = {
    { "lat", location_.latitude },
    { "lon", location_.longitude },
  };
  if (const auto& desc = descending_; desc.has_value()) {
    built.sort["desc"] = desc.value();
  }

  if (const auto& unit = unit_; unit.has_value()) {
    switch (unit.value()) {
      case search_geo_distance_units::meters:
        built.sort["unit"] = "meters";
        break;
      case search_geo_distance_units::miles:
        built.sort["unit"] = "miles";
        break;
      case search_geo_distance_units::centimeters:
        built.sort["unit"] = "centimeters";
        break;
      case search_geo_distance_units::millimeters:
        built.sort["unit"] = "millimeters";
        break;
      case search_geo_distance_units::nautical_miles:
        built.sort["unit"] = "nauticalmiles";
        break;
      case search_geo_distance_units::kilometers:
        built.sort["unit"] = "kilometers";
        break;
      case search_geo_distance_units::feet:
        built.sort["unit"] = "feet";
        break;
      case search_geo_distance_units::yards:
        built.sort["unit"] = "yards";
        break;
      case search_geo_distance_units::inch:
        built.sort["unit"] = "inch";
        break;
    }
  }
  return built;
}
} // namespace couchbase
