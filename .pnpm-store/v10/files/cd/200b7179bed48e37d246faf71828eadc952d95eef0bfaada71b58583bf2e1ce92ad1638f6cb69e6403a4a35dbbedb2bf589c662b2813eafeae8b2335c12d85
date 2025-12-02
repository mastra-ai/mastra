// Copyright (c) 2019-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_DISABLE_ACTION_HPP
#define TAO_PEGTL_DISABLE_ACTION_HPP

#include "apply_mode.hpp"
#include "config.hpp"
#include "match.hpp"
#include "nothing.hpp"
#include "rewind_mode.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   struct disable_action
      : maybe_nothing
   {
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
         return TAO_PEGTL_NAMESPACE::match< Rule, apply_mode::nothing, M, Action, Control >( in, st... );
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
