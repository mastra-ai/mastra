/*
 *     Copyright 2021-Present Couchbase, Inc.
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

#include "transaction_fields.hxx"

#include "core/document_id.hxx"

#include <tao/json/forward.hpp>

#include <cstdint>
#include <string>

namespace couchbase::core::transactions
{
struct doc_record {
public:
  static doc_record create_from(const tao::json::value& obj);

  doc_record(std::string bucket_name,
             std::string scope_name,
             std::string collection_name,
             std::string id)
    : id_(std::move(bucket_name), std::move(scope_name), std::move(collection_name), std::move(id))
  {
  }

  [[nodiscard]] auto bucket_name() const -> const std::string&
  {
    return id_.bucket();
  }

  [[nodiscard]] auto id() const -> const std::string&
  {
    return id_.key();
  }

  [[nodiscard]] auto scope_name() const -> const std::string&
  {
    return id_.scope();
  }

  [[nodiscard]] auto collection_name() const -> const std::string&
  {
    return id_.collection();
  }

  [[nodiscard]] auto document_id() const -> const core::document_id&
  {
    return id_;
  }

  template<typename OStream>
  friend auto operator<<(OStream& os, const doc_record& dr) -> OStream&
  {
    os << "doc_record{";
    os << "bucket: " << dr.id_.bucket() << ",";
    os << "scope: " << dr.id_.scope() << ",";
    os << "collection: " << dr.id_.collection() << ",";
    os << "key: " << dr.id_.key();
    os << "}";
    return os;
  }

  friend auto operator==(const doc_record& doc, const core::document_id& id) -> bool;

private:
  core::document_id id_;
};

auto
operator==(const doc_record& doc, const core::document_id& id) -> bool;

} // namespace couchbase::core::transactions
