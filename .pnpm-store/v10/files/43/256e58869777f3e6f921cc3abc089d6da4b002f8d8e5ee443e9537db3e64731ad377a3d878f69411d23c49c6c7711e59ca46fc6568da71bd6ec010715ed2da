//
// detail/composed_work.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_COMPOSED_WORK_HPP
#define ASIO_DETAIL_COMPOSED_WORK_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"
#include "asio/execution/executor.hpp"
#include "asio/execution/outstanding_work.hpp"
#include "asio/executor_work_guard.hpp"
#include "asio/is_executor.hpp"
#include "asio/system_executor.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace detail {

template <typename Executor, typename = void>
class composed_work_guard
{
public:
  typedef decay_t<
      prefer_result_t<Executor, execution::outstanding_work_t::tracked_t>
    > executor_type;

  composed_work_guard(const Executor& ex)
    : executor_(asio::prefer(ex, execution::outstanding_work.tracked))
  {
  }

  void reset()
  {
  }

  executor_type get_executor() const noexcept
  {
    return executor_;
  }

private:
  executor_type executor_;
};

template <>
struct composed_work_guard<system_executor>
{
public:
  typedef system_executor executor_type;

  composed_work_guard(const system_executor&)
  {
  }

  void reset()
  {
  }

  executor_type get_executor() const noexcept
  {
    return system_executor();
  }
};

#if !defined(ASIO_NO_TS_EXECUTORS)

template <typename Executor>
struct composed_work_guard<Executor,
    enable_if_t<
      !execution::is_executor<Executor>::value
    >
  > : executor_work_guard<Executor>
{
  composed_work_guard(const Executor& ex)
    : executor_work_guard<Executor>(ex)
  {
  }
};

#endif // !defined(ASIO_NO_TS_EXECUTORS)

template <typename>
struct composed_io_executors;

template <>
struct composed_io_executors<void()>
{
  composed_io_executors() noexcept
    : head_(system_executor())
  {
  }

  typedef system_executor head_type;
  system_executor head_;
};

inline composed_io_executors<void()> make_composed_io_executors()
{
  return composed_io_executors<void()>();
}

template <typename Head>
struct composed_io_executors<void(Head)>
{
  explicit composed_io_executors(const Head& ex) noexcept
    : head_(ex)
  {
  }

  typedef Head head_type;
  Head head_;
};

template <typename Head>
inline composed_io_executors<void(Head)>
make_composed_io_executors(const Head& head)
{
  return composed_io_executors<void(Head)>(head);
}

template <typename Head, typename... Tail>
struct composed_io_executors<void(Head, Tail...)>
{
  explicit composed_io_executors(const Head& head,
      const Tail&... tail) noexcept
    : head_(head),
      tail_(tail...)
  {
  }

  void reset()
  {
    head_.reset();
    tail_.reset();
  }

  typedef Head head_type;
  Head head_;
  composed_io_executors<void(Tail...)> tail_;
};

template <typename Head, typename... Tail>
inline composed_io_executors<void(Head, Tail...)>
make_composed_io_executors(const Head& head, const Tail&... tail)
{
  return composed_io_executors<void(Head, Tail...)>(head, tail...);
}

template <typename>
struct composed_work;

template <>
struct composed_work<void()>
{
  typedef composed_io_executors<void()> executors_type;

  composed_work(const executors_type&) noexcept
    : head_(system_executor())
  {
  }

  void reset()
  {
    head_.reset();
  }

  typedef system_executor head_type;
  composed_work_guard<system_executor> head_;
};

template <typename Head>
struct composed_work<void(Head)>
{
  typedef composed_io_executors<void(Head)> executors_type;

  explicit composed_work(const executors_type& ex) noexcept
    : head_(ex.head_)
  {
  }

  void reset()
  {
    head_.reset();
  }

  typedef Head head_type;
  composed_work_guard<Head> head_;
};

template <typename Head, typename... Tail>
struct composed_work<void(Head, Tail...)>
{
  typedef composed_io_executors<void(Head, Tail...)> executors_type;

  explicit composed_work(const executors_type& ex) noexcept
    : head_(ex.head_),
      tail_(ex.tail_)
  {
  }

  void reset()
  {
    head_.reset();
    tail_.reset();
  }

  typedef Head head_type;
  composed_work_guard<Head> head_;
  composed_work<void(Tail...)> tail_;
};

template <typename IoObject>
inline typename IoObject::executor_type
get_composed_io_executor(IoObject& io_object,
    enable_if_t<
      !is_executor<IoObject>::value
    >* = 0,
    enable_if_t<
      !execution::is_executor<IoObject>::value
    >* = 0)
{
  return io_object.get_executor();
}

template <typename Executor>
inline const Executor& get_composed_io_executor(const Executor& ex,
    enable_if_t<
      is_executor<Executor>::value
        || execution::is_executor<Executor>::value
    >* = 0)
{
  return ex;
}

} // namespace detail
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_DETAIL_COMPOSED_WORK_HPP
