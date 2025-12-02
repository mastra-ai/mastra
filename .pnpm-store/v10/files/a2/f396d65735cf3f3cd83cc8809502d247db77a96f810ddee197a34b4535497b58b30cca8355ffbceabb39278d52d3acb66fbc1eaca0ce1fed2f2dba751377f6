/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *   Copyright 2022 Couchbase, Inc.
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

#include <functional>
#include <memory>

/* replace with standard version once http://wg21.link/P0288 will be accepted and implemented */
namespace couchbase::core::utils
{
template<typename Signature>
class movable_function : public std::function<Signature>
{
  template<typename Functor, typename En = void>
  struct wrapper;

  template<typename Functor>
  struct wrapper<Functor, std::enable_if_t<std::is_copy_constructible_v<Functor>>> {
    Functor fn;

    template<typename... Args>
    auto operator()(Args&&... args)
    {
      return fn(std::forward<Args>(args)...);
    }
  };

  template<typename Functor>
  struct copy_wrapper {
    Functor fn;

    explicit copy_wrapper(Functor&& f)
      : fn(std::move(f))
    {
    }
  };

  template<typename Functor>
  struct wrapper<Functor,
                 std::enable_if_t<!std::is_copy_constructible_v<Functor> &&
                                  std::is_move_constructible_v<Functor>>> {
    std::shared_ptr<copy_wrapper<Functor>> fnPtr;

    explicit wrapper(Functor&& f)
      : fnPtr(new copy_wrapper<Functor>(std::move(f)))
    {
    }

    wrapper(wrapper&& /* other */) noexcept = default;
    auto operator=(wrapper&& /* other */) noexcept -> wrapper& = default;

    wrapper(const wrapper& other) = default;
    auto operator=(const wrapper& /* other */) -> wrapper& = default;

    template<typename... Args>
    auto operator()(Args&&... args)
    {
      return std::move(fnPtr->fn)(std::forward<Args>(args)...);
    }
  };

  using base = std::function<Signature>;

public:
  movable_function() noexcept = default;
  movable_function(std::nullptr_t) noexcept
    : base(nullptr)
  {
  }

  template<typename Functor>
  movable_function(Functor&& f)
    : base(wrapper<Functor>{ std::forward<Functor>(f) })
  {
  }

  movable_function(movable_function&& other) noexcept
    : base(std::move(static_cast<base&&>(other)))
  {
    other = nullptr;
  }

  auto operator=(movable_function&& other) noexcept -> movable_function&
  {
    base::operator=(std::move(static_cast<base&&>(other)));
    other = nullptr;
    return *this;
  }

  auto operator=(std::nullptr_t /* other */) -> movable_function&
  {
    base::operator=(nullptr);
    return *this;
  }

  template<typename Functor>
  auto operator=(Functor&& f) -> movable_function&
  {
    base::operator=(wrapper<Functor>{ std::forward<Functor>(f) });
    return *this;
  }

  using base::operator bool;
  using base::operator();
};

} // namespace couchbase::core::utils
