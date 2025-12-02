//
// is_applicable_property.hpp
// ~~~~~~~~~~~~~~~~~~~~~~~~~~
//
// Copyright (c) 2003-2025 Christopher M. Kohlhoff (chris at kohlhoff dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//

#ifndef ASIO_IS_APPLICABLE_PROPERTY_HPP
#define ASIO_IS_APPLICABLE_PROPERTY_HPP

#if defined(_MSC_VER) && (_MSC_VER >= 1200)
# pragma once
#endif // defined(_MSC_VER) && (_MSC_VER >= 1200)

#include "asio/detail/config.hpp"
#include "asio/detail/type_traits.hpp"

namespace asio {
namespace detail {

template <typename T, typename Property, typename = void>
struct is_applicable_property_trait : false_type
{
};

#if defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename Property>
struct is_applicable_property_trait<T, Property,
  void_t<
    enable_if_t<
      !!Property::template is_applicable_property_v<T>
    >
  >> : true_type
{
};

#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

} // namespace detail

template <typename T, typename Property, typename = void>
struct is_applicable_property :
  detail::is_applicable_property_trait<T, Property>
{
};

#if defined(ASIO_HAS_VARIABLE_TEMPLATES)

template <typename T, typename Property>
constexpr const bool is_applicable_property_v
  = is_applicable_property<T, Property>::value;

#endif // defined(ASIO_HAS_VARIABLE_TEMPLATES)

} // namespace asio

#endif // ASIO_IS_APPLICABLE_PROPERTY_HPP
