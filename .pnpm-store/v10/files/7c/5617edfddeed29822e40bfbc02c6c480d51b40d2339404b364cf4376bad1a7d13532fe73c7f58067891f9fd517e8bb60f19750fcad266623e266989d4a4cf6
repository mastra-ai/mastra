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

#include "encoded_search_query.hxx"

#include <couchbase/geo_bounding_box_query.hxx>
#include <tao/json/type.hpp>

namespace couchbase
{
auto
geo_bounding_box_query::encode() const -> encoded_search_query
{
  encoded_search_query built;
  built.query = tao::json::empty_object;
  if (boost_) {
    built.query["boost"] = boost_.value();
  }
  if (field_) {
    built.query["field"] = field_.value();
  }
  built.query["top_left"] = {
    { "lat", top_left_.latitude },
    { "lon", top_left_.longitude },
  };
  built.query["bottom_right"] = {
    { "lat", bottom_right_.latitude },
    { "lon", bottom_right_.longitude },
  };

  return built;
}
} // namespace couchbase
