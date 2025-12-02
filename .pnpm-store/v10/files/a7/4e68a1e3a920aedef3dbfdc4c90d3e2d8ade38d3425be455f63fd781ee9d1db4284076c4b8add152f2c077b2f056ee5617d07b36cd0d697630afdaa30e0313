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

#include <couchbase/codec/binary_noop_serializer.hxx>
#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/search_row_locations.hxx>

#include <memory>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
class internal_search_row;
#endif

/**
 * Search Metrics contains the search result metrics containing counts and timings
 *
 * @since 1.0.0
 * @committed
 */
class search_row
{
public:
  /**
   * @since 1.0.0
   * @volatile
   */
  explicit search_row(internal_search_row internal);
  search_row(search_row&& other) noexcept;
  ~search_row();
  auto operator=(search_row&& other) noexcept -> search_row&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto index() const -> const std::string&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto id() const -> const std::string&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto score() const -> double;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto fields() const -> const codec::binary&;

  template<typename Serializer,
           typename Document = typename Serializer::document_type,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  [[nodiscard]] auto fields_as() const -> Document
  {
    if (fields().empty()) {
      return Document{};
    }
    return Serializer::template deserialize<Document>(fields());
  }

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto explanation() const -> const codec::binary&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto locations() const -> const std::optional<search_row_locations>&;

  /**
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto fragments() const -> const std::map<std::string, std::vector<std::string>>&;

private:
  std::unique_ptr<internal_search_row> internal_;
};

} // namespace couchbase
