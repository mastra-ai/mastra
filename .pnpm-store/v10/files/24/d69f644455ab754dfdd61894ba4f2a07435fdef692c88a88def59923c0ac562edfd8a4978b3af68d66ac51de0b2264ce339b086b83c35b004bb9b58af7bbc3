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

namespace couchbase
{
/**
 * Defines how the individual match terms should be logically concatenated
 *
 * @since 1.0.0
 * @committed
 */
enum class match_operator {
  /**
   * Individual match terms are concatenated with a logical OR - this is the default if not
   * provided.
   *
   * @since 1.0.0
   * @committed
   */
  logical_or,

  /**
   * Individual match terms are concatenated with a logical AND.
   *
   * @since 1.0.0
   * @committed
   */
  logical_and,
};
} // namespace couchbase
