// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_PAIR_HPP
#define TAO_JSON_INTERNAL_PAIR_HPP

#include <string>
#include <type_traits>
#include <utility>

#include "../forward.hpp"

namespace tao::json::internal
{
   template< template< typename... > class Traits >
   struct pair
   {
      mutable std::string key;
      mutable basic_value< Traits > value;

      template< typename U >
      pair( U&& v )  // NOLINT(bugprone-forwarding-reference-overload)
         : key( Traits< std::decay_t< U > >::template default_key< Traits >::as_string() ),
           value( std::forward< U >( v ) )
      {}

      template< typename U >
      pair( U&& k, basic_value< Traits >&& v )
         : key( std::forward< U >( k ) ),
           value( std::move( v ) )
      {}

      template< typename U >
      pair( U&& k, const basic_value< Traits >& v )
         : key( std::forward< U >( k ) ),
           value( v )
      {}
   };

}  // namespace tao::json::internal

#endif
