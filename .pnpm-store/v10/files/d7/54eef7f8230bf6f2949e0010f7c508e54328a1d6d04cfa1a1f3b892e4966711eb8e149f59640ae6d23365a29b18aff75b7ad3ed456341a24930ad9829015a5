// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_FILE_MAPPER_POSIX_HPP
#define TAO_PEGTL_INTERNAL_FILE_MAPPER_POSIX_HPP

#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#if !defined( __cpp_exceptions )
#include <cstdio>
#include <exception>
#endif

#include <utility>

#include "../config.hpp"

#include "filesystem.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct file_opener
   {
      explicit file_opener( const internal::filesystem::path& path )  // NOLINT(modernize-pass-by-value)
         : m_path( path ),
           m_fd( open() )
      {}

      file_opener( const file_opener& ) = delete;
      file_opener( file_opener&& ) = delete;

      ~file_opener()
      {
         ::close( m_fd );
      }

      file_opener& operator=( const file_opener& ) = delete;
      file_opener& operator=( file_opener&& ) = delete;

      [[nodiscard]] std::size_t size() const
      {
         struct stat st;
         errno = 0;
         if( ::fstat( m_fd, &st ) < 0 ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "fstat() failed", m_path, ec );
#else
            std::perror( "fstat() failed" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
         return std::size_t( st.st_size );
      }

      const internal::filesystem::path m_path;
      const int m_fd;

   private:
      [[nodiscard]] int open() const
      {
         errno = 0;
         const int fd = ::open( m_path.c_str(),
                                O_RDONLY
#if defined( O_CLOEXEC )
                                   | O_CLOEXEC
#endif
         );
         if( fd >= 0 ) {
            return fd;
         }
#if defined( __cpp_exceptions )
         internal::error_code ec( errno, internal::system_category() );
         throw internal::filesystem::filesystem_error( "open() failed", m_path, ec );
#else
         std::perror( "open() failed" );
         std::terminate();
#endif
      }
   };

   class file_mapper
   {
   public:
      explicit file_mapper( const internal::filesystem::path& path )
         : file_mapper( file_opener( path ) )
      {}

      explicit file_mapper( const file_opener& reader )
         : m_size( reader.size() ),
           m_data( static_cast< const char* >( ::mmap( nullptr, m_size, PROT_READ, MAP_PRIVATE, reader.m_fd, 0 ) ) )
      {
         if( ( m_size != 0 ) && ( intptr_t( m_data ) == -1 ) ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "mmap() failed", reader.m_path, ec );
#else
            std::perror( "mmap() failed" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
      }

      file_mapper( const file_mapper& ) = delete;
      file_mapper( file_mapper&& ) = delete;

      ~file_mapper()
      {
         // Legacy C interface requires pointer-to-mutable but does not write through the pointer.
         ::munmap( const_cast< char* >( m_data ), m_size );
      }

      file_mapper& operator=( const file_mapper& ) = delete;
      file_mapper& operator=( file_mapper&& ) = delete;

      [[nodiscard]] bool empty() const noexcept
      {
         return m_size == 0;
      }

      [[nodiscard]] std::size_t size() const noexcept
      {
         return m_size;
      }

      using iterator = const char*;
      using const_iterator = const char*;

      [[nodiscard]] iterator data() const noexcept
      {
         return m_data;
      }

      [[nodiscard]] iterator begin() const noexcept
      {
         return m_data;
      }

      [[nodiscard]] iterator end() const noexcept
      {
         return m_data + m_size;
      }

   private:
      const std::size_t m_size;
      const char* const m_data;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
