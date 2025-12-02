// Copyright (c) 2015-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_PEGTL_STRING_HPP
#define TAO_PEGTL_INTERNAL_PEGTL_STRING_HPP

#include <cstddef>
#include <type_traits>

#include "../ascii.hpp"
#include "../config.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   // Inspired by https://github.com/irrequietus/typestring
   // Rewritten and reduced to what is needed for the PEGTL
   // and to work with Visual Studio 2015.

   template< typename, typename, typename, typename, typename, typename, typename, typename >
   struct string_join;

   template< template< char... > class S, char... C0s, char... C1s, char... C2s, char... C3s, char... C4s, char... C5s, char... C6s, char... C7s >
   struct string_join< S< C0s... >, S< C1s... >, S< C2s... >, S< C3s... >, S< C4s... >, S< C5s... >, S< C6s... >, S< C7s... > >
   {
      using type = S< C0s..., C1s..., C2s..., C3s..., C4s..., C5s..., C6s..., C7s... >;
   };

   template< template< char... > class S, char, bool >
   struct string_at
   {
      using type = S<>;
   };

   template< template< char... > class S, char C >
   struct string_at< S, C, true >
   {
      using type = S< C >;
   };

   template< typename T, std::size_t S >
   struct string_max_length
   {
      static_assert( S <= 512, "String longer than 512 (excluding terminating \\0)!" );
      using type = T;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#define TAO_PEGTL_INTERNAL_EMPTY()
#define TAO_PEGTL_INTERNAL_DEFER( X ) X TAO_PEGTL_INTERNAL_EMPTY()
#define TAO_PEGTL_INTERNAL_EXPAND( ... ) __VA_ARGS__

#define TAO_PEGTL_INTERNAL_STRING_AT( S, x, n ) \
   TAO_PEGTL_NAMESPACE::internal::string_at< S, ( 0##n < ( sizeof( x ) / sizeof( char ) ) ) ? ( x )[ 0##n ] : 0, ( 0##n < ( sizeof( x ) / sizeof( char ) ) - 1 ) >::type

#define TAO_PEGTL_INTERNAL_JOIN_8( M, S, x, n )                                             \
   TAO_PEGTL_NAMESPACE::internal::string_join< TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##0 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##1 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##2 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##3 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##4 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##5 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##6 ), \
                                               TAO_PEGTL_INTERNAL_DEFER( M )( S, x, n##7 ) >::type

#define TAO_PEGTL_INTERNAL_STRING_8( S, x, n ) \
   TAO_PEGTL_INTERNAL_JOIN_8( TAO_PEGTL_INTERNAL_STRING_AT, S, x, n )

#define TAO_PEGTL_INTERNAL_STRING_64( S, x, n ) \
   TAO_PEGTL_INTERNAL_JOIN_8( TAO_PEGTL_INTERNAL_STRING_8, S, x, n )

#define TAO_PEGTL_INTERNAL_STRING_512( S, x, n ) \
   TAO_PEGTL_INTERNAL_JOIN_8( TAO_PEGTL_INTERNAL_STRING_64, S, x, n )

#define TAO_PEGTL_INTERNAL_STRING( S, x ) \
   TAO_PEGTL_INTERNAL_EXPAND(             \
      TAO_PEGTL_INTERNAL_EXPAND(          \
         TAO_PEGTL_INTERNAL_EXPAND(       \
            TAO_PEGTL_NAMESPACE::internal::string_max_length< TAO_PEGTL_INTERNAL_STRING_512( S, x, ), sizeof( x ) - 1 >::type ) ) )

#define TAO_PEGTL_STRING( x ) \
   TAO_PEGTL_INTERNAL_STRING( TAO_PEGTL_NAMESPACE::ascii::string, x )

#define TAO_PEGTL_ISTRING( x ) \
   TAO_PEGTL_INTERNAL_STRING( TAO_PEGTL_NAMESPACE::ascii::istring, x )

#define TAO_PEGTL_KEYWORD( x ) \
   TAO_PEGTL_INTERNAL_STRING( TAO_PEGTL_NAMESPACE::ascii::keyword, x )

#endif
