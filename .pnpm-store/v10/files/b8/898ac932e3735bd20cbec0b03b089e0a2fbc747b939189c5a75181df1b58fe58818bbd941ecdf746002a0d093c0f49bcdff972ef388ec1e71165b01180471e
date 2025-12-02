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

#pragma once

#include "core/pending_operation.hxx"
#include "database_management_options.hxx"
#include "error.hxx"

#include <chrono>
#include <memory>

#include <tl/expected.hpp>

namespace couchbase::core
{
class http_component;

namespace columnar
{
class management_component_impl;

class management_component
{
public:
  management_component(http_component http, std::chrono::milliseconds default_timeout);

  auto database_fetch_all(const fetch_all_databases_options& options,
                          fetch_all_databases_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

  auto database_drop(const drop_database_options& options, drop_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

  auto database_create(const create_database_options& options, create_database_callback&& callback)
    -> tl::expected<std::shared_ptr<pending_operation>, error>;

private:
  std::shared_ptr<management_component_impl> impl_;
};
} // namespace columnar
} // namespace couchbase::core
