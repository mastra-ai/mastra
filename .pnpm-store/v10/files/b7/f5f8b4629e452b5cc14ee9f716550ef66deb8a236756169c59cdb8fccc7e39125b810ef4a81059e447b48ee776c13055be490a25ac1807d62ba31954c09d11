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

#include "core/error_context/key_value_error_map_info.hxx"

#include "core/platform/uuid.h"

#include <map>
#include <set>

namespace couchbase::core
{
struct error_map {
  uuid::uuid_t id{};
  std::uint16_t version{};
  std::uint16_t revision{};
  std::map<std::uint16_t, couchbase::core::key_value_error_map_info> errors{};
};
} // namespace couchbase::core
