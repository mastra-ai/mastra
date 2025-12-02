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

namespace couchbase::core::mcbp
{
// durability_timeout_frame allows you to specify a specific timeout for durability operations to
// timeout.  Note that this frame is actually an extension of durability_level_frame and requires
// that frame to also be used in order to function.
struct durability_timeout_frame {
  std::chrono::milliseconds timeout;
};
} // namespace couchbase::core::mcbp
