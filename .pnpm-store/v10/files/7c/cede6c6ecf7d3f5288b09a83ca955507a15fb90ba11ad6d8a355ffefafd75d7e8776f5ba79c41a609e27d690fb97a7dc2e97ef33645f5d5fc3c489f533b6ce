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
#include <set>
#include <string>
#include <vector>

namespace couchbase::core::management::rbac
{
struct role {
  std::string name;
  std::optional<std::string> bucket{};
  std::optional<std::string> scope{};
  std::optional<std::string> collection{};
};

struct role_and_description : public role {
  std::string display_name{};
  std::string description{};
};

struct origin {
  std::string type;
  std::optional<std::string> name{};
};

struct role_and_origins : public role {
  std::vector<origin> origins{};
};

struct user {
  std::string username;
  std::optional<std::string> display_name{};
  // names of the groups
  std::set<std::string> groups{};
  // only roles assigned directly to the user (not inherited from groups)
  std::vector<role> roles{};
  // write only, it is not populated on reads
  std::optional<std::string> password{};
};

enum class auth_domain {
  unknown,
  local,
  external
};

struct user_and_metadata : public user {
  auth_domain domain{ auth_domain::unknown };
  // all roles associated with the user, including information about whether each role is innate or
  // inherited from a group
  std::vector<role_and_origins> effective_roles{};
  // timestamp of last password change
  std::optional<std::string> password_changed{};
  std::set<std::string> external_groups{};
};

struct group {
  std::string name;
  std::optional<std::string> description{};
  std::vector<role> roles{};
  std::optional<std::string> ldap_group_reference{};
};

} // namespace couchbase::core::management::rbac
