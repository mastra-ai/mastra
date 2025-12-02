'use strict'
const CMake = require('./cMake')
const Dist = require('./dist')
const CMLog = require('./cmLog')
const appCMakeJSConfig = require('./appCMakeJSConfig')
const npmConfig = require('./npmConfig')
const path = require('path')
const Toolset = require('./toolset')

function isNodeApi(log, projectRoot) {
	try {
		const projectPkgJson = require(path.join(projectRoot, 'package.json'))
		// Make sure the property exists
		return !!projectPkgJson?.binary?.napi_versions
	} catch (e) {
		log.silly('CFG', "'package.json' not found.")
		return false
	}
}

class BuildSystem {
	constructor(options) {
		this.options = options || {}
		this.options.directory = path.resolve(this.options.directory || process.cwd())
		this.options.out = path.resolve(this.options.out || path.join(this.options.directory, 'build'))
		this.log = new CMLog(this.options)
		this.options.isNodeApi = isNodeApi(this.log, this.options.directory)
		const appConfig = appCMakeJSConfig(this.options.directory, this.log)
		const npmOptions = npmConfig(this.log)

		if (npmOptions && typeof npmOptions === 'object' && Object.keys(npmOptions).length) {
			this.options.runtimeDirectory = npmOptions['nodedir']
			this.options.msvsVersion = npmOptions['msvs_version']
		}
		if (appConfig && typeof appConfig === 'object' && Object.keys(appConfig).length) {
			this.log.verbose('CFG', 'Applying CMake.js config from root package.json:')
			this.log.verbose('CFG', JSON.stringify(appConfig))
			// Applying applications's config, if there is no explicit runtime related options specified
			this.options.runtime = this.options.runtime || appConfig.runtime
			this.options.runtimeVersion = this.options.runtimeVersion || appConfig.runtimeVersion
			this.options.arch = this.options.arch || appConfig.arch
		}

		this.log.verbose('CFG', 'Build system options:')
		this.log.verbose('CFG', JSON.stringify(this.options))
		this.cmake = new CMake(this.options)
		this.dist = new Dist(this.options)
		this.toolset = new Toolset(this.options)
	}
	async _ensureInstalled() {
		try {
			await this.toolset.initialize(true)
			if (!this.options.isNodeApi) {
				await this.dist.ensureDownloaded()
			}
		} catch (e) {
			this._showError(e)
			throw e
		}
	}
	_showError(e) {
		if (this.log === undefined) {
			// handle internal errors (init failed)
			console.error('OMG', e.stack)
			return
		}
		if (this.log.level === 'verbose' || this.log.level === 'silly') {
			this.log.error('OMG', e.stack)
		} else {
			this.log.error('OMG', e.message)
		}
	}
	install() {
		return this._ensureInstalled()
	}
	async _invokeCMake(method) {
		try {
			await this._ensureInstalled()
			return await this.cmake[method]()
		} catch (e) {
			this._showError(e)
			throw e
		}
	}
	getConfigureCommand() {
		return this._invokeCMake('getConfigureCommand')
	}
	getCmakeJsLibString() {
		return this._invokeCMake('getCmakeJsLibString')
	}
	getCmakeJsIncludeString() {
		return this._invokeCMake('getCmakeJsIncludeString')
	}
	getCmakeJsSrcString() {
		return this._invokeCMake('getCmakeJsSrcString')
	}
	configure() {
		return this._invokeCMake('configure')
	}
	getBuildCommand() {
		return this._invokeCMake('getBuildCommand')
	}
	build() {
		return this._invokeCMake('build')
	}
	getCleanCommand() {
		return this._invokeCMake('getCleanCommand')
	}
	clean() {
		return this._invokeCMake('clean')
	}
	reconfigure() {
		return this._invokeCMake('reconfigure')
	}
	rebuild() {
		return this._invokeCMake('rebuild')
	}
	compile() {
		return this._invokeCMake('compile')
	}
}

module.exports = BuildSystem
