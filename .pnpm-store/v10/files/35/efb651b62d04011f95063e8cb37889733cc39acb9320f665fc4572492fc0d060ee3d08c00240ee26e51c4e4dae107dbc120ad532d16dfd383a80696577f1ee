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

#include <couchbase/lookup_in_any_replica_options.hxx>
#include <couchbase/lookup_in_replica_result.hxx>

#include "core/document_id.hxx"
#include "core/utils/movable_function.hxx"

namespace couchbase::core::impl
{
class lookup_in_any_replica_request
{
public:
  explicit lookup_in_any_replica_request(std::string bucket_name,
                                         std::string scope_name,
                                         std::string collection_name,
                                         std::string document_key,
                                         std::vector<couchbase::core::impl::subdoc::command> specs,
                                         std::optional<std::chrono::milliseconds> timeout)
    : id_{ std::move(bucket_name),
           std::move(scope_name),
           std::move(collection_name),
           std::move(document_key) }
    , specs_{ std::move(specs) }
    , timeout_{ timeout }
  {
  }

  [[nodiscard]] auto id() const -> const auto&
  {
    return id_;
  }

  [[nodiscard]] auto specs() const -> const auto&
  {
    return specs_;
  }

  [[nodiscard]] auto timeout() const -> const auto&
  {
    return timeout_;
  }

private:
  core::document_id id_;
  std::vector<couchbase::core::impl::subdoc::command> specs_;
  std::optional<std::chrono::milliseconds> timeout_{};
};

using movable_lookup_in_any_replica_handler =
  utils::movable_function<void(error, lookup_in_replica_result)>;
} // namespace couchbase::core::impl
