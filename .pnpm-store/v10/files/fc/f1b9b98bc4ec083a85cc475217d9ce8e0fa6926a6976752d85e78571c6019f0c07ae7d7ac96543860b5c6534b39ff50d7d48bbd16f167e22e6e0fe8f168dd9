// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_UNTIL_HPP
#define TAO_PEGTL_INTERNAL_UNTIL_HPP

#include "../config.hpp"

#include "bytes.hpp"
#include "enable_control.hpp"
#include "eof.hpp"
#include "not_at.hpp"
#include "seq.hpp"
#include "star.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Cond, typename... Rules >
   struct until
      : until< Cond, seq< Rules... > >
   {};

   template< typename Cond >
   struct until< Cond >
   {
      using rule_t = until;
      using subs_t = type_list< Cond >;

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

         while( !Control< Cond >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
            if( in.empty() ) {
               return false;
            }
            in.bump();
         }
         return m( true );
      }
   };

   template< typename Cond, typename Rule >
   struct until< Cond, Rule >
   {
      using rule_t = until;
      using subs_t = type_list< Cond, Rule >;

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

         while( !Control< Cond >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
            if( !Control< Rule >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) ) {
               return false;
            }
         }
         return m( true );
      }
   };

   template< typename Cond, typename... Rules >
   inline constexpr bool enable_control< until< Cond, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
