// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_REP_MIN_MAX_HPP
#define TAO_PEGTL_INTERNAL_REP_MIN_MAX_HPP

#include <type_traits>

#include "../config.hpp"

#include "enable_control.hpp"
#include "failure.hpp"
#include "not_at.hpp"
#include "seq.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< unsigned Min, unsigned Max, typename... Rules >
   struct rep_min_max
      : rep_min_max< Min, Max, seq< Rules... > >
   {
      static_assert( Min <= Max );
   };

   template< unsigned Min, unsigned Max >
   struct rep_min_max< Min, Max >
      : failure
   {
      static_assert( Min <= Max );
   };

   template< typename Rule >
   struct rep_min_max< 0, 0, Rule >
      : not_at< Rule >
   {};

   template< unsigned Min, unsigned Max, typename Rule >
   struct rep_min_max< Min, Max, Rule >
   {
      using rule_t = rep_min_max;
      using subs_t = type_list< Rule >;

      static_assert( Min <= Max );

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

         for( unsigned i = 0; i != Min; ++i ) {
            if( !Control< Rule >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) ) {
               return false;
            }
         }
         for( unsigned i = Min; i != Max; ++i ) {
            if( !Control< Rule >::template match< A, rewind_mode::required, Action, Control >( in, st... ) ) {
               return m( true );
            }
         }
         return m( Control< not_at< Rule > >::template match< A, m_t::next_rewind_mode, Action, Control >( in, st... ) );  // NOTE that not_at<> will always rewind.
      }
   };

   template< unsigned Min, unsigned Max, typename... Rules >
   inline constexpr bool enable_control< rep_min_max< Min, Max, Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
