/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include "error.hxx"

#include <cstddef>
#include <string>

namespace couchbase::core::columnar
{
struct retry_info {
  std::size_t retry_attempts{ 0 };
  std::string last_dispatched_to{};
  std::string last_dispatched_from{};
  std::string last_dispatched_to_host{};
  error last_error{};
};
} // namespace couchbase::core::columnar
