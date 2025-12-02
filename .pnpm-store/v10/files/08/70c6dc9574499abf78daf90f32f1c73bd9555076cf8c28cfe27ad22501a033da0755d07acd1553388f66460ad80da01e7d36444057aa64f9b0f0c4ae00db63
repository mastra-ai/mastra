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

#include <chrono>
#include <cstddef>

namespace couchbase::core::mcbp
{
/// takes a standard time duration and encodes it into the appropriate format for the server.
auto
encode_server_duration(std::chrono::microseconds duration) -> std::uint16_t;

/// takes an encoded operation duration from the server and converts it to a standard time duration.
auto
decode_server_duration(std::uint16_t encoded) -> std::chrono::microseconds;
} // namespace couchbase::core::mcbp
