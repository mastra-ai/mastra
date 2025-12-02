// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_PARSE_ERROR_HPP
#define TAO_PEGTL_PARSE_ERROR_HPP

#include <cstddef>
#include <memory>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "config.hpp"
#include "position.hpp"

namespace TAO_PEGTL_NAMESPACE
{
   namespace internal
   {
      class parse_error
      {
      private:
         std::string m_msg;
         std::size_t m_prefix = 0;
         std::vector< position > m_positions;

      public:
         explicit parse_error( const char* msg )
            : m_msg( msg )
         {}

         [[nodiscard]] const char* what() const noexcept
         {
            return m_msg.c_str();
         }

         [[nodiscard]] std::string_view message() const noexcept
         {
            return { m_msg.data() + m_prefix, m_msg.size() - m_prefix };
         }

         [[nodiscard]] const std::vector< position >& positions() const noexcept
         {
            return m_positions;
         }

         void add_position( position&& p )
         {
            const auto prefix = to_string( p );
            m_msg = prefix + ": " + m_msg;
            m_prefix += prefix.size() + 2;
            m_positions.emplace_back( std::move( p ) );
         }
      };

   }  // namespace internal

   class parse_error
      : public std::runtime_error
   {
   private:
      std::shared_ptr< internal::parse_error > m_impl;

   public:
      parse_error( const char* msg, position p )
         : std::runtime_error( msg ),
           m_impl( std::make_shared< internal::parse_error >( msg ) )
      {
         m_impl->add_position( std::move( p ) );
      }

      parse_error( const std::string& msg, position p )
         : parse_error( msg.c_str(), std::move( p ) )
      {}

      template< typename ParseInput >
      parse_error( const char* msg, const ParseInput& in )
         : parse_error( msg, in.position() )
      {}

      template< typename ParseInput >
      parse_error( const std::string& msg, const ParseInput& in )
         : parse_error( msg, in.position() )
      {}

      [[nodiscard]] const char* what() const noexcept override
      {
         return m_impl->what();
      }

      [[nodiscard]] std::string_view message() const noexcept
      {
         return m_impl->message();
      }

      [[nodiscard]] const std::vector< position >& positions() const noexcept
      {
         return m_impl->positions();
      }

      void add_position( position&& p )
      {
         if( m_impl.use_count() > 1 ) {
            m_impl = std::make_shared< internal::parse_error >( *m_impl );
         }
         m_impl->add_position( std::move( p ) );
      }

      void add_position( const position& p )
      {
         add_position( position( p ) );
      }
   };

}  // namespace TAO_PEGTL_NAMESPACE

#endif
