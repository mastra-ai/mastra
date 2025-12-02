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
#include <couchbase/result.hxx>

#include <optional>

namespace couchbase
{

/**
 * Represents result of counter operations.
 *
 * @since 1.0.0
 * @committed
 */
class counter_result : public mutation_result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  counter_result() = default;

  /**
   * Constructs result for get_any_replica operation, or an entry for get_all_replicas operation.
   *
   * @param cas
   * @param token counter token returned by the server
   * @param content current value of the counter
   *
   * @since 1.0.0
   * @committed
   */
  counter_result(couchbase::cas cas, couchbase::mutation_token token, std::uint64_t content)
    : mutation_result{ cas, std::move(token) }
    , content_{ content }
  {
  }

  /**
   * Current value of the counter.
   *
   * @return unsigned value of the counter
   */
  [[nodiscard]] auto content() const -> std::uint64_t
  {
    return content_;
  }

private:
  std::uint64_t content_{};
};

} // namespace couchbase
