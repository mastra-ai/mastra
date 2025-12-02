// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_SHA256_HPP
#define TAO_JSON_INTERNAL_SHA256_HPP

// Implements RFC 6234, SHA-256

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>

// RFC 6234, 3.d; see also http://stackoverflow.com/a/4209604/2073257
#define ROR( x, N ) ( ( ( x ) >> ( N ) ) | ( ( x ) << ( 32 - ( N ) ) ) )

// RFC 6234, 5.1
#define CH( x, y, z ) ( ( ( x ) & ( y ) ) ^ ( ~( x ) & ( z ) ) )
#define MAJ( x, y, z ) ( ( ( x ) & ( y ) ) ^ ( ( x ) & ( z ) ) ^ ( ( y ) & ( z ) ) )
#define BSIG0( x ) ( ROR( x, 2 ) ^ ROR( x, 13 ) ^ ROR( x, 22 ) )
#define BSIG1( x ) ( ROR( x, 6 ) ^ ROR( x, 11 ) ^ ROR( x, 25 ) )
#define SSIG0( x ) ( ROR( x, 7 ) ^ ROR( x, 18 ) ^ ( ( x ) >> 3 ) )
#define SSIG1( x ) ( ROR( x, 17 ) ^ ROR( x, 19 ) ^ ( ( x ) >> 10 ) )

namespace tao::json::internal
{
   // RFC 6234, 5.1
   // clang-format off
   static std::uint32_t K[ 64 ] = {  // NOLINT(readability-identifier-naming)
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
   };
   // clang-format on

   class sha256
   {
   private:
      unsigned char M[ 64 ];  // NOLINT(readability-identifier-naming)
      std::uint64_t size;

      std::uint32_t H[ 8 ];  // NOLINT(readability-identifier-naming)

      // RFC 6234, 6.2
      void process() noexcept
      {
         std::uint32_t W[ 64 ];  // NOLINT(readability-identifier-naming)

         // step 1
         for( std::size_t t = 0, i = 0; t != 16; ++t, i += 4 ) {
            W[ t ] = ( M[ i ] << 24 ) | ( M[ i + 1 ] << 16 ) | ( M[ i + 2 ] << 8 ) | ( M[ i + 3 ] );
         }
         for( std::size_t t = 16; t != 64; ++t ) {
            W[ t ] = SSIG1( W[ t - 2 ] ) + W[ t - 7 ] + SSIG0( W[ t - 15 ] ) + W[ t - 16 ];
         }

         // step 2
         std::uint32_t a, b, c, d, e, f, g, h;  // NOLINT(readability-isolate-declaration)
         a = H[ 0 ];
         b = H[ 1 ];
         c = H[ 2 ];
         d = H[ 3 ];
         e = H[ 4 ];
         f = H[ 5 ];
         g = H[ 6 ];
         h = H[ 7 ];

         // step 3
         for( std::size_t t = 0; t != 64; ++t ) {
            const std::uint32_t T1 = h + BSIG1( e ) + CH( e, f, g ) + K[ t ] + W[ t ];  // NOLINT(readability-identifier-naming)
            const std::uint32_t T2 = BSIG0( a ) + MAJ( a, b, c );                       // NOLINT(readability-identifier-naming)
            h = g;
            g = f;
            f = e;
            e = d + T1;
            d = c;
            c = b;
            b = a;
            a = T1 + T2;
         }

         // step 4
         H[ 0 ] += a;
         H[ 1 ] += b;
         H[ 2 ] += c;
         H[ 3 ] += d;
         H[ 4 ] += e;
         H[ 5 ] += f;
         H[ 6 ] += g;
         H[ 7 ] += h;
      }

   public:
      sha256() noexcept
      {
         reset();
      }

      sha256( const sha256& ) = delete;
      sha256( sha256&& ) = delete;

      ~sha256() = default;

      void operator=( const sha256& ) = delete;
      void operator=( sha256&& ) = delete;

      void reset() noexcept
      {
         size = 0;

         // RFC 6234, 6.1
         H[ 0 ] = 0x6a09e667;
         H[ 1 ] = 0xbb67ae85;
         H[ 2 ] = 0x3c6ef372;
         H[ 3 ] = 0xa54ff53a;
         H[ 4 ] = 0x510e527f;
         H[ 5 ] = 0x9b05688c;
         H[ 6 ] = 0x1f83d9ab;
         H[ 7 ] = 0x5be0cd19;
      }

      void feed( const unsigned char c ) noexcept
      {
         M[ size++ % 64 ] = c;
         if( ( size % 64 ) == 0 ) {
            process();
         }
      }

      void feed( const void* p, std::size_t s ) noexcept
      {
         const auto* q = static_cast< const unsigned char* >( p );
         while( s != 0 ) {
            feed( *q++ );
            --s;
         }
      }

      void feed( const std::string_view v ) noexcept
      {
         feed( v.data(), v.size() );
      }

      // RFC 6234, 4.1
      void store_unsafe( unsigned char* buffer ) noexcept
      {
         std::size_t i = size % 64;
         if( i < 56 ) {
            M[ i++ ] = 0x80;
#if defined( __GNUC__ ) && ( __GNUC__ >= 9 )
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Waggressive-loop-optimizations"
#endif
            while( i < 56 ) {
               M[ i++ ] = 0x00;
            }
#if defined( __GNUC__ ) && ( __GNUC__ >= 9 )
#pragma GCC diagnostic pop
#endif
         }
         else {
            M[ i++ ] = 0x80;
            while( i < 64 ) {
               M[ i++ ] = 0x00;
            }
            process();
            std::memset( M, 0, 56 );
         }

         size *= 8;

         M[ 63 ] = static_cast< unsigned char >( size );
         M[ 62 ] = static_cast< unsigned char >( size >> 8 );
         M[ 61 ] = static_cast< unsigned char >( size >> 16 );
         M[ 60 ] = static_cast< unsigned char >( size >> 24 );
         M[ 59 ] = static_cast< unsigned char >( size >> 32 );
         M[ 58 ] = static_cast< unsigned char >( size >> 40 );
         M[ 57 ] = static_cast< unsigned char >( size >> 48 );
         M[ 56 ] = static_cast< unsigned char >( size >> 56 );

         process();

         for( std::size_t j = 0; j < 4; ++j ) {
            buffer[ j ] = ( H[ 0 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 4 ] = ( H[ 1 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 8 ] = ( H[ 2 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 12 ] = ( H[ 3 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 16 ] = ( H[ 4 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 20 ] = ( H[ 5 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 24 ] = ( H[ 6 ] >> ( 24 - j * 8 ) ) & 0xff;
            buffer[ j + 28 ] = ( H[ 7 ] >> ( 24 - j * 8 ) ) & 0xff;
         }
      }

      [[nodiscard]] std::string get()
      {
         std::string result( 32, '\0' );
         store_unsafe( reinterpret_cast< unsigned char* >( result.data() ) );
         return result;
      }
   };

}  // namespace tao::json::internal

#endif
