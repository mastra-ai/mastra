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

#include "internal_search_row_location.hxx"

#include <couchbase/search_row_location.hxx>

namespace couchbase
{
search_row_location::search_row_location(internal_search_row_location internal)
  : internal_{ std::make_unique<internal_search_row_location>(std::move(internal)) }
{
}

search_row_location::search_row_location()
  : internal_{ nullptr }
{
}

search_row_location::~search_row_location() = default;

search_row_location::search_row_location(search_row_location&&) noexcept = default;

auto
search_row_location::operator=(couchbase::search_row_location&&) noexcept
  -> search_row_location& = default;

auto
search_row_location::field() const -> const std::string&
{
  return internal_->location.field;
}

auto
search_row_location::term() const -> const std::string&
{
  return internal_->location.term;
}

auto
search_row_location::position() const -> const std::uint64_t&
{
  return internal_->location.position;
}

auto
search_row_location::start_offset() const -> const std::uint64_t&
{
  return internal_->location.start_offset;
}

auto
search_row_location::end_offset() const -> const std::uint64_t&
{
  return internal_->location.end_offset;
}

auto
search_row_location::array_positions() const -> const std::optional<std::vector<std::uint64_t>>&
{
  return internal_->location.array_positions;
}
} // namespace couchbase
