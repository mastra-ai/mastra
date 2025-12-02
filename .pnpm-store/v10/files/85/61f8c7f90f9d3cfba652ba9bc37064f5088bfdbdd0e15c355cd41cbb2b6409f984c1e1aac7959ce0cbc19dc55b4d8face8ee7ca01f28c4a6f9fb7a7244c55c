// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_TO_STRING_HPP
#define TAO_PEGTL_CONTRIB_TO_STRING_HPP

#include <string>

#include "../config.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename >
      struct to_string;

      template< template< char... > class X, char... Cs >
      struct to_string< X< Cs... > >
      {
         [[nodiscard]] static std::string get()
         {
            const char s[] = { Cs..., 0 };
            return std::string( s, sizeof...( Cs ) );
         }
      };

   }  // namespace internal

   template< typename T >
   [[nodiscard]] std::string to_string()
   {
      return internal::to_string< T >::get();
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
