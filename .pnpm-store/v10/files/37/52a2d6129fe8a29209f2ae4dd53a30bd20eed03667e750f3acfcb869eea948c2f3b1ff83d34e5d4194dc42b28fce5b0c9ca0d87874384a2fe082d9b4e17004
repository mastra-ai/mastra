/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include "cbcrypto.h"
#include <couchbase/build_config.hxx>

#include <memory>
#include <stdexcept>

namespace internal
{

#ifdef _MSC_VER
#include <windows.h>

#include <bcrypt.h>

struct HeapAllocDeleter {
  void operator()(PBYTE bytes)
  {
    HeapFree(GetProcessHeap(), 0, bytes);
  }
};

using uniqueHeapPtr = std::unique_ptr<BYTE, HeapAllocDeleter>;

inline auto
hash(std::string_view key, std::string_view data, LPCWSTR algorithm, int flags) -> std::string
{
  BCRYPT_ALG_HANDLE hAlg;
  NTSTATUS status = BCryptOpenAlgorithmProvider(&hAlg, algorithm, nullptr, flags);
  if (status < 0) {
    throw std::runtime_error("digest: BCryptOpenAlgorithmProvider return: " +
                             std::to_string(status));
  }

  DWORD pcbResult = 0;
  DWORD cbHashObject = 0;

  // calculate the size of the buffer to hold the hash object
  status = BCryptGetProperty(hAlg,
                             BCRYPT_OBJECT_LENGTH,
                             reinterpret_cast<PBYTE>(&cbHashObject),
                             sizeof(DWORD),
                             &pcbResult,
                             0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("digest: BCryptGetProperty return: " + std::to_string(status));
  }

  // calculate the length of the hash
  DWORD cbHash = 0;
  status = BCryptGetProperty(
    hAlg, BCRYPT_HASH_LENGTH, reinterpret_cast<PBYTE>(&cbHash), sizeof(DWORD), &pcbResult, 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("digest: BCryptGetProperty return: " + std::to_string(status));
  }

  // allocate the hash object on the heap
  uniqueHeapPtr pbHashObject(static_cast<PBYTE>(HeapAlloc(GetProcessHeap(), 0, cbHashObject)));
  if (!pbHashObject) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::bad_alloc();
  }

  std::string ret;
  ret.resize(cbHash);

  // create the hash
  BCRYPT_HASH_HANDLE hHash;
  status = BCryptCreateHash(hAlg,
                            &hHash,
                            pbHashObject.get(),
                            cbHashObject,
                            (PUCHAR)key.data(),
                            static_cast<ULONG>(key.size()),
                            0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("digest: BCryptCreateHash return: " + std::to_string(status));
  }

  status = BCryptHashData(hHash, (PBYTE)data.data(), static_cast<ULONG>(data.size()), 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    BCryptDestroyHash(hHash);
    throw std::runtime_error("digest: BCryptHashData return: " + std::to_string(status));
  }

  status = BCryptFinishHash(hHash, reinterpret_cast<std::uint8_t*>(ret.data()), cbHash, 0);

  // Release resources
  BCryptCloseAlgorithmProvider(hAlg, 0);
  BCryptDestroyHash(hHash);

  if (status < 0) {
    throw std::runtime_error("digest: BCryptFinishHash return: " + std::to_string(status));
  }

  return ret;
}

auto
HMAC_SHA1(std::string_view key, std::string_view data) -> std::string
{
  return hash(key, data, BCRYPT_SHA1_ALGORITHM, BCRYPT_ALG_HANDLE_HMAC_FLAG);
}

auto
HMAC_SHA256(std::string_view key, std::string_view data) -> std::string
{
  return hash(key, data, BCRYPT_SHA256_ALGORITHM, BCRYPT_ALG_HANDLE_HMAC_FLAG);
}

auto
HMAC_SHA512(std::string_view key, std::string_view data) -> std::string
{
  return hash(key, data, BCRYPT_SHA512_ALGORITHM, BCRYPT_ALG_HANDLE_HMAC_FLAG);
}

