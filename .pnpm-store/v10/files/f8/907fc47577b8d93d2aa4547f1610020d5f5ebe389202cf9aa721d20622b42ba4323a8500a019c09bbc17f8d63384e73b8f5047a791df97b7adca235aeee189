// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_INTERNAL_GRAMMAR_HPP
#define TAO_JSON_JAXN_INTERNAL_GRAMMAR_HPP

#include <cctype>

#include <tao/pegtl/ascii.hpp>
#include <tao/pegtl/parse_error.hpp>
#include <tao/pegtl/rules.hpp>
#include <tao/pegtl/utf8.hpp>

#include <tao/pegtl/contrib/abnf.hpp>

namespace tao::json::jaxn::internal
{
   // clang-format off
   namespace rules
   {
      using namespace pegtl;

      struct line_comment_char : sor< one< '\t' >, utf8::ranges< 0x20, 0x7E, 0x80, 0x10FFFF > > {};
      struct line_comment : seq< one< '/' >, until< eolf, must< line_comment_char > > > {};

      struct block_comment_char : sor< one< '\t' >, utf8::ranges< 0x20, 0x7E, 0x80, 0x10FFFF >, eol > {};
      struct end_block_comment : until< pegtl::string< '*', '/' >, must< block_comment_char > > {};
      struct block_comment : if_must< one< '*' >, end_block_comment > {};

      struct comment : sor< line_comment, block_comment > {};

      struct ws : sor< one< ' ', '\t', '\n', '\r' >, seq< one< '#' >, until< eolf > >, if_must< one< '/' >, comment > > {};

      template< typename R, typename P = ws >
      using padr = pegtl::internal::seq< R, pegtl::internal::star< P > >;

      struct begin_array : padr< one< '[' > > {};
      struct begin_object : padr< one< '{' > > {};
      struct end_array : one< ']' > {};
      struct end_object : one< '}' > {};
      struct name_separator : pad< one< ':' >, ws > {};
      struct value_separator : padr< one< ',' > > {};
      struct element_separator : padr< one< ',' > > {};
      struct value_concat : pad< one< '+' >, ws > {};

      struct kw_false : pegtl::string< 'f', 'a', 'l', 's', 'e' > {};
      struct kw_null : pegtl::string< 'n', 'u', 'l', 'l' > {};
      struct kw_true : pegtl::string< 't', 'r', 'u', 'e' > {};

      struct kw_nan : pegtl::string< 'N', 'a', 'N' > {};

      template< bool NEG >
      struct kw_infinity : pegtl::string< 'I', 'n', 'f', 'i', 'n', 'i', 't', 'y' > {};

      template< bool NEG >
      struct hexnum : plus< abnf::HEXDIG > {};

      struct digits : plus< abnf::DIGIT > {};

      struct esign : one< '-', '+' > {};

      struct edigits : digits {};
      struct fdigits : digits {};
      struct idigits : digits {};

      struct exp : seq< one< 'e', 'E' >, opt< esign >, must< edigits > > {};
      struct frac0 : seq< one< '.' >, opt< fdigits > > {};
      struct frac1 : if_must< one< '.' >, fdigits > {};

      template< bool NEG >
      struct number : seq< sor< seq< idigits, opt< frac0 > >, frac1 >, opt< exp > > {};

      struct xdigit : abnf::HEXDIG {};
      struct escaped_unicode_code_point_content : seq< one< '{' >, plus< xdigit > > {};
      struct escaped_unicode_code_point : seq< one< 'u' >, escaped_unicode_code_point_content, one< '}' > > {};
      struct escaped_unicode : list< seq< one< 'u' >, rep< 4, xdigit > >, one< '\\' > > {};

      struct escaped_char : one< '"', '\'', '\\', '/', 'b', 'f', 'n', 'r', 't', 'v', '0' > {};
      struct escaped : sor< escaped_char, escaped_unicode_code_point, escaped_unicode > {};

      template< char D >
      struct unescaped
      {
         using rule_t = unescaped;
         using subs_t = pegtl::empty_list;

         template< typename Input >
         [[nodiscard]] static bool match( Input& in )
         {
            bool result = false;
            while( const auto t = pegtl::internal::peek_utf8::peek( in ) ) {
               if( ( 0x20 <= t.data ) && ( t.data != '\\' ) && ( t.data != D ) && ( t.data != 0x7F ) ) {
                  in.bump_in_this_line( t.size );
                  result = true;
               }
               else {
                  break;
               }
            }
            return result;
         }
      };

