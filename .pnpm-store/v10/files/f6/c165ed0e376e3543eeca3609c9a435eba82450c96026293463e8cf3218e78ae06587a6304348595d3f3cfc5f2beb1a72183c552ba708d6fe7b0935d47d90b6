perlasm(BCM_SOURCES aarch64 aesv8-armv8 aes/asm/aesv8-armx.pl)
perlasm(BCM_SOURCES aarch64 aesv8-gcm-armv8 modes/asm/aesv8-gcm-armv8.pl)
perlasm(BCM_SOURCES aarch64 armv8-mont bn/asm/armv8-mont.pl)
perlasm(BCM_SOURCES aarch64 bn-armv8 bn/asm/bn-armv8.pl)
perlasm(BCM_SOURCES aarch64 ghash-neon-armv8 modes/asm/ghash-neon-armv8.pl)
perlasm(BCM_SOURCES aarch64 ghashv8-armv8 modes/asm/ghashv8-armx.pl)
perlasm(BCM_SOURCES aarch64 p256_beeu-armv8-asm ec/asm/p256_beeu-armv8-asm.pl)
perlasm(BCM_SOURCES aarch64 p256-armv8-asm ec/asm/p256-armv8-asm.pl)
perlasm(BCM_SOURCES aarch64 sha1-armv8 sha/asm/sha1-armv8.pl)
perlasm(BCM_SOURCES aarch64 sha256-armv8 sha/asm/sha512-armv8.pl sha256)
perlasm(BCM_SOURCES aarch64 sha512-armv8 sha/asm/sha512-armv8.pl sha512)
perlasm(BCM_SOURCES aarch64 vpaes-armv8 aes/asm/vpaes-armv8.pl)
perlasm(BCM_SOURCES arm aesv8-armv7 aes/asm/aesv8-armx.pl)
perlasm(BCM_SOURCES arm armv4-mont bn/asm/armv4-mont.pl)
perlasm(BCM_SOURCES arm bsaes-armv7 aes/asm/bsaes-armv7.pl)
perlasm(BCM_SOURCES arm ghash-armv4 modes/asm/ghash-armv4.pl)
perlasm(BCM_SOURCES arm ghashv8-armv7 modes/asm/ghashv8-armx.pl)
perlasm(BCM_SOURCES arm sha1-armv4-large sha/asm/sha1-armv4-large.pl)
perlasm(BCM_SOURCES arm sha256-armv4 sha/asm/sha256-armv4.pl)
perlasm(BCM_SOURCES arm sha512-armv4 sha/asm/sha512-armv4.pl)
perlasm(BCM_SOURCES arm vpaes-armv7 aes/asm/vpaes-armv7.pl)
perlasm(BCM_SOURCES x86 aesni-x86 aes/asm/aesni-x86.pl)
perlasm(BCM_SOURCES x86 bn-586 bn/asm/bn-586.pl)
perlasm(BCM_SOURCES x86 co-586 bn/asm/co-586.pl)
perlasm(BCM_SOURCES x86 ghash-ssse3-x86 modes/asm/ghash-ssse3-x86.pl)
perlasm(BCM_SOURCES x86 ghash-x86 modes/asm/ghash-x86.pl)
perlasm(BCM_SOURCES x86 md5-586 md5/asm/md5-586.pl)
perlasm(BCM_SOURCES x86 sha1-586 sha/asm/sha1-586.pl)
perlasm(BCM_SOURCES x86 sha256-586 sha/asm/sha256-586.pl)
perlasm(BCM_SOURCES x86 sha512-586 sha/asm/sha512-586.pl)
perlasm(BCM_SOURCES x86 vpaes-x86 aes/asm/vpaes-x86.pl)
perlasm(BCM_SOURCES x86 x86-mont bn/asm/x86-mont.pl)
perlasm(BCM_SOURCES x86_64 aesni-gcm-x86_64 modes/asm/aesni-gcm-x86_64.pl)
perlasm(BCM_SOURCES x86_64 aesni-x86_64 aes/asm/aesni-x86_64.pl)
perlasm(BCM_SOURCES x86_64 ghash-ssse3-x86_64 modes/asm/ghash-ssse3-x86_64.pl)
perlasm(BCM_SOURCES x86_64 ghash-x86_64 modes/asm/ghash-x86_64.pl)
perlasm(BCM_SOURCES x86_64 md5-x86_64 md5/asm/md5-x86_64.pl)
perlasm(BCM_SOURCES x86_64 p256_beeu-x86_64-asm ec/asm/p256_beeu-x86_64-asm.pl)
perlasm(BCM_SOURCES x86_64 p256-x86_64-asm ec/asm/p256-x86_64-asm.pl)
perlasm(BCM_SOURCES x86_64 rdrand-x86_64 rand/asm/rdrand-x86_64.pl)
perlasm(BCM_SOURCES x86_64 rsaz-avx2 bn/asm/rsaz-avx2.pl)
perlasm(BCM_SOURCES x86_64 sha1-x86_64 sha/asm/sha1-x86_64.pl)
perlasm(BCM_SOURCES x86_64 sha256-x86_64 sha/asm/sha512-x86_64.pl sha256)
perlasm(BCM_SOURCES x86_64 sha512-x86_64 sha/asm/sha512-x86_64.pl sha512)
perlasm(BCM_SOURCES x86_64 vpaes-x86_64 aes/asm/vpaes-x86_64.pl)
perlasm(BCM_SOURCES x86_64 x86_64-mont bn/asm/x86_64-mont.pl)
perlasm(BCM_SOURCES x86_64 x86_64-mont5 bn/asm/x86_64-mont5.pl)

