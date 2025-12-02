// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_ENDIAN_WIN_HPP
#define TAO_JSON_INTERNAL_ENDIAN_WIN_HPP

#include <cstdint>
#include <cstring>

#include <stdlib.h>  // TODO: Or is intrin.h the 'more correct' header for the _byteswap_foo() functions?

namespace tao::json::internal
{
   template< unsigned S >
   struct to_and_from_le
   {
      template< typename T >
      [[nodiscard]] static T convert( const T t ) noexcept
      {
         return t;
      }
   };

   template< unsigned S >
   struct to_and_from_be;

   template<>
   struct to_and_from_be< 1 >
   {
      [[nodiscard]] static std::int8_t convert( const std::int8_t n ) noexcept
      {
         return n;
      }

      [[nodiscard]] static std::uint8_t convert( const std::uint8_t n ) noexcept
      {
         return n;
      }
   };

   template<>
   struct to_and_from_be< 2 >
   {
      [[nodiscard]] static std::int16_t convert( const std::int16_t n ) noexcept
      {
         return std::int16_t( _byteswap_ushort( std::uint16_t( n ) ) );
      }

      [[nodiscard]] static std::uint16_t convert( const std::uint16_t n ) noexcept
      {
         return _byteswap_ushort( n );
      }
   };

   template<>
   struct to_and_from_be< 4 >
   {
      [[nodiscard]] static float convert( float n ) noexcept
      {
         std::uint32_t u;
         std::memcpy( &u, &n, 4 );
         u = convert( u );
         std::memcpy( &n, &u, 4 );
         return n;
      }

      [[nodiscard]] static std::int32_t convert( const std::int32_t n ) noexcept
      {
         return std::int32_t( _byteswap_ulong( std::uint32_t( n ) ) );
      }

      [[nodiscard]] static std::uint32_t convert( const std::uint32_t n ) noexcept
      {
         return _byteswap_ulong( n );
      }
   };

   template<>
   struct to_and_from_be< 8 >
   {
      [[nodiscard]] static double convert( double n ) noexcept
      {
         std::uint64_t u;
         std::memcpy( &u, &n, 8 );
         u = convert( u );
         std::memcpy( &n, &u, 8 );
         return n;
      }

      [[nodiscard]] static std::int64_t convert( const std::int64_t n ) noexcept
      {
         return std::int64_t( _byteswap_uint64( std::uint64_t( n ) ) );
      }

      [[nodiscard]] static std::uint64_t convert( const std::uint64_t n ) noexcept
      {
         return _byteswap_uint64( n );
      }
   };

}  // namespace tao::json::internal

#endif
