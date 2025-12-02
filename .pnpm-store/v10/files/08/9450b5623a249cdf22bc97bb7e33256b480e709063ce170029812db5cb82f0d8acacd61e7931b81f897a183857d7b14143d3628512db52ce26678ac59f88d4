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

#include <couchbase/retry_action.hxx>

namespace couchbase
{
retry_action::retry_action(std::chrono::milliseconds waiting_duration)
  : waiting_duration_{ waiting_duration }
{
}

auto
retry_action::need_to_retry() const -> bool
{
  return waiting_duration_ != std::chrono::milliseconds::zero();
}

auto
retry_action::do_not_retry() -> const retry_action&
{
  const static retry_action instance{ std::chrono::milliseconds::zero() };
  return instance;
}
} // namespace couchbase
