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

#include <couchbase/date_range.hxx>
#include <couchbase/search_facet.hxx>

#include <vector>

namespace couchbase
{
/**
 * A facet that categorizes rows into dateal ranges (or buckets) provided by the user.
 */
class date_range_facet : public search_facet
{
public:
  date_range_facet(std::string field, std::vector<date_range> ranges)
    : search_facet{ std::move(field) }
    , ranges_{ std::move(ranges) }
  {
  }

  date_range_facet(std::string field, std::uint32_t size, std::vector<date_range> ranges)
    : search_facet{ std::move(field), size }
    , ranges_{ std::move(ranges) }
  {
  }

  /**
   * @return encoded representation of the search facet.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_facet override;

private:
  std::vector<date_range> ranges_;
};
} // namespace couchbase
