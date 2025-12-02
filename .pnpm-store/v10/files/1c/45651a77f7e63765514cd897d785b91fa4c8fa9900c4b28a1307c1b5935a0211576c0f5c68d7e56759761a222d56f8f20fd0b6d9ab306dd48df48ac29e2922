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

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::transactions::error_class> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::transactions::error_class ec, FormatContext& ctx) const
  {
    string_view name = "UNKNOWN ERROR CLASS";
    switch (ec) {
      case couchbase::core::transactions::FAIL_HARD:
        name = "FAIL_HARD";
        break;
      case couchbase::core::transactions::FAIL_OTHER:
        name = "FAIL_OTHER";
        break;
      case couchbase::core::transactions::FAIL_TRANSIENT:
        name = "FAIL_TRANSIENT";
        break;
      case couchbase::core::transactions::FAIL_AMBIGUOUS:
        name = "FAIL_AMBIGUOUS";
        break;
      case couchbase::core::transactions::FAIL_DOC_ALREADY_EXISTS:
        name = "FAIL_DOC_ALREADY_EXISTS";
        break;
      case couchbase::core::transactions::FAIL_DOC_NOT_FOUND:
        name = "FAIL_DOC_NOT_FOUND";
        break;
      case couchbase::core::transactions::FAIL_PATH_NOT_FOUND:
        name = "FAIL_PATH_NOT_FOUND";
        break;
      case couchbase::core::transactions::FAIL_CAS_MISMATCH:
        name = "FAIL_CAS_MISMATCH";
        break;
      case couchbase::core::transactions::FAIL_WRITE_WRITE_CONFLICT:
        name = "FAIL_WRITE_WRITE_CONFLICT";
        break;
      case couchbase::core::transactions::FAIL_ATR_FULL:
        name = "FAIL_ATR_FULL";
        break;
      case couchbase::core::transactions::FAIL_PATH_ALREADY_EXISTS:
        name = "FAIL_PATH_ALREADY_EXISTS";
        break;
      case couchbase::core::transactions::FAIL_EXPIRY:
        name = "FAIL_EXPIRY";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};

template<>
struct fmt::formatter<couchbase::core::transactions::final_error> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::transactions::final_error to_raise, FormatContext& ctx) const
  {
    string_view name = "UNKNOWN FINAL ERROR";
    switch (to_raise) {
      case couchbase::core::transactions::FAILED:
        name = "FAILED";
        break;
      case couchbase::core::transactions::EXPIRED:
        name = "EXPIRED";
        break;
      case couchbase::core::transactions::FAILED_POST_COMMIT:
        name = "FAILED_POST_COMMIT";
        break;
      case couchbase::core::transactions::AMBIGUOUS:
        name = "AMBIGUOUS";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
