// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_SINGLE_HPP
#define TAO_JSON_INTERNAL_SINGLE_HPP

#include <utility>

#include "../forward.hpp"

#include "pair.hpp"

namespace tao::json::internal
{
   template< template< typename... > class Traits >
   struct single
   {
      mutable basic_value< Traits > value;

      template< typename U >
      single( U&& v )  // NOLINT(bugprone-forwarding-reference-overload)
         : value( std::forward< U >( v ) )
      {}

      single( std::initializer_list< pair< Traits > >&& l )
         : value( std::move( l ) )
      {}

      single( const std::initializer_list< pair< Traits > >& l )
         : value( l )
      {}

      single( std::initializer_list< pair< Traits > >& l )
         : value( l )
      {}
   };

}  // namespace tao::json::internal

#endif
