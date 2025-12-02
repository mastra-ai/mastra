'use strict'
const environment = require('./environment')
const path = require('path')
const urljoin = require('url-join')
const fs = require('fs-extra')
const CMLog = require('./cmLog')
const TargetOptions = require('./targetOptions')
const runtimePaths = require('./runtimePaths')
const Downloader = require('./downloader')
const os = require('os')

function testSum(sums, sum, fPath) {
	const serverSum = sums.find(function (s) {
		return s.getPath === fPath
	})
	if (serverSum && serverSum.sum === sum) {
		return
	}
	throw new Error("SHA sum of file '" + fPath + "' mismatch!")
}

class Dist {
	get internalPath() {
		const cacheDirectory = '.cmake-js'
		const runtimeArchDirectory = this.targetOptions.runtime + '-' + this.targetOptions.arch
		const runtimeVersionDirectory = 'v' + this.targetOptions.runtimeVersion

		return (
			this.options.runtimeDirectory ||
			path.join(os.homedir(), cacheDirectory, runtimeArchDirectory, runtimeVersionDirectory)
		)
	}
	get externalPath() {
		return runtimePaths.get(this.targetOptions).externalPath
	}
	get downloaded() {
		let headers = false
		let libs = true
		let stat = getStat(this.internalPath)
		if (stat.isDirectory()) {
			if (this.headerOnly) {
				stat = getStat(path.join(this.internalPath, 'include/node/node.h'))
				headers = stat.isFile()
			} else {
				stat = getStat(path.join(this.internalPath, 'src/node.h'))
				if (stat.isFile()) {
					stat = getStat(path.join(this.internalPath, 'deps/v8/include/v8.h'))
					headers = stat.isFile()
				}
			}
			if (environment.isWin) {
				for (const libPath of this.winLibs) {
					stat = getStat(libPath)
					libs = libs && stat.isFile()
				}
			}
		}
		return headers && libs

		function getStat(path) {
			try {
				return fs.statSync(path)
			} catch (e) {
				return {
					isFile: () => false,
					isDirectory: () => false,
				}
			}
		}
	}
	get winLibs() {
		const libs = runtimePaths.get(this.targetOptions).winLibs
		const result = []
		for (const lib of libs) {
			result.push(path.join(this.internalPath, lib.dir, lib.name))
		}
		return result
	}
	get headerOnly() {
		return runtimePaths.get(this.targetOptions).headerOnly
	}

	constructor(options) {
		this.options = options || {}
		this.log = new CMLog(this.options)
		this.targetOptions = new TargetOptions(this.options)
		this.downloader = new Downloader(this.options)
	}

	async ensureDownloaded() {
		if (!this.downloaded) {
			await this.download()
		}
	}
	async download() {
		const log = this.log
		log.info('DIST', 'Downloading distribution files to: ' + this.internalPath)
		await fs.ensureDir(this.internalPath)
		const sums = await this._downloadShaSums()
		await Promise.all([this._downloadLibs(sums), this._downloadTar(sums)])
	}
	async _downloadShaSums() {
		if (this.targetOptions.runtime === 'node') {
			const sumUrl = urljoin(this.externalPath, 'SHASUMS256.txt')
			const log = this.log
			log.http('DIST', '\t- ' + sumUrl)
			return (await this.downloader.downloadString(sumUrl))
				.split('\n')
				.map(function (line) {
					const parts = line.split(/\s+/)
					return {
						getPath: parts[1],
						sum: parts[0],
					}
				})
				.filter(function (i) {
					return i.getPath && i.sum
				})
		} else {
			return null
		}
	}
	async _downloadTar(sums) {
		const log = this.log
		const self = this
		const tarLocalPath = runtimePaths.get(self.targetOptions).tarPath
		const tarUrl = urljoin(self.externalPath, tarLocalPath)
		log.http('DIST', '\t- ' + tarUrl)

		const sum = await this.downloader.downloadTgz(tarUrl, {
			hash: sums ? 'sha256' : null,
			cwd: self.internalPath,
			strip: 1,
			filter: function (entryPath) {
				if (entryPath === self.internalPath) {
					return true
				}
				const ext = path.extname(entryPath)
				return ext && ext.toLowerCase() === '.h'
			},
		})

		if (sums) {
			testSum(sums, sum, tarLocalPath)
		}
	}
	async _downloadLibs(sums) {
		const log = this.log
		const self = this
		if (!environment.isWin) {
			return
		}

		const paths = runtimePaths.get(self.targetOptions)
		for (const dirs of paths.winLibs) {
			const subDir = dirs.dir
			const fn = dirs.name
			const fPath = subDir ? urljoin(subDir, fn) : fn
			const libUrl = urljoin(self.externalPath, fPath)
			log.http('DIST', '\t- ' + libUrl)

			await fs.ensureDir(path.join(self.internalPath, subDir))

			const sum = await this.downloader.downloadFile(libUrl, {
				path: path.join(self.internalPath, fPath),
				hash: sums ? 'sha256' : null,
			})

			if (sums) {
				testSum(sums, sum, fPath)
			}
		}
	}
}

module.exports = Dist
