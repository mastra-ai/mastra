# Copyright (c) 2015, Google Inc.
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
# SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
# OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
# CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

# This file is created by generate_build_files.py. Do not edit manually.

cmake_minimum_required(VERSION 3.10)

project(BoringSSL LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fvisibility=hidden -fno-common -fno-exceptions -fno-rtti")
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -fvisibility=hidden -fno-common")
endif()

# pthread_rwlock_t requires a feature flag on glibc.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -D_XOPEN_SOURCE=700")
endif()

if(WIN32)
  add_definitions(-D_HAS_EXCEPTIONS=0)
  add_definitions(-DWIN32_LEAN_AND_MEAN)
  add_definitions(-DNOMINMAX)
  # Allow use of fopen.
  add_definitions(-D_CRT_SECURE_NO_WARNINGS)
endif()

add_definitions(-DBORINGSSL_IMPLEMENTATION)

if(OPENSSL_NO_ASM)
  add_definitions(-DOPENSSL_NO_ASM)
else()
  # On x86 and x86_64 Windows, we use the NASM output.
  if(WIN32 AND CMAKE_SYSTEM_PROCESSOR MATCHES "AMD64|x86_64|amd64|x86|i[3-6]86")
    enable_language(ASM_NASM)
    set(OPENSSL_NASM TRUE)
    set(CMAKE_ASM_NASM_FLAGS "${CMAKE_ASM_NASM_FLAGS} -gcv8")
  else()
    enable_language(ASM)
    set(OPENSSL_ASM TRUE)
    # Work around https://gitlab.kitware.com/cmake/cmake/-/issues/20771 in older
    # CMake versions.
    if(APPLE AND CMAKE_VERSION VERSION_LESS 3.19)
      if(CMAKE_OSX_SYSROOT)
        set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -isysroot \"${CMAKE_OSX_SYSROOT}\"")
      endif()
      foreach(arch ${CMAKE_OSX_ARCHITECTURES})
        set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -arch ${arch}")
      endforeach()
    endif()
    if(NOT WIN32)
      set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -Wa,--noexecstack")
    endif()
    # Clang's integerated assembler does not support debug symbols.
    if(NOT CMAKE_ASM_COMPILER_ID MATCHES "Clang")
      set(CMAKE_ASM_FLAGS "${CMAKE_ASM_FLAGS} -Wa,-g")
    endif()
  endif()
endif()

if(BUILD_SHARED_LIBS)
  add_definitions(-DBORINGSSL_SHARED_LIBRARY)
  # Enable position-independent code globally. This is needed because
  # some library targets are OBJECT libraries.
  set(CMAKE_POSITION_INDEPENDENT_CODE TRUE)
endif()

