// Copyright (c) 2016-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_INTERNAL_ACTION_INPUT_HPP
#define TAO_PEGTL_INTERNAL_ACTION_INPUT_HPP

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

#include "iterator.hpp"

#include "../config.hpp"
#include "../position.hpp"

namespace TAO_PEGTL_NAMESPACE::internal
{
   template< typename ParseInput >
   class action_input
   {
   public:
      using input_t = ParseInput;
      using iterator_t = typename ParseInput::iterator_t;

      action_input( const iterator_t& in_begin, const ParseInput& in_input ) noexcept
         : m_begin( in_begin ),
           m_input( in_input )
      {}

      action_input( const action_input& ) = delete;
      action_input( action_input&& ) = delete;

      ~action_input() = default;

      action_input& operator=( const action_input& ) = delete;
      action_input& operator=( action_input&& ) = delete;

      [[nodiscard]] const iterator_t& iterator() const noexcept
      {
         return m_begin;
      }

      [[nodiscard]] const ParseInput& input() const noexcept
      {
         return m_input;
      }

      [[nodiscard]] const char* begin() const noexcept
      {
         if constexpr( std::is_same_v< iterator_t, const char* > ) {
            return iterator();
         }
         else {
            return iterator().data;
         }
      }

      [[nodiscard]] const char* end() const noexcept
      {
         return input().current();
      }

      [[nodiscard]] bool empty() const noexcept
      {
         return begin() == end();
      }

      [[nodiscard]] std::size_t size() const noexcept
      {
         return std::size_t( end() - begin() );
      }

      [[nodiscard]] std::string string() const
      {
         return std::string( begin(), size() );
      }

      [[nodiscard]] std::string_view string_view() const noexcept
      {
         return std::string_view( begin(), size() );
      }

      [[nodiscard]] char peek_char( const std::size_t offset = 0 ) const noexcept
      {
         return begin()[ offset ];
      }

      [[nodiscard]] std::uint8_t peek_uint8( const std::size_t offset = 0 ) const noexcept
      {
         return static_cast< std::uint8_t >( peek_char( offset ) );
      }

      [[nodiscard]] TAO_PEGTL_NAMESPACE::position position() const
      {
         return input().position( iterator() );  // NOTE: Not efficient with lazy inputs.
      }

   protected:
      const iterator_t m_begin;
      const ParseInput& m_input;
   };

}  // namespace TAO_PEGTL_NAMESPACE::internal

#endif
