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

#include <couchbase/common_options.hxx>
#include <couchbase/error.hxx>
#include <couchbase/management/bucket_settings.hxx>

#include <functional>

namespace couchbase
{
struct get_bucket_options : public common_options<get_bucket_options> {
public:
  struct built : public common_options<get_bucket_options>::built {
  };

  [[nodiscard]] auto build() const -> built
  {
    return { build_common_options() };
  }

private:
};

using get_bucket_handler = std::function<void(error, management::cluster::bucket_settings)>;
} // namespace couchbase
