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

#include "frame_type.hxx"

#include <cstddef>
#include <vector>

namespace couchbase::core::mcbp
{
// unsupported_frame is used to include an unsupported frame type in the packet data to enable
// further processing if needed.
struct unsupported_frame {
  frame_type type;
  std::vector<std::byte> data;
};
} // namespace couchbase::core::mcbp
