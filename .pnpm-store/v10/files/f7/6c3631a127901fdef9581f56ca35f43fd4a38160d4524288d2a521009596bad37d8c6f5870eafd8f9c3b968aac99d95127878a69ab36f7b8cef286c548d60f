// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_ITERATOR_HPP
#define TAO_PEGTL_INTERNAL_ITERATOR_HPP

#include <cassert>
#include <cstdlib>

#include "../config.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct iterator
   {
      iterator() = default;

      explicit iterator( const char* in_data ) noexcept
         : data( in_data )
      {}

      iterator( const char* in_data, const std::size_t in_byte, const std::size_t in_line, const std::size_t in_column ) noexcept
         : data( in_data ),
           byte( in_byte ),
           line( in_line ),
           column( in_column )
      {
         assert( in_line != 0 );
         assert( in_column != 0 );
      }

      iterator( const iterator& ) = default;
      iterator( iterator&& ) = default;

      ~iterator() = default;

      iterator& operator=( const iterator& ) = default;
      iterator& operator=( iterator&& ) = default;

      const char* data = nullptr;

      std::size_t byte = 0;
      std::size_t line = 1;
      std::size_t column = 1;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
