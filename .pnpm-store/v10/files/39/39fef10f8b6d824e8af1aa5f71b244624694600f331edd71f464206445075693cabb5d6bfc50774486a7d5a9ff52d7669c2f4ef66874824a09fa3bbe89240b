// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_FORMAT_HPP
#define TAO_JSON_INTERNAL_FORMAT_HPP

#include <ostream>
#include <sstream>
#include <string>
#include <typeinfo>
#include <utility>

#include "escape.hpp"

#include "../forward.hpp"
#include "../message_extension.hpp"
#include "../type.hpp"

namespace tao::json::internal
{
   inline void to_stream( std::ostream& os, const bool v )
   {
      os << ( v ? "true" : "false" );
   }

   inline void to_stream( std::ostream& os, const type t )
   {
      os << to_string( t );
   }

   template< typename T >
   void to_stream( std::ostream& os, const T& t )
   {
      os << t;
   }

   template< std::size_t N >
   void to_stream( std::ostream& os, const char ( &t )[ N ] )
   {
      os.write( t, N - 1 );
   }

   template< typename... Ts >
   void format_to( std::ostream& oss, const Ts&... ts )
   {
      ( internal::to_stream( oss, ts ), ... );
   }

   template< typename... Ts >
   [[nodiscard]] std::string format( const Ts&... ts )
   {
      std::ostringstream oss;
      format_to( oss, ts... );
      return std::move( oss ).str();
   }

}  // namespace tao::json::internal

#endif
