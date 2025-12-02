// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_NOT_AT_HPP
#define TAO_PEGTL_INTERNAL_NOT_AT_HPP

#include "../config.hpp"

#include "enable_control.hpp"
#include "failure.hpp"
#include "seq.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename... Rules >
   struct not_at
      : not_at< seq< Rules... > >
   {};

   template<>
   struct not_at<>
      : failure
   {};

   template< typename Rule >
   struct not_at< Rule >
   {
      using rule_t = not_at;
      using subs_t = type_list< Rule >;

      template< apply_mode,
                rewind_mode,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match( ParseInput& in, States&&... st )
      {
         const auto m = in.template mark< rewind_mode::required >();
         return !Control< Rule >::template match< apply_mode::nothing, rewind_mode::active, Action, Control >( in, st... );
      }
   };

   template< typename... Rules >
   inline constexpr bool enable_control< not_at< Rules... > > = false;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
