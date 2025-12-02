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

#include "eventing_status.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::eventing::status> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::eventing::status
  {
    couchbase::core::management::eventing::status result;
    result.num_eventing_nodes = v.at("num_eventing_nodes").get_unsigned();
    if (const auto* apps = v.find("apps"); apps != nullptr && apps->is_array()) {
      for (const auto& app : apps->get_array()) {
        couchbase::core::management::eventing::function_state function{};
        function.name = app.at("name").get_string();
        function.num_deployed_nodes = app.at("num_deployed_nodes").get_unsigned();
        function.num_bootstrapping_nodes = app.at("num_bootstrapping_nodes").get_unsigned();

        if (app.at("deployment_status").get_boolean()) {
          function.deployment_status =
            couchbase::core::management::eventing::function_deployment_status::deployed;
        } else {
          function.deployment_status =
            couchbase::core::management::eventing::function_deployment_status::undeployed;
        }

        if (app.at("processing_status").get_boolean()) {
          function.processing_status =
            couchbase::core::management::eventing::function_processing_status::running;
        } else {
          function.processing_status =
            couchbase::core::management::eventing::function_processing_status::paused;
        }

        if (const auto* redeploy = app.find("redeploy_required");
            redeploy != nullptr && redeploy->is_boolean()) {
          function.redeploy_required = redeploy->get_boolean();
        }

        if (auto composite_status = app.at("composite_status").get_string();
            composite_status == "undeployed") {
          function.status = couchbase::core::management::eventing::function_status::undeployed;
        } else if (composite_status == "undeploying") {
          function.status = couchbase::core::management::eventing::function_status::undeploying;
        } else if (composite_status == "deploying") {
          function.status = couchbase::core::management::eventing::function_status::deploying;
        } else if (composite_status == "deployed") {
          function.status = couchbase::core::management::eventing::function_status::deployed;
        } else if (composite_status == "paused") {
          function.status = couchbase::core::management::eventing::function_status::paused;
        } else if (composite_status == "pausing") {
          function.status = couchbase::core::management::eventing::function_status::pausing;
        }

        if (const auto* function_scope = app.find("function_scope");
            function_scope != nullptr && function_scope->is_object()) {
          function.internal.bucket_name = function_scope->template optional<std::string>("bucket");
          function.internal.scope_name = function_scope->template optional<std::string>("scope");
        }

        result.functions.emplace_back(function);
      }
    }

    return result;
  }
};
} // namespace tao::json
