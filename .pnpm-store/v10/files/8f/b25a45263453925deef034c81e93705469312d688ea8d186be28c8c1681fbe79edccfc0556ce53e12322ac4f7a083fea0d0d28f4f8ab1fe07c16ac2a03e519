// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_MUST_HPP
#define TAO_PEGTL_INTERNAL_MUST_HPP

#if !defined( __cpp_exceptions )
#error "Exception support required for tao/pegtl/internal/must.hpp"
#else

#include "../config.hpp"

#include "enable_control.hpp"
#include "seq.hpp"
#include "success.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   // The general case applies must<> to each of the
   // rules in the 'Rules' parameter pack individually.

   template< typename... Rules >
   struct must
      : seq< must< Rules >... >
   {};

   template<>
   struct must<>
      : success
   {};

   // While in theory the implementation for a single rule could
   // be simplified to must< Rule > = sor< Rule, raise< Rule > >, this
   // would result in some unnecessary run-time overhead.

   template< typename Rule >
   struct must< Rule >
   {
      using rule_t = must;
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
         if( !Control< Rule >::template match< A, rewind_mode::dontcare, Action, Control >( in, st... ) ) {
            Control< Rule >::raise( static_cast< const ParseInput& >( in ), st... );
         }
         return true;
      }
   };

   template< typename... Rules >
   inline constexpr bool enable_control< must< Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
#endif
