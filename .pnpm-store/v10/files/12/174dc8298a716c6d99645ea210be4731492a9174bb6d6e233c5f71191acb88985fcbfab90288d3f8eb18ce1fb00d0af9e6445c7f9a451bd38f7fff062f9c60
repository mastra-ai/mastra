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

#include "transaction_links.hxx"

#include <utility>

namespace couchbase::core::transactions
{
auto
operator<<(std::ostream& os, const transaction_links& links) -> std::ostream&
{
  os << "transaction_links{atr: " << links.atr_id_.value_or("none")
     << ", atr_bkt: " << links.atr_bucket_name_.value_or("none")
     << ", atr_coll: " << links.atr_collection_name_.value_or("none")
     << ", atr_scope: " << links.atr_scope_name_.value_or("none")
     << ", txn_id: " << links.staged_transaction_id_.value_or("none")
     << ", attempt_id: " << links.staged_attempt_id_.value_or("none")
     << ", crc32_of_staging:" << links.crc32_of_staging_.value_or("none") << "}";
  return os;
}

void
transaction_links::append_to_json(tao::json::value& obj) const
{
  if (staged_attempt_id_) {
    obj["txnMeta"]["atmpt"] = staged_attempt_id_.value();
  }
  if (staged_transaction_id_) {
    obj["txnMeta"]["txn"] = staged_transaction_id_.value();
  }
  if (staged_operation_id_) {
    obj["txnMeta"]["txn"] = staged_operation_id_.value();
  }
  if (atr_id_) {
    obj["txnMeta"]["atr"]["key"] = atr_id_.value();
  }
  if (atr_bucket_name_) {
    obj["txnMeta"]["atr"]["bkt"] = atr_bucket_name_.value();
  }
  if (atr_scope_name_) {
    obj["txnMeta"]["atr"]["scp"] = atr_scope_name_.value();
  }
  if (atr_collection_name_) {
    obj["txnMeta"]["atr"]["coll"] = atr_collection_name_.value();
  }
}

transaction_links::transaction_links(const tao::json::value& json)
{
  if (const auto* meta = json.find("txnMeta"); meta != nullptr && meta->is_object()) {
    for (const auto& [key, value] : meta->get_object()) {
      if (key == "atmpt") {
        staged_attempt_id_ = value.get_string();
      }
      if (key == "txn") {
        staged_transaction_id_ = value.get_string();
      }
      if (key == "atr" && value.is_object()) {
        atr_id_ = value.at("key").get_string();
        atr_bucket_name_ = value.at("bkt").get_string();
        atr_scope_name_ = value.at("scp").get_string();
        atr_collection_name_ = value.at("coll").get_string();
      }
    }
  }
}

transaction_links::transaction_links(std::optional<std::string> atr_id,
                                     std::optional<std::string> atr_bucket_name,
                                     std::optional<std::string> atr_scope_name,
                                     std::optional<std::string> atr_collection_name,
                                     std::optional<std::string> staged_transaction_id,
                                     std::optional<std::string> staged_attempt_id,
                                     std::optional<std::string> staged_operation_id,
                                     std::optional<codec::encoded_value> staged_content_json,
                                     std::optional<codec::encoded_value> staged_content_binary,
                                     std::optional<std::string> cas_pre_txn,
                                     std::optional<std::string> revid_pre_txn,
                                     std::optional<std::uint32_t> exptime_pre_txn,
                                     std::optional<std::string> crc32_of_staging,
                                     std::optional<std::string> op,
                                     std::optional<tao::json::value> forward_compat,
                                     bool is_deleted)
  : atr_id_(std::move(atr_id))
  , atr_bucket_name_(std::move(atr_bucket_name))
  , atr_scope_name_(std::move(atr_scope_name))
  , atr_collection_name_(std::move(atr_collection_name))
  , staged_transaction_id_(std::move(staged_transaction_id))
  , staged_attempt_id_(std::move(staged_attempt_id))
  , staged_operation_id_(std::move(staged_operation_id))
  , staged_content_json_(std::move(staged_content_json))
  , staged_content_binary_(std::move(staged_content_binary))
  , cas_pre_txn_(std::move(cas_pre_txn))
  , revid_pre_txn_(std::move(revid_pre_txn))
  , exptime_pre_txn_(exptime_pre_txn)
  , crc32_of_staging_(std::move(crc32_of_staging))
  , op_(std::move(op))
  , forward_compat_(std::move(forward_compat))
  , is_deleted_(is_deleted)
{
}
} // namespace couchbase::core::transactions
