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
#include <stdexcept>
#include <string>
#include <vector>

namespace couchbase
{
/**
 * A query that looks for **exact** match of several terms (in the exact order) in the index. The
 * provided terms must exist in the correct order, at the correct index offsets, in the specified
 * field (as no analyzer are applied to the terms). Queried field must have been indexed with
 * `includeTermVectors` set to `true`. It is generally more useful in debugging scenarios, and the
 * @ref match_phrase_query should usually be preferred for real-world use cases.
 *
 * Match documents with terms `"nice"` and `"view"` in field `reviews.content`:
 * @snippet{trimleft} test_unit_search.cxx search-phrase
 *
 * @see https://docs.couchbase.com/server/current/fts/fts-supported-queries-phrase.html server
 * documentation
 *
 * @since 1.0.0
 * @committed
 */
class phrase_query : public search_query
{
public:
  /**
   * Create a new phrase query.
   *
   * The mandatory list of terms that must exactly match in the index. Note that the index can (and
   * usually will) contain terms that are derived from the text in documents, as analyzers can apply
   * process like stemming.
   *
   * @param terms non-empty vector of terms.
   *
   * @since 1.0.0
   * @committed
   */
  explicit phrase_query(std::initializer_list<std::string> terms)
    : terms_{ terms }
  {
    if (terms_.empty()) {
      throw std::invalid_argument("terms must not be empty in phrase_query");
    }
  }

  /**
   * Create a new phrase query.
   *
   * The mandatory list of terms that must exactly match in the index. Note that the index can (and
   * usually will) contain terms that are derived from the text in documents, as analyzers can apply
   * process like stemming.
   *
   * @param terms non-empty vector of terms.
   *
   * @since 1.0.0
   * @committed
   */
  explicit phrase_query(std::vector<std::string> terms)
    : terms_{ std::move(terms) }
  {
    if (terms_.empty()) {
      throw std::invalid_argument("terms must not be empty in phrase_query");
    }
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
  auto field(std::string field_name) -> phrase_query&
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
  std::vector<std::string> terms_;
  std::optional<std::string> field_{};
};
} // namespace couchbase
