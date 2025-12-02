// Copyright (c) 2022-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_EVENTS_CAPTURE_HPP
#define TAO_JSON_EVENTS_CAPTURE_HPP

#include <initializer_list>
#include <string_view>
#include <type_traits>
#include <utility>

#include "produce.hpp"

#include "../forward.hpp"

namespace tao::json::events
{
   class virtual_base;

   namespace capture
   {
      template< template< typename... > class Traits = traits, typename ConsumerBase = virtual_base >
      class value;

      template< template< typename... > class Traits = traits, typename ConsumerBase = virtual_base >
      using array = std::initializer_list< value< Traits, ConsumerBase > >;

      template< template< typename... > class Traits, typename ConsumerBase >
      struct member;

      template< template< typename... > class Traits = traits, typename ConsumerBase = virtual_base >
      using object = std::initializer_list< member< Traits, ConsumerBase > >;

   }  // namespace capture

   template< template< typename... > class Traits, typename Consumer, typename ConsumerBase >
   void produce( Consumer& c, const capture::value< Traits, ConsumerBase >& v )
   {
      v.produce( c );
   }

   template< template< typename... > class Traits, typename Consumer, typename ConsumerBase >
   void produce_elements( Consumer& c, const capture::array< Traits, ConsumerBase >& a )
   {
      for( const auto& e : a ) {
         e.produce( c );
         c.element();
      }
   }

   template< template< typename... > class Traits, typename Consumer, typename ConsumerBase >
   void produce( Consumer& c, const capture::array< Traits, ConsumerBase >& a )
   {
      c.begin_array( a.size() );
      events::produce_elements( c, a );
      c.end_array( a.size() );
   }

   template< template< typename... > class Traits, typename Consumer, typename ConsumerBase >
   void produce_members( Consumer& c, const capture::object< Traits, ConsumerBase >& o )
   {
      for( const auto& m : o ) {
         c.key( m.key );
         m.produce( c );
         c.member();
      }
   }

   template< template< typename... > class Traits, typename Consumer, typename ConsumerBase >
   void produce( Consumer& c, const capture::object< Traits, ConsumerBase >& o )
   {
      c.begin_object( o.size() );
      events::produce_members( c, o );
      c.end_object( o.size() );
   }

   namespace capture
   {
      union union_t
      {
         const void* p;
         bool b;
         char c;
         signed char sc;
         unsigned char uc;
         signed short ss;
         unsigned short us;
         signed int si;
         unsigned int ui;
         signed long sl;
         unsigned long ul;
         signed long long sll;
         unsigned long long ull;
         float f;
         double d;

         // clang-format off
         explicit union_t( const void* v ) noexcept : p( v ) {}
         explicit union_t( const bool v ) noexcept : b( v ) {}
         explicit union_t( const char v ) noexcept : c( v ) {}
         explicit union_t( const signed char v ) noexcept : sc( v ) {}
         explicit union_t( const unsigned char v ) noexcept : uc( v ) {}
         explicit union_t( const signed short v ) noexcept : ss( v ) {}
         explicit union_t( const unsigned short v ) noexcept : us( v ) {}
         explicit union_t( const signed int v ) noexcept : si( v ) {}
         explicit union_t( const unsigned int v ) noexcept : ui( v ) {}
         explicit union_t( const signed long v ) noexcept : sl( v ) {}
         explicit union_t( const unsigned long v ) noexcept : ul( v ) {}
         explicit union_t( const signed long long v ) noexcept : sll( v ) {}
         explicit union_t( const unsigned long long v ) noexcept : ull( v ) {}
         explicit union_t( const float v ) noexcept : f( v ) {}
         explicit union_t( const double v ) noexcept : d( v ) {}

         explicit operator bool() const noexcept { return b; }
         explicit operator char() const noexcept { return c; }
         explicit operator signed char() const noexcept { return sc; }
         explicit operator unsigned char() const noexcept { return uc; }
         explicit operator signed short() const noexcept { return ss; }
         explicit operator unsigned short() const noexcept { return us; }
         explicit operator signed int() const noexcept { return si; }
         explicit operator unsigned int() const noexcept { return ui; }
         explicit operator signed long() const noexcept { return sl; }
         explicit operator unsigned long() const noexcept { return ul; }
         explicit operator signed long long() const noexcept { return sll; }
         explicit operator unsigned long long() const noexcept { return ull; }
         explicit operator float() const noexcept { return f; }
         explicit operator double() const noexcept { return d; }
         // clang-format on
      };

      template< typename, typename = void >
      struct capture_traits
         : std::false_type
      {};

