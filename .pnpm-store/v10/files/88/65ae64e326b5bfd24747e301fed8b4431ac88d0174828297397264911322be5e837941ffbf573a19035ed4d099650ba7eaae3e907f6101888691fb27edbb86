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

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/search_row_locations.hxx>

namespace couchbase
{
class internal_search_row
{
public:
  explicit internal_search_row(core::operations::search_response::search_row row);
  internal_search_row(internal_search_row&& other) noexcept;
  auto operator=(internal_search_row&& other) noexcept -> internal_search_row&;

  [[nodiscard]] auto index() const -> const std::string&;

  [[nodiscard]] auto id() const -> const std::string&;

  [[nodiscard]] auto score() const -> double;

  [[nodiscard]] auto fields() const -> const codec::binary&;

  [[nodiscard]] auto explanation() const -> const codec::binary&;

  [[nodiscard]] auto fragments() const -> const std::map<std::string, std::vector<std::string>>&;

  [[nodiscard]] auto locations() const -> const std::optional<search_row_locations>&;

private:
  core::operations::search_response::search_row row_;

  // TODO(sergey): eliminate or defer copying of these fields
  codec::binary fields_;
  codec::binary explanation_;
  std::map<std::string, std::vector<std::string>> fragments_;
  std::optional<search_row_locations> locations_{};
};

} // namespace couchbase
