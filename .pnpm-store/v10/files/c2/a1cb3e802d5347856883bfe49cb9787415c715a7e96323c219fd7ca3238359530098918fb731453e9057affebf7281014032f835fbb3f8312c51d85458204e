// Copyright (c) 2018-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CONTRIB_INTERNAL_PEEK_UINT8_HPP
#define TAO_PEGTL_CONTRIB_INTERNAL_PEEK_UINT8_HPP

#include <cstddef>
#include <cstdint>

#include "../../config.hpp"
#include "../../internal/input_pair.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct peek_uint8
   {
      using data_t = std::uint8_t;
      using pair_t = input_pair< std::uint8_t >;

      template< typename ParseInput >
      [[nodiscard]] static pair_t peek( ParseInput& in ) noexcept( noexcept( in.empty() ) )
      {
         if( in.empty() ) {
            return { 0, 0 };
         }
         return { in.peek_uint8(), 1 };
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
