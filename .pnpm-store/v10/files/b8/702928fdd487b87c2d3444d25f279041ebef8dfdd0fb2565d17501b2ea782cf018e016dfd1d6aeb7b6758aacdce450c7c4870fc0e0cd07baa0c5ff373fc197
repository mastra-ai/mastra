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

#include <core/transactions/internal/exceptions_internal.hxx>

namespace tao::json
{
template<>
struct traits<couchbase::core::transactions::transaction_operation_failed> {
  template<template<typename...> class Traits>
  static void assign(tao::json::basic_value<Traits>& v,
                     const couchbase::core::transactions::transaction_operation_failed& ctx)
  {
    v["error_class"] = fmt::format("{}", ctx.ec());
    v["retry"] = ctx.should_retry();
    v["rollback"] = ctx.should_rollback();
    v["to_raise"] = fmt::format("{}", ctx.to_raise());
  }
};
} // namespace tao::json
