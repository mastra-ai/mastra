/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2020-2021 Couchbase, Inc.
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
#include <couchbase/retry_strategy.hxx>

#include <memory>
#include <mutex>
#include <set>

namespace couchbase::core::io
{

template<bool is_idempotent>
class retry_context : public retry_request
{
public:
  retry_context(std::shared_ptr<retry_strategy> strategy = nullptr, std::string identifier = {})
    : identifier_{ std::move(identifier) }
    , strategy_{ std::move(strategy) }
  {
  }

  [[nodiscard]] auto identifier() const -> std::string override
  {
    return identifier_;
  }

  [[nodiscard]] auto idempotent() const -> bool override
  {
    return is_idempotent;
  }

  [[nodiscard]] auto strategy() const -> std::shared_ptr<retry_strategy>
  {
    return strategy_;
  }

  [[nodiscard]] auto retry_attempts() const -> std::size_t override
  {
    std::scoped_lock lock(*mutex_);
    return retry_attempts_;
  }

  [[nodiscard]] auto retry_reasons() const -> std::set<retry_reason> override
  {
    std::scoped_lock lock(*mutex_);
    return reasons_;
  }

  void record_retry_attempt(retry_reason reason) override
  {
    std::scoped_lock lock(*mutex_);
    ++retry_attempts_;
    reasons_.insert(reason);
  }

  void add_reason(retry_reason reason)
  {
    std::scoped_lock lock(*mutex_);
    reasons_.insert(reason);
  }

private:
  const std::string identifier_;
  const std::shared_ptr<retry_strategy> strategy_;
  mutable std::shared_ptr<std::mutex> mutex_{ std::make_shared<std::mutex>() };
  std::size_t retry_attempts_{ 0 };
  std::set<retry_reason> reasons_{};
};

} // namespace couchbase::core::io
