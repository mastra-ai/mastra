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

#pragma once

#include "core/error_context/http.hxx"
#include "core/io/http_context.hxx"
#include "core/io/http_message.hxx"
#include "core/management/eventing_function.hxx"
#include "core/platform/uuid.h"
#include "core/timeout_defaults.hxx"
#include "eventing_problem.hxx"

namespace couchbase::core::operations::management
{
struct eventing_get_function_response {
  error_context::http ctx;
  couchbase::core::management::eventing::function function{};
  std::optional<eventing_problem> error{};
};

struct eventing_get_function_request {
  using response_type = eventing_get_function_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::http;

  static const inline service_type type = service_type::eventing;
  static const inline std::string observability_identifier = "manager_eventing_get_function";

  std::string name;
  std::optional<std::string> bucket_name{};
  std::optional<std::string> scope_name{};

  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  [[nodiscard]] std::error_code encode_to(encoded_request_type& encoded,
                                          http_context& context) const;

  [[nodiscard]] eventing_get_function_response make_response(
    error_context::http&& ctx,
    const encoded_response_type& encoded) const;
};
} // namespace couchbase::core::operations::management
