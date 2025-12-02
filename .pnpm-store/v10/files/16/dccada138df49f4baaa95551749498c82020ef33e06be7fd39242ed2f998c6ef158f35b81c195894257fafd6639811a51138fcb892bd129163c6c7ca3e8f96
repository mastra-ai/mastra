'use strict'
const assert = require('assert')
const semver = require('semver')

const NODE_MIRROR = process.env.NVM_NODEJS_ORG_MIRROR || 'https://nodejs.org/dist'
const ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://artifacts.electronjs.org/headers/dist'

const runtimePaths = {
	node: function (targetOptions) {
		if (semver.lt(targetOptions.runtimeVersion, '4.0.0')) {
			return {
				externalPath: NODE_MIRROR + '/v' + targetOptions.runtimeVersion + '/',
				winLibs: [
					{
						dir: targetOptions.isX64 ? 'x64' : '',
						name: targetOptions.runtime + '.lib',
					},
				],
				tarPath: targetOptions.runtime + '-v' + targetOptions.runtimeVersion + '.tar.gz',
				headerOnly: false,
			}
		} else {
			return {
				externalPath: NODE_MIRROR + '/v' + targetOptions.runtimeVersion + '/',
				winLibs: [
					{
						dir: targetOptions.isArm64 ? 'win-arm64' : targetOptions.isX64 ? 'win-x64' : 'win-x86',
						name: targetOptions.runtime + '.lib',
					},
				],
				tarPath: targetOptions.runtime + '-v' + targetOptions.runtimeVersion + '-headers.tar.gz',
				headerOnly: true,
			}
		}
	},
	nw: function (targetOptions) {
		if (semver.gte(targetOptions.runtimeVersion, '0.13.0')) {
			return {
				externalPath: 'https://node-webkit.s3.amazonaws.com/v' + targetOptions.runtimeVersion + '/',
				winLibs: [
					{
						dir: targetOptions.isX64 ? 'x64' : '',
						name: targetOptions.runtime + '.lib',
					},
					{
						dir: targetOptions.isX64 ? 'x64' : '',
						name: 'node.lib',
					},
				],
				tarPath: 'nw-headers-v' + targetOptions.runtimeVersion + '.tar.gz',
				headerOnly: false,
			}
		}
		return {
			externalPath: 'https://node-webkit.s3.amazonaws.com/v' + targetOptions.runtimeVersion + '/',
			winLibs: [
				{
					dir: targetOptions.isX64 ? 'x64' : '',
					name: targetOptions.runtime + '.lib',
				},
			],
			tarPath: 'nw-headers-v' + targetOptions.runtimeVersion + '.tar.gz',
			headerOnly: false,
		}
	},
	electron: function (targetOptions) {
		return {
			externalPath: ELECTRON_MIRROR + '/v' + targetOptions.runtimeVersion + '/',
			winLibs: [
				{
					dir: targetOptions.isArm64 ? 'arm64' : targetOptions.isX64 ? 'x64' : '',
					name: 'node.lib',
				},
			],
			tarPath: 'node' + '-v' + targetOptions.runtimeVersion + '.tar.gz',
			headerOnly: semver.gte(targetOptions.runtimeVersion, '4.0.0-alpha'),
		}
	},
	get: function (targetOptions) {
		assert(targetOptions && typeof targetOptions === 'object')

		const runtime = targetOptions.runtime
		const func = runtimePaths[runtime]
		let paths
		if (typeof func === 'function') {
			paths = func(targetOptions)
			if (paths && typeof paths === 'object') {
				return paths
			}
		}
		throw new Error('Unknown runtime: ' + runtime)
	},
}

module.exports = runtimePaths
