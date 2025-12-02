// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_ANY_HPP
#define TAO_PEGTL_INTERNAL_ANY_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "peek_char.hpp"

#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Peek >
   struct any;

   template<>
   struct any< peek_char >
   {
      using peek_t = peek_char;
      using data_t = char;

      using rule_t = any;
      using subs_t = empty_list;

      [[nodiscard]] static bool test( const char /*unused*/ ) noexcept
      {
         return true;
      }

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         if( !in.empty() ) {
            in.bump();
            return true;
         }
         return false;
      }
   };

   template< typename Peek >
   struct any
   {
      using peek_t = Peek;
      using data_t = typename Peek::data_t;

      using rule_t = any;
      using subs_t = empty_list;

      template< int Eol >
      static constexpr bool can_match_eol = true;

      [[nodiscard]] static bool test( const data_t /*unused*/ ) noexcept
      {
         return true;
      }

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( Peek::peek( in ) ) )
      {
         if( const auto t = Peek::peek( in ) ) {
            in.bump( t.size );
            return true;
         }
         return false;
      }
   };

   template< typename Peek >
   inline constexpr bool enable_control< any< Peek > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
