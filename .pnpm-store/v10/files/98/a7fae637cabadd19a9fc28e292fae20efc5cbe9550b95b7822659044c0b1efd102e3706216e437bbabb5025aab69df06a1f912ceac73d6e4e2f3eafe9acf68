// Copyright (c) 2021-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_ELEMENT2_HPP
#define TAO_JSON_BINDING_ELEMENT2_HPP

#include <type_traits>

#include "internal/elementr.hpp"
#include "internal/elementw.hpp"

namespace tao::json::binding
{
   namespace internal
   {
      template< typename GT, GT GET, typename ST, ST SET >
      struct element2
         : elementr< GT, GET >,
           elementw< ST, SET >
      {
         static_assert( std::is_same_v< typename elementr< GT, GET >::read_class_t, typename elementw< ST, SET >::write_class_t > );
         static_assert( std::is_same_v< typename elementr< GT, GET >::read_value_t, typename elementw< ST, SET >::write_value_t > );

         using class_t = typename elementr< GT, GET >::read_class_t;
         using value_t = typename elementr< GT, GET >::read_value_t;
      };

   }  // namespace internal

   template< auto GET, auto SET >
   using element2 = internal::element2< decltype( GET ), GET, decltype( SET ), SET >;

}  // namespace tao::json::binding

#endif
