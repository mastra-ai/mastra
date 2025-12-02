/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc.
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
#include <string>
#include <string_view>

namespace couchbase::core
{
/**
 * Get the value for a string of hex characters
 *
 * @param buffer the input buffer
 * @return the value of the string
 * @throws std::invalid_argument for an invalid character in the string
 *         std::overflow_error if the input string won't fit in std::uint64_t
 */
std::uint64_t
from_hex(std::string_view buffer);

std::string
to_hex(std::uint8_t val);

std::string
to_hex(std::uint16_t val);

std::string
to_hex(std::uint32_t val);

std::string
to_hex(std::uint64_t val);

std::string
to_hex(std::string_view buffer);

} // namespace couchbase::core
