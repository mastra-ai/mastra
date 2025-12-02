// Copyright (c) 2020-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTERNAL_VECTOR_STACK_GUARD_HPP
#define TAO_PEGTL_CONTRIB_INTERNAL_VECTOR_STACK_GUARD_HPP

#include <utility>
#include <vector>

#include "../../config.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename... Cs >
   class [[nodiscard]] vector_stack_guard
   {
   public:
      template< typename... Ts >
      vector_stack_guard( std::vector< Cs... >& vector, Ts&&... ts )
         : m_s( vector )
      {
         m_s.emplace_back( std::forward< Ts >( ts )... );
      }

      vector_stack_guard( vector_stack_guard&& ) = delete;
      vector_stack_guard( const vector_stack_guard& ) = delete;

      vector_stack_guard& operator=( vector_stack_guard&& ) = delete;
      vector_stack_guard& operator=( const vector_stack_guard& ) = delete;

      ~vector_stack_guard()
      {
         m_s.pop_back();
      }

   private:
      std::vector< Cs... >& m_s;
   };

   template< typename... Cs >
   vector_stack_guard( std::vector< Cs... >&, const typename std::vector< Cs... >::value_type& ) -> vector_stack_guard< Cs... >;

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
