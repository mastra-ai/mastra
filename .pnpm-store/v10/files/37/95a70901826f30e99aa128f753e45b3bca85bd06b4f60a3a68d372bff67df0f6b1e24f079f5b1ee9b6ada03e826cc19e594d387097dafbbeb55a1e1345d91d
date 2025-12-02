/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-Present Couchbase, Inc.
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
#include <cstdint>

namespace couchbase::core::impl
{
#ifndef COUCHBASE_CXX_CLIENT_DOXYGEN
/**
 * @return value that represents absence of expiry time
 *
 * @since 1.0.0
 * @internal
 */
std::uint32_t
expiry_none();

/**
 * @param expiry number of seconds
 * @return value encoding relative time for KV protocol
 *
 * @since 1.0.0
 * @internal
 */
std::uint32_t
expiry_relative(std::chrono::seconds expiry);

/**
 * @param expiry point in time
 * @return value encoding absolute time for KV protocol
 *
 * @since 1.0.0
 * @internal
 */
std::uint32_t
expiry_absolute(std::chrono::system_clock::time_point expiry);
#endif
} // namespace couchbase::core::impl
