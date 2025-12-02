// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_STRING_HPP
#define TAO_PEGTL_INTERNAL_STRING_HPP

#include <cstring>
#include <utility>

#include "../config.hpp"

#include "bump_help.hpp"
#include "enable_control.hpp"
#include "one.hpp"
#include "result_on_found.hpp"
#include "success.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   [[nodiscard]] inline bool unsafe_equals( const char* s, const std::initializer_list< char >& l ) noexcept
   {
      return std::memcmp( s, &*l.begin(), l.size() ) == 0;
   }

   template< char... Cs >
   struct string;

   template<>
   struct string<>
      : success
   {};

   // template< char C >
   // struct string
   //    : one< C >
   // {};

   template< char... Cs >
   struct string
   {
      using rule_t = string;
      using subs_t = empty_list;

      template< int Eol >
      static constexpr bool can_match_eol = one< result_on_found::success, peek_char, Cs... >::template can_match_eol< Eol >;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.size( 0 ) ) )
      {
         if( in.size( sizeof...( Cs ) ) >= sizeof...( Cs ) ) {
            if( unsafe_equals( in.current(), { Cs... } ) ) {
               bump_help< string >( in, sizeof...( Cs ) );
               return true;
            }
         }
         return false;
      }
   };

   template< char... Cs >
   inline constexpr bool enable_control< string< Cs... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
