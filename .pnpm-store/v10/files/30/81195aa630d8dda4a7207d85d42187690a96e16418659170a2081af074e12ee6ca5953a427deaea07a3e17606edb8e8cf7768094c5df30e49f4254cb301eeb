const fs = require('fs')
const path = require('path')
var proc = require('child_process')

// Workaround to fix webpack's build warnings: 'the request of a dependency is an expression'
const runtimeRequire =
  typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require

const supportedPlatforms = ['darwin', 'linux', 'linuxmusl', 'win32']
const supportedArches = ['x64', 'arm64']
const allowedRuntimes = ['napi', 'electron']

const runtime = isElectron() ? 'electron' : 'node'
const nodeVersion = getNodeVersion()
const nodeVersionMajor = getNodeMajorVersion(nodeVersion)
const arch = process.arch
const platform = process.platform
const libc = getLinuxType(platform)
const sslType = getSSLType(runtime, nodeVersion)

CN_ROOT = path.resolve(path.dirname(__filename), '..')
// CN_CXXCBC_CACHE_DIR should only need to be used on Windows when setting the CPM cache (CN_SET_CPM_CACHE=ON).
// It helps prevent issues w/ path lengths.
// NOTE: Setting the CPM cache on a Windows machine should be a _rare_ occasion.  When doing so and setting
// CN_CXXCBC_CACHE_DIR, be sure to copy the cache to <root source dir>\deps\couchbase-cxx-cache if building a sdist.
CXXCBC_CACHE_DIR =
  process.env.CN_CXXCBC_CACHE_DIR ||
  path.join(CN_ROOT, 'deps', 'couchbase-cxx-cache')
ENV_TRUE = ['true', '1', 'y', 'yes', 'on']

function buildBinary(
  runtime,
  runtimeVersion,
  useOpenSSL,
  useCmakeJsCompile,
  cmakeParallel
) {
  runtime = runtime || process.env.CN_PREBUILD_RUNTIME || 'node'
  runtimeVersion =
    runtimeVersion ||
    process.env.CN_PREBUILD_RUNTIME_VERSION ||
    process.version.replace('v', '')

  if (typeof useOpenSSL === 'undefined') {
    useOpenSSL = ENV_TRUE.includes(
      (process.env.CN_USE_OPENSSL || 'true').toLowerCase()
    )
  }

  // When executing via npm, it will prepend various paths to PATH in order to find executables.
  // This is problematic for a source install on Windows b/c the rc executable from the prebuild package
  // conflicts w/ the Windows Resource Compiler that is used for the BoringSSL build.  Setting
  // CN_REARRANGE_PATH=true simply appends all the npm paths to PATH instead of the default prepend.
  const rearrangePath = process.env.CN_REARRANGE_PATH || false
  if (
    rearrangePath &&
    !['null', 'false', 'undefined', '0', 'n', 'no', 'off'].includes(
      rearrangePath.toLowerCase()
    )
  ) {
    const currentPaths = process.env.PATH.split(path.delimiter)
    let newPaths = []
    const nodeModulesPaths = []
    currentPaths.forEach((p) => {
      if (p.includes('node_modules')) {
        nodeModulesPaths.push(p)
      } else {
        newPaths.push(p)
      }
    })
    newPaths.push(...nodeModulesPaths)
    process.env.PATH = newPaths.join(path.delimiter)
  }

  const cmakejs = path.join(
    require.resolve('cmake-js/package.json'),
    '..',
    require('cmake-js/package.json').bin['cmake-js']
  )

  const cmakejsBuildCmd = [
    cmakejs,
    useCmakeJsCompile ? 'compile' : 'build',
    '--runtime',
    runtime,
    '--runtime-version',
    runtimeVersion,
    '--parallel',
    cmakeParallel,
  ]

  const buildConfig = process.env.CN_BUILD_CONFIG
  if (
    buildConfig &&
    ['Debug', 'Release', 'RelWithDebInfo'].includes(buildConfig)
  ) {
    cmakejsBuildCmd.push(...['--config', `${buildConfig}`])
  }

  const cmakeGeneratorPlatform = process.env.CN_CMAKE_GENERATOR_PLATFORM
  if (cmakeGeneratorPlatform) {
    cmakejsBuildCmd.push(`--generator=${cmakeGeneratorPlatform}`)
  }

  if (!useOpenSSL) {
    cmakejsBuildCmd.push('--CDUSE_STATIC_OPENSSL=OFF')
  }

  if (
    ENV_TRUE.includes((process.env.CN_USE_CPM_CACHE || 'true').toLowerCase())
  ) {
    if (!fs.existsSync(CXXCBC_CACHE_DIR)) {
      throw new Error(
        `Cannot use cached dependencies, path=${CXXCBC_CACHE_DIR} does not exist.`
      )
    }
    cmakejsBuildCmd.push(
      ...[
        '--CDCPM_DOWNLOAD_ALL=OFF',
        '--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON',
        '--CDCPM_USE_LOCAL_PACKAGES=OFF',
        `--CDCPM_SOURCE_CACHE=${CXXCBC_CACHE_DIR}`,
        `--CDCOUCHBASE_CXX_CLIENT_EMBED_MOZILLA_CA_BUNDLE_ROOT=${CXXCBC_CACHE_DIR}`,
      ]
    )
  }

  if (
    ENV_TRUE.includes(
      (process.env.CN_VERBOSE_MAKEFILE || 'false').toLowerCase()
    )
  ) {
    cmakejsBuildCmd.push('--CDCMAKE_VERBOSE_MAKEFILE=ON')
  }

  const cmakeSystemVersion = process.env.CN_CMAKE_SYSTEM_VERSION
  if (cmakeSystemVersion) {
    cmakejsBuildCmd.push(`--CDCMAKE_SYSTEM_VERSION=${cmakeSystemVersion}`)
  }

  const cacheOption = process.env.CN_CACHE_OPTION
  if (cacheOption) {
    cmakejsBuildCmd.push(`--CDCACHE_OPTION=${cacheOption}`)
  }

  const cmakejsProc = proc.spawnSync(process.execPath, cmakejsBuildCmd, {
    stdio: 'inherit',
  })
  process.exit(cmakejsProc.status)
}

