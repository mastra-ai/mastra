// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_PLUS_HPP
#define TAO_PEGTL_INTERNAL_PLUS_HPP

#include <type_traits>

#include "../config.hpp"

#include "enable_control.hpp"
#include "seq.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   // While plus<> could easily be implemented with
   // seq< Rule, Rules ..., star< Rule, Rules ... > > we
   // provide an explicit implementation to optimise away
   // the otherwise created input mark.

   template< typename Rule, typename... Rules >
   struct plus
      : plus< seq< Rule, Rules... > >
   {};

   template< typename Rule >
   struct plus< Rule >
   {
      using rule_t = plus;
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
         if( Control< Rule >::template match< A, M, Action, Control >( in, st... ) ) {
            while( Control< Rule >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
            }
            return true;
         }
         return false;
      }
   };

   template< typename Rule, typename... Rules >
   inline constexpr bool enable_control< plus< Rule, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
