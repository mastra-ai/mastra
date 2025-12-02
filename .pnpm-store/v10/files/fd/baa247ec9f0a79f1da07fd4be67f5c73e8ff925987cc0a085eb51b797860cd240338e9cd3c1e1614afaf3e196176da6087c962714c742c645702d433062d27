// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_INTERNAL_GRAMMAR_HPP
#define TAO_JSON_CBOR_INTERNAL_GRAMMAR_HPP

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>

#include <tao/pegtl/apply_mode.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rewind_mode.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/type_list.hpp>

#include "major.hpp"

#include "../../binary_view.hpp"
#include "../../forward.hpp"
#include "../../internal/endian.hpp"
#include "../../internal/format.hpp"
#include "../../internal/parse_util.hpp"
#include "../../utf8.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json::cbor::internal
{
   template< typename Input >
   void consume_or_throw( Input& in, const std::size_t size = 1 )
   {
      json::internal::throw_on_empty( in, size );
      in.bump_in_this_line( size );
   }

   template< typename Input >
   [[nodiscard]] major peek_major_unsafe( Input& in )
   {
      return static_cast< major >( in.peek_uint8() & major_mask );
   }

   template< typename Input >
   [[nodiscard]] std::uint8_t peek_minor_unsafe( Input& in )
   {
      return in.peek_uint8() & minor_mask;
   }

   template< typename Input >
   [[nodiscard]] major peek_major( Input& in )
   {
      return static_cast< major >( json::internal::peek_uint8( in ) & major_mask );
   }

   // Assume in.size( 1 ) >= 1 and in.peek_uint8() is the byte with major/minor.

   template< typename Input >
   [[nodiscard]] double read_fp16( Input& in )
   {
      json::internal::throw_on_empty( in, 3 );

      const int half = ( in.peek_uint8( 1 ) << 8 ) + in.peek_uint8( 2 );
      const int exp = ( half >> 10 ) & 0x1f;
      const int mant = half & 0x3ff;

      double val;
      if( exp == 0 ) {
         val = std::ldexp( mant, -24 );
      }
      else if( exp != 31 ) {
         val = std::ldexp( mant + 1024, exp - 25 );
      }
      else {
         val = ( mant == 0 ) ? INFINITY : NAN;
      }
      in.bump_in_this_line( 3 );
      return half & 0x8000 ? -val : val;
   }

   template< typename Input >
   [[nodiscard]] std::uint64_t read_embedded_unsafe( Input& in )
   {
      const auto result = peek_minor_unsafe( in ) & minor_mask;
      in.bump_in_this_line();
      return result;
   }

   template< typename Input >
   [[nodiscard]] std::uint64_t read_unsigned_unsafe( Input& in )
   {
      switch( const auto m = peek_minor_unsafe( in ) ) {
         default:
            return read_embedded_unsafe( in );
         case 24:
            return json::internal::read_big_endian_number< std::uint64_t, std::uint8_t >( in, 1 );
         case 25:
            return json::internal::read_big_endian_number< std::uint64_t, std::uint16_t >( in, 1 );
         case 26:
            return json::internal::read_big_endian_number< std::uint64_t, std::uint32_t >( in, 1 );
         case 27:
            return json::internal::read_big_endian_number< std::uint64_t >( in, 1 );
         case 28:
         case 29:
         case 30:
         case 31:
            throw pegtl::parse_error( json::internal::format( "unexpected minor ", m, " for number or length" ), in );
      }
   }

   template< typename Input >
   [[nodiscard]] std::int64_t read_negative_unsafe( Input& in )
   {
      const auto u = read_unsigned_unsafe( in );
      if( u > 9223372036854775808ULL ) {
         throw pegtl::parse_error( "negative integer overflow", in );
      }
      return std::int64_t( ~u );
   }

   template< typename Input >
   [[nodiscard]] std::size_t read_size_unsafe( Input& in )
   {
      const auto s = read_unsigned_unsafe( in );
      if( s > static_cast< std::uint64_t >( ( std::numeric_limits< std::size_t >::max )() ) ) {
         throw pegtl::parse_error( "cbor size exceeds size_t " + std::to_string( s ), in );
      }
      return static_cast< std::size_t >( s );
   }

   template< utf8_mode U, typename Result, typename Input >
   [[nodiscard]] Result read_string_1( Input& in )
   {
      const auto size = read_size_unsafe( in );
      json::internal::throw_on_empty( in, size );
      using value_t = typename Result::value_type;
      const auto* pointer = reinterpret_cast< const value_t* >( in.current() );
      Result result( pointer, size );
      json::internal::consume_utf8_throws< U >( in, size );
      return result;
   }

   template< utf8_mode U, typename Result, typename Input >
   [[nodiscard]] Result read_string_n( Input& in, const major m )
   {
      Result result;
      in.bump_in_this_line();
      while( json::internal::peek_uint8( in ) != 0xff ) {
         if( peek_major_unsafe( in ) != m ) {
            throw pegtl::parse_error( "non-matching fragment in indefinite length string", in );
         }
         const auto size = read_size_unsafe( in );
         json::internal::throw_on_empty( in, size );
         using value_t = typename Result::value_type;
         const auto* pointer = static_cast< const value_t* >( static_cast< const void* >( in.current() ) );
         result.insert( result.end(), pointer, pointer + size );
         json::internal::consume_utf8_throws< U >( in, size );
      }
      in.bump_in_this_line();
      return result;
   }

   template< utf8_mode V, std::size_t N >
   struct data
   {
      using rule_t = data;
      using subs_t = pegtl::empty_list;  // TODO?

      template< pegtl::apply_mode A,
                pegtl::rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename Input,
                typename Consumer >
      [[nodiscard]] static bool match( Input& in, Consumer& consumer )
      {
         if( !in.empty() ) {
            parse_unsafe( in, consumer );
            return true;
         }
         return false;
      }

   private:
      template< typename Input, typename Consumer >
      static void parse_unsafe( Input& in, Consumer& consumer, std::size_t n = 0 )
      {
         switch( peek_major_unsafe( in ) ) {
            case major::UNSIGNED:
               consumer.number( read_unsigned_unsafe( in ) );
               return;
            case major::NEGATIVE:
               consumer.number( read_negative_unsafe( in ) );
               return;
            case major::BINARY:
               parse_binary_unsafe( in, consumer );
               return;
            case major::STRING:
               parse_string_unsafe( in, consumer );
               return;
            case major::ARRAY:
               parse_array_unsafe( in, consumer );
               return;
            case major::OBJECT:
               parse_object_unsafe( in, consumer );
               return;
            case major::TAG:
               if( ++n > N ) {
                  throw pegtl::parse_error( "excessive cbor tag nesting", in );  // When N == 0 we allow no tags at all.
               }
               parse_tag_unsafe( in, consumer );
               json::internal::throw_on_empty( in );
               parse_unsafe( in, consumer, n );  // TODO: Check whether a "decent" compiler performs TCO here?
               return;
            case major::OTHER:
               parse_other_unsafe( in, consumer );
               return;
         }
         // LCOV_EXCL_START
         assert( false );
         // LCOV_EXCL_STOP
      }

      template< typename Input, typename Consumer >
      static void parse_string_unsafe( Input& in, Consumer& consumer )
      {
         if( peek_minor_unsafe( in ) != minor_mask ) {
            consumer.string( read_string_1< V, std::string_view >( in ) );
         }
         else {
            consumer.string( read_string_n< V, std::string >( in, major::STRING ) );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_binary_unsafe( Input& in, Consumer& consumer )
      {
         if( peek_minor_unsafe( in ) != minor_mask ) {
            consumer.binary( read_string_1< utf8_mode::trust, tao::binary_view >( in ) );
         }
         else {
            consumer.binary( read_string_n< utf8_mode::trust, std::vector< std::byte > >( in, major::BINARY ) );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_key_unsafe( Input& in, Consumer& consumer )
      {
         if( peek_minor_unsafe( in ) != minor_mask ) {
            consumer.key( read_string_1< V, std::string_view >( in ) );
         }
         else {
            consumer.key( read_string_n< V, std::string >( in, major::STRING ) );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_array_1( Input& in, Consumer& consumer )
      {
         const auto size = read_size_unsafe( in );
         consumer.begin_array( size );
         for( std::size_t i = 0; i < size; ++i ) {
            json::internal::throw_on_empty( in );
            parse_unsafe( in, consumer );
            consumer.element();
         }
         consumer.end_array( size );
      }

      template< typename Input, typename Consumer >
      static void parse_array_n( Input& in, Consumer& consumer )
      {
         in.bump_in_this_line();
         consumer.begin_array();
         while( json::internal::peek_uint8( in ) != 0xff ) {
            parse_unsafe( in, consumer );
            consumer.element();
         }
         in.bump_in_this_line();
         consumer.end_array();
      }

      template< typename Input, typename Consumer >
      static void parse_array_unsafe( Input& in, Consumer& consumer )
      {
         if( peek_minor_unsafe( in ) != minor_mask ) {
            parse_array_1( in, consumer );
         }
         else {
            parse_array_n( in, consumer );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_object_1( Input& in, Consumer& consumer )
      {
         const auto size = read_size_unsafe( in );
         consumer.begin_object( size );
         for( std::size_t i = 0; i < size; ++i ) {
            if( peek_major( in ) != major::STRING ) {
               throw pegtl::parse_error( "non-string object key", in );
            }
            parse_key_unsafe( in, consumer );
            json::internal::throw_on_empty( in );
            parse_unsafe( in, consumer );
            consumer.member();
         }
         consumer.end_object( size );
      }

      template< typename Input, typename Consumer >
      static void parse_object_n( Input& in, Consumer& consumer )
      {
         in.bump_in_this_line();
         consumer.begin_object();
         while( json::internal::peek_uint8( in ) != 0xff ) {
            if( peek_major_unsafe( in ) != major::STRING ) {
               throw pegtl::parse_error( "non-string object key", in );
            }
            parse_key_unsafe( in, consumer );
            json::internal::throw_on_empty( in );
            parse_unsafe( in, consumer );
            consumer.member();
         }
         in.bump_in_this_line();
         consumer.end_object();
      }

      template< typename Input, typename Consumer >
      static void parse_object_unsafe( Input& in, Consumer& consumer )
      {
         if( peek_minor_unsafe( in ) != minor_mask ) {
            parse_object_1( in, consumer );
         }
         else {
            parse_object_n( in, consumer );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_tag_unsafe( Input& in, Consumer& /*unused*/ )
      {
         switch( const auto m = peek_minor_unsafe( in ) ) {
            default:
               in.bump_in_this_line();
               return;
            case 24:
               consume_or_throw( in, 2 );
               return;
            case 25:
               consume_or_throw( in, 3 );
               return;
            case 26:
               consume_or_throw( in, 5 );
               return;
            case 27:
               consume_or_throw( in, 9 );
               return;
            case 28:
            case 29:
            case 30:
            case 31:
               throw pegtl::parse_error( json::internal::format( "unexpected minor ", m, " for tag" ), in );
         }
      }

      template< typename Input, typename Consumer >
      static void parse_other_unsafe( Input& in, Consumer& consumer )
      {
         switch( const auto m = peek_minor_unsafe( in ) ) {
            case 20:
               consumer.boolean( false );
               in.bump_in_this_line();
               return;
            case 21:
               consumer.boolean( true );
               in.bump_in_this_line();
               return;
            case 22:
               consumer.null();
               in.bump_in_this_line();
               return;
            case 25:
               consumer.number( read_fp16( in ) );
               return;
            case 26:
               consumer.number( json::internal::read_big_endian_number< float >( in, 1 ) );
               return;
            case 27:
               consumer.number( json::internal::read_big_endian_number< double >( in, 1 ) );
               return;
            default:
               throw pegtl::parse_error( json::internal::format( "unsupported minor ", m, " for major 7" ), in );
         }
      }
   };

   template< utf8_mode V, std::size_t N >
   struct basic_grammar
      : pegtl::must< data< V, N >, pegtl::eof >
   {};

   template< utf8_mode V, std::size_t N >
   struct basic_embedded
      : pegtl::must< data< V, N > >
   {};

   // The second parameter determines how long a sequence of CBOR tags (major 6) is allowed to be.

   using grammar = basic_grammar< utf8_mode::check, 8 >;
   using embedded = basic_embedded< utf8_mode::check, 8 >;

}  // namespace tao::json::cbor::internal

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
