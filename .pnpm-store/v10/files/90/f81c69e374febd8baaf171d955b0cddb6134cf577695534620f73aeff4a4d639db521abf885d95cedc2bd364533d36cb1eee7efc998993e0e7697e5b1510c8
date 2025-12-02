// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_INTERNAL_INTEGER_HPP
#define TAO_JSON_JAXN_INTERNAL_INTEGER_HPP

#include <cassert>
#include <cstdint>
#include <cstdlib>

#include <string_view>
#include <type_traits>

#include <tao/pegtl/ascii.hpp>
#include <tao/pegtl/nothing.hpp>
#include <tao/pegtl/parse.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>

#include <tao/pegtl/contrib/integer.hpp>

#include "../../internal/parse_util.hpp"

namespace tao::json::jaxn::internal::integer
{
   struct unsigned_rule
      : pegtl::if_then_else< pegtl::one< '0' >, pegtl::if_then_else< pegtl::one< 'x' >, pegtl::plus< pegtl::xdigit >, pegtl::not_at< pegtl::digit > >, pegtl::plus< pegtl::digit > >
   {
      // Unsigned hex or dec integer, no leading zeros for dec.
   };

   struct signed_rule
      : pegtl::seq< pegtl::opt< pegtl::one< '-', '+' > >, unsigned_rule >
   {
      // Signed hex or dec integer, no leading zeros for dec.
   };

   [[nodiscard]] constexpr bool is_hex_digit( const char c ) noexcept
   {
      // We don't use std::isxdigit() because it might
      // return true for other values on MS platforms?

      return ( ( '0' <= c ) && ( c <= '9' ) ) || ( ( 'a' <= c ) && ( c <= 'f' ) ) || ( ( 'A' <= c ) && ( c <= 'F' ) );
   }

   template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
   [[nodiscard]] constexpr bool accumulate_hex_digit( Integer& result, const char xdigit ) noexcept
   {
      // Assumes that xdigit is an xdigit as per is_hex_digit(); returns false on overflow.

      static_assert( std::is_integral_v< Integer > );

      constexpr Integer cutoff = Maximum / 16;
      constexpr Integer cutlim = Maximum % 16;

      const Integer c = json::internal::hex_char_to_integer< Integer >( xdigit );

      if( ( result > cutoff ) || ( ( result == cutoff ) && ( c > cutlim ) ) ) {
         return false;
      }
      result *= 16;
      result += c;
      return true;
   }

   template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
   [[nodiscard]] constexpr bool accumulate_hex_digits( Integer& result, const std::string_view input ) noexcept
   {
      // Assumes input is a non-empty sequence of hex-digits; returns false on overflow.

      for( const auto c : input ) {
         if( !accumulate_hex_digit< Integer, Maximum >( result, c ) ) {
            return false;
         }
      }
      return true;
   }

   template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
   [[nodiscard]] constexpr bool convert_hex_positive( Integer& result, const std::string_view input ) noexcept
   {
      // Assumes result == 0 and that input is a non-empty sequence of hex-digits; returns false on overflow.

      static_assert( std::is_integral_v< Integer > );
      return accumulate_hex_digits< Integer, Maximum >( result, input );
   }

   template< typename Signed >
   [[nodiscard]] constexpr bool convert_hex_negative( Signed& result, const std::string_view input ) noexcept
   {
      // Assumes result == 0 and that input is a non-empty sequence of hex-digits; returns false on overflow.

      static_assert( std::is_signed_v< Signed > );
      using Unsigned = std::make_unsigned_t< Signed >;
      constexpr Unsigned maximum = static_cast< Unsigned >( ( std::numeric_limits< Signed >::max )() ) + 1;
      Unsigned temporary = 0;
      if( accumulate_hex_digits< Unsigned, maximum >( temporary, input ) ) {
         result = static_cast< Signed >( ~temporary ) + 1;
         return true;
      }
      return false;
   }

   template< typename Unsigned, Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
   [[nodiscard]] constexpr bool convert_hex_unsigned( Unsigned& result, const std::string_view input ) noexcept
   {
      // Assumes result == 0 and that input is a non-empty sequence of hex-digits; returns false on overflow.

      static_assert( std::is_unsigned_v< Unsigned > );
      return accumulate_hex_digits< Unsigned, Maximum >( result, input );
   }

