// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_IF_THEN_ELSE_HPP
#define TAO_PEGTL_INTERNAL_IF_THEN_ELSE_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "not_at.hpp"
#include "seq.hpp"
#include "sor.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Cond, typename Then, typename Else >
   struct if_then_else
   {
      using rule_t = if_then_else;
      using subs_t = type_list< Cond, Then, Else >;

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
         auto m = in.template mark< M >();
         using m_t = decltype( m );

         if( Control< Cond >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
            return m( Control< Then >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) );
         }
         return m( Control< Else >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) );
      }
   };

   template< typename Cond, typename Then, typename Else >
   inline constexpr bool enable_control< if_then_else< Cond, Then, Else > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
