// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_JAXN_INTERNAL_UNESCAPE_ACTION_HPP
#define TAO_JSON_JAXN_INTERNAL_UNESCAPE_ACTION_HPP

#include <tao/pegtl/contrib/unescape.hpp>
#include <tao/pegtl/nothing.hpp>

#include "grammar.hpp"

namespace tao::json::jaxn::internal
{
   // clang-format off
   template< typename Rule > struct unescape_action : pegtl::nothing< Rule > {};

   template<> struct unescape_action< rules::escaped_char > : pegtl::unescape::unescape_c< rules::escaped_char, '"', '\'', '\\', '/', '\b', '\f', '\n', '\r', '\t', '\v', '\0' > {};
   template<> struct unescape_action< rules::escaped_unicode > : pegtl::unescape::unescape_j {};
   template<> struct unescape_action< rules::escaped_unicode_code_point_content > : pegtl::unescape::unescape_u {};

   template<> struct unescape_action< rules::identifier > : pegtl::unescape::append_all {};  // For parts_parser.
   template< char D > struct unescape_action< rules::unescaped< D > > : pegtl::unescape::append_all {};
   template< char D > struct unescape_action< rules::mchars< D > > : pegtl::unescape::append_all {};
   // clang-format on

}  // namespace tao::json::jaxn::internal

#endif
