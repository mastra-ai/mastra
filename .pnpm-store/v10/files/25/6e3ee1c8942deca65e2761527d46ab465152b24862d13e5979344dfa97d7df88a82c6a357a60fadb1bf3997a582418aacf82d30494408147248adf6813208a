'use strict'

function getNpmConfig() {
	const npmOptions = {}
	const npmConfigPrefix = 'npm_config_'
	Object.keys(process.env).forEach(function (name) {
		if (name.indexOf(npmConfigPrefix) !== 0) {
			return
		}
		const value = process.env[name]
		name = name.substring(npmConfigPrefix.length)
		if (name) {
			npmOptions[name] = value
		}
	}, this)

	return npmOptions
}

module.exports = function (log) {
	log.verbose('CFG', 'Looking for NPM config.')
	const options = getNpmConfig()

	if (options) {
		log.silly('CFG', 'NPM options:', options)
	} else {
		log.verbose('CFG', 'There are no NPM options available.')
	}

	return options
}
