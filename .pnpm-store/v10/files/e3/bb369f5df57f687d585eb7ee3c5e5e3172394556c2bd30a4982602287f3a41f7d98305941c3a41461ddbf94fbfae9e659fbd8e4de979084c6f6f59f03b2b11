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

#include <system_error>

namespace couchbase
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
namespace core::impl
{
const std::error_category&
common_category() noexcept;

const std::error_category&
key_value_category() noexcept;

const std::error_category&
query_category() noexcept;

const std::error_category&
analytics_category() noexcept;

const std::error_category&
search_category() noexcept;

const std::error_category&
view_category() noexcept;

const std::error_category&
management_category() noexcept;

const std::error_category&
field_level_encryption_category() noexcept;

const std::error_category&
network_category() noexcept;

const std::error_category&
streaming_json_lexer_category() noexcept;

const std::error_category&
transaction_category() noexcept;

const std::error_category&
transaction_op_category() noexcept;

} // namespace core::impl
#endif

namespace errc
{
/**
 * Common errors for all services and modules.
 *
 * @since 1.0.0
 * @committed
 */
enum class common {
  /**
   * A request is cancelled and cannot be resolved in a non-ambiguous way.
   *
   * Most likely the request is in-flight on the socket and the socket gets closed.
   *
   * @since 1.0.0
   * @committed
   */
  request_canceled = 2,

  /**
   * It is unambiguously determined that the error was caused because of invalid arguments from the
   * user.
   *
   * Usually only thrown directly when doing request arg validation
   *
   * @since 1.0.0
   * @committed
   */
  invalid_argument = 3,

  /**
   * It can be determined from the config unambiguously that a given service is not available.
   *
   * I.e. no query node in the config, or a memcached bucket is accessed and views or n1ql queries
   * should be performed
   *
   * @since 1.0.0
   * @committed
   */
  service_not_available = 4,

  /**
   * Indicates an operation failed because there has been an internal error in the server.*
   *
   * @since 1.0.0
   * @committed
   */
  // Query: Error range 5xxx
  // Analytics: Error range 25xxx
  // KV: error code ERR_INTERNAL (0x84)
  // Search: HTTP 500
  internal_server_failure = 5,

  /**
   * Indicates authentication problems.
   *
   * @since 1.0.0
   * @committed
   */
  // Query: Error range 10xxx
  // Analytics: Error range 20xxx
  // View: HTTP status 401
  // KV: error code ERR_ACCESS (0x24), ERR_AUTH_ERROR (0x20), AUTH_STALE (0x1f)
  // Search: HTTP status 401, 403
  authentication_failure = 6,

  /**
   * Returned when the server reports a temporary failure.
   *
   * This is exception is very likely retryable.
   *
   * @since 1.0.0
   * @committed
   */
  // Analytics: Errors: 23000, 23003
  // KV: Error code ERR_TMPFAIL (0x86), ERR_BUSY (0x85) ERR_OUT_OF_MEMORY (0x82),
  // ERR_NOT_INITIALIZED (0x25)
  temporary_failure = 7,

  /**
   * Indicates an operation failed because parsing of the input returned with an error.
   *
   * @since 1.0.0
   * @committed
   */
  // Query: code 3000
  // Analytics: codes 24000
  parsing_failure = 8,

  /**
   * Indicates an optimistic locking failure.
   *
   * The operation failed because the specified compare and swap (CAS) value differs from the
   * document's actual CAS value. This means the document was modified since the original CAS value
   * was acquired.
   *
   * The application should usually respond by fetching a fresh version of the document and
   * repeating the failed operation.
   *
   * @since 1.0.0
   * @committed
   */
  // KV: ERR_EXISTS (0x02) when replace or remove with cas
  // Query: code 12009
  cas_mismatch = 9,

  /**
   * A request is made but the current bucket is not found
   *
   * @since 1.0.0
   * @committed
   */
  bucket_not_found = 10,

  /**
   * A request is made but the current collection (including scope) is not found
   *
   * @since 1.0.0
   * @committed
   */
  collection_not_found = 11,

  /**
   * The server indicates that the operation is not supported.
   *
   * @since 1.0.0
   * @committed
   */
  // KV: 0x81 (unknown command), 0x83 (not supported)
  unsupported_operation = 12,

  /**
   * A timeout occurs and we aren't sure if the underlying operation has completed.  This normally
   * occurs because we sent the request to the server successfully, but timed out waiting for the
   * response.  Note that idempotent operations should never return this, as they do not have
   * ambiguity.
   *
   * @since 1.0.0
   * @committed
   */
  ambiguous_timeout = 13,

