/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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

#include <couchbase/error.hxx>

/**
 * Helper for fmtlib to format @ref couchbase::error objects.
 *
 * @since 1.0.0
 * @uncommitted
 */
template<>
struct fmt::formatter<couchbase::error> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(const couchbase::error& err, FormatContext& ctx) const
  {
    if (err.message().empty()) {
      if (err.ctx()) {
        return format_to(ctx.out(), "{} | {}", err.ec().message(), err.ctx().to_json());
      }
      return format_to(ctx.out(), "{}", err.ec().message());
    }
    if (err.ctx()) {
      return format_to(
        ctx.out(), "{} - {} | {}", err.ec().message(), err.message(), err.ctx().to_json());
    }
    return format_to(ctx.out(), "{} - {}", err.ec().message(), err.message());
  }
};