set(
  CRYPTO_SOURCES_ASM

  apple-aarch64/crypto/chacha/chacha-armv8-apple.S
  apple-aarch64/crypto/cipher_extra/chacha20_poly1305_armv8-apple.S
  apple-aarch64/crypto/fipsmodule/aesv8-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/aesv8-gcm-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/armv8-mont-apple.S
  apple-aarch64/crypto/fipsmodule/bn-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/ghash-neon-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/ghashv8-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/p256-armv8-asm-apple.S
  apple-aarch64/crypto/fipsmodule/p256_beeu-armv8-asm-apple.S
  apple-aarch64/crypto/fipsmodule/sha1-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/sha256-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/sha512-armv8-apple.S
  apple-aarch64/crypto/fipsmodule/vpaes-armv8-apple.S
  apple-aarch64/crypto/test/trampoline-armv8-apple.S
  apple-arm/crypto/chacha/chacha-armv4-apple.S
  apple-arm/crypto/fipsmodule/aesv8-armv7-apple.S
  apple-arm/crypto/fipsmodule/armv4-mont-apple.S
  apple-arm/crypto/fipsmodule/bsaes-armv7-apple.S
  apple-arm/crypto/fipsmodule/ghash-armv4-apple.S
  apple-arm/crypto/fipsmodule/ghashv8-armv7-apple.S
  apple-arm/crypto/fipsmodule/sha1-armv4-large-apple.S
  apple-arm/crypto/fipsmodule/sha256-armv4-apple.S
  apple-arm/crypto/fipsmodule/sha512-armv4-apple.S
  apple-arm/crypto/fipsmodule/vpaes-armv7-apple.S
  apple-arm/crypto/test/trampoline-armv4-apple.S
  apple-x86/crypto/chacha/chacha-x86-apple.S
  apple-x86/crypto/fipsmodule/aesni-x86-apple.S
  apple-x86/crypto/fipsmodule/bn-586-apple.S
  apple-x86/crypto/fipsmodule/co-586-apple.S
  apple-x86/crypto/fipsmodule/ghash-ssse3-x86-apple.S
  apple-x86/crypto/fipsmodule/ghash-x86-apple.S
  apple-x86/crypto/fipsmodule/md5-586-apple.S
  apple-x86/crypto/fipsmodule/sha1-586-apple.S
  apple-x86/crypto/fipsmodule/sha256-586-apple.S
  apple-x86/crypto/fipsmodule/sha512-586-apple.S
  apple-x86/crypto/fipsmodule/vpaes-x86-apple.S
  apple-x86/crypto/fipsmodule/x86-mont-apple.S
  apple-x86/crypto/test/trampoline-x86-apple.S
  apple-x86_64/crypto/chacha/chacha-x86_64-apple.S
  apple-x86_64/crypto/cipher_extra/aes128gcmsiv-x86_64-apple.S
  apple-x86_64/crypto/cipher_extra/chacha20_poly1305_x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/aesni-gcm-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/aesni-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/ghash-ssse3-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/ghash-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/md5-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/p256-x86_64-asm-apple.S
  apple-x86_64/crypto/fipsmodule/p256_beeu-x86_64-asm-apple.S
  apple-x86_64/crypto/fipsmodule/rdrand-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/rsaz-avx2-apple.S
  apple-x86_64/crypto/fipsmodule/sha1-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/sha256-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/sha512-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/vpaes-x86_64-apple.S
  apple-x86_64/crypto/fipsmodule/x86_64-mont-apple.S
  apple-x86_64/crypto/fipsmodule/x86_64-mont5-apple.S
  apple-x86_64/crypto/test/trampoline-x86_64-apple.S
  linux-aarch64/crypto/chacha/chacha-armv8-linux.S
  linux-aarch64/crypto/cipher_extra/chacha20_poly1305_armv8-linux.S
  linux-aarch64/crypto/fipsmodule/aesv8-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/aesv8-gcm-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/armv8-mont-linux.S
  linux-aarch64/crypto/fipsmodule/bn-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/ghash-neon-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/ghashv8-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/p256-armv8-asm-linux.S
  linux-aarch64/crypto/fipsmodule/p256_beeu-armv8-asm-linux.S
  linux-aarch64/crypto/fipsmodule/sha1-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/sha256-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/sha512-armv8-linux.S
  linux-aarch64/crypto/fipsmodule/vpaes-armv8-linux.S
  linux-aarch64/crypto/test/trampoline-armv8-linux.S
  linux-arm/crypto/chacha/chacha-armv4-linux.S
  linux-arm/crypto/fipsmodule/aesv8-armv7-linux.S
  linux-arm/crypto/fipsmodule/armv4-mont-linux.S
  linux-arm/crypto/fipsmodule/bsaes-armv7-linux.S
  linux-arm/crypto/fipsmodule/ghash-armv4-linux.S
  linux-arm/crypto/fipsmodule/ghashv8-armv7-linux.S
  linux-arm/crypto/fipsmodule/sha1-armv4-large-linux.S
  linux-arm/crypto/fipsmodule/sha256-armv4-linux.S
  linux-arm/crypto/fipsmodule/sha512-armv4-linux.S
  linux-arm/crypto/fipsmodule/vpaes-armv7-linux.S
  linux-arm/crypto/test/trampoline-armv4-linux.S
  linux-x86/crypto/chacha/chacha-x86-linux.S
  linux-x86/crypto/fipsmodule/aesni-x86-linux.S
  linux-x86/crypto/fipsmodule/bn-586-linux.S
  linux-x86/crypto/fipsmodule/co-586-linux.S
  linux-x86/crypto/fipsmodule/ghash-ssse3-x86-linux.S
  linux-x86/crypto/fipsmodule/ghash-x86-linux.S
  linux-x86/crypto/fipsmodule/md5-586-linux.S
  linux-x86/crypto/fipsmodule/sha1-586-linux.S
  linux-x86/crypto/fipsmodule/sha256-586-linux.S
  linux-x86/crypto/fipsmodule/sha512-586-linux.S
  linux-x86/crypto/fipsmodule/vpaes-x86-linux.S
  linux-x86/crypto/fipsmodule/x86-mont-linux.S
  linux-x86/crypto/test/trampoline-x86-linux.S
  linux-x86_64/crypto/chacha/chacha-x86_64-linux.S
  linux-x86_64/crypto/cipher_extra/aes128gcmsiv-x86_64-linux.S
  linux-x86_64/crypto/cipher_extra/chacha20_poly1305_x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/aesni-gcm-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/aesni-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/ghash-ssse3-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/ghash-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/md5-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/p256-x86_64-asm-linux.S
  linux-x86_64/crypto/fipsmodule/p256_beeu-x86_64-asm-linux.S
  linux-x86_64/crypto/fipsmodule/rdrand-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/rsaz-avx2-linux.S
  linux-x86_64/crypto/fipsmodule/sha1-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/sha256-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/sha512-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/vpaes-x86_64-linux.S
  linux-x86_64/crypto/fipsmodule/x86_64-mont-linux.S
  linux-x86_64/crypto/fipsmodule/x86_64-mont5-linux.S
  linux-x86_64/crypto/test/trampoline-x86_64-linux.S
  src/crypto/curve25519/asm/x25519-asm-arm.S
  src/crypto/hrss/asm/poly_rq_mul.S
  src/crypto/poly1305/poly1305_arm_asm.S
  src/third_party/fiat/asm/fiat_curve25519_adx_mul.S
  src/third_party/fiat/asm/fiat_curve25519_adx_square.S
  win-aarch64/crypto/chacha/chacha-armv8-win.S
  win-aarch64/crypto/cipher_extra/chacha20_poly1305_armv8-win.S
  win-aarch64/crypto/fipsmodule/aesv8-armv8-win.S
  win-aarch64/crypto/fipsmodule/aesv8-gcm-armv8-win.S
  win-aarch64/crypto/fipsmodule/armv8-mont-win.S
  win-aarch64/crypto/fipsmodule/bn-armv8-win.S
  win-aarch64/crypto/fipsmodule/ghash-neon-armv8-win.S
  win-aarch64/crypto/fipsmodule/ghashv8-armv8-win.S
  win-aarch64/crypto/fipsmodule/p256-armv8-asm-win.S
  win-aarch64/crypto/fipsmodule/p256_beeu-armv8-asm-win.S
  win-aarch64/crypto/fipsmodule/sha1-armv8-win.S
  win-aarch64/crypto/fipsmodule/sha256-armv8-win.S
  win-aarch64/crypto/fipsmodule/sha512-armv8-win.S
  win-aarch64/crypto/fipsmodule/vpaes-armv8-win.S
  win-aarch64/crypto/test/trampoline-armv8-win.S
)

