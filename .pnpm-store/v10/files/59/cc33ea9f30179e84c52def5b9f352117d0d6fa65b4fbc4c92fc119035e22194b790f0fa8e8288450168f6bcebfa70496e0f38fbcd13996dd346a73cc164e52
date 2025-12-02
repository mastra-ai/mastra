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

#include "subdocument_error_context.hxx"

#include <couchbase/fmt/retry_reason.hxx>

#include <spdlog/fmt/bundled/format.h>
#include <tao/json/forward.hpp>

#include "key_value_json.hxx"

namespace tao::json
{
template<>
struct traits<couchbase::core::subdocument_error_context> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::subdocument_error_context& ctx)
  {
    tao::json::traits<couchbase::core::key_value_error_context>::assign(
      v, dynamic_cast<const couchbase::core::key_value_error_context&>(ctx));
    if (ctx.first_error_index().has_value()) {
      v["first_error_index"] = ctx.first_error_index().value();
    }
    if (ctx.first_error_path().has_value()) {
      v["first_error_path"] = ctx.first_error_path().value();
    }
  }
};
} // namespace tao::json
