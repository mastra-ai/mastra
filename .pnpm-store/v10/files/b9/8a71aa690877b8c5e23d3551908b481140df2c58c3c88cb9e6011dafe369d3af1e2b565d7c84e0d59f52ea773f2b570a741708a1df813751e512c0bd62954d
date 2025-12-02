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

#include "core/operations/document_analytics.hxx"

#include <couchbase/analytics_options.hxx>

#include <optional>
#include <string>

namespace couchbase::core::impl
{
auto
build_result(core::operations::analytics_response& resp) -> analytics_result;

auto
build_analytics_request(std::string statement,
                        analytics_options::built options,
                        std::optional<std::string> bucket_name,
                        std::optional<std::string> scope_name)
  -> core::operations::analytics_request;
} // namespace couchbase::core::impl
