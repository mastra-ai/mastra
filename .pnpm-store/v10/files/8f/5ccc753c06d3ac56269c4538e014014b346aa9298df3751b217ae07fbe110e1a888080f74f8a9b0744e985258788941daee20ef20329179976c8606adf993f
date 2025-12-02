// Copyright (c) 2016-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_DISCARD_HPP
#define TAO_JSON_EVENTS_DISCARD_HPP

#include <cstddef>
#include <cstdint>
#include <string_view>

#include "../binary_view.hpp"

namespace tao::json::events
{
   // Events consumer that discards events.

   struct discard
   {
      void null() noexcept {}

      void boolean( const bool /*unused*/ ) noexcept {}

      void number( const std::int64_t /*unused*/ ) noexcept {}
      void number( const std::uint64_t /*unused*/ ) noexcept {}
      void number( const double /*unused*/ ) noexcept {}

      void string( const std::string_view /*unused*/ ) noexcept {}

      void binary( const tao::binary_view /*unused*/ ) noexcept {}

      void begin_array( const std::size_t /*unused*/ = 0 ) noexcept {}
      void element() noexcept {}
      void end_array( const std::size_t /*unused*/ = 0 ) noexcept {}

      void begin_object( const std::size_t /*unused*/ = 0 ) noexcept {}
      void key( const std::string_view /*unused*/ ) noexcept {}
      void member() noexcept {}
      void end_object( const std::size_t /*unused*/ = 0 ) noexcept {}
   };

}  // namespace tao::json::events

#endif
