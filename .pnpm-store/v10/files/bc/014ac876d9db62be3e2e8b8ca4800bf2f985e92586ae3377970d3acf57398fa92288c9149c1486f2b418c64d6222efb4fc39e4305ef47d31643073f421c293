// Copyright (c) 2016-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_CR_CRLF_EOL_HPP
#define TAO_PEGTL_INTERNAL_CR_CRLF_EOL_HPP

#include "../config.hpp"
#include "../eol_pair.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct cr_crlf_eol
   {
      static constexpr int ch = '\r';

      template< typename ParseInput >
      [[nodiscard]] static eol_pair match( ParseInput& in ) noexcept( noexcept( in.size( 2 ) ) )
      {
         eol_pair p = { false, in.size( 2 ) };
         if( p.second ) {
            if( in.peek_char() == '\r' ) {
               in.bump_to_next_line( 1 + ( ( p.second > 1 ) && ( in.peek_char( 1 ) == '\n' ) ) );
               p.first = true;
            }
         }
         return p;
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
