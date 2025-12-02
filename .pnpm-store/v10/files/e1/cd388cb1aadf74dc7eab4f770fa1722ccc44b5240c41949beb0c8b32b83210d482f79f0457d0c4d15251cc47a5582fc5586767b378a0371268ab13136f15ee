// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_MSGPACK_EVENTS_TO_STREAM_HPP
#define TAO_JSON_MSGPACK_EVENTS_TO_STREAM_HPP

#include <cassert>
#include <cmath>
#include <cstdint>
#include <ostream>
#include <stdexcept>
#include <string>
#include <string_view>

#include "../../binary_view.hpp"

#include "../../internal/endian.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4310 )
#endif

namespace tao::json::msgpack::events
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
         os.put( static_cast< char >( 0xc0 ) );
      }

      void boolean( const bool v )
      {
         os.put( static_cast< char >( v ? 0xc3 : 0xc2 ) );
      }

      template< typename Integer >
      void number_impl( const unsigned char tag, const std::uint64_t v )
      {
         os.put( static_cast< char >( tag ) );
         const Integer x = json::internal::h_to_be( static_cast< Integer >( v ) );
         os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
      }

      void number( const std::int64_t v )
      {
         if( ( v >= -32 ) && ( v <= -1 ) ) {
            const auto x = static_cast< std::int8_t >( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( ( v >= -128 ) && ( v <= 127 ) ) {
            number_impl< std::uint8_t >( 0xd0, v );
         }
         else if( ( v >= -32768 ) && ( v <= 32767 ) ) {
            number_impl< std::uint16_t >( 0xd1, v );
         }
         else if( ( v >= -2147483648LL ) && ( v <= 2147483647 ) ) {
            number_impl< std::uint32_t >( 0xd2, v );
         }
         else {
            number_impl< std::uint64_t >( 0xd3, v );
         }
      }

      void number( const std::uint64_t v )
      {
         if( v <= 127 ) {
            const auto x = static_cast< std::int8_t >( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( v <= 255 ) {
            number_impl< std::uint8_t >( 0xcc, v );
         }
         else if( v <= 65535 ) {
            number_impl< std::uint16_t >( 0xcd, v );
         }
         else if( v <= 4294967295UL ) {
            number_impl< std::uint32_t >( 0xce, v );
         }
         else {
            number_impl< std::uint64_t >( 0xcf, v );
         }
      }

      void number( const double v )
      {
         os.put( static_cast< char >( 0xcb ) );
         const auto x = json::internal::h_to_be( v );
         os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
      }

      void string( const std::string_view v )
      {
         if( v.size() <= 31 ) {
            os.put( static_cast< char >( v.size() + 0xa0 ) );
         }
         else if( v.size() <= 255 ) {
            number_impl< std::uint8_t >( 0xd9, v.size() );
         }
         else if( v.size() <= 65535 ) {
            number_impl< std::uint16_t >( 0xda, v.size() );
         }
         else if( v.size() <= 4294967295UL ) {
            number_impl< std::uint32_t >( 0xdb, v.size() );
         }
         else {
            throw std::runtime_error( "string too long for msgpack" );
         }
         os.write( v.data(), static_cast< std::streamsize >( v.size() ) );
      }

      void binary( const tao::binary_view v )
      {
         if( v.size() <= 255 ) {
            number_impl< std::uint8_t >( 0xc4, v.size() );
         }
         else if( v.size() <= 65535 ) {
            number_impl< std::uint16_t >( 0xc5, v.size() );
         }
         else if( v.size() <= 4294967295UL ) {
            number_impl< std::uint32_t >( 0xc6, v.size() );
         }
         else {
            throw std::runtime_error( "binary too long for msgpack" );
         }
         os.write( reinterpret_cast< const char* >( v.data() ), static_cast< std::streamsize >( v.size() ) );
      }

      void begin_array()  // NOLINT(readability-convert-member-functions-to-static)
      {
         throw std::runtime_error( "msgpack requires array size" );
      }

      void begin_array( const std::size_t size )
      {
         if( size <= 15 ) {
            os.put( static_cast< char >( 0x90 + size ) );
         }
         else if( size <= 65535 ) {
            number_impl< std::uint16_t >( 0xdc, size );
         }
         else if( size <= 4294967295UL ) {
            number_impl< std::uint32_t >( 0xdd, size );
         }
         else {
            throw std::runtime_error( "array too large for msgpack" );
         }
      }

      void element() noexcept
      {}

      void end_array()     // NOLINT(readability-convert-member-functions-to-static)
      {
         assert( false );  // LCOV_EXCL_LINE
      }

      void end_array( const std::size_t /*unused*/ ) noexcept
      {}

      void begin_object()  // NOLINT(readability-convert-member-functions-to-static)
      {
         throw std::runtime_error( "msgpack requires object size" );
      }

      void begin_object( const std::size_t size )
      {
         if( size <= 15 ) {
            os.put( static_cast< char >( 0x80 + size ) );
         }
         else if( size <= 65535 ) {
            number_impl< std::uint16_t >( 0xde, size );
         }
         else if( size <= 4294967295UL ) {
            number_impl< std::uint32_t >( 0xdf, size );
         }
         else {
            throw std::runtime_error( "array too large for msgpack" );
         }
      }

      void key( const std::string_view v )
      {
         string( v );
      }

      void member() noexcept
      {}

      void end_object()    // NOLINT(readability-convert-member-functions-to-static)
      {
         assert( false );  // LCOV_EXCL_LINE
      }

      void end_object( const std::size_t /*unused*/ ) noexcept
      {}
   };

}  // namespace tao::json::msgpack::events

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
