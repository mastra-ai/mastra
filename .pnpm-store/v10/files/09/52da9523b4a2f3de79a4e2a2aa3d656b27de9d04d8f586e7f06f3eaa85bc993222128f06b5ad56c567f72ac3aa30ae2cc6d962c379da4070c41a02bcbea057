// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_APPLY0_HPP
#define TAO_PEGTL_INTERNAL_APPLY0_HPP

#include "../config.hpp"

#include "apply0_single.hpp"
#include "enable_control.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename... Actions >
   struct apply0
   {
      using rule_t = apply0;
      using subs_t = empty_list;

      template< apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& /*unused*/, [[maybe_unused]] States&&... st )
      {
         if constexpr( A == apply_mode::action ) {
            return ( apply0_single< Actions >::match( st... ) && ... );
         }
         else {
#if defined( _MSC_VER )
            ( (void)st, ... );
#endif
            return true;
         }
      }
   };

   template< typename... Actions >
   inline constexpr bool enable_control< apply0< Actions... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
