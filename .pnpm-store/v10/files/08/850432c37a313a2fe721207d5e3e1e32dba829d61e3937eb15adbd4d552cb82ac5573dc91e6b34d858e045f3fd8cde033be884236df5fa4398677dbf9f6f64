// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_LIMIT_NESTING_DEPTH_HPP
#define TAO_JSON_EVENTS_LIMIT_NESTING_DEPTH_HPP

#include <cstddef>
#include <cstdint>

#include <stdexcept>

namespace tao::json::events
{
   template< typename Consumer, std::size_t Limit >
   class limit_nesting_depth
      : public Consumer
   {
   private:
      std::size_t m_depth = 0;

      void count_and_limit()
      {
         if( ++m_depth > Limit ) {
            throw std::runtime_error( "nesting depth limit exceeded" );
         }
      }

   public:
      using Consumer::Consumer;

      void begin_array()
      {
         count_and_limit();
         Consumer::begin_array();
      }

      void begin_array( const std::size_t size )
      {
         count_and_limit();
         Consumer::begin_array( size );
      }

      void end_array()
      {
         Consumer::end_array();
         --m_depth;
      }

      void end_array( const std::size_t size )
      {
         Consumer::end_array( size );
         --m_depth;
      }

      void begin_object()
      {
         count_and_limit();
         Consumer::begin_object();
      }

      void begin_object( const std::size_t size )
      {
         count_and_limit();
         Consumer::begin_object( size );
      }

      void end_object()
      {
         Consumer::end_object();
         --m_depth;
      }

      void end_object( const std::size_t size )
      {
         Consumer::end_object( size );
         --m_depth;
      }
   };

}  // namespace tao::json::events

#endif
