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

#include "core/error_context/key_value_extended_error_info.hxx"

#include <spdlog/fmt/bundled/core.h>

/**
 * Helper for fmtlib to format @ref couchbase::key_value_extended_error_info objects.
 *
 * @since 1.0.0
 * @committed
 */
template<>
struct fmt::formatter<couchbase::core::key_value_extended_error_info> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::core::key_value_extended_error_info& error, FormatContext& ctx) const
  {
    if (!error.reference().empty() && !error.context().empty()) {
      return format_to(ctx.out(), R"((ref: "{}", ctx: "{}"))", error.reference(), error.context());
    }
    if (!error.reference().empty()) {
      return format_to(ctx.out(), R"((ref: "{}"))", error.reference());
    }
    if (!error.context().empty()) {
      return format_to(ctx.out(), R"((ctx: "{}"))", error.context());
    }
    return format_to(ctx.out(), "");
  }
};
