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

#include <cstddef>

namespace couchbase::core::mcbp
{
using datatype = std::byte;

// indicates the server believes the value payload to be JSON.
static constexpr datatype datatype_json{ 0x01 };

// indicates the value payload is compressed.
static constexpr datatype datatype_compressed{ 0x02 };

// indicates the inclusion of xattr data in the value payload.
static constexpr datatype datatype_xattrs{ 0x04 };

static constexpr auto
has_json_datatype(std::byte flags) -> bool
{
  return (flags & datatype_json) == datatype_json;
}
} // namespace couchbase::core::mcbp