      template< typename T >
      struct capture_traits< T, std::enable_if_t< std::is_pointer_v< std::decay_t< T > > > >
         : std::true_type
      {
         [[nodiscard]] static const void* to_underlying( const T v ) noexcept
         {
            return v;
         }

         [[nodiscard]] static auto from_underlying( const union_t& v ) noexcept
         {
            return std::decay_t< T >( v.p );
         }
      };

      template< typename T >
      struct capture_traits< T, std::enable_if_t< std::is_arithmetic_v< T > > >
         : std::true_type
      {
         [[nodiscard]] static T to_underlying( const T v ) noexcept
         {
            return v;
         }

         [[nodiscard]] static T from_underlying( const union_t& v ) noexcept
         {
            return static_cast< T >( v );
         }
      };

      template< typename T >
      struct capture_traits< T, std::enable_if_t< std::is_enum_v< T > > >
         : std::true_type
      {
         using underlying_t = std::underlying_type_t< T >;

         [[nodiscard]] static underlying_t to_underlying( const T v ) noexcept
         {
            return static_cast< underlying_t >( v );
         }

         [[nodiscard]] static T from_underlying( const union_t& v ) noexcept
         {
            return static_cast< T >( static_cast< underlying_t >( v ) );
         }
      };

      namespace internal
      {
         template< template< typename... > class Traits, typename Consumer, typename T >
         void produce_from_underlying( Consumer& c, const union_t& u )
         {
            events::produce< Traits >( c, capture_traits< T >::from_underlying( u ) );
         }

         template< template< typename... > class Traits, typename Consumer, typename T >
         void produce_from_pointer( Consumer& c, const union_t& u )
         {
            events::produce< Traits >( c, *static_cast< const T* >( u.p ) );
         }

      }  // namespace internal

      template< template< typename... > class Traits, typename ConsumerBase >
      class value
      {
      private:
         const union_t m_value;

         using producer_t = void( ConsumerBase&, const union_t& );
         producer_t* const m_producer;

      public:
         template< typename T, typename = std::enable_if_t< capture_traits< T >::value > >
         value( const T v ) noexcept
            : m_value( capture_traits< T >::to_underlying( v ) ),
              m_producer( &internal::produce_from_underlying< Traits, ConsumerBase, T > )
         {
            static_assert( noexcept( capture_traits< T >::to_underlying( v ) ) );
         }

         template< typename T, typename = std::enable_if_t< !capture_traits< T >::value > >
         value( const T& v ) noexcept
            : m_value( &v ),
              m_producer( &internal::produce_from_pointer< Traits, ConsumerBase, T > )
         {}

         value( const object< Traits, ConsumerBase >& il ) noexcept
            : m_value( &il ),
              m_producer( &internal::produce_from_pointer< Traits, ConsumerBase, object< Traits, ConsumerBase > > )
         {}

         void produce( ConsumerBase& c ) const
         {
            m_producer( c, m_value );
         }
      };

      template< template< typename... > class Traits, typename ConsumerBase >
      struct member
         : value< Traits, ConsumerBase >
      {
         const std::string_view key;

         template< typename T >
         member( const std::string_view k, T&& v ) noexcept
            : value< Traits, ConsumerBase >( std::forward< T >( v ) ),
              key( k )
         {}

         template< typename T >
         member( T&& v ) noexcept
            : member( Traits< std::decay_t< T > >::template default_key< Traits >::as_string_view(), std::forward< T >( v ) )
         {}

         member( const std::string_view k, const object< Traits, ConsumerBase >& il ) noexcept
            : value< Traits, ConsumerBase >( il ),
              key( k )
         {}

         member( const member& ) = delete;
         member( member&& ) = delete;

         ~member() = default;

         void operator=( const member& ) = delete;
         void operator=( member&& ) = delete;
      };

      template< template< typename... > class Traits, typename Consumer >
      class assign_t
      {
      private:
         Consumer& m_consumer;

      public:
         explicit assign_t( Consumer& consumer ) noexcept
            : m_consumer( consumer )
         {}

         assign_t& operator=( const value< Traits, Consumer >& v )
         {
            produce< Traits >( m_consumer, v );
            return *this;
         }

         template< typename ConsumerBase >
         assign_t& operator=( const value< Traits, ConsumerBase >& v )
         {
            produce< Traits >( m_consumer, v );
            return *this;
         }

         template< typename ConsumerBase >
         assign_t& operator=( const array< Traits, ConsumerBase >& v )
         {
            produce< Traits >( m_consumer, v );
            return *this;
         }

         template< typename ConsumerBase >
         assign_t& operator=( const object< Traits, ConsumerBase >& v )
         {
            produce< Traits >( m_consumer, v );
            return *this;
         }

