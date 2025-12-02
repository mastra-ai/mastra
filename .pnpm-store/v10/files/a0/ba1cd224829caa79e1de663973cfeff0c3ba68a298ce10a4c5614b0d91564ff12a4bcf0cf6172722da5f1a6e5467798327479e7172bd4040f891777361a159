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

#include "service_type.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::service_type> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::service_type type, FormatContext& ctx) const
  {
    string_view name = "unknown";
    switch (type) {
      case couchbase::core::service_type::key_value:
        name = "kv";
        break;
      case couchbase::core::service_type::query:
        name = "query";
        break;
      case couchbase::core::service_type::analytics:
        name = "analytics";
        break;
      case couchbase::core::service_type::search:
        name = "search";
        break;
      case couchbase::core::service_type::view:
        name = "views";
        break;
      case couchbase::core::service_type::management:
        name = "mgmt";
        break;
      case couchbase::core::service_type::eventing:
        name = "eventing";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
