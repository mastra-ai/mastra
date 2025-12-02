// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_INTERNAL_ARRAY_TRAITS_HPP
#define TAO_JSON_CONTRIB_INTERNAL_ARRAY_TRAITS_HPP

#include <algorithm>

#include "../../forward.hpp"
#include "../../type.hpp"

#include "../../events/produce.hpp"

namespace tao::json::internal
{
   template< typename T >
   struct array_multi_traits
   {
      template< template< typename... > class Traits >
      [[nodiscard]] static bool is_nothing( const T& o )
      {
         return o.empty();
      }

      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T& o ) = delete;

      template< template< typename... > class Traits, typename Consumer >
      static void produce( Consumer& c, const T& o )
      {
         c.begin_array( o.size() );
         for( const auto& i : o ) {
            json::events::produce< Traits >( c, i );
            c.element();
         }
         c.end_array( o.size() );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool equal( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         if( !p.is_array() ) {
            return false;
         }
         const auto& a = p.get_array();
         return ( a.size() == rhs.size() ) && std::equal( rhs.begin(), rhs.end(), a.begin() );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool less_than( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         const auto t = p.type();
         if( t != type::ARRAY ) {
            return t < type::ARRAY;
         }
         const auto& a = p.get_array();
         return std::lexicographical_compare( a.begin(), a.end(), rhs.begin(), rhs.end() );
      }

      template< template< typename... > class Traits >
      [[nodiscard]] static bool greater_than( const basic_value< Traits >& lhs, const T& rhs ) noexcept
      {
         const auto& p = lhs.skip_value_ptr();
         const auto t = p.type();
         if( t != type::ARRAY ) {
            return t > type::ARRAY;
         }
         const auto& a = p.get_array();
         return std::lexicographical_compare( rhs.begin(), rhs.end(), a.begin(), a.end() );
      }
   };

   template< typename T >
   struct array_traits
      : array_multi_traits< T >
   {
      template< template< typename... > class Traits >
      static void assign( basic_value< Traits >& v, const T& o )
      {
         v.emplace_array();
         v.get_array().reserve( o.size() );
         for( const auto& e : o ) {
            v.emplace_back( e );
         }
      }
   };

}  // namespace tao::json::internal

#endif
