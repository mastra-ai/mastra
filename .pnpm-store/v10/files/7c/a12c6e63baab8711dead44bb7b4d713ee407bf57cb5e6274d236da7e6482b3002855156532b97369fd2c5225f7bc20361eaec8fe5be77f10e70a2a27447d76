//
// detail/fenced_block.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_DETAIL_FENCED_BLOCK_HPP
#define ASIO_DETAIL_FENCED_BLOCK_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"

#if !defined(ASIO_HAS_THREADS) \
  || defined(ASIO_DISABLE_FENCED_BLOCK)
# include "asio/detail/null_fenced_block.hpp"
#else
# include "asio/detail/std_fenced_block.hpp"
#endif

namespace asio {
namespace detail {

#if !defined(ASIO_HAS_THREADS) \
  || defined(ASIO_DISABLE_FENCED_BLOCK)
typedef null_fenced_block fenced_block;
#else
typedef std_fenced_block fenced_block;
#endif

} // namespace detail
} // namespace asio

#endif // ASIO_DETAIL_FENCED_BLOCK_HPP
