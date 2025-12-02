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

#include <couchbase/tls_verify_mode.hxx>

/**
 * Helper for fmtlib to format @ref couchbase::tls_verify_mode objects.
 *
 * @since 1.0.0
 * @committed
 */
template<>
struct fmt::formatter<couchbase::tls_verify_mode> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::tls_verify_mode mode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (mode) {
      case couchbase::tls_verify_mode::none:
        name = "none";
        break;
      case couchbase::tls_verify_mode::peer:
        name = "peer";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
