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

#include <map>
#include <mutex>
#include <optional>
#include <string>

namespace couchbase::core
{
class query_cache
{
public:
  struct entry {
    std::string name;
    std::optional<std::string> plan{};
  };

  void erase(const std::string& statement)
  {
    std::scoped_lock lock(store_mutex_);
    auto it = store_.find(statement);
    if (it == store_.end()) {
      return;
    }
    store_.erase(it);
  }

  void put(const std::string& statement, const std::string& prepared)
  {
    std::scoped_lock lock(store_mutex_);
    store_.try_emplace(statement, entry{ prepared });
  }

  void put(const std::string& statement, const std::string& name, const std::string& encoded_plan)
  {
    std::scoped_lock lock(store_mutex_);
    store_.try_emplace(statement, entry{ name, encoded_plan });
  }

  auto get(const std::string& statement) -> std::optional<entry>
  {
    std::scoped_lock lock(store_mutex_);
    auto it = store_.find(statement);
    if (it == store_.end()) {
      return {};
    }
    return it->second;
  }

private:
  std::map<std::string, entry> store_;
  std::mutex store_mutex_{};
};
} // namespace couchbase::core
