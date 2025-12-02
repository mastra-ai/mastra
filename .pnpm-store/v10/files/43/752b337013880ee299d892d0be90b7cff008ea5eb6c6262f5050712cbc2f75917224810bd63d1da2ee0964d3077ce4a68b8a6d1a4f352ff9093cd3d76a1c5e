// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CHANGE_STATES_HPP
#define TAO_PEGTL_CHANGE_STATES_HPP

#include <tuple>
#include <utility>

#include "apply_mode.hpp"
#include "config.hpp"
#include "match.hpp"
#include "nothing.hpp"
#include "rewind_mode.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   template< typename... NewStates >
   struct change_states
      : maybe_nothing
   {
      template< typename Rule,
                apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                std::size_t... Ns,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( std::index_sequence< Ns... > /*unused*/, ParseInput& in, States&&... st )
      {
         auto t = std::tie( st... );
         if( TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, Control >( in, std::get< Ns >( t )... ) ) {
            if constexpr( A == apply_mode::action ) {
               Action< Rule >::success( static_cast< const ParseInput& >( in ), st... );
            }
            return true;
         }
         return false;
      }

      template< typename Rule,
                apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         return match< Rule, A, M, Action, Control >( std::index_sequence_for< NewStates... >(), in, NewStates()..., st... );
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
