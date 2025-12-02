//
// experimental/detail/has_signature.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_EXPERIMENTAL_DETAIL_HAS_SIGNATURE_HPP
#define ASIO_EXPERIMENTAL_DETAIL_HAS_SIGNATURE_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {
namespace experimental {
namespace detail {

template <typename S, typename... Signatures>
struct has_signature;

template <typename S, typename... Signatures>
struct has_signature;

template <typename S>
struct has_signature<S> : false_type
{
};

template <typename S, typename... Signatures>
struct has_signature<S, S, Signatures...> : true_type
{
};

template <typename S, typename Head, typename... Tail>
struct has_signature<S, Head, Tail...> : has_signature<S, Tail...>
{
};

} // namespace detail
} // namespace experimental
} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_EXPERIMENTAL_DETAIL_HAS_SIGNATURE_HPP
