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

#include "internal_date_range_facet_result.hxx"

#include "core/operations/document_search.hxx"

#include <couchbase/search_date_range.hxx>

#include <cstdint>
#include <vector>

namespace couchbase
{

namespace
{
auto
map_ranges(const core::operations::search_response::search_facet& facet)
  -> std::vector<search_date_range>
{
  std::vector<search_date_range> ranges;
  ranges.reserve(facet.date_ranges.size());

  for (const auto& range : facet.date_ranges) {
    ranges.emplace_back(range.name, range.start, range.end, range.count);
  }

  return ranges;
}
} // namespace

internal_date_range_facet_result::internal_date_range_facet_result(
  const core::operations::search_response::search_facet& facet)
  : name_{ facet.name }
  , field_{ facet.field }
  , total_{ facet.total }
  , missing_{ facet.missing }
  , other_{ facet.other }
  , ranges_{ map_ranges(facet) }
{
}

auto
internal_date_range_facet_result::name() const -> const std::string&
{
  return name_;
}
auto
internal_date_range_facet_result::field() const -> const std::string&
{
  return field_;
}

auto
internal_date_range_facet_result::total() const -> std::uint64_t
{
  return total_;
}

auto
internal_date_range_facet_result::missing() const -> std::uint64_t
{
  return missing_;
}

auto
internal_date_range_facet_result::other() const -> std::uint64_t
{
  return other_;
}

auto
internal_date_range_facet_result::date_ranges() const -> const std::vector<search_date_range>&
{
  return ranges_;
}
} // namespace couchbase
