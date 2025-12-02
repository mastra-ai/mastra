'use strict'

const log = require('npmlog')
const cp = require('child_process')
const path = require('path')

const execFile = async (...args) =>
	new Promise((resolve) => {
		const child = cp.execFile(...args, (...a) => resolve(a))
		child.stdin.end()
	})

function logWithPrefix(log, prefix) {
	function setPrefix(logFunction) {
		return (...args) => logFunction.apply(null, [prefix, ...args]) // eslint-disable-line
	}
	return {
		silly: setPrefix(log.silly),
		verbose: setPrefix(log.verbose),
		info: setPrefix(log.info),
		warn: setPrefix(log.warn),
		error: setPrefix(log.error),
	}
}

async function regGetValue(key, value, addOpts) {
	const outReValue = value.replace(/\W/g, '.')
	const outRe = new RegExp(`^\\s+${outReValue}\\s+REG_\\w+\\s+(\\S.*)$`, 'im')
	const reg = path.join(process.env.SystemRoot, 'System32', 'reg.exe')
	const regArgs = ['query', key, '/v', value].concat(addOpts)

	log.silly('reg', 'running', reg, regArgs)
	const [err, stdout, stderr] = await execFile(reg, regArgs, { encoding: 'utf8' })

	log.silly('reg', 'reg.exe stdout = %j', stdout)
	if (err || stderr.trim() !== '') {
		log.silly('reg', 'reg.exe err = %j', err && (err.stack || err))
		log.silly('reg', 'reg.exe stderr = %j', stderr)
		if (err) {
			throw err
		}
		throw new Error(stderr)
	}

	const result = outRe.exec(stdout)
	if (!result) {
		log.silly('reg', 'error parsing stdout')
		throw new Error('Could not parse output of reg.exe')
	}

	log.silly('reg', 'found: %j', result[1])
	return result[1]
}

async function regSearchKeys(keys, value, addOpts) {
	for (const key of keys) {
		try {
			return await regGetValue(key, value, addOpts)
		} catch {
			continue
		}
	}
}

module.exports = {
	logWithPrefix: logWithPrefix,
	regGetValue: regGetValue,
	regSearchKeys: regSearchKeys,
	execFile: execFile,
}
