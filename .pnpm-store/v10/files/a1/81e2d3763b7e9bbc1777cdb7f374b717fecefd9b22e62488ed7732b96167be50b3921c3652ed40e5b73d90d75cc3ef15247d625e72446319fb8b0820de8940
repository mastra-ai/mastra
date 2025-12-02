// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_PARSE_UTIL_HPP
#define TAO_JSON_INTERNAL_PARSE_UTIL_HPP

#include <cassert>

#include <tao/pegtl/parse_error.hpp>

#include "../utf8.hpp"

#include "endian.hpp"
#include "format.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json::internal
{
   template< typename Input >
   void throw_on_empty( Input& in )
   {
      if( in.empty() ) {
         throw pegtl::parse_error( format( "unexpected end of input" ), in );
      }
   }

   template< typename Input >
   void throw_on_empty( Input& in, const std::size_t required )
   {
      const auto available = in.size( required );
      if( available < required ) {
         throw pegtl::parse_error( format( "unexpected end of input -- required ", required, " available ", available ), in );
      }
   }

   template< typename Input >
   [[nodiscard]] std::uint8_t peek_uint8( Input& in )
   {
      throw_on_empty( in );
      return in.peek_uint8();
   }

   template< typename Input >
   [[nodiscard]] char peek_char( Input& in )
   {
      throw_on_empty( in );
      return in.peek_char();
   }

   template< typename Input >
   [[nodiscard]] char read_char_unsafe( Input& in )
   {
      const auto r = in.peek_char();
      in.bump_in_this_line( 1 );
      return r;
   }

   template< typename Input >
   [[nodiscard]] char read_char( Input& in )
   {
      throw_on_empty( in );
      return read_char_unsafe( in );
   }

   template< utf8_mode U, typename Result, typename Input >
   [[nodiscard]] Result read_string( Input& in, const std::size_t size )
   {
      using value_t = typename Result::value_type;
      json::internal::throw_on_empty( in, size );
      const auto* pointer = reinterpret_cast< const value_t* >( in.current() );
      const Result result( pointer, size );
      json::internal::consume_utf8_throws< U >( in, size );
      return result;
   }

   template< typename Result, typename Number = Result, typename Input >
   [[nodiscard]] Result read_big_endian_number( Input& in, const std::size_t extra = 0 )
   {
      throw_on_empty( in, extra + sizeof( Number ) );
      const auto result = static_cast< Result >( be_to_h< Number >( in.current() + extra ) );
      in.bump_in_this_line( extra + sizeof( Number ) );
      return result;
   }

   template< typename Integer >
   [[nodiscard]] Integer hex_char_to_integer( const char c ) noexcept
   {
      if( ( '0' <= c ) && ( c <= '9' ) ) {
         return static_cast< Integer >( c - '0' );
      }
      if( ( 'a' <= c ) && ( c <= 'f' ) ) {
         return static_cast< Integer >( c - 'a' + 10 );
      }
      if( ( 'A' <= c ) && ( c <= 'F' ) ) {
         return static_cast< Integer >( c - 'A' + 10 );
      }
      // LCOV_EXCL_START
      assert( false );
      return 0;
      // LCOV_EXCL_STOP
   }

}  // namespace tao::json::internal

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
