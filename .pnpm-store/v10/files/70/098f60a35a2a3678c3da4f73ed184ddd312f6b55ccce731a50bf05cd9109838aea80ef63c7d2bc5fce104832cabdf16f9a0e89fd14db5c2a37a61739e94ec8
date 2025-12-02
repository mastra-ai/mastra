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

#include "frame_info_id.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::protocol::request_frame_info_id> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::request_frame_info_id opcode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (opcode) {
      case couchbase::core::protocol::request_frame_info_id::barrier:
        name = "barrier";
        break;
      case couchbase::core::protocol::request_frame_info_id::durability_requirement:
        name = "durability_requirement";
        break;
      case couchbase::core::protocol::request_frame_info_id::dcp_stream_id:
        name = "dcp_stream_id";
        break;
      case couchbase::core::protocol::request_frame_info_id::open_tracing_context:
        name = "open_tracing_context";
        break;
      case couchbase::core::protocol::request_frame_info_id::impersonate_user:
        name = "impersonate_user";
        break;
      case couchbase::core::protocol::request_frame_info_id::preserve_ttl:
        name = "preserve_ttl";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};

template<>
struct fmt::formatter<couchbase::core::protocol::response_frame_info_id> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::protocol::response_frame_info_id opcode, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (opcode) {
      case couchbase::core::protocol::response_frame_info_id::server_duration:
        name = "server_duration";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
