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

#include "document_lookup_in.hxx"

#include "core/impl/subdoc/path_flags.hxx"
#include "core/protocol/hello_feature.hxx"
#include "core/utils/json.hxx"

#include <couchbase/error_codes.hxx>

#include <tao/json/value.hpp>

namespace couchbase::core::operations
{
auto
lookup_in_request::encode_to(lookup_in_request::encoded_request_type& encoded,
                             mcbp_context&& context) -> std::error_code
{
  if (specs.empty()) {
    return errc::common::invalid_argument;
  }

  for (std::size_t i = 0; i < specs.size(); ++i) {
    specs[i].original_index_ = i;

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
  encoded.body().access_deleted(access_deleted);
  encoded.body().specs(specs);
  return {};
}

auto
lookup_in_request::make_response(key_value_error_context&& ctx,
                                 const encoded_response_type& encoded) const -> lookup_in_response
{

  bool deleted = false;
  couchbase::cas cas{};
  std::vector<lookup_in_response::entry> fields{};
  std::error_code ec = ctx.ec();
  std::optional<std::size_t> first_error_index{};
  std::optional<std::string> first_error_path{};

  if (encoded.status() == key_value_status_code::subdoc_success_deleted ||
      encoded.status() == key_value_status_code::subdoc_multi_path_failure_deleted) {
    deleted = true;
  }
  if (!ctx.ec()) {
    fields.resize(specs.size());
    for (size_t i = 0; i < specs.size(); ++i) {
      const auto& req_entry = specs[i];
      fields[i].original_index = req_entry.original_index_;
      fields[i].path = req_entry.path_;
      fields[i].opcode = static_cast<protocol::subdoc_opcode>(req_entry.opcode_);
      fields[i].status = key_value_status_code::success;
    }
    for (size_t i = 0; i < encoded.body().fields().size(); ++i) {
      const auto& res_entry = encoded.body().fields()[i];
      fields[i].status = res_entry.status;
      fields[i].ec = protocol::map_status_code(protocol::client_opcode::subdoc_multi_mutation,
                                               static_cast<std::uint16_t>(res_entry.status));
      if (fields[i].opcode == protocol::subdoc_opcode::exists &&
          fields[i].ec == errc::key_value::path_not_found) {
        fields[i].ec.clear();
      }
      if (!fields[i].ec && !ctx.ec()) {
        ec = fields[i].ec;
      }
      if (!first_error_index && !fields[i].ec) {
        first_error_index = i;
        first_error_path = fields[i].path;
      }
      fields[i].exists = res_entry.status == key_value_status_code::success ||
                         res_entry.status == key_value_status_code::subdoc_success_deleted;
      if (fields[i].opcode == protocol::subdoc_opcode::exists && !fields[i].ec) {
        fields[i].value = utils::json::generate_binary(fields[i].exists);
      } else {
        fields[i].value = utils::to_binary(res_entry.value);
      }
    }
    if (!ec) {
      cas = encoded.cas();
    }
    std::sort(fields.begin(), fields.end(), [](const auto& lhs, const auto& rhs) {
      return lhs.original_index < rhs.original_index;
    });
  }

  return lookup_in_response{
    make_subdocument_error_context(ctx, ec, first_error_path, first_error_index, deleted),
    cas,
    std::move(fields),
    deleted,
  };
}
} // namespace couchbase::core::operations
