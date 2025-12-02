//
// detail/utility.hpp
// ~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_UTILITY_HPP
#define ASIO_DETAIL_UTILITY_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <utility>

namespace asio {
namespace detail {

#if defined(ASIO_HAS_STD_INDEX_SEQUENCE)

using std::index_sequence;
using std::index_sequence_for;
using std::make_index_sequence;

#else // defined(ASIO_HAS_STD_INDEX_SEQUENCE)

template <std::size_t...>
struct index_sequence
{
};

template <typename T, typename U>
struct join_index_sequences;

template <std::size_t... I, std::size_t... J>
struct join_index_sequences<index_sequence<I...>, index_sequence<J...>>
{
  using type = index_sequence<I..., J...>;
};

template <std::size_t First, std::size_t Last>
struct index_pack :
  join_index_sequences<
    typename index_pack<First, First + (Last - First + 1) / 2 - 1>::type,
    typename index_pack<First + (Last - First + 1) / 2, Last>::type
  >
{
};

template <std::size_t N>
struct index_pack<N, N>
{
  using type = index_sequence<N>;
};

template <std::size_t Begin, std::size_t End>
struct index_range : index_pack<Begin, End - 1>
{
};

template <std::size_t N>
struct index_range<N, N>
{
  using type = index_sequence<>;
};

template <typename... T>
using index_sequence_for = typename index_range<0, sizeof...(T)>::type;

template <std::size_t N>
using make_index_sequence = typename index_range<0, N>::type;

#endif // defined(ASIO_HAS_STD_INDEX_SEQUENCE)

} // namespace detail
} // namespace asio

#endif // ASIO_DETAIL_UTILITY_HPP