inline auto
PBKDF2(const std::string& pass,
       std::string_view salt,
       unsigned int iterationCount,
       LPCWSTR algorithm) -> std::string
{
  // open an algorithm handle
  BCRYPT_ALG_HANDLE hAlg;
  NTSTATUS status;

  status = BCryptOpenAlgorithmProvider(&hAlg, algorithm, nullptr, BCRYPT_ALG_HANDLE_HMAC_FLAG);
  if (status < 0) {
    throw std::runtime_error("digest: BCryptOpenAlgorithmProvider return: " +
                             std::to_string(status));
  }

  DWORD pcbResult = 0;

  // calculate the length of the hash
  DWORD cbHash = 0;
  status =
    BCryptGetProperty(hAlg, BCRYPT_HASH_LENGTH, (PBYTE)&cbHash, sizeof(DWORD), &pcbResult, 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("digest: BCryptGetProperty return: " + std::to_string(status));
  }

  std::string ret;
  ret.resize(cbHash);

  status = BCryptDeriveKeyPBKDF2(hAlg,
                                 (PUCHAR)pass.data(),
                                 ULONG(pass.size()),
                                 (PUCHAR)salt.data(),
                                 ULONG(salt.size()),
                                 iterationCount,
                                 (PUCHAR)ret.data(),
                                 ULONG(ret.size()),
                                 0);

  // Release resources
  BCryptCloseAlgorithmProvider(hAlg, 0);

  if (status < 0) {
    throw std::runtime_error("digest: BCryptDeriveKeyPBKDF2 return: " + std::to_string(status));
  }

  return ret;
}

auto
PBKDF2_HMAC_SHA1(const std::string& pass,
                 std::string_view salt,
                 unsigned int iterationCount) -> std::string
{
  return PBKDF2(pass, salt, iterationCount, BCRYPT_SHA1_ALGORITHM);
}

auto
PBKDF2_HMAC_SHA256(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  return PBKDF2(pass, salt, iterationCount, BCRYPT_SHA256_ALGORITHM);
}

auto
PBKDF2_HMAC_SHA512(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  return PBKDF2(pass, salt, iterationCount, BCRYPT_SHA512_ALGORITHM);
}

auto
digest_sha1(std::string_view data) -> std::string
{
  return hash({}, data, BCRYPT_SHA1_ALGORITHM, 0);
}

auto
digest_sha256(std::string_view data) -> std::string
{
  return hash({}, data, BCRYPT_SHA256_ALGORITHM, 0);
}

auto
digest_sha512(std::string_view data) -> std::string
{
  return hash({}, data, BCRYPT_SHA512_ALGORITHM, 0);
}

