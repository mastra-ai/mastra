// Copyright (c) 2019-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_SPAN_HPP
#define TAO_JSON_SPAN_HPP

#if !defined( TAO_JSON_USE_STD_SPAN ) && ( __cplusplus > 201703L ) && defined( __has_include )
// clang-format off
#if __has_include(<span>)
// clang-format on
#define TAO_JSON_USE_STD_SPAN
#endif
#endif

#if defined( TAO_JSON_USE_STD_SPAN )

#include <span>

namespace tao
{
   using std::dynamic_extent;
   using std::span;

   using std::as_bytes;
   using std::as_writable_bytes;

}  // namespace tao

#else

#include <array>
#include <cassert>
#include <cstddef>
#include <iterator>
#include <limits>
#include <tuple>
#include <type_traits>

namespace tao
{
   inline constexpr std::size_t dynamic_extent = ( std::numeric_limits< std::size_t >::max )();

   template< typename ElementType, std::size_t Extent = dynamic_extent >
   class span;

   namespace internal
   {
      template< typename >
      inline constexpr bool is_span = false;

      template< typename ElementType, std::size_t Extent >
      inline constexpr bool is_span< span< ElementType, Extent > > = true;

      template< typename >
      inline constexpr bool is_std_array = false;

      template< typename T, std::size_t N >
      inline constexpr bool is_std_array< std::array< T, N > > = true;

      template< typename T, typename ElementType >
      inline constexpr bool is_span_compatible_ptr = std::is_convertible_v< T ( * )[], ElementType ( * )[] >;

      template< typename, typename, typename = void >
      inline constexpr bool is_span_compatible_container = false;

      template< typename Container, typename ElementType >
      inline constexpr bool is_span_compatible_container< Container,
                                                          ElementType,
                                                          std::void_t<
                                                             std::enable_if_t< !is_span< std::remove_cv_t< Container > > >,
                                                             std::enable_if_t< !is_std_array< std::remove_cv_t< Container > > >,
                                                             std::enable_if_t< !std::is_array_v< Container > >,
                                                             decltype( std::data( std::declval< Container >() ) ),
                                                             decltype( std::size( std::declval< Container >() ) ),
                                                             std::enable_if_t< std::is_convertible_v< std::remove_pointer_t< decltype( std::data( std::declval< Container& >() ) ) > ( * )[], ElementType ( * )[] > > > >
         = true;

   }  // namespace internal

   template< typename ElementType, std::size_t Extent >
   class span  // NOLINT(cppcoreguidelines-special-member-functions)
   {
   public:
      static_assert( !std::is_abstract_v< ElementType > );

      using element_type = ElementType;
      using value_type = std::remove_cv_t< ElementType >;
      using size_type = std::size_t;
      using difference_type = std::ptrdiff_t;
      using pointer = element_type*;
      using const_pointer = const element_type*;
      using reference = element_type&;
      using const_reference = const element_type&;
      using iterator = pointer;
      using reverse_iterator = std::reverse_iterator< iterator >;

      static constexpr size_type extent = Extent;

      template< typename T = void, typename = std::enable_if_t< Extent == 0, T > >
      constexpr span() noexcept
         : m_data( nullptr )
      {}

      constexpr span( pointer ptr, [[maybe_unused]] size_type count ) noexcept
         : m_data( ptr )
      {
         assert( count == Extent );
      }

      constexpr span( pointer first, [[maybe_unused]] pointer last ) noexcept
         : m_data( first )
      {
         assert( std::distance( first, last ) == Extent );
      }

      constexpr span( element_type ( &arr )[ Extent ] ) noexcept
         : m_data( arr )
      {}

      template< typename OtherElementType, std::size_t N, typename = std::enable_if_t< ( N == Extent ) && tao::internal::is_span_compatible_ptr< OtherElementType, ElementType > > >
      constexpr span( std::array< OtherElementType, N >& arr ) noexcept
         : m_data( static_cast< pointer >( arr.data() ) )
      {}