  /**
   * A timeout occurs and we are confident that the operation could not have succeeded.  This
   * normally would occur because we received confident failures from the server, or never managed
   * to successfully dispatch the operation.
   *
   * @since 1.0.0
   * @committed
   */
  unambiguous_timeout = 14,

  /**
   * A feature which is not available was used.
   *
   * @since 1.0.0
   * @committed
   */
  feature_not_available = 15,

  /**
   * A management API attempts to target a scope which does not exist.
   *
   * @since 1.0.0
   * @committed
   */
  scope_not_found = 16,

  /**
   * The index that was referenced by the operation does not exist on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Query: Codes 12004, 12016 (warning: regex ahead!) Codes 5000 AND message contains index .+ not
  // found Analytics: Raised When 24047 Search: Http status code 400 AND text contains “index not
  // found”
  index_not_found = 17,

  /**
   * The index that was referenced by the operation exist on the server when it expected not to.
   *
   * @since 1.0.0
   * @committed
   */
  // Query:
  // Note: the uppercase index for 5000 is not a mistake (also only match on exist not exists
  // because there is a typo
  //   somewhere in query engine which might either print exist or exists depending on the codepath)
  // Code 5000 AND message contains Index .+ already exist
  // Code 4300 AND message contains index .+ already exist
  //
  // Analytics: Raised When 24048
  index_exists = 18,

  /**
   * Returned when encoding of a user object failed while trying to write it to the cluster
   *
   * @since 1.0.0
   * @committed
   */
  encoding_failure = 19,

  /**
   * Returned when decoding of the data into the user object failed
   *
   * @since 1.0.0
   * @committed
   */
  decoding_failure = 20,

  /**
   * This error is raised if the operation failed due to hitting a rate-limit on the server side.
   *
   * @note that this rate-limit might be implicitly configured if you are using Couchbase Capella
   * (for example when using the free tier). See the error context with the exception for further
   * information on the exact cause and check the documentation for potential remedy.
   *
   * @since 1.0.0
   * @committed
   */
  /*
   * Raised when a service decides that the caller must be rate limited due to exceeding a rate
   * threshold of some sort.
   *
   * * KeyValue
   *   0x30 RateLimitedNetworkIngress -> NetworkIngressRateLimitReached
   *   0x31 RateLimitedNetworkEgress -> NetworkEgressRateLimitReached
   *   0x32 RateLimitedMaxConnections -> MaximumConnectionsReached
   *   0x33 RateLimitedMaxCommands -> RequestRateLimitReached
   *
   * * Cluster Manager (body check tbd)
   *   HTTP 429, Body contains "Limit(s) exceeded [num_concurrent_requests]" ->
   * ConcurrentRequestLimitReached HTTP 429, Body contains "Limit(s) exceeded [ingress]" ->
   * NetworkIngressRateLimitReached HTTP 429, Body contains "Limit(s) exceeded [egress]" ->
   * NetworkEgressRateLimitReached Note: when multiple user limits are exceeded the array would
   * contain all the limits exceeded, as "Limit(s) exceeded [num_concurrent_requests,egress]"
   *
   * * Query
   *   Code 1191, Message E_SERVICE_USER_REQUEST_EXCEEDED -> RequestRateLimitReached
   *   Code 1192, Message E_SERVICE_USER_REQUEST_RATE_EXCEEDED -> ConcurrentRequestLimitReached
   *   Code 1193, Message E_SERVICE_USER_REQUEST_SIZE_EXCEEDED -> NetworkIngressRateLimitReached
   *   Code 1194, Message E_SERVICE_USER_RESULT_SIZE_EXCEEDED -> NetworkEgressRateLimitReached
   *
   * * Search
   *   HTTP 429, {"status": "fail", "error": "num_concurrent_requests, value >= limit"} ->
   * ConcurrentRequestLimitReached HTTP 429, {"status": "fail", "error": "num_queries_per_min, value
   * >= limit"}: -> RequestRateLimitReached HTTP 429, {"status": "fail", "error":
   * "ingress_mib_per_min >= limit"} -> NetworkIngressRateLimitReached HTTP 429, {"status": "fail",
   * "error": "egress_mib_per_min >= limit"} -> NetworkEgressRateLimitReached
   *
   * * Analytics
   *   Not applicable at the moment.
   *
   * * Views
   *   Not applicable.
   */
  rate_limited = 21,

