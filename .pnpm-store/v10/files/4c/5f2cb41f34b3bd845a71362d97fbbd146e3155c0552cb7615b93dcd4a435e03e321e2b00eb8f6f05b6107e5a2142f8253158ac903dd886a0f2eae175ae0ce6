add_subdirectory(fipsmodule)

if(FIPS_DELOCATE OR FIPS_SHARED)
  SET_SOURCE_FILES_PROPERTIES(fipsmodule/bcm.o PROPERTIES EXTERNAL_OBJECT true)
  SET_SOURCE_FILES_PROPERTIES(fipsmodule/bcm.o PROPERTIES GENERATED true)

  set(
    CRYPTO_FIPS_OBJECTS

    fipsmodule/bcm.o
  )
endif()

set(
  CRYPTO_SOURCES_ASM
  curve25519/asm/x25519-asm-arm.S
  hrss/asm/poly_rq_mul.S
  poly1305/poly1305_arm_asm.S
  ../third_party/fiat/asm/fiat_curve25519_adx_mul.S
  ../third_party/fiat/asm/fiat_curve25519_adx_square.S
)
perlasm(CRYPTO_SOURCES aarch64 chacha/chacha-armv8 chacha/asm/chacha-armv8.pl)
perlasm(CRYPTO_SOURCES aarch64 cipher_extra/chacha20_poly1305_armv8 cipher_extra/asm/chacha20_poly1305_armv8.pl)
perlasm(CRYPTO_SOURCES aarch64 test/trampoline-armv8 test/asm/trampoline-armv8.pl)
perlasm(CRYPTO_SOURCES arm chacha/chacha-armv4 chacha/asm/chacha-armv4.pl)
perlasm(CRYPTO_SOURCES arm test/trampoline-armv4 test/asm/trampoline-armv4.pl)
perlasm(CRYPTO_SOURCES x86 chacha/chacha-x86 chacha/asm/chacha-x86.pl)
perlasm(CRYPTO_SOURCES x86 test/trampoline-x86 test/asm/trampoline-x86.pl)
perlasm(CRYPTO_SOURCES x86_64 chacha/chacha-x86_64 chacha/asm/chacha-x86_64.pl)
perlasm(CRYPTO_SOURCES x86_64 cipher_extra/aes128gcmsiv-x86_64 cipher_extra/asm/aes128gcmsiv-x86_64.pl)
perlasm(CRYPTO_SOURCES x86_64 cipher_extra/chacha20_poly1305_x86_64 cipher_extra/asm/chacha20_poly1305_x86_64.pl)
perlasm(CRYPTO_SOURCES x86_64 test/trampoline-x86_64 test/asm/trampoline-x86_64.pl)

add_custom_command(
  OUTPUT err_data.c
  COMMAND ${GO_EXECUTABLE} run err_data_generate.go > ${CMAKE_CURRENT_BINARY_DIR}/err_data.c
  DEPENDS
  err/err_data_generate.go
  err/asn1.errordata
  err/bio.errordata
  err/bn.errordata
  err/cipher.errordata
  err/conf.errordata
  err/dh.errordata
  err/digest.errordata
  err/dsa.errordata
  err/ecdh.errordata
  err/ecdsa.errordata
  err/ec.errordata
  err/engine.errordata
  err/evp.errordata
  err/hkdf.errordata
  err/obj.errordata
  err/pem.errordata
  err/pkcs7.errordata
  err/pkcs8.errordata
  err/rsa.errordata
  err/ssl.errordata
  err/trust_token.errordata
  err/x509.errordata
  err/x509v3.errordata
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/err
)

