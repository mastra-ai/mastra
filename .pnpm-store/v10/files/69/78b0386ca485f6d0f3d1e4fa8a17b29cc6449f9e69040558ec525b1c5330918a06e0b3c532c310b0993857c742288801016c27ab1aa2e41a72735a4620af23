// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_RAW_STRING_HPP
#define TAO_PEGTL_CONTRIB_RAW_STRING_HPP

#include <cstddef>
#include <type_traits>

#include "../apply_mode.hpp"
#include "../ascii.hpp"
#include "../config.hpp"
#include "../rewind_mode.hpp"
#include "../rules.hpp"

#include "analyze_traits.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< char Open, char Marker >
      struct raw_string_open
      {
         using rule_t = raw_string_open;
         using subs_t = empty_list;

         template< apply_mode A,
                   rewind_mode,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control,
                   typename ParseInput >
         [[nodiscard]] static bool match( ParseInput& in, std::size_t& marker_size ) noexcept( noexcept( in.size( 0 ) ) )
         {
            if( in.empty() || ( in.peek_char( 0 ) != Open ) ) {
               return false;
            }
            for( std::size_t i = 1; i < in.size( i + 1 ); ++i ) {
               switch( const auto c = in.peek_char( i ) ) {
                  case Open:
                     marker_size = i + 1;
                     in.bump_in_this_line( marker_size );
                     (void)eol::match( in );
                     return true;
                  case Marker:
                     break;
                  default:
                     return false;
               }
            }
            return false;
         }
      };

      template< char Open, char Marker >
      inline constexpr bool enable_control< raw_string_open< Open, Marker > > = false;

      template< char Marker, char Close >
      struct at_raw_string_close
      {
         using rule_t = at_raw_string_close;
         using subs_t = empty_list;

         template< apply_mode A,
                   rewind_mode,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control,
                   typename ParseInput >
         [[nodiscard]] static bool match( ParseInput& in, const std::size_t& marker_size ) noexcept( noexcept( in.size( 0 ) ) )
         {
            if( in.size( marker_size ) < marker_size ) {
               return false;
            }
            if( in.peek_char( 0 ) != Close ) {
               return false;
            }
            if( in.peek_char( marker_size - 1 ) != Close ) {
               return false;
            }
            for( std::size_t i = 0; i < ( marker_size - 2 ); ++i ) {
               if( in.peek_char( i + 1 ) != Marker ) {
                  return false;
               }
            }
            return true;
         }
      };

      template< char Marker, char Close >
      inline constexpr bool enable_control< at_raw_string_close< Marker, Close > > = false;

      template< typename Cond, typename... Rules >
      struct raw_string_until
         : raw_string_until< Cond, seq< Rules... > >
      {};

      template< typename Cond >
      struct raw_string_until< Cond >
      {
         using rule_t = raw_string_until;
         using subs_t = type_list< Cond >;

         template< apply_mode A,
                   rewind_mode M,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control,
                   typename ParseInput,
                   typename... States >
         [[nodiscard]] static bool match( ParseInput& in, const std::size_t& marker_size, States&&... /*unused*/ )
         {
            auto m = in.template mark< M >();

            while( !Control< Cond >::template match< A, rewind_mode::required, Action, Control >( in, marker_size ) ) {
               if( in.empty() ) {
                  return false;
               }
               in.bump();
            }
            return m( true );
         }
      };

      template< typename Cond, typename Rule >
      struct raw_string_until< Cond, Rule >
      {
         using rule_t = raw_string_until;
         using subs_t = type_list< Cond, Rule >;

         template< apply_mode A,
                   rewind_mode M,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control,
                   typename ParseInput,
                   typename... States >
         [[nodiscard]] static bool match( ParseInput& in, const std::size_t& marker_size, States&&... st )
         {
            auto m = in.template mark< M >();
            using m_t = decltype( m );

            while( !Control< Cond >::template match< A, rewind_mode::required, Action, Control >( in, marker_size ) ) {
               if( !Control< Rule >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) ) {
                  return false;
               }
            }
            return m( true );
         }
      };

      template< typename Cond, typename... Rules >
      inline constexpr bool enable_control< raw_string_until< Cond, Rules... > > = false;

   }  // namespace internal

   // raw_string matches Lua-style long literals.
   //
   // The following description was taken from the Lua documentation
   // (see http://www.lua.org/docs.html):
   //
   // - An "opening long bracket of level n" is defined as an opening square
   //   bracket followed by n equal signs followed by another opening square
   //   bracket. So, an opening long bracket of level 0 is written as `[[`,
   //   an opening long bracket of level 1 is written as `[=[`, and so on.
   // - A "closing long bracket" is defined similarly; for instance, a closing
   //   long bracket of level 4 is written as `]====]`.
   // - A "long literal" starts with an opening long bracket of any level and
   //   ends at the first closing long bracket of the same level. It can
   //   contain any text except a closing bracket of the same level.
   // - Literals in this bracketed form can run for several lines, do not
   //   interpret any escape sequences, and ignore long brackets of any other
   //   level.
   // - For convenience, when the opening long bracket is eagerly followed
   //   by a newline, the newline is not included in the string.
   //
   // Note that unlike Lua's long literal, a raw_string is customizable to use
   // other characters than `[`, `=` and `]` for matching. Also note that Lua
   // introduced newline-specific replacements in Lua 5.2, which we do not
   // support on the grammar level.

   template< char Open, char Marker, char Close, typename... Contents >
   struct raw_string
   {
      // This is used for binding the apply()-method and for error-reporting
      // when a raw string is not closed properly or has invalid content.
      struct content
         : internal::raw_string_until< internal::at_raw_string_close< Marker, Close >, Contents... >
      {};

      using rule_t = raw_string;
      using subs_t = empty_list;  // type_list< internal::raw_string_open< Open, Marker >, content >;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         std::size_t marker_size;
         if( Control< internal::raw_string_open< Open, Marker > >::template match< A, M, Action, Control >( in, marker_size ) ) {
            if( Control< content >::template match< A, M, Action, Control >( in, marker_size, st... ) ) {
               in.bump_in_this_line( marker_size );
               return true;
            }
         }
         return false;
      }
   };

   template< typename Name, char Open, char Marker, char Close >
   struct analyze_traits< Name, raw_string< Open, Marker, Close > >
      : analyze_any_traits<>
   {};

   template< typename Name, char Open, char Marker, char Close, typename... Contents >
   struct analyze_traits< Name, raw_string< Open, Marker, Close, Contents... > >
      : analyze_traits< Name, typename seq< any, star< Contents... >, any >::rule_t >
   {};

}  // namespace TAO_PEGTL_NAMESPACE

#endif
