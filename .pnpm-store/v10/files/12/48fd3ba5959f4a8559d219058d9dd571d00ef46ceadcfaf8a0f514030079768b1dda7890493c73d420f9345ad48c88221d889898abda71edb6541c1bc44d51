// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UBJSON_INTERNAL_GRAMMAR_HPP
#define TAO_JSON_UBJSON_INTERNAL_GRAMMAR_HPP

#include <cstdint>
#include <string_view>

#include <tao/pegtl/memory_input.hpp>
#include <tao/pegtl/parse.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/type_list.hpp>

#include "../../binary_view.hpp"
#include "../../internal/action.hpp"
#include "../../internal/endian.hpp"
#include "../../internal/errors.hpp"
#include "../../internal/grammar.hpp"
#include "../../internal/parse_util.hpp"
#include "../../utf8.hpp"

#include "marker.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4702 )
#endif

namespace tao::json
{
   namespace ubjson::internal
   {
      struct number
      {
         using rule_t = number;
         using subs_t = pegtl::empty_list;

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
            if( in.size( 2 ) && match_unsafe< A, M, Action, Control >( in, consumer ) ) {
               in.discard();
               return true;
            }
            return false;
         }

      private:
         template< pegtl::apply_mode A,
                   pegtl::rewind_mode M,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control,
                   typename Input,
                   typename Consumer >
         [[nodiscard]] static bool match_unsafe( Input& in, Consumer& consumer )
         {
            if( in.peek_char() == '-' ) {
               in.bump_in_this_line();
               if( in.empty() || !json::internal::rules::sor_value::match_number< true, A, pegtl::rewind_mode::dontcare, Action, Control >( in, consumer ) ) {
                  throw pegtl::parse_error( "incomplete ubjson high-precision number", in );
               }
               return true;
            }
            return json::internal::rules::sor_value::match_number< false, A, M, Action, Control >( in, consumer );
         }
      };

   }  // namespace ubjson::internal

   namespace internal
   {
      // clang-format off
      template<> inline const char* errors< ubjson::internal::number >::error_message = "invalid ubjson high-precision number";
      // clang-format on

   }  // namespace internal

   namespace ubjson::internal
   {
      template< typename Input >
      [[nodiscard]] marker peek_marker( Input& in )
      {
         return marker( json::internal::peek_char( in ) );
      }

      template< typename Input >
      [[nodiscard]] marker read_marker( Input& in )
      {
         return marker( json::internal::read_char( in ) );
      }

      template< typename Input >
      [[nodiscard]] marker read_marker_unsafe( Input& in )
      {
         return marker( json::internal::read_char_unsafe( in ) );
      }

      template< typename Input >
      [[nodiscard]] std::int64_t read_size_read( Input& in )
      {
         switch( const auto c = read_marker( in ) ) {
            case marker::INT8:
               return json::internal::read_big_endian_number< std::int64_t, std::int8_t >( in );
            case marker::UINT8:
               return json::internal::read_big_endian_number< std::int64_t, std::uint8_t >( in );
            case marker::INT16:
               return json::internal::read_big_endian_number< std::int64_t, std::int16_t >( in );
            case marker::INT32:
               return json::internal::read_big_endian_number< std::int64_t, std::int32_t >( in );
            case marker::INT64:
               return json::internal::read_big_endian_number< std::int64_t >( in );
            default:
               throw pegtl::parse_error( "unknown ubjson size type " + std::to_string( unsigned( c ) ), in );
         }
      }

      template< std::size_t L, typename Input >
      [[nodiscard]] std::size_t read_size( Input& in )
      {
         const auto s = read_size_read( in );
         if( s < 0 ) {
            throw pegtl::parse_error( "negative ubjson size " + std::to_string( s ), in );
         }
         const auto t = static_cast< std::uint64_t >( s );
         if( t > static_cast< std::uint64_t >( L ) ) {
            throw pegtl::parse_error( "ubjson size exceeds limit " + std::to_string( t ), in );
         }
         return static_cast< std::size_t >( t );
      }

      template< typename Result, typename Input >
      [[nodiscard]] Result read_char( Input& in )
      {
         if( in.empty() || ( in.peek_uint8( 0 ) > 127 ) ) {
            throw pegtl::parse_error( "missing or invalid ubjson char", in );
         }
         Result result( in.current(), 1 );
         in.bump_in_this_line( 1 );
         return result;
      }

      template< std::size_t L, utf8_mode U, typename Result, typename Input >
      [[nodiscard]] Result read_string( Input& in )
      {
         const auto size = read_size< L >( in );
         return json::internal::read_string< U, Result >( in, size );
      }

      template< std::size_t L, utf8_mode V >
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
         static void parse( Input& in, Consumer& consumer )
         {
            parse( in, consumer, read_marker( in ) );
         }

         template< typename Input, typename Consumer >
         static void parse_unsafe( Input& in, Consumer& consumer )
         {
            parse( in, consumer, read_marker_unsafe( in ) );
         }

         template< typename Input, typename Consumer >
         static void parse( Input& in, Consumer& consumer, const marker c )
         {
            switch( c ) {
               case marker::NULL_:
                  consumer.null();
                  break;
               case marker::TRUE_:
                  consumer.boolean( true );
                  break;
               case marker::FALSE_:
                  consumer.boolean( false );
                  break;
               case marker::INT8:
                  consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int8_t >( in ) );
                  break;
               case marker::UINT8:
                  consumer.number( json::internal::read_big_endian_number< std::uint64_t, std::uint8_t >( in ) );
                  break;
               case marker::INT16:
                  consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int16_t >( in ) );
                  break;
               case marker::INT32:
                  consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int32_t >( in ) );
                  break;
               case marker::INT64:
                  consumer.number( json::internal::read_big_endian_number< std::int64_t >( in ) );
                  break;
               case marker::FLOAT32:
                  consumer.number( json::internal::read_big_endian_number< double, float >( in ) );
                  break;
               case marker::FLOAT64:
                  consumer.number( json::internal::read_big_endian_number< double >( in ) );
                  break;
               case marker::HIGH_PRECISION:
                  parse_high_precision( in, consumer );
                  break;
               case marker::CHAR:
                  consumer.string( read_char< std::string_view >( in ) );
                  break;
               case marker::STRING:
                  consumer.string( read_string< L, V, std::string_view >( in ) );
                  break;
               case marker::BEGIN_ARRAY:
                  parse_array( in, consumer );
                  break;
               case marker::BEGIN_OBJECT:
                  parse_object( in, consumer );
                  break;
               case marker::NO_OP:
                  throw pegtl::parse_error( "unsupported ubjson no-op", in );
               default:
                  throw pegtl::parse_error( "unknown ubjson type " + std::to_string( static_cast< unsigned >( c ) ), in );
            }
         }

         template< typename Input, typename Consumer >
         static void parse_high_precision( Input& in, Consumer& consumer )
         {
            const auto size = read_size< L >( in );
            json::internal::throw_on_empty( in, size );
            pegtl::memory_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, const char* > i2( in.current(), in.current() + size, "UBJSON" );
            pegtl::parse_nested< pegtl::must< number, pegtl::eof >, json::internal::action, json::internal::errors >( in, i2, consumer );
            in.bump_in_this_line( size );
         }

         template< typename Input, typename Consumer >
         static void parse_array( Input& in, Consumer& consumer )
         {
            switch( peek_marker( in ) ) {
               case marker::CONTAINER_SIZE:
                  in.bump_in_this_line( 1 );
                  parse_sized_array( in, consumer );
                  break;
               case marker::CONTAINER_TYPE:
                  in.bump_in_this_line( 1 );
                  parse_typed_array( in, consumer );
                  break;
               default:
                  parse_basic_array( in, consumer );
                  break;
            }
         }

         template< typename Input, typename Consumer >
         static void parse_sized_array( Input& in, Consumer& consumer )
         {
            const auto size = read_size< L >( in );
            consumer.begin_array( size );
            for( std::size_t i = 0; i < size; ++i ) {
               parse( in, consumer );
               consumer.element();
            }
            consumer.end_array( size );
         }

         template< typename Input, typename Consumer >
         static void parse_typed_array( Input& in, Consumer& consumer )
         {
            const auto c = read_marker( in );
            if( read_marker( in ) != marker::CONTAINER_SIZE ) {
               throw pegtl::parse_error( "ubjson array type not followed by size", in );
            }
            if( c == marker::UINT8 ) {
               // NOTE: UBJSON encodes binary data as 'strongly typed array of uint8 values'.
               consumer.binary( read_string< L, utf8_mode::trust, tao::binary_view >( in ) );
               return;
            }
            const auto size = read_size< L >( in );
            consumer.begin_array( size );
            for( std::size_t i = 0; i < size; ++i ) {
               parse( in, consumer, c );
               consumer.element();
            }
            consumer.end_array( size );
         }

         template< typename Input, typename Consumer >
         static void parse_basic_array( Input& in, Consumer& consumer )
         {
            consumer.begin_array();
            while( peek_marker( in ) != marker::END_ARRAY ) {
               parse_unsafe( in, consumer );
               consumer.element();
            }
            in.bump_in_this_line( 1 );
            consumer.end_array();
         }

         template< typename Input, typename Consumer >
         static void parse_key( Input& in, Consumer& consumer )
         {
            consumer.key( read_string< L, V, std::string_view >( in ) );
         }

         template< typename Input, typename Consumer >
         static void parse_object( Input& in, Consumer& consumer )
         {
            switch( peek_marker( in ) ) {
               case marker::CONTAINER_SIZE:
                  in.bump_in_this_line( 1 );
                  parse_sized_object( in, consumer );
                  break;
               case marker::CONTAINER_TYPE:
                  in.bump_in_this_line( 1 );
                  parse_typed_object( in, consumer );
                  break;
               default:
                  parse_basic_object( in, consumer );
                  break;
            }
         }

         template< typename Input, typename Consumer >
         static void parse_sized_object( Input& in, Consumer& consumer )
         {
            const auto size = read_size< L >( in );
            consumer.begin_object( size );
            for( std::size_t i = 0; i < size; ++i ) {
               parse_key( in, consumer );
               parse( in, consumer );
               consumer.member();
            }
            consumer.end_object( size );
         }

         template< typename Input, typename Consumer >
         static void parse_typed_object( Input& in, Consumer& consumer )
         {
            const auto c = read_marker( in );
            if( read_marker( in ) != marker::CONTAINER_SIZE ) {
               throw pegtl::parse_error( "ubjson object type not followed by size", in );
            }
            const auto size = read_size< L >( in );
            consumer.begin_object( size );
            for( std::size_t i = 0; i < size; ++i ) {
               parse_key( in, consumer );
               parse( in, consumer, c );
               consumer.member();
            }
            consumer.end_object( size );
         }

         template< typename Input, typename Consumer >
         static void parse_basic_object( Input& in, Consumer& consumer )
         {
            consumer.begin_object();
            while( peek_marker( in ) != marker::END_OBJECT ) {
               parse_key( in, consumer );
               parse( in, consumer );
               consumer.member();
            }
            in.bump_in_this_line( 1 );
            consumer.end_object();
         }
      };

      struct nops
         : pegtl::star< pegtl::one< static_cast< char >( marker::NO_OP ) > >
      {};

      template< std::size_t L, utf8_mode V >
      struct basic_grammar
         : pegtl::must< nops, data< L, V >, nops, pegtl::eof >
      {};

      template< std::size_t L, utf8_mode V >
      struct basic_embedded
         : pegtl::must< data< L, V > >
      {};

      using grammar = basic_grammar< 1 << 24, utf8_mode::check >;
      using embedded = basic_embedded< 1 << 24, utf8_mode::check >;

   }  // namespace ubjson::internal

}  // namespace tao::json

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
