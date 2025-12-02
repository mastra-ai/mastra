// Copyright (c) 2017-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_BASIC_VALUE_HPP
#define TAO_JSON_BASIC_VALUE_HPP

#include <cassert>
#include <cstddef>
#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

#include "events/virtual_base.hpp"

#include "internal/escape.hpp"
#include "internal/format.hpp"
#include "internal/identity.hpp"
#include "internal/pair.hpp"
#include "internal/single.hpp"
#include "internal/type_traits.hpp"

#include "binary.hpp"
#include "binary_view.hpp"
#include "forward.hpp"
#include "message_extension.hpp"
#include "pointer.hpp"
#include "type.hpp"

namespace tao::json
{
   template< template< typename... > class Traits >
   class basic_value  // NOLINT(cppcoreguidelines-special-member-functions)
      : public Traits< void >::template public_base< basic_value< Traits > >
   {
   public:
      using public_base_t = typename Traits< void >::template public_base< basic_value< Traits > >;

      static_assert( std::is_nothrow_destructible_v< public_base_t > );

      using array_t = std::vector< basic_value >;
      using object_t = std::map< std::string, basic_value, std::less<> >;

   private:
      using variant_t = std::variant< uninitialized_t,
                                      null_t,
                                      bool,
                                      std::int64_t,
                                      std::uint64_t,
                                      double,
                                      std::string,
                                      std::string_view,
                                      tao::binary,
                                      tao::binary_view,
                                      array_t,
                                      object_t,
                                      const basic_value*,
                                      internal::opaque_ptr_t >;

      static_assert( std::is_nothrow_destructible_v< variant_t > );

      variant_t m_variant;

   public:
      basic_value() = default;

      basic_value( const basic_value& r ) = default;
      basic_value( basic_value&& r ) = default;  // NOLINT(performance-noexcept-move-constructor)

#if( __cplusplus > 201703L )

      template< typename T,
                typename D = std::decay_t< T >,
                typename = decltype( Traits< D >::assign( std::declval< basic_value& >(), std::declval< T&& >() ) ) >
      explicit( !internal::enable_implicit_constructor< Traits, D > ) basic_value( T&& v, public_base_t b = public_base_t() ) noexcept( noexcept( Traits< D >::assign( std::declval< basic_value& >(), std::forward< T >( v ) ) ) && std::is_nothrow_move_assignable_v< public_base_t > )
         : public_base_t( std::move( b ) )
      {
         Traits< D >::assign( *this, std::forward< T >( v ) );
      }

#else

      template< typename T,
                typename D = std::decay_t< T >,
                typename = std::enable_if_t< internal::enable_implicit_constructor< Traits, D > >,
                typename = decltype( Traits< D >::assign( std::declval< basic_value& >(), std::declval< T&& >() ) ) >
      basic_value( T&& v, public_base_t b = public_base_t() ) noexcept( noexcept( Traits< D >::assign( std::declval< basic_value& >(), std::forward< T >( v ) ) ) && std::is_nothrow_move_assignable_v< public_base_t > )
         : public_base_t( std::move( b ) )
      {
         Traits< D >::assign( *this, std::forward< T >( v ) );
      }

      template< typename T,
                typename D = std::decay_t< T >,
                typename = std::enable_if_t< !internal::enable_implicit_constructor< Traits, D > >,
                typename = decltype( Traits< D >::assign( std::declval< basic_value& >(), std::declval< T&& >() ) ),
                int = 0 >
      explicit basic_value( T&& v, public_base_t b = public_base_t() ) noexcept( noexcept( Traits< D >::assign( std::declval< basic_value& >(), std::forward< T >( v ) ) ) && std::is_nothrow_move_assignable_v< public_base_t > )
         : public_base_t( std::move( b ) )
      {
         Traits< D >::assign( *this, std::forward< T >( v ) );
      }

#endif

      basic_value( std::initializer_list< internal::pair< Traits > >&& l, public_base_t b = public_base_t() )
         : public_base_t( std::move( b ) )
      {
         assign( std::move( l ) );
      }

      basic_value( const std::initializer_list< internal::pair< Traits > >& l, public_base_t b = public_base_t() )
         : public_base_t( std::move( b ) )
      {
         assign( l );
      }

      basic_value( std::initializer_list< internal::pair< Traits > >& l, public_base_t b = public_base_t() )
         : basic_value( static_cast< const std::initializer_list< internal::pair< Traits > >& >( l ), std::move( b ) )
      {}

      ~basic_value() = default;

      [[nodiscard]] static basic_value array( std::initializer_list< internal::single< Traits > >&& l, public_base_t b = public_base_t() )
      {
         basic_value v( uninitialized, std::move( b ) );
         v.append( std::move( l ) );
         return v;
      }

      [[nodiscard]] static basic_value array( const std::initializer_list< internal::single< Traits > >& l, public_base_t b = public_base_t() )
      {
         basic_value v( uninitialized, std::move( b ) );
         v.append( l );
         return v;
      }

      [[nodiscard]] static basic_value object( std::initializer_list< internal::pair< Traits > >&& l, public_base_t b = public_base_t() )
      {
         basic_value v( uninitialized, std::move( b ) );
         v.insert( std::move( l ) );
         return v;
      }

      [[nodiscard]] static basic_value object( const std::initializer_list< internal::pair< Traits > >& l, public_base_t b = public_base_t() )
      {
         basic_value v( uninitialized, std::move( b ) );
         v.insert( l );
         return v;
      }

      basic_value& operator=( basic_value v ) noexcept( std::is_nothrow_move_assignable_v< variant_t >&& std::is_nothrow_move_assignable_v< public_base_t > )
      {
         m_variant = std::move( v.m_variant );
         public_base_t::operator=( static_cast< public_base_t&& >( v ) );
         return *this;
      }

      [[nodiscard]] public_base_t& public_base() noexcept
      {
         return static_cast< public_base_t& >( *this );
      }

      [[nodiscard]] const public_base_t& public_base() const noexcept
      {
         return static_cast< const public_base_t& >( *this );
      }

      [[nodiscard]] json::type type() const noexcept
      {
         return static_cast< json::type >( m_variant.index() );
      }

      [[nodiscard]] explicit operator bool() const noexcept
      {
         return !is_uninitialized();
      }

      [[nodiscard]] bool is_uninitialized() const noexcept
      {
         return std::holds_alternative< uninitialized_t >( m_variant );
      }

      [[nodiscard]] bool is_null() const noexcept
      {
         return std::holds_alternative< null_t >( m_variant );
      }

      [[nodiscard]] bool is_boolean() const noexcept
      {
         return std::holds_alternative< bool >( m_variant );
      }

      [[nodiscard]] bool is_signed() const noexcept
      {
         return std::holds_alternative< std::int64_t >( m_variant );
      }

      [[nodiscard]] bool is_unsigned() const noexcept
      {
         return std::holds_alternative< std::uint64_t >( m_variant );
      }

      [[nodiscard]] bool is_integer() const noexcept
      {
         return is_signed() || is_unsigned();
      }

      [[nodiscard]] bool is_double() const noexcept
      {
         return std::holds_alternative< double >( m_variant );
      }

      [[nodiscard]] bool is_number() const noexcept
      {
         return is_integer() || is_double();
      }

      [[nodiscard]] bool is_string() const noexcept
      {
         return std::holds_alternative< std::string >( m_variant );
      }

      [[nodiscard]] bool is_string_view() const noexcept
      {
         return std::holds_alternative< std::string_view >( m_variant );
      }

      [[nodiscard]] bool is_string_type() const noexcept
      {
         return is_string() || is_string_view();
      }

      [[nodiscard]] bool is_binary() const noexcept
      {
         return std::holds_alternative< binary >( m_variant );
      }

      [[nodiscard]] bool is_binary_view() const noexcept
      {
         return std::holds_alternative< tao::binary_view >( m_variant );
      }

      [[nodiscard]] bool is_binary_type() const noexcept
      {
         return is_binary() || is_binary_view();
      }

      [[nodiscard]] bool is_array() const noexcept
      {
         return std::holds_alternative< array_t >( m_variant );
      }

      [[nodiscard]] bool is_object() const noexcept
      {
         return std::holds_alternative< object_t >( m_variant );
      }

      [[nodiscard]] bool is_value_ptr() const noexcept
      {
         return std::holds_alternative< const basic_value* >( m_variant );
      }

      [[nodiscard]] bool is_opaque_ptr() const noexcept
      {
         return std::holds_alternative< internal::opaque_ptr_t >( m_variant );
      }

      [[nodiscard]] bool get_boolean() const
      {
         return std::get< bool >( m_variant );
      }

      [[nodiscard]] std::int64_t get_signed() const
      {
         return std::get< std::int64_t >( m_variant );
      }

      [[nodiscard]] std::uint64_t get_unsigned() const
      {
         return std::get< std::uint64_t >( m_variant );
      }

      [[nodiscard]] double get_double() const
      {
         return std::get< double >( m_variant );
      }

      [[nodiscard]] std::string& get_string() &
      {
         return std::get< std::string >( m_variant );
      }

      [[nodiscard]] std::string&& get_string() &&
      {
         return std::get< std::string >( std::move( m_variant ) );
      }

      [[nodiscard]] const std::string& get_string() const&
      {
         return std::get< std::string >( m_variant );
      }

      [[nodiscard]] std::string_view get_string_view() const
      {
         return std::get< std::string_view >( m_variant );
      }

      [[nodiscard]] std::string_view get_string_type() const
      {
         return is_string() ? get_string() : get_string_view();
      }

      [[nodiscard]] binary& get_binary() &
      {
         return std::get< binary >( m_variant );
      }

      [[nodiscard]] binary&& get_binary() &&
      {
         return std::get< binary >( std::move( m_variant ) );
      }

      [[nodiscard]] const binary& get_binary() const&
      {
         return std::get< binary >( m_variant );
      }

      [[nodiscard]] tao::binary_view get_binary_view() const
      {
         return std::get< tao::binary_view >( m_variant );
      }

      [[nodiscard]] tao::binary_view get_binary_type() const
      {
         return is_binary() ? get_binary() : get_binary_view();
      }

      [[nodiscard]] array_t& get_array() &
      {
         return std::get< array_t >( m_variant );
      }

      [[nodiscard]] array_t&& get_array() &&
      {
         return std::get< array_t >( std::move( m_variant ) );
      }

      [[nodiscard]] const array_t& get_array() const&
      {
         return std::get< array_t >( m_variant );
      }

      [[nodiscard]] object_t& get_object() &
      {
         return std::get< object_t >( m_variant );
      }

      [[nodiscard]] object_t&& get_object() &&
      {
         return std::get< object_t >( std::move( m_variant ) );
      }

      [[nodiscard]] const object_t& get_object() const&
      {
         return std::get< object_t >( m_variant );
      }

      [[nodiscard]] const basic_value* get_value_ptr() const
      {
         return std::get< const basic_value* >( m_variant );
      }

      [[nodiscard]] internal::opaque_ptr_t get_opaque_ptr() const
      {
         return std::get< internal::opaque_ptr_t >( m_variant );
      }

   private:
      void throw_duplicate_key_exception( const std::string_view k ) const
      {
         throw std::runtime_error( internal::format( "duplicate JSON object key \"", internal::escape( k ), '"', json::message_extension( *this ) ) );
      }

      void throw_index_out_of_bound_exception( const std::size_t i ) const
      {
         throw std::out_of_range( internal::format( "JSON array index '", i, "' out of bound '", get_array().size(), '\'', json::message_extension( *this ) ) );
      }

      void throw_key_not_found_exception( const std::string_view k ) const
      {
         throw std::out_of_range( internal::format( "JSON object key \"", internal::escape( k ), "\" not found", json::message_extension( *this ) ) );
      }

   public:
      void set_uninitialized() noexcept
      {
         m_variant = uninitialized;
      }

      void set_null() noexcept
      {
         m_variant = null;
      }

      void set_boolean( const bool b ) noexcept
      {
         m_variant = b;
      }

      void set_signed( const std::int64_t i ) noexcept
      {
         m_variant = i;
      }

      void set_unsigned( const std::uint64_t u ) noexcept
      {
         m_variant = u;
      }

      void set_double( const double d ) noexcept
      {
         m_variant = d;
      }

      template< typename... Ts >
      std::string& emplace_string( Ts&&... ts ) noexcept( noexcept( std::string( std::forward< Ts >( ts )... ) ) )
      {
         return m_variant.template emplace< std::string >( std::forward< Ts >( ts )... );
      }

      void set_string( const std::string& s )
      {
         m_variant = s;
      }

      void set_string( std::string&& s ) noexcept
      {
         m_variant = std::move( s );
      }

      void set_string_view( const std::string_view sv ) noexcept
      {
         m_variant = sv;
      }

      template< typename... Ts >
      binary& emplace_binary( Ts&&... ts ) noexcept( noexcept( binary( std::forward< Ts >( ts )... ) ) )
      {
         return m_variant.template emplace< binary >( std::forward< Ts >( ts )... );
      }

      void set_binary( const binary& x )
      {
         m_variant = x;
      }

      void set_binary( binary&& x ) noexcept
      {
         m_variant = std::move( x );
      }

      void set_binary_view( const tao::binary_view xv ) noexcept
      {
         m_variant = xv;
      }

      template< typename... Ts >
      array_t& emplace_array( Ts&&... ts ) noexcept( noexcept( array_t( std::forward< Ts >( ts )... ) ) )
      {
         return m_variant.template emplace< array_t >( std::forward< Ts >( ts )... );
      }

      void set_array( const array_t& a )
      {
         m_variant = a;
      }

      void set_array( array_t&& a ) noexcept( std::is_nothrow_move_assignable_v< array_t > )
      {
         m_variant = std::move( a );
      }

      array_t& prepare_array()
      {
         return is_uninitialized() ? emplace_array() : get_array();
      }

      void push_back( const basic_value& v )
      {
         prepare_array().push_back( v );
      }

      void push_back( basic_value&& v )
      {
         prepare_array().push_back( std::move( v ) );
      }

      template< typename... Ts >
      basic_value& emplace_back( Ts&&... ts )
      {
         return prepare_array().emplace_back( std::forward< Ts >( ts )... );
      }

      template< typename... Ts >
      object_t& emplace_object( Ts&&... ts ) noexcept( noexcept( object_t( std::forward< Ts >( ts )... ) ) )
      {
         return m_variant.template emplace< object_t >( std::forward< Ts >( ts )... );
      }

      void set_object( const object_t& o )
      {
         m_variant = o;
      }

      void set_object( object_t&& o ) noexcept( std::is_nothrow_move_assignable_v< object_t > )
      {
         m_variant = std::move( o );
      }

      object_t& prepare_object()
      {
         return is_uninitialized() ? emplace_object() : get_object();
      }

      template< typename... Ts >
      auto try_emplace( Ts&&... ts )
      {
         auto r = prepare_object().try_emplace( std::forward< Ts >( ts )... );
         if( !r.second ) {
            throw_duplicate_key_exception( r.first->first );
         }
         return r;
      }

      auto insert( typename object_t::value_type&& t )
      {
         return prepare_object().emplace( std::move( t ) );
      }

      auto insert( const typename object_t::value_type& t )
      {
         return prepare_object().emplace( t );
      }

      void set_value_ptr( const basic_value* p ) noexcept
      {
         assert( p );
         m_variant = p;
      }

      template< typename T >
      void set_opaque_ptr( const T* data, producer_t* producer ) noexcept
      {
         assert( data );
         assert( producer );
         m_variant = internal::opaque_ptr_t{ data, producer };
      }

      template< typename T >
      void set_opaque_ptr( const T* data ) noexcept
      {
         set_opaque_ptr( data, &basic_value::produce_from_opaque_ptr< T > );
      }

      template< typename T >
      void assign( T&& v ) noexcept( noexcept( Traits< std::decay_t< T > >::assign( std::declval< basic_value& >(), std::forward< T >( v ) ) ) )
      {
         Traits< std::decay_t< T > >::assign( *this, std::forward< T >( v ) );
      }

      template< typename T >
      void assign( T&& v, public_base_t b ) noexcept( noexcept( Traits< std::decay_t< T > >::assign( std::declval< basic_value& >(), std::forward< T >( v ) ) ) && std::is_nothrow_move_assignable_v< public_base_t > )
      {
         Traits< std::decay_t< T > >::assign( *this, std::forward< T >( v ) );
         public_base() = std::move( b );
      }

      void assign( std::initializer_list< internal::pair< Traits > >&& l )
      {
         emplace_object();
         for( auto& e : l ) {
            try_emplace( std::move( e.key ), std::move( e.value ) );
         }
      }

      void assign( const std::initializer_list< internal::pair< Traits > >& l )
      {
         emplace_object();
         for( const auto& e : l ) {
            try_emplace( e.key, e.value );
         }
      }

      void assign( std::initializer_list< internal::pair< Traits > >& l )
      {
         assign( static_cast< const std::initializer_list< internal::pair< Traits > >& >( l ) );
      }

      void append( std::initializer_list< internal::single< Traits > >&& l )
      {
         auto& v = prepare_array();
         v.reserve( v.size() + l.size() );
         for( auto& e : l ) {
            v.push_back( std::move( e.value ) );
         }
      }

      void append( const std::initializer_list< internal::single< Traits > >& l )
      {
         auto& v = prepare_array();
         v.reserve( v.size() + l.size() );
         for( const auto& e : l ) {
            v.push_back( e.value );
         }
      }

      void insert( std::initializer_list< internal::pair< Traits > >&& l )
      {
         prepare_object();
         for( auto& e : l ) {
            try_emplace( std::move( e.key ), std::move( e.value ) );
         }
      }

      void insert( const std::initializer_list< internal::pair< Traits > >& l )
      {
         prepare_object();
         for( const auto& e : l ) {
            try_emplace( e.key, e.value );
         }
      }

      [[nodiscard]] const basic_value& skip_value_ptr() const noexcept
      {
         const basic_value* p = this;
         while( p->is_value_ptr() ) {
            p = p->get_value_ptr();
            assert( p );
         }
         return *p;
      }

      [[nodiscard]] basic_value* find( const std::size_t index )
      {
         auto& a = get_array();
         return ( index < a.size() ) ? ( a.data() + index ) : nullptr;
      }

      [[nodiscard]] const basic_value* find( const std::size_t index ) const
      {
         const auto& a = get_array();
         return ( index < a.size() ) ? ( a.data() + index ) : nullptr;
      }

      template< typename Key >
      [[nodiscard]] std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer >, basic_value* > find( Key&& key )
      {
         auto& o = get_object();
         const auto it = o.find( std::forward< Key >( key ) );
         return ( it != o.end() ) ? ( &it->second ) : nullptr;
      }

      template< typename Key >
      [[nodiscard]] std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer >, const basic_value* > find( Key&& key ) const
      {
         const auto& o = get_object();
         const auto it = o.find( std::forward< Key >( key ) );
         return ( it != o.end() ) ? ( &it->second ) : nullptr;
      }

      [[nodiscard]] basic_value* find( const pointer& k )
      {
         return internal::pointer_find( this, k.begin(), k.end() );
      }

      [[nodiscard]] const basic_value* find( const pointer& k ) const
      {
         return internal::pointer_find( this, k.begin(), k.end() );
      }

      [[nodiscard]] basic_value& at( const std::size_t index )
      {
         auto& a = get_array();
         if( index >= a.size() ) {
            throw_index_out_of_bound_exception( index );
         }
         return a[ index ];
      }

      [[nodiscard]] const basic_value& at( const std::size_t index ) const
      {
         const auto& a = get_array();
         if( index >= a.size() ) {
            throw_index_out_of_bound_exception( index );
         }
         return a[ index ];
      }

      template< typename Key >
      [[nodiscard]] std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer >, basic_value& > at( const Key& key )
      {
         auto& o = get_object();
         const auto it = o.find( key );
         if( it == o.end() ) {
            throw_key_not_found_exception( key );
         }
         return it->second;
      }

      template< typename Key >
      [[nodiscard]] std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer >, const basic_value& > at( const Key& key ) const
      {
         const auto& o = get_object();
         const auto it = o.find( key );
         if( it == o.end() ) {
            throw_key_not_found_exception( key );
         }
         return it->second;
      }

      [[nodiscard]] basic_value& at( const pointer& k )
      {
         return internal::pointer_at( this, k.begin(), k.end() );
      }

      [[nodiscard]] const basic_value& at( const pointer& k ) const
      {
         return internal::pointer_at( this, k.begin(), k.end() );
      }

      [[nodiscard]] basic_value& operator[]( const std::size_t index )
      {
         return get_array()[ index ];
      }

      [[nodiscard]] const basic_value& operator[]( const std::size_t index ) const
      {
         return get_array()[ index ];
      }

      template< typename Key >
      [[nodiscard]] std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer >, basic_value& > operator[]( Key&& key )
      {
         return prepare_object()[ std::forward< Key >( key ) ];
      }

      [[nodiscard]] basic_value& operator[]( const pointer& k )
      {
         if( k.empty() ) {
            return *this;
         }
         const auto b = k.begin();
         const auto e = std::prev( k.end() );
         basic_value& v = internal::pointer_at( this, b, e );
         if( v.is_object() ) {
            return v.get_object()[ e->key() ];
         }
         if( v.is_array() ) {
            if( e->key() == "-" ) {
               v.emplace_back( null );
               return v.get_array().back();
            }
            return v.at( e->index() );
         }
         throw internal::invalid_type( b, std::next( e ) );
      }

      template< typename T >
      [[nodiscard]] std::enable_if_t< internal::has_as< Traits< T >, basic_value >, T > as() const
      {
         return Traits< T >::as( *this );
      }

      template< typename T >
      [[nodiscard]] std::enable_if_t< !internal::has_as< Traits< T >, basic_value > && internal::has_as_type< Traits, T, basic_value >, T > as() const
      {
         return Traits< T >::template as_type< Traits, T >( *this );
      }

      template< typename T >
      [[nodiscard]] std::enable_if_t< !internal::has_as< Traits< T >, basic_value > && !internal::has_as_type< Traits, T, basic_value > && internal::has_to< Traits< T >, basic_value, T >, T > as() const
      {
         T v;  // TODO: Should is_default_constructible< T > be part of the enable_if, static_assert()ed here, or this line allowed to error?
         Traits< T >::to( *this, v );
         return v;
      }

      template< typename T >
      std::enable_if_t< !internal::has_as< Traits< T >, basic_value > && !internal::has_as_type< Traits, T, basic_value > && !internal::has_to< Traits< T >, basic_value, T > > as() const = delete;

      template< typename T, typename K >
      [[nodiscard]] T as( const K& key ) const
      {
         return this->at( key ).template as< T >();
      }

      // TODO: Incorporate has_as_type in the following functions (and throughout the library) (if we decide keep it)!

      template< typename T, typename... With >
      [[nodiscard]] std::enable_if_t< internal::has_as< Traits< T >, basic_value, With... >, T > as_with( With&&... with ) const
      {
         return Traits< T >::as( *this, with... );
      }

      template< typename T, typename... With >
      [[nodiscard]] std::enable_if_t< !internal::has_as< Traits< T >, basic_value, With... > && internal::has_to< Traits< T >, basic_value, T, With... >, T > as_with( With&&... with ) const
      {
         T v;  // TODO: Should is_default_constructible< T > be part of the enable_if, static_assert()ed here, or this line allowed to error?
         Traits< T >::to( *this, v, with... );
         return v;
      }

      template< typename T, typename... With >
      std::enable_if_t< !internal::has_as< Traits< T >, basic_value, With... > && !internal::has_to< Traits< T >, basic_value, T, With... >, T > as_with( With&&... with ) const = delete;

      template< typename T >
      std::enable_if_t< internal::has_to< Traits< T >, basic_value, T > > to( T& v ) const
      {
         Traits< std::decay_t< T > >::to( *this, v );
      }

      template< typename T >
      std::enable_if_t< !internal::has_to< Traits< T >, basic_value, T > && internal::has_as< Traits< T >, basic_value > > to( T& v ) const
      {
         v = Traits< std::decay_t< T > >::as( *this );
      }

      template< typename T >
      std::enable_if_t< !internal::has_to< Traits< T >, basic_value, T > && !internal::has_as< Traits< T >, basic_value > > to( T& v ) const = delete;

      template< typename T, typename K >
      void to( T& v, const K& key )
      {
         this->at( key ).to( v );
      }

      template< typename T, typename... With >
      std::enable_if_t< internal::has_to< Traits< T >, basic_value, T, With... > > to_with( T& v, With&&... with ) const
      {
         Traits< std::decay_t< T > >::to( *this, v, with... );
      }

      template< typename T, typename... With >
      std::enable_if_t< !internal::has_to< Traits< T >, basic_value, T, With... > && internal::has_as< Traits< T >, basic_value, With... > > to_with( T& v, With&&... with ) const
      {
         v = Traits< std::decay_t< T > >::as( *this, with... );
      }

      template< typename T, typename... With >
      std::enable_if_t< !internal::has_to< Traits< T >, basic_value, T, With... > && !internal::has_as< Traits< T >, basic_value, With... > > to_with( T& v, With&&... with ) const = delete;

      template< typename T >
      [[nodiscard]] std::optional< T > optional() const
      {
         if( is_null() ) {
            return std::nullopt;
         }
         return as< T >();
      }

      template< typename T, typename K >
      [[nodiscard]] std::optional< T > optional( const K& key ) const
      {
         if( const auto* p = find( key ) ) {
            return p->template as< T >();
         }
         return std::nullopt;
      }

      void erase( const std::size_t index )
      {
         auto& a = get_array();
         if( index >= a.size() ) {
            throw_index_out_of_bound_exception( index );
         }
         a.erase( a.begin() + index );
      }

      template< typename Key >
      std::enable_if_t< !std::is_convertible_v< Key, std::size_t > && !std::is_convertible_v< Key, pointer > > erase( const Key& key )
      {
         if( get_object().erase( key ) == 0 ) {
            throw_key_not_found_exception( key );
         }
      }

      void erase( const pointer& k )
      {
         if( !k ) {
            throw std::runtime_error( internal::format( "invalid root JSON Pointer for erase", json::message_extension( *this ) ) );
         }
         const auto b = k.begin();
         const auto e = std::prev( k.end() );
         basic_value& v = internal::pointer_at( this, b, e );
         if( v.is_object() ) {
            v.erase( e->key() );
         }
         else if( v.is_array() ) {
            v.erase( e->index() );
         }
         else {
            throw internal::invalid_type( b, std::next( e ) );
         }
      }

      basic_value& insert( const pointer& k, basic_value in )
      {
         if( !k ) {
            *this = std::move( in );
            return *this;
         }
         const auto b = k.begin();
         const auto e = std::prev( k.end() );
         basic_value& v = internal::pointer_at( this, b, e );
         if( v.is_object() ) {
            return v.get_object().insert_or_assign( e->key(), std::move( in ) ).first->second;
         }
         if( v.is_array() ) {
            auto& a = v.get_array();
            if( e->key() == "-" ) {
               v.emplace_back( std::move( in ) );
               return a.back();
            }
            const auto i = e->index();
            if( i >= a.size() ) {
               throw std::out_of_range( internal::format( "invalid JSON Pointer \"", internal::tokens_to_string( b, std::next( e ) ), "\", array index '", i, "' out of bound '", a.size(), '\'', json::message_extension( *this ) ) );
            }
            a.insert( a.begin() + i, std::move( in ) );
            return a.at( i );
         }
         throw internal::invalid_type( b, std::next( e ) );
      }

      [[nodiscard]] variant_t& variant() noexcept
      {
         return m_variant;
      }

      [[nodiscard]] const variant_t& variant() const noexcept
      {
         return m_variant;
      }

   private:
      template< typename T >
      static void produce_from_opaque_ptr( events::virtual_base& consumer, const void* raw )
      {
         Traits< T >::template produce< Traits >( consumer, *static_cast< const T* >( raw ) );
      }
   };

}  // namespace tao::json

#endif
