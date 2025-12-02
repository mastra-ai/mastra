// Copyright (c) 2018-2023 Dr. Colin Hirsch and Daniel Frey
// Please see LICENSE for license or visit https://github.com/taocpp/json/

#ifndef TAO_JSON_CONTRIB_TRAITS_HPP
#define TAO_JSON_CONTRIB_TRAITS_HPP

#include "../traits.hpp"

#include "pair_traits.hpp"
#include "tuple_traits.hpp"

#include "variant_traits.hpp"

#include "pointer_traits.hpp"

#include "array_traits.hpp"
#include "deque_traits.hpp"
#include "list_traits.hpp"
#include "set_traits.hpp"
#include "unordered_set_traits.hpp"
#include "vector_traits.hpp"

#include "vector_bool_traits.hpp"

#include "map_traits.hpp"
#include "unordered_map_traits.hpp"

#include "multimap_traits.hpp"
#include "multiset_traits.hpp"

#include "shared_ptr_traits.hpp"
#include "unique_ptr_traits.hpp"

namespace tao::json
{
   template< typename U, typename V >
   struct traits< std::pair< U, V > >
      : pair_traits< U, V >
   {};

   template< typename... Ts >
   struct traits< std::tuple< Ts... > >
      : tuple_traits< Ts... >
   {};

   template< typename... Ts >
   struct traits< std::variant< Ts... > >
      : variant_traits< Ts... >
   {};

   template<>
   struct traits< token >
      : token_traits
   {};

   template<>
   struct traits< pointer >
      : pointer_traits
   {};

   template< typename T, std::size_t N >
   struct traits< std::array< T, N > >
      : array_traits< T, N >
   {};

   template< typename T, typename... Ts >
   struct traits< std::deque< T, Ts... > >
      : deque_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::list< T, Ts... > >
      : list_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::set< T, Ts... > >
      : set_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::unordered_set< T, Ts... > >
      : unordered_set_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::vector< T, Ts... > >
      : vector_traits< T, Ts... >
   {};

   template<>
   struct traits< std::vector< bool > >
      : vector_bool_traits
   {};

   template< typename T, typename... Ts >
   struct traits< std::map< std::string, T, Ts... > >
      : map_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::unordered_map< std::string, T, Ts... > >
      : unordered_map_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::multiset< T, Ts... > >
      : multiset_traits< T, Ts... >
   {};

   template< typename T, typename... Ts >
   struct traits< std::multimap< std::string, T, Ts... > >
      : multimap_traits< T, Ts... >
   {};

   template< typename T >
   struct traits< std::shared_ptr< T > >
      : shared_ptr_traits< T >
   {};

   template< typename T >
   struct traits< std::unique_ptr< T > >
      : unique_ptr_traits< T >
   {};

}  // namespace tao::json

#endif
