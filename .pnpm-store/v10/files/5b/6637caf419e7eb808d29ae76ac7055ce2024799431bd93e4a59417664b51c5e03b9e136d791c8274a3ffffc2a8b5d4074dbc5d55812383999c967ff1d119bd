/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright 2022-Present Couchbase, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

#pragma once

#include "range_scan_options.hxx"
#include "utils/movable_function.hxx"

#include <tl/expected.hpp>

#include <future>
#include <system_error>

namespace couchbase::core
{
class scan_result_impl;

class range_scan_item_iterator
{
public:
  virtual ~range_scan_item_iterator() = default;
  virtual auto next() -> std::future<tl::expected<range_scan_item, std::error_code>> = 0;
  virtual void next(utils::movable_function<void(range_scan_item, std::error_code)> callback) = 0;
  virtual void cancel() = 0;
  virtual auto is_cancelled() -> bool = 0;
};

class scan_result
{
public:
  scan_result() = default;
  explicit scan_result(std::shared_ptr<range_scan_item_iterator> iterator);
  [[nodiscard]] auto next() const -> tl::expected<range_scan_item, std::error_code>;
  void next(utils::movable_function<void(range_scan_item, std::error_code)> callback) const;
  void cancel();
  [[nodiscard]] auto is_cancelled() -> bool;

private:
  std::shared_ptr<scan_result_impl> impl_{};
};
} // namespace couchbase::core
