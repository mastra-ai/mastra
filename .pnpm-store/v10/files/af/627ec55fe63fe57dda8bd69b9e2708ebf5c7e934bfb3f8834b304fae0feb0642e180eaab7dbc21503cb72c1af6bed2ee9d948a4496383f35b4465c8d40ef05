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
 * Describes how the outer document store semantics on subdoc should act.
 *
 * @since 1.0.0
 * @committed
 */
enum class store_semantics {
  /**
   * Replace the document, fail if it does not exist. This is the default.
   *
   * @since 1.0.0
   * @committed
   */
  replace,

  /**
   * Replace the document or create it if it does not exist.
   *
   * @since 1.0.0
   * @committed
   */
  upsert,

  /**
   * Create the document, fail if it exists.
   *
   * @since 1.0.0
   * @committed
   */
  insert,

  /**
   * Convert from a tombstone to a document.
   *
   * @since 1.0.0
   * @internal
   */
  revive,
};
} // namespace couchbase
