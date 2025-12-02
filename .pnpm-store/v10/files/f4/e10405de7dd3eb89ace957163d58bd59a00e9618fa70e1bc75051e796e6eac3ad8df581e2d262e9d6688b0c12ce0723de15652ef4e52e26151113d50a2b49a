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

#include <chrono>
#include <stdexcept>
#include <string>

namespace couchbase::core::utils
{
class duration_parse_error : public std::runtime_error
{
public:
  explicit duration_parse_error(const std::string& msg)
    : std::runtime_error(msg)
  {
  }
};

/**
 * Parses a duration string.
 *
 * A duration string is a possibly signed sequence of decimal numbers, each with optional fraction
 * and a unit suffix, such as "300ms", "-1.5h" or "2h45m".
 *
 * Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
 */
auto
parse_duration(const std::string& text) -> std::chrono::nanoseconds;
} // namespace couchbase::core::utils
