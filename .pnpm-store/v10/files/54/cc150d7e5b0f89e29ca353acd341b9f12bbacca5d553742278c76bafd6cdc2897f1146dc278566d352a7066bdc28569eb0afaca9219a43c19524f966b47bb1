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

#include "protocol/client_opcode.hxx"
#include "resource_units.hxx"
#include "utils/movable_function.hxx"

#include <couchbase/cas.hxx>
#include <couchbase/durability_level.hxx>
#include <couchbase/mutation_token.hxx>

#include <chrono>
#include <optional>
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
struct subdoc_operation {
  protocol::subdoc_opcode opcode{};
  std::uint8_t flags{};
  std::string path{};
  std::vector<std::byte> value{};
};

struct subdoc_result {
  std::error_code error{};
  std::vector<std::byte> value{};
};

class lookup_in_options
{
public:
  std::vector<std::byte> key{};
  std::uint8_t flags{};
  std::vector<subdoc_operation> operations{};
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

class lookup_in_result
{
public:
  std::vector<subdoc_result> results{};
  couchbase::cas cas{};

  struct {
    bool is_deleted{};
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using lookup_in_callback =
  utils::movable_function<void(lookup_in_result result, std::error_code ec)>;

class mutate_in_options
{
public:
  std::vector<std::byte> key{};
  std::uint8_t flags{};
  couchbase::cas cas{};
  std::uint32_t expiry{};
  std::vector<subdoc_operation> operations{};
  std::string collection_name{};
  std::string scope_name{};
  std::uint32_t collection_id{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};

  std::shared_ptr<couchbase::retry_strategy> retry_strategy{};
  std::chrono::milliseconds timeout{};
  std::shared_ptr<couchbase::tracing::request_span> parent_span{};

  struct {
    std::string user{};
  } internal{};
};

class mutate_in_result
{
public:
  std::vector<subdoc_result> results{};
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using mutate_in_callback =
  utils::movable_function<void(mutate_in_result result, std::error_code ec)>;
} // namespace couchbase::core
