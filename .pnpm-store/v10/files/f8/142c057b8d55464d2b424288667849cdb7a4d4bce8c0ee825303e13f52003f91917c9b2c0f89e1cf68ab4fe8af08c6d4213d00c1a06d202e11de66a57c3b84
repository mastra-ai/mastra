// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CBOR_EVENTS_TO_STREAM_HPP
#define TAO_JSON_CBOR_EVENTS_TO_STREAM_HPP

#include <cstdint>
#include <ostream>
#include <string>
#include <string_view>

#include "../internal/major.hpp"

#include "../../binary_view.hpp"

#include "../../internal/endian.hpp"

#if defined( _MSC_VER )
#pragma warning( push )
#pragma warning( disable : 4310 )
#endif

namespace tao::json::cbor::events
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
         os.put( static_cast< char >( static_cast< std::uint8_t >( internal::major::OTHER ) + 22 ) );
      }

      void boolean( const bool v )
      {
         os.put( static_cast< char >( static_cast< std::uint8_t >( internal::major::OTHER ) + 20 + static_cast< std::uint8_t >( v ) ) );
      }

      void number( const internal::major m, const std::uint64_t v )
      {
         if( v < 24 ) {
            os.put( static_cast< char >( static_cast< std::uint8_t >( m ) + v ) );
         }
         else if( v < 256 ) {
            os.put( static_cast< char >( static_cast< std::uint8_t >( m ) + 24 ) );
            os.put( static_cast< char >( v ) );
         }
         else if( v < 65536 ) {
            os.put( static_cast< char >( static_cast< std::uint8_t >( m ) + 25 ) );
            const std::uint16_t x = json::internal::h_to_be( static_cast< std::uint16_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else if( v < 4294967296ULL ) {
            os.put( static_cast< char >( static_cast< std::uint8_t >( m ) + 26 ) );
            const std::uint32_t x = json::internal::h_to_be( static_cast< std::uint32_t >( v ) );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
         else {
            os.put( static_cast< char >( static_cast< std::uint8_t >( m ) + 27 ) );
            const std::uint64_t x = json::internal::h_to_be( v );
            os.write( reinterpret_cast< const char* >( &x ), sizeof( x ) );
         }
      }

      void number( const std::int64_t v )
      {
         if( v >= 0 ) {
            number( internal::major::UNSIGNED, v );
         }
         else {
            number( internal::major::NEGATIVE, -( v + 1 ) );
         }
      }

      void number( const std::uint64_t v )
      {
         number( internal::major::UNSIGNED, v );
      }

      void number( const double v )
      {
         std::uint64_t n;
         std::memcpy( &n, &v, sizeof( n ) );
         n = json::internal::h_to_be( n );
         os.put( static_cast< char >( static_cast< std::uint8_t >( internal::major::OTHER ) + 27 ) );
         os.write( reinterpret_cast< const char* >( &n ), sizeof( n ) );
      }

      void string( const std::string_view v )
      {
         number( internal::major::STRING, v.size() );
         os.write( v.data(), static_cast< std::streamsize >( v.size() ) );
      }

      void binary( const tao::binary_view v )
      {
         number( internal::major::BINARY, v.size() );
         os.write( reinterpret_cast< const char* >( v.data() ), static_cast< std::streamsize >( v.size() ) );
      }

      void begin_array()
      {
         os.put( static_cast< char >( static_cast< std::uint8_t >( internal::major::ARRAY ) + internal::minor_mask ) );
      }

      void begin_array( const std::size_t size )
      {
         number( internal::major::ARRAY, size );
      }

      void element() noexcept
      {}

      void end_array()
      {
         os.put( static_cast< char >( 0xff ) );
      }

      void end_array( const std::size_t /*unused*/ ) noexcept
      {}

      void begin_object()
      {
         os.put( static_cast< char >( static_cast< std::uint8_t >( internal::major::OBJECT ) + internal::minor_mask ) );
      }

      void begin_object( const std::size_t size )
      {
         number( internal::major::OBJECT, size );
      }

      void key( const std::string_view v )
      {
         string( v );
      }

      void member() noexcept
      {}

      void end_object()
      {
         os.put( static_cast< char >( 0xff ) );
      }

      void end_object( const std::size_t /*unused*/ ) noexcept
      {}
   };

}  // namespace tao::json::cbor::events

#if defined( _MSC_VER )
#pragma warning( pop )
#endif

#endif
