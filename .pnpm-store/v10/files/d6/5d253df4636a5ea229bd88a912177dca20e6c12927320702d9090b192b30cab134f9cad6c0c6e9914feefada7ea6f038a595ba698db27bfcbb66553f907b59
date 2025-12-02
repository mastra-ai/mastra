// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_CONSUME_FILE_HPP
#define TAO_JSON_JAXN_CONSUME_FILE_HPP

#include <tao/pegtl/file_input.hpp>

#include "../internal/filesystem.hpp"

#include "../consume.hpp"
#include "../forward.hpp"

#include "parts_parser.hpp"

namespace tao::json::jaxn
{
   template< typename T, template< typename... > class Traits = traits >
   [[nodiscard]] T consume_file( const json::internal::filesystem::path& path )
   {
      jaxn::basic_parts_parser< pegtl::file_input< pegtl::tracking_mode::lazy > > pp( path );
      return json::consume< T, Traits >( pp );
   }

   template< template< typename... > class Traits = traits, typename T >
   void consume_file( const json::internal::filesystem::path& path, T& t )
   {
      jaxn::basic_parts_parser< pegtl::file_input< pegtl::tracking_mode::lazy > > pp( path );
      json::consume< Traits >( pp, t );
   }

}  // namespace tao::json::jaxn

#endif
