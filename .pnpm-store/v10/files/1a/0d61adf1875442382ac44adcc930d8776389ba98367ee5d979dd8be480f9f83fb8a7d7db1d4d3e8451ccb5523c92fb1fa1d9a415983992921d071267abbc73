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
#include "internal/exceptions_internal.hxx"
#include "internal/transaction_context.hxx"

#include "exceptions.hxx"
#include "exceptions_fmt.hxx"

namespace couchbase::core::transactions
{
auto
external_exception_from_error_class(error_class ec) -> external_exception
{
  switch (ec) {
    case FAIL_DOC_NOT_FOUND:
      return DOCUMENT_NOT_FOUND_EXCEPTION;
    case FAIL_DOC_ALREADY_EXISTS:
      return DOCUMENT_EXISTS_EXCEPTION;
    default:
      return UNKNOWN;
  }
}

auto
error_class_from_external_exception(external_exception e)
  -> couchbase::core::transactions::error_class
{
  switch (e) {
    case DOCUMENT_NOT_FOUND_EXCEPTION:
      return FAIL_DOC_NOT_FOUND;
    case DOCUMENT_EXISTS_EXCEPTION:
      return FAIL_DOC_ALREADY_EXISTS;
    default:
      return FAIL_OTHER;
  }
}

auto
error_class_from_result(const result& res) -> error_class
{
  const subdoc_result::status_type subdoc_status = res.subdoc_status();
  assert(res.ec ||
         (!res.ignore_subdoc_errors && subdoc_status != subdoc_result::status_type::success));
  if (res.ec || res.ignore_subdoc_errors) {
    if (res.ec == couchbase::errc::key_value::document_not_found) {
      return FAIL_DOC_NOT_FOUND;
    }
    if (res.ec == couchbase::errc::key_value::document_exists) {
      return FAIL_DOC_ALREADY_EXISTS;
    }
    if (res.ec == couchbase::errc::common::cas_mismatch) {
      return FAIL_CAS_MISMATCH;
    }
    if (res.ec == couchbase::errc::key_value::value_too_large) {
      return FAIL_ATR_FULL;
    }
    if (res.ec == couchbase::errc::common::unambiguous_timeout ||
        res.ec == couchbase::errc::common::temporary_failure ||
        res.ec == couchbase::errc::key_value::durable_write_in_progress) {
      return FAIL_TRANSIENT;
    }
    if (res.ec == couchbase::errc::key_value::durability_ambiguous ||
        res.ec == couchbase::errc::common::ambiguous_timeout ||
        res.ec == couchbase::errc::common::request_canceled) {
      return FAIL_AMBIGUOUS;
    }
    if (res.ec == couchbase::errc::key_value::path_not_found) {
      return FAIL_PATH_NOT_FOUND;
    }
    if (res.ec == couchbase::errc::key_value::path_exists) {
      return FAIL_PATH_ALREADY_EXISTS;
    }
    return FAIL_OTHER;
  }
  // TODO(TXNCXX-230): this section is likely redundant, but leaving it here to be compatible with
  // older C++ clients.  It can be removed later.
  if (subdoc_status == subdoc_result::status_type::subdoc_path_not_found) {
    return FAIL_PATH_NOT_FOUND;
  }
  if (subdoc_status == subdoc_result::status_type::subdoc_path_exists) {
    return FAIL_PATH_ALREADY_EXISTS;
  }
  return FAIL_OTHER;
}

transaction_exception::transaction_exception(const std::runtime_error& cause,
                                             const transaction_context& context,
                                             failure_type type)
  : std::runtime_error(cause)
  , result_(context.get_transaction_result())
  , cause_(UNKNOWN)
  , type_(type)
  , txn_id_(context.transaction_id())
{
  const auto* txn_op = dynamic_cast<const transaction_operation_failed*>(&cause);
  if (nullptr != txn_op) {
    cause_ = txn_op->cause();
  }
}

auto
transaction_op_errc_from_external_exception(external_exception e) -> std::error_code
{
  switch (e) {
    case external_exception::NOT_SET:
      return {};
    case external_exception::UNKNOWN:
    case external_exception::COUCHBASE_EXCEPTION:
      return errc::transaction_op::generic;
    case external_exception::ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND:
      return errc::transaction_op::active_transaction_record_entry_not_found;
    case external_exception::ACTIVE_TRANSACTION_RECORD_FULL:
      return errc::transaction_op::active_transaction_record_full;
    case external_exception::COMMIT_NOT_PERMITTED:
      return errc::transaction_op::commit_not_permitted;
    case external_exception::ACTIVE_TRANSACTION_RECORD_NOT_FOUND:
      return errc::transaction_op::active_transaction_record_not_found;
    case external_exception::CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT:
      return errc::transaction_op::concurrent_operations_detected_on_same_document;
    case external_exception::DOCUMENT_ALREADY_IN_TRANSACTION:
      return errc::transaction_op::document_already_in_transaction;
    case external_exception::DOCUMENT_EXISTS_EXCEPTION:
      return errc::transaction_op::document_exists;
    case external_exception::DOCUMENT_NOT_FOUND_EXCEPTION:
      return errc::transaction_op::document_not_found;
    case external_exception::FEATURE_NOT_AVAILABLE_EXCEPTION:
      return errc::transaction_op::feature_not_available;
    case external_exception::FORWARD_COMPATIBILITY_FAILURE:
      return errc::transaction_op::forward_compatibility_failure;
    case external_exception::ILLEGAL_STATE_EXCEPTION:
      return errc::transaction_op::illegal_state;
    case external_exception::PARSING_FAILURE:
      return errc::transaction_op::parsing_failure;
    case external_exception::PREVIOUS_OPERATION_FAILED:
      return errc::transaction_op::previous_operation_failed;
    case external_exception::REQUEST_CANCELED_EXCEPTION:
      return errc::transaction_op::request_canceled;
    case external_exception::ROLLBACK_NOT_PERMITTED:
      return errc::transaction_op::rollback_not_permitted;
    case external_exception::SERVICE_NOT_AVAILABLE_EXCEPTION:
      return errc::transaction_op::service_not_available;
    case external_exception::TRANSACTION_ABORTED_EXTERNALLY:
      return errc::transaction_op::transaction_aborted_externally;
    case external_exception::TRANSACTION_ALREADY_ABORTED:
      return errc::transaction_op::transaction_already_aborted;
    case external_exception::TRANSACTION_ALREADY_COMMITTED:
      return errc::transaction_op::transaction_already_committed;
    case external_exception::DOCUMENT_UNRETRIEVABLE_EXCEPTION:
      return errc::transaction_op::document_unretrievable;
  }
  return errc::transaction_op::generic;
}

auto
external_exception_from_transaction_op_errc(errc::transaction_op ec) -> external_exception
{
  switch (ec) {
    case errc::transaction_op::generic:
      return external_exception::UNKNOWN;
    case errc::transaction_op::active_transaction_record_entry_not_found:
      return external_exception::ACTIVE_TRANSACTION_RECORD_ENTRY_NOT_FOUND;
    case errc::transaction_op::active_transaction_record_full:
      return external_exception::ACTIVE_TRANSACTION_RECORD_FULL;
    case errc::transaction_op::active_transaction_record_not_found:
      return external_exception::ACTIVE_TRANSACTION_RECORD_NOT_FOUND;
    case errc::transaction_op::document_already_in_transaction:
      return external_exception::DOCUMENT_ALREADY_IN_TRANSACTION;
    case errc::transaction_op::document_exists:
      return external_exception::DOCUMENT_EXISTS_EXCEPTION;
    case errc::transaction_op::document_not_found:
      return external_exception::DOCUMENT_NOT_FOUND_EXCEPTION;
    case errc::transaction_op::feature_not_available:
      return external_exception::FEATURE_NOT_AVAILABLE_EXCEPTION;
    case errc::transaction_op::transaction_aborted_externally:
      return external_exception::TRANSACTION_ABORTED_EXTERNALLY;
    case errc::transaction_op::previous_operation_failed:
      return external_exception::PREVIOUS_OPERATION_FAILED;
    case errc::transaction_op::forward_compatibility_failure:
      return external_exception::FORWARD_COMPATIBILITY_FAILURE;
    case errc::transaction_op::parsing_failure:
      return external_exception::PARSING_FAILURE;
    case errc::transaction_op::illegal_state:
      return external_exception::ILLEGAL_STATE_EXCEPTION;
    case errc::transaction_op::service_not_available:
      return external_exception::SERVICE_NOT_AVAILABLE_EXCEPTION;
    case errc::transaction_op::request_canceled:
      return external_exception::REQUEST_CANCELED_EXCEPTION;
    case errc::transaction_op::concurrent_operations_detected_on_same_document:
      return external_exception::CONCURRENT_OPERATIONS_DETECTED_ON_SAME_DOCUMENT;
    case errc::transaction_op::commit_not_permitted:
      return external_exception::COMMIT_NOT_PERMITTED;
    case errc::transaction_op::rollback_not_permitted:
      return external_exception::ROLLBACK_NOT_PERMITTED;
    case errc::transaction_op::transaction_already_aborted:
      return external_exception::TRANSACTION_ALREADY_ABORTED;
    case errc::transaction_op::transaction_already_committed:
      return external_exception::TRANSACTION_ALREADY_COMMITTED;
    case errc::transaction_op::document_unretrievable:
      return external_exception::DOCUMENT_UNRETRIEVABLE_EXCEPTION;
    default:
      return external_exception::UNKNOWN;
  }
}

} // namespace couchbase::core::transactions
