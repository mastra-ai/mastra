// Copyright (c) 2014-2022 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/PEGTL/

#ifndef TAO_PEGTL_DEMANGLE_HPP
#define TAO_PEGTL_DEMANGLE_HPP

#include <ciso646>
#include <string_view>

#include "config.hpp"

// ensure a consistent interface
namespace TAO_PEGTL_NAMESPACE
{
#if !defined( __clang__ ) && defined( __GNUC__ ) && ( __GNUC__ == 7 )

   template< typename T >
   [[nodiscard]] std::string_view demangle() noexcept;

#else

   template< typename T >
   [[nodiscard]] constexpr std::string_view demangle() noexcept;

#endif

}  // namespace TAO_PEGTL_NAMESPACE

#if defined( __clang__ )

#if defined( _LIBCPP_VERSION )

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   constexpr std::string_view sv = __PRETTY_FUNCTION__;
   constexpr auto begin = sv.find( '=' );
   static_assert( begin != std::string_view::npos );
   return sv.substr( begin + 2, sv.size() - begin - 3 );
}

#else

namespace TAO_PEGTL_NAMESPACE::internal
{
   // When using libstdc++ with clang, std::string_view::find is not constexpr :(
   template< char C >
   constexpr const char* string_view_find( const char* p, std::size_t n ) noexcept
   {
      while( n ) {
         if( *p == C ) {
            return p;
         }
         ++p;
         --n;
      }
      return nullptr;
   }

}  // namespace TAO_PEGTL_NAMESPACE::internal

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   constexpr std::string_view sv = __PRETTY_FUNCTION__;
   constexpr auto begin = internal::string_view_find< '=' >( sv.data(), sv.size() );
   static_assert( begin != nullptr );
   return { begin + 2, sv.data() + sv.size() - begin - 3 };
}

#endif

#elif defined( __GNUC__ )

#if( __GNUC__ == 7 )

// GCC 7 wrongly sometimes disallows __PRETTY_FUNCTION__ in constexpr functions,
// therefore we drop the 'constexpr' and hope for the best.
template< typename T >
[[nodiscard]] std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   const std::string_view sv = __PRETTY_FUNCTION__;
   const auto begin = sv.find( '=' );
   const auto tmp = sv.substr( begin + 2 );
   const auto end = tmp.rfind( ';' );
   return tmp.substr( 0, end );
}

#elif( __GNUC__ == 9 ) && ( __GNUC_MINOR__ < 3 )

#if !defined( __cpp_rtti )
#error "RTTI support required for GCC 9.1/9.2"
#else

#include <typeinfo>

// GCC 9.1 and 9.2 have a bug that leads to truncated __PRETTY_FUNCTION__ names,
// see https://gcc.gnu.org/bugzilla/show_bug.cgi?id=91155
template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   // fallback: requires RTTI, no demangling
   return typeid( T ).name();
}

#endif

#else

namespace TAO_PEGTL_NAMESPACE::special
{
   template< typename T >
   [[nodiscard]] constexpr std::string_view demangle() noexcept
   {
      constexpr std::string_view sv = __PRETTY_FUNCTION__;
      constexpr auto begin = sv.find( '=' );
      static_assert( begin != std::string_view::npos );
      constexpr auto tmp = sv.substr( begin + 2 );
      constexpr auto end = tmp.rfind( ';' );
      static_assert( end != std::string_view::npos );
      return tmp.substr( 0, end );
   }

}  // namespace TAO_PEGTL_NAMESPACE::special

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   return special::demangle< T >();
}

#endif

#elif defined( _MSC_VER )

#if( _MSC_VER < 1920 )

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   const std::string_view sv = __FUNCSIG__;
   const auto begin = sv.find( "demangle<" );
   const auto tmp = sv.substr( begin + 9 );
   const auto end = tmp.rfind( '>' );
   return tmp.substr( 0, end );
}

#else

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   // we can not add static_assert for additional safety,
   // see issues #296, #301 and #308
   constexpr std::string_view sv = __FUNCSIG__;
   constexpr auto begin = sv.find( "demangle<" );
   constexpr auto tmp = sv.substr( begin + 9 );
   constexpr auto end = tmp.rfind( '>' );
   return tmp.substr( 0, end );
}

#endif

#else

#if !defined( __cpp_rtti )
#error "RTTI support required for unknown compilers"
#else

#include <typeinfo>

template< typename T >
[[nodiscard]] constexpr std::string_view TAO_PEGTL_NAMESPACE::demangle() noexcept
{
   // fallback: requires RTTI, no demangling
   return typeid( T ).name();
}

#endif

#endif

#endif
