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

#include <string>

namespace couchbase
{
class password_authenticator
{
public:
  password_authenticator(std::string username, std::string password)
    : username_{ std::move(username) }
    , password_{ std::move(password) }
  {
  }

  static auto ldap_compatible(std::string username, std::string password) -> password_authenticator
  {
    auto result = password_authenticator(std::move(username), std::move(password));
    result.ldap_compatible_ = true;
    return result;
  }

private:
  std::string username_;
  std::string password_;
  bool ldap_compatible_{ false };

  friend class cluster_options;
};
} // namespace couchbase
