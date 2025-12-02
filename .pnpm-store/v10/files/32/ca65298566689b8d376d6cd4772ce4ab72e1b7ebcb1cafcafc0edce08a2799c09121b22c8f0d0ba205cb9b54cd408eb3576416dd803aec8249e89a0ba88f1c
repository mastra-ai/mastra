// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_STAR_HPP
#define TAO_PEGTL_INTERNAL_STAR_HPP

#include <type_traits>

#include "../config.hpp"

#include "enable_control.hpp"
#include "seq.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Rule, typename... Rules >
   struct star
      : star< seq< Rule, Rules... > >
   {};

   template< typename Rule >
   struct star< Rule >
   {
      using rule_t = star;
      using subs_t = type_list< Rule >;

      template< apply_mode A,
                rewind_mode,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         while( Control< Rule >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
         }
         return true;
      }
   };

   template< typename Rule, typename... Rules >
   inline constexpr bool enable_control< star< Rule, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
