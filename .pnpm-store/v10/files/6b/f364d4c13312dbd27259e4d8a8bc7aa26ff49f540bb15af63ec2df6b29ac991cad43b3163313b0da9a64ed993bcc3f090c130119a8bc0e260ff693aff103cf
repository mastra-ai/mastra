// Copyright (c) 2015-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_FILE_INPUT_HPP
#define TAO_PEGTL_FILE_INPUT_HPP

#include "config.hpp"
#include "eol.hpp"
#include "tracking_mode.hpp"

#if defined( __unix__ ) || ( defined( __APPLE__ ) && defined( __MACH__ ) )
#include <unistd.h>  // Required for _POSIX_MAPPED_FILES
#endif

#if defined( _POSIX_MAPPED_FILES ) || defined( _WIN32 )
#include "mmap_input.hpp"
#else
#include "read_input.hpp"
#endif

namespace TAO_PEGTL_NAMESPACE
{
#if defined( _POSIX_MAPPED_FILES ) || defined( _WIN32 )
   template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf >
   struct file_input
      : mmap_input< P, Eol >
   {
      using mmap_input< P, Eol >::mmap_input;
   };
#else
   template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf >
   struct file_input
      : read_input< P, Eol >
   {
      using read_input< P, Eol >::read_input;
   };
#endif

   template< typename... Ts >
   explicit file_input( Ts&&... ) -> file_input<>;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
