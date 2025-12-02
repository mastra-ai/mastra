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

#include <couchbase/search_query.hxx>

#include <memory>
#include <optional>
#include <string>

namespace couchbase
{
/**
 * @since 1.0.0
 * @committed
 */
class vector_query
{
public:
  /**
   * Creates a vector query
   *
   * @param vector_field_name the document field that contains the vector
   * @param vector_query the vector query to run. Cannot be empty.
   *
   * @since 1.0.0
   * @committed
   */
  vector_query(std::string vector_field_name, std::vector<double> vector_query)
    : vector_field_name_{ std::move(vector_field_name) }
    , vector_query_{ std::move(vector_query) }
  {
    if (vector_query_.value().empty()) {
      throw std::invalid_argument("the vector_query cannot be empty");
    }
  }

  /**
   * Creates a vector query
   *
   * @param vector_field_name the document field that contains the vector
   * @param base64_vector_query a base64-encoded sequence of little-endian IEEE 754 floats
   *
   * @snippet{trimleft} test/test_unit_search.cxx base64-vector-query
   * @since 1.0.0
   * @committed
   */
  vector_query(std::string vector_field_name, std::string base64_vector_query)
    : vector_field_name_{ std::move(vector_field_name) }
    , base64_vector_query_{ std::move(base64_vector_query) }
  {
    if (base64_vector_query_.value().empty()) {
      throw std::invalid_argument("the base64_vector_query cannot be empty");
    }
  }

  /**
   * The number of results that will be returned from this vector query. Defaults to 3.
   *
   * @param num_candidates the number of results returned
   *
   * @return this vector_query for chaining purposes
   *
   * @since 1.0.0
   * @committed
   */
  auto num_candidates(std::uint32_t num_candidates) -> vector_query&
  {
    if (num_candidates < 1) {
      throw std::invalid_argument("The num_candidates cannot be less than 1");
    }
    num_candidates_ = num_candidates;
    return *this;
  }

  /**
   * The boost parameter is used to increase the relative weight of a clause (with a boost greater
   * than 1) or decrease the relative weight (with a boost between 0 and 1).
   *
   * @param boost boost value
   *
   * @return this vector_query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto boost(double boost) -> vector_query&
  {
    boost_ = boost;
    return *this;
  }

  /**
   * Sets a prefilter, which allows defining a subset of the vector index, over which the vector
   * search will be executed.
   *
   * @param prefilter the prefilter search query
   *
   * @return this vector_query for chaining purposes.
   *
   * @since 1.2.0
   * @committed
   */
  template<typename SearchQuery>
  auto prefilter(SearchQuery prefilter) -> vector_query&
  {
    prefilter_ = std::make_shared<SearchQuery>(std::move(prefilter));
    return *this;
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query;

private:
  std::string vector_field_name_;
  std::uint32_t num_candidates_{ 3 };
  std::optional<std::vector<double>> vector_query_{};
  std::optional<std::string> base64_vector_query_{};
  std::optional<double> boost_{};
  std::shared_ptr<search_query> prefilter_{};
};
} // namespace couchbase
