'use strict'
const spawn = require('child_process').spawn
const execFile = require('child_process').execFile

const processHelpers = {
	run: function (command, options) {
		if (!options) options = {}

		return new Promise(function (resolve, reject) {
			const env = Object.assign({}, process.env)
			if (env.Path && env.PATH) {
				if (env.Path !== env.PATH) {
					env.PATH = env.Path + ';' + env.PATH
				}
				delete env.Path
			}
			const child = spawn(command[0], command.slice(1), {
				stdio: options.silent ? 'ignore' : 'inherit',
				env,
			})
			let ended = false
			child.on('error', function (e) {
				if (!ended) {
					reject(e)
					ended = true
				}
			})
			child.on('exit', function (code, signal) {
				if (!ended) {
					if (code === 0) {
						resolve()
					} else {
						reject(new Error('Process terminated: ' + code || signal))
					}
					ended = true
				}
			})
		})
	},
	execFile: function (command) {
		return new Promise(function (resolve, reject) {
			execFile(command[0], command.slice(1), function (err, stdout, stderr) {
				if (err) {
					reject(new Error(err.message + '\n' + (stdout || stderr)))
				} else {
					resolve(stdout)
				}
			})
		})
	},
}

module.exports = processHelpers
