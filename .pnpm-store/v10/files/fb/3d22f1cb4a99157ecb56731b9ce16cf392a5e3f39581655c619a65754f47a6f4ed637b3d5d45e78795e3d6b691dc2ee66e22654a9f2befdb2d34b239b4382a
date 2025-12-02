// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINARY_HPP
#define TAO_JSON_BINARY_HPP

#include <cstddef>
#include <vector>

#include "internal/dependent_false.hpp"

namespace tao
{
   using binary = std::vector< std::byte >;

}  // namespace tao

namespace tao::json
{
   namespace internal
   {
      [[nodiscard]] constexpr char unhex_char( const char c ) noexcept
      {
         return static_cast< char >( ( c < 'A' ) ? ( c - '0' ) : ( ( c < 'a' ) ? ( c - 'A' + 10 ) : ( c - 'a' + 10 ) ) );
      }

      template< typename V, V... >
      struct vlist;

      template< typename T, typename L, char... Cs >
      struct unhex_helper;

      template< typename T, typename V, V... Vs >
      struct unhex_helper< T, vlist< V, Vs... > >
      {
         [[nodiscard]] static constexpr T unhex()
         {
            return T{ Vs... };
         }
      };

      template< typename T, typename V, V... Vs, char C >
      struct unhex_helper< T, vlist< V, Vs... >, C >
         : unhex_helper< T, vlist< V > >
      {
         static_assert( internal::dependent_false< T >, "digits must occur in pairs" );
      };

      template< typename T, typename V, V... Vs, char C1, char... Cs >
      struct unhex_helper< T, vlist< V, Vs... >, '\'', C1, Cs... >
         : unhex_helper< T, vlist< V, Vs... >, C1, Cs... >
      {
      };

      template< typename T, typename V, V... Vs, char C0, char... Cs >
      struct unhex_helper< T, vlist< V, Vs... >, C0, '\'', Cs... >
         : unhex_helper< T, vlist< V > >
      {
         static_assert( internal::dependent_false< T >, "digit separator only allowed between pairs of digits" );
      };

      template< typename T, typename V, V... Vs, char C0, char C1, char... Cs >
      struct unhex_helper< T, vlist< V, Vs... >, C0, C1, Cs... >
         : unhex_helper< T, vlist< V, Vs..., V( ( unhex_char( C0 ) << 4 ) + unhex_char( C1 ) ) >, Cs... >
      {
      };

      template< typename T, typename V, char C >
      [[nodiscard]] constexpr T unhex()
      {
         static_assert( internal::dependent_false< T >, "not a hex literal" );
         return T{};
      }

      template< typename T, typename V, char C0, char C1, char... Cs >
      [[nodiscard]] constexpr T unhex()
      {
         static_assert( C0 == '0', "not a hex literal" );
         static_assert( C1 == 'x' || C1 == 'X', "not a hex literal" );
         return unhex_helper< T, vlist< V >, Cs... >::unhex();
      }

      template< typename T, char... Cs >
      [[nodiscard]] constexpr T unhex()
      {
         return unhex< T, typename T::value_type, Cs... >();
      }

   }  // namespace internal

   inline namespace literals
   {
      template< char... Cs >
      [[nodiscard]] std::vector< std::byte > operator"" _binary()
      {
         return internal::unhex< std::vector< std::byte >, Cs... >();
      }

   }  // namespace literals

}  // namespace tao::json

#endif
