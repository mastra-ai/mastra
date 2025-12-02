const fs = require('fs')
const path = require('path')
const prebuilds = require('./prebuilds')

function getMismatchedPlatformPackagesInfo(
  platformPackagesDir,
  expectedPlatformPackage
) {
  let message = `Checking for platform packages in ${platformPackagesDir} `
  message += `that do not match the expected platform package (${expectedPlatformPackage}).`
  console.log(message)
  let mismatches = []
  try {
    const files = fs.readdirSync(platformPackagesDir)
    files.forEach((file) => {
      if (file === expectedPlatformPackage) {
        return
      }
      const stats = fs.statSync(path.join(platformPackagesDir, file))
      if (!stats.isDirectory()) {
        return
      }
      const filePath = path.join(platformPackagesDir, file)
      const size = getDirectorySize(filePath)
      console.log(`Found mismatch: Path=${filePath}`)
      const platformPackage = path.basename(filePath)
      mismatches.push({
        name: platformPackage,
        dir: filePath,
        size: size,
      })
    })
  } catch (err) {
    console.error(`Error trying to delete mismatched platform packages.`, err)
  }
  return mismatches
}

function getDirectorySize(dir) {
  let size = 0
  const dirContents = fs.readdirSync(dir)
  dirContents.forEach((content) => {
    const contentPath = path.join(dir, content)
    const stats = fs.statSync(contentPath)
    if (stats.isFile()) {
      size += stats.size
    } else if (stats.isDirectory()) {
      size += getDirectorySize(contentPath)
    }
  })

  return size
}

function getPrebuildsInfo() {
  try {
    const prebuildsInfo = prebuilds.getPrebuildsInfo()
    return prebuildsInfo
  } catch (err) {
    console.error('Error trying to obtain couchbase prebuilds info.', err)
    return undefined
  }
}

function pruneCouchbaseHelp() {
  const prebuildsInfo = getPrebuildsInfo()
  const platformPackagesDir = path.dirname(prebuildsInfo.platformPackageDir)
  const expectedPlatformPackage = path.basename(
    prebuildsInfo.platformPackageDir
  )

  const mismatchedPlatPkgs = getMismatchedPlatformPackagesInfo(
    platformPackagesDir,
    expectedPlatformPackage
  )
  const cbDeps = {
    dir: path.join(prebuildsInfo.packageDir, 'deps'),
    size: undefined,
  }
  const cbSrc = {
    dir: path.join(prebuildsInfo.packageDir, 'src'),
    size: undefined,
  }
  try {
    cbDeps.size = getDirectorySize(cbDeps.dir)
  } catch (_) {
    console.log('Couchbase deps/ not found.')
  }
  try {
    cbSrc.size = getDirectorySize(cbSrc.dir)
  } catch (_) {
    console.log('Couchbase src/ not found.')
  }

  console.log('\nRecommendations for pruning:\n')
  if (mismatchedPlatPkgs.length > 0) {
    for (const pkg of mismatchedPlatPkgs) {
      const sizeMb = pkg.size / 1024 / 1024
      console.log(
        `Removing mismatched platform=${pkg.name} (path=${
          pkg.dir
        }) saves ~${sizeMb.toFixed(2)} MB on disk.`
      )
    }
  }
  if (cbDeps.size) {
    const sizeMb = cbDeps.size / 1024 / 1024
    console.log(
      `Removing Couchbase deps/ (path=${cbDeps.dir}) saves ~${sizeMb.toFixed(
        2
      )} MB on disk.`
    )
  }
  if (cbSrc.size) {
    const sizeMb = cbSrc.size / 1024 / 1024
    console.log(
      `Removing Couchbase src/ (path=${cbSrc.dir}) saves ~${sizeMb.toFixed(
        2
      )} MB on disk.`
    )
  }
}

pruneCouchbaseHelp()