add_library(
  crypto

  asn1/a_bitstr.c
  asn1/a_bool.c
  asn1/a_d2i_fp.c
  asn1/a_dup.c
  asn1/a_gentm.c
  asn1/a_i2d_fp.c
  asn1/a_int.c
  asn1/a_mbstr.c
  asn1/a_object.c
  asn1/a_octet.c
  asn1/a_strex.c
  asn1/a_strnid.c
  asn1/a_time.c
  asn1/a_type.c
  asn1/a_utctm.c
  asn1/asn1_lib.c
  asn1/asn1_par.c
  asn1/asn_pack.c
  asn1/f_int.c
  asn1/f_string.c
  asn1/tasn_dec.c
  asn1/tasn_enc.c
  asn1/tasn_fre.c
  asn1/tasn_new.c
  asn1/tasn_typ.c
  asn1/tasn_utl.c
  asn1/posix_time.c
  base64/base64.c
  bio/bio.c
  bio/bio_mem.c
  bio/connect.c
  bio/errno.c
  bio/fd.c
  bio/file.c
  bio/hexdump.c
  bio/pair.c
  bio/printf.c
  bio/socket.c
  bio/socket_helper.c
  blake2/blake2.c
  bn_extra/bn_asn1.c
  bn_extra/convert.c
  buf/buf.c
  bytestring/asn1_compat.c
  bytestring/ber.c
  bytestring/cbb.c
  bytestring/cbs.c
  bytestring/unicode.c
  chacha/chacha.c
  cipher_extra/cipher_extra.c
  cipher_extra/derive_key.c
  cipher_extra/e_aesctrhmac.c
  cipher_extra/e_aesgcmsiv.c
  cipher_extra/e_chacha20poly1305.c
  cipher_extra/e_des.c
  cipher_extra/e_null.c
  cipher_extra/e_rc2.c
  cipher_extra/e_rc4.c
  cipher_extra/e_tls.c
  cipher_extra/tls_cbc.c
  conf/conf.c
  cpu_aarch64_apple.c
  cpu_aarch64_openbsd.c
  cpu_aarch64_fuchsia.c
  cpu_aarch64_linux.c
  cpu_aarch64_sysreg.c
  cpu_aarch64_win.c
  cpu_arm_freebsd.c
  cpu_arm_linux.c
  cpu_intel.c
  crypto.c
  curve25519/curve25519.c
  curve25519/curve25519_64_adx.c
  curve25519/spake25519.c
  des/des.c
  dh_extra/params.c
  dh_extra/dh_asn1.c
  digest_extra/digest_extra.c
  dsa/dsa.c
  dsa/dsa_asn1.c
  ecdh_extra/ecdh_extra.c
  ecdsa_extra/ecdsa_asn1.c
  ec_extra/ec_asn1.c
  ec_extra/ec_derive.c
  ec_extra/hash_to_curve.c
  err/err.c
  err_data.c
  engine/engine.c
  evp/evp.c
  evp/evp_asn1.c
  evp/evp_ctx.c
  evp/p_dsa_asn1.c
  evp/p_ec.c
  evp/p_ec_asn1.c
  evp/p_ed25519.c
  evp/p_ed25519_asn1.c
  evp/p_hkdf.c
  evp/p_rsa.c
  evp/p_rsa_asn1.c
  evp/p_x25519.c
  evp/p_x25519_asn1.c
  evp/pbkdf.c
  evp/print.c
  evp/scrypt.c
  evp/sign.c
  ex_data.c
  hpke/hpke.c
  hrss/hrss.c
  kyber/keccak.c
  kyber/kyber.c
  lhash/lhash.c
  mem.c
  obj/obj.c
  obj/obj_xref.c
  pem/pem_all.c
  pem/pem_info.c
  pem/pem_lib.c
  pem/pem_oth.c
  pem/pem_pk8.c
  pem/pem_pkey.c
  pem/pem_x509.c
  pem/pem_xaux.c
  pkcs7/pkcs7.c
  pkcs7/pkcs7_x509.c
  pkcs8/pkcs8.c
  pkcs8/pkcs8_x509.c
  pkcs8/p5_pbev2.c
  poly1305/poly1305.c
  poly1305/poly1305_arm.c
  poly1305/poly1305_vec.c
  pool/pool.c
  rand_extra/deterministic.c
  rand_extra/forkunsafe.c
  rand_extra/getentropy.c
  rand_extra/ios.c
  rand_extra/passive.c
  rand_extra/rand_extra.c
  rand_extra/trusty.c
  rand_extra/windows.c
  rc4/rc4.c
  refcount.c
  rsa_extra/rsa_asn1.c
  rsa_extra/rsa_crypt.c
  rsa_extra/rsa_print.c
  stack/stack.c
  siphash/siphash.c
  thread.c
  thread_none.c
  thread_pthread.c
  thread_win.c
  trust_token/pmbtoken.c
  trust_token/trust_token.c
  trust_token/voprf.c
  x509/a_digest.c
  x509/a_sign.c
  x509/a_verify.c
  x509/algorithm.c
  x509/asn1_gen.c
  x509/by_dir.c
  x509/by_file.c
  x509/i2d_pr.c
  x509/name_print.c
  x509/policy.c
  x509/rsa_pss.c
  x509/t_crl.c
  x509/t_req.c
  x509/t_x509.c
  x509/t_x509a.c
  x509/x509.c
  x509/x509_att.c
  x509/x509_cmp.c
  x509/x509_d2.c
  x509/x509_def.c
  x509/x509_ext.c
  x509/x509_lu.c
  x509/x509_obj.c
  x509/x509_req.c
  x509/x509_set.c
  x509/x509_trs.c
  x509/x509_txt.c
  x509/x509_v3.c
  x509/x509_vfy.c
  x509/x509_vpm.c
  x509/x509cset.c
  x509/x509name.c
  x509/x509rset.c
  x509/x509spki.c
  x509/x_algor.c
  x509/x_all.c
  x509/x_attrib.c
  x509/x_crl.c
  x509/x_exten.c
  x509/x_info.c
  x509/x_name.c
  x509/x_pkey.c
  x509/x_pubkey.c
  x509/x_req.c
  x509/x_sig.c
  x509/x_spki.c
  x509/x_val.c
  x509/x_x509.c
  x509/x_x509a.c
  x509v3/v3_akey.c
  x509v3/v3_akeya.c
  x509v3/v3_alt.c
  x509v3/v3_bcons.c
  x509v3/v3_bitst.c
  x509v3/v3_conf.c
  x509v3/v3_cpols.c
  x509v3/v3_crld.c
  x509v3/v3_enum.c
  x509v3/v3_extku.c
  x509v3/v3_genn.c
  x509v3/v3_ia5.c
  x509v3/v3_info.c
  x509v3/v3_int.c
  x509v3/v3_lib.c
  x509v3/v3_ncons.c
  x509v3/v3_ocsp.c
  x509v3/v3_pcons.c
  x509v3/v3_pmaps.c
  x509v3/v3_prn.c
  x509v3/v3_purp.c
  x509v3/v3_skey.c
  x509v3/v3_utl.c

  $<TARGET_OBJECTS:fipsmodule>
  ${CRYPTO_FIPS_OBJECTS}
)
if(OPENSSL_ASM)
  target_sources(crypto PRIVATE ${CRYPTO_SOURCES_ASM})
