/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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

#include "diagnostics.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::diag::cluster_state> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::diag::cluster_state state, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (state) {
      case couchbase::core::diag::cluster_state::online:
        name = "online";
        break;

      case couchbase::core::diag::cluster_state::degraded:
        name = "degraded";
        break;

      case couchbase::core::diag::cluster_state::offline:
        name = "offline";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};

template<>
struct fmt::formatter<couchbase::core::diag::endpoint_state> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::diag::endpoint_state state, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (state) {
      case couchbase::core::diag::endpoint_state::disconnected:
        name = "disconnected";
        break;

      case couchbase::core::diag::endpoint_state::connecting:
        name = "connecting";
        break;

      case couchbase::core::diag::endpoint_state::connected:
        name = "connected";
        break;

      case couchbase::core::diag::endpoint_state::disconnecting:
        name = "disconnecting";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};

template<>
struct fmt::formatter<couchbase::core::diag::ping_state> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::diag::ping_state state, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (state) {
      case couchbase::core::diag::ping_state::ok:
        name = "ok";
        break;

      case couchbase::core::diag::ping_state::timeout:
        name = "timeout";
        break;

      case couchbase::core::diag::ping_state::error:
        name = "error";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
