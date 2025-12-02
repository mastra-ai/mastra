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

#include "core/design_document_namespace.hxx"
#include "core/error_context/view.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/io/http_traits.hxx"
#include "core/platform/uuid.h"
#include "core/public_fwd.hxx"
#include "core/timeout_defaults.hxx"
#include "core/view_on_error.hxx"
#include "core/view_scan_consistency.hxx"
#include "core/view_sort_order.hxx"

namespace couchbase::core::operations
{
struct document_view_response {
  struct meta_data {
    std::optional<std::uint64_t> total_rows{};
    std::optional<std::string> debug_info{};
  };

  struct row {
    std::optional<std::string> id;
    std::string key;
    std::string value;
  };

  struct problem {
    std::string code;
    std::string message;
  };

  error_context::view ctx;
  meta_data meta{};
  std::vector<document_view_response::row> rows{};
  std::optional<problem> error{};
};

struct document_view_request {
  using response_type = document_view_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::view;

  static const inline service_type type = service_type::view;
  static const inline std::string observability_identifier = "views";

  std::string bucket_name;
  std::string document_name;
  std::string view_name;
  design_document_namespace ns{ design_document_namespace::production };

  std::optional<std::uint64_t> limit;
  std::optional<std::uint64_t> skip;

  std::optional<couchbase::core::view_scan_consistency> consistency;

  std::vector<std::string> keys;

  std::optional<std::string> key;
  std::optional<std::string> start_key;
  std::optional<std::string> end_key;
  std::optional<std::string> start_key_doc_id;
  std::optional<std::string> end_key_doc_id;
  std::optional<bool> inclusive_end;

  std::optional<bool> reduce;
  std::optional<bool> group;
  std::optional<std::uint32_t> group_level;
  bool debug{ false };
  std::map<std::string, std::string> raw{};
  std::optional<bool> full_set;

  std::optional<couchbase::core::view_sort_order> order;
  std::optional<couchbase::core::view_on_error> on_error;
  std::vector<std::string> query_string{};
  std::optional<std::function<utils::json::stream_control(std::string)>> row_callback{};
  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{ nullptr };

  [[nodiscard]] auto encode_to(encoded_request_type& encoded,
                               http_context& context) -> std::error_code;

  [[nodiscard]] auto make_response(error_context::view&& ctx, const encoded_response_type& encoded)
    const -> document_view_response;
};

} // namespace couchbase::core::operations

namespace couchbase::core::io::http_traits
{
template<>
struct supports_parent_span<couchbase::core::operations::document_view_request>
  : public std::true_type {
};
} // namespace couchbase::core::io::http_traits
