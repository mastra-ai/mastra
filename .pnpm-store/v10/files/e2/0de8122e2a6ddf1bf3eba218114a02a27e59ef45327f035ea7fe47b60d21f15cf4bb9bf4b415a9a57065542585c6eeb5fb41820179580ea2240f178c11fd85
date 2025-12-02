/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2021 Couchbase, Inc.
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

#include "eventing_upsert_function.hxx"

#include "core/utils/json.hxx"
#include "core/utils/url_codec.hxx"
#include "error_utils.hxx"

#include <spdlog/fmt/bundled/core.h>
#include <tao/json/contrib/traits.hpp>

namespace couchbase::core::operations::management
{
auto
eventing_upsert_function_request::encode_to(encoded_request_type& encoded,
                                            http_context& /* context */) const -> std::error_code
{
  tao::json::value body{};
  body["appname"] = function.name;
  body["appcode"] = function.code;
  if (function.version) {
    body["version"] = function.version.value();
  }
  if (function.enforce_schema) {
    body["enforce_schema"] = function.enforce_schema.value();
  }
  if (function.handler_uuid) {
    body["handleruuid"] = function.handler_uuid.value();
  }
  if (function.function_instance_id) {
    body["function_instance_id"] = function.function_instance_id;
  }

  if (bucket_name.has_value() && scope_name.has_value()) {
    tao::json::value function_scope{
      { "bucket", bucket_name.value() },
      { "scope", scope_name.value() },
    };
    body["function_scope"] = std::move(function_scope);
  }

  tao::json::value depcfg{};

  depcfg["source_bucket"] = function.source_keyspace.bucket;
  if (function.source_keyspace.scope) {
    depcfg["source_scope"] = function.source_keyspace.scope;
  }
  if (function.source_keyspace.collection) {
    depcfg["source_collection"] = function.source_keyspace.collection;
  }
  depcfg["metadata_bucket"] = function.metadata_keyspace.bucket;
  if (function.metadata_keyspace.scope) {
    depcfg["metadata_scope"] = function.metadata_keyspace.scope;
  }
  if (function.metadata_keyspace.collection) {
    depcfg["metadata_collection"] = function.metadata_keyspace.collection;
  }

  if (!function.constant_bindings.empty()) {
    std::vector<tao::json::value> constants{};
    constants.reserve(function.constant_bindings.size());
    for (const auto& constant : function.constant_bindings) {
      tao::json::value constant_json{
        { "value", constant.alias },
        { "literal", constant.literal },
      };
      constants.emplace_back(std::move(constant_json));
    }
    depcfg["constants"] = std::move(constants);
  }

  if (!function.url_bindings.empty()) {
    std::vector<tao::json::value> urls{};
    for (const auto& url : function.url_bindings) {
      tao::json::value binding{
        { "value", url.alias },
        { "hostname", url.hostname },
        { "allow_cookies", url.allow_cookies },
        { "validate_ssl_certificate", url.validate_ssl_certificate },
      };
      if (std::holds_alternative<couchbase::core::management::eventing::function_url_no_auth>(
            url.auth)) {
        binding["auth_type"] = "no-auth";
      } else if (std::holds_alternative<
                   couchbase::core::management::eventing::function_url_auth_basic>(url.auth)) {
        const auto& auth =
          std::get<couchbase::core::management::eventing::function_url_auth_basic>(url.auth);
        binding["auth_type"] = "basic";
        binding["username"] = auth.username;
        binding["password"] = auth.password;
      } else if (std::holds_alternative<
                   couchbase::core::management::eventing::function_url_auth_digest>(url.auth)) {
        const auto& auth =
          std::get<couchbase::core::management::eventing::function_url_auth_digest>(url.auth);
        binding["auth_type"] = "digest";
        binding["username"] = auth.username;
        binding["password"] = auth.password;
      } else if (std::holds_alternative<
                   couchbase::core::management::eventing::function_url_auth_bearer>(url.auth)) {
        const auto& auth =
          std::get<couchbase::core::management::eventing::function_url_auth_bearer>(url.auth);
        binding["auth_type"] = "bearer";
        binding["bearer_key"] = auth.key;
      }
      urls.emplace_back(binding);
    }
    depcfg["curl"] = std::move(urls);
  }

  if (!function.bucket_bindings.empty()) {
    std::vector<tao::json::value> buckets{};
    for (const auto& bucket : function.bucket_bindings) {
      tao::json::value binding{
        { "alias", bucket.alias },
        { "bucket_name", bucket.name.bucket },
      };
      if (bucket.name.scope) {
        binding["scope_name"] = bucket.name.scope;
      }
      if (bucket.name.collection) {
        binding["collection_name"] = bucket.name.collection;
      }
      switch (bucket.access) {
        case couchbase::core::management::eventing::function_bucket_access::read_only:
          binding["access"] = "r";
          break;
        case couchbase::core::management::eventing::function_bucket_access::read_write:
          binding["access"] = "rw";
          break;
      }
      buckets.emplace_back(binding);
    }
    depcfg["buckets"] = std::move(buckets);
  }

  tao::json::value settings{};

  if (function.settings.processing_status) {
    switch (function.settings.processing_status.value()) {
      case couchbase::core::management::eventing::function_processing_status::running:
        settings["processing_status"] = true;
        break;
      case couchbase::core::management::eventing::function_processing_status::paused:
        settings["processing_status"] = false;
        break;
    }
  } else {
    settings["processing_status"] = false;
  }

  if (function.settings.deployment_status) {
    switch (function.settings.deployment_status.value()) {
      case couchbase::core::management::eventing::function_deployment_status::deployed:
        settings["deployment_status"] = true;
        break;
      case couchbase::core::management::eventing::function_deployment_status::undeployed:
        settings["deployment_status"] = false;
        break;
    }
  } else {
    settings["deployment_status"] = false;
  }

  if (function.settings.cpp_worker_count) {
    settings["cpp_worker_thread_count"] = function.settings.cpp_worker_count;
  }

  if (function.settings.dcp_stream_boundary) {
    switch (function.settings.dcp_stream_boundary.value()) {
      case couchbase::core::management::eventing::function_dcp_boundary::everything:
        settings["dcp_stream_boundary"] = "everything";
        break;
      case couchbase::core::management::eventing::function_dcp_boundary::from_now:
        settings["dcp_stream_boundary"] = "from_now";
        break;
    }
  }

  if (function.settings.description) {
    settings["description"] = function.settings.description.value();
  }

  if (function.settings.log_level) {
    switch (function.settings.log_level.value()) {
      case couchbase::core::management::eventing::function_log_level::info:
        settings["log_level"] = "INFO";
        break;
      case couchbase::core::management::eventing::function_log_level::error:
        settings["log_level"] = "ERROR";
        break;
      case couchbase::core::management::eventing::function_log_level::warning:
        settings["log_level"] = "WARNING";
        break;
      case couchbase::core::management::eventing::function_log_level::debug:
        settings["log_level"] = "DEBUG";
        break;
      case couchbase::core::management::eventing::function_log_level::trace:
        settings["log_level"] = "TRACE";
        break;
    }
  }

  if (function.settings.language_compatibility) {
    switch (function.settings.language_compatibility.value()) {
      case couchbase::core::management::eventing::function_language_compatibility::version_6_0_0:
        settings["language_compatibility"] = "6.0.0";
        break;
      case couchbase::core::management::eventing::function_language_compatibility::version_6_5_0:
        settings["language_compatibility"] = "6.5.0";
        break;
      case couchbase::core::management::eventing::function_language_compatibility::version_6_6_2:
        settings["language_compatibility"] = "6.6.2";
        break;
      case couchbase::core::management::eventing::function_language_compatibility::version_7_2_0:
        settings["language_compatibility"] = "7.2.0";
        break;
    }
  }

  if (function.settings.execution_timeout) {
    settings["execution_timeout"] = function.settings.execution_timeout.value().count();
  }

  if (function.settings.lcb_timeout) {
    settings["lcb_timeout"] = function.settings.lcb_timeout.value().count();
  }

  if (function.settings.lcb_inst_capacity) {
    settings["lcb_inst_capacity"] = function.settings.lcb_inst_capacity.value();
  }

  if (function.settings.lcb_retry_count) {
    settings["lcb_retry_count"] = function.settings.lcb_retry_count.value();
  }

  if (function.settings.num_timer_partitions) {
    settings["num_timer_partitions"] = function.settings.num_timer_partitions.value();
  }

  if (function.settings.sock_batch_size) {
    settings["sock_batch_size"] = function.settings.sock_batch_size.value();
  }

  if (function.settings.tick_duration) {
    settings["tick_duration"] = function.settings.tick_duration.value().count();
  }

  if (function.settings.timer_context_size) {
    settings["timer_context_size"] = function.settings.timer_context_size.value();
  }

  if (function.settings.bucket_cache_size) {
    settings["bucket_cache_size"] = function.settings.bucket_cache_size.value();
  }

  if (function.settings.bucket_cache_age) {
    settings["bucket_cache_age"] = function.settings.bucket_cache_age.value().count();
  }

  if (function.settings.curl_max_allowed_resp_size) {
    settings["curl_max_allowed_resp_size"] = function.settings.curl_max_allowed_resp_size.value();
  }

  if (function.settings.worker_count) {
    settings["worker_count"] = function.settings.worker_count.value();
  }

  if (function.settings.app_log_max_size) {
    settings["app_log_max_size"] = function.settings.app_log_max_size.value();
  }

  if (function.settings.app_log_max_files) {
    settings["app_log_max_files"] = function.settings.app_log_max_files.value();
  }

  if (function.settings.checkpoint_interval) {
    settings["checkpoint_interval"] = function.settings.checkpoint_interval.value().count();
  }

  if (!function.settings.handler_headers.empty()) {
    settings["handler_headers"] = function.settings.handler_headers;
  }

  if (!function.settings.handler_footers.empty()) {
    settings["handler_footers"] = function.settings.handler_footers;
  }

  if (function.settings.query_prepare_all) {
    settings["n1ql_prepare_all"] = function.settings.query_prepare_all.value();
  }

  if (function.settings.enable_app_log_rotation) {
    settings["enable_applog_rotation"] = function.settings.enable_app_log_rotation.value();
  }

  if (function.settings.user_prefix) {
    settings["user_prefix"] = function.settings.user_prefix.value();
  }

  if (function.settings.app_log_dir) {
    settings["app_log_dir"] = function.settings.app_log_dir.value();
  }

  if (function.settings.query_consistency) {
    switch (function.settings.query_consistency.value()) {
      case query_scan_consistency::not_bounded:
        settings["n1ql_consistency"] = "none";
        break;
      case query_scan_consistency::request_plus:
        settings["n1ql_consistency"] = "request";
        break;
    }
  }

  body["depcfg"] = std::move(depcfg);
  body["settings"] = std::move(settings);

  encoded.headers["content-type"] = "application/json";
  encoded.method = "POST";
  encoded.path = fmt::format("/api/v1/functions/{}", function.name);
  if (bucket_name.has_value() && scope_name.has_value()) {
    encoded.path += fmt::format("?bucket={}&scope={}",
                                utils::string_codec::v2::path_escape(bucket_name.value()),
                                utils::string_codec::v2::path_escape(scope_name.value()));
  }
  encoded.body = utils::json::generate(body);
  return {};
}

auto
eventing_upsert_function_request::make_response(error_context::http&& ctx,
                                                const encoded_response_type& encoded) const
  -> eventing_upsert_function_response
{
  eventing_upsert_function_response response{ std::move(ctx) };
  if (!response.ctx.ec) {
    if (encoded.body.data().empty()) {
      return response;
    }
    tao::json::value payload{};
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      response.ctx.ec = errc::common::parsing_failure;
      return response;
    }
    auto [ec, problem] = extract_eventing_error_code(payload);
    if (ec) {
      response.ctx.ec = ec;
      response.error.emplace(problem);
      return response;
    }
  }
  return response;
}
} // namespace couchbase::core::operations::management
