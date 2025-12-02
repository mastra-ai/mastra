// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_POSITION_HPP
#define TAO_JSON_CONTRIB_POSITION_HPP

#include <ostream>
#include <string>
#include <type_traits>
#include <utility>

#include "../events/to_value.hpp"
#include "../events/transformer.hpp"
#include "../internal/filesystem.hpp"

#include "../from_file.hpp"
#include "../message_extension.hpp"
#include "../value.hpp"

namespace tao::json
{
   struct position
   {
   private:
      std::size_t m_line = 0;
      std::size_t m_column = 0;
      std::string m_source;

   public:
      position() = default;

      position( std::string in_source, const std::size_t in_line, const std::size_t in_column )
         : m_line( in_line ),
           m_column( in_column ),
           m_source( std::move( in_source ) )
      {}

      position( const position& ) = default;

      position( position&& p ) noexcept
      {
         m_line = p.m_line;
         m_column = p.m_column;
         m_source = std::move( p.m_source );
      }

      ~position() = default;

      position& operator=( const position& ) = default;

      position& operator=( position&& p ) noexcept
      {
         m_line = p.m_line;
         m_column = p.m_column;
         m_source = std::move( p.m_source );
         return *this;
      }

      [[nodiscard]] const std::string& source() const noexcept
      {
         return m_source;
      }

      [[nodiscard]] std::size_t line() const noexcept
      {
         return m_line;
      }

      [[nodiscard]] std::size_t column() const noexcept
      {
         return m_column;
      }

      void set_source( const std::string& s )
      {
         m_source = s;
      }

      template< typename T >
      void set_position( const T& p )
      {
         m_line = p.line;
         m_column = p.column;
         m_source = p.source;
      }

      void append_message_extension( std::ostream& os ) const
      {
         os << '[' << m_source << ':' << m_line << ':' << m_column << ']';
      }
   };

   namespace internal
   {
      template< typename Rule >
      struct position_action
         : action< Rule >
      {};

      template<>
      struct position_action< rules::object::begin >
      {
         template< typename Input, typename Consumer >
         static void apply( const Input& in, Consumer& consumer )
         {
            action< rules::object::begin >::apply0( consumer );
            consumer.stack_.back().set_position( in.position() );
         }
      };

      template<>
      struct position_action< rules::array::begin >
      {
         template< typename Input, typename Consumer >
         static void apply( const Input& in, Consumer& consumer )
         {
            action< rules::array::begin >::apply0( consumer );
            consumer.stack_.back().set_position( in.position() );
         }
      };

      template<>
      struct position_action< rules::sor_value >
      {
         template< typename Input, typename Consumer >
         static void apply( const Input& in, Consumer& consumer )
         {
            consumer.value.set_position( in.position() );
         }
      };

      template< template< typename... > class Traits >
      struct position_traits
         : Traits< void >
      {
         template< typename >
         using public_base = position;
      };

   }  // namespace internal

   template< template< typename... > class Traits >
   struct make_position_traits
   {
      template< typename T >
      using type = std::conditional_t< std::is_same_v< T, void >, internal::position_traits< Traits >, Traits< T > >;
   };

   template< template< typename... > class Traits, template< typename... > class... Transformers >
   [[nodiscard]] auto basic_from_file_with_position( const internal::filesystem::path& path )
   {
      events::transformer< events::to_basic_value< Traits >, Transformers... > consumer;
      pegtl::file_input< pegtl::tracking_mode::eager > in( path );
      pegtl::parse< internal::grammar, internal::position_action, internal::errors >( in, consumer );
      return std::move( consumer.value );
   }

   template< template< typename... > class... Transformers >
   [[nodiscard]] auto from_file_with_position( const internal::filesystem::path& path )
   {
      return basic_from_file_with_position< make_position_traits< traits >::template type, Transformers... >( path );
   }

}  // namespace tao::json

#endif
