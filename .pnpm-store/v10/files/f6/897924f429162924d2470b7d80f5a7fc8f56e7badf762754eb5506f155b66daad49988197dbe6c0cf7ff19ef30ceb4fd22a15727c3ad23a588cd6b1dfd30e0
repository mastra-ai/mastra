const prebuilds = require('./prebuilds')

function buildPrebuild(
  runtime,
  runtimeVersion,
  useOpenSSL,
  configure,
  setCpmCache,
  useCmakeJsCompile,
  cmakeParallel
) {
  runtime = runtime || process.env.CN_PREBUILD_RUNTIME || 'node'
  runtimeVersion =
    runtimeVersion ||
    process.env.CN_PREBUILD_RUNTIME_VERSION ||
    process.version.replace('v', '')

  if (typeof useOpenSSL === 'undefined') {
    useOpenSSL = prebuilds.ENV_TRUE.includes(
      (process.env.CN_USE_OPENSSL || 'true').toLowerCase()
    )
  }

  // we only want to configure if setting the CPM cache
  if (configure || setCpmCache) {
    prebuilds.configureBinary(
      runtime,
      runtimeVersion,
      useOpenSSL,
      setCpmCache,
      cmakeParallel
    )
  } else {
    prebuilds.buildBinary(
      runtime,
      runtimeVersion,
      useOpenSSL,
      useCmakeJsCompile,
      cmakeParallel
    )
  }
}

let configurePrebuild = false
let setCpmCache = false
let useCmakeJsCompile = true
let runtime, runtimeVersion, useOpenSSL
let cmakeParallel = 4
const args = process.argv.slice(2)
if (args.length > 0) {
  // --configure
  if (args.includes('--configure')) {
    configurePrebuild = true
  }

  // --set-cpm-cache
  if (args.includes('--set-cpm-cache')) {
    setCpmCache = true
  }

  // --runtime=[node|electron] OR --runtime [node|electron]
  const runtimeIdx = args.findIndex((a) => {
    return a.includes('runtime') && !a.includes('version')
  })
  if (runtimeIdx >= 0) {
    let rt = undefined
    if (args[runtimeIdx].includes('=')) {
      rt = args[runtimeIdx].split('=')[1]
    } else if (args.length - 1 >= runtimeIdx + 1) {
      rt = args[runtimeIdx + 1]
    }

    if (rt && ['node', 'electron'].includes(rt)) {
      runtime = rt
    }
  }

  // --runtime-version=<> OR --runtime-version <>
  const runtimeVersionIdx = args.findIndex((a) => a.includes('runtime-version'))
  if (runtimeVersionIdx >= 0) {
    let rtv = undefined
    if (args[runtimeVersionIdx].includes('=')) {
      rtv = args[runtimeVersionIdx].split('=')[1]
    } else if (args.length - 1 >= runtimeVersionIdx + 1) {
      rtv = args[runtimeVersionIdx + 1]
    }

    if (rtv) {
      const tokens = rtv.split('.')
      if (tokens.length == 3 && tokens.every((t) => !isNaN(parseInt(t)))) {
        runtimeVersion = rtv
      }
    }
  }

  // --use-boringssl or --use-openssl
  if (args.includes('--use-boringssl') && args.includes('--use-openssl')) {
    throw new Error('Cannot set both BoringSSL and OpenSSL to be used.')
  }

  if (args.includes('--use-boringssl')) {
    useOpenSSL = false
  }

  if (args.includes('--use-openssl')) {
    useOpenSSL = true
  }

  // --parallel=<> OR --parallel <>
  const parallelIdx = args.findIndex((a) => a.includes('parallel'))
  if (parallelIdx >= 0) {
    let pv = undefined
    if (args[parallelIdx].includes('=')) {
      pv = args[parallelIdx].split('=')[1]
    } else if (args.length - 1 >= parallelIdx + 1) {
      pv = args[parallelIdx + 1]
    }

    if (pv && !isNaN(parseInt(pv))) {
      const os = require('os')
      const pvi = parseInt(pv)
      if (pvi <= os.cpus().length) {
        cmakeParallel = pvi
      }
    }
  }

  if (args.includes('--use-cmakejs-build')) {
    useCmakeJsCompile = false
  }
}

buildPrebuild(
  runtime,
  runtimeVersion,
  useOpenSSL,
  configurePrebuild,
  setCpmCache,
  useCmakeJsCompile,
  cmakeParallel
)
