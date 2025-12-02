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

#include <cstdint>

namespace couchbase::core::utils
{
static constexpr auto
byte_swap(std::uint16_t value) -> std::uint16_t
{
  auto hi = static_cast<std::uint16_t>(value << 8U);
  auto lo = static_cast<std::uint16_t>(value >> 8U);
  return hi | lo;
}

static constexpr auto
byte_swap(std::uint32_t value) -> std::uint32_t
{
  std::uint32_t byte0 = value & 0x000000ffU;
  std::uint32_t byte1 = value & 0x0000ff00U;
  std::uint32_t byte2 = value & 0x00ff0000U;
  std::uint32_t byte3 = value & 0xff000000U;
  return (byte0 << 24) | (byte1 << 8) | (byte2 >> 8) | (byte3 >> 24);
}

static constexpr auto
byte_swap(std::uint64_t value) -> std::uint64_t
{
  std::uint64_t hi = byte_swap(static_cast<std::uint32_t>(value));
  std::uint32_t lo = byte_swap(static_cast<std::uint32_t>(value >> 32));
  return (hi << 32) | lo;
}
} // namespace couchbase::core::utils