set(
  CRYPTO_SOURCES_NASM

  win-x86/crypto/chacha/chacha-x86-win.asm
  win-x86/crypto/fipsmodule/aesni-x86-win.asm
  win-x86/crypto/fipsmodule/bn-586-win.asm
  win-x86/crypto/fipsmodule/co-586-win.asm
  win-x86/crypto/fipsmodule/ghash-ssse3-x86-win.asm
  win-x86/crypto/fipsmodule/ghash-x86-win.asm
  win-x86/crypto/fipsmodule/md5-586-win.asm
  win-x86/crypto/fipsmodule/sha1-586-win.asm
  win-x86/crypto/fipsmodule/sha256-586-win.asm
  win-x86/crypto/fipsmodule/sha512-586-win.asm
  win-x86/crypto/fipsmodule/vpaes-x86-win.asm
  win-x86/crypto/fipsmodule/x86-mont-win.asm
  win-x86/crypto/test/trampoline-x86-win.asm
  win-x86_64/crypto/chacha/chacha-x86_64-win.asm
  win-x86_64/crypto/cipher_extra/aes128gcmsiv-x86_64-win.asm
  win-x86_64/crypto/cipher_extra/chacha20_poly1305_x86_64-win.asm
  win-x86_64/crypto/fipsmodule/aesni-gcm-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/aesni-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/ghash-ssse3-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/ghash-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/md5-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/p256-x86_64-asm-win.asm
  win-x86_64/crypto/fipsmodule/p256_beeu-x86_64-asm-win.asm
  win-x86_64/crypto/fipsmodule/rdrand-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/rsaz-avx2-win.asm
  win-x86_64/crypto/fipsmodule/sha1-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/sha256-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/sha512-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/vpaes-x86_64-win.asm
  win-x86_64/crypto/fipsmodule/x86_64-mont-win.asm
  win-x86_64/crypto/fipsmodule/x86_64-mont5-win.asm
  win-x86_64/crypto/test/trampoline-x86_64-win.asm
)

