// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTEGER_HPP
#define TAO_PEGTL_CONTRIB_INTEGER_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/contrib/integer.hpp"
#else

#include <cstdint>
#include <cstdlib>

#include <limits>
#include <string_view>
#include <type_traits>

#include "../ascii.hpp"
#include "../parse.hpp"
#include "../parse_error.hpp"
#include "../rules.hpp"

#include "analyze_traits.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   struct unsigned_rule_old
      : plus< digit >
   {
      // Pre-3.0 version of this rule.
   };

   struct unsigned_rule_new
      : if_then_else< one< '0' >, not_at< digit >, plus< digit > >
   {
      // New version that does not allow leading zeros.
   };

   struct signed_rule_old
      : seq< opt< one< '-', '+' > >, plus< digit > >
   {
      // Pre-3.0 version of this rule.
   };

   struct signed_rule_new
      : seq< opt< one< '-', '+' > >, if_then_else< one< '0' >, not_at< digit >, plus< digit > > >
   {
      // New version that does not allow leading zeros.
   };

   struct signed_rule_bis
      : seq< opt< one< '-' > >, if_then_else< one< '0' >, not_at< digit >, plus< digit > > >
   {};

   struct signed_rule_ter
      : seq< one< '-', '+' >, if_then_else< one< '0' >, not_at< digit >, plus< digit > > >
   {};

   namespace internal
   {
      [[nodiscard]] constexpr bool is_digit( const char c ) noexcept
      {
         // We don't use std::isdigit() because it might
         // return true for other values on MS platforms.

         return ( '0' <= c ) && ( c <= '9' );
      }

      template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
      [[nodiscard]] constexpr bool accumulate_digit( Integer& result, const char digit ) noexcept
      {
         // Assumes that digit is a digit as per is_digit(); returns false on overflow.

         static_assert( std::is_integral_v< Integer > );

         constexpr Integer cutoff = Maximum / 10;
         constexpr Integer cutlim = Maximum % 10;

         const Integer c = digit - '0';

         if( ( result > cutoff ) || ( ( result == cutoff ) && ( c > cutlim ) ) ) {
            return false;
         }
         result *= 10;
         result += c;
         return true;
      }

      template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
      [[nodiscard]] constexpr bool accumulate_digits( Integer& result, const std::string_view input ) noexcept
      {
         // Assumes input is a non-empty sequence of digits; returns false on overflow.

         for( char c : input ) {
            if( !accumulate_digit< Integer, Maximum >( result, c ) ) {
               return false;
            }
         }
         return true;
      }

      template< typename Integer, Integer Maximum = ( std::numeric_limits< Integer >::max )() >
      [[nodiscard]] constexpr bool convert_positive( Integer& result, const std::string_view input ) noexcept
      {
         // Assumes result == 0 and that input is a non-empty sequence of digits; returns false on overflow.

         static_assert( std::is_integral_v< Integer > );
         return accumulate_digits< Integer, Maximum >( result, input );
      }

      template< typename Signed >
      [[nodiscard]] constexpr bool convert_negative( Signed& result, const std::string_view input ) noexcept
      {
         // Assumes result == 0 and that input is a non-empty sequence of digits; returns false on overflow.

         static_assert( std::is_signed_v< Signed > );
         using Unsigned = std::make_unsigned_t< Signed >;
         constexpr Unsigned maximum = static_cast< Unsigned >( ( std::numeric_limits< Signed >::max )() ) + 1;
         Unsigned temporary = 0;
         if( accumulate_digits< Unsigned, maximum >( temporary, input ) ) {
            result = static_cast< Signed >( ~temporary ) + 1;
            return true;
         }
         return false;
      }

      template< typename Unsigned, Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
      [[nodiscard]] constexpr bool convert_unsigned( Unsigned& result, const std::string_view input ) noexcept
      {
         // Assumes result == 0 and that input is a non-empty sequence of digits; returns false on overflow.

         static_assert( std::is_unsigned_v< Unsigned > );
         return accumulate_digits< Unsigned, Maximum >( result, input );
      }

      template< typename Signed >
      [[nodiscard]] constexpr bool convert_signed( Signed& result, const std::string_view input ) noexcept
      {
         // Assumes result == 0 and that input is an optional sign followed by a non-empty sequence of digits; returns false on overflow.

         static_assert( std::is_signed_v< Signed > );
         if( input[ 0 ] == '-' ) {
            return convert_negative< Signed >( result, std::string_view( input.data() + 1, input.size() - 1 ) );
         }
         const auto offset = unsigned( input[ 0 ] == '+' );
         return convert_positive< Signed >( result, std::string_view( input.data() + offset, input.size() - offset ) );
      }

      template< typename ParseInput >
      [[nodiscard]] bool match_unsigned( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         if( !in.empty() ) {
            const char c = in.peek_char();
            if( is_digit( c ) ) {
               in.bump_in_this_line();
               if( c == '0' ) {
                  return in.empty() || ( !is_digit( in.peek_char() ) );
               }
               while( ( !in.empty() ) && is_digit( in.peek_char() ) ) {
                  in.bump_in_this_line();
               }
               return true;
            }
         }
         return false;
      }

      template< typename ParseInput,
                typename Unsigned,
                Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
      [[nodiscard]] bool match_and_convert_unsigned_with_maximum_throws( ParseInput& in, Unsigned& st )
      {
         // Assumes st == 0.

         if( !in.empty() ) {
            char c = in.peek_char();
            if( is_digit( c ) ) {
               if( c == '0' ) {
                  in.bump_in_this_line();
                  return in.empty() || ( !is_digit( in.peek_char() ) );
               }
               do {
                  if( !accumulate_digit< Unsigned, Maximum >( st, c ) ) {
                     throw TAO_PEGTL_NAMESPACE::parse_error( "integer overflow", in );
                  }
                  in.bump_in_this_line();
               } while( ( !in.empty() ) && is_digit( c = in.peek_char() ) );
               return true;
            }
         }
         return false;
      }

      template< typename ParseInput,
                typename Unsigned,
                Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
      [[nodiscard]] bool match_and_convert_unsigned_with_maximum_nothrow( ParseInput& in, Unsigned& st )
      {
         // Assumes st == 0.

         if( !in.empty() ) {
            char c = in.peek_char();
            if( c == '0' ) {
               if( ( in.size( 2 ) < 2 ) || ( !is_digit( in.peek_char( 1 ) ) ) ) {
                  in.bump_in_this_line();
                  return true;
               }
               return false;
            }
            if( is_digit( c ) ) {
               unsigned b = 0;

               do {
                  if( !accumulate_digit< Unsigned, Maximum >( st, c ) ) {
                     return false;
                  }
                  ++b;
               } while( ( !in.empty() ) && is_digit( c = in.peek_char( b ) ) );
               in.bump_in_this_line( b );
               return true;
            }
         }
         return false;
      }

   }  // namespace internal

   struct unsigned_action
   {
      // Assumes that 'in' contains a non-empty sequence of ASCII digits.

      template< typename ActionInput, typename Unsigned >
      static void apply( const ActionInput& in, Unsigned& st )
      {
         // This function "only" offers basic exception safety.
         st = 0;
         if( !internal::convert_unsigned( st, in.string_view() ) ) {
            throw parse_error( "unsigned integer overflow", in );
         }
      }
   };

   struct unsigned_rule
   {
      using rule_t = unsigned_rule;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         return internal::match_unsigned( in );  // Does not check for any overflow.
      }
   };

   struct unsigned_rule_with_action
   {
      using rule_t = unsigned_rule_with_action;
      using subs_t = empty_list;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static auto match( ParseInput& in, States&&... /*unused*/ ) noexcept( noexcept( in.empty() ) ) -> std::enable_if_t< A == apply_mode::nothing, bool >
      {
         return internal::match_unsigned( in );  // Does not check for any overflow.
      }

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename Unsigned >
      [[nodiscard]] static auto match( ParseInput& in, Unsigned& st ) -> std::enable_if_t< ( A == apply_mode::action ) && std::is_unsigned_v< Unsigned >, bool >
      {
         // This function "only" offers basic exception safety.
         st = 0;
         return internal::match_and_convert_unsigned_with_maximum_throws( in, st );  // Throws on overflow.
      }
   };

   template< typename Unsigned, Unsigned Maximum >
   struct maximum_action
   {
      // Assumes that 'in' contains a non-empty sequence of ASCII digits.

      static_assert( std::is_unsigned_v< Unsigned > );

      template< typename ActionInput, typename Unsigned2 >
      static void apply( const ActionInput& in, Unsigned2& st )
      {
         // This function "only" offers basic exception safety.
         st = 0;
         if( !internal::convert_unsigned< Unsigned, Maximum >( st, in.string_view() ) ) {
            throw parse_error( "unsigned integer overflow", in );
         }
      }
   };

   template< typename Unsigned, Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
   struct maximum_rule
   {
      using rule_t = maximum_rule;
      using subs_t = empty_list;

      static_assert( std::is_unsigned_v< Unsigned > );

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in )
      {
         Unsigned st = 0;
         return internal::match_and_convert_unsigned_with_maximum_nothrow< ParseInput, Unsigned, Maximum >( in, st );
      }
   };

   template< typename Unsigned, Unsigned Maximum = ( std::numeric_limits< Unsigned >::max )() >
   struct maximum_rule_with_action
   {
      using rule_t = maximum_rule_with_action;
      using subs_t = empty_list;

      static_assert( std::is_unsigned_v< Unsigned > );

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static auto match( ParseInput& in, States&&... /*unused*/ ) -> std::enable_if_t< A == apply_mode::nothing, bool >
      {
         Unsigned st = 0;
         return internal::match_and_convert_unsigned_with_maximum_throws< ParseInput, Unsigned, Maximum >( in, st );
      }

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename Unsigned2 >
      [[nodiscard]] static auto match( ParseInput& in, Unsigned2& st ) -> std::enable_if_t< ( A == apply_mode::action ) && std::is_same_v< Unsigned, Unsigned2 >, bool >
      {
         // This function "only" offers basic exception safety.
         st = 0;
         return internal::match_and_convert_unsigned_with_maximum_throws< ParseInput, Unsigned, Maximum >( in, st );
      }
   };

   struct signed_action
   {
      // Assumes that 'in' contains a non-empty sequence of ASCII digits,
      // with optional leading sign; with sign, in.size() must be >= 2.

      template< typename ActionInput, typename Signed >
      static void apply( const ActionInput& in, Signed& st )
      {
         // This function "only" offers basic exception safety.
         st = 0;
         if( !internal::convert_signed( st, in.string_view() ) ) {
            throw parse_error( "signed integer overflow", in );
         }
      }
   };

   struct signed_rule
   {
      using rule_t = signed_rule;
      using subs_t = empty_list;

      template< typename ParseInput >
      [[nodiscard]] static bool match( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         return TAO_PEGTL_NAMESPACE::parse< signed_rule_new >( in );  // Does not check for any overflow.
      }
   };

   namespace internal
   {
      template< typename Rule >
      struct signed_action_action
         : nothing< Rule >
      {};

      template<>
      struct signed_action_action< signed_rule_new >
         : signed_action
      {};

   }  // namespace internal

   struct signed_rule_with_action
   {
      using rule_t = signed_rule_with_action;
      using subs_t = empty_list;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static auto match( ParseInput& in, States&&... /*unused*/ ) noexcept( noexcept( in.empty() ) ) -> std::enable_if_t< A == apply_mode::nothing, bool >
      {
         return TAO_PEGTL_NAMESPACE::parse< signed_rule_new >( in );  // Does not check for any overflow.
      }

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename Signed >
      [[nodiscard]] static auto match( ParseInput& in, Signed& st ) -> std::enable_if_t< ( A == apply_mode::action ) && std::is_signed_v< Signed >, bool >
      {
         return TAO_PEGTL_NAMESPACE::parse< signed_rule_new, internal::signed_action_action >( in, st );  // Throws on overflow.
      }
   };

   template< typename Name >
   struct analyze_traits< Name, unsigned_rule >
      : analyze_any_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, unsigned_rule_with_action >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Integer, Integer Maximum >
   struct analyze_traits< Name, maximum_rule< Integer, Maximum > >
      : analyze_any_traits<>
   {};

   template< typename Name, typename Integer, Integer Maximum >
   struct analyze_traits< Name, maximum_rule_with_action< Integer, Maximum > >
      : analyze_any_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, signed_rule >
      : analyze_any_traits<>
   {};

   template< typename Name >
   struct analyze_traits< Name, signed_rule_with_action >
      : analyze_any_traits<>
   {};

}  // namespace TAO_PEGTL_NAMESPACE

#endif
#endif
