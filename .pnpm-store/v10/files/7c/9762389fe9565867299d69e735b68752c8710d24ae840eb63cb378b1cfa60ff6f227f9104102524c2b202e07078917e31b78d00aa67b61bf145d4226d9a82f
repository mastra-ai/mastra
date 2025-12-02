// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_DEQUE_TRAITS_HPP
#define TAO_JSON_CONTRIB_DEQUE_TRAITS_HPP

#include <deque>
#include <vector>

#include "../consume.hpp"
#include "../forward.hpp"

#include "internal/array_traits.hpp"

namespace tao::json
{
   template< typename T, typename... Ts >
   struct deque_traits
      : internal::array_traits< std::deque< T, Ts... > >
   {
      template< template< typename... > class Traits, typename... With >
      static void to( const basic_value< Traits >& v, std::deque< T, Ts... >& r, With&... with )
      {
         const auto& a = v.get_array();
         for( const auto& i : a ) {
            r.emplace_back( i.template as_with< T >( with... ) );
         }
      }

      template< template< typename... > class Traits, typename Producer >
      static void consume( Producer& parser, std::vector< T, Ts... >& v )
      {
         auto s = parser.begin_array();
         while( parser.element_or_end_array( s ) ) {
            v.emplace_back( json::consume< T, Traits >( parser ) );
         }
      }
   };

}  // namespace tao::json

#endif
