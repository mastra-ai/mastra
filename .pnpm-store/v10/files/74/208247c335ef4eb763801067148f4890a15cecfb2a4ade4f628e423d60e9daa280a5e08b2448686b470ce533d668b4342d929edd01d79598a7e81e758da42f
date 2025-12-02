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

#include "collection_id_cache_entry.hxx"

#include "collections_options.hxx"
#include "pending_operation.hxx"

#include <tl/expected.hpp>

#include <map>
#include <memory>
#include <mutex>
#include <string_view>

namespace asio
{
class io_context;
} // namespace asio

namespace couchbase
{
class retry_strategy;
} // namespace couchbase

namespace couchbase::core
{
class collection_id_cache_entry_impl;
class dispatcher;
namespace mcbp
{
class queue_request;
} // namespace mcbp

struct collections_component_options {
  std::size_t max_queue_size;
  std::shared_ptr<retry_strategy> default_retry_strategy;
};

constexpr std::uint32_t unknown_collection_id{ 0xffff'ffffU };
constexpr std::uint32_t pending_collection_id{ 0xffff'fffeU };

class collections_component_impl;
class collections_component_unit_test_api;

class collections_component
{
public:
  collections_component(asio::io_context& io,
                        dispatcher dispatcher,
                        const collections_component_options& options);

  auto get_collection_id(std::string scope_name,
                         std::string collection_name,
                         const get_collection_id_options& options,
                         get_collection_id_callback callback)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  auto dispatch(std::shared_ptr<mcbp::queue_request> request)
    -> tl::expected<std::shared_ptr<pending_operation>, std::error_code>;

  /// Integration point for unit testing. Not for public usage.
  [[nodiscard]] auto unit_test_api() -> collections_component_unit_test_api;

private:
  std::shared_ptr<collections_component_impl> impl_;
};

} // namespace couchbase::core