  /**
   * This error is raised if the operation failed due to hitting a quota-limit on the server side.
   *
   * @note that this quota-limit might be implicitly configured if you are using Couchbase Capella
   * (for example when using the free tier). See the error context with the exception for further
   * information on the exact cause and check the documentation for potential remedy.
   */
  /*
   * Raised when a service decides that the caller must be limited due to exceeding a quota
   * threshold of some sort.
   *
   * * KeyValue
   *   0x34 ScopeSizeLimitExceeded
   *
   * * Cluster Manager
   *   HTTP 429, Body contains "Maximum number of collections has been reached for scope
   * "<scope_name>""
   *
   * * Query
   *   Code 5000, Body contains "Limit for number of indexes that can be created per scope has been
   * reached. Limit : value"
   *
   * * Search
   *   HTTP 400 (Bad request), {"status": "fail", "error": "rest_create_index: error creating index:
   * {indexName}, err: manager_api: CreateIndex, Prepare failed, err: num_fts_indexes (active +
   * pending) >= limit"}
   * * Analytics
   *   Not applicable at the moment
   *
   * * Views
   *   Not applicable
   */
  quota_limited = 22,
};

/**
 * Errors for related to Key/Value service (kv_engine)
 *
 * @since 1.0.0
 * @committed
 */
enum class key_value {
  /**
   * Indicates an operation failed because the key does not exist.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0x01
  document_not_found = 101,

  /**
   * In @ref collection::get_any_replica, the @ref collection::get_all_replicas returns an empty
   * stream because all the individual errors are dropped (all returned a @ref
   * key_value::document_not_found)
   *
   * @since 1.0.0
   * @committed
   */
  document_irretrievable = 102,

  /**
   * Returned when the server reports a temporary failure that is very likely to be lock-related
   * (like an already locked key or a bad cas used for unlock).
   *
   * @see <a href="https://issues.couchbase.com/browse/MB-13087">MB-13087</a> for an explanation of
   * why this is only <i>likely</i> to be lock-related.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0x09
  document_locked = 103,

  /**
   * The value that was sent was too large to store (typically > 20MB)
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0x03
  value_too_large = 104,

  /**
   * An operation which relies on the document not existing fails because the document existed.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0x02
  document_exists = 105,

  /**
   * The specified durability level is invalid.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xa0
  durability_level_not_available = 107,

  /**
   * The specified durability requirements are not currently possible (for example, there are an
   * insufficient number of replicas online).
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xa1
  durability_impossible = 108,

  /**
   * A sync-write has not completed in the specified time and has an ambiguous result -- it may have
   * succeeded or failed, but the final result is not yet known. A SEQNO OBSERVE operation is
   * performed and the vbucket UUID changes during polling.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xa3
  durability_ambiguous = 109,

  /**
   * A durable write is attempted against a key which already has a pending durable write.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xa2
  durable_write_in_progress = 110,

  /**
   * The server is currently working to synchronize all replicas for previously performed durable
   * operations (typically occurs after a rebalance).
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xa4
  durable_write_re_commit_in_progress = 111,

  /**
   * The path provided for a sub-document operation was not found.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc0
  path_not_found = 113,

  /**
   * The path provided for a sub-document operation did not match the actual structure of the
   * document.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc1
  path_mismatch = 114,

  /**
   * The path provided for a sub-document operation was not syntactically correct.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc2
  path_invalid = 115,

  /**
   * The path provided for a sub-document operation is too long, or contains too many independent
   * components.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc3
  path_too_big = 116,

  /**
   * The document contains too many levels to parse.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc4
  path_too_deep = 117,

  /**
   * The value provided, if inserted into the document, would cause the document to become too deep
   * for the server to accept.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xca
  value_too_deep = 118,

  /**
   * The value provided for a sub-document operation would invalidate the JSON structure of the
   * document if inserted as requested.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc5
  value_invalid = 119,

  /**
   * A sub-document operation is performed on a non-JSON document.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc6
  document_not_json = 120,

  /**
   * The existing number is outside the valid range for arithmetic operations.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc7
  number_too_big = 121,

  /**
   * The delta value specified for an operation is too large.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc8
  delta_invalid = 122,

  /**
   * A sub-document operation which relies on a path not existing encountered a path which exists.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code 0xc9
  path_exists = 123,

  /**
   * A macro was used which the server did not understand.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0xd0
  xattr_unknown_macro = 124,

  /**
   * A sub-document operation attempts to access multiple XATTRs in one operation.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0xcf
  xattr_invalid_key_combo = 126,

  /**
   * A sub-document operation attempts to access an unknown virtual attribute.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0xd1
  xattr_unknown_virtual_attribute = 127,

  /**
   * A sub-document operation attempts to modify a virtual attribute.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0xd2
  xattr_cannot_modify_virtual_attribute = 128,

  /**
   * The user does not have permission to access the attribute. Occurs when the user attempts to
   * read or write a system attribute (name starts with underscore) but does not have the
   * `SystemXattrRead` / `SystemXattrWrite` permission.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0x24
  xattr_no_access = 130,

  /**
   * The document is already locked - generally returned when an unlocking operation is being
   * performed.
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0x0e
  document_not_locked = 131,

  /**
   * Only deleted document could be revived
   *
   * @since 1.0.0
   * @committed
   */
  // KV Code: 0xd6
  cannot_revive_living_document = 132,