endif()
if(OPENSSL_NASM)
  target_sources(crypto PRIVATE ${CRYPTO_SOURCES_NASM})
endif()
target_include_directories(crypto PUBLIC
  $<BUILD_INTERFACE:${PROJECT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>
)
install_if_enabled(TARGETS crypto EXPORT OpenSSLTargets ${INSTALL_DESTINATION_DEFAULT})
set_property(TARGET crypto PROPERTY EXPORT_NAME Crypto)

if(FIPS_SHARED)
  # Rewrite libcrypto.so to inject the correct module hash value. This assumes
  # UNIX-style library naming, but we only support FIPS mode on Linux anyway.
  add_custom_command(
    TARGET crypto POST_BUILD
    COMMAND ${GO_EXECUTABLE} run
    ${CMAKE_CURRENT_SOURCE_DIR}/../util/fipstools/inject_hash/inject_hash.go
    -o libcrypto.so -in-object libcrypto.so
    # The DEPENDS argument to a POST_BUILD rule appears to be ignored. Thus
    # go_executable isn't used (as it doesn't get built), but we list this
    # dependency anyway in case it starts working in some CMake version.
    DEPENDS ../util/fipstools/inject_hash/inject_hash.go
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
  )
endif()

add_dependencies(crypto boringssl_prefix_symbols)

if(FIPS_DELOCATE OR FIPS_SHARED)
  add_dependencies(crypto bcm_o_target)
endif()

set_target_properties(crypto PROPERTIES LINKER_LANGUAGE C)

if(WIN32)
  target_link_libraries(crypto ws2_32)
endif()

if(NOT ANDROID)
  find_package(Threads REQUIRED)
  target_link_libraries(crypto Threads::Threads)
endif()

# Every target depends on crypto, so we add libcxx as a dependency here to
# simplify injecting it everywhere.
if(USE_CUSTOM_LIBCXX)
  target_link_libraries(crypto libcxx)
endif()
