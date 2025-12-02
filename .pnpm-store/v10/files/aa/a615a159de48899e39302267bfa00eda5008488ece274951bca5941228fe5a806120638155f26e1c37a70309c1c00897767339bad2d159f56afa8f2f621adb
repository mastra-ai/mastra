/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc
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

#include "random.h"

#include <cerrno>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <mutex>
#include <system_error>

#ifdef WIN32
// We need to include windows.h _before_ wincrypt.h
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <wincrypt.h>
#else
#include <fcntl.h>
#include <unistd.h>
#endif

namespace couchbase::core
{
class RandomGeneratorProvider
{
public:
  RandomGeneratorProvider()
  {
#ifdef WIN32
    if (!CryptAcquireContext(
          &handle, NULL, NULL, PROV_RSA_FULL, CRYPT_VERIFYCONTEXT | CRYPT_SILENT)) {
      throw std::system_error(int(GetLastError()),
                              std::system_category(),
                              "RandomGeneratorProvider::Failed to "
                              "initialize random generator");
    }
#else
    if (handle = open("/dev/urandom", O_RDONLY | O_CLOEXEC); handle == -1) {
      throw std::system_error(errno,
                              std::system_category(),
                              "RandomGeneratorProvider::Failed to "
                              "initialize random generator");
    }
#endif
  }
  RandomGeneratorProvider(const RandomGeneratorProvider&) = delete;
  auto operator=(const RandomGeneratorProvider&) -> RandomGeneratorProvider& = delete;
  RandomGeneratorProvider(RandomGeneratorProvider&&) = delete;
  auto operator=(RandomGeneratorProvider&&) -> RandomGeneratorProvider& = delete;

  virtual ~RandomGeneratorProvider()
  {
#ifdef WIN32
    CryptReleaseContext(handle, 0);
#else
    close(handle);
#endif
  }

  auto getBytes(void* dest, std::size_t size) -> bool
  {
    const std::lock_guard<std::mutex> lock(mutex);
#ifdef WIN32
    return CryptGenRandom(handle, (DWORD)size, static_cast<BYTE*>(dest));
#else
#if defined(__clang__) && defined(__clang_analyzer__)
    [[clang::suppress]]
#endif
      // TODO(CXXCBC-549)
      // NOLINTNEXTLINE(clang-analyzer-unix.BlockInCriticalSection)
      return static_cast<std::size_t>(read(handle, dest, size)) == size;
#endif
  }

private:
#ifdef WIN32
  HCRYPTPROV handle{};
#else
  int handle = -1;
#endif
  std::mutex mutex;
};

std::mutex shared_provider_lock;
std::unique_ptr<RandomGeneratorProvider> shared_provider;

RandomGenerator::RandomGenerator()
{
  if (!shared_provider) {
    // This might be the first one, lets lock and create
    const std::lock_guard<std::mutex> guard(shared_provider_lock);
    if (!shared_provider) { // cppcheck-suppress identicalInnerCondition; DCLP
      shared_provider = std::make_unique<RandomGeneratorProvider>();
    }
  }
}

auto
RandomGenerator::next() -> std::uint64_t
{
  std::uint64_t ret = 0;
  if (getBytes(&ret, sizeof(ret))) {
    return ret;
  }

  return static_cast<std::uint64_t>(std::chrono::steady_clock::now().time_since_epoch().count());
}

auto
RandomGenerator::getBytes(void* dest, std::size_t size) -> bool
{
  return shared_provider->getBytes(dest, size);
}

} // namespace couchbase::core
