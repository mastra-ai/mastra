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

#include <couchbase/analytics_status.hxx>

/**
 * Helper for fmtlib to format @ref couchbase::analytics_status objects.
 *
 * @since 1.0.0
 * @committed
 */
template<>
struct fmt::formatter<couchbase::analytics_status> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::analytics_status status, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (status) {
      case couchbase::analytics_status::running:
        name = "running";
        break;
      case couchbase::analytics_status::success:
        name = "success";
        break;
      case couchbase::analytics_status::errors:
        name = "errors";
        break;
      case couchbase::analytics_status::completed:
        name = "completed";
        break;
      case couchbase::analytics_status::stopped:
        name = "stopped";
        break;
      case couchbase::analytics_status::timeout:
        name = "timeout";
        break;
      case couchbase::analytics_status::closed:
        name = "closed";
        break;
      case couchbase::analytics_status::fatal:
        name = "fatal";
        break;
      case couchbase::analytics_status::aborted:
        name = "aborted";
        break;
      case couchbase::analytics_status::unknown:
        name = "unknown";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
