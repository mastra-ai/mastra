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

#include <spdlog/fmt/bundled/core.h>

#include <sstream>

namespace couchbase::core::utils
{
/**
 * Joins a list of strings together.
 */
template<typename Range>
auto
join_strings(const Range& values, const std::string& sep) -> std::string
{
  std::stringstream stream;
  auto sentinel = std::end(values);
  if (auto it = std::begin(values); it != sentinel) {
    stream << *it;
    ++it;
    while (it != sentinel) {
      stream << sep << *it;
      ++it;
    }
  }
  return stream.str();
}

/**
 * Joins a list of objects together using fmt:: for formatting.
 */
template<typename Range>
auto
join_strings_fmt(const Range& values, const std::string& sep) -> std::string
{
  std::stringstream stream;
  auto sentinel = std::end(values);
  if (auto it = std::begin(values); it != sentinel) {
    stream << fmt::format("{}", *it);
    ++it;
    while (it != sentinel) {
      stream << sep << fmt::format("{}", *it);
      ++it;
    }
  }
  return stream.str();
}

} // namespace couchbase::core::utils
