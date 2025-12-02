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

#include <cstdint>
#include <string>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
struct encoded_search_facet;
#endif

/**
 * Base class for full text facets of search queries.
 */
class search_facet
{
public:
  virtual ~search_facet() = default;

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] virtual auto encode() const -> encoded_search_facet = 0;

protected:
  search_facet(std::string field, std::uint32_t size)
    : field_{ std::move(field) }
    , size_{ size }
  {
  }

  search_facet(std::string field)
    : field_{ std::move(field) }
  {
  }

  std::string field_;
  std::optional<std::uint32_t> size_{};
};
} // namespace couchbase
