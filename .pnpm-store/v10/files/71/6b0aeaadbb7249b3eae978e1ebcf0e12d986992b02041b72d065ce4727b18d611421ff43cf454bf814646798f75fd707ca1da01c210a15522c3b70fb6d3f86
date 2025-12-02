//
// is_contiguous_iterator.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IS_CONTIGUOUS_ITERATOR_HPP
#define ASIO_IS_CONTIGUOUS_ITERATOR_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include <iterator>
#include "asio/detail/type_traits.hpp"

#include "asio/detail/push_options.hpp"

namespace asio {

/// The is_contiguous_iterator class is a traits class that may be used to
/// determine whether a type is a contiguous iterator.
template <typename T>
struct is_contiguous_iterator :
#if defined(ASIO_HAS_STD_CONCEPTS) \
  || defined(GENERATING_DOCUMENTATION)
  integral_constant<bool, std::contiguous_iterator<T>>
#else // defined(ASIO_HAS_STD_CONCEPTS)
      //   || defined(GENERATING_DOCUMENTATION)
  is_pointer<T>
#endif // defined(ASIO_HAS_STD_CONCEPTS)
       //   || defined(GENERATING_DOCUMENTATION)
{
};

} // namespace asio

#include "asio/detail/pop_options.hpp"

#endif // ASIO_IS_CONTIGUOUS_ITERATOR_HPP
