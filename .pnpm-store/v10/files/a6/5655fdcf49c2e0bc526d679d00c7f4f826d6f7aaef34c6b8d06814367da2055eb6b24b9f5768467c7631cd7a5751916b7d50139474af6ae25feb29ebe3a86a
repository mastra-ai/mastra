// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BINDING_INTERNAL_INHERIT_HPP
#define TAO_JSON_BINDING_INTERNAL_INHERIT_HPP

#include "../../internal/type_traits.hpp"

#include "../inherit.hpp"

namespace tao::json::binding::internal
{
   template< typename T >
   struct inherit_elements_t
   {
      using list = json::internal::type_list< T >;
   };

   template< typename T >
   struct inherit_elements_t< inherit< T > >
   {
      using list = typename T::elements;
   };

   template< typename T >
   using inherit_elements = typename inherit_elements_t< T >::list;

   template< typename T >
   struct inherit_members_t
   {
      using list = json::internal::type_list< T >;
   };

   template< typename T >
   struct inherit_members_t< inherit< T > >
   {
      using list = typename T::members;
   };

   template< typename T >
   using inherit_members = typename inherit_members_t< T >::list;

}  // namespace tao::json::binding::internal

#endif
