/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include "server_duration.hxx"

#include <cmath>

namespace couchbase::core::mcbp
{
auto
encode_server_duration(std::chrono::microseconds duration) -> std::uint16_t
{
  auto encoded = std::pow(static_cast<double>(duration.count()) * 2, 1.0 / 1.74);
  if (encoded > 65535) {
    return 65535;
  }
  return static_cast<std::uint16_t>(encoded);
}

auto
decode_server_duration(std::uint16_t encoded) -> std::chrono::microseconds
{
  auto decoded = std::pow(static_cast<double>(encoded), 1.74) / 2;
  return std::chrono::microseconds{ static_cast<std::uint64_t>(decoded) };
}
} // namespace couchbase::core::mcbp
