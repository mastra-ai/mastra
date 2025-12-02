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

#include "internal_search_row_locations.hxx"

#include "internal_search_row_location.hxx"

#include <couchbase/search_row_locations.hxx>

namespace couchbase
{
search_row_locations::search_row_locations(internal_search_row_locations internal)
  : internal_{ std::make_unique<internal_search_row_locations>(std::move(internal)) }
{
}

search_row_locations::~search_row_locations() = default;
search_row_locations::search_row_locations(search_row_locations&& other) noexcept = default;
auto
search_row_locations::operator=(search_row_locations&& other) noexcept
  -> search_row_locations& = default;

auto
search_row_locations::get(const std::string& field) const -> std::vector<search_row_location>
{
  return internal_->get(field);
}

auto
search_row_locations::get(const std::string& field,
                          const std::string& term) const -> std::vector<search_row_location>
{
  return internal_->get(field, term);
}

auto
search_row_locations::get_all() const -> std::vector<search_row_location>
{
  return internal_->get_all();
}

auto
search_row_locations::fields() const -> std::vector<std::string>
{
  return internal_->fields();
}

auto
search_row_locations::terms() const -> std::set<std::string>
{
  return internal_->terms();
}

auto
search_row_locations::terms_for(const std::string& field) const -> std::vector<std::string>
{
  return internal_->terms_for(field);
}
} // namespace couchbase
