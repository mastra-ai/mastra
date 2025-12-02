// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_IDENTITY_HPP
#define TAO_JSON_INTERNAL_IDENTITY_HPP

#include <type_traits>

namespace tao::internal
{
   template< typename T >
   struct identity
   {
      using type = T;
   };

   template< typename T >
   using identity_t = typename identity< T >::type;

}  // namespace tao::internal

#endif