auto
AES_256_cbc(bool encrypt, std::string_view key, std::string_view iv, std::string_view data)
  -> std::string
{
  BCRYPT_ALG_HANDLE hAlg;
  NTSTATUS status = BCryptOpenAlgorithmProvider(&hAlg, BCRYPT_AES_ALGORITHM, nullptr, 0);

  if (status < 0) {
    throw std::runtime_error("encrypt: BCryptOpenAlgorithmProvider() return: " +
                             std::to_string(status));
  }

  DWORD cbData = 0;
  DWORD cbKeyObject = 0;

  // Calculate the size of the buffer to hold the KeyObject.
  status =
    BCryptGetProperty(hAlg, BCRYPT_OBJECT_LENGTH, (PBYTE)&cbKeyObject, sizeof(DWORD), &cbData, 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("encrypt: BCryptGetProperty() return: " + std::to_string(status));
  }

  // Allocate the key object on the heap.
  uniqueHeapPtr pbKeyObject((PBYTE)HeapAlloc(GetProcessHeap(), 0, cbKeyObject));
  if (!pbKeyObject) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::bad_alloc();
  }

  status = BCryptSetProperty(
    hAlg, BCRYPT_CHAINING_MODE, (PBYTE)BCRYPT_CHAIN_MODE_CBC, sizeof(BCRYPT_CHAIN_MODE_CBC), 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("encrypt: BCryptSetProperty() return: " + std::to_string(status));
  }

  // Generate the key from supplied input key bytes.
  BCRYPT_KEY_HANDLE hKey;
  status = BCryptGenerateSymmetricKey(
    hAlg, &hKey, pbKeyObject.get(), cbKeyObject, (PBYTE)key.data(), ULONG(key.size()), 0);
  if (status < 0) {
    BCryptCloseAlgorithmProvider(hAlg, 0);
    throw std::runtime_error("encrypt: BCryptGenerateSymmetricKey() return: " +
                             std::to_string(status));
  }

  // For some reason the API will modify the input vector.. just create a
  // copy.. it's small anyway
  std::string civ(iv.begin(), iv.end());

  std::string ret;
  ret.resize(data.size() + iv.size());
  if (encrypt) {
    status = BCryptEncrypt(hKey,
                           (PUCHAR)data.data(),
                           ULONG(data.size()),
                           nullptr,
                           (PBYTE)civ.data(),
                           ULONG(civ.size()),
                           reinterpret_cast<std::uint8_t*>(ret.data()),
                           ULONG(ret.size()),
                           &cbData,
                           BCRYPT_BLOCK_PADDING);
  } else {
    status = BCryptDecrypt(hKey,
                           (PUCHAR)data.data(),
                           ULONG(data.size()),
                           nullptr,
                           (PBYTE)civ.data(),
                           ULONG(civ.size()),
                           reinterpret_cast<std::uint8_t*>(ret.data()),
                           ULONG(ret.size()),
                           &cbData,
                           BCRYPT_BLOCK_PADDING);
  }

  BCryptCloseAlgorithmProvider(hAlg, 0);
  BCryptDestroyKey(hKey);

  if (status < 0) {
    throw std::runtime_error("encrypt: BCryptEncrypt() return: " + std::to_string(status));
  }

  ret.resize(cbData);

  return ret;
}

std::string
encrypt(const couchbase::core::crypto::Cipher /* cipher */,
        std::string_view key,
        std::string_view iv,
        std::string_view data)
{
  return AES_256_cbc(true, key, iv, data);
}

std::string
decrypt(const couchbase::core::crypto::Cipher /* cipher */,
        std::string_view key,
        std::string_view iv,
        std::string_view data)
{
  return AES_256_cbc(false, key, iv, data);
}

#elif defined(__APPLE__)

#include <CommonCrypto/CommonCryptor.h>
#include <CommonCrypto/CommonDigest.h>
#include <CommonCrypto/CommonHMAC.h>
#include <CommonCrypto/CommonKeyDerivation.h>

