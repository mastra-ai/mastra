// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTERNAL_SET_STACK_GUARD_HPP
#define TAO_PEGTL_CONTRIB_INTERNAL_SET_STACK_GUARD_HPP

#include <set>
#include <utility>

#include "../../config.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename... Cs >
   class [[nodiscard]] set_stack_guard
   {
   public:
      template< typename... Ts >
      set_stack_guard( std::set< Cs... >& set, Ts&&... ts )
         : m_i( set.emplace( std::forward< Ts >( ts )... ) ),
           m_s( set )
      {}

      set_stack_guard( set_stack_guard&& ) = delete;
      set_stack_guard( const set_stack_guard& ) = delete;

      set_stack_guard& operator=( set_stack_guard&& ) = delete;
      set_stack_guard& operator=( const set_stack_guard& ) = delete;

      ~set_stack_guard()
      {
         if( m_i.second ) {
            m_s.erase( m_i.first );
         }
      }

      explicit operator bool() const noexcept
      {
         return m_i.second;
      }

   private:
      const std::pair< typename std::set< Cs... >::iterator, bool > m_i;
      std::set< Cs... >& m_s;
   };

   template< typename... Cs >
   set_stack_guard( std::set< Cs... >&, const typename std::set< Cs... >::value_type& ) -> set_stack_guard< Cs... >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
