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

#include "internal_date_range_facet_result.hxx"
#include "internal_numeric_range_facet_result.hxx"
#include "internal_search_meta_data.hxx"
#include "internal_search_row.hxx"
#include "internal_search_row_location.hxx"
#include "internal_search_row_locations.hxx"
#include "internal_term_facet_result.hxx"

#include <couchbase/search_result.hxx>

namespace couchbase
{
search_result::search_result()
  : internal_{ nullptr }
{
}

search_result::search_result(internal_search_result internal)
  : internal_{ std::make_unique<internal_search_result>(std::move(internal)) }
{
}

search_result::~search_result() = default;

auto
search_result::operator=(search_result&&) noexcept -> search_result& = default;

search_result::search_result(search_result&&) noexcept = default;

auto
search_result::meta_data() const -> const search_meta_data&
{
  return internal_->meta_data();
}

auto
search_result::rows() const -> const std::vector<search_row>&
{
  return internal_->rows();
}

auto
search_result::facets() const -> const std::map<std::string, std::shared_ptr<search_facet_result>>&
{
  return internal_->facets();
}
} // namespace couchbase
