// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_CONTROL_HPP
#define TAO_PEGTL_INTERNAL_CONTROL_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "seq.hpp"
#include "success.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< template< typename... > class Control, typename... Rules >
   struct control
      : control< Control, seq< Rules... > >
   {};

   template< template< typename... > class Control >
   struct control< Control >
      : success
   {};

   template< template< typename... > class Control, typename Rule >
   struct control< Control, Rule >
   {
      using rule_t = control;
      using subs_t = type_list< Rule >;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         return Control< Rule >::template match< A, M, Action, Control >( in, st... );
      }
   };

   template< template< typename... > class Control, typename... Rules >
   inline constexpr bool enable_control< control< Control, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
