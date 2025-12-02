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

#include <cstdint>

namespace couchbase
{
/**
 * Specifies enhanced durability options for the mutation.
 *
 * @since 1.0.0
 * @committed
 */
enum class durability_level : std::uint8_t {
  /**
   * No enhanced durability required for the mutation
   *
   * @since 1.0.0
   * @committed
   */
  none = 0x00,

  /**
   * The mutation must be replicated to a majority of the Data Service nodes (that is, held in the
   * memory allocated to the bucket)
   *
   * @since 1.0.0
   * @committed
   */
  majority = 0x01,

  /**
   * The mutation must be replicated to a majority of the Data Service nodes. Additionally, it must
   * be persisted (that is, written and synchronised to disk) on the node hosting the active
   * partition (vBucket) for the data.
   *
   * @since 1.0.0
   * @committed
   */
  majority_and_persist_to_active = 0x02,

  /**
   * The mutation must be persisted to a majority of the Data Service nodes. Accordingly, it will be
   * written to disk on those nodes.
   *
   * @since 1.0.0
   * @committed
   */
  persist_to_majority = 0x03,
};
} // namespace couchbase
