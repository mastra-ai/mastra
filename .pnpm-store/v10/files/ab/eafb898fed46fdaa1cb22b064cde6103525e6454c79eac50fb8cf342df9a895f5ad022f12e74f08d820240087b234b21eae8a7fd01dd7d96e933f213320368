'use strict'
const crypto = require('crypto')
const axios = require('axios')
const MemoryStream = require('memory-stream')
const zlib = require('zlib')
const tar = require('tar')
const fs = require('fs')
const CMLog = require('./cmLog')

class Downloader {
	constructor(options) {
		this.options = options || {}
		this.log = new CMLog(this.options)
	}
	downloadToStream(url, stream, hash) {
		const self = this
		const shasum = hash ? crypto.createHash(hash) : null
		return new Promise(function (resolve, reject) {
			let length = 0
			let done = 0
			let lastPercent = 0
			axios
				.get(url, { responseType: 'stream' })
				.then(function (response) {
					length = parseInt(response.headers['content-length'])
					if (typeof length !== 'number') {
						length = 0
					}

					response.data.on('data', function (chunk) {
						if (shasum) {
							shasum.update(chunk)
						}
						if (length) {
							done += chunk.length
							let percent = (done / length) * 100
							percent = Math.round(percent / 10) * 10 + 10
							if (percent > lastPercent) {
								self.log.verbose('DWNL', '\t' + lastPercent + '%')
								lastPercent = percent
							}
						}
					})

					response.data.pipe(stream)
				})
				.catch(function (err) {
					reject(err)
				})

			stream.once('error', function (err) {
				reject(err)
			})

			stream.once('finish', function () {
				resolve(shasum ? shasum.digest('hex') : undefined)
			})
		})
	}
	async downloadString(url) {
		const result = new MemoryStream()
		await this.downloadToStream(url, result)
		return result.toString()
	}
	async downloadFile(url, options) {
		if (typeof options === 'string') {
			options.path = options
		}
		const result = fs.createWriteStream(options.path)
		const sum = await this.downloadToStream(url, result, options.hash)
		this.testSum(url, sum, options)
		return sum
	}
	async downloadTgz(url, options) {
		if (typeof options === 'string') {
			options.cwd = options
		}
		const gunzip = zlib.createGunzip()
		const extractor = tar.extract(options)
		gunzip.pipe(extractor)
		const sum = await this.downloadToStream(url, gunzip, options.hash)
		this.testSum(url, sum, options)
		return sum
	}
	testSum(url, sum, options) {
		if (options.hash && sum && options.sum && options.sum !== sum) {
			throw new Error(options.hash.toUpperCase() + " sum of download '" + url + "' mismatch!")
		}
	}
}

module.exports = Downloader
