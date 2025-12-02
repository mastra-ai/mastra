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

#include <couchbase/query_meta_data.hxx>

#include <couchbase/codec/encoded_value.hxx>
#include <couchbase/codec/serializer_traits.hxx>

#include <vector>

namespace couchbase
{

namespace codec
{
class tao_json_serializer;
}

/**
 * Represents result of @ref cluster#query() and @ref scope#query() calls.
 *
 * @since 1.0.0
 * @committed
 */
class query_result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  query_result() = default;

  /**
   * @since 1.0.0
   * @volatile
   */
  query_result(query_meta_data meta_data, std::vector<codec::binary> rows)
    : meta_data_{ std::move(meta_data) }
    , rows_{ std::move(rows) }
  {
  }

  /**
   * Returns the {@link query_meta_data} giving access to the additional metadata associated with
   * this query.
   *
   * @return response metadata
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto meta_data() const -> const query_meta_data&
  {
    return meta_data_;
  }

  /**
   * @return list of query results as binary strings
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto rows_as_binary() const -> const std::vector<codec::binary>&
  {
    return rows_;
  }

  template<typename Serializer = codec::tao_json_serializer,
           typename Document = typename Serializer::document_type,
           std::enable_if_t<codec::is_serializer_v<Serializer>, bool> = true>
  [[nodiscard]] auto rows_as() const -> std::vector<Document>
  {
    std::vector<Document> rows;
    rows.reserve(rows_.size());
    for (const auto& row : rows_) {
      rows.emplace_back(Serializer::template deserialize<Document>(row));
    }
    return rows;
  }

private:
  query_meta_data meta_data_{};
  std::vector<codec::binary> rows_{};
};
} // namespace couchbase
