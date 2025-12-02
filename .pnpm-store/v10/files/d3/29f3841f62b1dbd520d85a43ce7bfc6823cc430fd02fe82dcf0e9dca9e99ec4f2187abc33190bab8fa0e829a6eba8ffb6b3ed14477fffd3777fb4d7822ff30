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
#include <vector>

#include "core/platform/uuid.h"

namespace couchbase::core::topology
{
struct collections_manifest {
  struct collection {
    std::uint64_t uid{};
    std::string name;
    std::int32_t max_expiry{ 0 };
    std::optional<bool> history{};
  };

  struct scope {
    std::uint64_t uid{};
    std::string name;
    std::vector<collection> collections;
  };

  uuid::uuid_t id;
  std::uint64_t uid{};
  std::vector<scope> scopes;
};
} // namespace couchbase::core::topology
