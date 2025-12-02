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

#include <couchbase/error_codes.hxx>
#include <couchbase/subdoc/lookup_in_macro.hxx>

#include <cstdint>
#include <string>

namespace couchbase::subdoc
{
namespace
{
const auto macro_document{ "$document" };
const auto macro_expiry_time{ "$document.exptime" };
const auto macro_cas{ "$document.CAS" };
const auto macro_sequence_number{ "$document.seqno" };
const auto macro_vbucket_uuid{ "$document.vbucket_uuid" };
const auto macro_last_modified{ "$document.last_modified" };
const auto macro_is_deleted{ "$document.deleted" };
const auto macro_value_size_bytes{ "$document.value_bytes" };
const auto macro_revision_id{ "$document.revision_id" };
const auto macro_flags{ "$document.flags" };
const auto macro_vbucket{ "$vbucket" };
} // namespace

auto
to_lookup_in_macro(std::string_view input) -> std::optional<couchbase::subdoc::lookup_in_macro>
{
  if (input == macro_document) {
    return lookup_in_macro::document;
  }
  if (input == macro_expiry_time) {
    return lookup_in_macro::expiry_time;
  }
  if (input == macro_cas) {
    return lookup_in_macro::cas;
  }
  if (input == macro_sequence_number) {
    return lookup_in_macro::sequence_number;
  }
  if (input == macro_vbucket_uuid) {
    return lookup_in_macro::vbucket_uuid;
  }
  if (input == macro_last_modified) {
    return lookup_in_macro::last_modified;
  }
  if (input == macro_is_deleted) {
    return lookup_in_macro::is_deleted;
  }
  if (input == macro_value_size_bytes) {
    return lookup_in_macro::value_size_bytes;
  }
  if (input == macro_revision_id) {
    return lookup_in_macro::revision_id;
  }
  if (input == macro_flags) {
    return lookup_in_macro::flags;
  }
  if (input == macro_vbucket) {
    return lookup_in_macro::vbucket;
  }
  return {};
}

auto
to_string(lookup_in_macro value) -> std::string
{
  switch (value) {
    case lookup_in_macro::document:
      return macro_document;

    case lookup_in_macro::expiry_time:
      return macro_expiry_time;

    case lookup_in_macro::cas:
      return macro_cas;

    case lookup_in_macro::sequence_number:
      return macro_sequence_number;

    case lookup_in_macro::vbucket_uuid:
      return macro_vbucket_uuid;

    case lookup_in_macro::last_modified:
      return macro_last_modified;

    case lookup_in_macro::is_deleted:
      return macro_is_deleted;

    case lookup_in_macro::value_size_bytes:
      return macro_value_size_bytes;

    case lookup_in_macro::revision_id:
      return macro_revision_id;

    case lookup_in_macro::flags:
      return macro_flags;

    case lookup_in_macro::vbucket:
      return macro_vbucket;
  }
  throw std::system_error(errc::common::invalid_argument,
                          "Unexpected lookup_in macro: " +
                            std::to_string(static_cast<std::uint32_t>(value)));
}
} // namespace couchbase::subdoc
