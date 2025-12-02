// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_REMATCH_HPP
#define TAO_PEGTL_INTERNAL_REMATCH_HPP

#include "../config.hpp"

#include "enable_control.hpp"

#include "../apply_mode.hpp"
#include "../memory_input.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Head, typename... Rules >
   struct rematch;

   template< typename Head >
   struct rematch< Head >
   {
      using rule_t = rematch;
      using subs_t = type_list< Head >;

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
         return Control< Head >::template match< A, M, Action, Control >( in, st... );
      }
   };

   template< typename Head, typename Rule, typename... Rules >
   struct rematch< Head, Rule, Rules... >
   {
      using rule_t = rematch;
      using subs_t = type_list< Head, Rule, Rules... >;

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
         auto m = in.template mark< rewind_mode::required >();

         if( Control< Head >::template match< A, rewind_mode::active, Action, Control >( in, st... ) ) {
            memory_input< ParseInput::tracking_mode_v, typename ParseInput::eol_t, typename ParseInput::source_t > i2( m.iterator(), in.current(), in.source() );
            return m( ( Control< Rule >::template match< A, rewind_mode::active, Action, Control >( i2, st... ) && ... && ( i2.restart( m ), Control< Rules >::template match< A, rewind_mode::active, Action, Control >( i2, st... ) ) ) );
         }
         return false;
      }
   };

   template< typename Head, typename... Rules >
   inline constexpr bool enable_control< rematch< Head, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
