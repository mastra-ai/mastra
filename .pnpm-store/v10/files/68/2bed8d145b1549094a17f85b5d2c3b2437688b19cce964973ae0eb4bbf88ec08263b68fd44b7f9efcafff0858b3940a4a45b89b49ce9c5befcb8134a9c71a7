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

#include <couchbase/retry_reason.hxx>

#include <set>
#include <string>

namespace couchbase
{
class retry_request
{
public:
  retry_request() = default;
  retry_request(const retry_request&) = default;
  retry_request(retry_request&&) = default;
  auto operator=(const retry_request&) -> retry_request& = default;
  auto operator=(retry_request&&) -> retry_request& = default;

  [[nodiscard]] virtual auto retry_attempts() const -> std::size_t = 0;
  [[nodiscard]] virtual auto identifier() const -> std::string = 0;
  [[nodiscard]] virtual auto idempotent() const -> bool = 0;
  [[nodiscard]] virtual auto retry_reasons() const -> std::set<retry_reason> = 0;

  virtual ~retry_request() = default;

  virtual void record_retry_attempt(retry_reason reason) = 0;
};
} // namespace couchbase
