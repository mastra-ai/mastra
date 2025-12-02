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

#include "analytics.hxx"

#include "core/analytics_scan_consistency.hxx"
#include "core/operations/document_analytics.hxx"
#include "core/utils/binary.hxx"

#include <couchbase/analytics_metrics.hxx>
#include <couchbase/analytics_options.hxx>
#include <couchbase/analytics_result.hxx>
#include <couchbase/analytics_scan_consistency.hxx>
#include <couchbase/analytics_status.hxx>
#include <couchbase/analytics_warning.hxx>
#include <couchbase/codec/encoded_value.hxx>

#include <cstddef>
#include <optional>
#include <utility>
#include <vector>

namespace couchbase::core::impl
{
namespace
{

auto
map_status(core::operations::analytics_response::analytics_status status) -> analytics_status
{
  switch (status) {
    case core::operations::analytics_response::running:
      return analytics_status::running;
    case core::operations::analytics_response::success:
      return analytics_status::success;
    case core::operations::analytics_response::errors:
      return analytics_status::errors;
    case core::operations::analytics_response::completed:
      return analytics_status::completed;
    case core::operations::analytics_response::stopped:
      return analytics_status::stopped;
    case core::operations::analytics_response::timedout:
      return analytics_status::timeout;
    case core::operations::analytics_response::closed:
      return analytics_status::closed;
    case core::operations::analytics_response::fatal:
      return analytics_status::fatal;
    case core::operations::analytics_response::aborted:
      return analytics_status::aborted;
    case core::operations::analytics_response::unknown:
      return analytics_status::unknown;
  }
  return analytics_status::unknown;
}

auto
map_scan_consistency(std::optional<couchbase::analytics_scan_consistency> consistency)
  -> std::optional<couchbase::core::analytics_scan_consistency>
{
  if (consistency.has_value()) {
    switch (consistency.value()) {
      case couchbase::analytics_scan_consistency::not_bounded:
        return couchbase::core::analytics_scan_consistency::not_bounded;
      case couchbase::analytics_scan_consistency::request_plus:
        return couchbase::core::analytics_scan_consistency::request_plus;
    }
  }
  return {};
}

auto
map_rows(const core::operations::analytics_response& resp) -> std::vector<codec::binary>
{
  std::vector<codec::binary> rows;
  rows.reserve(resp.rows.size());
  for (const auto& row : resp.rows) {
    rows.emplace_back(core::utils::to_binary(row));
  }
  return rows;
}

auto
map_warnings(core::operations::analytics_response& resp) -> std::vector<analytics_warning>
{
  if (resp.meta.warnings.empty()) {
    return {};
  }
  std::vector<analytics_warning> warnings;
  warnings.reserve(resp.meta.warnings.size());
  for (auto& warning : resp.meta.warnings) {
    warnings.emplace_back(warning.code, std::move(warning.message));
  }
  return warnings;
}

auto
map_metrics(const core::operations::analytics_response& resp) -> analytics_metrics
{
  return analytics_metrics{
    resp.meta.metrics.elapsed_time,      resp.meta.metrics.execution_time,
    resp.meta.metrics.result_count,      resp.meta.metrics.result_size,
    resp.meta.metrics.processed_objects, resp.meta.metrics.error_count,
    resp.meta.metrics.warning_count,
  };
}

auto
map_signature(core::operations::analytics_response& resp) -> std::optional<std::vector<std::byte>>
{
  if (!resp.meta.signature) {
    return {};
  }
  return core::utils::to_binary(resp.meta.signature.value());
}

} // namespace

auto
build_result(core::operations::analytics_response& resp) -> analytics_result
{
  return {
    analytics_meta_data{
      std::move(resp.meta.request_id),
      std::move(resp.meta.client_context_id),
      map_status(resp.meta.status),
      map_warnings(resp),
      map_metrics(resp),
      map_signature(resp),
    },
    map_rows(resp),
  };
}

auto
build_analytics_request(std::string statement,
                        analytics_options::built options,
                        std::optional<std::string> bucket_name,
                        std::optional<std::string> scope_name)
  -> core::operations::analytics_request
{
  core::operations::analytics_request request{
    std::move(statement),
    options.readonly,
    options.priority,
    std::move(bucket_name),
    std::move(scope_name),
    {},
    map_scan_consistency(options.scan_consistency),
    {},
    {},
    {},
    {},
    std::move(options.client_context_id),
    options.timeout,
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

} // namespace couchbase::core::impl
