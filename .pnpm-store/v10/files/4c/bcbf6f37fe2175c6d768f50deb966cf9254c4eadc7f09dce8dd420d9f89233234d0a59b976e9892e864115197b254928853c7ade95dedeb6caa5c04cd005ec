// Copyright (c) 2015-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_STREAM_HPP
#define TAO_JSON_STREAM_HPP

#include <iomanip>
#include <iosfwd>
#include <stdexcept>

#include "to_stream.hpp"
#include "value.hpp"

#include "internal/format.hpp"

namespace tao::json
{
   // Use ostream << std::setw( n ) for pretty-printing with indent n.

   template< template< typename... > class Traits >
   std::ostream& operator<<( std::ostream& o, const basic_value< Traits >& v )
   {
      const auto w = o.width( 0 );
      if( w > 0 ) {
         if( w >= 256 ) {
            throw std::runtime_error( internal::format( "indentation ", w, " larger than 255" ) );
         }
         json::to_stream( o, v, static_cast< std::size_t >( w ) );
      }
      else {
         json::to_stream( o, v );
      }
      return o;
   }

}  // namespace tao::json

#endif