function configureBinary(
  runtime,
  runtimeVersion,
  useOpenSSL,
  setCpmCache,
  cmakeParallel
) {
  runtime = runtime || process.env.CN_PREBUILD_RUNTIME || 'node'
  runtimeVersion =
    runtimeVersion ||
    process.env.CN_PREBUILD_RUNTIME_VERSION ||
    process.version.replace('v', '')

  if (typeof useOpenSSL === 'undefined') {
    useOpenSSL = ENV_TRUE.includes(
      (process.env.CN_USE_OPENSSL || 'true').toLowerCase()
    )
  }

  if (typeof setCpmCache === 'undefined') {
    setCpmCache = ENV_TRUE.includes(
      (process.env.CN_SET_CPM_CACHE || 'false').toLowerCase()
    )
  }

  const cmakejs = path.join(
    require.resolve('cmake-js/package.json'),
    '..',
    require('cmake-js/package.json').bin['cmake-js']
  )

  const cmakejsBuildCmd = [
    cmakejs,
    'configure',
    '--runtime',
    runtime,
    '--runtime-version',
    runtimeVersion,
    '--parallel',
    cmakeParallel,
  ]

  if (setCpmCache) {
    if (fs.existsSync(CXXCBC_CACHE_DIR)) {
      fs.rmSync(`${CXXCBC_CACHE_DIR}`, { recursive: true })
    }
    cmakejsBuildCmd.push(
      ...[
        `--CDCOUCHBASE_CXX_CPM_CACHE_DIR=${CXXCBC_CACHE_DIR}`,
        '--CDCPM_DOWNLOAD_ALL=ON',
        '--CDCPM_USE_NAMED_CACHE_DIRECTORIES=ON',
        '--CDCPM_USE_LOCAL_PACKAGES=OFF',
      ]
    )
  }

  if (!useOpenSSL) {
    cmakejsBuildCmd.push('--CDUSE_STATIC_OPENSSL=OFF')
  }

  const cmakejsProc = proc.spawnSync(process.execPath, cmakejsBuildCmd, {
    stdio: 'inherit',
  })

  if (!cmakejsProc.status) {
    if (!useOpenSSL) {
      // BoringSSL path: 'couchbase-cxx-cache/boringssl/<SHA>/boringssl/crypto_test_data.cc'
      // This edit reduces the size of the tarball by 60%
      let boringDir = path.join(CXXCBC_CACHE_DIR, 'boringssl')
      if (fs.existsSync(boringDir)) {
        let files = fs.readdirSync(boringDir)
        if (
          files.length == 1 &&
          fs.statSync(path.join(boringDir, files[0])).isDirectory()
        ) {
          boringDir = path.join(boringDir, files[0], 'boringssl')
          files = fs.readdirSync(boringDir)
          const cryptoTestFile = files.find((f) => f == 'crypto_test_data.cc')
          if (cryptoTestFile) {
            fs.rmSync(path.join(boringDir, cryptoTestFile))
          }
        }
      }
    }

    // This edit allows us to not have a git dependency when building from source distribution.
    const cpmDir = path.join(CXXCBC_CACHE_DIR, 'cpm')
    if (fs.existsSync(cpmDir)) {
      let cpmFiles = fs.readdirSync(cpmDir)
      if (cpmFiles.length == 1 && cpmFiles[0].endsWith('.cmake')) {
        let cpmContent = fs.readFileSync(
          path.join(cpmDir, cpmFiles[0]),
          'utf-8'
        )
        cpmContent = cpmContent.replace(/Git REQUIRED/g, 'Git')
        fs.writeFileSync(path.join(cpmDir, cpmFiles[0]), cpmContent, 'utf-8')
      }
    }
  }
  process.exit(cmakejsProc.status)
}