   template< typename Signed >
   [[nodiscard]] constexpr bool convert_hex_signed( Signed& result, const std::string_view input ) noexcept
   {
      // Assumes result == 0 and that input is an optional sign followed by a "0x" and a non-empty sequence of hex-digits; returns false on overflow.

      static_assert( std::is_signed_v< Signed > );
      if( input[ 0 ] == '-' ) {
         return convert_hex_negative< Signed >( result, std::string_view( input.data() + 3, input.size() - 3 ) );
      }
      const auto offset = static_cast< unsigned >( input[ 0 ] == '+' ) + 2;  // The "0x" prefix has length 2.
      return convert_hex_positive< Signed >( result, std::string_view( input.data() + offset, input.size() - offset ) );
   }

   using unsigned_dec_action = pegtl::unsigned_action;

   struct unsigned_hex_action
   {
      // Assumes that 'in' contains a non-empty sequence of ASCII hex-digits with "0x" prefix.

      template< typename Input >
      static auto apply( const Input& in, std::uint64_t& st )
      {
         auto sv = in.string_view();
         sv.remove_prefix( 2 );
         if( !convert_hex_unsigned( st, sv ) ) {
            throw pegtl::parse_error( "unsigned hex integer overflow", in );
         }
      }
   };

   template< typename Rule >
   struct unsigned_action_action
      : pegtl::nothing< Rule >
   {};

   template<>
   struct unsigned_action_action< pegtl::plus< pegtl::digit > >
      : unsigned_dec_action
   {};

   template<>
   struct unsigned_action_action< pegtl::plus< pegtl::xdigit > >
   {
      template< typename Input, typename Unsigned >
      static void apply( const Input& in, Unsigned& st )
      {
         if( !convert_hex_unsigned( st, in.string_view() ) ) {
            throw pegtl::parse_error( "unsigned hex integer overflow", in );
         }
      }
   };

   struct unsigned_rule_with_action
   {
      using rule_t = unsigned_rule_with_action;
      using subs_t = pegtl::empty_list;

      template< pegtl::apply_mode,
                pegtl::rewind_mode,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename Input >
      [[nodiscard]] static auto match( Input& in, std::uint64_t& st )
      {
         return pegtl::parse< unsigned_rule, unsigned_action_action >( in, st );  // Throws on overflow.
      }
   };

   using signed_dec_action = pegtl::signed_action;

   struct signed_hex_action
   {
      // Assumes that 'in' contains a non-empty sequence of ASCII hex-digits,
      // with optional leading sign before the "0x" prefix; when there is a
      // sign, in.size() must be >= 4.

      template< typename Input >
      static auto apply( const Input& in, std::int64_t& st )
      {
         if( !convert_hex_signed( st, in.string_view() ) ) {
            throw pegtl::parse_error( "signed hex integer overflow", in );
         }
      }
   };

   template< typename Rule >
   struct signed_action_action
      : pegtl::nothing< Rule >
   {};

   template<>
   struct signed_action_action< pegtl::one< '-', '+' > >
   {
      template< typename Input, typename Signed >
      static void apply( const Input& in, bool& negative, Signed& /*unused*/ )
      {
         negative = ( in.peek_char() == '-' );  // TODO: Optimise with custom rule to prevent building marker and action_input for single char?
      }
   };

   template<>
   struct signed_action_action< pegtl::plus< pegtl::digit > >
   {
      template< typename Input, typename Signed >
      static void apply( const Input& in, const bool negative, Signed& st )
      {
         if( !( negative ? pegtl::internal::convert_negative< Signed >( st, in.string_view() ) : pegtl::internal::convert_positive< Signed >( st, in.string_view() ) ) ) {
            throw pegtl::parse_error( "signed dec integer overflow", in );
         }
      }
   };

   template<>
   struct signed_action_action< pegtl::plus< pegtl::xdigit > >
   {
      template< typename Input, typename Signed >
      static void apply( const Input& in, const bool negative, Signed& st )
      {
         if( !( negative ? convert_hex_negative< Signed >( st, in.string_view() ) : convert_hex_positive< Signed >( st, in.string_view() ) ) ) {
            throw pegtl::parse_error( "signed hex integer overflow", in );
         }
      }
   };

   struct signed_rule_with_action
   {
      using rule_t = signed_rule_with_action;
      using subs_t = pegtl::empty_list;

      template< pegtl::apply_mode,
                pegtl::rewind_mode,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename Input >
      [[nodiscard]] static auto match( Input& in, std::int64_t& st )
      {
         bool negative = false;                                                         // Superfluous initialisation.
         return pegtl::parse< signed_rule, signed_action_action >( in, negative, st );  // Throws on overflow.
      }
   };

}  // namespace tao::json::jaxn::internal::integer

#endif
