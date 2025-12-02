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

#include "internal_search_result.hxx"

#include "core/operations/document_search.hxx"
#include "internal_date_range_facet_result.hxx"
#include "internal_numeric_range_facet_result.hxx"
#include "internal_search_meta_data.hxx"
#include "internal_search_row.hxx"
#include "internal_term_facet_result.hxx"

#include <couchbase/date_range_facet_result.hxx>
#include <couchbase/numeric_range_facet_result.hxx>
#include <couchbase/search_facet_result.hxx>
#include <couchbase/search_row.hxx>
#include <couchbase/term_facet_result.hxx>

#include <map>
#include <memory>
#include <string>
#include <vector>

namespace couchbase
{
namespace
{
auto
map_rows(const std::vector<core::operations::search_response::search_row>& rows)
  -> std::vector<couchbase::search_row>
{
  std::vector<couchbase::search_row> result{};
  result.reserve(rows.size());
  for (const auto& row : rows) {
    result.emplace_back(internal_search_row{ row });
  }
  return result;
}

auto
map_facets(const std::vector<core::operations::search_response::search_facet>& facets)
  -> std::map<std::string, std::shared_ptr<search_facet_result>>
{
  std::map<std::string, std::shared_ptr<search_facet_result>> result;

  for (const auto& facet : facets) {
    if (!facet.date_ranges.empty()) {
      result.try_emplace(
        facet.name,
        std::make_shared<date_range_facet_result>(internal_date_range_facet_result{ facet }));
    } else if (!facet.numeric_ranges.empty()) {
      result.try_emplace(
        facet.name,
        std::make_shared<numeric_range_facet_result>(internal_numeric_range_facet_result{ facet }));
    } else if (!facet.terms.empty()) {
      result.try_emplace(facet.name,
                         std::make_shared<term_facet_result>(internal_term_facet_result{ facet }));
    }
  }

  return result;
}
} // namespace

internal_search_result::internal_search_result(const core::operations::search_response& response)
  : meta_data_{ internal_search_meta_data{ response.meta } }
  , facets_{ map_facets(response.facets) }
  , rows_{ map_rows(response.rows) }
{
}

auto
internal_search_result::meta_data() const -> const search_meta_data&
{
  return meta_data_;
}

auto
internal_search_result::rows() const -> const std::vector<search_row>&
{
  return rows_;
}

auto
internal_search_result::facets() const
  -> const std::map<std::string, std::shared_ptr<search_facet_result>>&
{
  return facets_;
}
} // namespace couchbase
