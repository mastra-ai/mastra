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

struct transaction_op_error_category : std::error_category {
  [[nodiscard]] auto name() const noexcept -> const char* override
  {
    return "couchbase.transaction_op";
  }

  [[nodiscard]] auto message(int ev) const noexcept -> std::string override
  {
    switch (static_cast<errc::transaction_op>(ev)) {
      case errc::transaction_op::generic:
        return "generic (1300)";
      case errc::transaction_op::active_transaction_record_entry_not_found:
        return "active_transaction_record_entry_not_found (1301)";
      case errc::transaction_op::active_transaction_record_full:
        return "active_transaction_record_full (1302)";
      case errc::transaction_op::active_transaction_record_not_found:
        return "active_transaction_record_not_found (1303)";
      case errc::transaction_op::document_already_in_transaction:
        return "document_already_in_transaction (1304)";
      case errc::transaction_op::document_exists:
        return "document_exists (1305)";
      case errc::transaction_op::document_not_found:
        return "document_not_found (1306)";
      case errc::transaction_op::feature_not_available:
        return "feature_not_available (1307)";
      case errc::transaction_op::transaction_aborted_externally:
        return "transaction_aborted_externally (1308)";
      case errc::transaction_op::previous_operation_failed:
        return "previous_operation_failed (1309)";
      case errc::transaction_op::forward_compatibility_failure:
        return "forward_compatibility_failure (1310)";
      case errc::transaction_op::parsing_failure:
        return "parsing_failure (1311)";
      case errc::transaction_op::illegal_state:
        return "illegal_state (1312)";
      case errc::transaction_op::service_not_available:
        return "service_not_available (1313)";
      case errc::transaction_op::request_canceled:
        return "request_canceled (1314)";
      case errc::transaction_op::concurrent_operations_detected_on_same_document:
        return "concurrent_operations_detected_on_same_document (1315)";
      case errc::transaction_op::commit_not_permitted:
        return "commit_not_permitted (1316)";
      case errc::transaction_op::rollback_not_permitted:
        return "rollback_not_permitted (1317)";
      case errc::transaction_op::transaction_already_aborted:
        return "transaction_already_aborted (1318)";
      case errc::transaction_op::transaction_already_committed:
        return "transaction_already_committed (1319)";
      case errc::transaction_op::document_unretrievable:
        return "document_unretrievable (1320)";
      case errc::transaction_op::transaction_op_failed:
        return "transaction_op_failed (1399)";
    }
    return "FIXME: unknown error code (recompile with newer library): couchbase.transaction_op." +
           std::to_string(ev);
  }
};

const inline static transaction_op_error_category transaction_op_category_instance;

auto
transaction_op_category() noexcept -> const std::error_category&
{
  return transaction_op_category_instance;
}

} // namespace couchbase::core::impl