  /**
   * The provided mutation token is outdated compared to the current state of the server.
   *
   * @since 1.0.0
   * @uncommitted
   */
  // KV Code: 0xa8
  mutation_token_outdated = 133,

  /**
   * @internal
   */
  // KV Code: 0xa7
  range_scan_completed = 134,
};

/**
 * Errors related to Query service (N1QL)
 *
 * @since 1.0.0
 * @committed
 */
enum class query {
  /**
   * Indicates an operation failed because there has been an issue with the query planner.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When code range 4xxx other than those explicitly covered
  planning_failure = 201,

  /**
   * Indicates an operation failed because there has been an issue with the query planner or
   * similar.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When code range 12xxx and 14xxx (other than 12004 and 12016)
  index_failure = 202,

  /**
   * Indicates an operation failed because there has been an issue with query prepared statements.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When codes 4040, 4050, 4060, 4070, 4080, 4090
  prepared_statement_failure = 203,

  /**
   * This exception is raised when the server fails to execute a DML query.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised when code 12009 AND message does not contain CAS mismatch
  dml_failure = 204,
};

/**
 * Errors related to Analytics service (CBAS)
 *
 * @since 1.0.0
 * @committed
 */
enum class analytics {
  /**
   * The query failed to compile.
   *
   * @since 1.0.0
   * @committed
   */
  // Error range 24xxx (excluded are specific codes in the errors below)
  compilation_failure = 301,

  /**
   * Indicates the analytics server job queue is full
   *
   * @since 1.0.0
   * @committed
   */
  // Error code 23007
  job_queue_full = 302,

  /**
   * The dataset referenced in the query is not found on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Error codes 24044, 24045, 24025
  dataset_not_found = 303,

  /**
   * The dataverse referenced in the query is not found on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Error code 24034
  dataverse_not_found = 304,

  /**
   * The dataset referenced in the query is found on the server, when it should not be.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When 24040
  dataset_exists = 305,

  /**
   * The dataverse referenced in the query is found on the server, when it should not be.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When 24039
  dataverse_exists = 306,

  /**
   * The link referenced in the query is not found on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When 24006
  link_not_found = 307,

  /**
   * The link referenced in the query is found on the server, when it should not be.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised When 24055
  link_exists = 308,
};

/**
 * Errors related to Search service (CBFT)
 *
 * @since 1.0.0
 * @committed
 */
enum class search {
  /**
   * The index referenced in the query is not ready yet.
   *
   * @since 1.0.0
   * @uncommitted
   */
  index_not_ready = 401,

  /**
   * Consistency constraints cannot be accepted by the server.
   *
   * @since 1.0.0
   * @uncommitted
   */
  consistency_mismatch = 402,
};

/**
 * Errors related to Views service (CAPI)
 *
 * @since 1.0.0
 * @committed
 */
enum class view {
  /**
   * View does not exist on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Http status code 404
  // Reason or error contains "not_found"
  view_not_found = 501,

  /**
   * Design document does not exist on the server.
   *
   * @since 1.0.0
   * @committed
   */
  // Raised on the Management APIs only when
  // * Getting a design document
  // * Dropping a design document
  // * And the server returns 404
  design_document_not_found = 502,
};

/**
 * Errors related to management service (ns_server)
 *
 * @since 1.0.0
 * @committed
 */
enum class management {
  /// Raised from the collection management API
  collection_exists = 601,

  /// Raised from the collection management API
  scope_exists = 602,

