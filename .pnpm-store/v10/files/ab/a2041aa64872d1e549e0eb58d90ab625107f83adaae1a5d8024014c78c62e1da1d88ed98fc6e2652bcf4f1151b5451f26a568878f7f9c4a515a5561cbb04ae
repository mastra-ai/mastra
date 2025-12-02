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

#include "exceptions.hxx"

#include <spdlog/fmt/bundled/core.h>

template<>
struct fmt::formatter<couchbase::core::transactions::external_exception> {
  template<typename ParseContext>
  constexpr auto parse(ParseContext& ctx)
  {
    return ctx.begin();
  }

  template<typename FormatContext>
  auto format(couchbase::core::transactions::external_exception ec, FormatContext& ctx) const
  {
    string_view name = "<UNKNOWN EXTERNAL EXCEPTION>";
    switch (ec) {
      case couchbase::core::transactions::UNKNOWN:
        name = "UNKNOWN";
        break;
      case couchbase::core::transactions::ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND:
        name = "ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND";
        break;
      case couchbase::core::transactions::ACTIVE_TRANSACTION_RECORD_FULL:
        name = "ACTIVE_TRANSACTION_RECORD_FULL";
        break;
      case couchbase::core::transactions::ACTIVE_TRANSACTION_RECORD_NOT_FOUND:
        name = "ACTIVE_TRANSACTION_RECORD_NOT_FOUND";
        break;
      case couchbase::core::transactions::DOCUMENT_ALREADY_IN_TRANSACTION:
        name = "DOCUMENT_ALREADY_IN_TRANSACTION";
        break;
      case couchbase::core::transactions::DOCUMENT_EXISTS_EXCEPTION:
        name = "DOCUMENT_EXISTS_EXCEPTION";
        break;
      case couchbase::core::transactions::DOCUMENT_NOT_FOUND_EXCEPTION:
        name = "DOCUMENT_NOT_FOUND_EXCEPTION";
        break;
      case couchbase::core::transactions::NOT_SET:
        name = "NOT_SET";
        break;
      case couchbase::core::transactions::FEATURE_NOT_AVAILABLE_EXCEPTION:
        name = "FEATURE_NOT_AVAILABLE_EXCEPTION";
        break;
      case couchbase::core::transactions::TRANSACTION_ABORTED_EXTERNALLY:
        name = "TRANSACTION_ABORTED_EXTERNALLY";
        break;
      case couchbase::core::transactions::PREVIOUS_OPERATION_FAILED:
        name = "PREVIOUS_OPERATION_FAILED";
        break;
      case couchbase::core::transactions::FORWARD_COMPATIBILITY_FAILURE:
        name = "FORWARD_COMPATIBILITY_FAILURE";
        break;
      case couchbase::core::transactions::PARSING_FAILURE:
        name = "PARSING_FAILURE";
        break;
      case couchbase::core::transactions::ILLEGAL_STATE_EXCEPTION:
        name = "ILLEGAL_STATE_EXCEPTION";
        break;
      case couchbase::core::transactions::COUCHBASE_EXCEPTION:
        name = "COUCHBASE_EXCEPTION";
        break;
      case couchbase::core::transactions::SERVICE_NOT_AVAILABLE_EXCEPTION:
        name = "SERVICE_NOT_AVAILABLE_EXCEPTION";
        break;
      case couchbase::core::transactions::REQUEST_CANCELED_EXCEPTION:
        name = "REQUEST_CANCELED_EXCEPTION";
        break;
      case couchbase::core::transactions::CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT:
        name = "CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT";
        break;
      case couchbase::core::transactions::COMMIT_NOT_PERMITTED:
        name = "COMMIT_NOT_PERMITTED";
        break;
      case couchbase::core::transactions::ROLLBACK_NOT_PERMITTED:
        name = "ROLLBACK_NOT_PERMITTED";
        break;
      case couchbase::core::transactions::TRANSACTION_ALREADY_ABORTED:
        name = "TRANSACTION_ALREADY_ABORTED";
        break;
      case couchbase::core::transactions::TRANSACTION_ALREADY_COMMITTED:
        name = "TRANSACTION_ALREADY_COMMITTED";
        break;
      case couchbase::core::transactions::DOCUMENT_UNRETRIEVABLE_EXCEPTION:
        name = "DOCUMENT_UNRETRIEVABLE_EXCEPTION";
        break;
    }
    return format_to(ctx.out(), "{}", name);
  }
};
