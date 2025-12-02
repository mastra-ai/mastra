// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_HAS_APPLY0_HPP
#define TAO_PEGTL_INTERNAL_HAS_APPLY0_HPP

#include <utility>

#include "../config.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename, typename, template< typename... > class, typename... >
   inline constexpr bool has_apply0 = false;

   template< typename C, template< typename... > class Action, typename... S >
   inline constexpr bool has_apply0< C, decltype( C::template apply0< Action >( std::declval< S >()... ) ), Action, S... > = true;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
