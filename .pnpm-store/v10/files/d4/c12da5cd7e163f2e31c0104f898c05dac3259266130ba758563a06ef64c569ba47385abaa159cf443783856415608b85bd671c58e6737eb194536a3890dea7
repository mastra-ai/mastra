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

#include <couchbase/query_profile.hxx>

/**
 * Helper for fmtlib to format @ref couchbase::query_profile objects.
 *
 * @since 1.0.0
 * @committed
 */
template<>
struct fmt::formatter<couchbase::query_profile> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::query_profile mode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (mode) {
      case couchbase::query_profile::off:
        name = "off";
        break;
      case couchbase::query_profile::phases:
        name = "phases";
        break;
      case couchbase::query_profile::timings:
        name = "timings";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
