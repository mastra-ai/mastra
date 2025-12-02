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

#include "search_index.hxx"

#include "core/utils/json.hxx"

#include <tao/json/value.hpp>

namespace
{
auto
has_vector_mapping_properties(tao::json::value properties) -> bool
{
  if (!properties.is_object()) {
    return false;
  }
  for (const auto& [_, prop] : properties.get_object()) {
    if (const auto* nested_properties = prop.find("properties"); nested_properties != nullptr) {
      if (has_vector_mapping_properties(*nested_properties)) {
        return true;
      }
    }
    const auto* fields = prop.find("fields");
    if (fields == nullptr || !fields->is_array()) {
      continue;
    }
    for (const auto& field : fields->get_array()) {
      const auto* type = field.find("type");
      if (type != nullptr && type->is_string()) {
        auto t = type->get_string();
        if (t == "vector" || t == "vector_base64") {
          return true;
        }
      }
    }
  };
  return false;
}
} // namespace

namespace couchbase::core::management::search
{
auto
index::is_vector_index() const -> bool
{
  if (params_json.empty()) {
    return false;
  }
  auto params = core::utils::json::parse(params_json);
  const auto* mapping = params.find("mapping");
  if (mapping == nullptr) {
    return false;
  }
  const auto* types = mapping->find("types");
  if (types == nullptr || !types->is_object()) {
    return false;
  }
  return std::any_of(types->get_object().begin(), types->get_object().end(), [](const auto& pair) {
    const auto* properties = pair.second.find("properties");
    return properties != nullptr && has_vector_mapping_properties(*properties);
  });
}
} // namespace couchbase::core::management::search
