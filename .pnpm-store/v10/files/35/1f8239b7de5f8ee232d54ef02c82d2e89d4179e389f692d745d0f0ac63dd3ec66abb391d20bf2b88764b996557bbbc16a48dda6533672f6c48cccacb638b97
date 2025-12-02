// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_CONTROL_ACTION_HPP
#define TAO_PEGTL_CONTRIB_CONTROL_ACTION_HPP

#include <utility>

#include "../config.hpp"
#include "../match.hpp"
#include "../nothing.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      template< typename, typename Rule, template< typename... > class Action, typename ParseInput, typename... States >
      inline constexpr bool action_has_unwind = false;

      template< typename Rule, template< typename... > class Action, typename ParseInput, typename... States >
      inline constexpr bool action_has_unwind< decltype( (void)Action< Rule >::unwind( std::declval< const ParseInput& >(), std::declval< States&& >()... ) ), Rule, Action, ParseInput, States... > = true;

   }  // namespace internal

   struct control_action
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
#if defined( __cpp_exceptions )
         if constexpr( internal::action_has_unwind< void, Rule, Action, ParseInput, States... > ) {
            try {
               return control_action::match_impl< Rule, A, M, Action, Control >( in, st... );
            }
            catch( ... ) {
               Action< Rule >::unwind( const_cast< const ParseInput& >( in ), st... );
               throw;
            }
         }
         else {
            return control_action::match_impl< Rule, A, M, Action, Control >( in, st... );
         }
#else
         return control_action::match_impl< Rule, A, M, Action, Control >( in, st... );
#endif
      }

      template< typename ParseInput, typename... States >
      static void start( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
      {}

      template< typename ParseInput, typename... States >
      static void success( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
      {}

      template< typename ParseInput, typename... States >
      static void failure( const ParseInput& /*unused*/, States&&... /*unused*/ ) noexcept
      {}

   private:
      template< typename Rule,
                apply_mode A,
                rewind_mode M,
                template< typename... >
                class Action,
                template< typename... >
                class Control,
                typename ParseInput,
                typename... States >
      [[nodiscard]] static bool match_impl( ParseInput& in, States&&... st )
      {
         Action< Rule >::start( const_cast< const ParseInput& >( in ), st... );
         if( TAO_PEGTL_NAMESPACE::match< Rule, A, M, Action, Control >( in, st... ) ) {
            Action< Rule >::success( const_cast< const ParseInput& >( in ), st... );
            return true;
         }
         Action< Rule >::failure( const_cast< const ParseInput& >( in ), st... );
         return false;
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
