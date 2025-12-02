/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include <cinttypes>

namespace couchbase::core::mcbp
{
enum class durability_level : std::uint8_t {
  // specifies that a change must be replicated to (held in memory) a majority of the nodes for the
  // bucket.
  majority = 0x01,

  // specifies that a change must be replicated to (held in memory) a majority of the nodes for the
  // bucket and additionally persisted to disk on the active node.
  majority_and_persist_to_active = 0x02,

  // specifies that a change must be persisted to (written to disk) a majority for the bucket.
  persist_to_majority = 0x03,
};
} // namespace couchbase::core::mcbp
