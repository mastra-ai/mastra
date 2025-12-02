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

namespace couchbase::core::transactions
{
enum error_class {
  FAIL_HARD = 0,
  FAIL_OTHER,
  FAIL_TRANSIENT,
  FAIL_AMBIGUOUS,
  FAIL_DOC_ALREADY_EXISTS,
  FAIL_DOC_NOT_FOUND,
  FAIL_PATH_NOT_FOUND,
  FAIL_CAS_MISMATCH,
  FAIL_WRITE_WRITE_CONFLICT,
  FAIL_ATR_FULL,
  FAIL_PATH_ALREADY_EXISTS,
  FAIL_EXPIRY
};
} // namespace couchbase::core::transactions