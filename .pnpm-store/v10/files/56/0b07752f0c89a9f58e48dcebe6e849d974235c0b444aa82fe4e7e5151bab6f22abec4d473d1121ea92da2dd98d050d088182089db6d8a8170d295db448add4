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

#include "key_value.hxx"

#include "core/document_id.hxx"
#include "core/error_context/key_value_error_context.hxx"
#include "core/error_context/subdocument_error_context.hxx"

#include <cstdint>
#include <optional>
#include <system_error>
#include <utility>

namespace couchbase::core
{

auto
make_key_value_error_context(std::error_code ec, const document_id& id) -> key_value_error_context
{
  return {
    {}, ec, {}, {}, 0, {}, id.key(), id.bucket(), id.scope(), id.collection(), 0, {}, {}, {}, {},
  };
}

auto
make_subdocument_error_context(const key_value_error_context& ctx,
                               std::error_code ec,
                               std::optional<std::string> first_error_path,
                               std::optional<std::uint64_t> first_error_index,
                               bool deleted) -> subdocument_error_context
{
  return {
    ctx.operation_id(),
    ec,
    ctx.last_dispatched_to(),
    ctx.last_dispatched_from(),
    ctx.retry_attempts(),
    ctx.retry_reasons(),
    ctx.id(),
    ctx.bucket(),
    ctx.scope(),
    ctx.collection(),
    ctx.opaque(),
    ctx.status_code(),
    ctx.cas(),
    ctx.error_map_info(),
    ctx.extended_error_info(),
    std::move(first_error_path),
    first_error_index,
    deleted,
  };
}
} // namespace couchbase::core
