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

#include <couchbase/lookup_in_result.hxx>

#include <vector>

namespace couchbase
{

/**
 * Represents result of lookup_in_replica operations.
 *
 * @since 1.0.0
 * @committed
 */
class lookup_in_replica_result : public lookup_in_result
{
public:
  /**
   * @since 1.0.0
   * @internal
   */
  lookup_in_replica_result() = default;

  /**
   * Constructs result for lookup_in_replica operation
   *
   * @param cas
   * @param entries list of the fields returned by the server
   * @param is_deleted
   * @param is_replica true if document originates from replica node
   *
   * @since 1.0.0
   * @committed
   */
  lookup_in_replica_result(couchbase::cas cas,
                           std::vector<entry> entries,
                           bool is_deleted,
                           bool is_replica)
    : lookup_in_result{ cas, std::move(entries), is_deleted }
    , is_replica_{ is_replica }
  {
  }

  /**
   * Returns whether this document originates from a replica node
   *
   * @return whether document originates from a replica node
   *
   * @since 1.0.0
   */
  [[nodiscard]] auto is_replica() const -> bool
  {
    return is_replica_;
  }

private:
  bool is_replica_{ false };
};
} // namespace couchbase
