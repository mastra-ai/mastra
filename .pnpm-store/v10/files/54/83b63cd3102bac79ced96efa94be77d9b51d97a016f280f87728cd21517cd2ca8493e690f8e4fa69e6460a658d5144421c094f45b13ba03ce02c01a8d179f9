// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_FILE_MAPPER_WIN32_HPP
#define TAO_PEGTL_INTERNAL_FILE_MAPPER_WIN32_HPP

#if !defined( NOMINMAX )
#define NOMINMAX
#define TAO_PEGTL_NOMINMAX_WAS_DEFINED
#endif

#if !defined( WIN32_LEAN_AND_MEAN )
#define WIN32_LEAN_AND_MEAN
#define TAO_PEGTL_WIN32_LEAN_AND_MEAN_WAS_DEFINED
#endif

#include <windows.h>

#if defined( TAO_PEGTL_NOMINMAX_WAS_DEFINED )
#undef NOMINMAX
#undef TAO_PEGTL_NOMINMAX_WAS_DEFINED
#endif

#if defined( TAO_PEGTL_WIN32_LEAN_AND_MEAN_WAS_DEFINED )
#undef WIN32_LEAN_AND_MEAN
#undef TAO_PEGTL_WIN32_LEAN_AND_MEAN_WAS_DEFINED
#endif

#include "../config.hpp"

#if !defined( __cpp_exceptions )
#include <cstdio>
#include <exception>
#endif

#include "filesystem.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   struct file_opener
   {
      explicit file_opener( const internal::filesystem::path& path )
         : m_path( path ),
           m_handle( open() )
      {}

      file_opener( const file_opener& ) = delete;
      file_opener( file_opener&& ) = delete;

      ~file_opener()
      {
         ::CloseHandle( m_handle );
      }

      file_opener& operator=( const file_opener& ) = delete;
      file_opener& operator=( file_opener&& ) = delete;

      [[nodiscard]] std::size_t size() const
      {
         LARGE_INTEGER size;
         if( !::GetFileSizeEx( m_handle, &size ) ) {
#if defined( __cpp_exceptions )
            internal::error_code ec( ::GetLastError(), internal::system_category() );
            throw internal::filesystem::filesystem_error( "GetFileSizeEx() failed", m_path, ec );
#else
            std::perror( "GetFileSizeEx() failed" );
            std::terminate();
#endif
         }
         return std::size_t( size.QuadPart );
      }

      const internal::filesystem::path m_path;
      const HANDLE m_handle;

   private:
      [[nodiscard]] HANDLE open() const
      {
         SetLastError( 0 );
#if( _WIN32_WINNT >= 0x0602 )
         const HANDLE handle = ::CreateFile2( m_path.c_str(),
                                              GENERIC_READ,
                                              FILE_SHARE_READ,
                                              OPEN_EXISTING,
                                              nullptr );
         if( handle != INVALID_HANDLE_VALUE ) {
            return handle;
         }
#if defined( __cpp_exceptions )
         internal::error_code ec( ::GetLastError(), internal::system_category() );
         throw internal::filesystem::filesystem_error( "CreateFile2() failed", m_path, ec );
#else
         std::perror( "CreateFile2() failed" );
         std::terminate();
#endif
#else
         const HANDLE handle = ::CreateFileW( m_path.c_str(),
                                              GENERIC_READ,
                                              FILE_SHARE_READ,
                                              nullptr,
                                              OPEN_EXISTING,
                                              FILE_ATTRIBUTE_NORMAL,
                                              nullptr );
         if( handle != INVALID_HANDLE_VALUE ) {
            return handle;
         }
#if defined( __cpp_exceptions )
         internal::error_code ec( ::GetLastError(), internal::system_category() );
         throw internal::filesystem::filesystem_error( "CreateFileW()", m_path, ec );
#else
         std::perror( "CreateFileW() failed" );
         std::terminate();
#endif
#endif
      }
   };

   struct win32_file_mapper
   {
      explicit win32_file_mapper( const internal::filesystem::path& path )
         : win32_file_mapper( file_opener( path ) )
      {}

      explicit win32_file_mapper( const file_opener& reader )
         : m_size( reader.size() ),
           m_handle( open( reader ) )
      {}

      win32_file_mapper( const win32_file_mapper& ) = delete;
      win32_file_mapper( win32_file_mapper&& ) = delete;

      ~win32_file_mapper()
      {
         ::CloseHandle( m_handle );
      }

      win32_file_mapper& operator=( const win32_file_mapper& ) = delete;
      win32_file_mapper& operator=( win32_file_mapper&& ) = delete;

      const size_t m_size;
      const HANDLE m_handle;

   private:
      [[nodiscard]] HANDLE open( const file_opener& reader ) const
      {
         const uint64_t file_size = reader.size();
         SetLastError( 0 );
         // Use `CreateFileMappingW` because a) we're not specifying a
         // mapping name, so the character type is of no consequence, and
         // b) it's defined in `memoryapi.h`, unlike
         // `CreateFileMappingA`(?!)
         const HANDLE handle = ::CreateFileMappingW( reader.m_handle,
                                                     nullptr,
                                                     PAGE_READONLY,
                                                     DWORD( file_size >> 32 ),
                                                     DWORD( file_size & 0xffffffff ),
                                                     nullptr );
         if( handle != NULL || file_size == 0 ) {
            return handle;
         }
#if defined( __cpp_exceptions )
         internal::error_code ec( ::GetLastError(), internal::system_category() );
         throw internal::filesystem::filesystem_error( "CreateFileMappingW() failed", reader.m_path, ec );
#else
         std::perror( "CreateFileMappingW() failed" );
         std::terminate();
#endif
      }
   };

   class file_mapper
   {
   public:
      explicit file_mapper( const internal::filesystem::path& path )
         : file_mapper( win32_file_mapper( path ) )
      {}

      explicit file_mapper( const win32_file_mapper& mapper )
         : m_size( mapper.m_size ),
           m_data( static_cast< const char* >( ::MapViewOfFile( mapper.m_handle,
                                                                FILE_MAP_READ,
                                                                0,
                                                                0,
                                                                0 ) ) )
      {
         if( ( m_size != 0 ) && ( intptr_t( m_data ) == 0 ) ) {
#if defined( __cpp_exceptions )
            internal::error_code ec( ::GetLastError(), internal::system_category() );
            throw internal::filesystem::filesystem_error( "MapViewOfFile() failed", ec );
#else
            std::perror( "MapViewOfFile() failed" );
            std::terminate();
#endif
         }
      }

      file_mapper( const file_mapper& ) = delete;
      file_mapper( file_mapper&& ) = delete;

      ~file_mapper()
      {
         ::UnmapViewOfFile( LPCVOID( m_data ) );
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
