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

#include <string>

namespace couchbase::core::transactions
{
// Fields in the Active Transaction Records
// These are keep as brief as possible, more important to reduce changes of doc overflowing
// than to preserve human debuggability
static const std::string ATR_FIELD_ATTEMPTS = "attempts";
static const std::string ATR_FIELD_STATUS = "st";
static const std::string ATR_FIELD_START_TIMESTAMP = "tst";
static const std::string ATR_FIELD_EXPIRES_AFTER_MSECS = "exp";
static const std::string ATR_FIELD_START_COMMIT = "tsc";
static const std::string ATR_FIELD_TIMESTAMP_COMPLETE = "tsco";
static const std::string ATR_FIELD_TIMESTAMP_ROLLBACK_START = "tsrs";
static const std::string ATR_FIELD_TIMESTAMP_ROLLBACK_COMPLETE = "tsrc";
static const std::string ATR_FIELD_DOCS_INSERTED = "ins";
static const std::string ATR_FIELD_DOCS_REPLACED = "rep";
static const std::string ATR_FIELD_DOCS_REMOVED = "rem";
static const std::string ATR_FIELD_PER_DOC_ID = "id";
static const std::string ATR_FIELD_PER_DOC_BUCKET = "bkt";
static const std::string ATR_FIELD_PER_DOC_SCOPE = "scp";
static const std::string ATR_FIELD_PER_DOC_COLLECTION = "col";
static const std::string ATR_FIELD_TRANSACTION_ID = "tid";
static const std::string ATR_FIELD_FORWARD_COMPAT = "fc";
static const std::string ATR_FIELD_DURABILITY_LEVEL = "d";
static const std::string ATR_FIELD_PREVENT_COLLLISION = "p";

// Fields inside regular docs that are part of a transaction
static const std::string TRANSACTION_INTERFACE_PREFIX_ONLY = "txn";
static const std::string TRANSACTION_INTERFACE_PREFIX = TRANSACTION_INTERFACE_PREFIX_ONLY + ".";
static const std::string TRANSACTION_RESTORE_PREFIX_ONLY =
  TRANSACTION_INTERFACE_PREFIX_ONLY + ".restore";
static const std::string TRANSACTION_RESTORE_PREFIX = TRANSACTION_RESTORE_PREFIX_ONLY + ".";
static const std::string TRANSACTION_ID = TRANSACTION_INTERFACE_PREFIX + "id.txn";
static const std::string ATTEMPT_ID = TRANSACTION_INTERFACE_PREFIX + "id.atmpt";
static const std::string OPERATION_ID = TRANSACTION_INTERFACE_PREFIX + "id.op";
static const std::string ATR_ID = TRANSACTION_INTERFACE_PREFIX + "atr.id";
static const std::string ATR_BUCKET_NAME = TRANSACTION_INTERFACE_PREFIX + "atr.bkt";

// The current plan is:
// 6.5 and below: write metadata docs to the default collection
// 7.0 and above: write them to the system collection, and migrate them over
// Adding scope and collection metadata fields to try and future proof
static const std::string ATR_COLL_NAME = TRANSACTION_INTERFACE_PREFIX + "atr.coll";
static const std::string ATR_SCOPE_NAME = TRANSACTION_INTERFACE_PREFIX + "atr.scp";
static const std::string STAGED_DATA = TRANSACTION_INTERFACE_PREFIX + "op.stgd";
static const std::string STAGED_BINARY_DATA = TRANSACTION_INTERFACE_PREFIX + "op.bin";
static const std::string TYPE = TRANSACTION_INTERFACE_PREFIX + "op.type";
static const std::string CRC32_OF_STAGING = TRANSACTION_INTERFACE_PREFIX + "op.crc32";
static const std::string FORWARD_COMPAT = TRANSACTION_INTERFACE_PREFIX + "fc";

static const std::string PRE_TXN_CAS = TRANSACTION_RESTORE_PREFIX + "CAS";
static const std::string PRE_TXN_REVID = TRANSACTION_RESTORE_PREFIX + "revid";
static const std::string PRE_TXN_EXPTIME = TRANSACTION_RESTORE_PREFIX + "exptime";

} // namespace couchbase::core::transactions
