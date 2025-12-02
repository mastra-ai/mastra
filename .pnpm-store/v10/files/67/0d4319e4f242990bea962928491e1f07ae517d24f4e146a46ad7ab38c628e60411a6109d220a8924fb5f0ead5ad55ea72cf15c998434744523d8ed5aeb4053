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

#include "core/config_listener.hxx"

#include <memory>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase::core::impl
{
class bootstrap_state_listener
{
public:
  virtual ~bootstrap_state_listener() = default;
  virtual void report_bootstrap_error(const std::string& endpoint, std::error_code ec) = 0;
  virtual void report_bootstrap_success(const std::vector<std::string>& endpoints) = 0;

  virtual void register_config_listener(std::shared_ptr<config_listener> listener) = 0;
  virtual void unregister_config_listener(std::shared_ptr<config_listener> listener) = 0;
};
} // namespace couchbase::core::impl
