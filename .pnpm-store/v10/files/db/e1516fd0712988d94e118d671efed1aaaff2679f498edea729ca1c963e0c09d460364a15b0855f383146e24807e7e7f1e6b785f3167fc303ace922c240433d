// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_HTTP_HPP
#define TAO_PEGTL_CONTRIB_HTTP_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/contrib/http.hpp"
#else

#include "../ascii.hpp"
#include "../config.hpp"
#include "../nothing.hpp"
#include "../rules.hpp"
#include "../utf8.hpp"

#include "abnf.hpp"
#include "forward.hpp"
#include "remove_first_state.hpp"
#include "uri.hpp"

namespace TAO_PEGTL_NAMESPACE::http
{
   // HTTP 1.1 grammar according to RFC 7230.

   // This grammar is a direct PEG translation of the original HTTP grammar.
   // It should be considered experimental -- in case of any issues, in particular
   // missing rules for attached actions, please contact the developers.

   using OWS = star< abnf::WSP >;  // optional whitespace
   using RWS = plus< abnf::WSP >;  // required whitespace
   using BWS = OWS;                // "bad" whitespace

   using obs_text = not_range< 0x00, 0x7F >;
   using obs_fold = seq< abnf::CRLF, plus< abnf::WSP > >;

   // clang-format off
   struct tchar : sor< abnf::ALPHA, abnf::DIGIT, one< '!', '#', '$', '%', '&', '\'', '*', '+', '-', '.', '^', '_', '`', '|', '~' > > {};
   struct token : plus< tchar > {};

   struct field_name : token {};

   struct field_vchar : sor< abnf::VCHAR, obs_text > {};
   struct field_content : list< field_vchar, plus< abnf::WSP > > {};
   struct field_value : star< sor< field_content, obs_fold > > {};

   struct header_field : seq< field_name, one< ':' >, OWS, field_value, OWS > {};

   struct method : token {};

   struct absolute_path : plus< one< '/' >, uri::segment > {};

   struct origin_form : seq< absolute_path, uri::opt_query >  {};
   struct absolute_form : uri::absolute_URI {};
   struct authority_form : uri::authority {};
   struct asterisk_form : one< '*' > {};

   struct request_target : sor< origin_form, absolute_form, authority_form, asterisk_form > {};

   struct status_code : rep< 3, abnf::DIGIT > {};
   struct reason_phrase : star< sor< abnf::VCHAR, obs_text, abnf::WSP > > {};

   struct HTTP_version : if_must< string< 'H', 'T', 'T', 'P', '/' >, abnf::DIGIT, one< '.' >, abnf::DIGIT > {};

   struct request_line : if_must< method, abnf::SP, request_target, abnf::SP, HTTP_version, abnf::CRLF > {};
   struct status_line : if_must< HTTP_version, abnf::SP, status_code, abnf::SP, reason_phrase, abnf::CRLF > {};
   struct start_line : sor< status_line, request_line > {};

   struct message_body : star< abnf::OCTET > {};
   struct HTTP_message : seq< start_line, star< header_field, abnf::CRLF >, abnf::CRLF, opt< message_body > > {};

   struct Content_Length : plus< abnf::DIGIT > {};

   struct uri_host : uri::host {};
   struct port : uri::port {};

   struct Host : seq< uri_host, opt< one< ':' >, port > > {};

   // PEG are different from CFGs! (this replaces ctext and qdtext)
   using text = sor< abnf::HTAB, range< 0x20, 0x7E >, obs_text >;

   struct quoted_pair : if_must< one< '\\' >, sor< abnf::VCHAR, obs_text, abnf::WSP > > {};
   struct quoted_string : if_must< abnf::DQUOTE, until< abnf::DQUOTE, sor< quoted_pair, text > > > {};

   struct transfer_parameter : seq< token, BWS, one< '=' >, BWS, sor< token, quoted_string > > {};
   struct transfer_extension : seq< token, star< OWS, one< ';' >, OWS, transfer_parameter > > {};
   struct transfer_coding : sor< istring< 'c', 'h', 'u', 'n', 'k', 'e', 'd' >,
                                 istring< 'c', 'o', 'm', 'p', 'r', 'e', 's', 's' >,
                                 istring< 'd', 'e', 'f', 'l', 'a', 't', 'e' >,
                                 istring< 'g', 'z', 'i', 'p' >,
                                 transfer_extension > {};

   struct rank : sor< seq< one< '0' >, opt< one< '.' >, rep_opt< 3, abnf::DIGIT > > >,
                      seq< one< '1' >, opt< one< '.' >, rep_opt< 3, one< '0' > > > > > {};

   struct t_ranking : seq< OWS, one< ';' >, OWS, one< 'q', 'Q' >, one< '=' >, rank > {};
   struct t_codings : sor< istring< 't', 'r', 'a', 'i', 'l', 'e', 'r', 's' >, seq< transfer_coding, opt< t_ranking > > > {};

