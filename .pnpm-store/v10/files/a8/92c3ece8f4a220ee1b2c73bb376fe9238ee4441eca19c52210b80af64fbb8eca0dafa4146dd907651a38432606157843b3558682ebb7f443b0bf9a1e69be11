// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_VECTOR_BOOL_TRAITS_HPP
#define TAO_JSON_CONTRIB_VECTOR_BOOL_TRAITS_HPP

#include <vector>

#include "../consume.hpp"
#include "../forward.hpp"

#include "vector_traits.hpp"

namespace tao::json
{
   struct vector_bool_traits
      : vector_traits< bool >
   {
      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const std::vector< bool >& o )
      {
         v.emplace_array();
         v.get_array().reserve( o.size() );
         for( const auto e : o ) {
            v.emplace_back( static_cast< bool >( e ) );
         }
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const std::vector< bool >& o )
      {
         c.begin_array( o.size() );
         for( const auto i : o ) {
            json::events::produce< Traits >( c, static_cast< bool >( i ) );
            c.element();
         }
         c.end_array( o.size() );
      }

      // TODO: Check whether anything else needs "special-casing".
   };

}  // namespace tao::json

#endif
