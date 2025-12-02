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

#include "magic.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::protocol::magic> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::magic code, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (code) {
      case couchbase::core::protocol::magic::client_request:
        name = "client_request (0x80)";
        break;
      case couchbase::core::protocol::magic::alt_client_request:
        name = "alt_client_request (0x08)";
        break;
      case couchbase::core::protocol::magic::client_response:
        name = "client_response (0x81)";
        break;
      case couchbase::core::protocol::magic::alt_client_response:
        name = "alt_client_response (0x18)";
        break;
      case couchbase::core::protocol::magic::server_request:
        name = "server_request (0x82)";
        break;
      case couchbase::core::protocol::magic::server_response:
        name = "server_response (0x83)";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
