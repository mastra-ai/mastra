// This header include/tao/json/external/jeaiii.hpp contains
// modified portions of the jeaiii/itoa library from
//   https://github.com/jeaiii/itoa
// which is licensed as follows:

// Copyright (c) 2017 James Edward Anhalt III - https://github.com/jeaiii/itoa
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

#ifndef TAO_JSON_EXTERNAL_ITOA_HPP
#define TAO_JSON_EXTERNAL_ITOA_HPP

#include <cstdint>
#include <ostream>

// form a 4.32 fixed point number: t = u * 2^32 / 10^log10(u)
// use as much precision as possible when needed (log10(u) >= 5)
// so shift up then down afterwards by log10(u) * log2(10) ~= 53/16
// need to round up before and or after in some cases
// once we have the fixed point number we can read off the digit in the upper 32 bits
// and multiply the lower 32 bits by 10 to get the next digit and so on
// we can do 2 digits at a time by multiplying by 100 each time

// MISSING:
// - x64 optimized version (no need to line up on 32bit boundary, so can multiply by 5 instead of 10 using lea instruction)
// - full 64 bit LG()
// - try splitting the number into chucks that can be processed independently
// - try odd digit first
// - try writing 4 chars at a time

namespace tao::json::itoa
{
   struct pair
   {
      char t;
      char o;
   };

   // clang-format off
#define TAO_JSON_ITOA_P( T ) { T, '0' }, { T, '1' }, { T, '2' }, { T, '3' }, { T, '4' }, { T, '5' }, { T, '6' }, { T, '7' }, { T, '8' }, { T, '9' }
   // clang-format on

   constexpr inline pair s_pairs[] = { TAO_JSON_ITOA_P( '0' ),
                                       TAO_JSON_ITOA_P( '1' ),
                                       TAO_JSON_ITOA_P( '2' ),
                                       TAO_JSON_ITOA_P( '3' ),
                                       TAO_JSON_ITOA_P( '4' ),
                                       TAO_JSON_ITOA_P( '5' ),
                                       TAO_JSON_ITOA_P( '6' ),
                                       TAO_JSON_ITOA_P( '7' ),
                                       TAO_JSON_ITOA_P( '8' ),
                                       TAO_JSON_ITOA_P( '9' ) };

#define TAO_JSON_ITOA_W( N, I ) *(pair*)&b[ N ] = s_pairs[ I ]
#define TAO_JSON_ITOA_A( N ) t = ( std::uint64_t( 1 ) << ( 32 + N / 5 * N * 53 / 16 ) ) / std::uint32_t( 1e##N ) + 1 + N / 6 - N / 8, t *= u, t >>= N / 5 * N * 53 / 16, t += N / 6 * 4, TAO_JSON_ITOA_W( 0, t >> 32 )
#define TAO_JSON_ITOA_S( N ) b[ N ] = char( std::uint64_t( 10 ) * std::uint32_t( t ) >> 32 ) + '0'
#define TAO_JSON_ITOA_D( N ) t = std::uint64_t( 100 ) * std::uint32_t( t ), TAO_JSON_ITOA_W( N, t >> 32 )

#define TAO_JSON_ITOA_L0 b[ 0 ] = char( u ) + '0'
#define TAO_JSON_ITOA_L1 TAO_JSON_ITOA_W( 0, u )
#define TAO_JSON_ITOA_L2 TAO_JSON_ITOA_A( 1 ), TAO_JSON_ITOA_S( 2 )
#define TAO_JSON_ITOA_L3 TAO_JSON_ITOA_A( 2 ), TAO_JSON_ITOA_D( 2 )
#define TAO_JSON_ITOA_L4 TAO_JSON_ITOA_A( 3 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_S( 4 )
#define TAO_JSON_ITOA_L5 TAO_JSON_ITOA_A( 4 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_D( 4 )
#define TAO_JSON_ITOA_L6 TAO_JSON_ITOA_A( 5 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_D( 4 ), TAO_JSON_ITOA_S( 6 )
#define TAO_JSON_ITOA_L7 TAO_JSON_ITOA_A( 6 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_D( 4 ), TAO_JSON_ITOA_D( 6 )
#define TAO_JSON_ITOA_L8 TAO_JSON_ITOA_A( 7 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_D( 4 ), TAO_JSON_ITOA_D( 6 ), TAO_JSON_ITOA_S( 8 )
#define TAO_JSON_ITOA_L9 TAO_JSON_ITOA_A( 8 ), TAO_JSON_ITOA_D( 2 ), TAO_JSON_ITOA_D( 4 ), TAO_JSON_ITOA_D( 6 ), TAO_JSON_ITOA_D( 8 )

#define TAO_JSON_ITOA_LN( N ) ( TAO_JSON_ITOA_L##N, b += N + 1 )

   // clang-format off
#define TAO_JSON_ITOA_LG( F ) ( u < 100 ? u < 10 ? F( 0 ) : F( 1 ) : u < 1000000 ? u < 10000 ? u < 1000 ? F( 2 ) : F( 3 ) : u < 100000 ? F( 4 ) : F( 5 ) : u < 100000000 ? u < 10000000 ? F( 6 ) : F( 7 ) : u < 1000000000 ? F( 8 ) : F( 9 ) )
   // clang-format on

   inline char* u32toa( const std::uint32_t u, char* b )
   {
      std::uint64_t t;
      return TAO_JSON_ITOA_LG( TAO_JSON_ITOA_LN );
   }

   inline char* i32toa( const std::int32_t i, char* b )
   {
      const std::uint32_t u = i < 0 ? ( *b++ = '-', 0 - std::uint32_t( i ) ) : i;
      std::uint64_t t;
      return TAO_JSON_ITOA_LG( TAO_JSON_ITOA_LN );
   }

   inline char* u64toa( const std::uint64_t n, char* b )
   {
      std::uint32_t u;
      std::uint64_t t;

      if( std::uint32_t( n >> 32 ) == 0 ) {
         return u = std::uint32_t( n ), TAO_JSON_ITOA_LG( TAO_JSON_ITOA_LN );
      }
      std::uint64_t a = n / 100000000;

      if( std::uint32_t( a >> 32 ) == 0 ) {
         u = std::uint32_t( a );
         TAO_JSON_ITOA_LG( TAO_JSON_ITOA_LN );
      }
      else {
         u = std::uint32_t( a / 100000000 );
         TAO_JSON_ITOA_LG( TAO_JSON_ITOA_LN );
         u = a % 100000000;
         TAO_JSON_ITOA_LN( 7 );
      }
      u = n % 100000000;
      return TAO_JSON_ITOA_LN( 7 );
   }

   inline char* i64toa( const std::int64_t i, char* b )
   {
      const std::uint64_t n = i < 0 ? ( *b++ = '-', 0 - std::uint64_t( i ) ) : i;
      return u64toa( n, b );
   }

   inline void i64tos( std::ostream& o, const std::int64_t i )
   {
      char b[ 24 ];
      const auto* s = i64toa( i, b );
      o.write( b, s - b );
   }

   inline void u64tos( std::ostream& o, const std::uint64_t i )
   {
      char b[ 24 ];
      const auto* s = u64toa( i, b );
      o.write( b, s - b );
   }

}  // namespace tao::json::itoa

#endif
