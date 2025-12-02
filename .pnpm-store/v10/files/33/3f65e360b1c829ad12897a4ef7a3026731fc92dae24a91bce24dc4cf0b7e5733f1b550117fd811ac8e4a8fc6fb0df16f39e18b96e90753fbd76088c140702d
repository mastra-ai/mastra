// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_INTERNAL_ELEMENTR_HPP
#define TAO_JSON_BINDING_INTERNAL_ELEMENTR_HPP

#include <type_traits>

#include "../../forward.hpp"

#include "../../events/produce.hpp"

namespace tao::json::binding::internal
{
   template< typename T, T, typename = void >
   struct elementr;

#if defined( __GNUC__ ) || defined( __clang__ )

   template< bool N, typename C, typename T, T ( *P )( const C& ) noexcept( N ) >
   struct elementr< T ( * )( const C& ) noexcept( N ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( N )
      {
         return P( v );
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, P( v ) );
      }
   };

   template< bool N, typename C, typename T, T ( C::*P )() const noexcept( N ) >
   struct elementr< T ( C::* )() const noexcept( N ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( N )
      {
         return ( v.*P )();
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, ( v.*P )() );
      }
   };

#else  // TODO: Check MSVC occasionally. Others?

   template< typename C, typename T, T ( *P )( const C& ) noexcept( true ) >
   struct elementr< T ( * )( const C& ) noexcept( true ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( true )
      {
         return P( v );
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, P( v ) );
      }
   };

   template< typename C, typename T, T ( *P )( const C& ) noexcept( false ) >
   struct elementr< T ( * )( const C& ) noexcept( false ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( false )
      {
         return P( v );
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, P( v ) );
      }
   };

   template< typename C, typename T, T ( C::*P )() const noexcept( true ) >
   struct elementr< T ( C::* )() const noexcept( true ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( true )
      {
         return ( v.*P )();
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, ( v.*P )() );
      }
   };

   template< typename C, typename T, T ( C::*P )() const noexcept( false ) >
   struct elementr< T ( C::* )() const noexcept( false ), P >
   {
      using read_class_t = C;
      using read_value_t = std::decay_t< T >;

      [[nodiscard]] static decltype( auto ) read( const C& v ) noexcept( false )
      {
         return ( v.*P )();
      }

      template< template< typename... > class Traits = traits, typename Consumer >
      static void produce( Consumer& consumer, const C& v )
      {
         events::produce< Traits >( consumer, ( v.*P )() );
      }
   };

#endif

}  // namespace tao::json::binding::internal

#endif
