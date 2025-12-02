// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_FUNCTION_HPP
#define TAO_PEGTL_CONTRIB_FUNCTION_HPP

#include "../config.hpp"

#include "../apply_mode.hpp"
#include "../rewind_mode.hpp"
#include "../type_list.hpp"

#include "../internal/enable_control.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename F, F U >
      struct function;

      template< typename ParseInput, typename... States, bool ( *U )( ParseInput&, States... ) >
      struct function< bool ( * )( ParseInput&, States... ), U >
      {
         using rule_t = function;
         using subs_t = empty_list;

         template< apply_mode A,
                   rewind_mode M,
                   template< typename... >
                   class Action,
                   template< typename... >
                   class Control >
         [[nodiscard]] static bool match( ParseInput& in, States... st ) noexcept( noexcept( U( in, st... ) ) )
         {
            return U( in, st... );
         }
      };

      template< typename F, F U >
      inline constexpr bool enable_control< function< F, U > > = false;

   }  // namespace internal

   template< auto F >
   struct function
      : internal::function< decltype( F ), F >
   {};

}  // namespace TAO_PEGTL_NAMESPACE

#endif
