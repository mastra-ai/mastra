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

#include "rbac.hxx"

#include "core/logger/logger.hxx"

#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::management::rbac::user_and_metadata> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::rbac::user_and_metadata
  {
    couchbase::core::management::rbac::user_and_metadata result;
    if (const std::string& domain = v.at("domain").get_string(); domain == "local") {
      result.domain = couchbase::core::management::rbac::auth_domain::local;
    } else if (domain == "external") {
      result.domain = couchbase::core::management::rbac::auth_domain::external;
    } else {
      CB_LOG_ERROR(R"("unexpected domain for user with metadata: "{}")", domain);
    }
    result.username = v.at("id").get_string();
    if (const auto* display_name = v.find("name");
        display_name != nullptr && !display_name->get_string().empty()) {
      result.display_name = display_name->get_string();
    }
    result.password_changed = v.template optional<std::string>("password_change_date");
    if (const auto* external_groups = v.find("external_groups"); external_groups != nullptr) {
      for (const auto& group : external_groups->get_array()) {
        result.external_groups.insert(group.get_string());
      }
    }
    if (const auto* groups = v.find("groups"); groups != nullptr) {
      for (const auto& group : groups->get_array()) {
        result.groups.insert(group.get_string());
      }
    }
    if (const auto* roles = v.find("roles"); roles != nullptr) {
      for (const auto& entry : roles->get_array()) {
        couchbase::core::management::rbac::role_and_origins role{};
        role.name = entry.at("role").get_string();
        if (const auto* bucket = entry.find("bucket_name");
            bucket != nullptr && !bucket->get_string().empty()) {
          role.bucket = bucket->get_string();
        }
        if (const auto* scope = entry.find("scope_name");
            scope != nullptr && !scope->get_string().empty()) {
          role.scope = scope->get_string();
        }

        if (const auto* collection = entry.find("collection_name");
            collection != nullptr && !collection->get_string().empty()) {
          role.collection = collection->get_string();
        }

        if (const auto* origins = entry.find("origins"); origins != nullptr) {
          bool has_user_origin = false;
          for (const auto& ent : origins->get_array()) {
            couchbase::core::management::rbac::origin origin{};
            origin.type = ent.at("type").get_string();
            if (origin.type == "user") {
              has_user_origin = true;
            }
            const auto* name = ent.find("name");
            if (name != nullptr) {
              origin.name = name->get_string();
            }
            role.origins.push_back(origin);
          }
          if (has_user_origin) {
            result.roles.push_back(role);
          }
        } else {
          result.roles.push_back(role);
        }
        result.effective_roles.push_back(role);
      }
    }
    return result;
  }
};

template<>
struct traits<couchbase::core::management::rbac::role_and_description> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::rbac::role_and_description
  {
    couchbase::core::management::rbac::role_and_description result;
    result.name = v.at("role").get_string();
    result.display_name = v.at("name").get_string();
    result.description = v.at("desc").get_string();
    {
      const auto* bucket = v.find("bucket_name");
      if (bucket != nullptr && !bucket->get_string().empty()) {
        result.bucket = bucket->get_string();
      }
    }
    {
      const auto* scope = v.find("scope_name");
      if (scope != nullptr && !scope->get_string().empty()) {
        result.scope = scope->get_string();
      }
    }
    {
      const auto* collection = v.find("collection_name");
      if (collection != nullptr && !collection->get_string().empty()) {
        result.collection = collection->get_string();
      }
    }
    return result;
  }
};

template<>
struct traits<couchbase::core::management::rbac::group> {
  template<template<typename...> class Traits>
  static auto as(const tao::json::basic_value<Traits>& v)
    -> couchbase::core::management::rbac::group
  {
    couchbase::core::management::rbac::group result;
    result.name = v.at("id").get_string();
    {
      const auto* desc = v.find("description");
      if (desc != nullptr && !desc->get_string().empty()) {
        result.description = desc->get_string();
      }
    }
    {
      const auto* ldap_ref = v.find("ldap_group_ref");
      if (ldap_ref != nullptr && !ldap_ref->get_string().empty()) {
        result.ldap_group_reference = ldap_ref->get_string();
      }
    }
    {
      const auto* roles = v.find("roles");
      if (roles != nullptr) {
        for (const auto& entry : roles->get_array()) {
          couchbase::core::management::rbac::role role{};
          role.name = entry.at("role").get_string();
          {
            const auto* bucket = entry.find("bucket_name");
            if (bucket != nullptr && !bucket->get_string().empty()) {
              role.bucket = bucket->get_string();
            }
          }
          {
            const auto* scope = entry.find("scope_name");
            if (scope != nullptr && !scope->get_string().empty()) {
              role.scope = scope->get_string();
            }
          }
          {
            const auto* collection = entry.find("collection_name");
            if (collection != nullptr && !collection->get_string().empty()) {
              role.collection = collection->get_string();
            }
          }
          result.roles.push_back(role);
        }
      }
    }
    return result;
  }
};
} // namespace tao::json
