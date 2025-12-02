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

#include <atomic>
#include <list>
#include <mutex>

namespace couchbase::core::transactions
{

class error_list
{
private:
  std::list<transaction_operation_failed> list_;
  std::mutex mutex_;
  std::atomic<std::size_t> size_{ 0 };

public:
  auto empty() -> bool
  {
    return size_.load() == 0;
  }
  void push_back(const transaction_operation_failed& ex)
  {
    std::lock_guard<std::mutex> lock(mutex_);
    list_.push_back(ex);
    size_ = list_.size();
  }
  void do_throw(std::optional<external_exception> cause = {})
  {
    assert(size_.load() > 0);
    // merge the errors, throw a composite
    std::lock_guard<std::mutex> lock(mutex_);
    transaction_operation_failed::merge_errors(list_, cause);
  }
};
} // namespace couchbase::core::transactions