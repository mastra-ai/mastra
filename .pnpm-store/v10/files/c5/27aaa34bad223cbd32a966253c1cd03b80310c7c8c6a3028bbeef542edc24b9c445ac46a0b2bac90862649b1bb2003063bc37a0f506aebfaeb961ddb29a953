/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#include "active_transaction_record.hxx"

#include "core/cluster.hxx"
#include "core/operations/document_lookup_in.hxx"
#include "internal/doc_record.hxx"
#include "internal/transaction_fields.hxx"
#include "internal/utils.hxx"
#include "result.hxx"

#include <couchbase/lookup_in_specs.hxx>

#include <utility>

namespace couchbase::core::transactions
{
/**
 * ${Mutation.CAS} is written by kvengine with
 * 'macroToString(htonll(info.cas))'.  Discussed this with KV team and, though
 * there is consensus that this is off (htonll is definitely wrong, and a string
 * is an odd choice), there are clients (SyncGateway) that consume the current
 * string, so it can't be changed.  Note that only little-endian servers are
 * supported for Couchbase, so the 8 byte long inside the string will always be
 * little-endian ordered.
 *
 * Looks like: "0x000058a71dd25c15"
 * Want:        0x155CD21DA7580000   (1539336197457313792 in base10, an epoch
 * time in millionths of a second)
 *
 * returns epoch time in ms
 */
auto
parse_mutation_cas(const std::string& cas) -> std::uint64_t
{
  if (cas.empty()) {
    return 0;
  }

  std::uint64_t val = stoull(cas, nullptr, 16);
  /* byteswap */
  std::size_t ii = 0;
  std::uint64_t ret = 0;
  for (ii = 0; ii < sizeof(std::uint64_t); ii++) {
    ret <<= 8ULL;
    ret |= val & 0xffULL;
    val >>= 8ULL;
  }
  return ret / 1000000;
}

auto
process_document_ids(const tao::json::value& entry,
                     const std::string& key) -> std::optional<std::vector<doc_record>>
{
  const auto* items = entry.find(key);
  if (items == nullptr || !items->is_array()) {
    return {};
  }
  std::vector<doc_record> records;
  records.reserve(items->get_array().size());
  for (const auto& record : items->get_array()) {
    records.push_back(doc_record::create_from(record.get_object()));
  }
  return records;
}

auto
map_to_atr(const operations::lookup_in_response& resp) -> active_transaction_record
{
  std::vector<atr_entry> entries;
  if (resp.fields[0].status == key_value_status_code::success) {
    auto attempts = core::utils::json::parse_binary(resp.fields[0].value);
    auto vbucket = core::utils::json::parse_binary(resp.fields[1].value);
    auto now_ns = now_ns_from_vbucket(vbucket);
    entries.reserve(attempts.get_object().size());
    for (const auto& [key, val] : attempts.get_object()) {
      std::optional<tao::json::value> forward_compat;
      if (const auto* compat = val.find(ATR_FIELD_FORWARD_COMPAT); compat != nullptr) {
        forward_compat = *compat;
      }
      const std::optional<std::uint32_t> expires_after_msec =
        std::max(val.optional<std::int32_t>(ATR_FIELD_EXPIRES_AFTER_MSECS).value_or(0), 0);
      entries.emplace_back(
        resp.ctx.bucket(),
        resp.ctx.id(),
        key,
        attempt_state_value(val.at(ATR_FIELD_STATUS).get_string()),
        parse_mutation_cas(val.optional<std::string>(ATR_FIELD_START_TIMESTAMP).value_or("")),
        parse_mutation_cas(val.optional<std::string>(ATR_FIELD_START_COMMIT).value_or("")),
        parse_mutation_cas(val.optional<std::string>(ATR_FIELD_TIMESTAMP_COMPLETE).value_or("")),
        parse_mutation_cas(
          val.optional<std::string>(ATR_FIELD_TIMESTAMP_ROLLBACK_START).value_or("")),
        parse_mutation_cas(
          val.optional<std::string>(ATR_FIELD_TIMESTAMP_ROLLBACK_COMPLETE).value_or("")),
        expires_after_msec,
        process_document_ids(val, ATR_FIELD_DOCS_INSERTED),
        process_document_ids(val, ATR_FIELD_DOCS_REPLACED),
        process_document_ids(val, ATR_FIELD_DOCS_REMOVED),
        forward_compat,
        now_ns,
        val.optional<std::string>(ATR_FIELD_DURABILITY_LEVEL));
    }
  }
  return { { resp.ctx.bucket(), resp.ctx.scope(), resp.ctx.collection(), resp.ctx.id() },
           resp.cas.value(),
           std::move(entries) };
}

auto
active_transaction_record::get_atr(const core::cluster& cluster, const core::document_id& atr_id)
  -> std::optional<active_transaction_record>
{
  auto barrier = std::promise<std::optional<active_transaction_record>>();
  auto f = barrier.get_future();
  get_atr(cluster, atr_id, [&](std::error_code ec, std::optional<active_transaction_record> atr) {
    if (!ec) {
      return barrier.set_value(std::move(atr));
    }
    return barrier.set_exception(std::make_exception_ptr(std::runtime_error(ec.message())));
  });
  return f.get();
}

void
active_transaction_record::get_atr(
  const core::cluster& cluster,
  const core::document_id& atr_id,
  std::function<void(std::error_code, std::optional<active_transaction_record>)>&& cb)
{
  core::operations::lookup_in_request req{ atr_id };
  req.specs =
    lookup_in_specs{
      lookup_in_specs::get(ATR_FIELD_ATTEMPTS).xattr(),
      lookup_in_specs::get(subdoc::lookup_in_macro::vbucket).xattr(),
    }
      .specs();
  cluster.execute(
    req, [atr_id, cb = std::move(cb)](const core::operations::lookup_in_response& resp) mutable {
      try {
        if (resp.ctx.ec() == couchbase::errc::key_value::document_not_found) {
          // that's ok, just return an empty one.
          return cb({}, {});
        }
        if (!resp.ctx.ec()) {
          // success
          return cb(resp.ctx.ec(), map_to_atr(resp));
        }
        // otherwise, raise an error.
        cb(resp.ctx.ec(), {});
      } catch (const std::exception&) {
        // ok - we have a corrupt ATR.  The question is:  what should we return
        // for an error? Turns out, we don't much care in the code what this error
        // is.  Since we cannot parse the atr, but there wasn't an error, lets
        // select this one for now.
        // TODO(SA): consider a different mechanism - not an error_code.  Or, perhaps
        // we need txn-specific error codes?
        cb(couchbase::errc::key_value::path_invalid, std::nullopt);
      }
    });
}
} // namespace couchbase::core::transactions
