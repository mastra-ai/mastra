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

#include "diagnostics_fmt.hxx"
#include "service_type_fmt.hxx"

#include <tao/json/value.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::diag::diagnostics_result> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::diag::diagnostics_result& r)
  {
    tao::json::value services = tao::json::empty_object;
    for (const auto& [service_type, endpoints] : r.services) {
      tao::json::value service{};
      for (const auto& endpoint : endpoints) {
        tao::json::value e = tao::json::empty_object;
        if (endpoint.last_activity) {
          e["last_activity_us"] = endpoint.last_activity->count();
        }
        e["remote"] = endpoint.remote;
        e["local"] = endpoint.local;
        e["id"] = endpoint.id;
        e["state"] = fmt::format("{}", endpoint.state);
        if (endpoint.bucket) {
          e["namespace"] = endpoint.bucket.value();
        }
        if (endpoint.details) {
          e["details"] = endpoint.details.value();
        }
        service.push_back(e);
      }
      services[fmt::format("{}", service_type)] = service;
    }

    v = {
      { "version", r.version },
      { "id", r.id },
      { "sdk", r.sdk },
      { "services", services },
    };
  }
};

template<>
struct traits<couchbase::core::diag::ping_result> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v, const couchbase::core::diag::ping_result& r)
  {
    tao::json::value services{};
    for (const auto& entry : r.services) {
      tao::json::value service{};
      for (const auto& endpoint : entry.second) {
        tao::json::value e{};
        e["latency_us"] = endpoint.latency.count();
        e["remote"] = endpoint.remote;
        e["local"] = endpoint.local;
        e["id"] = endpoint.id;
        e["state"] = fmt::format("{}", endpoint.state);
        if (endpoint.bucket) {
          e["namespace"] = endpoint.bucket.value();
        }
        if (endpoint.state == couchbase::core::diag::ping_state::error && endpoint.error) {
          e["error"] = endpoint.error.value();
        }
        service.push_back(e);
      }
      services[fmt::format("{}", entry.first)] = service;
    }

    v = {
      { "version", r.version },
      { "id", r.id },
      { "sdk", r.sdk },
      { "services", services },
    };
  }
};
} // namespace tao::json