auto
HMAC_SHA1(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);
  CCHmac(kCCHmacAlgSHA1,
         key.data(),
         key.size(),
         data.data(),
         data.size(),
         reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
HMAC_SHA256(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
  CCHmac(kCCHmacAlgSHA256,
         key.data(),
         key.size(),
         data.data(),
         data.size(),
         reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
HMAC_SHA512(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
  CCHmac(kCCHmacAlgSHA512,
         key.data(),
         key.size(),
         data.data(),
         data.size(),
         reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
PBKDF2_HMAC_SHA1(const std::string& pass,
                 std::string_view salt,
                 unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);
  auto err = CCKeyDerivationPBKDF(kCCPBKDF2,
                                  pass.data(),
                                  pass.size(),
                                  reinterpret_cast<const std::uint8_t*>(salt.data()),
                                  salt.size(),
                                  kCCPRFHmacAlgSHA1,
                                  iterationCount,
                                  reinterpret_cast<std::uint8_t*>(ret.data()),
                                  ret.size());

  if (err != 0) {
    throw std::runtime_error(
      "couchbase::core::crypto::PBKDF2_HMAC(SHA1): CCKeyDerivationPBKDF failed: " +
      std::to_string(err));
  }
  return ret;
}

auto
PBKDF2_HMAC_SHA256(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
  auto err = CCKeyDerivationPBKDF(kCCPBKDF2,
                                  pass.data(),
                                  pass.size(),
                                  reinterpret_cast<const std::uint8_t*>(salt.data()),
                                  salt.size(),
                                  kCCPRFHmacAlgSHA256,
                                  iterationCount,
                                  reinterpret_cast<std::uint8_t*>(ret.data()),
                                  ret.size());
  if (err != 0) {
    throw std::runtime_error("couchbase::core::crypto::PBKDF2_HMAC(SHA256): CCKeyDerivationPBKDF "
                             "failed: " +
                             std::to_string(err));
  }
  return ret;
}

auto
PBKDF2_HMAC_SHA512(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
  auto err = CCKeyDerivationPBKDF(kCCPBKDF2,
                                  pass.data(),
                                  pass.size(),
                                  reinterpret_cast<const std::uint8_t*>(salt.data()),
                                  salt.size(),
                                  kCCPRFHmacAlgSHA512,
                                  iterationCount,
                                  reinterpret_cast<std::uint8_t*>(ret.data()),
                                  ret.size());
  if (err != 0) {
    throw std::runtime_error("couchbase::core::crypto::PBKDF2_HMAC(SHA512): CCKeyDerivationPBKDF "
                             "failed: " +
                             std::to_string(err));
  }
  return ret;
}

auto
digest_sha1(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);
  CC_SHA1(
    data.data(), static_cast<CC_LONG>(data.size()), reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
digest_sha256(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
  CC_SHA256(
    data.data(), static_cast<CC_LONG>(data.size()), reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
digest_sha512(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
  CC_SHA512(
    data.data(), static_cast<CC_LONG>(data.size()), reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

/**
 * Validate that the input parameters for the encryption cipher specified
 * is supported and contains the right buffers.
 *
 * Currently only AES_256_cbc is supported
 */
void
validateEncryptionCipher(const couchbase::core::crypto::Cipher cipher,
                         std::string_view key,
                         std::string_view iv)
{
  switch (cipher) {
    case couchbase::core::crypto::Cipher::AES_256_cbc:
      if (key.size() != kCCKeySizeAES256) {
        throw std::invalid_argument(
          "couchbase::core::crypto::validateEncryptionCipher: Cipher requires a "
          "key "
          "length of " +
          std::to_string(kCCKeySizeAES256) + " provided key with length " +
          std::to_string(key.size()));
      }

      if (iv.size() != 16) {
        throw std::invalid_argument(
          "couchbase::core::crypto::validateEncryptionCipher: Cipher requires a "
          "iv "
          "length of 16 provided iv with length " +
          std::to_string(iv.size()));
      }
      return;
  }

  throw std::invalid_argument("couchbase::core::crypto::validateEncryptionCipher: Unknown Cipher " +
                              std::to_string(static_cast<int>(cipher)));
}

auto
encrypt(const couchbase::core::crypto::Cipher cipher,
        std::string_view key,
        std::string_view iv,
        std::string_view data) -> std::string
{
  std::size_t outputsize = 0;
  std::string ret;
  ret.resize(data.size() + kCCBlockSizeAES128);

  validateEncryptionCipher(cipher, key, iv);

  auto status = CCCrypt(kCCEncrypt,
                        kCCAlgorithmAES128,
                        kCCOptionPKCS7Padding,
                        key.data(),
                        kCCKeySizeAES256,
                        iv.data(),
                        data.data(),
                        data.size(),
                        reinterpret_cast<std::uint8_t*>(ret.data()),
                        ret.size(),
                        &outputsize);

  if (status != kCCSuccess) {
    throw std::runtime_error("couchbase::core::crypto::encrypt: CCCrypt failed: " +
                             std::to_string(status));
  }

  ret.resize(outputsize);
  return ret;
}

auto
decrypt(const couchbase::core::crypto::Cipher cipher,
        std::string_view key,
        std::string_view iv,
        std::string_view data) -> std::string
{
  std::size_t outputsize = 0;
  std::string ret;
  ret.resize(data.size());

  validateEncryptionCipher(cipher, key, iv);

  auto status = CCCrypt(kCCDecrypt,
                        kCCAlgorithmAES128,
                        kCCOptionPKCS7Padding,
                        key.data(),
                        kCCKeySizeAES256,
                        iv.data(),
                        data.data(),
                        data.size(),
                        reinterpret_cast<std::uint8_t*>(ret.data()),
                        ret.size(),
                        &outputsize);

  if (status != kCCSuccess) {
    throw std::runtime_error("couchbase::core::crypto::decrypt: CCCrypt failed: " +
                             std::to_string(status));
  }

  ret.resize(outputsize);
  return ret;
}

#else

#include "include_ssl/evp.h"
#include "include_ssl/hmac.h"
#include "include_ssl/md5.h"
#include "include_ssl/sha.h"

// OpenSSL

auto
HMAC_SHA1(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);

#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto key_size = key.size();
#else
  auto key_size = static_cast<int>(key.size());
#endif

  if (HMAC(EVP_sha1(),
           key.data(),
           key_size,
           reinterpret_cast<const std::uint8_t*>(data.data()),
           data.size(),
           reinterpret_cast<std::uint8_t*>(ret.data()),
           nullptr) == nullptr) {
    throw std::runtime_error("couchbase::core::crypto::HMAC(SHA1): HMAC failed");
  }
  return ret;
}

auto
HMAC_SHA256(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto key_size = key.size();
#else
  auto key_size = static_cast<int>(key.size());
#endif
  if (HMAC(EVP_sha256(),
           key.data(),
           key_size,
           reinterpret_cast<const std::uint8_t*>(data.data()),
           data.size(),
           reinterpret_cast<std::uint8_t*>(ret.data()),
           nullptr) == nullptr) {
    throw std::runtime_error("couchbase::core::crypto::HMAC(SHA256): HMAC failed");
  }
  return ret;
}

auto
HMAC_SHA512(std::string_view key, std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto key_size = key.size();
#else
  auto key_size = static_cast<int>(key.size());
#endif
  if (HMAC(EVP_sha512(),
           key.data(),
           key_size,
           reinterpret_cast<const std::uint8_t*>(data.data()),
           data.size(),
           reinterpret_cast<std::uint8_t*>(ret.data()),
           nullptr) == nullptr) {
    throw std::runtime_error("couchbase::core::crypto::HMAC(SHA512): HMAC failed");
  }
  return ret;
}

auto
PBKDF2_HMAC_SHA1(const std::string& pass,
                 std::string_view salt,
                 unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto pw_size = pass.size();
  auto salt_size = salt.size();
  auto iteration_count = iterationCount;
#else
  auto pw_size = static_cast<int>(pass.size());
  auto salt_size = static_cast<int>(salt.size());
  auto iteration_count = static_cast<int>(iterationCount);
#endif
  auto err = PKCS5_PBKDF2_HMAC(pass.data(),
                               pw_size,
                               reinterpret_cast<const std::uint8_t*>(salt.data()),
                               salt_size,
                               iteration_count,
                               EVP_sha1(),
                               couchbase::core::crypto::SHA1_DIGEST_SIZE,
                               reinterpret_cast<std::uint8_t*>(ret.data()));

  if (err != 1) {
    throw std::runtime_error("couchbase::core::crypto::PBKDF2_HMAC(SHA1): PKCS5_PBKDF2_HMAC_SHA1 "
                             "failed: " +
                             std::to_string(err));
  }

  return ret;
}

auto
PBKDF2_HMAC_SHA256(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto pw_size = pass.size();
  auto salt_size = salt.size();
  auto iteration_count = iterationCount;
#else
  auto pw_size = static_cast<int>(pass.size());
  auto salt_size = static_cast<int>(salt.size());
  auto iteration_count = static_cast<int>(iterationCount);
#endif
  auto err = PKCS5_PBKDF2_HMAC(pass.data(),
                               pw_size,
                               reinterpret_cast<const std::uint8_t*>(salt.data()),
                               salt_size,
                               iteration_count,
                               EVP_sha256(),
                               couchbase::core::crypto::SHA256_DIGEST_SIZE,
                               reinterpret_cast<std::uint8_t*>(ret.data()));
  if (err != 1) {
    throw std::runtime_error(
      "couchbase::core::crypto::PBKDF2_HMAC(SHA256): PKCS5_PBKDF2_HMAC failed" +
      std::to_string(err));
  }

  return ret;
}

auto
PBKDF2_HMAC_SHA512(const std::string& pass,
                   std::string_view salt,
                   unsigned int iterationCount) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto pw_size = pass.size();
  auto salt_size = salt.size();
  auto iteration_count = iterationCount;
#else
  auto pw_size = static_cast<int>(pass.size());
  auto salt_size = static_cast<int>(salt.size());
  auto iteration_count = static_cast<int>(iterationCount);
#endif
  auto err = PKCS5_PBKDF2_HMAC(pass.data(),
                               pw_size,
                               reinterpret_cast<const std::uint8_t*>(salt.data()),
                               salt_size,
                               iteration_count,
                               EVP_sha512(),
                               couchbase::core::crypto::SHA512_DIGEST_SIZE,
                               reinterpret_cast<std::uint8_t*>(ret.data()));
  if (err != 1) {
    throw std::runtime_error(
      "couchbase::core::crypto::PBKDF2_HMAC(SHA512): PKCS5_PBKDF2_HMAC failed" +
      std::to_string(err));
  }

  return ret;
}

auto
digest_sha1(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA1_DIGEST_SIZE);
  SHA1(reinterpret_cast<const std::uint8_t*>(data.data()),
       data.size(),
       reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
digest_sha256(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA256_DIGEST_SIZE);
  SHA256(reinterpret_cast<const std::uint8_t*>(data.data()),
         data.size(),
         reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

auto
digest_sha512(std::string_view data) -> std::string
{
  std::string ret;
  ret.resize(couchbase::core::crypto::SHA512_DIGEST_SIZE);
  SHA512(reinterpret_cast<const std::uint8_t*>(data.data()),
         data.size(),
         reinterpret_cast<std::uint8_t*>(ret.data()));
  return ret;
}

struct EVP_CIPHER_CTX_Deleter {
  void operator()(EVP_CIPHER_CTX* ctx)
  {
    if (ctx != nullptr) {
      EVP_CIPHER_CTX_free(ctx);
    }
  }
};

using unique_EVP_CIPHER_CTX_ptr = std::unique_ptr<EVP_CIPHER_CTX, EVP_CIPHER_CTX_Deleter>;

/**
 * Get the OpenSSL Cipher to use for the encryption, and validate
 * the input key and iv sizes
 */

auto
getCipher(const couchbase::core::crypto::Cipher cipher,
          std::string_view key,
          std::string_view iv) -> const EVP_CIPHER*
{
  const EVP_CIPHER* cip = nullptr;

  switch (cipher) {
    case couchbase::core::crypto::Cipher::AES_256_cbc:
      cip = EVP_aes_256_cbc();
      break;
  }

  if (cip == nullptr) {
    throw std::invalid_argument("couchbase::core::crypto::getCipher: Unknown Cipher " +
                                std::to_string(static_cast<int>(cipher)));
  }
#ifdef COUCHBASE_CXX_CLIENT_STATIC_BORINGSSL
  auto key_size = key.size();
  auto iv_size = iv.size();
#else
  // NOTE that OpenSSL 3 changed EVP_CIPHER_key_length() -> EVP_CIPHER_get_key_length()
  auto key_size = static_cast<int>(key.size());
  auto iv_size = static_cast<int>(iv.size());
#endif
  if (key_size != EVP_CIPHER_key_length(cip)) {
    throw std::invalid_argument("couchbase::core::crypto::getCipher: Cipher requires a key "
                                "length of " +
                                std::to_string(EVP_CIPHER_key_length(cip)) +
                                " provided key with length " + std::to_string(key.size()));
  }

  if (iv_size != EVP_CIPHER_iv_length(cip)) {
    throw std::invalid_argument("couchbase::core::crypto::getCipher: Cipher requires a iv "
                                "length of " +
                                std::to_string(EVP_CIPHER_iv_length(cip)) +
                                " provided iv with length " + std::to_string(iv.size()));
  }

  return cip;
}

auto
encrypt(const couchbase::core::crypto::Cipher cipher,
        std::string_view key,
        std::string_view iv,
        std::string_view data) -> std::string
{
  const unique_EVP_CIPHER_CTX_ptr ctx(EVP_CIPHER_CTX_new());

  const auto* cip = getCipher(cipher, key, iv);
  if (EVP_EncryptInit_ex(ctx.get(),
                         cip,
                         nullptr,
                         reinterpret_cast<const std::uint8_t*>(key.data()),
                         reinterpret_cast<const std::uint8_t*>(iv.data())) != 1) {
    throw std::runtime_error("couchbase::core::crypto::encrypt: EVP_EncryptInit_ex failed");
  }

  std::string ret;
  ret.resize(data.size() + static_cast<std::string_view::size_type>(EVP_CIPHER_block_size(cip)));
  auto len1 = static_cast<int>(ret.size());

  if (EVP_EncryptUpdate(ctx.get(),
                        reinterpret_cast<std::uint8_t*>(ret.data()),
                        &len1,
                        reinterpret_cast<const std::uint8_t*>(data.data()),
                        static_cast<int>(data.size())) != 1) {
    throw std::runtime_error("couchbase::core::crypto::encrypt: EVP_EncryptUpdate failed");
  }

  int len2 = static_cast<int>(ret.size()) - len1;
  if (EVP_EncryptFinal_ex(ctx.get(), reinterpret_cast<std::uint8_t*>(ret.data()) + len1, &len2) !=
      1) {
    throw std::runtime_error("couchbase::core::crypto::encrypt: EVP_EncryptFinal_ex failed");
  }

  // Resize the destination to the sum of the two length fields
  ret.resize(static_cast<std::size_t>(len1) + static_cast<std::size_t>(len2));
  return ret;
}

auto
decrypt(const couchbase::core::crypto::Cipher cipher,
        std::string_view key,
        std::string_view iv,
        std::string_view data) -> std::string
{
  const unique_EVP_CIPHER_CTX_ptr ctx(EVP_CIPHER_CTX_new());
  const auto* cip = getCipher(cipher, key, iv);

  if (EVP_DecryptInit_ex(ctx.get(),
                         cip,
                         nullptr,
                         reinterpret_cast<const std::uint8_t*>(key.data()),
                         reinterpret_cast<const std::uint8_t*>(iv.data())) != 1) {
    throw std::runtime_error("couchbase::core::crypto::decrypt: EVP_DecryptInit_ex failed");
  }

  std::string ret;
  ret.resize(data.size());
  int len1 = static_cast<int>(ret.size());

  if (EVP_DecryptUpdate(ctx.get(),
                        reinterpret_cast<std::uint8_t*>(ret.data()),
                        &len1,
                        reinterpret_cast<const std::uint8_t*>(data.data()),
                        static_cast<int>(data.size())) != 1) {
    throw std::runtime_error("couchbase::core::crypto::decrypt: EVP_DecryptUpdate failed");
  }

  int len2 = static_cast<int>(data.size()) - len1;
  if (EVP_DecryptFinal_ex(ctx.get(), reinterpret_cast<std::uint8_t*>(ret.data()) + len1, &len2) !=
      1) {
    throw std::runtime_error("couchbase::core::crypto::decrypt: EVP_DecryptFinal_ex failed");
  }

  // Resize the destination to the sum of the two length fields
  ret.resize(static_cast<std::size_t>(len1) + static_cast<std::size_t>(len2));
  return ret;
}

#endif

inline void
verifyLegalAlgorithm(const couchbase::core::crypto::Algorithm al)
{
  switch (al) {
    case couchbase::core::crypto::Algorithm::ALG_SHA1:
    case couchbase::core::crypto::Algorithm::ALG_SHA256:
    case couchbase::core::crypto::Algorithm::ALG_SHA512:
      return;
  }
  throw std::invalid_argument("verifyLegalAlgorithm: Unknown Algorithm: " +
                              std::to_string(static_cast<int>(al)));
}
} // namespace internal

namespace couchbase::core::crypto
{
auto
CBC_HMAC(const Algorithm algorithm, std::string_view key, std::string_view data) -> std::string
{
  switch (algorithm) {
    case couchbase::core::crypto::Algorithm::ALG_SHA1:
      return internal::HMAC_SHA1(key, data);
    case Algorithm::ALG_SHA256:
      return internal::HMAC_SHA256(key, data);
    case Algorithm::ALG_SHA512:
      return internal::HMAC_SHA512(key, data);
  }

  throw std::invalid_argument("couchbase::core::crypto::HMAC: Unknown Algorithm: " +
                              std::to_string(static_cast<int>(algorithm)));
}

auto
PBKDF2_HMAC(const Algorithm algorithm,
            const std::string& pass,
            std::string_view salt,
            unsigned int iterationCount) -> std::string
{
  switch (algorithm) {
    case Algorithm::ALG_SHA1:
      return internal::PBKDF2_HMAC_SHA1(pass, salt, iterationCount);
    case Algorithm::ALG_SHA256:
      return internal::PBKDF2_HMAC_SHA256(pass, salt, iterationCount);
    case Algorithm::ALG_SHA512:
      return internal::PBKDF2_HMAC_SHA512(pass, salt, iterationCount);
  }

  throw std::invalid_argument("couchbase::core::crypto::PBKDF2_HMAC: Unknown Algorithm: " +
                              std::to_string(static_cast<int>(algorithm)));
}

auto
isSupported(const Algorithm algorithm) -> bool
{
  internal::verifyLegalAlgorithm(algorithm);

  return true;
}

auto
digest(const Algorithm algorithm, std::string_view data) -> std::string
{
  switch (algorithm) {
    case Algorithm::ALG_SHA1:
      return internal::digest_sha1(data);
    case Algorithm::ALG_SHA256:
      return internal::digest_sha256(data);
    case Algorithm::ALG_SHA512:
      return internal::digest_sha512(data);
  }

  throw std::invalid_argument("couchbase::core::crypto::digest: Unknown Algorithm" +
                              std::to_string(static_cast<int>(algorithm)));
}

auto
encrypt(const Cipher cipher, std::string_view key, std::string_view iv, std::string_view data)
  -> std::string
{
  // We only support a single encryption scheme right now.
  // Verify the input parameters (no need of calling the internal library
  // functions in order to fetch these details)
  if (cipher != Cipher::AES_256_cbc) {
    throw std::invalid_argument("couchbase::core::crypto::encrypt(): Unsupported cipher");
  }

  if (key.size() != 32) {
    throw std::invalid_argument("couchbase::core::crypto::encrypt(): Invalid key size: " +
                                std::to_string(key.size()) + " (expected 32)");
  }

  if (iv.size() != 16) {
    throw std::invalid_argument("couchbase::core::crypto::encrypt(): Invalid iv size: " +
                                std::to_string(iv.size()) + " (expected 16)");
  }

  return internal::encrypt(cipher, key, iv, data);
}

auto
decrypt(const Cipher cipher, std::string_view key, std::string_view iv, std::string_view data)
  -> std::string
{
  // We only support a single decryption scheme right now.
  // Verify the input parameters (no need of calling the internal library
  // functions in order to fetch these details)
  if (cipher != Cipher::AES_256_cbc) {
    throw std::invalid_argument("couchbase::core::crypto::decrypt(): Unsupported cipher");
  }

  if (key.size() != 32) {
    throw std::invalid_argument("couchbase::core::crypto::decrypt(): Invalid key size: " +
                                std::to_string(key.size()) + " (expected 32)");
  }

  if (iv.size() != 16) {
    throw std::invalid_argument("couchbase::core::crypto::decrypt(): Invalid iv size: " +
                                std::to_string(iv.size()) + " (expected 16)");
  }

  return internal::decrypt(cipher, key, iv, data);
}

auto
to_cipher(const std::string& str) -> couchbase::core::crypto::Cipher
{
  if (str == "AES_256_cbc") {
    return Cipher::AES_256_cbc;
  }

  throw std::invalid_argument("to_cipher: Unknown cipher: " + str);
}
} // namespace couchbase::core::crypto
