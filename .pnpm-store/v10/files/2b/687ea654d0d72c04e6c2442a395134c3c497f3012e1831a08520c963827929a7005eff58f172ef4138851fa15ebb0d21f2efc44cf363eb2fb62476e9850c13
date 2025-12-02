// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_PARTS_PARSER_HPP
#define TAO_JSON_JAXN_PARTS_PARSER_HPP

#include "../parts_parser.hpp"

#include "internal/action.hpp"
#include "internal/bunescape_action.hpp"
#include "internal/grammar.hpp"
#include "internal/integer.hpp"
#include "internal/unescape_action.hpp"

namespace tao::json::jaxn
{
   namespace internal
   {
      namespace rules
      {
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
                  case '+':
                     in.bump_in_this_line();
                     if( in.empty() || !sor_value::match_number< false, A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
                        throw pegtl::parse_error( "incomplete number", in );
                     }
                     return true;

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

      }  // namespace rules

      template< typename Rule >
      struct double_action
         : action< Rule >
      {};

      template< bool NEG >
      struct double_action< rules::number< NEG > >
         : pegtl::change_states< json::internal::number_state< NEG > >
      {
         template< typename Input, typename Consumer >
         static void success( const Input& /*unused*/, json::internal::number_state< NEG >& state, Consumer& consumer )
         {
            state.success( consumer );
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
         pegtl::parse< json::internal::rules::wss >( m_input );
      }

      [[nodiscard]] bool empty()  // noexcept( noexcept( m_input.empty() ) )
      {
         return m_input.empty();
      }

      [[nodiscard]] bool null()
      {
         return pegtl::parse< pegtl::seq< json::internal::rules::kw_null, json::internal::rules::wss > >( m_input );
      }

      [[nodiscard]] bool boolean()
      {
         bool r;
         pegtl::parse< pegtl::must< json::internal::rules::boolean, json::internal::rules::wss > >( m_input, r );
         return r;
      }

      [[nodiscard]] double number_double()
      {
         json::internal::double_state_and_consumer st;
         pegtl::parse< pegtl::must< internal::rules::double_rule, json::internal::rules::wss >, internal::double_action >( m_input, st );
         return st.converted;
      }

      [[nodiscard]] std::int64_t number_signed()
      {
         std::int64_t st = 0;
         pegtl::parse< pegtl::must< internal::integer::signed_rule_with_action, json::internal::rules::wss > >( m_input, st );
         return st;
      }

      [[nodiscard]] std::uint64_t number_unsigned()
      {
         std::uint64_t st = 0;
         pegtl::parse< pegtl::must< internal::integer::unsigned_rule_with_action, json::internal::rules::wss > >( m_input, st );
         return st;
      }

      [[nodiscard]] std::string string()
      {
         std::string unescaped;
         pegtl::parse< pegtl::must< internal::rules::string, json::internal::rules::wss >, internal::unescape_action >( m_input, unescaped );
         return unescaped;
      }

      // TODO: std::string_view string_view() that only works for strings without escape sequences?

      [[nodiscard]] std::vector< std::byte > binary()
      {
         std::vector< std::byte > data;
         pegtl::parse< pegtl::must< internal::rules::binary, json::internal::rules::wss >, internal::bunescape_action >( m_input, data );
         return data;
      }

      [[nodiscard]] std::string key()
      {
         std::string unescaped;
         pegtl::parse< pegtl::must< internal::rules::mkey, json::internal::rules::wss, pegtl::one< ':' >, json::internal::rules::wss >, internal::unescape_action >( m_input, unescaped );
         return unescaped;
      }

      // TODO: std::string_view key_view() that only works for identifiers (and possibly strings without escape sequences)?

   protected:
      template< char C >
      void parse_single_must()
      {
         pegtl::parse< pegtl::must< pegtl::one< C >, json::internal::rules::wss > >( m_input );
      }

      template< char C >
      bool parse_single_test()
      {
         return pegtl::parse< pegtl::seq< pegtl::one< C >, json::internal::rules::wss > >( m_input );
      }

      struct state_t
      {
         std::size_t i = 0;
         static constexpr std::size_t* size = nullptr;
      };

   public:
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
         pegtl::parse< pegtl::disable< pegtl::must< jaxn::internal::rules::sor_value, json::internal::rules::wss > > >( m_input );
      }

      [[nodiscard]] auto mark()  // noexcept( noexcept( m_input.template mark< pegtl::rewind_mode::required >() ) )
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

}  // namespace tao::json::jaxn

#endif
