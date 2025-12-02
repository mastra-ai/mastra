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

#include "encoded_search_facet.hxx"

#include <couchbase/error_codes.hxx>
#include <couchbase/numeric_range_facet.hxx>

namespace couchbase
{
auto
numeric_range_facet::encode() const -> encoded_search_facet
{
  encoded_search_facet built;
  built.facet = {
    { "field", field_ },
  };
  if (size_) {
    built.facet["size"] = size_.value();
  }
  if (ranges_.empty()) {
    return { errc::common::invalid_argument };
  }
  tao::json::value ranges = tao::json::empty_array;
  for (const auto& range : ranges_) {
    tao::json::value entry = {
      { "field", range.name() },
    };
    if (const auto& min = range.min(); min.has_value()) {
      entry["min"] = min.value();
    }
    if (const auto& max = range.max(); max.has_value()) {
      entry["max"] = max;
    }
    ranges.emplace_back(entry);
  }
  built.facet["numeric_ranges"] = ranges;
  return built;
}
} // namespace couchbase
