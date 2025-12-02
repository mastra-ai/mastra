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

#include "core/error_context/query.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/io/http_traits.hxx"
#include "core/json_string.hxx"
#include "core/public_fwd.hxx"

#include "couchbase/query_profile.hxx"
#include "couchbase/query_scan_consistency.hxx"

#include <couchbase/mutation_token.hxx>

namespace couchbase::tracing
{
class request_span;
} // namespace couchbase::tracing

namespace couchbase::core::operations
{
struct query_response {
  struct query_metrics {
    std::chrono::nanoseconds elapsed_time{};
    std::chrono::nanoseconds execution_time{};
    std::uint64_t result_count{};
    std::uint64_t result_size{};
    std::uint64_t sort_count{};
    std::uint64_t mutation_count{};
    std::uint64_t error_count{};
    std::uint64_t warning_count{};
  };

  struct query_problem {
    std::uint64_t code{};
    std::string message{};
    std::optional<std::uint64_t> reason{};
    std::optional<bool> retry{};
  };

  struct query_meta_data {
    std::string request_id;
    std::string client_context_id;
    std::string status;
    std::optional<query_metrics> metrics{};
    std::optional<std::string> signature{};
    std::optional<std::string> profile{};
    std::optional<std::vector<query_problem>> warnings{};
    std::optional<std::vector<query_problem>> errors{};
  };

  error_context::query ctx;
  query_meta_data meta{};
  std::optional<std::string> prepared{};
  std::vector<std::string> rows{};
  std::string served_by_node{};
};

struct query_request {
  using response_type = query_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::query;

  static const inline service_type type = service_type::query;
  static const inline std::string observability_identifier = "query";

  std::string statement;

  bool adhoc{ true };
  bool metrics{ false };
  bool readonly{ false };
  bool flex_index{ false };
  bool preserve_expiry{ false };

  std::optional<bool> use_replica{};
  std::optional<std::uint64_t> max_parallelism{};
  std::optional<std::uint64_t> scan_cap{};
  std::optional<std::chrono::milliseconds> scan_wait{};
  std::optional<std::uint64_t> pipeline_batch{};
  std::optional<std::uint64_t> pipeline_cap{};
  std::optional<query_scan_consistency> scan_consistency{};
  std::vector<mutation_token> mutation_state{};
  std::optional<std::string> query_context{};
  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  std::optional<query_profile> profile{};

  std::map<std::string, couchbase::core::json_string, std::less<>> raw{};
  std::vector<couchbase::core::json_string> positional_parameters{};
  std::map<std::string, couchbase::core::json_string, std::less<>> named_parameters{};
  std::optional<std::function<utils::json::stream_control(std::string)>> row_callback{};
  std::optional<std::string> send_to_node{};

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               http_context& context) -> std::error_code;

  [[nodiscard]] auto make_response(error_context::query&& ctx,
                                   const encoded_response_type& encoded) -> query_response;

  std::optional<http_context> ctx_{};
  bool extract_encoded_plan_{ false };
  std::string body_str{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{ nullptr };
};

} // namespace couchbase::core::operations

namespace couchbase::core::io::http_traits
{
template<>
struct supports_sticky_node<couchbase::core::operations::query_request> : public std::true_type {
};

template<>
struct supports_parent_span<couchbase::core::operations::query_request> : public std::true_type {
};

template<>
struct supports_readonly<couchbase::core::operations::query_request> : public std::true_type {
};
} // namespace couchbase::core::io::http_traits
