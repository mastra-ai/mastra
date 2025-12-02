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
enum class analytics_scan_consistency {
  /**
   * The indexer will return whatever state it has to the query engine at the time of query.
   *
   * This is the default (for single-statement requests). No timestamp vector is used in the index
   * scan. This is also the fastest mode, because we avoid the cost of obtaining the vector, and we
   * also avoid any wait for the index to catch up to the vector.
   *
   * @since 1.0.0
   * @committed
   */
  not_bounded = 0,

  /**
   * The indexer will wait until all mutations have been processed at the time of request before
   * returning to the query engine.
   *
   * This implements strong consistency per request. Before processing the request, a current vector
   * is obtained. The vector is used as a lower bound for the statements in the request. If there
   * are DML statements in the request, RYOW
   * ("read your own write") is also applied within the request.
   *
   * @since 1.0.0
   * @committed
   */
  request_plus,
};
} // namespace couchbase