function getLocalPrebuild(dir) {
  let COUCHBASE_LOCAL_PREBUILDS = [
    'build',
    path.join('build', 'Release'),
    path.join('build', 'RelWithDebInfo'),
    path.join('build', 'Debug'),
  ]
  let localPrebuild = undefined
  for (let i = 0; i < COUCHBASE_LOCAL_PREBUILDS.length; i++) {
    try {
      const localPrebuildDir = path.join(dir, COUCHBASE_LOCAL_PREBUILDS[i])
      const files = readdirSync(localPrebuildDir).filter(matchBuild)
      localPrebuild = files[0] && path.join(localPrebuildDir, files[0])
      if (localPrebuild) break
    } catch (_) {}
  }
  return localPrebuild
}

function getLinuxType(platform) {
  if (platform !== 'linux') {
    return ''
  }
  return `linux${isAlpine(platform) ? 'musl' : ''}`
}

function getNodeMajorVersion(version) {
  const tokens = version.split('.')
  return parseInt(tokens[0])
}

function getNodeVersion() {
  return process.version.replace('v', '')
}

function getPrebuildsInfo(dir) {
  dir = path.resolve(dir || '.')
  const info = {
    packageDir: path.join(dir, 'package.json'),
    platformPackageDir: undefined,
  }

  const packageName = JSON.parse(fs.readFileSync(info.packageDir)).name
  if (packageName !== undefined) {
    const _runtime = runtime === 'node' ? 'napi' : runtime
    const allowedPlatformPkg = `${packageName}-${
      platform === 'linux' ? libc : platform
    }-${arch}-${_runtime}`
    const fullPlatformPkgName = `@${packageName}/${allowedPlatformPkg}`
    const packageRequire = require('module').createRequire(
      path.join(dir, 'package.json')
    )
    info.packageDir = path.dirname(path.join(dir, 'package.json'))
    info.platformPackageDir = path.dirname(
      packageRequire.resolve(fullPlatformPkgName)
    )
  }
  return info
}

function getSSLType(runtime, version) {
  if (runtime === 'electron') {
    return 'boringssl'
  }
  if (getNodeMajorVersion(version) >= 18) {
    return 'openssl3'
  }
  return 'openssl1'
}

function getSupportedPlatformPackages(packageName) {
  packageName = packageName || 'couchbase'
  if (packageName !== 'couchbase') {
    throw new Error(
      'Cannot build supported platform packages for package other than couchbase.'
    )
  }

  const packageNames = []
  // format: couchbase-<platform>-<arch>-<runtime>
  supportedPlatforms.forEach((plat) => {
    supportedArches.forEach((arch) => {
      // we don't support Windows or linuxmusl ARM atm
      // UPDATE 07/2024: JSCBC-1268 adds linuxmusl + ARM support
      if (plat === 'win32' && arch === 'arm64') return
      allowedRuntimes.forEach((rt) => {
        packageNames.push(`${packageName}-${plat}-${arch}-${rt}`)
      })
    })
  })
  return packageNames
}

function isAlpine(platform) {
  return platform === 'linux' && fs.existsSync('/etc/alpine-release')
}

function isElectron() {
  if (process.versions && process.versions.electron) return true
  if (process.env.ELECTRON_RUN_AS_NODE) return true
  return (
    typeof window !== 'undefined' &&
    window.process &&
    window.process.type === 'renderer'
  )
}

function loadPrebuild(dir) {
  return runtimeRequire(resolvePrebuild(dir))
}

