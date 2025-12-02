// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_FROM_FILE_HPP
#define TAO_JSON_EVENTS_FROM_FILE_HPP

#include "../internal/action.hpp"
#include "../internal/errors.hpp"
#include "../internal/filesystem.hpp"
#include "../internal/grammar.hpp"

#include <tao/pegtl/file_input.hpp>
#include <tao/pegtl/parse.hpp>

namespace tao::json::events
{
   // Events producer to parse a file containing a JSON string representation.

   template< typename Consumer >
   void from_file( Consumer& consumer, const internal::filesystem::path& path )
   {
      pegtl::file_input< pegtl::tracking_mode::lazy > in( path );
      pegtl::parse< internal::grammar, internal::action, internal::errors >( in, consumer );
   }

}  // namespace tao::json::events

#endif
