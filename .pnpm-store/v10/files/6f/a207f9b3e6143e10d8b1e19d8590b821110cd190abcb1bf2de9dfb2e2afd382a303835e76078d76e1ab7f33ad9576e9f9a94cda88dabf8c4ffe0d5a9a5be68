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

#include <sstream>
#include <string>

namespace couchbase::core::utils
{
struct analytics {
  static auto uncompound_name(const std::string& name) -> std::string
  {
    std::stringstream ss;
    ss << '`';
    for (const auto symbol : name) {
      if (symbol == '/') {
        ss << "`.`";
      } else {
        ss << symbol;
      }
    }
    ss << '`';
    return ss.str();
  }
};
} // namespace couchbase::core::utils