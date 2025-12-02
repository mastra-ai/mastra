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

#include <chrono>
#include <optional>
#include <vector>

#include "core/utils/movable_function.hxx"
#include "error.hxx"

namespace couchbase::core::columnar
{
struct fetch_all_databases_options {
  std::optional<std::chrono::milliseconds> timeout{};
};

struct drop_database_options {
  std::string name;

  bool ignore_if_not_exists{};
  std::optional<std::chrono::milliseconds> timeout{};
};

struct create_database_options {
  std::string name;

  bool ignore_if_exists{};
  std::optional<std::chrono::milliseconds> timeout{};
};

struct database_metadata {
  std::string name;
  bool is_system_database;
};

using fetch_all_databases_callback =
  utils::movable_function<void(std::vector<database_metadata>, error)>;
using drop_database_callback = utils::movable_function<void(error)>;
using create_database_callback = utils::movable_function<void(error)>;
} // namespace couchbase::core::columnar
