// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_MAP_TRAITS_HPP
#define TAO_JSON_CONTRIB_MAP_TRAITS_HPP

#include <map>
#include <string>

#include "../consume.hpp"
#include "../forward.hpp"

#include "internal/object_traits.hpp"

namespace tao::json
{
   template< typename T, typename... Ts >
   struct map_traits
      : internal::object_traits< std::map< std::string, T, Ts... > >
   {
      template< template< typename... > class Traits, typename... With >
      static void to( const basic_value< Traits >& v, std::map< std::string, T, Ts... >& r, With&... with )
      {
         const auto& o = v.get_object();
         for( const auto& i : o ) {
            r.try_emplace( i.first, i.second.template as_with< T >( with... ) );
         }
      }

      template< template< typename... > class Traits, typename Producer >
      static void consume( Producer& parser, std::map< std::string, T, Ts... >& v )
      {
         auto s = parser.begin_object();
         while( parser.member_or_end_object( s ) ) {
            auto k = parser.key();
            v.try_emplace( std::move( k ), json::consume< T, Traits >( parser ) );
         }
      }
   };

}  // namespace tao::json

#endif
