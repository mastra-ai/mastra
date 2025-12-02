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
 * A query that looks for **exact** matches of the term in the index (no analyzer, no stemming).
 * Useful to check what the actual content of the index is. It can also apply fuzziness on the term.
 * Usual better alternative is @ref match_query.
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-term.html server
 * documentation
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-fuzzy.html fuzzy search
 *
 * @since 1.0.0
 * @committed
 */
class term_query : public search_query
{
public:
  /**
   * Create a new term query.
   *
   * The mandatory term is the exact string that will be searched into the index. Note that the
   * index can (and usually will) contain terms that are derived from the text in documents, as
   * analyzers can apply process like stemming. For example, indexing "programming" could store
   * "program" in the index. As a term query doesn't apply the analyzers, one would need to look for
   * "program" to have a match on that index entry.
   *
   * @param term the input string to be matched against
   *
   * @since 1.0.0
   * @committed
   */
  explicit term_query(std::string term)
    : term_{ std::move(term) }
  {
  }

  /**
   * Require that the term also have the same prefix of the specified length (must be positive).
   *
   * The prefix length only makes sense when fuzziness is enabled. It allows to apply the fuzziness
   * only on the part of the term that is after the `length` character mark.
   *
   * For example, with the term "something" and a prefix length of 4, only the "thing" part of the
   * term will be fuzzy-searched, and hits must start with "some".
   *
   * @param length the length of the term prefix
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto prefix_length(std::uint32_t length) -> term_query&
  {
    if (length == 0) {
      throw std::invalid_argument("prefix_length must be positive");
    }

    prefix_length_ = length;
    return *this;
  }

  /**
   * If a field is specified, only terms in that field will be matched.
   *
   * @param field_name name of the field to be matched
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto field(std::string field_name) -> term_query&
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
  auto fuzziness(std::uint32_t fuzziness) -> term_query&
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
  auto match_operator(couchbase::match_operator concatenation_operator) -> term_query&
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
  std::string term_;
  std::optional<std::uint32_t> prefix_length_{};
  std::optional<std::string> field_{};
  std::optional<std::uint32_t> fuzziness_{};
  std::optional<couchbase::match_operator> operator_{};
};
} // namespace couchbase
