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

#include "document_mutate_in.hxx"
#include "core/impl/subdoc/path_flags.hxx"
#include "core/utils/mutation_token.hxx"

#include <couchbase/error_codes.hxx>

#include <algorithm>

namespace couchbase::core::operations
{
auto
mutate_in_request::encode_to(mutate_in_request::encoded_request_type& encoded,
                             mcbp_context&& context) -> std::error_code
{
  if (store_semantics == couchbase::store_semantics::upsert && !cas.empty()) {
    return errc::common::invalid_argument;
  }
  if (create_as_deleted &&
      !context.supports_feature(protocol::hello_feature::subdoc_create_as_deleted)) {
    return errc::common::unsupported_operation;
  }
  if (specs.empty()) {
    return errc::common::invalid_argument;
  }
  for (std::size_t i = 0; i < specs.size(); ++i) {
    auto& entry = specs[i];
    entry.original_index_ = i;

    if (impl::subdoc::has_binary_value_path_flag(specs[i].flags_) &&
        !context.supports_feature(protocol::hello_feature::subdoc_binary_xattr)) {
      impl::subdoc::reset_binary_value_path_flag(specs[i].flags_);
    }
  }
  std::stable_sort(specs.begin(), specs.end(), [](const auto& lhs, const auto& rhs) {
    /* move XATTRs to the beginning of the vector */
    return core::impl::subdoc::has_xattr_path_flag(lhs.flags_) &&
           !core::impl::subdoc::has_xattr_path_flag(rhs.flags_);
  });

  encoded.opaque(opaque);
  encoded.partition(partition);
  encoded.body().id(id);
  encoded.cas(cas);
  if (expiry) {
    encoded.body().expiry(*expiry);
  }
  encoded.body().access_deleted(access_deleted);
  encoded.body().create_as_deleted(create_as_deleted);
  encoded.body().revive_document(revive_document);
  encoded.body().store_semantics(store_semantics);
  encoded.body().specs(specs);
  if (preserve_expiry) {
    encoded.body().preserve_expiry();
  }

  if (context.supports_feature(protocol::hello_feature::subdoc_binary_xattr) && flags) {
    encoded.body().user_flags(flags.value());
  }

  return {};
}

auto
mutate_in_request::make_response(key_value_error_context&& ctx,
                                 const encoded_response_type& encoded) const -> mutate_in_response
{
  bool deleted = false;
  couchbase::cas response_cas{};
  couchbase::mutation_token response_token{};
  std::vector<mutate_in_response::entry> fields{};
  std::error_code ec = ctx.ec();
  std::optional<std::size_t> first_error_index{};
  std::optional<std::string> first_error_path{};

  if (encoded.status() == key_value_status_code::subdoc_success_deleted ||
      encoded.status() == key_value_status_code::subdoc_multi_path_failure_deleted) {
    deleted = true;
  }
  if (!ctx.ec()) {
    fields.resize(specs.size());
    fields.resize(specs.size());
    for (size_t i = 0; i < specs.size(); ++i) {
      const auto& req_entry = specs[i];
      fields[i].original_index = req_entry.original_index_;
      fields[i].path = req_entry.path_;
      fields[i].opcode = static_cast<protocol::subdoc_opcode>(req_entry.opcode_);
      fields[i].status = key_value_status_code::success;
    }
    for (const auto& entry : encoded.body().fields()) {
      if (entry.status == key_value_status_code::success) {
        fields[entry.index].value = utils::to_binary(entry.value);
      } else {
        first_error_index = entry.index;
        first_error_path = fields[entry.index].path;
        fields[entry.index].status = entry.status;
        fields[entry.index].ec = protocol::map_status_code(
          protocol::client_opcode::subdoc_multi_mutation, static_cast<std::uint16_t>(entry.status));
        ec = fields[entry.index].ec;
        break;
      }
    }
    if (!ec) {
      response_cas = encoded.cas();
      response_token =
        couchbase::utils::build_mutation_token(encoded.body().token(), partition, ctx.bucket());
    }
    std::sort(fields.begin(), fields.end(), [](const auto& lhs, const auto& rhs) {
      return lhs.original_index < rhs.original_index;
    });
  } else if (store_semantics == couchbase::store_semantics::insert &&
             (ctx.ec() == errc::common::cas_mismatch ||
              ctx.status_code() == key_value_status_code::not_stored)) {
    ec = errc::key_value::document_exists;
  }
  return mutate_in_response{
    make_subdocument_error_context(ctx, ec, first_error_path, first_error_index, deleted),
    response_cas,
    std::move(response_token),
    std::move(fields),
    deleted,
  };
}
} // namespace couchbase::core::operations
