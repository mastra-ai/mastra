// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_READ_INPUT_HPP
#define TAO_PEGTL_READ_INPUT_HPP

#include <string>

#include "config.hpp"
#include "eol.hpp"
#include "string_input.hpp"
#include "tracking_mode.hpp"

#include "internal/file_reader.hpp"
#include "internal/filesystem.hpp"
#include "internal/path_to_string.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf >
   struct read_input
      : string_input< P, Eol >
   {
      read_input( const internal::filesystem::path& path, const std::string& source )
         : string_input< P, Eol >( internal::file_reader( path ).read(), source )
      {}

      explicit read_input( const internal::filesystem::path& path )
         : read_input( path, internal::path_to_string( path ) )
      {}

      read_input( FILE* file, const internal::filesystem::path& path, const std::string& source )
         : string_input< P, Eol >( internal::file_reader( file, path ).read(), source )
      {}

      read_input( FILE* file, const internal::filesystem::path& path )
         : read_input( file, path, internal::path_to_string( path ) )
      {}

      read_input( const read_input& ) = delete;
      read_input( read_input&& ) = delete;

      ~read_input() = default;

      read_input& operator=( const read_input& ) = delete;
      read_input& operator=( read_input&& ) = delete;
   };

   template< typename... Ts >
   explicit read_input( Ts&&... ) -> read_input<>;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
