// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_EVENTS_FROM_FILE_HPP
#define TAO_JSON_JAXN_EVENTS_FROM_FILE_HPP

#include <tao/pegtl/file_input.hpp>
#include <tao/pegtl/parse.hpp>

#include "../internal/action.hpp"
#include "../internal/errors.hpp"
#include "../internal/grammar.hpp"

#include "../../internal/filesystem.hpp"

namespace tao::json::jaxn::events
{
   // Events producer to parse a file containing a JAXN string representation.

   template< typename Consumer >
   void from_file( Consumer& consumer, const json::internal::filesystem::path& path )
   {
      pegtl::file_input< pegtl::tracking_mode::lazy > in( path );
      pegtl::parse< internal::grammar, internal::action, internal::errors >( in, consumer );
   }

}  // namespace tao::json::jaxn::events

#endif
