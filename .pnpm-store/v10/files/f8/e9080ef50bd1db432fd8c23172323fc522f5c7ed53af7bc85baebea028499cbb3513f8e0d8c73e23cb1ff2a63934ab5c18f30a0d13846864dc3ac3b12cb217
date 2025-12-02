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

#include <couchbase/match_operator.hxx>
#include <couchbase/search_query.hxx>

#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>

namespace couchbase
{
/**
 * A match query analyzes the input text and uses that analyzed text to query the index. An attempt
 * is made to use the same analyzer that was used when the field was indexed.
 *
 * Match documents with both `"location"` and `"hostel"` terms in the field `reviews.content`,
 * ensuring common prefix length `4`, maximum fuzziness and select standard analyzer.
 * @snippet{trimleft} test_unit_search.cxx search-match
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-match.html server
 * documentation
 *
 * @since 1.0.0
 * @committed
 */
class match_query : public search_query
{
public:
  /**
   * Create a new match query.
   *
   * @param match the input string to be matched against
   *
   * @since 1.0.0
   * @committed
   */
  explicit match_query(std::string match)
    : match_{ std::move(match) }
  {
  }

  /**
   * Require that the term also have the same prefix of the specified length (must be positive).
   *
   * @param length the length of the term prefix
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto prefix_length(std::uint32_t length) -> match_query&
  {
    if (length == 0) {
      throw std::invalid_argument("prefix_length must be positive");
    }

    prefix_length_ = length;
    return *this;
  }

  /**
   * Analyzers are used to transform input text into a stream of tokens for indexing. The Server
   * comes with built-in analyzers and the users can create their own.
   *
   * @param analyzer_name the name of the analyzer used
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto analyzer(std::string analyzer_name) -> match_query&
  {
    analyzer_ = std::move(analyzer_name);
    return *this;
  }

  /**
   * If a field is specified, only terms in that field will be matched.
   *
   * This can also affect the used analyzer if one isn't specified explicitly.
   *
   * @param field_name name of the field to be matched
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto field(std::string field_name) -> match_query&
  {
    field_ = std::move(field_name);
    return *this;
  }

  /**
   * Perform fuzzy matching. If the fuzziness parameter is set to a non-zero integer the analyzed
   * text will be matched with the specified level of fuzziness.
   *
   * @param fuzziness level of fuzziness (the maximum supported fuzziness is 2).
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto fuzziness(std::uint32_t fuzziness) -> match_query&
  {
    fuzziness_ = fuzziness;
    return *this;
  }

  /**
   * Defines how the individual match terms should be logically concatenated
   *
   * @param concatenation_operator operator to be used
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto match_operator(couchbase::match_operator concatenation_operator) -> match_query&
  {
    operator_ = concatenation_operator;
    return *this;
  }

  /**
   * @return encoded representation of the query.
   *
   * @since 1.0.0
   * @internal
   */
  [[nodiscard]] auto encode() const -> encoded_search_query override;

private:
  std::string match_;
  std::optional<std::uint32_t> prefix_length_{};
  std::optional<std::string> analyzer_{};
  std::optional<std::string> field_{};
  std::optional<std::uint32_t> fuzziness_{};
  std::optional<couchbase::match_operator> operator_{};
};
} // namespace couchbase
