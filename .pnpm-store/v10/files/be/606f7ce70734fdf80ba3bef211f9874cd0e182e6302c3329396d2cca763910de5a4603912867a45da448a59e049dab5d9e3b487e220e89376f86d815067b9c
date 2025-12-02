/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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

#include <couchbase/search_row_location.hxx>

#include <map>
#include <memory>
#include <set>
#include <string>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_search_row_locations;
#endif

/**
 * @since 1.0.0
 * @committed
 */
class search_row_locations
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  explicit search_row_locations(internal_search_row_locations internal);
  ~search_row_locations();
  search_row_locations(search_row_locations&& other) noexcept;
  auto operator=(search_row_locations&& other) noexcept -> search_row_locations&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get(const std::string& field) const -> std::vector<search_row_location>;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get(const std::string& field,
                         const std::string& term) const -> std::vector<search_row_location>;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto get_all() const -> std::vector<search_row_location>;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto fields() const -> std::vector<std::string>;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto terms() const -> std::set<std::string>;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto terms_for(const std::string& field) const -> std::vector<std::string>;

private:
  std::unique_ptr<internal_search_row_locations> internal_;
};

} // namespace couchbase
