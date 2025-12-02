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

#include <optional>
#include <string>

namespace couchbase
{
/**
 * The input text is analyzed and a phrase query is built with the terms resulting from the
 * analysis. This type of query searches for terms occurring in the specified positions and offsets.
 * This depends on term vectors, which are consulted to determine phrase distance.
 *
 * For example, a match phrase query for `"location for functions"` is matched with `"locate the
 * function"`, if the standard analyzer is used: this analyzer uses a **stemmer**, which tokenizes
 * `"location"` and `"locate"` to
 * `"locat"`, and reduces `"functions"` and
 * `"function"` to `"function"`. Additionally, the analyzer employs stop removal, which removes
 * small and less significant words from input and target text, so that matches are attempted on
 * only the more significant elements of vocabulary: in this case `"for"` and `"the"` are removed.
 * Following this processing, the tokens `"locat"` and
 * `"function"` are recognized as common to both input and target; and also as being both in the
 * same sequence as, and at the same distance from one another; and therefore a match is made.
 * @snippet{trimleft} test_unit_search.cxx search-match-phrase
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-match-phrase.html
 *
 * @since 1.0.0
 * @committed
 */
class match_phrase_query : public search_query
{
public:
  /**
   * Create a new match phrase query.
   *
   * @param match_phrase the input string to be matched against
   *
   * @since 1.0.0
   * @committed
   */
  explicit match_phrase_query(std::string match_phrase)
    : match_phrase_{ std::move(match_phrase) }
  {
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
  auto analyzer(std::string analyzer_name) -> match_phrase_query&
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
  auto field(std::string field_name) -> match_phrase_query&
  {
    field_ = std::move(field_name);
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
  std::string match_phrase_;
  std::optional<std::string> analyzer_{};
  std::optional<std::string> field_{};
};
} // namespace couchbase
