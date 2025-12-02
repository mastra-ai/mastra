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

namespace couchbase::core
{
/**
 * This enum defines known attributes, that could be associated with the error code in the error
 * map. Complete list could be found at
 * https://github.com/couchbase/kv_engine/blob/master/docs/ErrorMap.md#error-attributes.
 */
enum class key_value_error_map_attribute {
  /**
   * The operation was successful for those situations where the error code is indicating successful
   * (i.e. subdocument operations carried out on a deleted document)
   */
  success,

  /**
   * This attribute means that the error is related to a constraint failure regarding the item
   * itself, i.e. the item does not exist, already exists, or its current value makes the current
   * operation impossible. Retrying the operation when the item's value or status has changed may
   * succeed.
   */
  item_only,

  /**
   * This attribute means that a user's input was invalid because it violates the semantics of the
   * operation, or exceeds some predefined limit.
   */
  invalid_input,

  /**
   * The client's cluster map may be outdated and requires updating. The client should obtain a
   * newer configuration.
   */
  fetch_config,

  /**
   * The current connection is no longer valid. The client must reconnect to the server. Note that
   * the presence of other attributes may indicate an alternate remedy to fixing the connection
   * without a disconnect, but without special remedial action a disconnect is needed.
   */
  conn_state_invalidated,

  /**
   * The operation failed because the client failed to authenticate or is not authorized to perform
   * this operation. Note that this error in itself does not mean the connection is invalid, unless
   * conn-state-invalidated is also present.
   */
  auth,

  /**
   * This error code must be handled specially. If it is not handled, the connection must be
   * dropped.
   */
  special_handling,

  /**
   * The operation is not supported, possibly because the of server version, bucket type, or current
   * user.
   */
  support,

  /**
   * This error is transient. Note that this does not mean the error is retriable.
   */
  temp,

  /**
   * This is an internal error in the server.
   */
  internal,

  /**
   * The operation may be retried immediately.
   */
  retry_now,

  /**
   * The operation may be retried after some time.
   */
  retry_later,

  /**
   * The error is related to the subdocument subsystem.
   */
  subdoc,

  /**
   * The error is related to the DCP subsystem.
   */
  dcp,

  /**
   * Use retry specifications from the server.
   */
  auto_retry,

  /**
   * This attribute means that the error is related to operating on a locked document.
   */
  item_locked,

  /**
   * This attribute means that the error is related to operating on a soft-deleted document.
   */
  item_deleted,

  /**
   * The error is related to rate limitation for the client (version 2)
   */
  rate_limit,

  /**
   * The error is related to a system-defined hard limit for resource usage.
   * Retrying the operation will most likely not succeed unless an action was
   * taken on the server to resolve the issue (version 2)
   */
  system_constraint,

  /**
   * The client should not retry the operation.
   */
  no_retry,
};
} // namespace couchbase::core