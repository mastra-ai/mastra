/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "cluster_state.hxx"
#include "service_type.hxx"
#include "utils/movable_function.hxx"

#include <memory>
#include <system_error>
#include <vector>

namespace couchbase
{
class retry_strategy;
} // namespace couchbase

namespace couchbase::core
{
class wait_until_ready_options
{
public:
  cluster_state desired_state{ cluster_state::online };
  std::vector<service_type> services{
    service_type::query,
    service_type::analytics,
    service_type::search,
    service_type::management,
  };
  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
};

class wait_until_ready_result
{
};

using wait_until_ready_callback =
  utils::movable_function<void(wait_until_ready_result result, std::error_code ec)>;

} // namespace couchbase::core
