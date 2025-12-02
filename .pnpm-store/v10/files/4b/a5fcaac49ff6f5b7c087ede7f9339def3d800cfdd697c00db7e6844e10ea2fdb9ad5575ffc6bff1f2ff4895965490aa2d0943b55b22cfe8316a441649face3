/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "couchbase/query_scan_consistency.hxx"
#include "eventing_status.hxx"

#include <chrono>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace couchbase::core::management::eventing
{

struct function_keyspace {
  std::string bucket;
  std::optional<std::string> scope{};
  std::optional<std::string> collection{};
};

enum class function_dcp_boundary {
  everything,
  from_now,
};

enum class function_language_compatibility {
  version_6_0_0,
  version_6_5_0,
  version_6_6_2,
  version_7_2_0,
};

enum class function_log_level {
  info,
  error,
  warning,
  debug,
  trace,
};

struct function_settings {
  /** number of threads each worker utilizes */
  std::optional<std::int64_t> cpp_worker_count{};
  /** indicates where to start dcp stream from */
  std::optional<function_dcp_boundary> dcp_stream_boundary{};
  /** free form text for user to describe the handler. no functional role */
  std::optional<std::string> description{};
  /** indicates if the function is deployed */
  std::optional<function_deployment_status> deployment_status{};
  /** indicates if the function is running */
  std::optional<function_processing_status> processing_status{};
  /** level of detail in system logging */
  std::optional<function_log_level> log_level{};
  /** eventing language version this handler assumes in terms of syntax and behavior */
  std::optional<function_language_compatibility> language_compatibility{};
  /** maximum time the handler can run before it is forcefully terminated */
  std::optional<std::chrono::seconds> execution_timeout{};
  /** maximum number of libcouchbase connections that may be opened and pooled */
  std::optional<std::int64_t> lcb_inst_capacity{};
  /** number of retries of retriable libcouchbase failures. 0 keeps trying till execution_timeout */
  std::optional<std::int64_t> lcb_retry_count{};
  /** maximum time the lcb command is waited until completion before we terminate the request */
  std::optional<std::chrono::seconds> lcb_timeout{};
  /** consistency level used by n1ql statements in the handler */
  std::optional<query_scan_consistency> query_consistency{};
  /** number of timer shards. defaults to number of vbuckets */
  std::optional<std::int64_t> num_timer_partitions{};
  /** batch size for messages from producer to consumer */
  std::optional<std::int64_t> sock_batch_size{};
  /** duration to log stats from this handler */
  std::optional<std::chrono::milliseconds> tick_duration{};
  /** size limit of timer context object */
  std::optional<std::int64_t> timer_context_size{};
  /** key prefix for all data stored in metadata by this handler */
  std::optional<std::string> user_prefix{};
  /** maximum size in bytes the bucket cache can grow to */
  std::optional<std::int64_t> bucket_cache_size{};
  /** time in milliseconds after which a cached bucket object is considered stale */
  std::optional<std::chrono::milliseconds> bucket_cache_age{};
  /** maximum allowable curl call response in 'MegaBytes'. Setting the value to 0 lifts the upper
   * limit off. This parameters affects v8 engine stability since it defines the maximum amount of
   * heap space acquired by a curl call */
  std::optional<std::int64_t> curl_max_allowed_resp_size{};
  /** automatically prepare all n1ql statements in the handler */
  std::optional<bool> query_prepare_all{};
  /** number of worker processes handler utilizes on each eventing node */
  std::optional<std::int64_t> worker_count{};
  /** code to automatically prepend to top of handler code */
  std::vector<std::string> handler_headers{};
  /** code to automatically append to bottom of handler code */
  std::vector<std::string> handler_footers{};
  /** enable rotating this handlers log() message files */
  std::optional<bool> enable_app_log_rotation{};
  /** directory to write content of log() message files */
  std::optional<std::string> app_log_dir{};
  /** rotate logs when file grows to this size in bytes approximately */
  std::optional<std::int64_t> app_log_max_size{};
  /** number of log() message files to retain when rotating */
  std::optional<std::int64_t> app_log_max_files{};
  /** number of seconds before writing a progress checkpoint */
  std::optional<std::chrono::seconds> checkpoint_interval{};
};

enum class function_bucket_access {
  read_only,
  read_write,
};

struct function_bucket_binding {
  /** symbolic name used in code to refer to this binding */
  std::string alias;
  /** name of the bucket with optional scope and collection */
  function_keyspace name;
  /** bucket access level (read or read+write) */
  function_bucket_access access{ function_bucket_access::read_write };
};

struct function_url_no_auth {
};

struct function_url_auth_basic {
  std::string username;
  std::string password{};
};

struct function_url_auth_digest {
  std::string username;
  std::string password{};
};

struct function_url_auth_bearer {
  std::string key{};
};

struct function_url_binding {
  std::string alias;
  std::string hostname;
  bool allow_cookies{ false };
  bool validate_ssl_certificate{ true };
  std::variant<function_url_no_auth,
               function_url_auth_basic,
               function_url_auth_digest,
               function_url_auth_bearer>
    auth{ function_url_no_auth{} };
};

struct function_constant_binding {
  /** alias name of the constant binding */
  std::string alias;
  /** literal value bound to the alias name */
  std::string literal;
};

struct function {
  std::string name;
  /** handler source code */
  std::string code;
  /** keyspace to store eventing checkpoints and timers */
  eventing::function_keyspace metadata_keyspace{};
  /** keyspace to listen to for document mutations */
  eventing::function_keyspace source_keyspace{};
  /** authoring tool. use 'external' if authored or edited outside eventing UI */
  std::optional<std::string> version{};
  /** enforces stricter validation for all settings and configuration fields */
  std::optional<bool> enforce_schema{};
  /** unique id of the the handler. generated by server */
  std::optional<std::int64_t> handler_uuid{};
  /** unique id of the deployment of the handler. generated by server */
  std::optional<std::string> function_instance_id{};
  std::vector<function_bucket_binding> bucket_bindings{};
  std::vector<function_url_binding> url_bindings{};
  std::vector<function_constant_binding> constant_bindings{};
  function_settings settings{};

  struct {
    std::optional<std::string> bucket_name{};
    std::optional<std::string> scope_name{};
  } internal{};
};
} // namespace couchbase::core::management::eventing
