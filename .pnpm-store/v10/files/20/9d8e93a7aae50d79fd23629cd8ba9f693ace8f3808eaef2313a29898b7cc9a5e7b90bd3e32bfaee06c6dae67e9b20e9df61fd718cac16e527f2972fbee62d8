/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2023-Present Couchbase, Inc.
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

#include <couchbase/diagnostics_result.hxx>
#include <couchbase/ping_result.hxx>
#include <couchbase/service_type.hxx>

#include "core/diagnostics.hxx"
#include "core/service_type.hxx"

#include <set>

namespace couchbase::core::impl
{
auto
to_core_service_types(const std::set<couchbase::service_type>& service_types)
  -> std::set<core::service_type>;

auto
build_result(const core::diag::ping_result& result) -> couchbase::ping_result;

auto
build_result(const core::diag::diagnostics_result& result) -> couchbase::diagnostics_result;
} // namespace couchbase::core::impl