  /// Raised from the user management API
  user_not_found = 603,

  /// Raised from the user management API
  group_not_found = 604,

  /// Raised from the bucket management API
  bucket_exists = 605,

  /// Raised from the user management API
  user_exists = 606,

  /// Raised from the bucket management API
  bucket_not_flushable = 607,

  /// Occurs if the function is not found
  /// name is "ERR_APP_NOT_FOUND_TS"
  eventing_function_not_found = 608,

  /// Occurs if the function is not deployed, but the action expects it to
  /// name is "ERR_APP_NOT_DEPLOYED"
  eventing_function_not_deployed = 609,

  /// Occurs when the compilation of the function code failed
  /// name is "ERR_HANDLER_COMPILATION"
  eventing_function_compilation_failure = 610,

  /// Occurs when source and metadata keyspaces are the same.
  /// name is "ERR_SRC_MB_SAME"
  eventing_function_identical_keyspace = 611,

  /// Occurs when a function is deployed but not “fully” bootstrapped
  /// name is "ERR_APP_NOT_BOOTSTRAPPED"
  eventing_function_not_bootstrapped = 612,

  /// Occurs when a function is deployed but the action does not expect it to
  /// name is "ERR_APP_NOT_UNDEPLOYED"
  eventing_function_deployed = 613,

  /// Occurs when a function is paused but the action does not expect it to
  /// name is "ERR_APP_PAUSED"
  eventing_function_paused = 614,
};

/**
 * Field-Level Encryption Error Definitions
 *
 * @since 1.0.0
 * @volatile
 */
enum class field_level_encryption {
  /**
   * Generic cryptography failure.
   *
   * @since 1.0.0
   * @volatile
   */
  generic_cryptography_failure = 700,

  /**
   * Raised by CryptoManager encrypt when encryption fails for any reason.
   *
   * Should have one of the other Field-Level Encryption errors as a cause.
   *
   * @since 1.0.0
   * @volatile
   */
  encryption_failure = 701,

  /**
   * Raised by CryptoManager.decrypt() when decryption fails for any reason.
   *
   * Should have one of the other Field-Level Encryption errors as a cause.
   *
   * @since 1.0.0
   * @volatile
   */
  decryption_failure = 702,

  /**
   * Raised when a crypto operation fails because a required key is missing.
   *
   * @since 1.0.0
   * @volatile
   */
  crypto_key_not_found = 703,

  /**
   * Raised by an encrypter or decrypter when the key does not meet expectations (for example, if
   * the key is the wrong size).
   *
   * @since 1.0.0
   * @volatile
   */
  invalid_crypto_key = 704,

  /**
   * Raised when a message cannot be decrypted because there is no decrypter registered for the
   * algorithm.
   *
   * @since 1.0.0
   * @volatile
   */
  decrypter_not_found = 705,

  /**
   * Raised when a message cannot be encrypted because there is no encrypter registered under the
   * requested alias.
   *
   * @since 1.0.0
   * @volatile
   */
  encrypter_not_found = 706,

  /**
   * Raised when decryption fails due to malformed input, integrity check failure, etc.
   *
   * @since 1.0.0
   * @volatile
   */
  invalid_ciphertext = 707,
};

/**
 * Errors related to networking IO
 *
 * @since 1.0.0
 * @uncommitted
 */
enum class network {
  /**
   * Unable to resolve node address
   *
   * @since 1.0.0
   * @uncommitted
   */
  resolve_failure = 1001,

  /**
   * No hosts left to connect
   *
   * @since 1.0.0
   * @uncommitted
   */
  no_endpoints_left = 1002,

  /**
   * Failed to complete protocol handshake
   *
   * @since 1.0.0
   * @uncommitted
   */
  handshake_failure = 1003,

  /**
   * Unexpected protocol state or input
   *
   * @since 1.0.0
   * @uncommitted
   */
  protocol_error = 1004,

  /**
   * Configuration is not available for some reason
   *
   * @since 1.0.0
   * @uncommitted
   */
  configuration_not_available = 1005,

  /**
   * The cluster object has been explicitly closed, no requests allowed
   *
   * @since 1.0.0
   * @uncommitted
   */
  cluster_closed = 1006,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  end_of_stream = 1007,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  need_more_data = 1008,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  operation_queue_closed = 1009,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  operation_queue_full = 1010,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  request_already_queued = 1011,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  request_cancelled = 1012,

