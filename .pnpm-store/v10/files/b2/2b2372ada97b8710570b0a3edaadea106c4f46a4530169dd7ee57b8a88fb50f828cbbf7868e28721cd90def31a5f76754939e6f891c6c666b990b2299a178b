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

#include <string>
#include <vector>

namespace couchbase
{
/**
 * A doc_id query is a query that directly matches the documents whose ID have been provided. It can
 * be combined within a conjunction_query to restrict matches on the set of documents.
 *
 * @since 1.0.0
 * @committed
 */
class doc_id_query : public search_query
{
public:
  doc_id_query() = default;

  /**
   * Create a new doc_id query.
   *
   * @param ids the list of document IDs to be restricted against.
   *
   * @since 1.0.0
   * @committed
   */
  explicit doc_id_query(std::vector<std::string> ids)
    : ids_{ std::move(ids) }
  {
  }

  /**
   * Create a new doc_id query.
   *
   * @param ids the list of document IDs to be restricted against.
   *
   * @since 1.0.0
   * @committed
   */
  doc_id_query(std::initializer_list<std::string> ids)
  {
    ids_.reserve(ids.size());
    doc_ids(ids);
  }

  /**
   * Add IDs to the query.
   *
   * @param ids  the list of document identifiers to add
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto doc_ids(const std::vector<std::string>& ids) -> doc_id_query&
  {
    for (const auto& id : ids) {
      ids_.push_back(id);
    }
    return *this;
  }

  /**
   * Add ID to the query.
   *
   * @param id  the document identifier to add
   *
   * @return this query for chaining purposes.
   *
   * @since 1.0.0
   * @committed
   */
  auto doc_id(const std::string& id) -> doc_id_query&
  {
    ids_.push_back(id);
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
  std::vector<std::string> ids_{};
};
} // namespace couchbase
