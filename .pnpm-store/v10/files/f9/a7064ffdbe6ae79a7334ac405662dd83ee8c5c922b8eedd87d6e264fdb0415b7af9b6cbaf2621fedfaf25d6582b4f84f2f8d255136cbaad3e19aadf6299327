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

#pragma once

#include "core/operations/document_search.hxx"

#include <couchbase/search_row_location.hxx>

namespace couchbase
{
class internal_search_row_location;

class internal_search_row_locations
{
public:
  explicit internal_search_row_locations(
    const std::vector<core::operations::search_response::search_location>& locations);

  [[nodiscard]] auto get(const std::string& field) const -> std::vector<search_row_location>;
  [[nodiscard]] auto get(const std::string& field,
                         const std::string& term) const -> std::vector<search_row_location>;
  [[nodiscard]] auto get_all() const -> std::vector<search_row_location>;
  [[nodiscard]] auto fields() const -> std::vector<std::string>;
  [[nodiscard]] auto terms() const -> std::set<std::string>;
  [[nodiscard]] auto terms_for(const std::string& field) const -> std::vector<std::string>;

private:
  // field -> term -> location
  std::map<std::string, std::map<std::string, std::vector<internal_search_row_location>>>
    locations_;
};

} // namespace couchbase
