// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_INTERNAL_BUNESCAPE_ACTION_HPP
#define TAO_JSON_JAXN_INTERNAL_BUNESCAPE_ACTION_HPP

#include <cstddef>
#include <vector>

#include <tao/pegtl/contrib/unescape.hpp>
#include <tao/pegtl/nothing.hpp>
#include <tao/pegtl/parse_error.hpp>

#include "grammar.hpp"

namespace tao::json::jaxn::internal
{
   template< typename Rule >
   struct bunescape_action
      : pegtl::nothing< Rule >
   {};

   template<>
   struct bunescape_action< rules::bescaped_char >
   {
      template< typename Input >
      static void apply( const Input& in, std::vector< std::byte >& value )
      {
         switch( *in.begin() ) {
            case '"':
               value.push_back( static_cast< std::byte >( '"' ) );
               break;

            case '\'':
               value.push_back( static_cast< std::byte >( '\'' ) );
               break;

            case '\\':
               value.push_back( static_cast< std::byte >( '\\' ) );
               break;

            case '/':
               value.push_back( static_cast< std::byte >( '/' ) );
               break;

            case 'b':
               value.push_back( static_cast< std::byte >( '\b' ) );
               break;

            case 'f':
               value.push_back( static_cast< std::byte >( '\f' ) );
               break;

            case 'n':
               value.push_back( static_cast< std::byte >( '\n' ) );
               break;

            case 'r':
               value.push_back( static_cast< std::byte >( '\r' ) );
               break;

            case 't':
               value.push_back( static_cast< std::byte >( '\t' ) );
               break;

            case 'v':
               value.push_back( static_cast< std::byte >( '\v' ) );
               break;

            case '0':
               value.push_back( static_cast< std::byte >( '\0' ) );
               break;

            default:
               throw pegtl::parse_error( "invalid character in unescape", in );  // LCOV_EXCL_LINE
         }
      }
   };

   template<>
   struct bunescape_action< rules::bescaped_hexcode >
   {
      template< typename Input >
      static void apply( const Input& in, std::vector< std::byte >& value )
      {
         assert( !in.empty() );  // First character MUST be present, usually 'x'.
         value.push_back( static_cast< std::byte >( pegtl::unescape::unhex_string< char >( in.begin() + 1, in.end() ) ) );
      }
   };

   template< char D >
   struct bunescape_action< rules::bunescaped< D > >
   {
      template< typename Input >
      static void apply( const Input& in, std::vector< std::byte >& value )
      {
         const auto* const begin = reinterpret_cast< const std::byte* >( in.begin() );
         const auto* const end = begin + in.size();
         value.insert( value.end(), begin, end );
      }
   };

   template<>
   struct bunescape_action< rules::bbyte >
   {
      template< typename Input >
      static void apply( const Input& in, std::vector< std::byte >& value )
      {
         value.push_back( static_cast< std::byte >( pegtl::unescape::unhex_string< char >( in.begin(), in.end() ) ) );
      }
   };

}  // namespace tao::json::jaxn::internal

#endif