      template< char D >
      struct chars : if_then_else< one< '\\' >, must< escaped >, unescaped< D > > {};

      template< char D >
      struct qstring_content : until< at< one< D > >, must< chars< D > > > {};

      template< char D >
      struct qstring : seq< one< D >, must< qstring_content< D > >, any > {};

      template< char D >
      struct mchars_non_eol
      {
         using rule_t = mchars_non_eol;
         using subs_t = pegtl::empty_list;

         template< typename Input >
         [[nodiscard]] static bool match( Input& in )
         {
            bool result = false;
            while( const auto t = pegtl::internal::peek_utf8::peek( in ) ) {
               if( ( ( 0x20 <= t.data ) && ( t.data != D ) && ( t.data != 0x7F ) ) || ( t.data == '\t' ) ) {
                  in.bump_in_this_line( t.size );
                  result = true;
               }
               else {
                  break;
               }
            }
            return result;
         }
      };

      template< char D >
      struct mchars : sor< mchars_non_eol< D >, one< D >, eol > {};

      template< char D >
      struct mqstring_content : until< at< three< D > >, must< mchars< D > > > {};

      template< char D >
      struct mqstring : seq< three< D >, opt< eol >, must< mqstring_content< D > >, any, any, any > {};

      struct string_fragment : sor< mqstring< '"' >, mqstring< '\'' >, qstring< '"' >, qstring< '\'' > > {};

      struct single_string : string_fragment {};
      struct string : list_must< string_fragment, value_concat > {};

      struct binary_prefix : one< '$' > {};

      struct bescaped_hexcode : seq< one< 'x' >, rep< 2, must< xdigit > > > {};

      struct bescaped_char : one< '"', '\'', '\\', '/', 'b', 'f', 'n', 'r', 't', 'v', '0' > {};
      struct bescaped : sor< bescaped_char, bescaped_hexcode > {};

      template< char D >
      struct bunescaped
      {
         using rule_t = bunescaped;
         using subs_t = pegtl::empty_list;

         template< typename Input >
         [[nodiscard]] static bool match( Input& in )
         {
            bool result = false;

            while( !in.empty() ) {
               const auto t = in.peek_char();
               if( ( 0x20 <= t ) && ( t <= 0x7E ) && ( t != '\\' ) && ( t != D ) ) {
                  in.bump_in_this_line( 1 );
                  result = true;
                  continue;
               }
               return result;
            }
            throw pegtl::parse_error( "invalid character in binary string", in );
         }
      };

      template< char D >
      struct bchars : if_then_else< one< '\\' >, must< bescaped >, bunescaped< D > > {};

      template< char D >
      struct bqstring_content : until< at< one< D > >, must< bchars< D > > > {};

      template< char D >
      struct bqstring : seq< one< D >, must< bqstring_content< D > >, any > {};

      struct bstring : sor< bqstring< '"' >, bqstring< '\'' > > {};

      struct bbyte : rep< 2, abnf::HEXDIG > {};

      struct bpart : plus< bbyte > {};

      struct bdirect : list_must< bpart, one< '.' > > {};

      struct binary_fragment : seq< binary_prefix, opt< sor< bstring, bdirect > > > {};

      struct single_binary : binary_fragment {};
      struct binary : list_must< binary_fragment, value_concat > {};

      struct value;

      struct array_element;
      struct array_content : opt< list_tail< array_element, element_separator > > {};
      struct array : seq< begin_array, array_content, must< end_array > >
      {
         using begin = begin_array;
         using end = end_array;
         using element = array_element;
         using content = array_content;
      };

      struct key : string {};

      struct mkey : sor< key, identifier > {};
      struct member : if_must< mkey, name_separator, value > {};
      struct object_content : opt< list_tail< member, value_separator > > {};
      struct object : seq< begin_object, object_content, must< end_object > >
      {
         using begin = begin_object;
         using end = end_object;
         using element = member;
         using content = object_content;
      };

      template< bool NEG >
      struct zero : one< '0' > {};

      template< typename String, typename Binary >
      struct sor_value_impl
      {
         using rule_t = sor_value_impl;
         using subs_t = pegtl::type_list< String, Binary, number< false >, object, array, kw_false, kw_true, kw_null >;

