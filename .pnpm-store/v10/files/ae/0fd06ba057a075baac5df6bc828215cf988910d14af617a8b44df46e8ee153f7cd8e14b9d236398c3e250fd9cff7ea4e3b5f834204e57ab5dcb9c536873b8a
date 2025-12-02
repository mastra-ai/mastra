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

#include <string>

namespace couchbase::core::management::search
{
struct index {
  std::string uuid;
  std::string name;
  std::string type;
  std::string params_json;

  std::string source_uuid;
  std::string source_name;
  std::string source_type;
  std::string source_params_json;

  std::string plan_params_json;

  [[nodiscard]] auto is_vector_index() const -> bool;
};
} // namespace couchbase::core::management::search
