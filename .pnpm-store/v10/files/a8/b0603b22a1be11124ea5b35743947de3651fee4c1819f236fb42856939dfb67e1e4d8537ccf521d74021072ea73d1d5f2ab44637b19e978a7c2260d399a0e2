'use strict'
const os = require('os')
const which = require('which')

const environment = (module.exports = {
	cmakeJsVersion: require('../package.json').version,
	platform: os.platform(),
	isWin: os.platform() === 'win32',
	isLinux: os.platform() === 'linux',
	isOSX: os.platform() === 'darwin',
	arch: os.arch(),
	isX86: os.arch() === 'ia32' || os.arch() === 'x86',
	isX64: os.arch() === 'x64',
	isArm: os.arch() === 'arm',
	isArm64: os.arch() === 'arm64',
	runtime: 'node',
	runtimeVersion: process.versions.node,
})

Object.defineProperties(environment, {
	_isNinjaAvailable: {
		value: null,
		writable: true,
	},
	isNinjaAvailable: {
		get: function () {
			if (this._isNinjaAvailable === null) {
				this._isNinjaAvailable = false
				try {
					if (which.sync('ninja')) {
						this._isNinjaAvailable = true
					}
				} catch (e) {
					// Ignore
				}
			}
			return this._isNinjaAvailable
		},
	},
	_isMakeAvailable: {
		value: null,
		writable: true,
	},
	isMakeAvailable: {
		get: function () {
			if (this._isMakeAvailable === null) {
				this._isMakeAvailable = false
				try {
					if (which.sync('make')) {
						this._isMakeAvailable = true
					}
				} catch (e) {
					// Ignore
				}
			}
			return this._isMakeAvailable
		},
	},
	_isGPPAvailable: {
		value: null,
		writable: true,
	},
	isGPPAvailable: {
		get: function () {
			if (this._isGPPAvailable === null) {
				this._isGPPAvailable = false
				try {
					if (which.sync('g++')) {
						this._isGPPAvailable = true
					}
				} catch (e) {
					// Ignore
				}
			}
			return this._isGPPAvailable
		},
	},
	_isClangAvailable: {
		value: null,
		writable: true,
	},
	isClangAvailable: {
		get: function () {
			if (this._isClangAvailable === null) {
				this._isClangAvailable = false
				try {
					if (which.sync('clang++')) {
						this._isClangAvailable = true
					}
				} catch (e) {
					// Ignore
				}
			}
			return this._isClangAvailable
		},
	},
})
