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

#include "core/error_context/http.hxx"
#include "core/operations/management/query_index_build.hxx"
#include "core/operations/management/query_index_get_all_deferred.hxx"
#include "core/operations/operation_traits.hxx"
#include "core/query_context.hxx"
#include "couchbase/management/query_index.hxx"

namespace couchbase::core::operations
{
namespace management
{
struct query_index_build_deferred_response {
  struct query_problem {
    std::uint64_t code{};
    std::string message{};
  };
  error_context::http ctx;
  std::string status{};
  std::vector<query_problem> errors{};
};

struct query_index_build_deferred_request {
  using response_type = query_index_build_deferred_response;
  using encoded_request_type = io::http_request;
  using encoded_response_type = io::http_response;
  using error_context_type = error_context::http;

  static const inline service_type type = service_type::query;
  static const inline std::string observability_identifier = "manager_query_build_deferred_indexes";

  static constexpr auto namespace_id = "default";

  std::string bucket_name;
  std::optional<std::string> scope_name;
  std::optional<std::string> collection_name;
  query_context query_ctx;

  std::optional<std::string> client_context_id{};
  std::optional<std::chrono::milliseconds> timeout{};

  [[nodiscard]] response_type make_response(error_context::http&& ctx,
                                            const encoded_response_type& /* encoded */) const
  {
    return { std::move(ctx) };
  }

  static query_index_build_deferred_response convert_response(
    operations::management::query_index_get_all_deferred_response resp)
  {
    return { std::move(resp.ctx), resp.status };
  }

  static query_index_build_deferred_response convert_response(
    operations::management::query_index_build_response resp)
  {
    query_index_build_deferred_response response{ std::move(resp.ctx), resp.status };
    for (const auto& err : resp.errors) {
      query_index_build_deferred_response::query_problem error;
      error.code = err.code;
      error.message = err.message;
      response.errors.emplace_back(error);
    }
    return response;
  }

  template<typename Core, typename Handler>
  void execute(Core core, Handler handler)
  {
    core->execute(query_index_get_all_deferred_request{ bucket_name,
                                                        scope_name.value_or(""),
                                                        collection_name.value_or(""),
                                                        query_ctx,
                                                        client_context_id,
                                                        timeout },
                  [core,
                   handler = std::move(handler),
                   bucket_name = bucket_name,
                   scope_name = scope_name.value_or(""),
                   collection_name = collection_name.value_or(""),
                   query_ctx = query_ctx,
                   client_context_id = client_context_id,
                   timeout = timeout](query_index_get_all_deferred_response resp1) mutable {
                    auto list_resp = std::move(resp1);
                    if (list_resp.ctx.ec || list_resp.index_names.empty()) {
                      return handler(convert_response(std::move(list_resp)));
                    }
                    core->execute(query_index_build_request{ std::move(bucket_name),
                                                             scope_name,
                                                             collection_name,
                                                             query_ctx,
                                                             std::move(list_resp.index_names),
                                                             client_context_id,
                                                             timeout },
                                  [handler = std::move(handler)](
                                    query_index_build_response build_resp) mutable {
                                    return handler(convert_response(std::move(build_resp)));
                                  });
                  });
  }
};
} // namespace management

template<>
struct is_compound_operation<management::query_index_build_deferred_request>
  : public std::true_type {
};

} // namespace couchbase::core::operations