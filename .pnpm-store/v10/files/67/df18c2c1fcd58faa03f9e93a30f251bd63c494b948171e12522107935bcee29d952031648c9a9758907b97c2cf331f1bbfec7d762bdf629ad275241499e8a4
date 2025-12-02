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

#include <string>

namespace couchbase::core::impl
{
struct key_value_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.key_value";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::key_value>(ev)) {
      case errc::key_value::document_not_found:
        return "document_not_found (101)";
      case errc::key_value::document_irretrievable:
        return "document_irretrievable (102)";
      case errc::key_value::document_locked:
        return "document_locked (103)";
      case errc::key_value::value_too_large:
        return "value_too_large (104)";
      case errc::key_value::document_exists:
        return "document_exists (105)";
      case errc::key_value::durability_level_not_available:
        return "durability_level_not_available (107)";
      case errc::key_value::durability_impossible:
        return "durability_impossible (108)";
      case errc::key_value::durability_ambiguous:
        return "durability_ambiguous (109)";
      case errc::key_value::durable_write_in_progress:
        return "durable_write_in_progress (110)";
      case errc::key_value::durable_write_re_commit_in_progress:
        return "durable_write_re_commit_in_progress (111)";
      case errc::key_value::path_not_found:
        return "path_not_found (113)";
      case errc::key_value::path_mismatch:
        return "path_mismatch (114)";
      case errc::key_value::path_invalid:
        return "path_invalid (115)";
      case errc::key_value::path_too_big:
        return "path_too_big (116)";
      case errc::key_value::path_too_deep:
        return "path_too_deep (117)";
      case errc::key_value::value_too_deep:
        return "value_too_deep (118)";
      case errc::key_value::value_invalid:
        return "value_invalid (119)";
      case errc::key_value::document_not_json:
        return "document_not_json (120)";
      case errc::key_value::number_too_big:
        return "number_too_big (121)";
      case errc::key_value::delta_invalid:
        return "delta_invalid (122)";
      case errc::key_value::path_exists:
        return "path_exists (123)";
      case errc::key_value::xattr_unknown_macro:
        return "xattr_unknown_macro (124)";
      case errc::key_value::xattr_invalid_key_combo:
        return "xattr_invalid_key_combo (126)";
      case errc::key_value::xattr_unknown_virtual_attribute:
        return "xattr_unknown_virtual_attribute (127)";
      case errc::key_value::xattr_cannot_modify_virtual_attribute:
        return "xattr_cannot_modify_virtual_attribute (128)";
      case errc::key_value::xattr_no_access:
        return "xattr_no_access (130)";
      case errc::key_value::document_not_locked:
        return "document_not_locked (131)";
      case errc::key_value::cannot_revive_living_document:
        return "cannot_revive_living_document (132)";
      case errc::key_value::mutation_token_outdated:
        return "mutation_token_outdated (133)";
      case errc::key_value::range_scan_completed:
        return "range_scan_completed (134)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.key_value." +
           std::to_string(ev);
  }
};

const inline static key_value_error_category category_instance;

auto
key_value_category() noexcept -> const std::error_category&
{
  return category_instance;
}
} // namespace couchbase::core::impl
