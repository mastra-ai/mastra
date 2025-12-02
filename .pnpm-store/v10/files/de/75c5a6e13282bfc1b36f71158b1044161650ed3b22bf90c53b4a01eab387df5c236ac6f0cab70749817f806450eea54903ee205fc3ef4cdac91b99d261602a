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

#include "document_id.hxx"

#include "core/utils/binary.hxx"
#include "core/utils/unsigned_leb128.hxx"

#include <spdlog/fmt/bundled/core.h>

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <iterator>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace couchbase::core
{
namespace
{
// FIXME(SA): maybe we still need these functions to enforce correctness
// of the names
[[maybe_unused]] auto
is_valid_collection_char(char ch) -> bool
{
  if (ch >= 'A' && ch <= 'Z') {
    return true;
  }
  if (ch >= 'a' && ch <= 'z') {
    return true;
  }
  if (ch >= '0' && ch <= '9') {
    return true;
  }
  switch (ch) {
    case '_':
    case '-':
    case '%':
      return true;
    default:
      return false;
  }
}

// FIXME(SA): meaningful function, but is not used anywhere for some reason?
[[maybe_unused]] auto
is_valid_collection_element(std::string_view element) -> bool
{
  if (element.empty() || element.size() > 251) {
    return false;
  }
  return std::all_of(element.begin(), element.end(), is_valid_collection_char);
}

[[nodiscard]] auto
compile_collection_path(const std::string& scope, const std::string& collection) -> std::string
{
  return fmt::format("{}.{}", scope, collection);
}
} // namespace

document_id::document_id(std::string bucket, std::string key)
  : bucket_(std::move(bucket))
  , key_(std::move(key))
  , use_collections_(false)
{
}

document_id::document_id(std::string bucket,
                         std::string scope,
                         std::string collection,
                         std::string key)
  : bucket_(std::move(bucket))
  , scope_(std::move(scope))
  , collection_(std::move(collection))
  , key_(std::move(key))
{
  collection_path_ = compile_collection_path(scope_, collection_);
}

auto
document_id::has_default_collection() const -> bool
{
  return !use_collections_ || collection_path_ == "_default._default";
}

auto
make_protocol_key(const document_id& id) -> std::vector<std::byte>
{
  std::vector<std::byte> key{};
  if (id.is_collection_resolved()) {
    const utils::unsigned_leb128<std::uint32_t> encoded(id.collection_uid());
    key.reserve(encoded.size());
    key.insert(key.end(), encoded.begin(), encoded.end());
  }
  key.reserve(key.size() + id.key().size());
  couchbase::core::utils::to_binary(id.key(), std::back_insert_iterator(key));
  return key;
}
} // namespace couchbase::core