if(OPENSSL_ASM)
  list(APPEND CRYPTO_SOURCES_ASM_USED ${CRYPTO_SOURCES_ASM})
endif()
if(OPENSSL_NASM)
  list(APPEND CRYPTO_SOURCES_ASM_USED ${CRYPTO_SOURCES_NASM})
endif()

add_library(
  crypto

  ${CRYPTO_SOURCES_ASM_USED}
  err_data.c
  src/crypto/asn1/a_bitstr.c
  src/crypto/asn1/a_bool.c
  src/crypto/asn1/a_d2i_fp.c
  src/crypto/asn1/a_dup.c
  src/crypto/asn1/a_gentm.c
  src/crypto/asn1/a_i2d_fp.c
  src/crypto/asn1/a_int.c
  src/crypto/asn1/a_mbstr.c
  src/crypto/asn1/a_object.c
  src/crypto/asn1/a_octet.c
  src/crypto/asn1/a_strex.c
  src/crypto/asn1/a_strnid.c
  src/crypto/asn1/a_time.c
  src/crypto/asn1/a_type.c
  src/crypto/asn1/a_utctm.c
  src/crypto/asn1/asn1_lib.c
  src/crypto/asn1/asn1_par.c
  src/crypto/asn1/asn_pack.c
  src/crypto/asn1/f_int.c
  src/crypto/asn1/f_string.c
  src/crypto/asn1/posix_time.c
  src/crypto/asn1/tasn_dec.c
  src/crypto/asn1/tasn_enc.c
  src/crypto/asn1/tasn_fre.c
  src/crypto/asn1/tasn_new.c
  src/crypto/asn1/tasn_typ.c
  src/crypto/asn1/tasn_utl.c
  src/crypto/base64/base64.c
  src/crypto/bio/bio.c
  src/crypto/bio/bio_mem.c
  src/crypto/bio/connect.c
  src/crypto/bio/errno.c
  src/crypto/bio/fd.c
  src/crypto/bio/file.c
  src/crypto/bio/hexdump.c
  src/crypto/bio/pair.c
  src/crypto/bio/printf.c
  src/crypto/bio/socket.c
  src/crypto/bio/socket_helper.c
  src/crypto/blake2/blake2.c
  src/crypto/bn_extra/bn_asn1.c
  src/crypto/bn_extra/convert.c
  src/crypto/buf/buf.c
  src/crypto/bytestring/asn1_compat.c
  src/crypto/bytestring/ber.c
  src/crypto/bytestring/cbb.c
  src/crypto/bytestring/cbs.c
  src/crypto/bytestring/unicode.c
  src/crypto/chacha/chacha.c
  src/crypto/cipher_extra/cipher_extra.c
  src/crypto/cipher_extra/derive_key.c
  src/crypto/cipher_extra/e_aesctrhmac.c
  src/crypto/cipher_extra/e_aesgcmsiv.c
  src/crypto/cipher_extra/e_chacha20poly1305.c
  src/crypto/cipher_extra/e_des.c
  src/crypto/cipher_extra/e_null.c
  src/crypto/cipher_extra/e_rc2.c
  src/crypto/cipher_extra/e_rc4.c
  src/crypto/cipher_extra/e_tls.c
  src/crypto/cipher_extra/tls_cbc.c
  src/crypto/conf/conf.c
  src/crypto/cpu_aarch64_apple.c
  src/crypto/cpu_aarch64_fuchsia.c
  src/crypto/cpu_aarch64_linux.c
  src/crypto/cpu_aarch64_openbsd.c
  src/crypto/cpu_aarch64_sysreg.c
  src/crypto/cpu_aarch64_win.c
  src/crypto/cpu_arm_freebsd.c
  src/crypto/cpu_arm_linux.c
  src/crypto/cpu_intel.c
  src/crypto/crypto.c
  src/crypto/curve25519/curve25519.c
  src/crypto/curve25519/curve25519_64_adx.c
  src/crypto/curve25519/spake25519.c
  src/crypto/des/des.c
  src/crypto/dh_extra/dh_asn1.c
  src/crypto/dh_extra/params.c
  src/crypto/digest_extra/digest_extra.c
  src/crypto/dsa/dsa.c
  src/crypto/dsa/dsa_asn1.c
  src/crypto/ec_extra/ec_asn1.c
  src/crypto/ec_extra/ec_derive.c
  src/crypto/ec_extra/hash_to_curve.c
  src/crypto/ecdh_extra/ecdh_extra.c
  src/crypto/ecdsa_extra/ecdsa_asn1.c
  src/crypto/engine/engine.c
  src/crypto/err/err.c
  src/crypto/evp/evp.c
  src/crypto/evp/evp_asn1.c
  src/crypto/evp/evp_ctx.c
  src/crypto/evp/p_dsa_asn1.c
  src/crypto/evp/p_ec.c
  src/crypto/evp/p_ec_asn1.c
  src/crypto/evp/p_ed25519.c
  src/crypto/evp/p_ed25519_asn1.c
  src/crypto/evp/p_hkdf.c
  src/crypto/evp/p_rsa.c
  src/crypto/evp/p_rsa_asn1.c
  src/crypto/evp/p_x25519.c
  src/crypto/evp/p_x25519_asn1.c
  src/crypto/evp/pbkdf.c
  src/crypto/evp/print.c
  src/crypto/evp/scrypt.c
  src/crypto/evp/sign.c
  src/crypto/ex_data.c
  src/crypto/fipsmodule/bcm.c
  src/crypto/fipsmodule/fips_shared_support.c
  src/crypto/hpke/hpke.c
  src/crypto/hrss/hrss.c
  src/crypto/kyber/keccak.c
  src/crypto/kyber/kyber.c
  src/crypto/lhash/lhash.c
  src/crypto/mem.c
  src/crypto/obj/obj.c
  src/crypto/obj/obj_xref.c
  src/crypto/pem/pem_all.c
  src/crypto/pem/pem_info.c
  src/crypto/pem/pem_lib.c
  src/crypto/pem/pem_oth.c
  src/crypto/pem/pem_pk8.c
  src/crypto/pem/pem_pkey.c
  src/crypto/pem/pem_x509.c
  src/crypto/pem/pem_xaux.c
  src/crypto/pkcs7/pkcs7.c
  src/crypto/pkcs7/pkcs7_x509.c
  src/crypto/pkcs8/p5_pbev2.c
  src/crypto/pkcs8/pkcs8.c
  src/crypto/pkcs8/pkcs8_x509.c
  src/crypto/poly1305/poly1305.c
  src/crypto/poly1305/poly1305_arm.c
  src/crypto/poly1305/poly1305_vec.c
  src/crypto/pool/pool.c
  src/crypto/rand_extra/deterministic.c
  src/crypto/rand_extra/forkunsafe.c
  src/crypto/rand_extra/getentropy.c
  src/crypto/rand_extra/ios.c
  src/crypto/rand_extra/passive.c
  src/crypto/rand_extra/rand_extra.c
  src/crypto/rand_extra/trusty.c
  src/crypto/rand_extra/windows.c
  src/crypto/rc4/rc4.c
  src/crypto/refcount.c
  src/crypto/rsa_extra/rsa_asn1.c
  src/crypto/rsa_extra/rsa_crypt.c
  src/crypto/rsa_extra/rsa_print.c
  src/crypto/siphash/siphash.c
  src/crypto/stack/stack.c
  src/crypto/thread.c
  src/crypto/thread_none.c
  src/crypto/thread_pthread.c
  src/crypto/thread_win.c
  src/crypto/trust_token/pmbtoken.c
  src/crypto/trust_token/trust_token.c
  src/crypto/trust_token/voprf.c
  src/crypto/x509/a_digest.c
  src/crypto/x509/a_sign.c
  src/crypto/x509/a_verify.c
  src/crypto/x509/algorithm.c
  src/crypto/x509/asn1_gen.c
  src/crypto/x509/by_dir.c
  src/crypto/x509/by_file.c
  src/crypto/x509/i2d_pr.c
  src/crypto/x509/name_print.c
  src/crypto/x509/policy.c
  src/crypto/x509/rsa_pss.c
  src/crypto/x509/t_crl.c
  src/crypto/x509/t_req.c
  src/crypto/x509/t_x509.c
  src/crypto/x509/t_x509a.c
  src/crypto/x509/x509.c
  src/crypto/x509/x509_att.c
  src/crypto/x509/x509_cmp.c
  src/crypto/x509/x509_d2.c
  src/crypto/x509/x509_def.c
  src/crypto/x509/x509_ext.c
  src/crypto/x509/x509_lu.c
  src/crypto/x509/x509_obj.c
  src/crypto/x509/x509_req.c
  src/crypto/x509/x509_set.c
  src/crypto/x509/x509_trs.c
  src/crypto/x509/x509_txt.c
  src/crypto/x509/x509_v3.c
  src/crypto/x509/x509_vfy.c
  src/crypto/x509/x509_vpm.c
  src/crypto/x509/x509cset.c
  src/crypto/x509/x509name.c
  src/crypto/x509/x509rset.c
  src/crypto/x509/x509spki.c
  src/crypto/x509/x_algor.c
  src/crypto/x509/x_all.c
  src/crypto/x509/x_attrib.c
  src/crypto/x509/x_crl.c
  src/crypto/x509/x_exten.c
  src/crypto/x509/x_info.c
  src/crypto/x509/x_name.c
  src/crypto/x509/x_pkey.c
  src/crypto/x509/x_pubkey.c
  src/crypto/x509/x_req.c
  src/crypto/x509/x_sig.c
  src/crypto/x509/x_spki.c
  src/crypto/x509/x_val.c
  src/crypto/x509/x_x509.c
  src/crypto/x509/x_x509a.c
  src/crypto/x509v3/v3_akey.c
  src/crypto/x509v3/v3_akeya.c
  src/crypto/x509v3/v3_alt.c
  src/crypto/x509v3/v3_bcons.c
  src/crypto/x509v3/v3_bitst.c
  src/crypto/x509v3/v3_conf.c
  src/crypto/x509v3/v3_cpols.c
  src/crypto/x509v3/v3_crld.c
  src/crypto/x509v3/v3_enum.c
  src/crypto/x509v3/v3_extku.c
  src/crypto/x509v3/v3_genn.c
  src/crypto/x509v3/v3_ia5.c
  src/crypto/x509v3/v3_info.c
  src/crypto/x509v3/v3_int.c
  src/crypto/x509v3/v3_lib.c
  src/crypto/x509v3/v3_ncons.c
  src/crypto/x509v3/v3_ocsp.c
  src/crypto/x509v3/v3_pcons.c
  src/crypto/x509v3/v3_pmaps.c
  src/crypto/x509v3/v3_prn.c
  src/crypto/x509v3/v3_purp.c
  src/crypto/x509v3/v3_skey.c
  src/crypto/x509v3/v3_utl.c
)

