// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_URI_FRAGMENT_HPP
#define TAO_JSON_INTERNAL_URI_FRAGMENT_HPP

#include <stdexcept>
#include <string_view>

#include "../pointer.hpp"

namespace tao::json::internal
{
   // clang-format off
   const bool allowed_uri_fragment_characters[] = {
      false, false, false, false, false, false, false, false, // 0
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false, // 16
      false, false, false, false, false, false, false, false,
      false, true,  false, false, true,  false, true,  true,  // 32
      true,  true,  true,  true,  true,  true,  true,  true,
      true,  true,  true,  true,  true,  true,  true,  true,  // 48
      true,  true,  true,  true,  false, true,  false, true,
      true,  true,  true,  true,  true,  true,  true,  true,  // 64
      true,  true,  true,  true,  true,  true,  true,  true,
      true,  true,  true,  true,  true,  true,  true,  true,  // 80
      true,  true,  true,  false, false, false, false, true,
      false, true,  true,  true,  true,  true,  true,  true,  // 96
      true,  true,  true,  true,  true,  true,  true,  true,
      true,  true,  true,  true,  true,  true,  true,  true,  // 112
      true,  true,  true,  false, false, false, true,  false,
      false, false, false, false, false, false, false, false, // 128
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false,
      false, false, false, false, false, false, false, false
   };
   // clang-format on

   [[nodiscard]] inline char xdigit_value( const char c )
   {
      // clang-format off
      switch ( c ) {
      case '0': return 0;
      case '1': return 1;
      case '2': return 2;
      case '3': return 3;
      case '4': return 4;
      case '5': return 5;
      case '6': return 6;
      case '7': return 7;
      case '8': return 8;
      case '9': return 9;
      case 'a': case 'A': return 10;
      case 'b': case 'B': return 11;
      case 'c': case 'C': return 12;
      case 'd': case 'D': return 13;
      case 'e': case 'E': return 14;
      case 'f': case 'F': return 15;
      default:
         throw std::invalid_argument( "invalid URI Fragment escape sequence, '%' must be followed by two hexadecimal digits" );
      }
      // clang-format on
   }

   [[nodiscard]] inline pointer uri_fragment_to_pointer( const std::string_view v )
   {
      pointer result;
      if( v.empty() || v[ 0 ] != '#' ) {
         throw std::invalid_argument( "invalid URI Fragment value, must begin with '#'" );
      }
      if( v.size() > 1 ) {
         const char* p = v.data() + 1;
         const char* const e = v.data() + v.size();
         if( *p++ != '/' ) {
            throw std::invalid_argument( "invalid JSON Pointer value, must be empty or begin with '/'" );
         }
         std::string token;
         while( p != e ) {
            const char c = *p++;
            switch( c ) {
                  // clang-format off
            case '!': case '$': case '&': case '\'': case '(': case ')': case '*': case '+': case ',': case '-': case '.':
            case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
            case ':': case ';': case '=': case '?': case '@':
            case 'A': case 'B': case 'C': case 'D': case 'E': case 'F': case 'G': case 'H': case 'I': case 'J': case 'K': case 'L': case 'M':
            case 'N': case 'O': case 'P': case 'Q': case 'R': case 'S': case 'T': case 'U': case 'V': case 'W': case 'X': case 'Y': case 'Z':
            case '_':
            case 'a': case 'b': case 'c': case 'd': case 'e': case 'f': case 'g': case 'h': case 'i': case 'j': case 'k': case 'l': case 'm':
            case 'n': case 'o': case 'p': case 'q': case 'r': case 's': case 't': case 'u': case 'v': case 'w': case 'x': case 'y': case 'z':
                  // clang-format on
                  token += c;
                  continue;

               case '%':
                  if( p != e ) {
                     const char h1 = xdigit_value( *p++ );
                     if( p != e ) {
                        const char h2 = xdigit_value( *p++ );
                        token += static_cast< char >( h1 * 16 + h2 );
                        continue;
                     }
                  }
                  throw std::invalid_argument( "invalid URI Fragment escape sequence, '%' must be followed by two hexadecimal digits" );

               case '~':
                  if( p != e ) {
                     switch( *p++ ) {
                        case '0':
                           token += '~';
                           continue;
                        case '1':
                           token += '/';
                           continue;
                     }
                  }
                  throw std::invalid_argument( "invalid JSON Pointer escape sequence, '~' must be followed by '0' or '1'" );

               case '/':
                  result += std::move( token );
                  token.clear();
                  continue;

               default:
                  throw std::invalid_argument( "invalid URI Fragment character" );
            }
         }
         result += std::move( token );
      }
      return result;
   }

   [[nodiscard]] inline std::string tokens_to_uri_fragment( std::vector< token >::const_iterator it, const std::vector< token >::const_iterator& end )
   {
      static const char* hex = "0123456789ABCDEF";

      std::string result = "#";
      while( it != end ) {
         result += '/';
         for( const unsigned char c : it->key() ) {
            switch( c ) {
               case '~':
                  result += "~0";
                  break;
               case '/':
                  result += "~1";
                  break;
               default:
                  if( allowed_uri_fragment_characters[ c ] ) {
                     result += static_cast< char >( c );
                  }
                  else {
                     result += '%';
                     result += hex[ c >> 4 ];
                     result += hex[ c & 15 ];
                  }
            }
         }
         ++it;
      }
      return result;
   }

   [[nodiscard]] inline std::string to_uri_fragment( const pointer& p )
   {
      return tokens_to_uri_fragment( p.begin(), p.end() );
   }

}  // namespace tao::json::internal

#endif
