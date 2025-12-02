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

#include "cluster_options_fwd.hxx"
#include "config_profile.hxx"

#include <map>
#include <memory>
#include <mutex>
#include <string>

namespace couchbase::core
{
// this class just registers the known profiles defined above, and allows access to them.
class config_profiles
{
private:
  std::map<std::string, std::shared_ptr<config_profile>, std::less<>> profiles_;
  mutable std::mutex mut_;

public:
  config_profiles() noexcept;

  void apply(std::string_view profile_name, couchbase::core::cluster_options& opts);

  template<typename T, typename... Args>
  void register_profile(const std::string& name, Args... args)
  {
    // This will just add it, doesn't look to see if it is overwriting an existing profile.
    // TODO: perhaps add a template Args param?
    // TODO: should we make this thread-safe?   Easy enough here, but we'd need to make the
    //   singleton thread-safe too.
    const std::scoped_lock lock(mut_);
    profiles_.emplace(std::make_pair(name, std::make_shared<T>(args...)));
  }
};

config_profiles&
known_profiles();

} // namespace couchbase::core
