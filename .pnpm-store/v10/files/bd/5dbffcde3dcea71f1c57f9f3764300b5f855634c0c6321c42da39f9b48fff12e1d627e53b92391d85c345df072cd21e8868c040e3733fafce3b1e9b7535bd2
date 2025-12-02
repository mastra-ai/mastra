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

#include "query_error_context.hxx"

#include <couchbase/fmt/retry_reason.hxx>

#include <spdlog/fmt/bundled/format.h>
#include <tao/json/forward.hpp>

namespace tao::json
{
template<>
struct traits<couchbase::core::query_error_context> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::query_error_context& ctx)
  {
    std::vector<tao::json::basic_value<Traits>> reasons{};
    for (couchbase::retry_reason r : ctx.retry_reasons()) {
      reasons.emplace_back(fmt::format("{}", r));
    }
    v["retry_attempts"] = ctx.retry_attempts();
    v["retry_reasons"] = reasons;
    if (ctx.last_dispatched_to()) {
      v["last_dispatched_to"] = ctx.last_dispatched_to().value();
    }
    if (ctx.last_dispatched_from()) {
      v["last_dispatched_from"] = ctx.last_dispatched_from().value();
    }
    if (!ctx.operation_id().empty()) {
      v["operation_id"] = ctx.operation_id();
    }
    if (ctx.first_error_code()) {
      v["first_error_code"] = ctx.first_error_code();
    }
    if (!ctx.first_error_message().empty()) {
      v["first_error_message"] = ctx.first_error_message();
    }
    if (!ctx.client_context_id().empty()) {
      v["client_context_id"] = ctx.client_context_id();
    }
    if (!ctx.statement().empty()) {
      v["statement"] = ctx.statement();
    }
    if (ctx.parameters()) {
      v["parameters"] = ctx.parameters().value();
    }
    if (!ctx.method().empty()) {
      v["method"] = ctx.method();
    }
    if (!ctx.path().empty()) {
      v["path"] = ctx.path();
    }
    if (ctx.http_status()) {
      v["http_status"] = ctx.http_status();
    }
    if (!ctx.http_body().empty()) {
      v["http_body"] = ctx.http_body();
    }
    if (!ctx.hostname().empty()) {
      v["hostname"] = ctx.hostname();
    }
    if (ctx.port()) {
      v["port"] = ctx.port();
    }
  }
};
} // namespace tao::json
