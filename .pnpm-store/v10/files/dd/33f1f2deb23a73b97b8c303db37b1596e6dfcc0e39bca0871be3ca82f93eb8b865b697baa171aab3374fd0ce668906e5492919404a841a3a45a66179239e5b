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

#include "error_map.hxx"

#include <gsl/narrow>
#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::error_map> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v) -> couchbase::core::error_map
  {
    couchbase::core::error_map result;
    result.id = couchbase::core::uuid::random();
    result.version = v.at("revision").template as<std::uint16_t>();
    result.revision = v.at("revision").template as<std::uint16_t>();
    for (const auto& [error, definition] : v.at("errors").get_object()) {
      auto code = gsl::narrow_cast<std::uint16_t>(std::stoul(error, nullptr, 16));
      const auto& info = definition.get_object();
      const auto& name = info.at("name").get_string();
      const auto& description = info.at("desc").get_string();
      std::set<couchbase::core::key_value_error_map_attribute> attributes{};

      for (const auto& attribute : info.at("attrs").get_array()) {
        if (const std::string& attr_val = attribute.get_string(); attr_val == "success") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::success);
        } else if (attr_val == "item-only") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::item_only);
        } else if (attr_val == "invalid-input") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::invalid_input);
        } else if (attr_val == "fetch-config") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::fetch_config);
        } else if (attr_val == "conn-state-invalidated") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::conn_state_invalidated);
        } else if (attr_val == "auth") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::auth);
        } else if (attr_val == "special-handling") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::special_handling);
        } else if (attr_val == "support") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::support);
        } else if (attr_val == "temp") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::temp);
        } else if (attr_val == "internal") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::internal);
        } else if (attr_val == "retry-now") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::retry_now);
        } else if (attr_val == "retry-later") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::retry_later);
        } else if (attr_val == "subdoc") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::subdoc);
        } else if (attr_val == "dcp") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::dcp);
        } else if (attr_val == "auto-retry") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::auto_retry);
        } else if (attr_val == "item-locked") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::item_locked);
        } else if (attr_val == "item-deleted") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::item_deleted);
        } else if (attr_val == "rate-limit") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::rate_limit);
        } else if (attr_val == "no-retry") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::no_retry);
        } else if (attr_val == "system-constraint") {
          attributes.insert(couchbase::core::key_value_error_map_attribute::system_constraint);
        } else {
          CB_LOG_WARNING(
            R"(skipping unknown attribute "{}" in error map for code={} and name="{}")",
            attr_val,
            code,
            name);
        }
      }
      result.errors.emplace(
        code, couchbase::core::key_value_error_map_info{ code, name, description, attributes });
    }
    return result;
  }
};
} // namespace tao::json
