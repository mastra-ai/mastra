// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_NUMBER_STATE_HPP
#define TAO_JSON_INTERNAL_NUMBER_STATE_HPP

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <stdexcept>
#include <utility>

#include "../external/double.hpp"

namespace tao::json::internal
{
   constexpr inline std::size_t max_mantissa_digits = 772;

   template< bool NEG >
   struct number_state
   {
      using exponent10_t = std::int32_t;
      using msize_t = std::uint16_t;

      number_state() = default;

      number_state( const number_state& ) = delete;
      number_state( number_state&& ) = delete;

      ~number_state() = default;

      void operator=( const number_state& ) = delete;
      void operator=( number_state&& ) = delete;

      exponent10_t exponent10 = 0;
      msize_t msize = 0;  // Excluding sign.
      bool isfp = false;
      bool eneg = false;
      bool drop = false;
      char mantissa[ max_mantissa_digits + 1 ];

      template< typename Consumer, typename... Arguments >
      void success( Consumer& consumer, Arguments&&... as )
      {
         if( !isfp && msize <= 20 ) {
            mantissa[ msize ] = 0;
            char* p;
            errno = 0;
            const std::uint64_t ull = std::strtoull( mantissa, &p, 10 );
            if( ( errno != ERANGE ) && ( p == mantissa + msize ) ) {
               if constexpr( NEG ) {
                  if( ull < 9223372036854775808ULL ) {
                     consumer.number( -static_cast< std::int64_t >( ull ), std::forward< Arguments >( as )... );
                     return;
                  }
                  if( ull == 9223372036854775808ULL ) {
                     consumer.number( static_cast< std::int64_t >( -9223372036854775807LL - 1 ), std::forward< Arguments >( as )... );
                     return;
                  }
               }
               else {
                  consumer.number( ull, std::forward< Arguments >( as )... );
                  return;
               }
            }
         }
         if( drop ) {
            mantissa[ msize++ ] = '1';
            --exponent10;
         }
         const auto d = double_conversion::Strtod( double_conversion::Vector< const char >( mantissa, msize ), exponent10 );
         if( !std::isfinite( d ) ) {
            throw std::runtime_error( "invalid double value" );
         }
         consumer.number( NEG ? -d : d, std::forward< Arguments >( as )... );
      }
   };

}  // namespace tao::json::internal

#endif
