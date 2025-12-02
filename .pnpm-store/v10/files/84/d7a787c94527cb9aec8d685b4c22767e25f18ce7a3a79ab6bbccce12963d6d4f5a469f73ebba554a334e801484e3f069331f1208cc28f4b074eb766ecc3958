// Copyright (c) 2020-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_MSGPACK_EVENTS_FROM_BINARY_HPP
#define TAO_JSON_MSGPACK_EVENTS_FROM_BINARY_HPP

#include <tao/pegtl/memory_input.hpp>

#include "../../binary.hpp"
#include "../../binary_view.hpp"

#include "from_input.hpp"

namespace tao::json::msgpack::events
{
   template< typename Consumer >
   void from_binary( Consumer& consumer, const void* data, const std::size_t size, const char* source = nullptr, const std::size_t byte = 0, const std::size_t line = 1, const std::size_t column = 1 )
   {
      const char* cast = static_cast< const char* >( data );
      pegtl::memory_input< pegtl::tracking_mode::lazy, pegtl::eol::lf_crlf, const char* > in( cast, cast + size, source ? source : "tao::json::msgpack::events::from_binary", byte, line, column );
      msgpack::events::from_input( consumer, std::move( in ) );
   }

   template< typename Consumer >
   void from_binary( Consumer& consumer, const void* data, const std::size_t size, const std::string& source, const std::size_t byte = 0, const std::size_t line = 1, const std::size_t column = 1 )
   {
      msgpack::events::from_binary( consumer, data, size, source.c_str(), byte, line, column );
   }

   template< typename Consumer, typename... Ts >
   void from_binary( Consumer& consumer, const tao::binary& data, Ts&&... ts )
   {
      msgpack::events::from_binary( consumer, data.data(), data.size(), std::forward< Ts >( ts )... );
   }

   template< typename Consumer, typename... Ts >
   void from_binary( Consumer& consumer, const tao::binary_view data, Ts&&... ts )
   {
      msgpack::events::from_binary( consumer, data.data(), data.size(), std::forward< Ts >( ts )... );
   }

}  // namespace tao::json::msgpack::events

#endif
