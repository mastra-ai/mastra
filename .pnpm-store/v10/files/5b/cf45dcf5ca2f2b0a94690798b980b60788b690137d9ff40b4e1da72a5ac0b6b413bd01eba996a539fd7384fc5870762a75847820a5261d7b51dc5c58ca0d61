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

#include <optional>
#include <string>
#include <vector>

namespace couchbase::core::management::eventing
{

enum class function_status {
  /**
   * The function is not deployed.
   */
  undeployed,

  /**
   * The function is currently being undeployed.
   */
  undeploying,

  /**
   * The function is currently being deployed.
   */
  deploying,

  /**
   * The function is deployed.
   */
  deployed,

  /**
   * The function is paused.
   */
  paused,

  /**
   * The function is currently being paused.
   */
  pausing,
};

enum class function_deployment_status {
  deployed,
  undeployed,
};

enum class function_processing_status {
  running,
  paused,
};

struct function_state {
  std::string name;
  function_status status;
  std::uint64_t num_bootstrapping_nodes;
  std::uint64_t num_deployed_nodes;
  function_deployment_status deployment_status;
  function_processing_status processing_status;
  std::optional<bool> redeploy_required{};

  struct {
    std::optional<std::string> bucket_name{};
    std::optional<std::string> scope_name{};
  } internal{};
};

struct status {
  std::uint64_t num_eventing_nodes{};
  std::vector<function_state> functions{};
};

} // namespace couchbase::core::management::eventing
