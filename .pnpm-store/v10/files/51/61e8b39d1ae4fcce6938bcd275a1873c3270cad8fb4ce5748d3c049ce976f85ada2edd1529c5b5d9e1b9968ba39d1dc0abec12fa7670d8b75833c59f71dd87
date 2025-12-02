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

#include <couchbase/search_date_range.hxx>
#include <couchbase/search_meta_data.hxx>

namespace couchbase
{
class internal_date_range_facet_result
{
public:
  explicit internal_date_range_facet_result(
    const core::operations::search_response::search_facet& facet);

  [[nodiscard]] auto name() const -> const std::string&;
  [[nodiscard]] auto field() const -> const std::string&;
  [[nodiscard]] auto total() const -> std::uint64_t;
  [[nodiscard]] auto missing() const -> std::uint64_t;
  [[nodiscard]] auto other() const -> std::uint64_t;
  [[nodiscard]] auto date_ranges() const -> const std::vector<search_date_range>&;

private:
  std::string name_;
  std::string field_;
  std::uint64_t total_{};
  std::uint64_t missing_{};
  std::uint64_t other_{};
  std::vector<search_date_range> ranges_;
};

} // namespace couchbase
