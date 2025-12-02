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

#include <couchbase/search_sort_field.hxx>

namespace couchbase
{
auto
search_sort_field::descending(bool desc) -> search_sort_field&
{
  descending_ = desc;
  return *this;
}

auto
search_sort_field::type(search_sort_field_type value) -> search_sort_field&
{
  type_ = value;
  return *this;
}

auto
search_sort_field::mode(search_sort_field_mode value) -> search_sort_field&
{
  mode_ = value;
  return *this;
}

auto
search_sort_field::missing(search_sort_field_missing value) -> search_sort_field&
{
  missing_ = value;
  return *this;
}

auto
search_sort_field::encode() const -> encoded_search_sort
{
  encoded_search_sort built;
  built.sort = {
    { "by", "field" },
    { "field", field_ },
  };
  if (const auto& desc = descending_; desc.has_value()) {
    built.sort["desc"] = desc.value();
  }
  if (const auto& type = type_; type.has_value()) {
    switch (type.value()) {
      case search_sort_field_type::automatic:
        built.sort["type"] = "auto";
        break;
      case search_sort_field_type::string:
        built.sort["type"] = "string";
        break;
      case search_sort_field_type::number:
        built.sort["type"] = "number";
        break;
      case search_sort_field_type::date:
        built.sort["type"] = "date";
        break;
    }
  }
  if (const auto& mode = mode_; mode.has_value()) {
    switch (mode.value()) {
      case search_sort_field_mode::server_default:
        built.sort["mode"] = "default";
        break;
      case search_sort_field_mode::min:
        built.sort["mode"] = "min";
        break;
      case search_sort_field_mode::max:
        built.sort["mode"] = "max";
        break;
    }
  }
  if (const auto& missing = missing_; missing.has_value()) {
    switch (missing.value()) {
      case search_sort_field_missing::last:
        built.sort["missing"] = "last";
        break;
      case search_sort_field_missing::first:
        built.sort["missing"] = "first";
        break;
    }
  }
  return built;
}
} // namespace couchbase