  /**
   * @since 1.0.0
   * @uncommitted
   */
  bucket_closed = 1013,
};

/**
 * Errors related to streaming JSON parser
 *
 * @since 1.0.0
 * @uncommitted
 */
enum class streaming_json_lexer {
  garbage_trailing = 1101,
  special_expected = 1102,
  special_incomplete = 1103,
  stray_token = 1104,
  missing_token = 1105,
  cannot_insert = 1106,
  escape_outside_string = 1107,
  key_outside_object = 1108,
  string_outside_container = 1109,
  found_null_byte = 1110,
  levels_exceeded = 1111,
  bracket_mismatch = 1112,
  object_key_expected = 1113,
  weird_whitespace = 1114,
  unicode_escape_is_too_short = 1115,
  escape_invalid = 1116,
  trailing_comma = 1117,
  invalid_number = 1118,
  value_expected = 1119,
  percent_bad_hex = 1120,
  json_pointer_bad_path = 1121,
  json_pointer_duplicated_slash = 1122,
  json_pointer_missing_root = 1123,
  not_enough_memory = 1124,
  invalid_codepoint = 1125,
  generic = 1126,
  root_is_not_an_object = 1127,
  root_does_not_match_json_pointer = 1128,
};

/**
 * Errors related to a failed transaction
 *
 * @since 1.0.0
 * @uncommitted
 */
enum class transaction {
  failed = 1200,
  expired = 1201,
  failed_post_commit = 1202,
  ambiguous = 1203,
};

/**
 * Errors related to a failed transaction operation
 *
 * @since 1.0.0
 * @uncommitted
 */
enum class transaction_op {
  /**
   * @internal
   */
  generic = 1300,

  active_transaction_record_entry_not_found = 1301,
  active_transaction_record_full = 1302,
  active_transaction_record_not_found = 1303,
  document_already_in_transaction = 1304,
  document_exists = 1305,
  document_not_found = 1306,
  feature_not_available = 1307,
  transaction_aborted_externally = 1308,
  previous_operation_failed = 1309,
  forward_compatibility_failure = 1310,
  parsing_failure = 1311,
  illegal_state = 1312,
  service_not_available = 1313,
  request_canceled = 1314,
  concurrent_operations_detected_on_same_document = 1315,
  commit_not_permitted = 1316,
  rollback_not_permitted = 1317,
  transaction_already_aborted = 1318,
  transaction_already_committed = 1319,
  document_unretrievable = 1320,

  /**
   * @internal
   */
  transaction_op_failed = 1399,
};

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
inline std::error_code
make_error_code(common e) noexcept
{
  return { static_cast<int>(e), core::impl::common_category() };
}

inline std::error_code
make_error_code(key_value e)
{
  return { static_cast<int>(e), core::impl::key_value_category() };
}

inline std::error_code
make_error_code(query e)
{
  return { static_cast<int>(e), core::impl::query_category() };
}

inline std::error_code
make_error_code(search e)
{
  return { static_cast<int>(e), core::impl::search_category() };
}

inline std::error_code
make_error_code(view e)
{
  return { static_cast<int>(e), core::impl::view_category() };
}

inline std::error_code
make_error_code(analytics e)
{
  return { static_cast<int>(e), core::impl::analytics_category() };
}

inline std::error_code
make_error_code(management e)
{
  return { static_cast<int>(e), core::impl::management_category() };
}

inline std::error_code
make_error_code(network e)
{
  return { static_cast<int>(e), core::impl::network_category() };
}

inline std::error_code
make_error_code(field_level_encryption e)
{
  return { static_cast<int>(e), core::impl::field_level_encryption_category() };
}

inline std::error_code
make_error_code(streaming_json_lexer e)
{
  return { static_cast<int>(e), core::impl::streaming_json_lexer_category() };
}

inline std::error_code
make_error_code(transaction e)
{
  return { static_cast<int>(e), core::impl::transaction_category() };
}

inline std::error_code
make_error_code(transaction_op e)
{
  return { static_cast<int>(e), core::impl::transaction_op_category() };
}

#endif
} // namespace errc
} // namespace couchbase

#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
template<>
struct std::is_error_code_enum<couchbase::errc::common> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::key_value> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::query> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::analytics> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::search> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::view> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::management> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::field_level_encryption> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::network> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::streaming_json_lexer> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::transaction> : std::true_type {
};

template<>
struct std::is_error_code_enum<couchbase::errc::transaction_op> : std::true_type {
};

#endif
