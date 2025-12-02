// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_UBJSON_EVENTS_TO_STREAM_HPP
#define TAO_JSON_UBJSON_EVENTS_TO_STREAM_HPP

#include <cmath>
#include <cstdint>
#include <ostream>
#include <string>
#include <string_view>

#include "../../binary_view.hpp"

#include "../../internal/endian.hpp"

namespace tao::json::ubjson::events
{
   class to_stream
   {
   private:
      std::ostream& os;

   public:
      explicit to_stream( std::ostream& in_os ) noexcept
         : os( in_os )
      {}

      void null()
      {
         os.put( 'Z' );
      }

      void boolean( const bool v )
      {
         os.put( v ? 'T' : 'F' );
      }

      void number( const std::int64_t v )
      {
         if( ( v >= -128 ) && ( v <= 127 ) ) {
            os.put( 'i' );
            const auto x = static_cast< std::int8_t >( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( ( v >= -32768 ) && ( v <= 32767 ) ) {
            os.put( 'I' );
            const std::uint16_t x = json::internal::h_to_be( static_cast< std::uint16_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( ( v >= -2147483648LL ) && ( v <= 2147483647LL ) ) {
            os.put( 'l' );
            const std::uint32_t x = json::internal::h_to_be( static_cast< std::uint32_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else {
            os.put( 'L' );
            const std::uint64_t x = json::internal::h_to_be( static_cast< std::uint64_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
      }

      void number( const std::uint64_t v )
      {
         if( v <= 255 ) {
            os.put( 'U' );
            const auto x = static_cast< std::uint8_t >( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( v <= 32767 ) {
            os.put( 'I' );
            const std::uint16_t x = json::internal::h_to_be( static_cast< std::uint16_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( v <= 2147483647UL ) {
            os.put( 'l' );
            const std::uint32_t x = json::internal::h_to_be( static_cast< std::uint32_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( v <= 9223372036854775807ULL ) {
            os.put( 'L' );
            const std::uint64_t x = json::internal::h_to_be( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else {
            os.put( 'H' );
            os.put( 'U' );
            os.put( static_cast< char >( ( v >= 10000000000000000000ULL ) ? 20 : 19 ) );
            os << v;
         }
      }

      void number( const double v )
      {
         os.put( 'D' );
         const double x = json::internal::h_to_be( v );
         os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
      }

      void string( const std::string_view v )
      {
         if( ( v.size() == 1 ) && ( ( v[ 0 ] & 0x80 ) == 0 ) ) {
            os.put( 'C' );
            os.put( v[ 0 ] );
         }
         else {
            os.put( 'S' );
            number( static_cast< std::uint64_t >( v.size() ) );
            os.write( v.data(), static_cast< std::streamsize >( v.size() ) );
         }
      }

      void binary( const tao::binary_view v )
      {
         // NOTE: UBJSON encodes binary data as 'strongly typed array of uint8 values'.
         os.write( "[$U#", 4 );
         number( static_cast< std::uint64_t >( v.size() ) );
         os.write( reinterpret_cast< const char* >( v.data() ), static_cast< std::streamsize >( v.size() ) );
      }

      void begin_array()
      {
         os.put( '[' );
      }

      void begin_array( const std::size_t size )
      {
         os.write( "[#", 2 );
         number( static_cast< std::uint64_t >( size ) );
      }

      void element() noexcept
      {}

      void end_array()
      {
         os.put( ']' );
      }

      void end_array( const std::size_t /*unused*/ ) noexcept
      {}

      void begin_object()
      {
         os.put( '{' );
      }

      void begin_object( const std::size_t size )
      {
         os.write( "{#", 2 );
         number( static_cast< std::uint64_t >( size ) );
      }

      void key( const std::string_view v )
      {
         number( static_cast< std::uint64_t >( v.size() ) );
         os.write( v.data(), static_cast< std::streamsize >( v.size() ) );
      }

      void member() noexcept
      {}

      void end_object()
      {
         os.put( '}' );
      }

      void end_object( const std::size_t /*unused*/ ) noexcept
      {}
   };

}  // namespace tao::json::ubjson::events

#endif
