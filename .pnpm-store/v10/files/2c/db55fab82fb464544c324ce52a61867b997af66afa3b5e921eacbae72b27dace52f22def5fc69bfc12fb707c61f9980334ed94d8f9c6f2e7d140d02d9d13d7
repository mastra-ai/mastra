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

#include <couchbase/mutation_result.hxx>
#include <couchbase/mutation_token.hxx>

#include <vector>

namespace couchbase
{
/**
 * Aggregation of one or more {@link mutation_token}s for specifying consistency requirements of
 * N1QL or FTS queries.
 *
 * @since 1.0.0
 * @committed
 */
class mutation_state
{
public:
  /**
   * @since 1.0.0
   * @committed
   */
  mutation_state() = default;

  /**
   * Copies mutation token from the given mutation result.
   *
   * @param result mutation result
   *
   * @since 1.0.0
   * @committed
   */
  void add(const mutation_result& result)
  {
    if (result.mutation_token().has_value()) {
      tokens_.push_back(result.mutation_token().value());
    }
  }

  /**
   * List of the mutation tokens
   *
   * @return tokens
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto tokens() const -> const std::vector<mutation_token>&
  {
    return tokens_;
  }

private:
  std::vector<mutation_token> tokens_{ 0 };
};
} // namespace couchbase
