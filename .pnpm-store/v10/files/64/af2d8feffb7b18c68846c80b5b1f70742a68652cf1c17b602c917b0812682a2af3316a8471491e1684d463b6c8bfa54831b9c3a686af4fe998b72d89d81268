// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_INTERNAL_TYPE_TRAITS_HPP
#define TAO_JSON_CONTRIB_INTERNAL_TYPE_TRAITS_HPP

#include "../../forward.hpp"

#include "../../internal/type_traits.hpp"

namespace tao::json::internal
{
   template< typename T, template< typename... > class Traits, typename... With >
   inline constexpr bool use_first_ptr_as = std::is_constructible_v< T, const basic_value< Traits >&, With&... >;

   template< typename T, template< typename... > class Traits, typename... With >
   inline constexpr bool use_second_ptr_as = !use_first_ptr_as< T, Traits, With... > && std::is_move_constructible_v< T > && has_as< Traits< T >, basic_value< Traits >, With... >;

   template< typename T, template< typename... > class Traits, typename... With >
   inline constexpr bool use_third_ptr_as = !use_first_ptr_as< T, Traits, With... > && !use_second_ptr_as< T, Traits, With... > && std::is_default_constructible_v< T > && has_to< Traits< T >, basic_value< Traits >, T, With... >;

   template< typename T, template< typename... > class Traits, typename... With >
   inline constexpr bool use_fourth_ptr_as = !use_first_ptr_as< T, Traits, With... > && !use_third_ptr_as< T, Traits, With... > && std::is_copy_constructible_v< T > && has_as< Traits< T >, basic_value< Traits >, With... >;

   template< typename T, template< typename... > class Traits, class Producer >
   inline constexpr bool use_first_ptr_consume = std::is_move_constructible_v< T > && has_consume_one< Traits, Producer, T >;

   template< typename T, template< typename... > class Traits, class Producer >
   inline constexpr bool use_second_ptr_consume = !use_first_ptr_consume< T, Traits, Producer > && std::is_default_constructible_v< T > && has_consume_two< Traits, Producer, T >;

   template< typename T, template< typename... > class Traits, class Producer >
   inline constexpr bool use_third_ptr_consume = !use_second_ptr_consume< T, Traits, Producer > && std::is_copy_constructible_v< T > && has_consume_one< Traits, Producer, T >;

}  // namespace tao::json::internal

#endif