   struct TE : opt< sor< one< ',' >, t_codings >, star< OWS, one< ',' >, opt< OWS, t_codings > > > {};

   template< typename T >
   using make_comma_list = seq< star< one< ',' >, OWS >, T, star< OWS, one< ',' >, opt< OWS, T > > >;

   struct connection_option : token {};
   struct Connection : make_comma_list< connection_option > {};

   struct Trailer : make_comma_list< field_name > {};

   struct Transfer_Encoding : make_comma_list< transfer_coding > {};

   struct protocol_name : token {};
   struct protocol_version : token {};
   struct protocol : seq< protocol_name, opt< one< '/' >, protocol_version > > {};
   struct Upgrade : make_comma_list< protocol > {};

   struct pseudonym : token {};

   struct received_protocol : seq< opt< protocol_name, one< '/' > >, protocol_version > {};
   struct received_by : sor< seq< uri_host, opt< one< ':' >, port > >, pseudonym > {};

   struct comment : if_must< one< '(' >, until< one< ')' >, sor< comment, quoted_pair, text > > > {};

   struct Via : make_comma_list< seq< received_protocol, RWS, received_by, opt< RWS, comment > > > {};

   struct http_URI : if_must< istring< 'h', 't', 't', 'p', ':', '/', '/' >, uri::authority, uri::path_abempty, uri::opt_query, uri::opt_fragment > {};
   struct https_URI : if_must< istring< 'h', 't', 't', 'p', 's', ':', '/', '/' >, uri::authority, uri::path_abempty, uri::opt_query, uri::opt_fragment > {};

   struct partial_URI : seq< uri::relative_part, uri::opt_query > {};
   // clang-format on

   struct chunk_size
   {
      using rule_t = plus< abnf::HEXDIG >::rule_t;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, std::size_t& size, States&&... /*unused*/ )
      {
         size = 0;
         std::size_t i = 0;
         while( in.size( i + 1 ) >= i + 1 ) {
            const auto c = in.peek_char( i );
            if( ( '0' <= c ) && ( c <= '9' ) ) {
               size <<= 4;
               size |= std::size_t( c - '0' );
               ++i;
               continue;
            }
            if( ( 'a' <= c ) && ( c <= 'f' ) ) {
               size <<= 4;
               size |= std::size_t( c - 'a' + 10 );
               ++i;
               continue;
            }
            if( ( 'A' <= c ) && ( c <= 'F' ) ) {
               size <<= 4;
               size |= std::size_t( c - 'A' + 10 );
               ++i;
               continue;
            }
            break;
         }
         in.bump_in_this_line( i );
         return i > 0;
      }
   };

   // clang-format off
   struct chunk_ext_name : token {};
   struct chunk_ext_val : sor< quoted_string, token > {};
   struct chunk_ext : star_must< one< ';' >, chunk_ext_name, if_must< one< '=' >, chunk_ext_val > > {};
   // clang-format on

   struct chunk_data
   {
      using rule_t = star< abnf::OCTET >::rule_t;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, const std::size_t size, States&&... /*unused*/ )
      {
         if( in.size( size ) >= size ) {
            in.bump( size );
            return true;
         }
         return false;
      }
   };

   namespace internal::chunk_helper
   {
      template< typename Base >
      struct control;

      template< template< typename... > class Control, typename Rule >
      struct control< Control< Rule > >
         : Control< Rule >
      {
         template< apply_mode A,
                   rewind_mode M,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class,
                   typename ParseInput,
                   typename State,
                   typename... States >
         [[nodiscard]] static bool match( ParseInput& in, State&& /*unused*/, States&&... st )
         {
            return Control< Rule >::template match< A, M, Action, Control >( in, st... );
         }
      };

      template< template< typename... > class Control >
      struct control< Control< chunk_size > >
         : remove_first_state< Control< chunk_size > >
      {};

      template< template< typename... > class Control >
      struct control< Control< chunk_data > >
         : remove_first_state< Control< chunk_data > >
      {};

      template< template< typename... > class Control >
      struct bind
      {
         template< typename Rule >
         using type = control< Control< Rule > >;
      };

   }  // namespace internal::chunk_helper

   struct chunk
   {
      using impl = seq< chunk_size, chunk_ext, abnf::CRLF, chunk_data, abnf::CRLF >;

      using rule_t = impl::rule_t;

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
         std::size_t size{};
         return impl::template match< A, M, Action, internal::chunk_helper::bind< Control >::template type >( in, size, st... );
      }
   };

   // clang-format off
   struct last_chunk : seq< plus< one< '0' > >, not_at< digit >, chunk_ext, abnf::CRLF > {};

   struct trailer_part : star< header_field, abnf::CRLF > {};

   struct chunked_body : seq< until< last_chunk, chunk >, trailer_part, abnf::CRLF > {};
   // clang-format on

}  // namespace TAO_PEGTL_NAMESPACE::http

#endif
#endif
