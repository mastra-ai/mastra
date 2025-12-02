// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_IS_IDENTIFIER_HPP
#define TAO_JSON_JAXN_IS_IDENTIFIER_HPP

#include <algorithm>
#include <cctype>
#include <string_view>

namespace tao::json::jaxn
{
   [[nodiscard]] inline bool is_identifier( const std::string_view v ) noexcept
   {
      if( v.empty() || ( std::isdigit( v[ 0 ] ) != 0 ) ) {
         return false;
      }
      return std::all_of( v.begin(), v.end(), []( const char c ) { return ( std::isalnum( c ) != 0 ) || ( c == '_' ); } );
   }

}  // namespace tao::json::jaxn

#endif
