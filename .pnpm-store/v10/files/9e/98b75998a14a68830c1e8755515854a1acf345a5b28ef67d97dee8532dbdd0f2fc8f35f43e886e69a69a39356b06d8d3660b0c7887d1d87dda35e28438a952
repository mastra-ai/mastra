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

#pragma once

#include <couchbase/retry_action.hxx>
#include <couchbase/retry_reason.hxx>
#include <couchbase/retry_request.hxx>

namespace couchbase
{
class retry_strategy
{
public:
  retry_strategy() = default;
  retry_strategy(const retry_strategy&) = default;
  retry_strategy(retry_strategy&&) = default;
  auto operator=(const retry_strategy&) -> retry_strategy& = default;
  auto operator=(retry_strategy&&) -> retry_strategy& = default;

  virtual ~retry_strategy() = default;
  virtual auto retry_after(const retry_request& request, retry_reason reason) -> retry_action = 0;
  [[nodiscard]] virtual auto to_string() const -> std::string = 0;
};
} // namespace couchbase
