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
class cluster_options;
/**
 * Base class for all defined configuration profiles
 *
 * Just implement the apply function, and register it.  See @ref
 * configuration_profiles_registry#register_profile()
 */
class configuration_profile
{
public:
  virtual ~configuration_profile() = default;

  /**
   * Implement this in derived class, modifying the @ref cluster_options passed in.
   *
   * @param options The options class which will be modified.
   * @since 1.0.0
   * @volatile
   */
  virtual void apply(cluster_options& options) = 0;
};
} // namespace couchbase
