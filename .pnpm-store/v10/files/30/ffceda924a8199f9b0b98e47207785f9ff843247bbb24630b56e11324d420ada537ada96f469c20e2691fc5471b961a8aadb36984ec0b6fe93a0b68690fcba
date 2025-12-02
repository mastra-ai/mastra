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

namespace couchbase
{
enum class search_scan_consistency {
  /**
   * This is the default, the indexer does not wait for certain index updates until it returns the
   * current hits.
   *
   * This is also the fastest mode, because we avoid the cost of obtaining the vector,
   * and we also avoid any wait for the index to catch up to the vector.
   *
   * @since 1.0.0
   * @committed
   */
  not_bounded = 0,
};
} // namespace couchbase
