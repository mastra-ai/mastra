// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_MESSAGE_EXTENSION_HPP
#define TAO_JSON_MESSAGE_EXTENSION_HPP

#include <ostream>
#include <string>

namespace tao::json
{
   template< typename T, typename = void >
   struct message_extension
   {
      const T& m_v;

      explicit message_extension( const T& v ) noexcept
         : m_v( v )
      {}

      friend std::ostream& operator<<( std::ostream& os, const message_extension& /*unused*/ ) noexcept
      {
         return os;
      }
   };

   template< typename T >
   struct message_extension< T, decltype( (void)std::declval< const T& >().public_base().append_message_extension( std::declval< std::ostream& >() ) ) >
   {
      const T& m_v;

      explicit message_extension( const T& v ) noexcept
         : m_v( v )
      {}

      friend std::ostream& operator<<( std::ostream& os, const message_extension& v )
      {
         os << ' ';
         v.m_v.public_base().append_message_extension( os );
         return os;
      }
   };

   template< typename T >
   message_extension( const T& ) -> message_extension< T >;

}  // namespace tao::json

#endif
