// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_PARTS_PARSER_HPP
#define TAO_JSON_PARTS_PARSER_HPP

#include <tao/pegtl/ascii.hpp>
#include <tao/pegtl/change_states.hpp>
#include <tao/pegtl/nothing.hpp>
#include <tao/pegtl/parse.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/string_input.hpp>

#include <tao/pegtl/contrib/integer.hpp>
#include <tao/pegtl/contrib/json.hpp>

#include "internal/action.hpp"
#include "internal/format.hpp"
#include "internal/grammar.hpp"
#include "internal/number_state.hpp"
#include "internal/unescape_action.hpp"

namespace tao::json
{
   namespace internal
   {
      namespace rules
      {
         struct wss
            : pegtl::star< ws >
         {};

         struct boolean
         {
            template< pegtl::apply_mode,
                      pegtl::rewind_mode,
                      template< typename... >
                      class,
                      template< typename... >
                      class,
                      typename Input >
            [[nodiscard]] static bool match( Input& in, bool& st ) noexcept( noexcept( in.size( 5 ) ) )
            {
               const auto s = in.size( 5 );
               if( s >= 5 ) {
                  if( std::memcmp( in.current(), "false", 5 ) == 0 ) {
                     in.bump_in_this_line( 5 );
                     st = false;
                     return true;
                  }
               }
               if( s >= 4 ) {
                  if( std::memcmp( in.current(), "true", 4 ) == 0 ) {
                     in.bump_in_this_line( 4 );
                     st = true;
                     return true;
                  }
               }
               return false;
            }
         };

         struct double_rule
         {
            template< apply_mode A,
                      rewind_mode M,
                      template< typename... >
                      class Action,
                      template< typename... >
                      class Control,
                      typename Input,
                      typename... States >
            [[nodiscard]] static bool match_impl( Input& in, States&&... st )
            {
               switch( in.peek_char() ) {
                  case '-':
                     in.bump_in_this_line();
                     if( in.empty() || !sor_value::match_number< true, A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
                        throw pegtl::parse_error( "incomplete number", in );
                     }
                     return true;

                  default:
                     return sor_value::match_number< false, A, M, Action, Control >( in, st... );
               }
            }

            template< apply_mode A,
                      rewind_mode M,
                      template< typename... >
                      class Action,
                      template< typename... >
                      class Control,
                      typename Input,
                      typename... States >
            [[nodiscard]] static bool match( Input& in, States&&... st )
            {
               return in.size( 2 ) && match_impl< A, M, Action, Control >( in, st... );
            }
         };

         using dumb_string = seq< one< '"' >, until< one< '"' > > >;

      }  // namespace rules

      template< typename Rule >
      struct double_action
         : action< Rule >
      {};

      template< bool NEG >
      struct double_action< rules::number< NEG > >
         : pegtl::change_states< number_state< NEG > >
      {
         template< typename Input, typename Consumer >
         static void success( const Input& /*unused*/, number_state< NEG >& state, Consumer& consumer )
         {
            state.success( consumer );
         }
      };

      struct double_state_and_consumer
      {
         void number( const double d )
         {
            converted = d;
         }

         void number( const std::int64_t i )
         {
            converted = static_cast< double >( i );
         }

         void number( const std::uint64_t u )
         {
            converted = static_cast< double >( u );
         }

         double converted = 0.0;  // TODO: Remove superfluous initialisation when we manage to shup up the warnings on all compilers.
      };

      template< typename Rule >
      struct dumb_string_action
         : pegtl::nothing< Rule >
      {};

      template<>
      struct dumb_string_action< rules::dumb_string >
      {
         template< typename Input >
         static void apply( const Input& in, std::string_view& string )
         {
            string = std::string_view( in.begin() + 1, in.size() - 2 );  // The grammar ensures that in contains at least two '"'.
         }
      };

   }  // namespace internal

   // TODO: Optimise some of the simpler cases?

   template< typename Input = pegtl::string_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, std::string > >
   class basic_parts_parser
   {
   public:
      template< typename... Ts >
      explicit basic_parts_parser( Ts&&... ts )
         : m_input( std::forward< Ts >( ts )... )
      {
         pegtl::parse< internal::rules::wss >( m_input );
      }

      [[nodiscard]] bool empty()
      {
         return m_input.empty();
      }

      [[nodiscard]] bool null()
      {
         return pegtl::parse< pegtl::seq< internal::rules::kw_null, internal::rules::wss > >( m_input );
      }

