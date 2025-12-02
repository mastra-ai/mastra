// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_INTERNAL_INDIRECT_TRAITS_HPP
#define TAO_JSON_CONTRIB_INTERNAL_INDIRECT_TRAITS_HPP

#include <cassert>

#include "../../forward.hpp"
#include "../../type.hpp"

#include "../../events/produce.hpp"

#include "../../internal/type_traits.hpp"

namespace tao::json::internal
{
   template< typename T >
   struct indirect_traits
   {
      template< typename U >
      [[nodiscard]] static const U& add_const( const U& u )
      {
         return u;
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool is_nothing( const T& o )
      {
         return bool( o ) && internal::is_nothing< Traits >( add_const( *o ) );
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T& o )
      {
         if( o ) {
            v = add_const( *o );
         }
         else {
            v = null;
         }
      }

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const T& o )
      {
         if( o ) {
            json::events::produce< Traits >( c, add_const( *o ) );
         }
         else {
            c.null();
         }
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         return rhs ? ( lhs == *rhs ) : ( lhs == null );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         return rhs ? ( lhs < *rhs ) : ( lhs < null );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         return rhs ? ( lhs > *rhs ) : ( lhs > null );
      }
   };

}  // namespace tao::json::internal

#endif
