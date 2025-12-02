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

#include "document_query.hxx"

#include "core/cluster_options.hxx"
#include "core/logger/logger.hxx"
#include "core/operations/management/error_utils.hxx"
#include "core/utils/duration_parser.hxx"
#include "core/utils/json.hxx"

#include <couchbase/error_codes.hxx>

#include <gsl/assert>
#include <tao/json/value.hpp>

#include <regex>

namespace couchbase::core::operations
{
auto
query_request::encode_to(query_request::encoded_request_type& encoded,
                         http_context& context) -> std::error_code
{
  ctx_.emplace(context);
  tao::json::value body{
    { "client_context_id", encoded.client_context_id },
  };
  if (adhoc) {
    body["statement"] = statement;
  } else {
    if (auto entry = ctx_->cache.get(statement)) {
      body["prepared"] = entry->name;
      if (entry->plan) {
        body["encoded_plan"] = entry->plan.value();
      }
    } else {
      body["statement"] = "PREPARE " + statement;
      if (context.config.capabilities.supports_enhanced_prepared_statements()) {
        body["auto_execute"] = true;
      } else {
        extract_encoded_plan_ = true;
      }
    }
  }
  auto timeout_for_service = encoded.timeout;
  if (timeout_for_service > std::chrono::milliseconds(5'000)) {
    /* if allocated timeout is large enough, tell query engine, that it is 500ms smaller, to make
     * sure we will always get response */
    timeout_for_service -= std::chrono::milliseconds(500);
  }
  body["timeout"] = fmt::format("{}ms", timeout_for_service.count());

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
  if (profile.has_value()) {
    switch (profile.value()) {
      case couchbase::query_profile::phases:
        body["profile"] = "phases";
        break;
      case couchbase::query_profile::timings:
        body["profile"] = "timings";
        break;
      case couchbase::query_profile::off:
        body["profile"] = "off";
        break;
    }
  }
  if (use_replica.has_value()) {
    if (context.config.capabilities.supports_read_from_replica()) {
      if (use_replica.value()) {
        body["use_replica"] = "on";
      } else {
        body["use_replica"] = "off";
      }
    } else {
      return errc::common::feature_not_available;
    }
  }
  if (max_parallelism) {
    body["max_parallelism"] = std::to_string(max_parallelism.value());
  }
  if (pipeline_cap) {
    body["pipeline_cap"] = std::to_string(pipeline_cap.value());
  }
  if (pipeline_batch) {
    body["pipeline_batch"] = std::to_string(pipeline_batch.value());
  }
  if (scan_cap) {
    body["scan_cap"] = std::to_string(scan_cap.value());
  }
  if (!metrics) {
    body["metrics"] = false;
  }
  if (readonly) {
    body["readonly"] = true;
  }
  if (flex_index) {
    body["use_fts"] = true;
  }
  if (preserve_expiry) {
    body["preserve_expiry"] = true;
  }
  bool check_scan_wait = false;
  if (scan_consistency) {
    switch (scan_consistency.value()) {
      case query_scan_consistency::not_bounded:
        body["scan_consistency"] = "not_bounded";
        break;
      case query_scan_consistency::request_plus:
        check_scan_wait = true;
        body["scan_consistency"] = "request_plus";
        break;
    }
  } else if (!mutation_state.empty()) {
    check_scan_wait = true;
    body["scan_consistency"] = "at_plus";
    tao::json::value scan_vectors = tao::json::empty_object;
    for (const auto& token : mutation_state) {
      auto* bucket = scan_vectors.find(token.bucket_name());
      if (bucket == nullptr) {
        scan_vectors[token.bucket_name()] = tao::json::empty_object;
        bucket = scan_vectors.find(token.bucket_name());
      }
      auto& bucket_obj = bucket->get_object();
      bucket_obj[std::to_string(token.partition_id())] =
        std::vector<tao::json::value>{ token.sequence_number(),
                                       std::to_string(token.partition_uuid()) };
    }
    body["scan_vectors"] = scan_vectors;
  }
  if (check_scan_wait && scan_wait) {
    body["scan_wait"] = fmt::format("{}ms", scan_wait.value().count());
  }

  if (query_context) {
    body["query_context"] = query_context.value();
  }
  for (const auto& [name, value] : raw) {
    body[name] = utils::json::parse(value);
  }
  encoded.type = type;
  encoded.headers["connection"] = "keep-alive";
  encoded.headers["content-type"] = "application/json";
  encoded.method = "POST";
  encoded.path = "/query/service";
  body_str = utils::json::generate(body);
  encoded.body = body_str;

  tao::json::value stmt = body["statement"];
  tao::json::value prep = body["prepared"];
  if (!stmt.is_string()) {
    stmt = statement;
  }
  if (!prep.is_string()) {
    prep = false;
  }
  body.erase("statement");
  body.erase("prepared");
  if (ctx_->options.show_queries) {
    CB_LOG_INFO("QUERY: client_context_id=\"{}\", prep={}, {}, options={}",
                encoded.client_context_id,
                utils::json::generate(prep),
                utils::json::generate(stmt),
                utils::json::generate(body));
  } else {
    CB_LOG_DEBUG("QUERY: client_context_id=\"{}\", prep={}, {}, options={}",
                 encoded.client_context_id,
                 utils::json::generate(prep),
                 utils::json::generate(stmt),
                 utils::json::generate(body));
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
query_request::make_response(error_context::query&& ctx,
                             const encoded_response_type& encoded) -> query_response
{
  query_response response{ std::move(ctx) };
  response.ctx.statement = statement;
  response.ctx.parameters = body_str;
  response.served_by_node = fmt::format("{}:{}", response.ctx.hostname, response.ctx.port);
  if (!response.ctx.ec) {
    if (encoded.body.data().empty()) {
      switch (encoded.status_code) {
        case 503:
          response.ctx.ec = errc::common::service_not_available;
          break;

        case 500:
        default:
          response.ctx.ec = errc::common::internal_server_failure;
          break;
      }
      return response;
    }
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
    if (const auto* s = payload.find("status"); s != nullptr) {
      response.meta.status = payload.at("status").get_string();
    }
    if (const auto* s = payload.find("signature"); s != nullptr) {
      response.meta.signature = couchbase::core::utils::json::generate(*s);
    }
    if (const auto* c = payload.find("prepared"); c != nullptr) {
      response.prepared = c->get_string();
    }
    if (const auto* p = payload.find("profile"); p != nullptr) {
      response.meta.profile = couchbase::core::utils::json::generate(*p);
    }

    if (const auto* m = payload.find("metrics"); m != nullptr) {
      query_response::query_metrics meta_metrics{};
      meta_metrics.result_count = m->at("resultCount").get_unsigned();
      meta_metrics.result_size = m->at("resultSize").get_unsigned();
      meta_metrics.elapsed_time = utils::parse_duration(m->at("elapsedTime").get_string());
      meta_metrics.execution_time = utils::parse_duration(m->at("executionTime").get_string());
      meta_metrics.sort_count = m->template optional<std::uint64_t>("sortCount").value_or(0);
      meta_metrics.mutation_count =
        m->template optional<std::uint64_t>("mutationCount").value_or(0);
      meta_metrics.error_count = m->template optional<std::uint64_t>("errorCount").value_or(0);
      meta_metrics.warning_count = m->template optional<std::uint64_t>("warningCount").value_or(0);
      response.meta.metrics.emplace(meta_metrics);
    }

    if (const auto* e = payload.find("errors"); e != nullptr) {
      std::vector<couchbase::core::operations::query_response::query_problem> problems{};
      for (const auto& err : e->get_array()) {
        couchbase::core::operations::query_response::query_problem problem;
        problem.code = err.at("code").get_unsigned();
        problem.message = err.at("msg").get_string();
        if (const auto* reason = err.find("reason"); reason != nullptr && reason->is_object()) {
          problem.reason = reason->optional<std::uint64_t>("code");
          problem.retry = reason->optional<bool>("retry");
        }
        problems.emplace_back(problem);
      }
      response.meta.errors.emplace(problems);
    }

    if (const auto* w = payload.find("warnings"); w != nullptr) {
      std::vector<couchbase::core::operations::query_response::query_problem> problems{};
      for (const auto& warn : w->get_array()) {
        couchbase::core::operations::query_response::query_problem problem;
        problem.code = warn.at("code").get_unsigned();
        problem.message = warn.at("msg").get_string();
        problems.emplace_back(problem);
      }
      response.meta.warnings.emplace(problems);
    }

    if (const auto* r = payload.find("results"); r != nullptr) {
      response.rows.reserve(r->get_array().size());
      for (const auto& row : r->get_array()) {
        response.rows.emplace_back(couchbase::core::utils::json::generate(row));
      }
    }

    if (response.meta.status == "success") {
      if (response.prepared) {
        if (ctx_.has_value()) {
          ctx_->cache.put(statement, response.prepared.value());
        }
      } else if (extract_encoded_plan_) {
        extract_encoded_plan_ = false;
        if (response.rows.size() == 1) {
          tao::json::value row{};
          try {
            row = utils::json::parse(response.rows[0]);
          } catch (const tao::pegtl::parse_error&) {
            response.ctx.ec = errc::common::parsing_failure;
            return response;
          }
          auto* plan = row.find("encoded_plan");
          auto* name = row.find("name");
          if (plan != nullptr && name != nullptr) {
            if (ctx_) {
              ctx_->cache.put(statement, name->get_string(), plan->get_string());
            }
            throw couchbase::core::priv::retry_http_request{};
          }
          response.ctx.ec = errc::query::prepared_statement_failure;

        } else {
          response.ctx.ec = errc::query::prepared_statement_failure;
        }
      }
    } else {
      if (response.meta.errors && !response.meta.errors->empty()) {
        response.ctx.first_error_code = response.meta.errors->front().code;
        response.ctx.first_error_message = response.meta.errors->front().message;
        switch (response.ctx.first_error_code) {
          case 1065: /* IKey: "service.io.request.unrecognized_parameter" */
            if ((response.ctx.first_error_message.find("Unrecognized parameter in request") !=
                 std::string::npos) &&
                (response.ctx.first_error_message.find("preserve_expiry") != std::string::npos)) {
              response.ctx.ec = errc::common::feature_not_available;
            } else {
              response.ctx.ec = errc::common::invalid_argument;
            }
            break;
          case 1080: /* IKey: "timeout" */
            response.ctx.ec = errc::common::unambiguous_timeout;
            break;
          case 3000: /* IKey: "parse.syntax_error" */
            response.ctx.ec = errc::common::parsing_failure;
            break;
          case 4040: /* IKey: "plan.build_prepared.no_such_name" */
          case 4050: /* IKey: "plan.build_prepared.unrecognized_prepared" */
          case 4070: /* IKey: "plan.build_prepared.decoding" */
            if (ctx_.has_value()) {
              ctx_->cache.erase(statement);
            }
            throw couchbase::core::priv::retry_http_request{};
          case 4060: /* IKey: "plan.build_prepared.no_such_name" */
          case 4080: /* IKey: "plan.build_prepared.name_encoded_plan_mismatch" */
          case 4090: /* IKey: "plan.build_prepared.name_not_in_encoded_plan" */
            response.ctx.ec = errc::query::prepared_statement_failure;
            break;
          case 4300: /* IKey: "plan.new_index_already_exists" */
            response.ctx.ec = errc::common::index_exists;
            break;
          case 5000: /* IKey: "Internal Error" */
            if (std::regex_search(response.ctx.first_error_message,
                                  std::regex{ ".*[iI]ndex .*already exist.*" })) {
              response.ctx.ec = errc::common::index_exists;
            } else if (response.ctx.first_error_message.find("Index does not exist") !=
                         std::string::npos ||
                       std::regex_search(response.ctx.first_error_message,
                                         std::regex{ ".*[iI]ndex .*[nN]ot [fF]ound.*" })) {
              response.ctx.ec = errc::common::index_not_found;
            } else if (response.ctx.first_error_message.find("Bucket Not Found") !=
                       std::string::npos) {
              response.ctx.ec = errc::common::bucket_not_found;
            }
            break;
          case 12009: /* IKey: "datastore.couchbase.DML_error" */
            if (response.ctx.first_error_message.find("CAS mismatch") != std::string::npos) {
              response.ctx.ec = errc::common::cas_mismatch;
            } else {
              switch (response.meta.errors->front().reason.value_or(0)) {
                case 12033:
                  response.ctx.ec = errc::common::cas_mismatch;
                  break;
                case 17014:
                  response.ctx.ec = errc::key_value::document_not_found;
                  break;
                case 17012:
                  response.ctx.ec = errc::key_value::document_exists;
                  break;
                default:
                  response.ctx.ec = errc::query::dml_failure;
                  break;
              }
            }
            break;

          case 12004: /* IKey: "datastore.couchbase.primary_idx_not_found" */
          case 12016: /* IKey: "datastore.couchbase.index_not_found" */
            response.ctx.ec = errc::common::index_not_found;
            break;
          case 13014: /* IKey: "datastore.couchbase.insufficient_credentials" */
            response.ctx.ec = errc::common::authentication_failure;
            break;
          default:
            if ((response.ctx.first_error_code >= 12000 && response.ctx.first_error_code < 13000) ||
                (response.ctx.first_error_code >= 14000 && response.ctx.first_error_code < 15000)) {
              response.ctx.ec = errc::query::index_failure;
            } else if (response.ctx.first_error_code >= 4000 &&
                       response.ctx.first_error_code < 5000) {
              response.ctx.ec = errc::query::planning_failure;
            }
            break;
        }
        if (!response.ctx.ec) {
          auto common_ec = management::extract_common_query_error_code(
            response.ctx.first_error_code, response.ctx.first_error_message);
          if (common_ec) {
            response.ctx.ec = common_ec.value();
          }
        }
      }
      if (!response.ctx.ec) {
        CB_LOG_TRACE("Unexpected error returned by query engine: client_context_id=\"{}\", body={}",
                     response.ctx.client_context_id,
                     encoded.body.data());
        response.ctx.ec = errc::common::internal_server_failure;
      }
    }
  }
  return response;
}
} // namespace couchbase::core::operations