target_include_directories(crypto PUBLIC $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src/include>)

add_library(
  ssl

  src/ssl/bio_ssl.cc
  src/ssl/d1_both.cc
  src/ssl/d1_lib.cc
  src/ssl/d1_pkt.cc
  src/ssl/d1_srtp.cc
  src/ssl/dtls_method.cc
  src/ssl/dtls_record.cc
  src/ssl/encrypted_client_hello.cc
  src/ssl/extensions.cc
  src/ssl/handoff.cc
  src/ssl/handshake.cc
  src/ssl/handshake_client.cc
  src/ssl/handshake_server.cc
  src/ssl/s3_both.cc
  src/ssl/s3_lib.cc
  src/ssl/s3_pkt.cc
  src/ssl/ssl_aead_ctx.cc
  src/ssl/ssl_asn1.cc
  src/ssl/ssl_buffer.cc
  src/ssl/ssl_cert.cc
  src/ssl/ssl_cipher.cc
  src/ssl/ssl_file.cc
  src/ssl/ssl_key_share.cc
  src/ssl/ssl_lib.cc
  src/ssl/ssl_privkey.cc
  src/ssl/ssl_session.cc
  src/ssl/ssl_stat.cc
  src/ssl/ssl_transcript.cc
  src/ssl/ssl_versions.cc
  src/ssl/ssl_x509.cc
  src/ssl/t1_enc.cc
  src/ssl/tls13_both.cc
  src/ssl/tls13_client.cc
  src/ssl/tls13_enc.cc
  src/ssl/tls13_server.cc
  src/ssl/tls_method.cc
  src/ssl/tls_record.cc
)

target_link_libraries(ssl crypto)

add_executable(
  bssl

  src/tool/args.cc
  src/tool/ciphers.cc
  src/tool/client.cc
  src/tool/const.cc
  src/tool/digest.cc
  src/tool/fd.cc
  src/tool/file.cc
  src/tool/generate_ech.cc
  src/tool/generate_ed25519.cc
  src/tool/genrsa.cc
  src/tool/pkcs12.cc
  src/tool/rand.cc
  src/tool/server.cc
  src/tool/sign.cc
  src/tool/speed.cc
  src/tool/tool.cc
  src/tool/transport_common.cc
)

target_link_libraries(bssl ssl crypto)

if(NOT ANDROID)
  find_package(Threads REQUIRED)
  target_link_libraries(crypto Threads::Threads)
endif()

if(WIN32)
  target_link_libraries(crypto ws2_32)
endif()

