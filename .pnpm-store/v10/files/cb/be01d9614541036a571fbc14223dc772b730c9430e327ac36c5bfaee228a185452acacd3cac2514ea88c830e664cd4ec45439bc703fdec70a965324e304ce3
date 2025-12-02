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

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace couchbase::core
{
struct document_id {
  document_id() = default;
  document_id(std::string bucket, std::string key);
  document_id(std::string bucket, std::string scope, std::string collection, std::string key);

  [[nodiscard]] const std::string& bucket() const
  {
    return bucket_;
  }

  [[nodiscard]] const std::string& scope() const
  {
    return scope_;
  }

  [[nodiscard]] const std::string& collection() const
  {
    return collection_;
  }

  [[nodiscard]] const std::string& collection_path() const
  {
    return collection_path_;
  }

  [[nodiscard]] const std::string& key() const
  {
    return key_;
  }

  [[nodiscard]] bool has_default_collection() const;

  [[nodiscard]] bool is_collection_resolved() const
  {
    return collection_uid_.has_value();
  }

  [[nodiscard]] std::uint32_t collection_uid() const
  {
    return collection_uid_.value();
  }

  void collection_uid(std::uint32_t value)
  {
    collection_uid_ = value;
  }

  [[nodiscard]] bool use_collections() const
  {
    return use_collections_;
  }

  void use_collections(bool value)
  {
    use_collections_ = value;
  }

  [[nodiscard]] bool use_any_session() const
  {
    return use_any_session_;
  }

  void use_any_session(bool value)
  {
    use_any_session_ = value;
  }

  [[nodiscard]] std::size_t node_index() const
  {
    return node_index_;
  }

  void node_index(std::size_t index)
  {
    node_index_ = index;
  }

private:
  std::string bucket_{};
  std::string scope_{};
  std::string collection_{};
  std::string key_{};
  std::string collection_path_{};
  std::optional<std::uint32_t>
    collection_uid_{}; // filled with resolved UID during request lifetime
  bool use_collections_{ true };
  bool use_any_session_{ false };
  std::size_t node_index_{ 0 };
};

[[nodiscard]] std::vector<std::byte>
make_protocol_key(const document_id& id);

} // namespace couchbase::core