if(OPENSSL_ASM)
  list(APPEND BCM_SOURCES_ASM_USED ${BCM_SOURCES_ASM})
endif()
if(OPENSSL_NASM)
  list(APPEND BCM_SOURCES_ASM_USED ${BCM_SOURCES_NASM})
endif()

if(FIPS_DELOCATE)
  if(FIPS_SHARED)
    error("Can't set both delocate and shared mode for FIPS build")
  endif()

  add_library(
    bcm_c_generated_asm

    STATIC

    bcm.c
  )
  add_dependencies(bcm_c_generated_asm boringssl_prefix_symbols)
  target_include_directories(bcm_c_generated_asm PRIVATE ../../include)
  set_target_properties(bcm_c_generated_asm PROPERTIES COMPILE_OPTIONS "-S")
  set_target_properties(bcm_c_generated_asm PROPERTIES POSITION_INDEPENDENT_CODE ON)

  set(TARGET "")
  if(CMAKE_ASM_COMPILER_TARGET)
    set(TARGET "--target=${CMAKE_ASM_COMPILER_TARGET}")
  endif()

  go_executable(delocate boringssl.googlesource.com/boringssl/util/fipstools/delocate)
  add_custom_command(
    OUTPUT bcm-delocated.S
    COMMAND
    ./delocate
    -a $<TARGET_FILE:bcm_c_generated_asm>
    -o bcm-delocated.S
    -cc ${CMAKE_ASM_COMPILER}
    -cc-flags "${TARGET} $CMAKE_ASM_FLAGS"
    ${PROJECT_SOURCE_DIR}/include/openssl/arm_arch.h
    ${PROJECT_SOURCE_DIR}/include/openssl/asm_base.h
    ${PROJECT_SOURCE_DIR}/include/openssl/target.h
    ${BCM_SOURCES_ASM_USED}
    DEPENDS
    bcm_c_generated_asm
    delocate
    ${BCM_SOURCES_ASM_USED}
    ${PROJECT_SOURCE_DIR}/include/openssl/arm_arch.h
    ${PROJECT_SOURCE_DIR}/include/openssl/asm_base.h
    ${PROJECT_SOURCE_DIR}/include/openssl/target.h
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  )

  add_library(
    bcm_hashunset

    STATIC

    bcm-delocated.S
  )
  set_target_properties(bcm_hashunset PROPERTIES POSITION_INDEPENDENT_CODE ON)
  set_target_properties(bcm_hashunset PROPERTIES LINKER_LANGUAGE C)

  go_executable(inject_hash
                boringssl.googlesource.com/boringssl/util/fipstools/inject_hash)
  add_custom_command(
    OUTPUT bcm.o
    COMMAND ./inject_hash -o bcm.o -in-archive $<TARGET_FILE:bcm_hashunset>
    DEPENDS bcm_hashunset inject_hash
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  )

  # The outputs of add_custom_command cannot be referenced outside of the
  # CMakeLists.txt that defines it. Thus we have to wrap bcm.o in a custom target
  # so that crypto can depend on it.
  add_custom_target(bcm_o_target DEPENDS bcm.o)

  add_library(
    fipsmodule

    OBJECT

    fips_shared_support.c
  )
  add_dependencies(fipsmodule boringssl_prefix_symbols)
  target_include_directories(fipsmodule PRIVATE ../../include)
  set_target_properties(fipsmodule PROPERTIES LINKER_LANGUAGE C)
elseif(FIPS_SHARED)
  if(NOT BUILD_SHARED_LIBS)
    error("FIPS_SHARED set but not BUILD_SHARED_LIBS")
  endif()

  add_library(
    fipsmodule

    OBJECT

    fips_shared_support.c
  )
  add_dependencies(fipsmodule boringssl_prefix_symbols)
  target_include_directories(fipsmodule PRIVATE ../../include)

  add_library(
    bcm_library

    STATIC

    bcm.c
    ${BCM_SOURCES_ASM_USED}
  )
  add_dependencies(bcm_library boringssl_prefix_symbols)
  target_include_directories(bcm_library PRIVATE ../../include)

  add_custom_command(
    OUTPUT bcm.o
    COMMAND ${CMAKE_LINKER} -r -T ${CMAKE_CURRENT_SOURCE_DIR}/fips_shared.lds -o bcm.o --whole-archive $<TARGET_FILE:bcm_library>
    DEPENDS bcm_library fips_shared.lds
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  )

  add_custom_target(bcm_o_target DEPENDS bcm.o)
else()
  add_library(
    fipsmodule

    OBJECT

    bcm.c
    fips_shared_support.c
    ${BCM_SOURCES_ASM_USED}
  )
  add_dependencies(fipsmodule boringssl_prefix_symbols)
  target_include_directories(fipsmodule PRIVATE ../../include)
endif()
