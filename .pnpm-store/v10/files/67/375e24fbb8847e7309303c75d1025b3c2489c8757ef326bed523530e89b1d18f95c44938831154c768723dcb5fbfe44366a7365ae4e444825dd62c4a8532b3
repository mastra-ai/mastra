// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_VISIT_HPP
#define TAO_PEGTL_VISIT_HPP

#include <type_traits>

#include "config.hpp"
#include "type_list.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename Type, typename... Types >
      inline constexpr bool contains_v = ( std::is_same_v< Type, Types > || ... );

      template< typename Type, typename... Types >
      struct contains
         : std::bool_constant< contains_v< Type, Types... > >
      {};

      template< typename Type, typename... Types >
      struct contains< Type, type_list< Types... > >
         : contains< Type, Types... >
      {};

      template< typename Rules, typename Todo, typename Done >
      struct filter
      {
         using type = Todo;
      };

      template< typename Rule, typename... Rules, typename... Todo, typename... Done >
      struct filter< type_list< Rule, Rules... >, type_list< Todo... >, type_list< Done... > >
         : filter< type_list< Rules... >, std::conditional_t< contains_v< Rule, Todo..., Done... >, type_list< Todo... >, type_list< Rule, Todo... > >, type_list< Done... > >
      {};

      template< typename Rules, typename Todo, typename Done >
      using filter_t = typename filter< Rules, Todo, Done >::type;

      template< typename Done, typename... Rules >
      struct visit_list
      {
         using NextDone = type_list_concat_t< type_list< Rules... >, Done >;
         using NextSubs = type_list_concat_t< typename Rules::subs_t... >;
         using NextTodo = filter_t< NextSubs, empty_list, NextDone >;

         using type = typename std::conditional_t< std::is_same_v< NextTodo, empty_list >, type_list_concat< NextDone >, visit_list< NextDone, NextTodo > >::type;
      };

      template< typename Done, typename... Rules >
      struct visit_list< Done, type_list< Rules... > >
         : visit_list< Done, Rules... >
      {};

      template< template< typename... > class Func, typename... Args, typename... Rules >
      void visit( type_list< Rules... > /*unused*/, Args&&... args )
      {
         ( Func< Rules >::visit( args... ), ... );
      }

   }  // namespace internal

   template< typename Grammar >
   using rule_list_t = typename internal::visit_list< empty_list, Grammar >::type;

   template< typename Grammar, typename Rule >
   inline constexpr bool contains_v = internal::contains< Rule, rule_list_t< Grammar > >::value;

   template< typename Rule, template< typename... > class Func, typename... Args >
   void visit( Args&&... args )
   {
      internal::visit< Func >( rule_list_t< Rule >(), args... );
   }

}  // namespace TAO_PEGTL_NAMESPACE

#endif
