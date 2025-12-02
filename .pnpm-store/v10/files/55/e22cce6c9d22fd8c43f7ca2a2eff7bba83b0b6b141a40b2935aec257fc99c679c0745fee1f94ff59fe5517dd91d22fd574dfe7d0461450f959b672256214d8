//
// detail/type_traits.hpp
// ~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_TYPE_TRAITS_HPP
#define ASIO_DETAIL_TYPE_TRAITS_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <type_traits>

namespace asio {

using std::add_const;

template <typename T>
using add_const_t = typename std::add_const<T>::type;

using std::add_lvalue_reference;

template <typename T>
using add_lvalue_reference_t = typename std::add_lvalue_reference<T>::type;

template <std::size_t N, std::size_t A>
struct aligned_storage
{
  struct type
  {
    alignas(A) unsigned char data[N];
  };
};

template <std::size_t N, std::size_t A>
using aligned_storage_t = typename aligned_storage<N, A>::type;

using std::alignment_of;

using std::conditional;

template <bool C, typename T, typename U>
using conditional_t = typename std::conditional<C, T, U>::type;

using std::decay;

template <typename T>
using decay_t = typename std::decay<T>::type;

using std::declval;

using std::enable_if;

template <bool C, typename T = void>
using enable_if_t = typename std::enable_if<C, T>::type;

using std::false_type;

using std::integral_constant;

using std::is_base_of;

using std::is_class;

using std::is_const;

using std::is_constructible;

using std::is_convertible;

using std::is_copy_constructible;

using std::is_nothrow_default_constructible;

using std::is_destructible;

using std::is_function;

using std::is_integral;

using std::is_move_constructible;

using std::is_nothrow_copy_constructible;

using std::is_nothrow_copy_assignable;

using std::is_nothrow_destructible;

using std::is_nothrow_move_constructible;

using std::is_nothrow_move_assignable;

using std::is_object;

using std::is_pointer;

using std::is_reference;

using std::is_same;

using std::is_scalar;

using std::is_unsigned;

using std::remove_cv;

template <typename T>
using remove_cv_t = typename std::remove_cv<T>::type;

template <typename T>
struct remove_cvref :
  std::remove_cv<typename std::remove_reference<T>::type> {};

template <typename T>
using remove_cvref_t = typename remove_cvref<T>::type;

using std::remove_pointer;

template <typename T>
using remove_pointer_t = typename std::remove_pointer<T>::type;

using std::remove_reference;

template <typename T>
using remove_reference_t = typename std::remove_reference<T>::type;

#if defined(ASIO_HAS_STD_INVOKE_RESULT)

template <typename> struct result_of;

template <typename F, typename... Args>
struct result_of<F(Args...)> : std::invoke_result<F, Args...> {};

template <typename T>
using result_of_t = typename result_of<T>::type;

#else // defined(ASIO_HAS_STD_INVOKE_RESULT)

using std::result_of;

template <typename T>
using result_of_t = typename std::result_of<T>::type;

#endif // defined(ASIO_HAS_STD_INVOKE_RESULT)

using std::true_type;

template <typename> struct void_type
{
  typedef void type;
};

template <typename T>
using void_t = typename void_type<T>::type;

template <typename...> struct conjunction : true_type {};

template <typename T> struct conjunction<T> : T {};

template <typename Head, typename... Tail>
struct conjunction<Head, Tail...> :
  conditional_t<Head::value, conjunction<Tail...>, Head> {};

struct defaulted_constraint
{
  constexpr defaulted_constraint() {}
};

template <bool Condition, typename Type = int>
struct constraint : std::enable_if<Condition, Type> {};

template <bool Condition, typename Type = int>
using constraint_t = typename constraint<Condition, Type>::type;

template <typename T>
struct type_identity { typedef T type; };

template <typename T>
using type_identity_t = typename type_identity<T>::type;

} // namespace asio

#endif // ASIO_DETAIL_TYPE_TRAITS_HPP
