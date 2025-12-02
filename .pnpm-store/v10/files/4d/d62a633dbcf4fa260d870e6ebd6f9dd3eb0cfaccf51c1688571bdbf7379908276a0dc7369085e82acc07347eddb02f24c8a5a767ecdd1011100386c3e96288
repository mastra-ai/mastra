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

#include "internal_search_row.hxx"

#include "internal_search_row_location.hxx"
#include "internal_search_row_locations.hxx"

#include "core/utils/binary.hxx"

#include <utility>

namespace couchbase
{

internal_search_row::internal_search_row(core::operations::search_response::search_row row)
  : row_{ std::move(row) }
  , fields_{ core::utils::to_binary(row_.fields) }
  , explanation_{ core::utils::to_binary(row_.explanation) }
  , fragments_{ row_.fragments }
{
  if (!row_.locations.empty()) {
    locations_.emplace(internal_search_row_locations{ row_.locations });
  }
}

internal_search_row::internal_search_row(internal_search_row&& other) noexcept = default;

auto
internal_search_row::operator=(internal_search_row&& other) noexcept
  -> internal_search_row& = default;

auto
internal_search_row::index() const -> const std::string&
{
  return row_.index;
}

auto
internal_search_row::id() const -> const std::string&
{
  return row_.id;
}

auto
internal_search_row::score() const -> double
{
  return row_.score;
}

auto
internal_search_row::fields() const -> const codec::binary&
{
  return fields_;
}

auto
internal_search_row::explanation() const -> const codec::binary&
{
  return explanation_;
}

auto
internal_search_row::fragments() const -> const std::map<std::string, std::vector<std::string>>&
{
  return fragments_;
}

auto
internal_search_row::locations() const -> const std::optional<search_row_locations>&
{
  return locations_;
}
} // namespace couchbase
