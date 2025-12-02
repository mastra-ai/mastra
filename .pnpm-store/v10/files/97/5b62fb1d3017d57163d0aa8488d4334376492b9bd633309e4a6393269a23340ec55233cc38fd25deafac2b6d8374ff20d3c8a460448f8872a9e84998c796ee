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

#include "eventing_function.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::eventing::function> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::eventing::function
  {
    couchbase::core::management::eventing::function result;
    result.version = v.at("version").get_string();
    result.name = v.at("appname").get_string();
    result.code = v.at("appcode").get_string();
    result.enforce_schema = v.template optional<bool>("enforce_schema");
    result.handler_uuid = v.template optional<std::int64_t>("handleruuid");
    result.function_instance_id = v.template optional<std::string>("function_instance_id");

    if (const auto* depcfg = v.find("depcfg"); depcfg != nullptr && depcfg->is_object()) {
      result.source_keyspace.bucket = depcfg->at("source_bucket").get_string();
      result.source_keyspace.scope = depcfg->template optional<std::string>("source_scope");
      result.source_keyspace.collection =
        depcfg->template optional<std::string>("source_collection");
      result.metadata_keyspace.bucket = depcfg->at("metadata_bucket").get_string();
      result.metadata_keyspace.scope = depcfg->template optional<std::string>("metadata_scope");
      result.metadata_keyspace.collection =
        depcfg->template optional<std::string>("metadata_collection");

      if (const auto* constants = depcfg->find("constants");
          constants != nullptr && constants->is_array()) {
        for (const auto& constant : constants->get_array()) {
          couchbase::core::management::eventing::function_constant_binding binding;
          binding.alias = constant.at("value").get_string();
          binding.literal = constant.at("literal").get_string();
          result.constant_bindings.emplace_back(binding);
        }
      }

      if (const auto* buckets = depcfg->find("buckets");
          buckets != nullptr && buckets->is_array()) {
        for (const auto& bucket : buckets->get_array()) {
          couchbase::core::management::eventing::function_bucket_binding binding;
          binding.alias = bucket.at("alias").get_string();
          binding.name.bucket = bucket.at("bucket_name").get_string();
          binding.name.scope = bucket.template optional<std::string>("scope_name");
          binding.name.collection = bucket.template optional<std::string>("collection_name");
          if (const auto& access = bucket.at("access").get_string(); access == "rw") {
            binding.access =
              couchbase::core::management::eventing::function_bucket_access::read_write;
          } else if (access == "r") {
            binding.access =
              couchbase::core::management::eventing::function_bucket_access::read_only;
          }
          result.bucket_bindings.emplace_back(binding);
        }
      }

      if (const auto* urls = depcfg->find("curl"); urls != nullptr && urls->is_array()) {
        for (const auto& url : urls->get_array()) {
          couchbase::core::management::eventing::function_url_binding binding;
          binding.alias = url.at("value").get_string();
          binding.hostname = url.at("hostname").get_string();
          binding.allow_cookies = url.at("allow_cookies").get_boolean();
          binding.validate_ssl_certificate = url.at("validate_ssl_certificate").get_boolean();
          if (const auto& auth_type = url.at("auth_type").get_string(); auth_type == "no-auth") {
            binding.auth = couchbase::core::management::eventing::function_url_no_auth{};
          } else if (auth_type == "basic") {
            binding.auth = couchbase::core::management::eventing::function_url_auth_basic{
              url.at("username").get_string()
            };
          } else if (auth_type == "digest") {
            binding.auth = couchbase::core::management::eventing::function_url_auth_digest{
              url.at("username").get_string()
            };
          } else if (auth_type == "bearer") {
            binding.auth = couchbase::core::management::eventing::function_url_auth_bearer{
              url.at("bearer_key").get_string()
            };
          }
          result.url_bindings.emplace_back(binding);
        }
      }
    }

    if (const auto* settings = v.find("settings"); settings != nullptr && settings->is_object()) {
      result.settings.cpp_worker_count =
        settings->template optional<std::int64_t>("cpp_worker_thread_count");
      result.settings.description = settings->template optional<std::string>("description");
      result.settings.lcb_inst_capacity =
        settings->template optional<std::int64_t>("lcb_inst_capacity");
      result.settings.lcb_retry_count =
        settings->template optional<std::int64_t>("lcb_retry_count");
      result.settings.num_timer_partitions =
        settings->template optional<std::int64_t>("num_timer_partitions");
      result.settings.sock_batch_size =
        settings->template optional<std::int64_t>("sock_batch_size");
      result.settings.timer_context_size =
        settings->template optional<std::int64_t>("timer_context_size");
      result.settings.bucket_cache_size =
        settings->template optional<std::int64_t>("bucket_cache_size");
      result.settings.curl_max_allowed_resp_size =
        settings->template optional<std::int64_t>("curl_max_allowed_resp_size");
      result.settings.worker_count = settings->template optional<std::int64_t>("worker_count");
      result.settings.app_log_max_size =
        settings->template optional<std::int64_t>("app_log_max_size");
      result.settings.app_log_max_files =
        settings->template optional<std::int64_t>("app_log_max_files");
      result.settings.user_prefix = settings->template optional<std::string>("user_prefix");
      result.settings.app_log_dir = settings->template optional<std::string>("app_log_dir");
      result.settings.query_prepare_all = settings->template optional<bool>("n1ql_prepare_all");
      result.settings.enable_app_log_rotation =
        settings->template optional<bool>("enable_applog_rotation");

      if (const auto* duration = settings->find("tick_duration");
          duration != nullptr && duration->is_number()) {
        result.settings.tick_duration = std::chrono::milliseconds(duration->get_unsigned());
      }

      if (const auto* duration = settings->find("bucket_cache_age");
          duration != nullptr && duration->is_number()) {
        result.settings.bucket_cache_age = std::chrono::milliseconds(duration->get_unsigned());
      }

      if (const auto* duration = settings->find("checkpoint_interval");
          duration != nullptr && duration->is_number()) {
        result.settings.checkpoint_interval = std::chrono::seconds(duration->get_unsigned());
      }

      if (const auto* duration = settings->find("execution_timeout");
          duration != nullptr && duration->is_number()) {
        result.settings.execution_timeout = std::chrono::seconds(duration->get_unsigned());
      }

      if (const auto* duration = settings->find("lcb_timeout");
          duration != nullptr && duration->is_number()) {
        result.settings.lcb_timeout = std::chrono::seconds(duration->get_unsigned());
      }

      if (const auto* status = settings->find("deployment_status");
          status != nullptr && status->is_boolean()) {
        result.settings.deployment_status =
          status->get_boolean()
            ? couchbase::core::management::eventing::function_deployment_status::deployed
            : couchbase::core::management::eventing::function_deployment_status::undeployed;
      }

      if (const auto* status = settings->find("processing_status");
          status != nullptr && status->is_boolean()) {
        result.settings.processing_status =
          status->get_boolean()
            ? couchbase::core::management::eventing::function_processing_status::running
            : couchbase::core::management::eventing::function_processing_status::paused;
      }

      if (const auto* boundary = settings->find("dcp_stream_boundary");
          boundary != nullptr && boundary->is_string()) {
        const auto& boundary_string = boundary->get_string();
        if (boundary_string == "everything") {
          result.settings.dcp_stream_boundary =
            couchbase::core::management::eventing::function_dcp_boundary::everything;
        } else if (boundary_string == "from_now") {
          result.settings.dcp_stream_boundary =
            couchbase::core::management::eventing::function_dcp_boundary::from_now;
        }
      }

      if (const auto* log_level = settings->find("log_level");
          log_level != nullptr && log_level->is_string()) {
        if (const auto& log_level_string = log_level->get_string(); log_level_string == "DEBUG") {
          result.settings.log_level =
            couchbase::core::management::eventing::function_log_level::debug;
        } else if (log_level_string == "TRACE") {
          result.settings.log_level =
            couchbase::core::management::eventing::function_log_level::trace;
        } else if (log_level_string == "INFO") {
          result.settings.log_level =
            couchbase::core::management::eventing::function_log_level::info;
        } else if (log_level_string == "WARNING") {
          result.settings.log_level =
            couchbase::core::management::eventing::function_log_level::warning;
        } else if (log_level_string == "ERROR") {
          result.settings.log_level =
            couchbase::core::management::eventing::function_log_level::error;
        }
      }

      if (const auto* language_compatibility = settings->find("language_compatibility");
          language_compatibility != nullptr && language_compatibility->is_string()) {
        if (const auto& language_compatibility_string = language_compatibility->get_string();
            language_compatibility_string == "6.0.0") {
          result.settings.language_compatibility =
            couchbase::core::management::eventing::function_language_compatibility::version_6_0_0;
        } else if (language_compatibility_string == "6.5.0") {
          result.settings.language_compatibility =
            couchbase::core::management::eventing::function_language_compatibility::version_6_5_0;
        } else if (language_compatibility_string == "6.6.2") {
          result.settings.language_compatibility =
            couchbase::core::management::eventing::function_language_compatibility::version_6_6_2;
        } else if (language_compatibility_string == "7.2.0") {
          result.settings.language_compatibility =
            couchbase::core::management::eventing::function_language_compatibility::version_7_2_0;
        }
      }

      if (const auto* query_consistency = settings->find("n1ql_consistency");
          query_consistency != nullptr && query_consistency->is_string()) {
        if (const auto& query_consistency_string = query_consistency->get_string();
            query_consistency_string == "request") {
          result.settings.query_consistency = couchbase::query_scan_consistency::request_plus;
        } else if (query_consistency_string == "none") {
          result.settings.query_consistency = couchbase::query_scan_consistency::not_bounded;
        }
      }

      if (const auto* handler_headers = settings->find("handler_headers");
          handler_headers != nullptr && handler_headers->is_array()) {
        for (const auto& header : handler_headers->get_array()) {
          if (header.is_string()) {
            result.settings.handler_headers.push_back(header.get_string());
          }
        }
      }

      if (const auto* handler_footers = settings->find("handler_footers");
          handler_footers != nullptr && handler_footers->is_array()) {
        for (const auto& header : handler_footers->get_array()) {
          if (header.is_string()) {
            result.settings.handler_footers.push_back(header.get_string());
          }
        }
      }
    }

    if (const auto* function_scope = v.find("function_scope");
        function_scope != nullptr && function_scope->is_object()) {
      result.internal.bucket_name = function_scope->template optional<std::string>("bucket");
      result.internal.scope_name = function_scope->template optional<std::string>("scope");
    }

    return result;
  }
};
} // namespace tao::json
