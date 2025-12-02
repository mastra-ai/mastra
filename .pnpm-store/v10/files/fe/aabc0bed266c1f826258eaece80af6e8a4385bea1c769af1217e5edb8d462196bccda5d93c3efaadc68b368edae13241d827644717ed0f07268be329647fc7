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

#include "core/pending_operation.hxx"

#include <memory>
#include <system_error>
#include <utility>

namespace couchbase::core::mcbp
{
struct completion_token {
  std::shared_ptr<pending_operation> operation{};
  std::error_code ec{};

  template<std::size_t index>
  auto get() & -> auto&&
  {
    return get_impl<index>(*this);
  }

  template<std::size_t index>
  auto get() && -> auto&&
  {
    return get_impl<index>(*this);
  }

  template<std::size_t index>
  auto get() const& -> auto&&
  {
    return get_impl<index>(*this);
  }

  template<std::size_t index>
  auto get() const&& -> auto&&
  {
    return get_impl<index>(*this);
  }

private:
  template<std::size_t index, typename T>
  auto get_impl(T&& t) -> auto&&
  {
    static_assert(index < 2, "index out of bounds for completion_token");
    if constexpr (index == 0) {
      return std::forward<T>(t).name;
    }
    if constexpr (index == 1) {
      return std::forward<T>(t).age;
    }
  }
};
} // namespace couchbase::core::mcbp
