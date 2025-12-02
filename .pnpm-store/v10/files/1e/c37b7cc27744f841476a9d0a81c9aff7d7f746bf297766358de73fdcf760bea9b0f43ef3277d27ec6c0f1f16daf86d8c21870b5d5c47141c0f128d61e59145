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

#include <cinttypes>

namespace couchbase::core::mcbp
{
/**
 * Specifies which kind of frame extra a particular block belongs to.
 * This is a private type since we automatically encode this internally based on
 * whether the specific frame block is attached to the packet.
 */
using frame_type = std::uint8_t;

static constexpr frame_type request_barrier{ 0 };
static constexpr frame_type request_sync_durability{ 1 };
static constexpr frame_type request_stream_id{ 2 };
static constexpr frame_type request_open_tracing{ 3 };
static constexpr frame_type request_user_impersonation{ 4 };
static constexpr frame_type request_preserve_expiry{ 5 };

static constexpr frame_type response_server_duration{ 0 };
static constexpr frame_type response_read_units{ 1 };
static constexpr frame_type response_write_units{ 2 };
} // namespace couchbase::core::mcbp
