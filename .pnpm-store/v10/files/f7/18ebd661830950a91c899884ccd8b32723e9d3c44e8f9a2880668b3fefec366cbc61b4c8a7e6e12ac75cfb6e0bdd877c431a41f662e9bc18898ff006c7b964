add_library(couchbase_crypto OBJECT cbcrypto.cc)
set_target_properties(couchbase_crypto PROPERTIES POSITION_INDEPENDENT_CODE ON)
set_project_warnings(couchbase_crypto)
set_project_options(couchbase_crypto)
target_include_directories(couchbase_crypto PRIVATE ${PROJECT_BINARY_DIR}/generated ${PROJECT_SOURCE_DIR})

if(COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL AND COUCHBASE_CXX_CLIENT_USE_BORINGSSL_PREFIX)
  target_compile_definitions(couchbase_crypto PUBLIC BORINGSSL_PREFIX=${COUCHBASE_CXX_CLIENT_BORINGSSL_PREFIX})
endif()

# this will work for boringssl too
if(NOT COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL)
  if(TARGET PkgConfig::PKG_CONFIG_OPENSSL)
    target_link_libraries(couchbase_crypto PUBLIC PkgConfig::PKG_CONFIG_OPENSSL)
  else()
    target_link_libraries(couchbase_crypto PUBLIC OpenSSL::SSL OpenSSL::Crypto)
  endif()
endif()

if(WIN32)
  target_link_libraries(couchbase_crypto PUBLIC bcrypt.lib)
endif()
