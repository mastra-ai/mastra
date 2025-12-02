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
class get_options
{
public:
  std::vector<std::byte> key{};
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

class get_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_callback = utils::movable_function<void(get_result result, std::error_code ec)>;

class get_one_replica_options
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

class get_one_replica_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_one_replica_callback =
  utils::movable_function<void(get_one_replica_result result, std::error_code ec)>;

class get_and_touch_options
{
public:
  std::vector<std::byte> key{};
  std::uint32_t expiry{};
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

class get_and_touch_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_and_touch_callback =
  utils::movable_function<void(get_and_touch_result result, std::error_code ec)>;

class get_and_lock_options
{
public:
  std::vector<std::byte> key{};
  std::uint32_t lock_time{};
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

class get_and_lock_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_and_lock_callback =
  utils::movable_function<void(get_and_lock_result result, std::error_code ec)>;

class touch_options
{
public:
  std::vector<std::byte> key{};
  std::uint32_t expiry{};
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

class touch_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using touch_callback = utils::movable_function<void(touch_result result, std::error_code ec)>;

class unlock_options
{
public:
  std::vector<std::byte> key{};
  couchbase::cas cas{};
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

class unlock_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using unlock_callback = utils::movable_function<void(unlock_result result, std::error_code ec)>;

class insert_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint32_t expiry{};
  std::uint8_t data_type{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class insert_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using insert_callback = utils::movable_function<void(insert_result result, std::error_code ec)>;

class upsert_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint32_t expiry{};
  bool preserve_expiry{};
  std::uint8_t data_type{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class upsert_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using upsert_callback = utils::movable_function<void(upsert_result result, std::error_code ec)>;

class replace_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint32_t expiry{};
  bool preserve_expiry{};
  std::uint8_t data_type{};
  couchbase::cas cas{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class replace_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using replace_callback = utils::movable_function<void(replace_result result, std::error_code ec)>;

class remove_options
{
public:
  std::vector<std::byte> key{};
  couchbase::cas cas{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class remove_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using remove_callback = utils::movable_function<void(remove_result result, std::error_code ec)>;

class adjoin_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  couchbase::cas cas{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class adjoin_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using adjoin_callback = utils::movable_function<void(adjoin_result result, std::error_code ec)>;

class counter_options
{
public:
  std::vector<std::byte> key{};
  std::uint64_t delta{};
  std::uint64_t initial_value{};
  std::uint32_t expiry{};
  couchbase::durability_level durability_level{};
  std::chrono::milliseconds durability_level_timeout{};
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

class counter_result
{
public:
  std::uint64_t value{};
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using counter_callback = utils::movable_function<void(counter_result result, std::error_code ec)>;

class get_random_options
{
public:
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

class get_random_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_random_callback =
  utils::movable_function<void(get_random_result result, std::error_code ec)>;

class get_with_meta_options
{
public:
  std::vector<std::byte> key{};
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

class get_with_meta_result
{
public:
  std::vector<std::byte> value{};
  std::uint32_t flags{};
  std::uint8_t data_type{};
  couchbase::cas cas{};
  std::uint32_t expiry{};
  std::uint64_t sequence_number{};
  std::uint32_t deleted{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using get_with_meta_callback =
  utils::movable_function<void(get_with_meta_result result, std::error_code ec)>;

class remove_with_meta_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  std::vector<std::byte> extra{};
  std::uint8_t data_type{};
  std::uint32_t options{};
  std::uint32_t flags{};
  std::uint32_t expiry{};
  couchbase::cas cas{};
  std::uint64_t revision_number{};
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

class remove_with_meta_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using remove_with_meta_callback =
  utils::movable_function<void(remove_with_meta_result result, std::error_code ec)>;

class upsert_with_meta_options
{
public:
  std::vector<std::byte> key{};
  std::vector<std::byte> value{};
  std::vector<std::byte> extra{};
  std::uint8_t data_type{};
  std::uint32_t options{};
  std::uint32_t flags{};
  std::uint32_t expiry{};
  couchbase::cas cas{};
  std::uint64_t revision_number{};
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

class upsert_with_meta_result
{
public:
  couchbase::cas cas{};
  mutation_token token{};

  struct {
    std::optional<resource_unit_result> resource_units{};
  } internal{};
};

using upsert_with_meta_callback =
  utils::movable_function<void(upsert_with_meta_result result, std::error_code ec)>;
} // namespace couchbase::core
