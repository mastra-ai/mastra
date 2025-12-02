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
/**
 * Enumeration of possible retry reasons for operations.
 *
 * @since 1.0.0
 * @committed
 */
enum class retry_reason {
  /**
   * default value, e.g. when we don't need to retry
   */
  do_not_retry,

  /**
   * All unexpected/unknown retry errors must not be retried to avoid accidental data loss and
   * non-deterministic behavior.
   */
  unknown,

  /**
   * The socket is not available into which the operation should’ve been written.
   */
  socket_not_available,

  /**
   * The service on a node (i.e. key_value, query) is not available.
   */
  service_not_available,

  /**
   * The node where the operation is supposed to be dispatched to is not available.
   */
  node_not_available,

  /**
   * A not my vbucket response has been received.
   */
  key_value_not_my_vbucket,

  /**
   * A KV response has been received which signals an outdated collection.
   */
  key_value_collection_outdated,

  /**
   * An unknown response was returned and the consulted KV error map indicated a retry.
   */
  key_value_error_map_retry_indicated,

  key_value_locked,

  key_value_temporary_failure,

  key_value_sync_write_in_progress,

  key_value_sync_write_re_commit_in_progress,

  service_response_code_indicated,

  /**
   * While an operation was in-flight, the underlying socket has been closed.
   */
  socket_closed_while_in_flight,

  /**
   * The circuit breaker is open for the given socket/endpoint and as a result the operation is not
   * sent into it.
   */
  circuit_breaker_open,

  query_prepared_statement_failure,

  query_index_not_found,

  analytics_temporary_failure,

  search_too_many_requests,

  views_temporary_failure,

  views_no_active_partition,
};

bool
allows_non_idempotent_retry(retry_reason reason);

bool
always_retry(retry_reason reason);
} // namespace couchbase
