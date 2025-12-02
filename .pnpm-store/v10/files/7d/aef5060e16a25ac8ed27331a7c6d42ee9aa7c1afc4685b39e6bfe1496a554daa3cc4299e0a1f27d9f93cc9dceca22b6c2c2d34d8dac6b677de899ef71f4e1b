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

#include <couchbase/search_result.hxx>

namespace couchbase
{
class internal_search_result
{
public:
  explicit internal_search_result(const core::operations::search_response& response);

  [[nodiscard]] auto meta_data() const -> const search_meta_data&;

  [[nodiscard]] auto rows() const -> const std::vector<search_row>&;

  [[nodiscard]] auto facets() const
    -> const std::map<std::string, std::shared_ptr<search_facet_result>>&;

private:
  search_meta_data meta_data_;
  std::map<std::string, std::shared_ptr<search_facet_result>> facets_;
  std::vector<search_row> rows_;
};

} // namespace couchbase