      [[nodiscard]] bool boolean()
      {
         bool r;
         pegtl::parse< pegtl::must< internal::rules::boolean, internal::rules::wss > >( m_input, r );
         return r;
      }

      [[nodiscard]] double number_double()
      {
         internal::double_state_and_consumer st;
         pegtl::parse< pegtl::must< internal::rules::double_rule, internal::rules::wss >, internal::double_action >( m_input, st );
         return st.converted;
      }

      [[nodiscard]] std::int64_t number_signed()
      {
         std::int64_t st = 0;  // TODO: Remove superfluous initialisation when we manage to shup up the warnings on all compilers.
         pegtl::parse< pegtl::must< pegtl::signed_rule_with_action, internal::rules::wss > >( m_input, st );
         return st;
      }

      [[nodiscard]] std::uint64_t number_unsigned()
      {
         std::uint64_t st = 0;  // TODO: Remove superfluous initialisation when we manage to shup up the warnings on all compilers.
         pegtl::parse< pegtl::must< pegtl::unsigned_rule_with_action, internal::rules::wss > >( m_input, st );
         return st;
      }

      [[nodiscard]] std::string string()
      {
         std::string unescaped;
         pegtl::parse< pegtl::must< internal::rules::string, internal::rules::wss >, internal::unescape_action >( m_input, unescaped );
         return unescaped;
      }

      [[nodiscard]] std::string_view dumb_string()
      {
         std::string_view result;
         pegtl::parse< pegtl::must< internal::rules::dumb_string, internal::rules::wss >, internal::dumb_string_action >( m_input, result );
         return result;
      }

      [[nodiscard]] std::vector< std::byte > binary()
      {
         throw std::runtime_error( "json format does not support binary" );
      }

      [[nodiscard]] std::string key()
      {
         std::string unescaped;
         pegtl::parse< pegtl::must< internal::rules::string, internal::rules::wss, pegtl::one< ':' >, internal::rules::wss >, internal::unescape_action >( m_input, unescaped );
         return unescaped;
      }

      [[nodiscard]] std::string_view dumb_key()
      {
         std::string_view result;
         pegtl::parse< pegtl::must< internal::rules::dumb_string, internal::rules::wss, pegtl::one< ':' >, internal::rules::wss >, internal::dumb_string_action >( m_input, result );
         return result;
      }

      template< char C >
      void parse_single_must()
      {
         pegtl::parse< pegtl::must< pegtl::one< C >, internal::rules::wss > >( m_input );
      }

      template< char C >
      [[nodiscard]] bool parse_single_test()
      {
         return pegtl::parse< pegtl::seq< pegtl::one< C >, internal::rules::wss > >( m_input );
      }

      struct state_t
      {
         std::size_t i = 0;
         static constexpr std::size_t* size = nullptr;
      };

      [[nodiscard]] state_t begin_array()
      {
         parse_single_must< '[' >();
         return state_t();
      }

      void end_array( state_t& /*unused*/ )
      {
         parse_single_must< ']' >();
      }

      void element( state_t& p )
      {
         if( p.i++ ) {
            parse_single_must< ',' >();
         }
      }

      [[nodiscard]] bool element_or_end_array( state_t& p )
      {
         if( parse_single_test< ']' >() ) {
            return false;
         }
         element( p );
         return true;
      }

      [[nodiscard]] state_t begin_object()
      {
         parse_single_must< '{' >();
         return state_t();
      }

      void end_object( state_t& /*unused*/ )
      {
         parse_single_must< '}' >();
      }

      void member( state_t& p )
      {
         if( p.i++ ) {
            parse_single_must< ',' >();
         }
      }

      [[nodiscard]] bool member_or_end_object( state_t& p )
      {
         if( parse_single_test< '}' >() ) {
            return false;
         }
         member( p );
         return true;
      }

      void skip_value()
      {
         pegtl::parse< pegtl::disable< pegtl::must< internal::rules::sor_value, internal::rules::wss > > >( m_input );
      }

      [[nodiscard]] auto mark()
      {
         return m_input.template mark< pegtl::rewind_mode::required >();
      }

      template< typename T >
      void throw_parse_error( T&& t ) const
      {
         throw pegtl::parse_error( std::forward< T >( t ), m_input );
      }

   protected:
      Input m_input;
   };

   using parts_parser = basic_parts_parser<>;

}  // namespace tao::json

#endif