      template< typename OtherElementType, std::size_t N, typename = std::enable_if_t< ( N == Extent ) && tao::internal::is_span_compatible_ptr< const OtherElementType, ElementType > > >
      constexpr span( const std::array< OtherElementType, N >& arr ) noexcept
         : m_data( static_cast< pointer >( arr.data() ) )
      {}

      constexpr span( const span& ) = default;

      template< typename OtherElementType, typename = std::enable_if_t< tao::internal::is_span_compatible_ptr< OtherElementType, ElementType > > >
      constexpr span( const span< OtherElementType, Extent >& s ) noexcept
         : m_data( s.data() )
      {}

      ~span() = default;

      constexpr auto operator=( const span& ) -> span& = default;

      constexpr auto size() const noexcept -> size_type  // NOLINT(modernize-use-nodiscard)
      {
         return Extent;
      }

      constexpr auto size_bytes() const noexcept -> size_type  // NOLINT(modernize-use-nodiscard)
      {
         return Extent * sizeof( element_type );
      }

      [[nodiscard]] constexpr auto empty() const noexcept -> bool
      {
         return Extent == 0;
      }

      constexpr auto operator[]( size_type idx ) const noexcept -> reference
      {
         assert( idx < Extent );
         return *( data() + idx );
      }

      constexpr auto front() const noexcept -> reference  // NOLINT(modernize-use-nodiscard)
      {
         assert( Extent != 0 );
         return *data();
      }

      constexpr auto back() const noexcept -> reference  // NOLINT(modernize-use-nodiscard)
      {
         assert( Extent != 0 );
         return *( data() + ( Extent - 1 ) );
      }

      constexpr auto data() const noexcept -> pointer  // NOLINT(modernize-use-nodiscard)
      {
         return m_data;
      }

      constexpr auto begin() const noexcept -> iterator  // NOLINT(modernize-use-nodiscard)
      {
         return data();
      }

      constexpr auto end() const noexcept -> iterator  // NOLINT(modernize-use-nodiscard)
      {
         return data() + Extent;
      }

      constexpr auto rbegin() const noexcept -> reverse_iterator  // NOLINT(modernize-use-nodiscard)
      {
         return reverse_iterator( end() );
      }

      constexpr auto rend() const noexcept -> reverse_iterator  // NOLINT(modernize-use-nodiscard)
      {
         return reverse_iterator( begin() );
      }

      template< std::size_t Count >
      constexpr auto first() const noexcept  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, Count >
      {
         static_assert( Count <= Extent );
         return { data(), Count };
      }

      template< std::size_t Count >
      constexpr auto last() const noexcept  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, Count >
      {
         static_assert( Count <= Extent );
         return { data() + ( Extent - Count ), Count };
      }

      template< std::size_t Offset, std::size_t Count = dynamic_extent >
      constexpr auto subspan() const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, ( ( Count != dynamic_extent ) ? Count : ( Extent - Offset ) ) >
      {
         static_assert( Offset <= Extent );
         static_assert( ( Count == dynamic_extent ) || ( Count <= ( Extent - Offset ) ) );
         return { data() + Offset, ( Count != dynamic_extent ) ? Count : ( Extent - Offset ) };
      }

      constexpr auto first( size_type count ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( count <= Extent );
         return { data(), count };
      }

      constexpr auto last( size_type count ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( count <= Extent );
         return { data() + Extent - count, count };
      }

      constexpr auto subspan( size_type offset, size_type count = dynamic_extent ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( offset <= Extent );
         assert( ( count == dynamic_extent ) || ( count <= ( Extent - offset ) ) );
         return { data() + offset, ( count != dynamic_extent ) ? count : ( Extent - offset ) };
      }

   private:
      pointer m_data;
   };

   template< typename ElementType >
   class span< ElementType, dynamic_extent >  // NOLINT(cppcoreguidelines-special-member-functions)
   {
   public:
      static_assert( !std::is_abstract_v< ElementType > );

      using element_type = ElementType;
      using value_type = std::remove_cv_t< ElementType >;
      using size_type = std::size_t;
      using difference_type = std::ptrdiff_t;
      using pointer = element_type*;
      using const_pointer = const element_type*;
      using reference = element_type&;
      using const_reference = const element_type&;
      using iterator = pointer;
      using reverse_iterator = std::reverse_iterator< iterator >;

