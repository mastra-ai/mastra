/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022-Present Couchbase, Inc.
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

#include <couchbase/fail_fast_retry_strategy.hxx>
#include <couchbase/retry_action.hxx>
#include <couchbase/retry_reason.hxx>
#include <couchbase/retry_request.hxx>

#include <spdlog/fmt/bundled/format.h>

#include <memory>
#include <string>

namespace couchbase
{
auto
fail_fast_retry_strategy::retry_after(const retry_request& /* request */,
                                      retry_reason /* reason */) -> retry_action
{
  return retry_action::do_not_retry();
}

auto
fail_fast_retry_strategy::to_string() const -> std::string
{
  return fmt::format(R"(#<fail_fast_retry_strategy:{}>)", static_cast<const void*>(this));
}

auto
make_fail_fast_retry_strategy() -> std::shared_ptr<fail_fast_retry_strategy>
{
  return std::make_shared<fail_fast_retry_strategy>();
}
} // namespace couchbase
