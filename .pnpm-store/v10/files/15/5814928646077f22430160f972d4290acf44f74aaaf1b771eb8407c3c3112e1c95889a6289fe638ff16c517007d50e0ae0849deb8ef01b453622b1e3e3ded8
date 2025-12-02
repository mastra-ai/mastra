// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_ONE_HPP
#define TAO_PEGTL_INTERNAL_ONE_HPP

#include <cstddef>

#include "../config.hpp"

#include "any.hpp"
#include "bump_help.hpp"
#include "enable_control.hpp"
#include "failure.hpp"
#include "result_on_found.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< result_on_found R, typename Peek, typename Peek::data_t... Cs >
   struct one
   {
      using peek_t = Peek;
      using data_t = typename Peek::data_t;

      using rule_t = one;
      using subs_t = empty_list;

      [[nodiscard]] static constexpr bool test( const data_t c ) noexcept
      {
         return ( ( c == Cs ) || ... ) == bool( R );
      }

      template< int Eol >
      static constexpr bool can_match_eol = test( Eol );

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( Peek::peek( in ) ) )
      {
         if( const auto t = Peek::peek( in ) ) {
            if( test( t.data ) ) {
               bump_help< one >( in, t.size );
               return true;
            }
         }
         return false;
      }
   };

   template< typename Peek >
   struct one< result_on_found::success, Peek >
      : failure
   {};

   template< typename Peek >
   struct one< result_on_found::failure, Peek >
      : any< Peek >
   {};

   template< result_on_found R, typename Peek, typename Peek::data_t... Cs >
   inline constexpr bool enable_control< one< R, Peek, Cs... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
