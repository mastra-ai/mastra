// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_MSGPACK_INTERNAL_GRAMMAR_HPP
#define TAO_JSON_MSGPACK_INTERNAL_GRAMMAR_HPP

#include <cstddef>
#include <cstdint>
#include <string_view>

#include <tao/pegtl/apply_mode.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rewind_mode.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/type_list.hpp>

#include "../../binary_view.hpp"
#include "../../internal/format.hpp"
#include "../../internal/parse_util.hpp"
#include "../../utf8.hpp"

#include "format.hpp"

namespace tao::json::msgpack::internal
{
   template< utf8_mode U, typename Input >
   [[nodiscard]] std::string_view read_string( Input& in )
   {
      const auto b = json::internal::peek_uint8( in );
      if( ( static_cast< std::uint8_t >( format::FIXSTR_MIN ) <= b ) && ( b <= static_cast< std::uint8_t >( format::FIXSTR_MAX ) ) ) {
         in.bump_in_this_line();
         return json::internal::read_string< U, std::string_view >( in, b - static_cast< std::uint8_t >( format::FIXSTR_MIN ) );
      }
      switch( format( b ) ) {
         case format::STR8:
            return json::internal::read_string< U, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint8_t >( in, 1 ) );
         case format::STR16:
            return json::internal::read_string< U, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint16_t >( in, 1 ) );
         case format::STR32:
            return json::internal::read_string< U, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint32_t >( in, 1 ) );
         default:
            throw pegtl::parse_error( "unexpected key type", in );
      }
   }

   template< utf8_mode V >
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
      static void parse_unsafe( Input& in, Consumer& consumer )
      {
         const auto b = in.peek_uint8();
         if( b <= static_cast< std::uint8_t >( format::POSITIVE_MAX ) ) {
            consumer.number( static_cast< std::uint64_t >( b ) );
            in.bump_in_this_line();
            return;
         }
         if( b >= static_cast< std::uint8_t >( format::NEGATIVE_MIN ) ) {
            consumer.number( static_cast< std::int64_t >( static_cast< std::int8_t >( b ) ) );
            in.bump_in_this_line();
            return;
         }
         if( ( static_cast< std::uint8_t >( format::FIXMAP_MIN ) <= b ) && ( b <= static_cast< std::uint8_t >( format::FIXMAP_MAX ) ) ) {
            in.bump_in_this_line();
            parse_object( in, consumer, b - static_cast< std::uint8_t >( format::FIXMAP_MIN ) );
            return;
         }
         if( ( static_cast< std::uint8_t >( format::FIXARRAY_MIN ) <= b ) && ( b <= static_cast< std::uint8_t >( format::FIXARRAY_MAX ) ) ) {
            in.bump_in_this_line();
            parse_array( in, consumer, b - static_cast< std::uint8_t >( format::FIXARRAY_MIN ) );
            return;
         }
         if( ( static_cast< std::uint8_t >( format::FIXSTR_MIN ) <= b ) && ( b <= static_cast< std::uint8_t >( format::FIXSTR_MAX ) ) ) {
            in.bump_in_this_line();
            consumer.string( json::internal::read_string< V, std::string_view >( in, b - static_cast< std::uint8_t >( format::FIXSTR_MIN ) ) );
            return;
         }
         switch( format( b ) ) {
            case format::NIL:
               consumer.null();
               in.bump_in_this_line();
               return;
            case format::UNUSED:
               throw pegtl::parse_error( "unused first byte 0xc1", in );
            case format::BOOL_TRUE:
               consumer.boolean( true );
               in.bump_in_this_line();
               return;
            case format::BOOL_FALSE:
               consumer.boolean( false );
               in.bump_in_this_line();
               return;
            case format::BIN8:
               consumer.binary( json::internal::read_string< utf8_mode::trust, tao::binary_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint8_t >( in, 1 ) ) );
               return;
            case format::BIN16:
               consumer.binary( json::internal::read_string< utf8_mode::trust, tao::binary_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint16_t >( in, 1 ) ) );
               return;
            case format::BIN32:
               consumer.binary( json::internal::read_string< utf8_mode::trust, tao::binary_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint32_t >( in, 1 ) ) );
               return;
            case format::EXT8:
            case format::EXT16:
            case format::EXT32:
               throw pegtl::parse_error( "msgpack extensions are unsupported", in );
            case format::FLOAT32:
               consumer.number( json::internal::read_big_endian_number< double, float >( in, 1 ) );
               return;
            case format::FLOAT64:
               consumer.number( json::internal::read_big_endian_number< double >( in, 1 ) );
               return;
            case format::UINT8:
               consumer.number( json::internal::read_big_endian_number< std::uint64_t, std::uint8_t >( in, 1 ) );
               return;
            case format::UINT16:
               consumer.number( json::internal::read_big_endian_number< std::uint64_t, std::uint16_t >( in, 1 ) );
               return;
            case format::UINT32:
               consumer.number( json::internal::read_big_endian_number< std::uint64_t, std::uint32_t >( in, 1 ) );
               return;
            case format::UINT64:
               consumer.number( json::internal::read_big_endian_number< std::uint64_t >( in, 1 ) );
               return;
            case format::INT8:
               consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int8_t >( in, 1 ) );
               return;
            case format::INT16:
               consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int16_t >( in, 1 ) );
               return;
            case format::INT32:
               consumer.number( json::internal::read_big_endian_number< std::int64_t, std::int32_t >( in, 1 ) );
               return;
            case format::INT64:
               consumer.number( json::internal::read_big_endian_number< std::int64_t >( in, 1 ) );
               return;
            case format::FIXEXT1:
            case format::FIXEXT2:
            case format::FIXEXT4:
            case format::FIXEXT8:
            case format::FIXEXT16:
               throw pegtl::parse_error( "msgpack extensions are unsupported", in );
            case format::STR8:
               consumer.string( json::internal::read_string< V, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint8_t >( in, 1 ) ) );
               return;
            case format::STR16:
               consumer.string( json::internal::read_string< V, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint16_t >( in, 1 ) ) );
               return;
            case format::STR32:
               consumer.string( json::internal::read_string< V, std::string_view >( in, json::internal::read_big_endian_number< std::size_t, std::uint32_t >( in, 1 ) ) );
               return;
            case format::ARRAY16:
               parse_array( in, consumer, json::internal::read_big_endian_number< std::size_t, std::uint16_t >( in, 1 ) );
               return;
            case format::ARRAY32:
               parse_array( in, consumer, json::internal::read_big_endian_number< std::size_t, std::uint32_t >( in, 1 ) );
               return;
            case format::MAP16:
               parse_object( in, consumer, json::internal::read_big_endian_number< std::size_t, std::uint16_t >( in, 1 ) );
               return;
            case format::MAP32:
               parse_object( in, consumer, json::internal::read_big_endian_number< std::size_t, std::uint32_t >( in, 1 ) );
               return;
            default:
               // LCOV_EXCL_START
               assert( false );
               // LCOV_EXCL_STOP
         }
      }

      template< typename Input, typename Consumer >
      static void parse_array( Input& in, Consumer& consumer, const std::size_t size )
      {
         consumer.begin_array( size );
         for( std::size_t i = 0; i < size; ++i ) {
            json::internal::throw_on_empty( in );
            parse_unsafe( in, consumer );
            consumer.element();
         }
         consumer.end_array( size );
      }

      template< typename Input, typename Consumer >
      static void parse_object( Input& in, Consumer& consumer, const std::size_t size )
      {
         consumer.begin_object( size );
         for( std::size_t i = 0; i < size; ++i ) {
            consumer.key( read_string< V >( in ) );
            json::internal::throw_on_empty( in );
            parse_unsafe( in, consumer );
            consumer.member();
         }
         consumer.end_object( size );
      }
   };

   template< utf8_mode V >
   struct basic_grammar
      : pegtl::must< data< V >, pegtl::eof >
   {};

   template< utf8_mode V >
   struct basic_embedded
      : pegtl::must< data< V > >
   {};

   using grammar = basic_grammar< utf8_mode::check >;
   using embedded = basic_embedded< utf8_mode::check >;

}  // namespace tao::json::msgpack::internal

#endif
