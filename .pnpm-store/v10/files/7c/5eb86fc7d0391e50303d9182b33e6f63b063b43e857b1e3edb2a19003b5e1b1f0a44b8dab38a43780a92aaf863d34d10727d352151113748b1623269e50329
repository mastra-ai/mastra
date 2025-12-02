/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "resource_units.hxx"
#include "utils/movable_function.hxx"

#include <couchbase/cas.hxx>

#include <chrono>
#include <string>
#include <system_error>
#include <vector>

namespace couchbase
{
class retry_strategy;
namespace tracing
{
class request_span;
} // namespace tracing
} // namespace couchbase

namespace couchbase::core
{
enum class key_state {
  not_persisted = 0x00,
  persisted = 0x01,
  not_found = 0x80,
  deleted = 0x81,
};

class observe_options
{
public:
  std::vector<std::byte> key{};
  std::uint32_t replica_index{};
  std::string collection_name{};
  std::string scope_name{};
  std::uint32_t collection_id{};

  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
  std::chrono::milliseconds timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
  } internal{};
};

class observe_result
{
public:
  key_state state{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using observe_callback = utils::movable_function<void(observe_result result, std::error_code ec)>;

class observe_seqno_options
{
public:
  std::uint16_t vbucket_id{};
  std::uint64_t vbucket_uuid{};
  std::uint32_t replica_index{};

  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
  std::chrono::milliseconds timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
  } internal{};
};

class observe_seqno_result
{
public:
  bool did_failover{};
  std::uint16_t vbucket_id{};
  std::uint64_t vbucket_uuid{};
  std::uint64_t persist_sequence_number{};
  std::uint64_t current_sequence_number{};
  std::uint64_t old_vbucket_uuid{};
  std::uint64_t last_sequence_number{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using observe_seqno_callback =
  utils::movable_function<void(observe_seqno_result result, std::error_code ec)>;
} // namespace couchbase::core
