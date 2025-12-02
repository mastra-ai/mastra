// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_FILE_READER_HPP
#define TAO_PEGTL_INTERNAL_FILE_READER_HPP

#include <cstdio>
#include <memory>
#include <string>
#include <utility>

#if !defined( __cpp_exceptions )
#include <exception>
#endif

#include "../config.hpp"

#include "filesystem.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   [[nodiscard]] inline std::FILE* file_open( const internal::filesystem::path& path )
   {
      errno = 0;
#if defined( _MSC_VER )
      std::FILE* file;
      if( ::_wfopen_s( &file, path.c_str(), L"rb" ) == 0 ) {
         return file;
      }
#if defined( __cpp_exceptions )
      internal::error_code ec( errno, internal::system_category() );
      throw internal::filesystem::filesystem_error( "_wfopen_s() failed", path, ec );
#else
      std::perror( "_wfopen_s() failed" );
      std::terminate();
#endif
#else
#if defined( __MINGW32__ )
      if( auto* file = std::fopen( path.string().c_str(), "rb" ) )
#else
      if( auto* file = std::fopen( path.c_str(), "rbe" ) )
#endif
      {
         return file;
      }
#if defined( __cpp_exceptions )
      internal::error_code ec( errno, internal::system_category() );
      throw internal::filesystem::filesystem_error( "std::fopen() failed", path, ec );
#else
      std::perror( "std::fopen() failed" );
      std::terminate();
#endif
#endif
   }

   struct file_close
   {
      void operator()( FILE* f ) const noexcept
      {
         std::fclose( f );
      }
   };

   class file_reader
   {
   public:
      explicit file_reader( const internal::filesystem::path& path )
         : file_reader( file_open( path ), path )
      {}

      file_reader( FILE* file, const internal::filesystem::path& path )  // NOLINT(modernize-pass-by-value)
         : m_path( path ),
           m_file( file )
      {}

      file_reader( const file_reader& ) = delete;
      file_reader( file_reader&& ) = delete;

      ~file_reader() = default;

      file_reader& operator=( const file_reader& ) = delete;
      file_reader& operator=( file_reader&& ) = delete;

      [[nodiscard]] std::size_t size() const
      {
         errno = 0;
         if( std::fseek( m_file.get(), 0, SEEK_END ) != 0 ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "std::fseek() failed [SEEK_END]", m_path, ec );
#else
            std::perror( "std::fseek() failed [SEEK_END]" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
         errno = 0;
         const auto s = std::ftell( m_file.get() );
         if( s < 0 ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "std::ftell() failed", m_path, ec );
#else
            std::perror( "std::ftell() failed" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
         errno = 0;
         if( std::fseek( m_file.get(), 0, SEEK_SET ) != 0 ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "std::fseek() failed [SEEK_SET]", m_path, ec );
#else
            std::perror( "std::fseek() failed [SEEK_SET]" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
         return std::size_t( s );
      }

      [[nodiscard]] std::string read() const
      {
         std::string nrv;
         nrv.resize( size() );
         errno = 0;
         if( !nrv.empty() && ( std::fread( &nrv[ 0 ], nrv.size(), 1, m_file.get() ) != 1 ) ) {
            // LCOV_EXCL_START
#if defined( __cpp_exceptions )
            internal::error_code ec( errno, internal::system_category() );
            throw internal::filesystem::filesystem_error( "std::fread() failed", m_path, ec );
#else
            std::perror( "std::fread() failed" );
            std::terminate();
#endif
            // LCOV_EXCL_STOP
         }
         return nrv;
      }

   private:
      const internal::filesystem::path m_path;
      const std::unique_ptr< std::FILE, file_close > m_file;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