      static constexpr size_type extent = dynamic_extent;

      constexpr span() noexcept
         : m_data( nullptr ), m_size( 0 )
      {}

      constexpr span( pointer ptr, size_type count ) noexcept
         : m_data( ptr ), m_size( count )
      {}

      constexpr span( pointer first, pointer last ) noexcept
         : m_data( first ), m_size( std::distance( first, last ) )
      {}

      template< std::size_t N >
      constexpr span( element_type ( &arr )[ N ] ) noexcept
         : m_data( arr ), m_size( N )
      {}

      template< typename OtherElementType, std::size_t N, typename = std::enable_if_t< tao::internal::is_span_compatible_ptr< OtherElementType, ElementType > > >
      constexpr span( std::array< OtherElementType, N >& arr ) noexcept
         : m_data( static_cast< pointer >( arr.data() ) ), m_size( N )
      {}

      template< typename OtherElementType, std::size_t N, typename = std::enable_if_t< tao::internal::is_span_compatible_ptr< const OtherElementType, ElementType > > >
      constexpr span( const std::array< OtherElementType, N >& arr ) noexcept
         : m_data( static_cast< pointer >( arr.data() ) ), m_size( N )
      {}

      template< typename Container, typename = std::enable_if_t< tao::internal::is_span_compatible_container< Container, ElementType > > >
      constexpr span( Container& cont )
         : m_data( static_cast< pointer >( std::data( cont ) ) ), m_size( std::size( cont ) )
      {}

      template< typename Container, typename = std::enable_if_t< tao::internal::is_span_compatible_container< const Container, ElementType > > >
      constexpr span( const Container& cont )
         : m_data( static_cast< pointer >( std::data( cont ) ) ), m_size( std::size( cont ) )
      {}

      constexpr span( const span& ) = default;

      template< typename OtherElementType, std::size_t OtherExtent, typename = std::enable_if_t< tao::internal::is_span_compatible_ptr< OtherElementType, ElementType > > >
      constexpr span( const span< OtherElementType, OtherExtent >& s ) noexcept
         : m_data( s.data() ), m_size( s.size() )
      {}

      ~span() = default;

      constexpr auto operator=( const span& ) -> span& = default;

      constexpr auto size() const noexcept -> size_type  // NOLINT(modernize-use-nodiscard)
      {
         return m_size;
      }

      constexpr auto size_bytes() const noexcept -> size_type  // NOLINT(modernize-use-nodiscard)
      {
         return size() * sizeof( element_type );
      }

      [[nodiscard]] constexpr auto empty() const noexcept -> bool
      {
         return size() == 0;
      }

      constexpr auto operator[]( size_type idx ) const noexcept -> reference  // NOLINT(modernize-use-nodiscard)
      {
         assert( idx < size() );
         return *( data() + idx );
      }

      constexpr auto front() const noexcept -> reference  // NOLINT(modernize-use-nodiscard)
      {
         assert( !empty() );
         return *data();
      }

      constexpr auto back() const noexcept -> reference  // NOLINT(modernize-use-nodiscard)
      {
         assert( !empty() );
         return *( data() + ( size() - 1 ) );
      }

      constexpr auto data() const noexcept -> pointer  // NOLINT(modernize-use-nodiscard)
      {
         return m_data;
      }

      constexpr auto begin() const noexcept -> iterator  // NOLINT(modernize-use-nodiscard)
      {
         return data();
      }

      constexpr auto end() const noexcept -> iterator  // NOLINT(modernize-use-nodiscard)
      {
         return data() + size();
      }

      constexpr auto rbegin() const noexcept -> reverse_iterator  // NOLINT(modernize-use-nodiscard)
      {
         return reverse_iterator( end() );
      }

      constexpr auto rend() const noexcept -> reverse_iterator  // NOLINT(modernize-use-nodiscard)
      {
         return reverse_iterator( begin() );
      }