         template< typename Rule,
                   apply_mode A,
                   template< typename... > class Action,
                   template< typename... > class Control,
                   typename Input,
                   typename... States >
         [[nodiscard]] static bool match_must( Input& in, States&&... st )
         {
            return Control< must< Rule > >::template match< A, rewind_mode::dontcare, Action, Control >( in, st... );
         }

         template< bool NEG,
                   apply_mode A,
                   rewind_mode M,
                   template< typename... > class Action,
                   template< typename... > class Control,
                   typename Input,
                   typename... States >
         [[nodiscard]] static bool match_zero( Input& in, States&&... st )
         {
            if( in.size( 2 ) > 1 ) {
               switch( in.peek_char( 1 ) ) {
               case '.':
               case 'e':
               case 'E':
                  return Control< number< NEG > >::template match< A, M, Action, Control >( in, st... );

               case 'x':
               case 'X':
                  in.bump_in_this_line( 2 );
                  return Control< must< hexnum< NEG > > >::template match< A, M, Action, Control >( in, st... );

               case '0':
               case '1':
               case '2':
               case '3':
               case '4':
               case '5':
               case '6':
               case '7':
               case '8':
               case '9':
                  throw pegtl::parse_error( "invalid leading zero", in );
               }
            }
            return Control< zero< NEG > >::template match< A, M, Action, Control >( in, st... );
         }

         template< bool NEG,
                   apply_mode A,
                   rewind_mode M,
                   template< typename... > class Action,
                   template< typename... > class Control,
                   typename Input,
                   typename... States >
         [[nodiscard]] static bool match_number( Input& in, States&&... st )
         {
            switch( in.peek_char() ) {
            case 'N':
               return Control< must< kw_nan > >::template match< A, M, Action, Control >( in, st... );

            case 'I':
               return Control< must< kw_infinity< NEG > > >::template match< A, M, Action, Control >( in, st... );

            case '0':
               if( !match_zero< NEG, A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
                  throw pegtl::parse_error( "incomplete number", in );
               }
               return true;

            default:
               return Control< number< NEG > >::template match< A, M, Action, Control >( in, st... );
            }
         }

         template< apply_mode A,
                   rewind_mode M,
                   template< typename... > class Action,
                   template< typename... > class Control,
                   typename Input,
                   typename... States >
         [[nodiscard]] static bool match_impl( Input& in, States&&... st )
         {
            switch( in.peek_char() ) {
            case '{': return Control< object >::template match< A, M, Action, Control >( in, st... );
            case '[': return Control< array >::template match< A, M, Action, Control >( in, st... );
            case 'n': return Control< kw_null >::template match< A, M, Action, Control >( in, st... );
            case 't': return Control< kw_true >::template match< A, M, Action, Control >( in, st... );
            case 'f': return Control< kw_false >::template match< A, M, Action, Control >( in, st... );

            case '"':
            case '\'':
               return Control< String >::template match< A, M, Action, Control >( in, st... );

            case '$':
               return Control< Binary >::template match< A, M, Action, Control >( in, st... );

            case '+':
               in.bump_in_this_line();
               if( in.empty() || !match_number< false, A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
                  throw pegtl::parse_error( "incomplete number", in );
               }
               return true;

            case '-':
               in.bump_in_this_line();
               if( in.empty() || !match_number< true, A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
                  throw pegtl::parse_error( "incomplete number", in );
               }
               return true;

            default:
               return match_number< false, A, M, Action, Control >( in, st... );
            }
         }

         template< apply_mode A,
                   rewind_mode M,
                   template< typename... > class Action,
                   template< typename... > class Control,
                   typename Input,
                   typename... States >
         [[nodiscard]] static bool match( Input& in, States&&... st )
         {
            if( in.size( 2 ) && match_impl< A, M, Action, Control >( in, st... ) ) {
               in.discard();
               return true;
            }
            return false;
         }
      };

      struct sor_single_value : sor_value_impl< single_string, single_binary > {};
      struct sor_value : sor_value_impl< string, binary > {};

      struct value : padr< sor_value > {};
      struct array_element : value {};

      struct text : seq< star< ws >, value > {};

   }  // namespace rules

   struct grammar : pegtl::must< rules::text, pegtl::eof > {};
   struct embedded : pegtl::must< rules::sor_value > {};
   // clang-format on

}  // namespace tao::json::jaxn::internal

#endif
