// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTERNAL_ENDIAN_GCC_HPP
#define TAO_PEGTL_CONTRIB_INTERNAL_ENDIAN_GCC_HPP

#include <cstdint>
#include <cstring>

namespace TAO_PEGTL_NAMESPACE::internal
{
#if !defined( __BYTE_ORDER__ )
#error No byte order defined!
#elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__

   template< std::size_t S >
   struct to_and_from_be
   {
      template< typename T >
      [[nodiscard]] static T convert( const T n ) noexcept
      {
         return n;
      }
   };

   template< std::size_t S >
   struct to_and_from_le;

   template<>
   struct to_and_from_le< 1 >
   {
      [[nodiscard]] static std::uint8_t convert( const std::uint8_t n ) noexcept
      {
         return n;
      }

      [[nodiscard]] static std::int8_t convert( const std::int8_t n ) noexcept
      {
         return n;
      }
   };

   template<>
   struct to_and_from_le< 2 >
   {
      [[nodiscard]] static std::int16_t convert( const std::int16_t n ) noexcept
      {
         return static_cast< std::int16_t >( __builtin_bswap16( static_cast< std::uint16_t >( n ) ) );
      }

      [[nodiscard]] static std::uint16_t convert( const std::uint16_t n ) noexcept
      {
         return __builtin_bswap16( n );
      }
   };

   template<>
   struct to_and_from_le< 4 >
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
         return static_cast< std::int32_t >( __builtin_bswap32( static_cast< std::uint32_t >( n ) ) );
      }

      [[nodiscard]] static std::uint32_t convert( const std::uint32_t n ) noexcept
      {
         return __builtin_bswap32( n );
      }
   };

   template<>
   struct to_and_from_le< 8 >
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
         return static_cast< std::int64_t >( __builtin_bswap64( static_cast< std::uint64_t >( n ) ) );
      }

      [[nodiscard]] static std::uint64_t convert( const std::uint64_t n ) noexcept
      {
         return __builtin_bswap64( n );
      }
   };

#elif __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__

   template< std::size_t S >
   struct to_and_from_le
   {
      template< typename T >
      [[nodiscard]] static T convert( const T n ) noexcept
      {
         return n;
      }
   };

   template< std::size_t S >
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
         return static_cast< std::int16_t >( __builtin_bswap16( static_cast< std::uint16_t >( n ) ) );
      }

      [[nodiscard]] static std::uint16_t convert( const std::uint16_t n ) noexcept
      {
         return __builtin_bswap16( n );
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
         return static_cast< std::int32_t >( __builtin_bswap32( static_cast< std::uint32_t >( n ) ) );
      }

      [[nodiscard]] static std::uint32_t convert( const std::uint32_t n ) noexcept
      {
         return __builtin_bswap32( n );
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
         return static_cast< std::int64_t >( __builtin_bswap64( static_cast< std::uint64_t >( n ) ) );
      }

      [[nodiscard]] static std::uint64_t convert( const std::uint64_t n ) noexcept
      {
         return __builtin_bswap64( n );
      }
   };

#else
#error Unknown host byte order!
#endif

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
