// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_ESCAPE_HPP
#define TAO_JSON_INTERNAL_ESCAPE_HPP

#include <ostream>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>

namespace tao::json::internal
{
   inline void escape( std::ostream& os, const std::string_view s )
   {
      static const char* h = "0123456789abcdef";

      const char* p = s.data();
      const char* l = p;
      const char* const e = p + s.size();
      while( p != e ) {
         const unsigned char c = *p;
         if( c == '\\' || c == '"' ) {
            os.write( l, p - l );
            l = ++p;
            os.put( '\\' );
            os.put( static_cast< char >( c ) );
         }
         else if( c < 32 || c == 127 ) {
            os.write( l, p - l );
            l = ++p;
            switch( c ) {
               case '\b':
                  os << "\\b";
                  break;
               case '\f':
                  os << "\\f";
                  break;
               case '\n':
                  os << "\\n";
                  break;
               case '\r':
                  os << "\\r";
                  break;
               case '\t':
                  os << "\\t";
                  break;
               default:
                  os << "\\u00" << h[ ( c & 0xf0 ) >> 4 ] << h[ c & 0x0f ];
            }
         }
         else {
            ++p;
         }
      }
      os.write( l, p - l );
   }

   [[nodiscard]] inline std::string escape( const std::string_view s )
   {
      std::ostringstream oss;
      escape( oss, s );
      return std::move( oss ).str();
   }

}  // namespace tao::json::internal

#endif
