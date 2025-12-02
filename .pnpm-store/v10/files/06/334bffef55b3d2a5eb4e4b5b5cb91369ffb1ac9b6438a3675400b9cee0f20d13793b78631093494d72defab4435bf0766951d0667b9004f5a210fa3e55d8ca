// Copyright (c) 2016-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_EOL_HPP
#define TAO_PEGTL_EOL_HPP

#include "config.hpp"

#include "internal/eol.hpp"

#include "internal/cr_crlf_eol.hpp"
#include "internal/cr_eol.hpp"
#include "internal/crlf_eol.hpp"
#include "internal/lf_crlf_eol.hpp"
#include "internal/lf_eol.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   inline namespace ascii
   {
      // this is both a rule and a pseudo-namespace for eol::cr, ...
      struct eol : internal::eol
      {
         // clang-format off
         struct cr : internal::cr_eol {};
         struct cr_crlf : internal::cr_crlf_eol {};
         struct crlf : internal::crlf_eol {};
         struct lf : internal::lf_eol {};
         struct lf_crlf : internal::lf_crlf_eol {};
         // clang-format on
      };

   }  // namespace ascii

}  // namespace TAO_PEGTL_NAMESPACE

#endif
