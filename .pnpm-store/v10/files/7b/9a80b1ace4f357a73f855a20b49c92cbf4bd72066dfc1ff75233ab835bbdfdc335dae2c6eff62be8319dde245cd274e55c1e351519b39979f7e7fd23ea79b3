/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include "result.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::transactions::result> {
public:
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  constexpr auto format(const couchbase::core::transactions::result& r, FormatContext& ctx) const
  {
    return format_to(ctx.out(),
                     "result:{{ rc: {}, strerror: {}, cas: {}, is_deleted: {}, datatype: {}, "
                     "flags: {}, raw_value: {:.{}} }}",
                     r.rc,
                     r.strerror(),
                     r.cas,
                     r.is_deleted,
                     r.datatype,
                     r.flags,
                     couchbase::core::utils::to_string(r.raw_value),
                     r.raw_value.size() > 1024 ? 1024 : r.raw_value.size());
  }
};