         [[nodiscard]] Consumer& consumer() noexcept
         {
            return m_consumer;
         }

         [[nodiscard]] const Consumer& consumer() const noexcept
         {
            return m_consumer;
         }
      };

      template< template< typename... > class Traits, typename Consumer >
      class array_t
      {
      private:
         Consumer& m_consumer;

      public:
         explicit array_t( Consumer& consumer ) noexcept( noexcept( m_consumer.begin_array() ) )
            : m_consumer( consumer )
         {
            m_consumer.begin_array();
         }

         array_t( const array_t& ) = delete;
         array_t( array_t&& ) = delete;

         ~array_t()
         {
            m_consumer.end_array();
         }

         array_t& operator=( const array_t& ) = delete;
         array_t& operator=( array_t&& ) = delete;

         array_t& operator+=( const array< Traits, Consumer >& v )
         {
            produce_elements< Traits >( m_consumer, v );
            return *this;
         }

         template< typename ConsumerBase >
         array_t& operator+=( const array< Traits, ConsumerBase >& v )
         {
            produce_elements< Traits >( m_consumer, v );
            return *this;
         }

         template< typename Container >
         void append( const Container& c )
         {
            for( const auto& e : c ) {
               this->push_back( e );
            }
         }

         template< typename V >
         void push_back( V&& v )
         {
            events::produce< Traits >( m_consumer, std::forward< V >( v ) );
            m_consumer.element();
         }

         [[nodiscard]] Consumer& consumer() noexcept
         {
            return m_consumer;
         }

         [[nodiscard]] const Consumer& consumer() const noexcept
         {
            return m_consumer;
         }
      };

      template< template< typename... > class Traits, typename Consumer >
      class object_t
      {
      private:
         Consumer& m_consumer;

      public:
         explicit object_t( Consumer& consumer ) noexcept( noexcept( m_consumer.begin_object() ) )
            : m_consumer( consumer )
         {
            m_consumer.begin_object();
         }

         object_t( const object_t& ) = delete;
         object_t( object_t&& ) = delete;

         ~object_t()
         {
            m_consumer.end_object();
         }

         object_t& operator=( const object_t& ) = delete;
         object_t& operator=( object_t&& ) = delete;

         object_t& operator+=( const object< Traits, Consumer >& v )
         {
            produce_members< Traits >( m_consumer, v );
            return *this;
         }

         template< typename ConsumerBase >
         object_t& operator+=( const object< Traits, ConsumerBase >& v )
         {
            produce_members< Traits >( m_consumer, v );
            return *this;
         }

         template< typename Container >
         void append( const Container& c )
         {
            for( const auto& [ k, v ] : c ) {
               this->insert( k, v );
            }
         }

         template< typename K, typename V >
         void insert( K&& k, V&& v )
         {
            m_consumer.key( std::forward< K >( k ) );
            events::produce< Traits >( m_consumer, std::forward< V >( v ) );
            m_consumer.member();
         }

         template< typename V >
         void insert( V&& v )
         {
            this->insert( Traits< std::decay_t< V > >::template default_key< Traits >::as_string_view(), std::forward< V >( v ) );
         }

         [[nodiscard]] Consumer& consumer() noexcept
         {
            return m_consumer;
         }

         [[nodiscard]] const Consumer& consumer() const noexcept
         {
            return m_consumer;
         }
      };

   }  // namespace capture

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::assign_t< Traits, Consumer > assign( Consumer& c ) noexcept( noexcept( capture::assign_t< Traits, Consumer >( c ) ) )
   {
      return capture::assign_t< Traits, Consumer >( c );
   }

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::assign_t< Traits, Consumer > assign( Consumer&& c ) noexcept( noexcept( assign< Traits >( c ) ) )
   {
      return assign< Traits >( c );
   }

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::array_t< Traits, Consumer > array( Consumer& c ) noexcept( noexcept( capture::array_t< Traits, Consumer >( c ) ) )
   {
      return capture::array_t< Traits, Consumer >( c );
   }

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::array_t< Traits, Consumer > array( Consumer&& c ) noexcept( noexcept( array< Traits >( c ) ) )
   {
      return array< Traits >( c );
   }

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::object_t< Traits, Consumer > object( Consumer& c ) noexcept( noexcept( capture::object_t< Traits, Consumer >( c ) ) )
   {
      return capture::object_t< Traits, Consumer >( c );
   }

   template< template< typename... > class Traits = traits, typename Consumer >
   [[nodiscard]] capture::object_t< Traits, Consumer > object( Consumer&& c ) noexcept( noexcept( object< Traits >( c ) ) )
   {
      return object< Traits >( c );
   }

}  // namespace tao::json::events

#endif
