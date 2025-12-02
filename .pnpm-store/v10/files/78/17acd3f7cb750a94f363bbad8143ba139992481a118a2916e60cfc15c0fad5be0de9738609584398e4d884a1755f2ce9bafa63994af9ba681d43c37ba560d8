// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_TYPE_LIST_HPP
#define TAO_PEGTL_TYPE_LIST_HPP

#include <cstddef>

#include "config.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   template< typename... Ts >
   struct type_list
   {
      static constexpr std::size_t size = sizeof...( Ts );
   };

   using empty_list = type_list<>;

   template< typename... >
   struct type_list_concat;

   template<>
   struct type_list_concat<>
   {
      using type = empty_list;
   };

   template< typename... Ts >
   struct type_list_concat< type_list< Ts... > >
   {
      using type = type_list< Ts... >;
   };

   template< typename... T0s, typename... T1s, typename... Ts >
   struct type_list_concat< type_list< T0s... >, type_list< T1s... >, Ts... >
      : type_list_concat< type_list< T0s..., T1s... >, Ts... >
   {};

   template< typename... Ts >
   using type_list_concat_t = typename type_list_concat< Ts... >::type;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
