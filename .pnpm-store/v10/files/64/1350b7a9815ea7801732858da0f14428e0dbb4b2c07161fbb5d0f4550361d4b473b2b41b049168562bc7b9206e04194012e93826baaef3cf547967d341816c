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

#include <chrono>

namespace couchbase
{
class retry_action
{
public:
  static auto do_not_retry() -> const retry_action&;

  explicit retry_action(std::chrono::milliseconds waiting_duration);

  [[nodiscard]] auto need_to_retry() const -> bool;

  [[nodiscard]] auto duration() const -> std::chrono::milliseconds
  {
    return waiting_duration_;
  }

private:
  std::chrono::milliseconds waiting_duration_;
};
} // namespace couchbase
