// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_HEXDUMP_HPP
#define TAO_JSON_INTERNAL_HEXDUMP_HPP

#include <sstream>
#include <string>
#include <utility>

namespace tao::json::internal
{
   template< typename T >
   void hexdump( std::ostream& os, const T& v )
   {
      static const char h[] = "0123456789ABCDEF";
      for( const auto b : v ) {
         os.put( h[ static_cast< unsigned char >( b ) >> 4 ] );
         os.put( h[ static_cast< unsigned char >( b ) & 0xF ] );
      }
   }

   template< typename T >
   [[nodiscard]] std::string hexdump( const T& v )
   {
      std::ostringstream oss;
      internal::hexdump( oss, v );
      return std::move( oss ).str();
   }

}  // namespace tao::json::internal

#endif
