// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_SEQ_HPP
#define TAO_PEGTL_INTERNAL_SEQ_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "success.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename... Rules >
   struct seq;

   template<>
   struct seq<>
      : success
   {};

   template< typename... Rules >
   struct seq
   {
      using rule_t = seq;
      using subs_t = type_list< Rules... >;

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
         if constexpr( sizeof...( Rules ) == 1 ) {
            return Control< Rules... >::template match< A, M, Action, Control >( in, st... );
         }
         else {
            auto m = in.template mark< M >();
            using m_t = decltype( m );
            return m( ( Control< Rules >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) && ... ) );
         }
      }
   };

   template< typename... Rules >
   inline constexpr bool enable_control< seq< Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
