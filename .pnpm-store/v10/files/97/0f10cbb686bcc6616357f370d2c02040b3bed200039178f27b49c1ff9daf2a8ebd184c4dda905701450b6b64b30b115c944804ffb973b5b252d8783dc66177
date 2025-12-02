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

#include <couchbase/search_row.hxx>

namespace couchbase
{
search_row::search_row(internal_search_row internal)
  : internal_{ std::make_unique<internal_search_row>(std::move(internal)) }

{
}

search_row::~search_row() = default;
search_row::search_row(search_row&& other) noexcept = default;
auto
search_row::operator=(search_row&& other) noexcept -> search_row& = default;

auto
search_row::index() const -> const std::string&
{
  return internal_->index();
}

auto
search_row::id() const -> const std::string&
{
  return internal_->id();
}

auto
search_row::score() const -> double
{
  return internal_->score();
}

auto
search_row::fields() const -> const codec::binary&
{
  return internal_->fields();
}

auto
search_row::explanation() const -> const codec::binary&
{
  return internal_->explanation();
}

auto
search_row::locations() const -> const std::optional<search_row_locations>&
{
  return internal_->locations();
}

auto
search_row::fragments() const -> const std::map<std::string, std::vector<std::string>>&
{
  return internal_->fragments();
}
} // namespace couchbase
