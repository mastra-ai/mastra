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

#include "doc_record.hxx"

#include <tao/json/value.hpp>

namespace couchbase::core::transactions
{
auto
doc_record::create_from(const tao::json::value& obj) -> doc_record
{
  const std::string bucket_name = obj.at(ATR_FIELD_PER_DOC_BUCKET).get_string();
  const std::string scope_name = obj.at(ATR_FIELD_PER_DOC_SCOPE).get_string();
  const std::string collection_name = obj.at(ATR_FIELD_PER_DOC_COLLECTION).get_string();
  const std::string id = obj.at(ATR_FIELD_PER_DOC_ID).get_string();
  return { bucket_name, scope_name, collection_name, id };
}

auto
operator==(const doc_record& doc, const core::document_id& id) -> bool
{
  return doc.id_.bucket() == id.bucket() && doc.id_.scope() == id.scope() &&
         doc.id_.collection() == id.collection() && doc.id_.key() == id.key();
}

} // namespace couchbase::core::transactions
