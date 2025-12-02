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

struct streaming_json_lexer_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.streaming_json_lexer";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::streaming_json_lexer>(ev)) {
      case errc::streaming_json_lexer::garbage_trailing:
        return "garbage_trailing (1101)";
      case errc::streaming_json_lexer::special_expected:
        return "special_expected (1102)";
      case errc::streaming_json_lexer::special_incomplete:
        return "special_incomplete (1103)";
      case errc::streaming_json_lexer::stray_token:
        return "stray_token (1104)";
      case errc::streaming_json_lexer::missing_token:
        return "missing_token (1105)";
      case errc::streaming_json_lexer::cannot_insert:
        return "cannot_insert (1106)";
      case errc::streaming_json_lexer::escape_outside_string:
        return "escape_outside_string (1107)";
      case errc::streaming_json_lexer::key_outside_object:
        return "key_outside_object (1108)";
      case errc::streaming_json_lexer::string_outside_container:
        return "string_outside_container (1109)";
      case errc::streaming_json_lexer::found_null_byte:
        return "found_null_byte (1110)";
      case errc::streaming_json_lexer::levels_exceeded:
        return "levels_exceeded (1111)";
      case errc::streaming_json_lexer::bracket_mismatch:
        return "bracket_mismatch (1112)";
      case errc::streaming_json_lexer::object_key_expected:
        return "object_key_expected (1113)";
      case errc::streaming_json_lexer::weird_whitespace:
        return "weird_whitespace (1114)";
      case errc::streaming_json_lexer::unicode_escape_is_too_short:
        return "unicode_escape_is_too_short (1115)";
      case errc::streaming_json_lexer::escape_invalid:
        return "escape_invalid (1116)";
      case errc::streaming_json_lexer::trailing_comma:
        return "trailing_comma (1117)";
      case errc::streaming_json_lexer::invalid_number:
        return "invalid_number (1118)";
      case errc::streaming_json_lexer::value_expected:
        return "value_expected (1119)";
      case errc::streaming_json_lexer::percent_bad_hex:
        return "percent_bad_hex (1120)";
      case errc::streaming_json_lexer::json_pointer_bad_path:
        return "json_pointer_bad_path (1121)";
      case errc::streaming_json_lexer::json_pointer_duplicated_slash:
        return "json_pointer_duplicated_slash (1122)";
      case errc::streaming_json_lexer::json_pointer_missing_root:
        return "json_pointer_missing_root (1123)";
      case errc::streaming_json_lexer::not_enough_memory:
        return "not_enough_memory (1124)";
      case errc::streaming_json_lexer::invalid_codepoint:
        return "invalid_codepoint (1125)";
      case errc::streaming_json_lexer::generic:
        return "generic (1126)";
      case errc::streaming_json_lexer::root_is_not_an_object:
        return "root_is_not_an_object (1127)";
      case errc::streaming_json_lexer::root_does_not_match_json_pointer:
        return "root_does_not_match_json_pointer (1128)";
    }
    return "FIXME: unknown error code (recompile with newer library): "
           "couchbase.streaming_json_lexer." +
           std::to_string(ev);
  }
};

const inline static streaming_json_lexer_error_category category_instance;

auto
streaming_json_lexer_category() noexcept -> const std::error_category&
{
  return category_instance;
}
} // namespace couchbase::core::impl
