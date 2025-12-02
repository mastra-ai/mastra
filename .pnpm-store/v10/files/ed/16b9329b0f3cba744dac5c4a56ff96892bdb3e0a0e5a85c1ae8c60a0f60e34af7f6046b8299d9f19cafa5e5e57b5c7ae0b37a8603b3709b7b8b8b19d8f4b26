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

namespace couchbase
{

internal_search_row_locations::internal_search_row_locations(
  const std::vector<core::operations::search_response::search_location>& locations)
{
  for (const auto& location : locations) {
    locations_[location.field][location.term].emplace_back(
      internal_search_row_location{ location });
  }
}

auto
internal_search_row_locations::get(const std::string& field) const
  -> std::vector<search_row_location>
{
  const auto& locations_for_field = locations_.find(field);

  if (locations_for_field == locations_.end()) {
    return {};
  }

  std::vector<search_row_location> result;
  for (const auto& [term, locations] : locations_for_field->second) {
    result.reserve(result.size() + locations.size());
    for (const auto& location : locations) {
      result.emplace_back(location);
    }
  }

  return result;
}

auto
internal_search_row_locations::get(const std::string& field, const std::string& term) const
  -> std::vector<search_row_location>
{
  const auto& locations_for_field = locations_.find(field);

  if (locations_for_field == locations_.end()) {
    return {};
  }

  const auto& locations_for_term = locations_for_field->second.find(term);
  if (locations_for_term == locations_for_field->second.end()) {
    return {};
  }

  std::vector<search_row_location> result;
  result.reserve(locations_for_term->second.size());
  for (const auto& location : locations_for_term->second) {
    result.emplace_back(location);
  }
  return result;
}

auto
internal_search_row_locations::get_all() const -> std::vector<search_row_location>
{
  std::vector<search_row_location> result;

  for (const auto& [field, locations_by_field] : locations_) {
    for (const auto& [term, locations] : locations_by_field) {
      result.reserve(result.size() + locations.size());
      for (const auto& location : locations) {
        result.emplace_back(location);
      }
    }
  }

  return result;
}

auto
internal_search_row_locations::fields() const -> std::vector<std::string>
{
  std::vector<std::string> result;

  result.reserve(locations_.size());
  for (const auto& [field, _] : locations_) {
    result.emplace_back(field);
  }

  return result;
}

auto
internal_search_row_locations::terms() const -> std::set<std::string>
{
  std::set<std::string> result;

  for (const auto& [field, locations_by_term] : locations_) {
    for (const auto& [term, _] : locations_by_term) {
      result.insert(term);
    }
  }

  return result;
}

auto
internal_search_row_locations::terms_for(const std::string& field) const -> std::vector<std::string>
{
  const auto& locations_for_field = locations_.find(field);

  if (locations_for_field == locations_.end()) {
    return {};
  }

  std::vector<std::string> result;

  result.reserve(locations_for_field->second.size());
  for (const auto& [term, _] : locations_for_field->second) {
    result.emplace_back(term);
  }

  return result;
}
} // namespace couchbase
