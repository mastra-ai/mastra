// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_IF_APPLY_HPP
#define TAO_PEGTL_INTERNAL_IF_APPLY_HPP

#include "../config.hpp"

#include "apply_single.hpp"
#include "enable_control.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename... Actions >
   struct if_apply
   {
      using rule_t = if_apply;
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
         if constexpr( ( A == apply_mode::action ) && ( sizeof...( Actions ) != 0 ) ) {
            using action_t = typename ParseInput::action_t;
            auto m = in.template mark< rewind_mode::required >();
            if( Control< Rule >::template match< apply_mode::action, rewind_mode::active, Action, Control >( in, st... ) ) {
               const action_t i2( m.iterator(), in );
               return m( ( apply_single< Actions >::match( i2, st... ) && ... ) );
            }
            return false;
         }
         else {
            return Control< Rule >::template match< A, M, Action, Control >( in, st... );
         }
      }
   };

   template< typename Rule, typename... Actions >
   inline constexpr bool enable_control< if_apply< Rule, Actions... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
