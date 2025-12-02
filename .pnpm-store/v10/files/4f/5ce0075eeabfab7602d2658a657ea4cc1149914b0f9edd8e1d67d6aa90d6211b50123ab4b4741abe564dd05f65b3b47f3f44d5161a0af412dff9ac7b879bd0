// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_STATE_HPP
#define TAO_PEGTL_INTERNAL_STATE_HPP

#include "../config.hpp"

#include <type_traits>

#include "dependent_false.hpp"
#include "enable_control.hpp"
#include "seq.hpp"
#include "success.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename NewState, typename... Rules >
   struct state
      : state< NewState, seq< Rules... > >
   {};

   template< typename NewState >
   struct state< NewState >
      : success
   {};

   template< typename NewState, typename Rule >
   struct state< NewState, Rule >
   {
      using rule_t = state;
      using subs_t = type_list< Rule >;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         if constexpr( std::is_constructible_v< NewState, const ParseInput&, States... > ) {
            NewState s( static_cast< const ParseInput& >( in ), st... );
            if( Control< Rule >::template match< A, M, Action, Control >( in, s ) ) {
               s.success( static_cast< const ParseInput& >( in ), st... );
               return true;
            }
            return false;
         }
         else if constexpr( std::is_default_constructible_v< NewState > ) {
            NewState s;
            if( Control< Rule >::template match< A, M, Action, Control >( in, s ) ) {
               s.success( static_cast< const ParseInput& >( in ), st... );
               return true;
            }
            return false;
         }
         else {
            static_assert( internal::dependent_false< NewState >, "unable to instantiate new state" );
         }
      }
   };

   template< typename NewState, typename... Rules >
   inline constexpr bool enable_control< state< NewState, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
