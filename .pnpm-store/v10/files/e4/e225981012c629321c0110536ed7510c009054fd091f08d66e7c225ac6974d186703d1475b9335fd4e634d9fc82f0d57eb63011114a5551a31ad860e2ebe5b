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

#include "transaction_get_result.hxx"

#include "result.hxx"

#include "core/operations.hxx"

#include <couchbase/codec/codec_flags.hxx>

namespace couchbase::core::transactions
{
namespace
{
template<typename LookupInResponse>
auto
create_from_subdoc(const LookupInResponse& resp) -> transaction_get_result
{
  // "txn.id"
  std::optional<std::string> transaction_id{};
  std::optional<std::string> attempt_id{};
  std::optional<std::string> operation_id{};
  if (resp.fields[0].status == key_value_status_code::success) {
    auto id = codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[0].value);
    transaction_id = id.template optional<std::string>("txn");
    attempt_id = id.template optional<std::string>("atmpt");
    operation_id = id.template optional<std::string>("op");
  }

  // "txn.atr"
  std::optional<std::string> atr_id{};
  std::optional<std::string> atr_bucket_name{};
  std::optional<std::string> atr_scope_name{};
  std::optional<std::string> atr_collection_name{};
  if (resp.fields[1].status == key_value_status_code::success) {
    auto atr = codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[1].value);
    atr_id = atr.template optional<std::string>("id");
    atr_bucket_name = atr.template optional<std::string>("bkt");
    atr_scope_name = atr.template optional<std::string>("scp");
    atr_collection_name = atr.template optional<std::string>("coll");
  }

  // "txn.op.type"
  std::optional<std::string> op{};
  if (resp.fields[2].status == key_value_status_code::success) {
    op = codec::tao_json_serializer::deserialize<std::string>(resp.fields[2].value);
  }

  // "txn.op.stgd"
  std::optional<codec::encoded_value> staged_content_json{};
  if (resp.fields[3].status == key_value_status_code::success) {
    staged_content_json = {
      resp.fields[3].value,
      codec::codec_flags::json_common_flags,
    };
  }

  // "txn.op.crc32"
  std::optional<std::string> crc32_of_staging{};
  if (resp.fields[4].status == key_value_status_code::success) {
    crc32_of_staging = codec::tao_json_serializer::deserialize<std::string>(resp.fields[4].value);
  }

  // "txn.restore"
  std::optional<std::string> cas_pre_txn{};
  std::optional<std::string> revid_pre_txn{};
  std::optional<std::uint32_t> exptime_pre_txn{};
  if (resp.fields[5].status == key_value_status_code::success) {
    auto restore = codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[5].value);
    cas_pre_txn = restore.template optional<std::string>("CAS");
    // only present in 6.5+
    revid_pre_txn = restore.template optional<std::string>("revid");
    exptime_pre_txn = restore.template optional<std::uint32_t>("exptime");
  }

  // "txn.fc"
  std::optional<tao::json::value> forward_compat{};
  if (resp.fields[6].status == key_value_status_code::success) {
    forward_compat =
      codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[6].value);
  }

  // "$document"
  std::optional<std::string> cas_from_doc{};
  std::optional<std::string> revid_from_doc{};
  std::optional<std::uint32_t> exptime_from_doc{};
  std::optional<std::string> crc32_from_doc{};
  codec::encoded_value content{};
  if (resp.fields[7].status == key_value_status_code::success) {
    auto document = codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[7].value);
    cas_from_doc = document["CAS"].template as<std::string>();
    // only present in 6.5+
    revid_from_doc = document["revid"].template as<std::string>();
    exptime_from_doc = document["exptime"].template as<std::uint32_t>();
    crc32_from_doc = document["value_crc32c"].template as<std::string>();
    content.flags = document["flags"].template as<std::uint32_t>();
  } else {
    // TODO(SA): throw exception here like Java SDK does
  }

  // "txn.op.bin"
  std::optional<codec::encoded_value> staged_content_binary{};
  if (resp.fields[8].status == key_value_status_code::success) {
    staged_content_binary = {
      resp.fields[8].value,
      codec::codec_flags::binary_common_flags,
    };
  }

  // "txn.aux"
  if (resp.fields[9].status == key_value_status_code::success) {
    auto aux = codec::tao_json_serializer::deserialize<tao::json::value>(resp.fields[9].value);
    auto staged_user_flags = aux.template optional<std::uint32_t>("uf");
    if (staged_user_flags && staged_content_binary) {
      staged_content_binary->flags = staged_user_flags.value();
    }
  }

  if (resp.fields[10].status == key_value_status_code::success) {
    content.data = resp.fields[10].value;
  }

  return {
    {
      resp.ctx.bucket(),
      resp.ctx.scope(),
      resp.ctx.collection(),
      resp.ctx.id(),
    },
    content,
    resp.cas.value(),
    transaction_links{
      atr_id,
      atr_bucket_name,
      atr_scope_name,
      atr_collection_name,
      transaction_id,
      attempt_id,
      operation_id,
      staged_content_json,
      staged_content_binary,
      cas_pre_txn,
      revid_pre_txn,
      exptime_pre_txn,
      crc32_of_staging,
      op,
      forward_compat,
      resp.deleted,
    },
    {
      document_metadata{
        cas_from_doc,
        revid_from_doc,
        exptime_from_doc,
        crc32_from_doc,
      },
    },
  };
}
} // namespace

auto
transaction_get_result::create_from(const core::operations::lookup_in_response& resp)
  -> transaction_get_result
{
  return create_from_subdoc(resp);
}

auto
transaction_get_result::create_from(const core::operations::lookup_in_any_replica_response& resp)
  -> transaction_get_result
{
  return create_from_subdoc(resp);
}

auto
transaction_get_result::create_from(const transaction_get_result& document,
                                    codec::encoded_value content) -> transaction_get_result
{
  return {
    document.id(),
    std::move(content),
    document.cas().value(),
    transaction_links{
      document.links().atr_id(),
      document.links().atr_bucket_name(),
      document.links().atr_scope_name(),
      document.links().atr_collection_name(),
      document.links().staged_transaction_id(),
      document.links().staged_attempt_id(),
      document.links().staged_operation_id(),
      document.links().staged_content_json(),
      document.links().staged_content_binary(),
      document.links().cas_pre_txn(),
      document.links().revid_pre_txn(),
      document.links().exptime_pre_txn(),
      document.links().crc32_of_staging(),
      document.links().op(),
      document.links().forward_compat(),
      document.links().is_deleted(),
    },
    document.metadata(),
  };
}
} // namespace couchbase::core::transactions
