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

#include <couchbase/configuration_profile.hxx>

#include <memory>
#include <string>
#include <vector>

namespace couchbase
{
class cluster_options;

/**
 *  Registry for defining configuration profiles.
 */
class configuration_profiles_registry
{
public:
  /**
   * Register a @ref configuration_profile, and associate it with a name.
   *
   * @param name  The name to use to refer to the profile.
   * @param profile Instance of class derived from @ref configuration_profile, which is being
   * registered.
   *
   * @since 1.0.0
   * @volatile
   */
  static void register_profile(const std::string& name,
                               std::shared_ptr<configuration_profile> profile);

  /**
   * Apply a profile to an instance of @ref cluster_options.
   *
   * @param name
   * @param options
   *
   * @since 1.0.0
   * @internal
   */
  static void apply_profile(const std::string& name, couchbase::cluster_options& options);

  static auto available_profiles() -> std::vector<std::string>;
};
} // namespace couchbase
