// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_MULTISET_TRAITS_HPP
#define TAO_JSON_CONTRIB_MULTISET_TRAITS_HPP

#include <set>

#include "../consume.hpp"
#include "../forward.hpp"

#include "internal/array_traits.hpp"

namespace tao::json
{
   template< typename T, typename... Ts >
   struct multiset_traits
      : internal::array_traits< std::multiset< T, Ts... > >
   {
      template< template< typename... > class Traits, typename... With >
      static void to( const basic_value< Traits >& v, std::multiset< T, Ts... >& r, With&... with )
      {
         const auto& a = v.get_array();
         for( const auto& i : a ) {
            r.emplace( i.template as_with< T >( with... ) );
         }
      }

      template< template< typename... > class Traits, typename Producer >
      static void consume( Producer& parser, std::multiset< T, Ts... >& r )
      {
         auto s = parser.begin_array();
         while( parser.element_or_end_array( s ) ) {
            r.emplace( json::consume< T, Traits >( parser ) );
         }
      }
   };

}  // namespace tao::json

#endif
