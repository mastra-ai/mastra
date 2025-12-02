// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_MMAP_INPUT_HPP
#define TAO_PEGTL_MMAP_INPUT_HPP

#include <string>

#include "config.hpp"
#include "eol.hpp"
#include "memory_input.hpp"
#include "tracking_mode.hpp"

#include "internal/filesystem.hpp"
#include "internal/path_to_string.hpp"

#if defined( __unix__ ) || ( defined( __APPLE__ ) && defined( __MACH__ ) )
#include <unistd.h>  // Required for _POSIX_MAPPED_FILES
#endif

#if defined( _POSIX_MAPPED_FILES )
#include "internal/file_mapper_posix.hpp"
#elif defined( _WIN32 )
#include "internal/file_mapper_win32.hpp"
#else
#endif

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      struct mmap_holder
      {
         const file_mapper data;

         explicit mmap_holder( const internal::filesystem::path& path )
            : data( path )
         {}

         mmap_holder( const mmap_holder& ) = delete;
         mmap_holder( mmap_holder&& ) = delete;

         ~mmap_holder() = default;

         mmap_holder& operator=( const mmap_holder& ) = delete;
         mmap_holder& operator=( mmap_holder&& ) = delete;
      };

   }  // namespace internal

   template< tracking_mode P = tracking_mode::eager, typename Eol = eol::lf_crlf >
   struct mmap_input
      : private internal::mmap_holder,
        public memory_input< P, Eol >
   {
      mmap_input( const internal::filesystem::path& path, const std::string& source )
         : internal::mmap_holder( path ),
           memory_input< P, Eol >( data.begin(), data.end(), source )
      {}

      explicit mmap_input( const internal::filesystem::path& path )
         : mmap_input( path, internal::path_to_string( path ) )
      {}

      mmap_input( const mmap_input& ) = delete;
      mmap_input( mmap_input&& ) = delete;

      ~mmap_input() = default;

      mmap_input& operator=( const mmap_input& ) = delete;
      mmap_input& operator=( mmap_input&& ) = delete;
   };

   template< typename... Ts >
   explicit mmap_input( Ts&&... ) -> mmap_input<>;

}  // namespace TAO_PEGTL_NAMESPACE

#endif
