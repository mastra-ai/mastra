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

#include <couchbase/mutation_token.hxx>
#include <couchbase/result.hxx>

#include <optional>

namespace couchbase
{

/**
 * Represents result of mutation operations.
 *
 * @since 1.0.0
 * @committed
 */
class mutation_result : public result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  mutation_result() = default;

  /**
   * Constructs result for get_any_replica operation, or an entry for get_all_replicas operation.
   *
   * @param cas
   * @param token mutation token returned by the server
   *
   * @since 1.0.0
   * @committed
   */
  mutation_result(couchbase::cas cas, mutation_token token)
    : result{ cas }
    , mutation_token_{ std::move(token) }
  {
  }

  /**
   * @return mutation token returned by the server
   *
   * @since 1.0.0
   * @committed
   */
  [[nodiscard]] auto mutation_token() const -> const std::optional<mutation_token>&
  {
    return mutation_token_;
  }

private:
  std::optional<couchbase::mutation_token> mutation_token_{};
};

} // namespace couchbase
