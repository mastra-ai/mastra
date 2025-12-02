/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "query_result.hxx"

#include "core/utils/duration_parser.hxx"
#include "core/utils/json.hxx"
#include "core/utils/movable_function.hxx"
#include "error_codes.hxx"

#include <optional>

namespace couchbase::core::columnar
{
class query_result_impl
{
public:
  explicit query_result_impl(row_streamer rows)
    : rows_{ std::move(rows) }
  {
  }

  void next_row(
    utils::movable_function<void(std::variant<std::monostate, query_result_row, query_result_end>,
                                 error)> handler)
  {
    return rows_.next_row(
      [handler = std::move(handler)](const std::string& content, std::error_code ec) {
        if (ec) {
          return handler({}, { maybe_convert_error_code(ec) });
        }
        if (content.empty()) {
          return handler(query_result_end{}, {});
        }
        handler(query_result_row{ content }, {});
      });
  }

  auto metadata() -> std::optional<query_metadata>
  {
    // Metadata are available and have already been decoded
    if (metadata_.has_value()) {
      return metadata_;
    }
    auto raw = rows_.metadata();

    // Metadata is not available yet
    if (!raw.has_value()) {
      return {};
    }

    // Metadata are available but we need to decode them
    // TODO(dimitris): Handle gracefully the case where the encoded metadata is not well-formed,
    // maybe we need to return an error?
    auto meta_json = utils::json::parse(raw.value());
    const auto& metrics_json = meta_json.at("metrics");

    query_metadata meta{ meta_json.at("requestID").get_string() };
    meta.metrics.elapsed_time = utils::parse_duration(metrics_json.at("elapsedTime").get_string());
    meta.metrics.execution_time =
      utils::parse_duration(metrics_json.at("executionTime").get_string());
    meta.metrics.result_count = metrics_json.at("resultCount").get_unsigned();
    meta.metrics.result_size = metrics_json.at("resultSize").get_unsigned();
    meta.metrics.processed_objects = metrics_json.at("processedObjects").get_unsigned();

    if (const auto* w = meta_json.find("warnings"); w != nullptr) {
      for (const auto& warn_json : w->get_array()) {
        query_warning warn{
          static_cast<std::int32_t>(warn_json.at("code").get_signed()),
          warn_json.at("msg").get_string(),
        };
        meta.warnings.emplace_back(std::move(warn));
      }
    }

    metadata_ = meta;
    return meta;
  }

  void cancel()
  {
    rows_.cancel();
  }

private:
  row_streamer rows_;
  std::optional<query_metadata> metadata_;
};

query_result::query_result(row_streamer rows)
  : impl_{ std::make_shared<query_result_impl>(std::move(rows)) }
{
}

void
query_result::next_row(
  utils::movable_function<void(std::variant<std::monostate, query_result_row, query_result_end>,
                               error)> handler)
{
  impl_->next_row(std::move(handler));
}

void
query_result::cancel()
{
  impl_->cancel();
}

auto
query_result::metadata() -> std::optional<query_metadata>
{
  return impl_->metadata();
}
} // namespace couchbase::core::columnar
