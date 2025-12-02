'use strict'
const log = require('npmlog')

class CMLog {
	get level() {
		if (this.options.noLog) {
			return 'silly'
		} else {
			return log.level
		}
	}

	constructor(options) {
		this.options = options || {}
		this.debug = require('debug')(this.options.logName || 'cmake-js')
	}
	silly(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.silly(cat, msg)
		}
	}
	verbose(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.verbose(cat, msg)
		}
	}
	info(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.info(cat, msg)
		}
	}
	warn(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.warn(cat, msg)
		}
	}
	http(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.http(cat, msg)
		}
	}
	error(cat, msg) {
		if (this.options.noLog) {
			this.debug(cat + ': ' + msg)
		} else {
			log.error(cat, msg)
		}
	}
}

module.exports = CMLog
