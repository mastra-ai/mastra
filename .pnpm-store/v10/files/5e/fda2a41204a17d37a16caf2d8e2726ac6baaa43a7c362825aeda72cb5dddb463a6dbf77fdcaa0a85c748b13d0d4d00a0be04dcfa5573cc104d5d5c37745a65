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

#pragma once

#include <gsl/span>

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

namespace couchbase::core::mcbp::big_endian
{
auto
read_uint64(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint64_t;

auto
read_uint32(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint32_t;

auto
read_uint16(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint16_t;

auto
read_uint8(gsl::span<std::byte> buffer, std::size_t offset) -> std::uint8_t;

auto
read(gsl::span<std::byte> buffer, std::size_t offset, std::size_t length) -> std::vector<std::byte>;

void
put_uint32(gsl::span<std::byte> bytes, std::uint32_t value);

void
put_uint64(gsl::span<std::byte> bytes, std::uint64_t value);
} // namespace couchbase::core::mcbp::big_endian
