// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_INTERNAL_TYPE_TRAITS_HPP
#define TAO_JSON_INTERNAL_TYPE_TRAITS_HPP

#include <type_traits>
#include <typeinfo>

#include <tao/pegtl/type_list.hpp>

#include "../forward.hpp"

namespace tao::json::internal
{
   using pegtl::type_list;           // NOLINT(misc-unused-using-decls)
   using pegtl::empty_list;          // NOLINT(misc-unused-using-decls)
   using pegtl::type_list_concat;    // NOLINT(misc-unused-using-decls)
   using pegtl::type_list_concat_t;  // NOLINT(misc-unused-using-decls)

   struct type_info_less
   {
      [[nodiscard]] bool operator()( const std::type_info* l, const std::type_info* r ) const
      {
         return l->before( *r );
      }
   };

   template< typename... >
   inline constexpr bool has_as_impl = false;

   template< typename Trait, typename... Args >
   inline constexpr bool has_as_impl< decltype( (void)Trait::as( std::declval< Args >()... ) ), Trait, Args... > = true;

   template< typename Trait, typename Value, typename... With >
   inline constexpr bool has_as = has_as_impl< void, Trait, const Value&, With&... >;

   template< typename, template< typename... > typename, typename, typename... >
   inline constexpr bool has_as_type_impl = false;

   template< template< typename... > typename Traits, typename T, typename... Args >
   inline constexpr bool has_as_type_impl< decltype( (void)Traits< T >::template as_type< Traits, T >( std::declval< Args >()... ) ), Traits, T, Args... > = true;

   template< template< typename... > typename Traits, typename T, typename Value, typename... With >
   inline constexpr bool has_as_type = has_as_type_impl< void, Traits, T, const Value&, With&... >;

   template< typename... >
   inline constexpr bool has_to_impl = false;

   template< typename Trait, typename... Args >
   inline constexpr bool has_to_impl< decltype( (void)Trait::to( std::declval< Args >()... ) ), Trait, Args... > = true;

   template< typename Trait, typename Value, typename... With >
   inline constexpr bool has_to = has_to_impl< void, Trait, const Value&, With&... >;

   template< template< typename... > class, typename, typename, typename = void >
   inline constexpr bool has_consume_one = false;

   template< template< typename... > class Traits, typename P, typename U >
   inline constexpr bool has_consume_one< Traits, P, U, decltype( (void)Traits< U >::template consume< Traits >( std::declval< P& >() ) ) > = true;

   template< template< typename... > class, typename, typename, typename = void >
   inline constexpr bool has_consume_two = false;

   template< template< typename... > class Traits, typename P, typename U >
   inline constexpr bool has_consume_two< Traits, P, U, decltype( (void)Traits< U >::template consume< Traits >( std::declval< P& >(), std::declval< U& >() ) ) > = true;

   template< template< typename... > class Traits, typename T, typename = void >
   inline constexpr bool has_is_nothing = false;

   template< template< typename... > class Traits, typename T >
   inline constexpr bool has_is_nothing< Traits, T, decltype( (void)Traits< T >::template is_nothing< Traits >( std::declval< const T& >() ) ) > = true;

   template< template< typename... > class Traits, typename T >
   [[nodiscard]] std::enable_if_t< has_is_nothing< Traits, T >, bool > is_nothing( const T& t ) noexcept( noexcept( Traits< T >::template is_nothing< Traits >( t ) ) )
   {
      return Traits< T >::template is_nothing< Traits >( t );
   }

   template< template< typename... > class Traits, typename T >
   [[nodiscard]] std::enable_if_t< !has_is_nothing< Traits, T >, bool > is_nothing( const T& /*unused*/ ) noexcept
   {
      return false;
   }

   template< template< typename... > class Traits, typename T, typename = void >
   inline constexpr bool has_enable_implicit_constructor = false;

   template< template< typename... > class Traits, typename T >
   inline constexpr bool has_enable_implicit_constructor< Traits, T, decltype( (void)Traits< T >::enable_implicit_constructor ) > = true;

   template< template< typename... > class Traits, typename T >
   inline constexpr bool enable_implicit_constructor = Traits< std::conditional_t< has_enable_implicit_constructor< Traits, T >, T, void > >::enable_implicit_constructor;

}  // namespace tao::json::internal

#endif
