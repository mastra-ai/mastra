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

#include "subdocument_error_context.hxx"

#include "core/document_id.hxx"
#include "key_value_error_context.hxx"

#include <optional>
#include <set>
#include <string>
#include <system_error>

namespace couchbase::core
{
auto
make_key_value_error_context(std::error_code ec, const document_id& id) -> key_value_error_context;

template<typename Command, typename Response>
auto
make_key_value_error_context(std::error_code ec,
                             std::uint16_t status_code,
                             const Command& command,
                             const Response& response) -> key_value_error_context
{

  const auto& key = command->request.id.key();
  const auto& collection = command->request.id.collection();
  const auto& scope = command->request.id.scope();
  const auto& bucket = command->request.id.bucket();
  std::uint32_t opaque =
    (ec && response.opaque() == 0) ? command->request.opaque : response.opaque();
  std::optional<key_value_status_code> status{};
  std::optional<key_value_error_map_info> error_map_info{};
  if (status_code != 0xffffU) {
    status = response.status();
    if (command->session_ && status_code > 0) {
      error_map_info = command->session_->decode_error_code(status_code);
    }
  }
  auto retry_attempts = command->request.retries.retry_attempts();
  auto retry_reasons = command->request.retries.retry_reasons();

  return { command->id_,
           ec,
           command->last_dispatched_to_,
           command->last_dispatched_from_,
           retry_attempts,
           std::move(retry_reasons),
           key,
           bucket,
           scope,
           collection,
           opaque,
           status,
           response.cas(),
           std::move(error_map_info),
           response.error_info() };
}

auto
make_subdocument_error_context(const key_value_error_context& ctx,
                               std::error_code ec,
                               std::optional<std::string> first_error_path,
                               std::optional<std::uint64_t> first_error_index,
                               bool deleted) -> subdocument_error_context;

} // namespace couchbase::core
