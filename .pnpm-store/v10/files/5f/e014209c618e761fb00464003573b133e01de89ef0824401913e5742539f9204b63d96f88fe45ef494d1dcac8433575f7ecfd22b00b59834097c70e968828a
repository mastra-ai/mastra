// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTERNAL_PEEK_UTF32_HPP
#define TAO_PEGTL_CONTRIB_INTERNAL_PEEK_UTF32_HPP

#include <cstddef>

#include "../../config.hpp"
#include "../../internal/input_pair.hpp"

#include "read_uint.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename R >
   struct peek_utf32_impl
   {
      using data_t = char32_t;
      using pair_t = input_pair< char32_t >;

      static_assert( sizeof( char32_t ) == 4 );

      template< typename ParseInput >
      [[nodiscard]] static pair_t peek( ParseInput& in ) noexcept( noexcept( in.size( 4 ) ) )
      {
         if( in.size( 4 ) < 4 ) {
            return { 0, 0 };
         }
         const char32_t t = R::read( in.current() );
         if( ( t <= 0x10ffff ) && !( t >= 0xd800 && t <= 0xdfff ) ) {
            return { t, 4 };
         }
         return { 0, 0 };
      }
   };

   using peek_utf32_be = peek_utf32_impl< read_uint32_be >;
   using peek_utf32_le = peek_utf32_impl< read_uint32_le >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
