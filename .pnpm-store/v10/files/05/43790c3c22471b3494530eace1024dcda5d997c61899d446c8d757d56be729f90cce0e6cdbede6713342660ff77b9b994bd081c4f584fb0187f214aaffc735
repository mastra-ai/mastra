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

#include <couchbase/mutation_token.hxx>
#include <couchbase/persist_to.hxx>
#include <couchbase/replicate_to.hxx>

#include "core/document_id.hxx"
#include "core/utils/movable_function.hxx"

#include <chrono>
#include <system_error>

namespace couchbase::core
{
class cluster;

namespace impl
{
using observe_handler = utils::movable_function<void(std::error_code)>;

void
initiate_observe_poll(const cluster& core,
                      document_id id,
                      mutation_token token,
                      std::optional<std::chrono::milliseconds> timeout,
                      couchbase::persist_to persist_to,
                      couchbase::replicate_to replicate_to,
                      observe_handler&& handler);
} // namespace impl
} // namespace couchbase::core
