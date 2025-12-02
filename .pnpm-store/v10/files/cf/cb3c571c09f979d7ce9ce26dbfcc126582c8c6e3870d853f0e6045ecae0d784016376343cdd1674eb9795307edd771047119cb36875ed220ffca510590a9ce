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

#include <couchbase/durability_level.hxx>

#include <cinttypes>
#include <optional>
#include <vector>

namespace couchbase::core::protocol
{

/**
 * Encodes durability level with optional timeout and appends result to @c framing_extras.
 *
 * @param framing_extras output storage for extras
 * @param level durability level
 * @param timeout durability timeout
 *
 * @since 1.1.0
 * @internal
 */
void
add_durability_frame_info(std::vector<std::byte>& framing_extras,
                          durability_level level,
                          std::optional<std::uint16_t> timeout);

/**
 * Appends "preserve expiry" frame to @c framing_extras.
 *
 * @param framing_extras output storage for extras
 *
 * @since 1.1.0
 * @internal
 */
void
add_preserve_expiry_frame_info(std::vector<std::byte>& framing_extras);
} // namespace couchbase::core::protocol