function matchBuild(name) {
  return /\.node$/.test(name)
}

function matchingPlatformPrebuild(filename, useElectronRuntime = false) {
  if (['index.js', 'package.json', 'README.md'].includes(filename)) {
    return false
  }

  let _runtime = ''
  if (useElectronRuntime) {
    _runtime = 'electron'
  } else if (runtime === 'node') {
    _runtime = 'napi'
  } else if (runtime === 'electron') {
    // NOTE: electron support is experimental
    _runtime = 'electron'
  } else {
    console.log(`Unsupported runtime: ${runtime}`)
    return false
  }
  const tokens = filename.split('-')
  // filename format:
  //   couchbase-v<pkg-version>-<runtime>-v<runtime-version>-<platform>-<arch>-<ssl-type>.node
  if (tokens.length < 7) return false
  const prebuildSSL = tokens[tokens.length - 1].replace('.node', '')
  if (_runtime === 'electron') {
    if (prebuildSSL !== 'boringssl') return false
  } else {
    let allowedSSLTypes = ['boringssl']
    if (nodeVersionMajor >= 18) {
      allowedSSLTypes.push('openssl3')
    } else {
      allowedSSLTypes.push('openssl1')
    }
    if (!allowedSSLTypes.includes(prebuildSSL)) return false
  }
  if (tokens[tokens.length - 2] !== arch) return false
  const platCompare = platform === 'linux' ? libc : platform
  if (tokens[tokens.length - 3] !== platCompare) return false
  if (!matchBuild(filename)) return false
  // yay -- found a match!
  return true
}

function readdirSync(dir) {
  try {
    return fs.readdirSync(dir)
  } catch (err) {
    return []
  }
}

async function resolveLocalPrebuild(src, dest) {
  if (fs.existsSync(src)) {
    const prebuilds = readdirSync(src).filter(matchBuild)
    if (prebuilds && prebuilds.length >= 1) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      try {
        fs.copyFileSync(
          path.join(src, prebuilds[0]),
          path.join(dest, prebuilds[0])
        )
      } catch (_) {}
    }
  }
}

function resolvePrebuild(
  dir,
  { runtimeResolve = true, useElectronRuntime = false } = {}
) {
  dir = path.resolve(dir || '.')
  let _runtime = ''
  if (useElectronRuntime) {
    _runtime = 'electron'
  } else if (runtime === 'node') {
    _runtime = 'napi'
  } else if (runtime === 'electron') {
    // NOTE: electron support is experimental
    _runtime = 'electron'
  } else {
    throw new Error(`Unsupported runtime: ${runtime}`)
  }
  try {
    const localPrebuild = getLocalPrebuild(dir)
    if (localPrebuild) {
      return localPrebuild
    }

    const packageName = runtimeResolve
      ? runtimeRequire(path.join(dir, 'package.json')).name
      : JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).name

    if (packageName !== undefined) {
      const supportedPackages = getSupportedPlatformPackages(packageName)
      const platformPkg = `${packageName}-${
        platform === 'linux' ? libc : platform
      }-${arch}-${_runtime}`
      if (supportedPackages.includes(platformPkg)) {
        const fullPlatformPkgName = `@${packageName}/${platformPkg}`
        const packageRequire = require('module').createRequire(
          path.join(dir, 'package.json')
        )
        const platformPackagesDir = path.dirname(
          packageRequire.resolve(fullPlatformPkgName)
        )
        if (platformPackagesDir !== undefined) {
          const platformPrebuild = readdirSync(platformPackagesDir).filter(
            (file) => {
              return matchingPlatformPrebuild(file, useElectronRuntime)
            }
          )
          if (platformPrebuild && platformPrebuild.length == 1) {
            return path.join(platformPackagesDir, platformPrebuild[0])
          }
        }
      }
    }
  } catch (_) {}

  let target = [
    `platform=${platform}`,
    `arch=${arch}`,
    `runtime=${_runtime}`,
    `nodeVersion=${nodeVersion}`,
    `sslType=${sslType}`,
  ]
  if (libc) {
    target.push(`libc=${libc}`)
  }
  if (typeof __webpack_require__ === 'function') {
    target.push('webpack=true')
  }
  throw new Error(
    `Could not find native build for ${target.join(', ')} loaded from ${dir}.`
  )
}

module.exports = {
  ENV_TRUE,
  buildBinary,
  configureBinary,
  getPrebuildsInfo,
  loadPrebuild,
  resolveLocalPrebuild,
  resolvePrebuild,
}
