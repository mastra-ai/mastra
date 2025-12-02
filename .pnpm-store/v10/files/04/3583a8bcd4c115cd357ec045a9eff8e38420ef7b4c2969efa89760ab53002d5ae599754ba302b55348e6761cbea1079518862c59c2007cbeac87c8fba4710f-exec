const path = require('path')
const prebuilds = require('./prebuilds')

if (hasLocalPrebuild()) {
  const destination = path.join(
    path.resolve(__dirname, '..'),
    'build',
    'Release'
  )
  const source = getLocalPrebuild()
  // on either success or failure of resolving local prebuild we still confirm we have a prebuild
  prebuilds.resolveLocalPrebuild(source, destination).then(installPrebuild())
} else {
  installPrebuild()
}

function getLocalPrebuild() {
  const localPrebuildsName = `npm_config_couchbase_local_prebuilds`
  return process.env[localPrebuildsName]
}

function hasLocalPrebuild() {
  return typeof getLocalPrebuild() === 'string'
}

function installPrebuild() {
  try {
    prebuilds.resolvePrebuild(path.resolve(__dirname, '..'), {
      runtimeResolve: false,
    })
    process.exit(0)
  } catch (err) {
    prebuilds.buildBinary()
  }
}
