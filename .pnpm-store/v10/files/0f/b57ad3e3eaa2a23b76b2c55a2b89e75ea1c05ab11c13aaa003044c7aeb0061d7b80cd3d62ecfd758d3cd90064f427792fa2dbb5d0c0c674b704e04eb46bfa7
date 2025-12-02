// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UTF8_HPP
#define TAO_JSON_UTF8_HPP

#include <tao/pegtl/memory_input.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/utf8.hpp>

namespace tao::json
{
   enum class utf8_mode : bool
   {
      check,
      trust
   };

   namespace internal
   {
      template< typename Input >
      bool consume_utf8_impl( Input& in, const std::size_t todo )
      {
         std::size_t i = 0;
         while( i < todo ) {
            const auto p = pegtl::internal::peek_utf8::peek( in ).size;
            if( ( p == 0 ) || ( ( i += p ) > todo ) ) {
               return false;
            }
            in.bump_in_this_line( p );
         }
         return true;
      }

      template< utf8_mode M, typename Input >
      void consume_utf8_throws( Input& in, const std::size_t todo )
      {
         if constexpr( M == utf8_mode::trust ) {
            in.bump_in_this_line( todo );
         }
         else if( !consume_utf8_impl( in, todo ) ) {
            throw pegtl::parse_error( "invalid utf8", in );
         }
      }

      inline bool validate_utf8_nothrow( const std::string_view sv ) noexcept
      {
         pegtl::memory_input in( sv, "validate_utf8" );
         return consume_utf8_impl( in, sv.size() );
      }

   }  // namespace internal

}  // namespace tao::json

#endif
