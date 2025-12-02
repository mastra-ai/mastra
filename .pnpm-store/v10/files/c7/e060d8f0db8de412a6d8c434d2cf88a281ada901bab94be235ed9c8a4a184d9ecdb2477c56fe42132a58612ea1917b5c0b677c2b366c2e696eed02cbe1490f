// Copyright (c) 2017-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_CSTREAM_INPUT_HPP
#define TAO_PEGTL_CSTREAM_INPUT_HPP

#include <cstdio>

#include "buffer_input.hpp"
#include "config.hpp"
#include "eol.hpp"

#include "internal/cstream_reader.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   template< typename Eol = eol::lf_crlf, std::size_t Chunk = 64 >
   struct cstream_input
      : buffer_input< internal::cstream_reader, Eol, std::string, Chunk >
   {
      template< typename T >
      cstream_input( std::FILE* in_stream, const std::size_t in_maximum, T&& in_source )
         : buffer_input< internal::cstream_reader, Eol, std::string, Chunk >( std::forward< T >( in_source ), in_maximum, in_stream )
      {}
   };

   template< typename... Ts >
   cstream_input( Ts&&... ) -> cstream_input<>;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
