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

#include <couchbase/error_codes.hxx>
#include <couchbase/query_options.hxx>
#include <couchbase/transactions/transaction_query_result.hxx>
#include <utility>

#include "core/cluster.hxx"
#include "core/error_context/transaction_op_error_context.hxx"
#include "core/operations/document_query.hxx"
#include "core/utils/binary.hxx"

namespace couchbase::core::impl
{
namespace
{
auto
map_status(std::string status) -> query_status
{
  std::transform(status.cbegin(), status.cend(), status.begin(), [](unsigned char c) {
    return std::tolower(c);
  });
  if (status == "running") {
    return query_status::running;
  }
  if (status == "success") {
    return query_status::success;
  }
  if (status == "errors") {
    return query_status::errors;
  }
  if (status == "completed") {
    return query_status::completed;
  }
  if (status == "stopped") {
    return query_status::stopped;
  }
  if (status == "timeout") {
    return query_status::timeout;
  }
  if (status == "closed") {
    return query_status::closed;
  }
  if (status == "fatal") {
    return query_status::fatal;
  }
  if (status == "aborted") {
    return query_status::aborted;
  }
  return query_status::unknown;
}

auto
map_rows(operations::query_response& resp) -> std::vector<codec::binary>
{
  std::vector<codec::binary> rows;
  rows.reserve(resp.rows.size());
  for (const auto& row : resp.rows) {
    rows.emplace_back(utils::to_binary(row));
  }
  return rows;
}

auto
map_warnings(operations::query_response& resp) -> std::vector<query_warning>
{
  std::vector<query_warning> warnings;
  if (resp.meta.warnings) {
    warnings.reserve(resp.meta.warnings->size());
    for (auto& warning : resp.meta.warnings.value()) {
      warnings.emplace_back(
        warning.code, std::move(warning.message), warning.reason, warning.retry);
    }
  }
  return warnings;
}

auto
map_metrics(operations::query_response& resp) -> std::optional<query_metrics>
{
  if (!resp.meta.metrics) {
    return {};
  }

  return query_metrics{
    resp.meta.metrics->elapsed_time, resp.meta.metrics->execution_time,
    resp.meta.metrics->result_count, resp.meta.metrics->result_size,
    resp.meta.metrics->sort_count,   resp.meta.metrics->mutation_count,
    resp.meta.metrics->error_count,  resp.meta.metrics->warning_count,
  };
}

auto
map_signature(operations::query_response& resp) -> std::optional<std::vector<std::byte>>
{
  if (!resp.meta.signature) {
    return {};
  }
  return utils::to_binary(resp.meta.signature.value());
}

auto
map_profile(operations::query_response& resp) -> std::optional<std::vector<std::byte>>
{
  if (!resp.meta.profile) {
    return {};
  }
  return utils::to_binary(resp.meta.profile.value());
}

auto
build_context(operations::query_response& resp) -> query_error_context
{
  return {
    resp.ctx.ec,
    resp.ctx.last_dispatched_to,
    resp.ctx.last_dispatched_from,
    resp.ctx.retry_attempts,
    std::move(resp.ctx.retry_reasons),
    resp.ctx.first_error_code,
    std::move(resp.ctx.first_error_message),
    std::move(resp.ctx.client_context_id),
    std::move(resp.ctx.statement),
    std::move(resp.ctx.parameters),
    std::move(resp.ctx.method),
    std::move(resp.ctx.path),
    resp.ctx.http_status,
    std::move(resp.ctx.http_body),
    std::move(resp.ctx.hostname),
    resp.ctx.port,
  };
}
} // namespace

auto
build_result(operations::query_response& resp) -> query_result
{
  return {
    query_meta_data{
      std::move(resp.meta.request_id),
      std::move(resp.meta.client_context_id),
      map_status(resp.meta.status),
      map_warnings(resp),
      map_metrics(resp),
      map_signature(resp),
      map_profile(resp),
    },
    map_rows(resp),
  };
}

auto
build_query_request(std::string statement,
                    std::optional<std::string> query_context,
                    query_options::built options) -> core::operations::query_request
{
  operations::query_request request{
    std::move(statement),     options.adhoc,
    options.metrics,          options.readonly,
    options.flex_index,       options.preserve_expiry,
    options.use_replica,      options.max_parallelism,
    options.scan_cap,         options.scan_wait,
    options.pipeline_batch,   options.pipeline_cap,
    options.scan_consistency, std::move(options.mutation_state),
    std::move(query_context), std::move(options.client_context_id),
    options.timeout,          options.profile,
  };
  request.parent_span = options.parent_span;
  if (!options.raw.empty()) {
    for (auto& [name, value] : options.raw) {
      request.raw[name] = std::move(value);
    }
  }
  if (!options.positional_parameters.empty()) {
    for (auto& value : options.positional_parameters) {
      request.positional_parameters.emplace_back(std::move(value));
    }
  }
  if (!options.named_parameters.empty()) {
    for (auto& [name, value] : options.named_parameters) {
      request.named_parameters[name] = std::move(value);
    }
  }
  return request;
}

auto
build_transaction_query_result(operations::query_response resp,
                               std::error_code txn_ec /*defaults to 0*/)
  -> std::pair<couchbase::core::transaction_op_error_context,
               couchbase::transactions::transaction_query_result>
{
  if (resp.ctx.ec) {
    if (resp.ctx.ec == errc::common::parsing_failure) {
      txn_ec = errc::transaction_op::parsing_failure;
    }
    if (!txn_ec) {
      // TODO(SA): review what our default should be...
      // no override error code was passed in, so default to not_set
      txn_ec = errc::transaction_op::generic;
    }
  }
  return {
    { txn_ec, build_context(resp) },
    { query_meta_data{
        std::move(resp.meta.request_id),
        std::move(resp.meta.client_context_id),
        map_status(resp.meta.status),
        map_warnings(resp),
        map_metrics(resp),
        map_signature(resp),
        map_profile(resp),
      },
      map_rows(resp) },
  };
}
auto
build_transaction_query_request(query_options::built opts) -> core::operations::query_request
{
  return core::impl::build_query_request("", {}, std::move(opts));
}
} // namespace couchbase::core::impl
