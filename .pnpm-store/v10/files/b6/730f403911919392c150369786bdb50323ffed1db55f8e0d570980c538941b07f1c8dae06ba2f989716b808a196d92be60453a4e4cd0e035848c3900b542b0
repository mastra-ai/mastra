/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2024. Couchbase, Inc.
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
#include <couchbase/scan_result.hxx>

#include "core/range_scan_orchestrator.hxx"
#include "core/scan_result.hxx"

namespace couchbase
{
class internal_scan_result
{

public:
  explicit internal_scan_result(core::scan_result core_result,
                                std::shared_ptr<crypto::manager> crypto_manager);
  internal_scan_result(const internal_scan_result&) = delete;
  internal_scan_result(internal_scan_result&&) noexcept = default;
  auto operator=(const internal_scan_result&) -> internal_scan_result& = delete;
  auto operator=(internal_scan_result&&) noexcept -> internal_scan_result& = default;

  ~internal_scan_result();
  void next(scan_item_handler&& handler);
  void cancel();

private:
  core::scan_result core_result_;
  std::shared_ptr<crypto::manager> crypto_manager_;
};
} // namespace couchbase
