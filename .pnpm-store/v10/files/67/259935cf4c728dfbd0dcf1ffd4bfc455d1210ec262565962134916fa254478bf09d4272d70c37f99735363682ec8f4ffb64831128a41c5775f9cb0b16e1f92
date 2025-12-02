// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_ISTRING_HPP
#define TAO_PEGTL_INTERNAL_ISTRING_HPP

#include <type_traits>

#include "../config.hpp"

#include "bump_help.hpp"
#include "enable_control.hpp"
#include "one.hpp"
#include "result_on_found.hpp"
#include "success.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< char C >
   inline constexpr bool is_alpha = ( ( 'a' <= C ) && ( C <= 'z' ) ) || ( ( 'A' <= C ) && ( C <= 'Z' ) );

   template< char C >
   [[nodiscard]] constexpr bool ichar_equal( const char c ) noexcept
   {
      if constexpr( is_alpha< C > ) {
         return ( C | 0x20 ) == ( c | 0x20 );
      }
      else {
         return c == C;
      }
   }

   template< char... Cs >
   [[nodiscard]] constexpr bool istring_equal( const char* r ) noexcept
   {
      return ( ichar_equal< Cs >( *r++ ) && ... );
   }

   template< char... Cs >
   struct istring;

   template<>
   struct istring<>
      : success
   {};

   // template< char C >
   // struct istring< C >
   //    : std::conditional_t< is_alpha< C >, one< result_on_found::success, peek_char, C | 0x20, C & ~0x20 >, one< result_on_found::success, peek_char, C > >
   // {};

   template< char... Cs >
   struct istring
   {
      using rule_t = istring;
      using subs_t = empty_list;

      template< int Eol >
      static constexpr bool can_match_eol = one< result_on_found::success, peek_char, Cs... >::template can_match_eol< Eol >;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.size( 0 ) ) )
      {
         if( in.size( sizeof...( Cs ) ) >= sizeof...( Cs ) ) {
            if( istring_equal< Cs... >( in.current() ) ) {
               bump_help< istring >( in, sizeof...( Cs ) );
               return true;
            }
         }
         return false;
      }
   };

   template< char... Cs >
   inline constexpr bool enable_control< istring< Cs... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
