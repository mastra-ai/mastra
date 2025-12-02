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

#include <cinttypes>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_search_row_location;
#endif

/**
 * @since 1.0.0
 * @committed
 */
class search_row_location
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  explicit search_row_location(internal_search_row_location internal);

  search_row_location();

  ~search_row_location();

  search_row_location(const search_row_location&) = delete;
  search_row_location& operator=(const search_row_location&) = delete;

  search_row_location(search_row_location&&) noexcept;
  search_row_location& operator=(search_row_location&&) noexcept;

  [[nodiscard]] auto field() const -> const std::string&;
  [[nodiscard]] auto term() const -> const std::string&;
  [[nodiscard]] auto position() const -> const std::uint64_t&;
  [[nodiscard]] auto start_offset() const -> const std::uint64_t&;
  [[nodiscard]] auto end_offset() const -> const std::uint64_t&;
  [[nodiscard]] auto array_positions() const -> const std::optional<std::vector<std::uint64_t>>&;

private:
  std::unique_ptr<internal_search_row_location> internal_;
};

} // namespace couchbase
