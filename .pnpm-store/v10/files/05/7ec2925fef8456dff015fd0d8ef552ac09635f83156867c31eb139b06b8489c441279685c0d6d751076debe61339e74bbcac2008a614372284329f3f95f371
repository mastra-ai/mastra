// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_DEBUG_HPP
#define TAO_JSON_EVENTS_DEBUG_HPP

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <ostream>
#include <string>

#include "../binary_view.hpp"

#include "../external/ryu.hpp"

#include "../internal/escape.hpp"
#include "../internal/hexdump.hpp"

namespace tao::json::events
{
   // Events consumer that writes the events to a stream for debug purposes.

   class debug
   {
   private:
      std::ostream& os;

   public:
      explicit debug( std::ostream& in_os ) noexcept
         : os( in_os )
      {}

      void null()
      {
         os << "null\n";
      }

      void boolean( const bool v )
      {
         if( v ) {
            os << "boolean: true\n";
         }
         else {
            os << "boolean: false\n";
         }
      }

      void number( const std::int64_t v )
      {
         os << "std::int64_t: " << v << '\n';
      }

      void number( const std::uint64_t v )
      {
         os << "std::uint64_t: " << v << '\n';
      }

      void number( const double v )
      {
         os << "double: ";
         if( !std::isfinite( v ) ) {
            os << v;
         }
         else {
            ryu::d2s_stream( os, v );
         }
         os << '\n';
      }

      void string( const std::string_view v )
      {
         os << "string: \"";
         internal::escape( os, v );
         os << "\"\n";
      }

      void binary( const tao::binary_view v )
      {
         os << "binary: ";
         internal::hexdump( os, v );
         os << '\n';
      }

      void begin_array()
      {
         os << "begin array\n";
      }

      void begin_array( const std::size_t size )
      {
         os << "begin array " << size << '\n';
      }

      void element()
      {
         os << "element\n";
      }

      void end_array()
      {
         os << "end array\n";
      }

      void end_array( const std::size_t size )
      {
         os << "end array " << size << '\n';
      }

      void begin_object()
      {
         os << "begin object\n";
      }

      void begin_object( const std::size_t size )
      {
         os << "begin object " << size << '\n';
      }

      void key( const std::string_view v )
      {
         os << "key: \"";
         internal::escape( os, v );
         os << "\"\n";
      }

      void member()
      {
         os << "member\n";
      }

      void end_object()
      {
         os << "end object\n";
      }

      void end_object( const std::size_t size )
      {
         os << "end object " << size << '\n';
      }
   };

}  // namespace tao::json::events

#endif
