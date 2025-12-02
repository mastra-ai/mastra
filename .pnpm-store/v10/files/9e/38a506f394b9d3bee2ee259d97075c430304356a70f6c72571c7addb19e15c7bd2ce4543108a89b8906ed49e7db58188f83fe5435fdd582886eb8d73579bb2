// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_INTERNAL_ACTION_HPP
#define TAO_JSON_JAXN_INTERNAL_ACTION_HPP

#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include <tao/pegtl/change_action_and_states.hpp>
#include <tao/pegtl/change_states.hpp>
#include <tao/pegtl/nothing.hpp>
#include <tao/pegtl/parse_error.hpp>

#include "../../internal/number_state.hpp"
#include "../../internal/parse_util.hpp"

#include "bunescape_action.hpp"
#include "grammar.hpp"
#include "unescape_action.hpp"

namespace tao::json::jaxn::internal
{
   template< typename Rule >
   struct action
      : pegtl::nothing< Rule >
   {};

   template<>
   struct action< rules::kw_null >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.null();
      }
   };

   template<>
   struct action< rules::kw_true >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.boolean( true );
      }
   };

   template<>
   struct action< rules::kw_false >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.boolean( false );
      }
   };

   template<>
   struct action< rules::identifier >
   {
      template< typename Input, typename Consumer >
      static void apply( const Input& in, Consumer& consumer )
      {
         consumer.key( std::string_view( in.begin(), in.size() ) );
      }
   };

   template< bool NEG >
   struct action< rules::hexnum< NEG > >
   {
      template< typename Input, typename Consumer >
      static void apply( const Input& in, Consumer& consumer )
      {
         std::uint64_t value = 0;
         for( char c : in ) {
            if( value & 0xF000000000000000 ) {
               throw pegtl::parse_error( "JAXN hexadecimal number too large", in );
            }
            value <<= 4;
            value += json::internal::hex_char_to_integer< std::uint8_t >( c );
         }
         if constexpr( NEG ) {
            if( value < 9223372036854775808ULL ) {
               consumer.number( -static_cast< std::int64_t >( value ) );
            }
            else if( value == 9223372036854775808ULL ) {
               consumer.number( static_cast< std::int64_t >( -9223372036854775807LL - 1 ) );
            }
            else {
               throw pegtl::parse_error( "JAXN hexadecimal number too large to negate", in );
            }
         }
         else {
            consumer.number( value );
         }
      }
   };

   template<>
   struct action< rules::array::begin >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.begin_array();
      }
   };

   template<>
   struct action< rules::array::element >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.element();
      }
   };

   template<>
   struct action< rules::array::end >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.end_array();
      }
   };

   template<>
   struct action< rules::object::begin >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.begin_object();
      }
   };

   template<>
   struct action< rules::object::element >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.member();
      }
   };

   template<>
   struct action< rules::object::end >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.end_object();
      }
   };

   template<>
   struct action< rules::zero< false > >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.number( static_cast< std::uint64_t >( 0 ) );
      }
   };

   template<>
   struct action< rules::zero< true > >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.number( static_cast< std::int64_t >( 0 ) );
      }
   };

   template<>
   struct action< rules::kw_nan >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.number( NAN );
      }
   };

   template<>
   struct action< rules::kw_infinity< false > >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.number( INFINITY );
      }
   };

   template<>
   struct action< rules::kw_infinity< true > >
   {
      template< typename Consumer >
      static void apply0( Consumer& consumer )
      {
         consumer.number( -INFINITY );
      }
   };

   template<>
   struct action< rules::esign >
   {
      template< typename Input, bool NEG >
      static void apply( const Input& in, json::internal::number_state< NEG >& result )
      {
         result.eneg = ( in.peek_char() == '-' );
      }
   };

   template<>
   struct action< rules::idigits >
   {
      template< typename Input, bool NEG >
      static void apply( const Input& in, json::internal::number_state< NEG >& result )
      {
         const auto s = in.size();

         if( s == 1 && in.peek_char() == '0' ) {
            return;
         }

         if( s > ( 1 << 20 ) ) {
            throw pegtl::parse_error( "JSON number with 1 megabyte digits", in );
         }

         const auto c = ( std::min )( s, json::internal::max_mantissa_digits );
         std::memcpy( result.mantissa, in.begin(), c );
         result.exponent10 += static_cast< typename json::internal::number_state< NEG >::exponent10_t >( s - c );
         result.msize = static_cast< typename json::internal::number_state< NEG >::msize_t >( c );

         for( std::size_t i = c; i < s; ++i ) {
            if( in.peek_char( i ) != '0' ) {
               result.drop = true;
               return;
            }
         }
      }
   };

   template<>
   struct action< rules::fdigits >
   {
      template< typename Input, bool NEG >
      static void apply( const Input& in, json::internal::number_state< NEG >& result )
      {
         result.isfp = true;

         const auto* b = in.begin();
         const auto* e = in.end();

         while( ( e > b ) && ( e[ -1 ] == '0' ) ) {
            --e;
         }
         if( !result.msize ) {
            while( ( b < e ) && ( b[ 0 ] == '0' ) ) {
               ++b;
               --result.exponent10;
            }
         }
         const auto c = ( std::min )( std::size_t( e - b ), json::internal::max_mantissa_digits - result.msize );
         std::memcpy( result.mantissa + result.msize, b, c );
         result.exponent10 -= static_cast< typename json::internal::number_state< NEG >::exponent10_t >( c );
         result.msize += static_cast< typename json::internal::number_state< NEG >::msize_t >( c );

         for( const auto* r = b + c; r < e; ++r ) {
            if( *r != '0' ) {
               result.drop = true;
               return;
            }
         }
      }
   };

   template<>
   struct action< rules::edigits >
   {
      template< typename Input, bool NEG >
      static void apply( const Input& in, json::internal::number_state< NEG >& result )
      {
         result.isfp = true;

         const char* b = in.begin();

         while( ( b < in.end() ) && ( b[ 0 ] == '0' ) ) {
            ++b;
         }
         if( ( in.end() - b ) > 9 ) {
            throw pegtl::parse_error( "JSON exponent has more than 9 significant digits", in );
         }
         int exponent10 = 0;

         while( b < in.end() ) {
            exponent10 = ( exponent10 * 10 ) + ( b[ 0 ] - '0' );
            ++b;
         }
         result.exponent10 += ( result.eneg ? -exponent10 : exponent10 );
      }
   };

   template< bool NEG >
   struct action< rules::number< NEG > >
      : pegtl::change_states< json::internal::number_state< NEG > >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, json::internal::number_state< NEG >& state, Consumer& consumer )
      {
         state.success( consumer );
      }
   };

   template<>
   struct action< rules::single_string >
      : pegtl::change_action_and_states< unescape_action, std::string >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, std::string& unescaped, Consumer& consumer )
      {
         consumer.string( std::move( unescaped ) );
      }
   };

   template<>
   struct action< rules::string >
      : pegtl::change_action_and_states< unescape_action, std::string >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, std::string& unescaped, Consumer& consumer )
      {
         consumer.string( std::move( unescaped ) );
      }
   };

   template<>
   struct action< rules::key >
      : pegtl::change_action_and_states< unescape_action, std::string >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, std::string& unescaped, Consumer& consumer )
      {
         consumer.key( std::move( unescaped ) );
      }
   };

   template<>
   struct action< rules::single_binary >
      : pegtl::change_action_and_states< bunescape_action, std::vector< std::byte > >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, std::vector< std::byte >& value, Consumer& consumer )
      {
         consumer.binary( std::move( value ) );
      }
   };

   template<>
   struct action< rules::binary >
      : pegtl::change_action_and_states< bunescape_action, std::vector< std::byte > >
   {
      template< typename Input, typename Consumer >
      static void success( const Input& /*unused*/, std::vector< std::byte >& value, Consumer& consumer )
      {
         consumer.binary( std::move( value ) );
      }
   };

}  // namespace tao::json::jaxn::internal

#endif
