/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#include "agent_group_config.hxx"

#include <spdlog/fmt/bundled/core.h>

#include <string>

namespace couchbase::core
{
auto
agent_group_config::to_string() const -> std::string
{
  return fmt::format(
    R"(#<agent_group_config:{} shim={}, user_agent="{}", default_retry_strategy={}, seed={}, key_value={}>)",
    static_cast<const void*>(this),
    shim.to_string(),
    user_agent,
    default_retry_strategy ? default_retry_strategy->to_string() : "(none)",
    seed.to_string(),
    key_value.to_string());
}
} // namespace couchbase::core
