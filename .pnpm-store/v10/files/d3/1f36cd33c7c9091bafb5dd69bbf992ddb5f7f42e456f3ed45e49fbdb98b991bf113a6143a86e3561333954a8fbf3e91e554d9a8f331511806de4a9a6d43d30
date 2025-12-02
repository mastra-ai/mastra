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
enum class persist_to : std::uint8_t {
  /**
   * Do not apply any persistence requirements
   *
   * @since 1.0.0
   * @committed
   */
  none = 0,

  /**
   * Wait for persistence to active node.
   *
   * @since 1.0.0
   * @committed
   */
  active = 1,

  /**
   * Wait for persistence to at least one node.
   *
   * @since 1.0.0
   * @committed
   */
  one = 2,

  /**
   * Wait for persistence to at least two nodes.
   *
   * @since 1.0.0
   * @committed
   */
  two = 3,

  /**
   * Wait for persistence to at least three nodes.
   *
   * @since 1.0.0
   * @committed
   */
  three = 4,

  /**
   * Wait for persistence to at least all nodes nodes.
   *
   * This is maximum possible persistence requirement, that includes active and all three replica
   * nodes.
   *
   * @since 1.0.0
   * @committed
   */
  four = 5,
};
} // namespace couchbase
