'use strict'

const environment = require('./environment')

class TargetOptions {
	get arch() {
		return this.options.arch || environment.arch
	}
	get isX86() {
		return this.arch === 'ia32' || this.arch === 'x86'
	}
	get isX64() {
		return this.arch === 'x64'
	}
	get isArm() {
		return this.arch === 'arm'
	}
	get isArm64() {
		return this.arch === 'arm64'
	}
	get runtime() {
		return this.options.runtime || environment.runtime
	}
	get runtimeVersion() {
		return this.options.runtimeVersion || environment.runtimeVersion
	}

	constructor(options) {
		this.options = options || {}
	}
}

module.exports = TargetOptions