      template< std::size_t Count >
      constexpr auto first() const noexcept  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, Count >
      {
         assert( Count <= size() );
         return { data(), Count };
      }

      template< std::size_t Count >
      constexpr auto last() const noexcept  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, Count >
      {
         assert( Count <= size() );
         return { data() + ( size() - Count ), Count };
      }

      template< std::size_t Offset, std::size_t Count = dynamic_extent >
      constexpr auto subspan() const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, ( ( Count != dynamic_extent ) ? Count : dynamic_extent ) >
      {
         assert( Offset <= size() );
         assert( ( Count == dynamic_extent ) || ( Count <= ( size() - Offset ) ) );
         return { data() + Offset, ( Count != dynamic_extent ) ? Count : ( size() - Offset ) };
      }

      constexpr auto first( size_type count ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( count <= size() );
         return { data(), count };
      }

      constexpr auto last( size_type count ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( count <= size() );
         return { data() + size() - count, count };
      }

      constexpr auto subspan( size_type offset, size_type count = dynamic_extent ) const  // NOLINT(modernize-use-nodiscard)
         -> span< element_type, dynamic_extent >
      {
         assert( offset <= size() );
         assert( ( count == dynamic_extent ) || ( count <= ( size() - offset ) ) );
         return { data() + offset, ( count != dynamic_extent ) ? count : ( size() - offset ) };
      }

   private:
      pointer m_data;
      size_type m_size;  // NOLINT(modernize-use-default-member-init)
   };

   template< typename ElementType, std::size_t Extent >
   auto as_bytes( span< ElementType, Extent > s ) noexcept  // NOLINT(modernize-use-nodiscard)
      -> span< const std::byte, ( ( Extent == dynamic_extent ) ? dynamic_extent : ( sizeof( ElementType ) * Extent ) ) >
   {
      return { reinterpret_cast< const std::byte* >( s.data() ), s.size_bytes() };
   }

   template< typename ElementType, std::size_t Extent, typename = std::enable_if_t< !std::is_const_v< ElementType > > >
   auto as_writable_bytes( span< ElementType, Extent > s ) noexcept  // NOLINT(modernize-use-nodiscard)
      -> span< std::byte, ( ( Extent == dynamic_extent ) ? dynamic_extent : ( sizeof( ElementType ) * Extent ) ) >
   {
      return { reinterpret_cast< std::byte* >( s.data() ), s.size_bytes() };
   }

   // deduction guides
   template< typename T, std::size_t N >
   span( T ( & )[ N ] ) -> span< T, N >;

   template< typename T, std::size_t N >
   span( std::array< T, N >& ) -> span< T, N >;

   template< typename T, std::size_t N >
   span( const std::array< T, N >& ) -> span< const T, N >;

   template< typename Container >
   span( Container& ) -> span< typename Container::value_type >;

   template< typename Container >
   span( const Container& ) -> span< const typename Container::value_type >;

}  // namespace tao

#if defined( __clang__ )
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wmismatched-tags"
#endif

template< typename ElementType, std::size_t Extent >
struct std::tuple_size< tao::span< ElementType, Extent > >
   : std::integral_constant< std::size_t, Extent >
{};

template< typename ElementType >
struct std::tuple_size< tao::span< ElementType, tao::dynamic_extent > >;  // not defined

template< std::size_t I, typename ElementType, std::size_t Extent >
struct std::tuple_element< I, tao::span< ElementType, Extent > >
{
   static_assert( ( Extent != tao::dynamic_extent ) && ( I < Extent ) );
   using type = ElementType;
};

#if defined( __clang__ )
#pragma clang diagnostic pop
#endif

namespace std
{
   // TODO: this is probably illegal. keep it?
   template< std::size_t I, typename ElementType, std::size_t Extent >
   constexpr auto get( tao::span< ElementType, Extent > s ) noexcept -> ElementType&  // NOLINT(modernize-use-nodiscard)
   {
      static_assert( ( Extent != tao::dynamic_extent ) && ( I < Extent ) );
      return s[ I ];
   }

}  // namespace std

#endif

#endif
