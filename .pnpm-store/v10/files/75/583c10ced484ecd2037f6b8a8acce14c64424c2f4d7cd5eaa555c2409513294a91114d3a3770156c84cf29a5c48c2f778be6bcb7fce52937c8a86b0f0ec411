//
// experimental/detail/coro_traits.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2021-2023 Klemens D. Morgenstern
//                         (klemens dot morgenstern at gmx dot net)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_CORO_TRAITS_HPP
#define ASIO_EXPERIMENTAL_DETAIL_CORO_TRAITS_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <optional>
#include <variant>
#include "asio/any_io_executor.hpp"

namespace asio {
namespace experimental {
namespace detail {

template <class From, class To>
concept convertible_to = std::is_convertible_v<From, To>;

template <typename T>
concept decays_to_executor = execution::executor<std::decay_t<T>>;

template <typename T, typename Executor = any_io_executor>
concept execution_context = requires (T& t)
{
  {t.get_executor()} -> convertible_to<Executor>;
};

template <typename Yield, typename Return>
struct coro_result
{
  using type = std::variant<Yield, Return>;
};

template <typename Yield>
struct coro_result<Yield, void>
{
  using type = std::optional<Yield>;
};

template <typename Return>
struct coro_result<void, Return>
{
  using type = Return;
};

template <typename YieldReturn>
struct coro_result<YieldReturn, YieldReturn>
{
  using type = YieldReturn;
};

template <>
struct coro_result<void, void>
{
  using type = void;
};

template <typename Yield, typename Return>
using coro_result_t = typename coro_result<Yield, Return>::type;

template <typename Result, bool IsNoexcept>
struct coro_handler;

template <>
struct coro_handler<void, false>
{
  using type = void(std::exception_ptr);
};

template <>
struct coro_handler<void, true>
{
  using type = void();
};

template <typename T>
struct coro_handler<T, false>
{
  using type = void(std::exception_ptr, T);
};

template <typename T>
struct coro_handler<T, true>
{
  using type = void(T);
};

template <typename Result, bool IsNoexcept>
using coro_handler_t = typename coro_handler<Result, IsNoexcept>::type;

} // namespace detail

#if defined(GENERATING_DOCUMENTATION)

/// The traits describing the resumable coroutine behaviour.
/**
 * Template parameter @c Yield specifies type or signature used by co_yield,
 * @c Return specifies the type used for co_return, and @c Executor specifies
 * the underlying executor type.
 */
template <typename Yield, typename Return, typename Executor>
struct coro_traits
{
  /// The value that can be passed into a symmetrical cororoutine. @c void if
  /// asymmetrical.
  using input_type = argument_dependent;

  /// The type that can be passed out through a co_yield.
  using yield_type = argument_dependent;

  /// The type that can be passed out through a co_return.
  using return_type = argument_dependent;

  /// The type received by a co_await or async_resume. It's a combination of
  /// yield and return.
  using result_type = argument_dependent;

  /// The signature used by the async_resume.
  using signature_type = argument_dependent;

  /// Whether or not the coroutine is noexcept.
  constexpr static bool is_noexcept = argument_dependent;

  /// The error type of the coroutine. @c void for noexcept.
  using error_type = argument_dependent;

  /// Completion handler type used by async_resume.
  using completion_handler = argument_dependent;
};

#else // defined(GENERATING_DOCUMENTATION)

template <typename Yield, typename Return, typename Executor>
struct coro_traits
{
  using input_type  = void;
  using yield_type  = Yield;
  using return_type = Return;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type();
  constexpr static bool is_noexcept = false;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

template <typename T, typename Return, typename Executor>
struct coro_traits<T(), Return, Executor>
{
  using input_type = void;
  using yield_type = T;
  using return_type = Return;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type();
  constexpr static bool is_noexcept = false;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

template <typename T, typename Return, typename Executor>
struct coro_traits<T() noexcept, Return, Executor>
{
  using input_type = void;
  using yield_type = T;
  using return_type = Return;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type();
  constexpr static bool is_noexcept = true;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

template <typename T, typename U, typename Return, typename Executor>
struct coro_traits<T(U), Return, Executor>
{
  using input_type = U;
  using yield_type = T;
  using return_type = Return;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type(input_type);
  constexpr static bool is_noexcept = false;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

template <typename T, typename U, typename Return, typename Executor>
struct coro_traits<T(U) noexcept, Return, Executor>
{
  using input_type = U;
  using yield_type = T;
  using return_type = Return;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type(input_type);
  constexpr static bool is_noexcept = true;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

template <typename Executor>
struct coro_traits<void() noexcept, void, Executor>
{
  using input_type = void;
  using yield_type = void;
  using return_type = void;
  using result_type = detail::coro_result_t<yield_type, return_type>;
  using signature_type = result_type(input_type);
  constexpr static bool is_noexcept = true;
  using error_type = std::conditional_t<is_noexcept, void, std::exception_ptr>;
  using completion_handler = detail::coro_handler_t<result_type, is_noexcept>;
};

#endif // defined(GENERATING_DOCUMENTATION)

} // namespace experimental
} // namespace asio

#endif // ASIO_EXPERIMENTAL_DETAIL_CORO_TRAITS_HPP
