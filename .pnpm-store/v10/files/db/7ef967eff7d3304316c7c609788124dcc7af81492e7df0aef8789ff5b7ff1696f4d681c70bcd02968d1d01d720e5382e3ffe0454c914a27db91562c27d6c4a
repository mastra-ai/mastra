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

#include "document_analytics.hxx"
#include "core/cluster_options.hxx"
#include "core/logger/logger.hxx"
#include "core/utils/duration_parser.hxx"
#include "core/utils/json.hxx"

#include <couchbase/error_codes.hxx>

#include <gsl/assert>
#include <tao/json/value.hpp>

namespace couchbase::core::operations
{
auto
analytics_request::encode_to(analytics_request::encoded_request_type& encoded,
                             http_context& context) -> std::error_code
{
  tao::json::value body{ { "statement", statement },
                         { "client_context_id", encoded.client_context_id },
                         { "timeout", fmt::format("{}ms", encoded.timeout.count()) } };

  for (const auto& [name, value] : named_parameters) {
    Expects(name.empty() == false);
    std::string key = name;
    if (key[0] != '$') {
      key.insert(key.begin(), '$');
    }
    body[key] = utils::json::parse(value);
  }
  if (!positional_parameters.empty()) {
    std::vector<tao::json::value> parameters;
    parameters.reserve(positional_parameters.size());
    for (const auto& value : positional_parameters) {
      parameters.emplace_back(utils::json::parse(value));
    }
    body["args"] = std::move(parameters);
  }
  if (readonly) {
    body["readonly"] = true;
  }
  if (scan_consistency) {
    switch (scan_consistency.value()) {
      case couchbase::core::analytics_scan_consistency::not_bounded:
        body["scan_consistency"] = "not_bounded";
        break;
      case couchbase::core::analytics_scan_consistency::request_plus:
        body["scan_consistency"] = "request_plus";
        break;
    }
  }
  if (scope_qualifier) {
    body["query_context"] = scope_qualifier;
  } else if (scope_name && bucket_name) {
    body["query_context"] = fmt::format("default:`{}`.`{}`", *bucket_name, *scope_name);
  }
  for (const auto& [name, value] : raw) {
    body[name] = utils::json::parse(value);
  }
  encoded.type = type;
  encoded.headers["content-type"] = "application/json";
  if (priority) {
    encoded.headers["analytics-priority"] = "-1";
  }
  encoded.method = "POST";
  encoded.path = "/query/service";
  body_str = utils::json::generate(body);
  encoded.body = body_str;
  if (context.options.show_queries) {
    CB_LOG_INFO("ANALYTICS: client_context_id=\"{}\", {}",
                encoded.client_context_id,
                utils::json::generate(body["statement"]));
  } else {
    CB_LOG_DEBUG("ANALYTICS: client_context_id=\"{}\", {}",
                 encoded.client_context_id,
                 utils::json::generate(body["statement"]));
  }
  if (row_callback) {
    encoded.streaming.emplace(couchbase::core::io::streaming_settings{
      "/results/^",
      4,
      std::move(row_callback.value()),
    });
  }
  return {};
}

auto
analytics_request::make_response(error_context::analytics&& ctx,
                                 const encoded_response_type& encoded) const -> analytics_response
{
  analytics_response response{ std::move(ctx) };
  response.ctx.statement = statement;
  response.ctx.parameters = body_str;
  if (!response.ctx.ec) {
    tao::json::value payload;
    try {
      payload = utils::json::parse(encoded.body.data());
    } catch (const tao::pegtl::parse_error&) {
      response.ctx.ec = errc::common::parsing_failure;
      return response;
    }
    if (const auto* i = payload.find("requestID"); i != nullptr) {
      response.meta.request_id = i->get_string();
    }
    if (const auto* i = payload.find("clientContextID"); i != nullptr) {
      response.meta.client_context_id = i->get_string();
      if (response.ctx.client_context_id != response.meta.client_context_id) {
        CB_LOG_WARNING(R"(unexpected clientContextID returned by service: "{}", expected "{}")",
                       response.meta.client_context_id,
                       response.ctx.client_context_id);
      }
    }
    if (auto& status_prop = payload.at("status"); status_prop.is_string()) {
      const auto& status = status_prop.get_string();
      if (status == "running") {
        response.meta.status = analytics_response::analytics_status::running;
      } else if (status == "success") {
        response.meta.status = analytics_response::analytics_status::success;
      } else if (status == "errors") {
        response.meta.status = analytics_response::analytics_status::errors;
      } else if (status == "completed") {
        response.meta.status = analytics_response::analytics_status::completed;
      } else if (status == "stopped") {
        response.meta.status = analytics_response::analytics_status::stopped;
      } else if (status == "timedout") {
        response.meta.status = analytics_response::analytics_status::timedout;
      } else if (status == "closed") {
        response.meta.status = analytics_response::analytics_status::closed;
      } else if (status == "fatal") {
        response.meta.status = analytics_response::analytics_status::fatal;
      } else if (status == "aborted") {
        response.meta.status = analytics_response::analytics_status::aborted;
      } else {
        response.meta.status = analytics_response::analytics_status::unknown;
      }
    } else {
      response.meta.status = analytics_response::analytics_status::unknown;
    }

    if (const auto* s = payload.find("signature"); s != nullptr) {
      response.meta.signature = couchbase::core::utils::json::generate(*s);
    }

    if (const auto* metrics = payload.find("metrics"); metrics != nullptr) {
      response.meta.metrics.result_count = metrics->at("resultCount").get_unsigned();
      response.meta.metrics.result_size = metrics->at("resultSize").get_unsigned();
      response.meta.metrics.elapsed_time =
        utils::parse_duration(metrics->at("elapsedTime").get_string());
      response.meta.metrics.execution_time =
        utils::parse_duration(metrics->at("executionTime").get_string());
      response.meta.metrics.processed_objects = metrics->at("processedObjects").get_unsigned();
      response.meta.metrics.error_count =
        metrics->optional<std::uint64_t>("errorCount").value_or(0);
      response.meta.metrics.warning_count =
        metrics->optional<std::uint64_t>("warningCount").value_or(0);
    }

    if (const auto* e = payload.find("errors"); e != nullptr) {
      for (const auto& err : e->get_array()) {
        couchbase::core::operations::analytics_response::analytics_problem problem;
        problem.code = err.at("code").get_unsigned();
        problem.message = err.at("msg").get_string();
        response.meta.errors.emplace_back(problem);
      }
    }

    if (const auto* w = payload.find("warnings"); w != nullptr) {
      for (const auto& warn : w->get_array()) {
        couchbase::core::operations::analytics_response::analytics_problem problem;
        problem.code = warn.at("code").get_unsigned();
        problem.message = warn.at("msg").get_string();
        response.meta.warnings.emplace_back(problem);
      }
    }

    if (const auto* r = payload.find("results"); r != nullptr) {
      response.rows.reserve(r->get_array().size());
      for (const auto& row : r->get_array()) {
        response.rows.emplace_back(couchbase::core::utils::json::generate(row));
      }
    }

    if (response.meta.status != analytics_response::analytics_status::success) {
      response.ctx.first_error_code = response.meta.errors.front().code;
      response.ctx.first_error_message = response.meta.errors.front().message;
      switch (response.ctx.first_error_code) {
        case 21002: /* Request timed out and will be cancelled */
          response.ctx.ec = errc::common::unambiguous_timeout;
          break;
        case 23007: /* Job queue is full with [string] jobs */
          response.ctx.ec = errc::analytics::job_queue_full;
          break;
        case 24044: /* Cannot find dataset [string] because there is no dataverse declared, nor an
                       alias with name [string]! */
        case 24045: /* Cannot find dataset [string] in dataverse [string] nor an alias with name
                       [string]! */
        case 24025: /* Cannot find dataset with name [string] in dataverse [string] */
          response.ctx.ec = errc::analytics::dataset_not_found;
          break;
        case 24034: /* Cannot find dataverse with name [string] */
          response.ctx.ec = errc::analytics::dataverse_not_found;
          break;
        case 24040: /* A dataset with name [string] already exists in dataverse [string] */
          response.ctx.ec = errc::analytics::dataset_exists;
          break;
        case 24039: /* A dataverse with this name [string] already exists. */
          response.ctx.ec = errc::analytics::dataverse_exists;
          break;
        case 24006: /* Link [string] does not exist | Link [string] does not exist */
          response.ctx.ec = errc::analytics::link_not_found;
          break;
        default:
          if (response.ctx.first_error_code >= 24000 && response.ctx.first_error_code < 25000) {
            response.ctx.ec = errc::analytics::compilation_failure;
          }
      }
      if (!response.ctx.ec) {
        response.ctx.ec = errc::common::internal_server_failure;
      }
    }
  }
  return response;
}
} // namespace couchbase::core::operations
