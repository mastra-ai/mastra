// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_APPLY0_SINGLE_HPP
#define TAO_PEGTL_INTERNAL_APPLY0_SINGLE_HPP

#include "../config.hpp"

#include <type_traits>

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename Action >
   struct apply0_single
   {
      template< typename... States >
      [[nodiscard]] static auto match( States&&... st ) noexcept( noexcept( Action::apply0( st... ) ) )
         -> std::enable_if_t< std::is_same_v< decltype( Action::apply0( st... ) ), void >, bool >
      {
         Action::apply0( st... );
         return true;
      }

      template< typename... States >
      [[nodiscard]] static auto match( States&&... st ) noexcept( noexcept( Action::apply0( st... ) ) )
         -> std::enable_if_t< std::is_same_v< decltype( Action::apply0( st... ) ), bool >, bool >
      {
         return Action::apply0( st... );
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
