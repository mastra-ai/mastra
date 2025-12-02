// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_FORWARD_HPP
#define TAO_JSON_FORWARD_HPP

namespace tao::json
{
   namespace events
   {
      class virtual_base;

   }  // namespace events

   template< typename T, typename = void >
   struct traits
   {};

   template< template< typename... > class Traits >
   class basic_value;

   using value = basic_value< traits >;

   using producer_t = void( events::virtual_base&, const void* );

   namespace internal
   {
      struct opaque_ptr_t
      {
         const void* data;
         producer_t* producer;
      };

      template< template< typename... > class Traits >
      struct single;

      template< template< typename... > class Traits >
      struct pair;

   }  // namespace internal

}  // namespace tao::json

#endif
