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

#include "internal/exceptions_internal.hxx"

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace couchbase::core::transactions
{
enum class forward_compat_stage : std::uint8_t {
  WRITE_WRITE_CONFLICT_READING_ATR,
  WRITE_WRITE_CONFLICT_REPLACING,
  WRITE_WRITE_CONFLICT_REMOVING,
  WRITE_WRITE_CONFLICT_INSERTING,
  WRITE_WRITE_CONFLICT_INSERTING_GET,
  GETS,
  GETS_READING_ATR,
  CLEANUP_ENTRY,
  CAS_MISMATCH_DURING_COMMIT,
  CAS_MISMATCH_DURING_ROLLBACK,
  CAS_MISMATCH_DURING_STAGING,
  GET_MULTI_GET,
};

auto
to_string(forward_compat_stage value) -> std::string;

enum class forward_compat_behavior : std::uint8_t {
  CONTINUE,
  RETRY_TXN,
  FAIL_FAST_TXN
};

auto
create_forward_compat_behavior(const std::string& str) -> forward_compat_behavior;

// used only for logging
auto
forward_compat_behavior_name(forward_compat_behavior b) -> const char*;

struct forward_compat_supported {
  std::uint32_t protocol_major = 2;
  std::uint32_t protocol_minor = 0;
  std::list<std::string> extensions{
    "BF3705", // BF-CBD-3705
    "BF3787", // BF-CBD-3787
    "BF3791", // BF-CBD-3791
    "BF3838", // BF-CBD-3838
    "BM",     // ExtBinaryMetadata
    "BS",     // ExtBinarySupport
    "CM",     // ExtCustomMetadataCollection
    "CO",     // ExtAllKVCombinations
    "IX",     // ExtInsertExisting
    "MO",     // ExtMemoryOptUnstaging
    "PU",     // ExtParallelUnstaging
    "QC",     // ExtQueryContext
    "QU",     // ExtQuery
    "RC",     // ExtRemoveCompleted
    "RP",     // ExtReplicaFromPreferredGroup
    "RX",     // ExtReplaceBodyWithXattr
    "SD",     // ExtStoreDurability
    "SI",     // ExtSDKIntegration
    "TI",     // ExtTransactionId
    "TS",     // ExtThreadSafety
    "UA",     // ExtUnknownATRStates
    "GM",     // ExtGetMulti
    "RPP1",   // ExtReplicaFromPreferredGroupPatch1
  };
};

class transaction_operation_failed;

auto
check_forward_compat(forward_compat_stage stage, std::optional<tao::json::value> json)
  -> std::optional<transaction_operation_failed>;
} // namespace couchbase::core::transactions
