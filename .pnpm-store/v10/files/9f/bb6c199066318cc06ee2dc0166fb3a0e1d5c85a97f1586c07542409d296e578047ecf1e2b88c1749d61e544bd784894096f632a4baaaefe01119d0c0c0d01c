import { i as __require, t as __commonJS } from "./chunk-09eW3CcW.mjs";

//#region ../../node_modules/.pnpm/sqlstring@2.3.3/node_modules/sqlstring/lib/SqlString.js
var require_SqlString = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/sqlstring@2.3.3/node_modules/sqlstring/lib/SqlString.js": ((exports) => {
	var SqlString$3 = exports;
	var ID_GLOBAL_REGEXP = /`/g;
	var QUAL_GLOBAL_REGEXP = /\./g;
	var CHARS_GLOBAL_REGEXP = /[\0\b\t\n\r\x1a\"\'\\]/g;
	var CHARS_ESCAPE_MAP = {
		"\0": "\\0",
		"\b": "\\b",
		"	": "\\t",
		"\n": "\\n",
		"\r": "\\r",
		"": "\\Z",
		"\"": "\\\"",
		"'": "\\'",
		"\\": "\\\\"
	};
	SqlString$3.escapeId = function escapeId(val, forbidQualified) {
		if (Array.isArray(val)) {
			var sql = "";
			for (var i$4 = 0; i$4 < val.length; i$4++) sql += (i$4 === 0 ? "" : ", ") + SqlString$3.escapeId(val[i$4], forbidQualified);
			return sql;
		} else if (forbidQualified) return "`" + String(val).replace(ID_GLOBAL_REGEXP, "``") + "`";
		else return "`" + String(val).replace(ID_GLOBAL_REGEXP, "``").replace(QUAL_GLOBAL_REGEXP, "`.`") + "`";
	};
	SqlString$3.escape = function escape(val, stringifyObjects, timeZone) {
		if (val === void 0 || val === null) return "NULL";
		switch (typeof val) {
			case "boolean": return val ? "true" : "false";
			case "number": return val + "";
			case "object": if (Object.prototype.toString.call(val) === "[object Date]") return SqlString$3.dateToString(val, timeZone || "local");
			else if (Array.isArray(val)) return SqlString$3.arrayToList(val, timeZone);
			else if (Buffer.isBuffer(val)) return SqlString$3.bufferToString(val);
			else if (typeof val.toSqlString === "function") return String(val.toSqlString());
			else if (stringifyObjects) return escapeString(val.toString());
			else return SqlString$3.objectToValues(val, timeZone);
			default: return escapeString(val);
		}
	};
	SqlString$3.arrayToList = function arrayToList(array, timeZone) {
		var sql = "";
		for (var i$4 = 0; i$4 < array.length; i$4++) {
			var val = array[i$4];
			if (Array.isArray(val)) sql += (i$4 === 0 ? "" : ", ") + "(" + SqlString$3.arrayToList(val, timeZone) + ")";
			else sql += (i$4 === 0 ? "" : ", ") + SqlString$3.escape(val, true, timeZone);
		}
		return sql;
	};
	SqlString$3.format = function format(sql, values, stringifyObjects, timeZone) {
		if (values == null) return sql;
		if (!Array.isArray(values)) values = [values];
		var chunkIndex = 0;
		var placeholdersRegex = /\?+/g;
		var result = "";
		var valuesIndex = 0;
		var match;
		while (valuesIndex < values.length && (match = placeholdersRegex.exec(sql))) {
			var len = match[0].length;
			if (len > 2) continue;
			var value = len === 2 ? SqlString$3.escapeId(values[valuesIndex]) : SqlString$3.escape(values[valuesIndex], stringifyObjects, timeZone);
			result += sql.slice(chunkIndex, match.index) + value;
			chunkIndex = placeholdersRegex.lastIndex;
			valuesIndex++;
		}
		if (chunkIndex === 0) return sql;
		if (chunkIndex < sql.length) return result + sql.slice(chunkIndex);
		return result;
	};
	SqlString$3.dateToString = function dateToString(date, timeZone) {
		var dt = new Date(date);
		if (isNaN(dt.getTime())) return "NULL";
		var year;
		var month;
		var day;
		var hour;
		var minute;
		var second;
		var millisecond;
		if (timeZone === "local") {
			year = dt.getFullYear();
			month = dt.getMonth() + 1;
			day = dt.getDate();
			hour = dt.getHours();
			minute = dt.getMinutes();
			second = dt.getSeconds();
			millisecond = dt.getMilliseconds();
		} else {
			var tz = convertTimezone(timeZone);
			if (tz !== false && tz !== 0) dt.setTime(dt.getTime() + tz * 6e4);
			year = dt.getUTCFullYear();
			month = dt.getUTCMonth() + 1;
			day = dt.getUTCDate();
			hour = dt.getUTCHours();
			minute = dt.getUTCMinutes();
			second = dt.getUTCSeconds();
			millisecond = dt.getUTCMilliseconds();
		}
		return escapeString(zeroPad(year, 4) + "-" + zeroPad(month, 2) + "-" + zeroPad(day, 2) + " " + zeroPad(hour, 2) + ":" + zeroPad(minute, 2) + ":" + zeroPad(second, 2) + "." + zeroPad(millisecond, 3));
	};
	SqlString$3.bufferToString = function bufferToString(buffer$1) {
		return "X" + escapeString(buffer$1.toString("hex"));
	};
	SqlString$3.objectToValues = function objectToValues(object, timeZone) {
		var sql = "";
		for (var key$1 in object) {
			var val = object[key$1];
			if (typeof val === "function") continue;
			sql += (sql.length === 0 ? "" : ", ") + SqlString$3.escapeId(key$1) + " = " + SqlString$3.escape(val, true, timeZone);
		}
		return sql;
	};
	SqlString$3.raw = function raw(sql) {
		if (typeof sql !== "string") throw new TypeError("argument sql must be a string");
		return { toSqlString: function toSqlString() {
			return sql;
		} };
	};
	function escapeString(val) {
		var chunkIndex = CHARS_GLOBAL_REGEXP.lastIndex = 0;
		var escapedVal = "";
		var match;
		while (match = CHARS_GLOBAL_REGEXP.exec(val)) {
			escapedVal += val.slice(chunkIndex, match.index) + CHARS_ESCAPE_MAP[match[0]];
			chunkIndex = CHARS_GLOBAL_REGEXP.lastIndex;
		}
		if (chunkIndex === 0) return "'" + val + "'";
		if (chunkIndex < val.length) return "'" + escapedVal + val.slice(chunkIndex) + "'";
		return "'" + escapedVal + "'";
	}
	function zeroPad(number, length) {
		number = number.toString();
		while (number.length < length) number = "0" + number;
		return number;
	}
	function convertTimezone(tz) {
		if (tz === "Z") return 0;
		var m = tz.match(/([\+\-\s])(\d\d):?(\d\d)?/);
		if (m) return (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) : 0) / 60) * 60;
		return false;
	}
}) });

//#endregion
//#region ../../node_modules/.pnpm/sqlstring@2.3.3/node_modules/sqlstring/index.js
var require_sqlstring = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/sqlstring@2.3.3/node_modules/sqlstring/index.js": ((exports, module) => {
	module.exports = require_SqlString();
}) });

//#endregion
//#region ../../node_modules/.pnpm/lru.min@1.1.2/node_modules/lru.min/lib/index.js
var require_lib$2 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/lru.min@1.1.2/node_modules/lru.min/lib/index.js": ((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.createLRU = void 0;
	const createLRU$3 = (options) => {
		let { max } = options;
		if (!(Number.isInteger(max) && max > 0)) throw new TypeError("`max` must be a positive integer");
		let size = 0;
		let head = 0;
		let tail = 0;
		let free = [];
		const { onEviction } = options;
		const keyMap = /* @__PURE__ */ new Map();
		const keyList = new Array(max).fill(void 0);
		const valList = new Array(max).fill(void 0);
		const next = new Array(max).fill(0);
		const prev = new Array(max).fill(0);
		const setTail = (index, type) => {
			if (index === tail) return;
			const nextIndex = next[index];
			const prevIndex = prev[index];
			if (index === head) head = nextIndex;
			else if (type === "get" || prevIndex !== 0) next[prevIndex] = nextIndex;
			if (nextIndex !== 0) prev[nextIndex] = prevIndex;
			next[tail] = index;
			prev[index] = tail;
			next[index] = 0;
			tail = index;
		};
		const _evict = () => {
			const evictHead = head;
			const key$1 = keyList[evictHead];
			onEviction === null || onEviction === void 0 || onEviction(key$1, valList[evictHead]);
			keyMap.delete(key$1);
			keyList[evictHead] = void 0;
			valList[evictHead] = void 0;
			head = next[evictHead];
			if (head !== 0) prev[head] = 0;
			size--;
			if (size === 0) head = tail = 0;
			free.push(evictHead);
			return evictHead;
		};
		return {
			set(key$1, value) {
				if (key$1 === void 0) return;
				let index = keyMap.get(key$1);
				if (index === void 0) {
					index = size === max ? _evict() : free.length > 0 ? free.pop() : size;
					keyMap.set(key$1, index);
					keyList[index] = key$1;
					size++;
				} else onEviction === null || onEviction === void 0 || onEviction(key$1, valList[index]);
				valList[index] = value;
				if (size === 1) head = tail = index;
				else setTail(index, "set");
			},
			get(key$1) {
				const index = keyMap.get(key$1);
				if (index === void 0) return;
				if (index !== tail) setTail(index, "get");
				return valList[index];
			},
			peek: (key$1) => {
				const index = keyMap.get(key$1);
				return index !== void 0 ? valList[index] : void 0;
			},
			has: (key$1) => keyMap.has(key$1),
			*keys() {
				let current = tail;
				for (let i$4 = 0; i$4 < size; i$4++) {
					yield keyList[current];
					current = prev[current];
				}
			},
			*values() {
				let current = tail;
				for (let i$4 = 0; i$4 < size; i$4++) {
					yield valList[current];
					current = prev[current];
				}
			},
			*entries() {
				let current = tail;
				for (let i$4 = 0; i$4 < size; i$4++) {
					yield [keyList[current], valList[current]];
					current = prev[current];
				}
			},
			forEach: (callback) => {
				let current = tail;
				for (let i$4 = 0; i$4 < size; i$4++) {
					const key$1 = keyList[current];
					const value = valList[current];
					callback(value, key$1);
					current = prev[current];
				}
			},
			delete(key$1) {
				const index = keyMap.get(key$1);
				if (index === void 0) return false;
				onEviction === null || onEviction === void 0 || onEviction(key$1, valList[index]);
				keyMap.delete(key$1);
				free.push(index);
				keyList[index] = void 0;
				valList[index] = void 0;
				const prevIndex = prev[index];
				const nextIndex = next[index];
				if (prevIndex !== 0) next[prevIndex] = nextIndex;
				if (nextIndex !== 0) prev[nextIndex] = prevIndex;
				if (index === head) head = nextIndex;
				if (index === tail) tail = prevIndex;
				size--;
				return true;
			},
			evict: (number) => {
				let toPrune = Math.min(number, size);
				while (toPrune > 0) {
					_evict();
					toPrune--;
				}
			},
			clear() {
				if (typeof onEviction === "function") {
					const iterator = keyMap.values();
					for (let result = iterator.next(); !result.done; result = iterator.next()) onEviction(keyList[result.value], valList[result.value]);
				}
				keyMap.clear();
				keyList.fill(void 0);
				valList.fill(void 0);
				free = [];
				size = 0;
				head = tail = 0;
			},
			resize: (newMax) => {
				if (!(Number.isInteger(newMax) && newMax > 0)) throw new TypeError("`max` must be a positive integer");
				if (newMax === max) return;
				if (newMax < max) {
					let current = tail;
					const preserve = Math.min(size, newMax);
					const remove = size - preserve;
					const newKeyList = new Array(newMax);
					const newValList = new Array(newMax);
					const newNext = new Array(newMax);
					const newPrev = new Array(newMax);
					for (let i$4 = 1; i$4 <= remove; i$4++) onEviction === null || onEviction === void 0 || onEviction(keyList[i$4], valList[i$4]);
					for (let i$4 = preserve - 1; i$4 >= 0; i$4--) {
						newKeyList[i$4] = keyList[current];
						newValList[i$4] = valList[current];
						newNext[i$4] = i$4 + 1;
						newPrev[i$4] = i$4 - 1;
						keyMap.set(newKeyList[i$4], i$4);
						current = prev[current];
					}
					head = 0;
					tail = preserve - 1;
					size = preserve;
					keyList.length = newMax;
					valList.length = newMax;
					next.length = newMax;
					prev.length = newMax;
					for (let i$4 = 0; i$4 < preserve; i$4++) {
						keyList[i$4] = newKeyList[i$4];
						valList[i$4] = newValList[i$4];
						next[i$4] = newNext[i$4];
						prev[i$4] = newPrev[i$4];
					}
					free = [];
					for (let i$4 = preserve; i$4 < newMax; i$4++) free.push(i$4);
				} else {
					const fill = newMax - max;
					keyList.push(...new Array(fill).fill(void 0));
					valList.push(...new Array(fill).fill(void 0));
					next.push(...new Array(fill).fill(0));
					prev.push(...new Array(fill).fill(0));
				}
				max = newMax;
			},
			get max() {
				return max;
			},
			get size() {
				return size;
			},
			get available() {
				return max - size;
			}
		};
	};
	exports.createLRU = createLRU$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/parser_cache.js
var require_parser_cache = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/parser_cache.js": ((exports, module) => {
	const { createLRU: createLRU$2 } = require_lib$2();
	const parserCache$3 = createLRU$2({ max: 15e3 });
	function keyFromFields(type, fields$1, options, config) {
		const res = [
			type,
			typeof options.nestTables,
			options.nestTables,
			Boolean(options.rowsAsArray),
			Boolean(options.supportBigNumbers || config.supportBigNumbers),
			Boolean(options.bigNumberStrings || config.bigNumberStrings),
			typeof options.typeCast === "boolean" ? options.typeCast : typeof options.typeCast,
			options.timezone || config.timezone,
			Boolean(options.decimalNumbers),
			options.dateStrings
		];
		for (let i$4 = 0; i$4 < fields$1.length; ++i$4) {
			const field = fields$1[i$4];
			res.push([
				field.name,
				field.columnType,
				field.length,
				field.schema,
				field.table,
				field.flags,
				field.characterSet
			]);
		}
		return JSON.stringify(res, null, 0);
	}
	function getParser(type, fields$1, options, config, compiler) {
		const key$1 = keyFromFields(type, fields$1, options, config);
		let parser = parserCache$3.get(key$1);
		if (parser) return parser;
		parser = compiler(fields$1, options, config);
		parserCache$3.set(key$1, parser);
		return parser;
	}
	function setMaxCache(max) {
		parserCache$3.resize(max);
	}
	function clearCache() {
		parserCache$3.clear();
	}
	module.exports = {
		getParser,
		setMaxCache,
		clearCache,
		_keyFromFields: keyFromFields
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/denque@2.1.0/node_modules/denque/index.js
var require_denque = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/denque@2.1.0/node_modules/denque/index.js": ((exports, module) => {
	/**
	* Custom implementation of a double ended queue.
	*/
	function Denque(array, options) {
		var options = options || {};
		this._capacity = options.capacity;
		this._head = 0;
		this._tail = 0;
		if (Array.isArray(array)) this._fromArray(array);
		else {
			this._capacityMask = 3;
			this._list = new Array(4);
		}
	}
	/**
	* --------------
	*  PUBLIC API
	* -------------
	*/
	/**
	* Returns the item at the specified index from the list.
	* 0 is the first element, 1 is the second, and so on...
	* Elements at negative values are that many from the end: -1 is one before the end
	* (the last element), -2 is two before the end (one before last), etc.
	* @param index
	* @returns {*}
	*/
	Denque.prototype.peekAt = function peekAt(index) {
		var i$4 = index;
		if (i$4 !== (i$4 | 0)) return;
		var len = this.size();
		if (i$4 >= len || i$4 < -len) return void 0;
		if (i$4 < 0) i$4 += len;
		i$4 = this._head + i$4 & this._capacityMask;
		return this._list[i$4];
	};
	/**
	* Alias for peekAt()
	* @param i
	* @returns {*}
	*/
	Denque.prototype.get = function get(i$4) {
		return this.peekAt(i$4);
	};
	/**
	* Returns the first item in the list without removing it.
	* @returns {*}
	*/
	Denque.prototype.peek = function peek() {
		if (this._head === this._tail) return void 0;
		return this._list[this._head];
	};
	/**
	* Alias for peek()
	* @returns {*}
	*/
	Denque.prototype.peekFront = function peekFront() {
		return this.peek();
	};
	/**
	* Returns the item that is at the back of the queue without removing it.
	* Uses peekAt(-1)
	*/
	Denque.prototype.peekBack = function peekBack() {
		return this.peekAt(-1);
	};
	/**
	* Returns the current length of the queue
	* @return {Number}
	*/
	Object.defineProperty(Denque.prototype, "length", { get: function length() {
		return this.size();
	} });
	/**
	* Return the number of items on the list, or 0 if empty.
	* @returns {number}
	*/
	Denque.prototype.size = function size() {
		if (this._head === this._tail) return 0;
		if (this._head < this._tail) return this._tail - this._head;
		else return this._capacityMask + 1 - (this._head - this._tail);
	};
	/**
	* Add an item at the beginning of the list.
	* @param item
	*/
	Denque.prototype.unshift = function unshift(item) {
		if (arguments.length === 0) return this.size();
		var len = this._list.length;
		this._head = this._head - 1 + len & this._capacityMask;
		this._list[this._head] = item;
		if (this._tail === this._head) this._growArray();
		if (this._capacity && this.size() > this._capacity) this.pop();
		if (this._head < this._tail) return this._tail - this._head;
		else return this._capacityMask + 1 - (this._head - this._tail);
	};
	/**
	* Remove and return the first item on the list,
	* Returns undefined if the list is empty.
	* @returns {*}
	*/
	Denque.prototype.shift = function shift() {
		var head = this._head;
		if (head === this._tail) return void 0;
		var item = this._list[head];
		this._list[head] = void 0;
		this._head = head + 1 & this._capacityMask;
		if (head < 2 && this._tail > 1e4 && this._tail <= this._list.length >>> 2) this._shrinkArray();
		return item;
	};
	/**
	* Add an item to the bottom of the list.
	* @param item
	*/
	Denque.prototype.push = function push(item) {
		if (arguments.length === 0) return this.size();
		var tail = this._tail;
		this._list[tail] = item;
		this._tail = tail + 1 & this._capacityMask;
		if (this._tail === this._head) this._growArray();
		if (this._capacity && this.size() > this._capacity) this.shift();
		if (this._head < this._tail) return this._tail - this._head;
		else return this._capacityMask + 1 - (this._head - this._tail);
	};
	/**
	* Remove and return the last item on the list.
	* Returns undefined if the list is empty.
	* @returns {*}
	*/
	Denque.prototype.pop = function pop() {
		var tail = this._tail;
		if (tail === this._head) return void 0;
		var len = this._list.length;
		this._tail = tail - 1 + len & this._capacityMask;
		var item = this._list[this._tail];
		this._list[this._tail] = void 0;
		if (this._head < 2 && tail > 1e4 && tail <= len >>> 2) this._shrinkArray();
		return item;
	};
	/**
	* Remove and return the item at the specified index from the list.
	* Returns undefined if the list is empty.
	* @param index
	* @returns {*}
	*/
	Denque.prototype.removeOne = function removeOne(index) {
		var i$4 = index;
		if (i$4 !== (i$4 | 0)) return;
		if (this._head === this._tail) return void 0;
		var size = this.size();
		var len = this._list.length;
		if (i$4 >= size || i$4 < -size) return void 0;
		if (i$4 < 0) i$4 += size;
		i$4 = this._head + i$4 & this._capacityMask;
		var item = this._list[i$4];
		var k;
		if (index < size / 2) {
			for (k = index; k > 0; k--) this._list[i$4] = this._list[i$4 = i$4 - 1 + len & this._capacityMask];
			this._list[i$4] = void 0;
			this._head = this._head + 1 + len & this._capacityMask;
		} else {
			for (k = size - 1 - index; k > 0; k--) this._list[i$4] = this._list[i$4 = i$4 + 1 + len & this._capacityMask];
			this._list[i$4] = void 0;
			this._tail = this._tail - 1 + len & this._capacityMask;
		}
		return item;
	};
	/**
	* Remove number of items from the specified index from the list.
	* Returns array of removed items.
	* Returns undefined if the list is empty.
	* @param index
	* @param count
	* @returns {array}
	*/
	Denque.prototype.remove = function remove(index, count) {
		var i$4 = index;
		var removed;
		var del_count = count;
		if (i$4 !== (i$4 | 0)) return;
		if (this._head === this._tail) return void 0;
		var size = this.size();
		var len = this._list.length;
		if (i$4 >= size || i$4 < -size || count < 1) return void 0;
		if (i$4 < 0) i$4 += size;
		if (count === 1 || !count) {
			removed = new Array(1);
			removed[0] = this.removeOne(i$4);
			return removed;
		}
		if (i$4 === 0 && i$4 + count >= size) {
			removed = this.toArray();
			this.clear();
			return removed;
		}
		if (i$4 + count > size) count = size - i$4;
		var k;
		removed = new Array(count);
		for (k = 0; k < count; k++) removed[k] = this._list[this._head + i$4 + k & this._capacityMask];
		i$4 = this._head + i$4 & this._capacityMask;
		if (index + count === size) {
			this._tail = this._tail - count + len & this._capacityMask;
			for (k = count; k > 0; k--) this._list[i$4 = i$4 + 1 + len & this._capacityMask] = void 0;
			return removed;
		}
		if (index === 0) {
			this._head = this._head + count + len & this._capacityMask;
			for (k = count - 1; k > 0; k--) this._list[i$4 = i$4 + 1 + len & this._capacityMask] = void 0;
			return removed;
		}
		if (i$4 < size / 2) {
			this._head = this._head + index + count + len & this._capacityMask;
			for (k = index; k > 0; k--) this.unshift(this._list[i$4 = i$4 - 1 + len & this._capacityMask]);
			i$4 = this._head - 1 + len & this._capacityMask;
			while (del_count > 0) {
				this._list[i$4 = i$4 - 1 + len & this._capacityMask] = void 0;
				del_count--;
			}
			if (index < 0) this._tail = i$4;
		} else {
			this._tail = i$4;
			i$4 = i$4 + count + len & this._capacityMask;
			for (k = size - (count + index); k > 0; k--) this.push(this._list[i$4++]);
			i$4 = this._tail;
			while (del_count > 0) {
				this._list[i$4 = i$4 + 1 + len & this._capacityMask] = void 0;
				del_count--;
			}
		}
		if (this._head < 2 && this._tail > 1e4 && this._tail <= len >>> 2) this._shrinkArray();
		return removed;
	};
	/**
	* Native splice implementation.
	* Remove number of items from the specified index from the list and/or add new elements.
	* Returns array of removed items or empty array if count == 0.
	* Returns undefined if the list is empty.
	*
	* @param index
	* @param count
	* @param {...*} [elements]
	* @returns {array}
	*/
	Denque.prototype.splice = function splice(index, count) {
		var i$4 = index;
		if (i$4 !== (i$4 | 0)) return;
		var size = this.size();
		if (i$4 < 0) i$4 += size;
		if (i$4 > size) return void 0;
		if (arguments.length > 2) {
			var k;
			var temp;
			var removed;
			var arg_len = arguments.length;
			var len = this._list.length;
			var arguments_index = 2;
			if (!size || i$4 < size / 2) {
				temp = new Array(i$4);
				for (k = 0; k < i$4; k++) temp[k] = this._list[this._head + k & this._capacityMask];
				if (count === 0) {
					removed = [];
					if (i$4 > 0) this._head = this._head + i$4 + len & this._capacityMask;
				} else {
					removed = this.remove(i$4, count);
					this._head = this._head + i$4 + len & this._capacityMask;
				}
				while (arg_len > arguments_index) this.unshift(arguments[--arg_len]);
				for (k = i$4; k > 0; k--) this.unshift(temp[k - 1]);
			} else {
				temp = new Array(size - (i$4 + count));
				var leng = temp.length;
				for (k = 0; k < leng; k++) temp[k] = this._list[this._head + i$4 + count + k & this._capacityMask];
				if (count === 0) {
					removed = [];
					if (i$4 != size) this._tail = this._head + i$4 + len & this._capacityMask;
				} else {
					removed = this.remove(i$4, count);
					this._tail = this._tail - leng + len & this._capacityMask;
				}
				while (arguments_index < arg_len) this.push(arguments[arguments_index++]);
				for (k = 0; k < leng; k++) this.push(temp[k]);
			}
			return removed;
		} else return this.remove(i$4, count);
	};
	/**
	* Soft clear - does not reset capacity.
	*/
	Denque.prototype.clear = function clear() {
		this._list = new Array(this._list.length);
		this._head = 0;
		this._tail = 0;
	};
	/**
	* Returns true or false whether the list is empty.
	* @returns {boolean}
	*/
	Denque.prototype.isEmpty = function isEmpty() {
		return this._head === this._tail;
	};
	/**
	* Returns an array of all queue items.
	* @returns {Array}
	*/
	Denque.prototype.toArray = function toArray() {
		return this._copyArray(false);
	};
	/**
	* -------------
	*   INTERNALS
	* -------------
	*/
	/**
	* Fills the queue with items from an array
	* For use in the constructor
	* @param array
	* @private
	*/
	Denque.prototype._fromArray = function _fromArray(array) {
		var length = array.length;
		var capacity = this._nextPowerOf2(length);
		this._list = new Array(capacity);
		this._capacityMask = capacity - 1;
		this._tail = length;
		for (var i$4 = 0; i$4 < length; i$4++) this._list[i$4] = array[i$4];
	};
	/**
	*
	* @param fullCopy
	* @param size Initialize the array with a specific size. Will default to the current list size
	* @returns {Array}
	* @private
	*/
	Denque.prototype._copyArray = function _copyArray(fullCopy, size) {
		var src = this._list;
		var capacity = src.length;
		var length = this.length;
		size = size | length;
		if (size == length && this._head < this._tail) return this._list.slice(this._head, this._tail);
		var dest = new Array(size);
		var k = 0;
		var i$4;
		if (fullCopy || this._head > this._tail) {
			for (i$4 = this._head; i$4 < capacity; i$4++) dest[k++] = src[i$4];
			for (i$4 = 0; i$4 < this._tail; i$4++) dest[k++] = src[i$4];
		} else for (i$4 = this._head; i$4 < this._tail; i$4++) dest[k++] = src[i$4];
		return dest;
	};
	/**
	* Grows the internal list array.
	* @private
	*/
	Denque.prototype._growArray = function _growArray() {
		if (this._head != 0) {
			var newList = this._copyArray(true, this._list.length << 1);
			this._tail = this._list.length;
			this._head = 0;
			this._list = newList;
		} else {
			this._tail = this._list.length;
			this._list.length <<= 1;
		}
		this._capacityMask = this._capacityMask << 1 | 1;
	};
	/**
	* Shrinks the internal list array.
	* @private
	*/
	Denque.prototype._shrinkArray = function _shrinkArray() {
		this._list.length >>>= 1;
		this._capacityMask >>>= 1;
	};
	/**
	* Find the next power of 2, at least 4
	* @private
	* @param {number} num 
	* @returns {number}
	*/
	Denque.prototype._nextPowerOf2 = function _nextPowerOf2(num) {
		var nextPow2 = 1 << Math.log(num) / Math.log(2) + 1;
		return Math.max(nextPow2, 4);
	};
	module.exports = Denque;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/errors.js
var require_errors = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/errors.js": ((exports) => {
	/**
	* MySQL error constants
	*
	* Extracted from version 8.0.33
	*
	* !! Generated by generate-error-constants.js, do not modify by hand !!
	*/
	exports.EE_CANTCREATEFILE = 1;
	exports.EE_READ = 2;
	exports.EE_WRITE = 3;
	exports.EE_BADCLOSE = 4;
	exports.EE_OUTOFMEMORY = 5;
	exports.EE_DELETE = 6;
	exports.EE_LINK = 7;
	exports.EE_EOFERR = 9;
	exports.EE_CANTLOCK = 10;
	exports.EE_CANTUNLOCK = 11;
	exports.EE_DIR = 12;
	exports.EE_STAT = 13;
	exports.EE_CANT_CHSIZE = 14;
	exports.EE_CANT_OPEN_STREAM = 15;
	exports.EE_GETWD = 16;
	exports.EE_SETWD = 17;
	exports.EE_LINK_WARNING = 18;
	exports.EE_OPEN_WARNING = 19;
	exports.EE_DISK_FULL = 20;
	exports.EE_CANT_MKDIR = 21;
	exports.EE_UNKNOWN_CHARSET = 22;
	exports.EE_OUT_OF_FILERESOURCES = 23;
	exports.EE_CANT_READLINK = 24;
	exports.EE_CANT_SYMLINK = 25;
	exports.EE_REALPATH = 26;
	exports.EE_SYNC = 27;
	exports.EE_UNKNOWN_COLLATION = 28;
	exports.EE_FILENOTFOUND = 29;
	exports.EE_FILE_NOT_CLOSED = 30;
	exports.EE_CHANGE_OWNERSHIP = 31;
	exports.EE_CHANGE_PERMISSIONS = 32;
	exports.EE_CANT_SEEK = 33;
	exports.EE_CAPACITY_EXCEEDED = 34;
	exports.EE_DISK_FULL_WITH_RETRY_MSG = 35;
	exports.EE_FAILED_TO_CREATE_TIMER = 36;
	exports.EE_FAILED_TO_DELETE_TIMER = 37;
	exports.EE_FAILED_TO_CREATE_TIMER_QUEUE = 38;
	exports.EE_FAILED_TO_START_TIMER_NOTIFY_THREAD = 39;
	exports.EE_FAILED_TO_CREATE_TIMER_NOTIFY_THREAD_INTERRUPT_EVENT = 40;
	exports.EE_EXITING_TIMER_NOTIFY_THREAD = 41;
	exports.EE_WIN_LIBRARY_LOAD_FAILED = 42;
	exports.EE_WIN_RUN_TIME_ERROR_CHECK = 43;
	exports.EE_FAILED_TO_DETERMINE_LARGE_PAGE_SIZE = 44;
	exports.EE_FAILED_TO_KILL_ALL_THREADS = 45;
	exports.EE_FAILED_TO_CREATE_IO_COMPLETION_PORT = 46;
	exports.EE_FAILED_TO_OPEN_DEFAULTS_FILE = 47;
	exports.EE_FAILED_TO_HANDLE_DEFAULTS_FILE = 48;
	exports.EE_WRONG_DIRECTIVE_IN_CONFIG_FILE = 49;
	exports.EE_SKIPPING_DIRECTIVE_DUE_TO_MAX_INCLUDE_RECURSION = 50;
	exports.EE_INCORRECT_GRP_DEFINITION_IN_CONFIG_FILE = 51;
	exports.EE_OPTION_WITHOUT_GRP_IN_CONFIG_FILE = 52;
	exports.EE_CONFIG_FILE_PERMISSION_ERROR = 53;
	exports.EE_IGNORE_WORLD_WRITABLE_CONFIG_FILE = 54;
	exports.EE_USING_DISABLED_OPTION = 55;
	exports.EE_USING_DISABLED_SHORT_OPTION = 56;
	exports.EE_USING_PASSWORD_ON_CLI_IS_INSECURE = 57;
	exports.EE_UNKNOWN_SUFFIX_FOR_VARIABLE = 58;
	exports.EE_SSL_ERROR_FROM_FILE = 59;
	exports.EE_SSL_ERROR = 60;
	exports.EE_NET_SEND_ERROR_IN_BOOTSTRAP = 61;
	exports.EE_PACKETS_OUT_OF_ORDER = 62;
	exports.EE_UNKNOWN_PROTOCOL_OPTION = 63;
	exports.EE_FAILED_TO_LOCATE_SERVER_PUBLIC_KEY = 64;
	exports.EE_PUBLIC_KEY_NOT_IN_PEM_FORMAT = 65;
	exports.EE_DEBUG_INFO = 66;
	exports.EE_UNKNOWN_VARIABLE = 67;
	exports.EE_UNKNOWN_OPTION = 68;
	exports.EE_UNKNOWN_SHORT_OPTION = 69;
	exports.EE_OPTION_WITHOUT_ARGUMENT = 70;
	exports.EE_OPTION_REQUIRES_ARGUMENT = 71;
	exports.EE_SHORT_OPTION_REQUIRES_ARGUMENT = 72;
	exports.EE_OPTION_IGNORED_DUE_TO_INVALID_VALUE = 73;
	exports.EE_OPTION_WITH_EMPTY_VALUE = 74;
	exports.EE_FAILED_TO_ASSIGN_MAX_VALUE_TO_OPTION = 75;
	exports.EE_INCORRECT_BOOLEAN_VALUE_FOR_OPTION = 76;
	exports.EE_FAILED_TO_SET_OPTION_VALUE = 77;
	exports.EE_INCORRECT_INT_VALUE_FOR_OPTION = 78;
	exports.EE_INCORRECT_UINT_VALUE_FOR_OPTION = 79;
	exports.EE_ADJUSTED_SIGNED_VALUE_FOR_OPTION = 80;
	exports.EE_ADJUSTED_UNSIGNED_VALUE_FOR_OPTION = 81;
	exports.EE_ADJUSTED_ULONGLONG_VALUE_FOR_OPTION = 82;
	exports.EE_ADJUSTED_DOUBLE_VALUE_FOR_OPTION = 83;
	exports.EE_INVALID_DECIMAL_VALUE_FOR_OPTION = 84;
	exports.EE_COLLATION_PARSER_ERROR = 85;
	exports.EE_FAILED_TO_RESET_BEFORE_PRIMARY_IGNORABLE_CHAR = 86;
	exports.EE_FAILED_TO_RESET_BEFORE_TERTIARY_IGNORABLE_CHAR = 87;
	exports.EE_SHIFT_CHAR_OUT_OF_RANGE = 88;
	exports.EE_RESET_CHAR_OUT_OF_RANGE = 89;
	exports.EE_UNKNOWN_LDML_TAG = 90;
	exports.EE_FAILED_TO_RESET_BEFORE_SECONDARY_IGNORABLE_CHAR = 91;
	exports.EE_FAILED_PROCESSING_DIRECTIVE = 92;
	exports.EE_PTHREAD_KILL_FAILED = 93;
	exports.HA_ERR_KEY_NOT_FOUND = 120;
	exports.HA_ERR_FOUND_DUPP_KEY = 121;
	exports.HA_ERR_INTERNAL_ERROR = 122;
	exports.HA_ERR_RECORD_CHANGED = 123;
	exports.HA_ERR_WRONG_INDEX = 124;
	exports.HA_ERR_ROLLED_BACK = 125;
	exports.HA_ERR_CRASHED = 126;
	exports.HA_ERR_WRONG_IN_RECORD = 127;
	exports.HA_ERR_OUT_OF_MEM = 128;
	exports.HA_ERR_NOT_A_TABLE = 130;
	exports.HA_ERR_WRONG_COMMAND = 131;
	exports.HA_ERR_OLD_FILE = 132;
	exports.HA_ERR_NO_ACTIVE_RECORD = 133;
	exports.HA_ERR_RECORD_DELETED = 134;
	exports.HA_ERR_RECORD_FILE_FULL = 135;
	exports.HA_ERR_INDEX_FILE_FULL = 136;
	exports.HA_ERR_END_OF_FILE = 137;
	exports.HA_ERR_UNSUPPORTED = 138;
	exports.HA_ERR_TOO_BIG_ROW = 139;
	exports.HA_WRONG_CREATE_OPTION = 140;
	exports.HA_ERR_FOUND_DUPP_UNIQUE = 141;
	exports.HA_ERR_UNKNOWN_CHARSET = 142;
	exports.HA_ERR_WRONG_MRG_TABLE_DEF = 143;
	exports.HA_ERR_CRASHED_ON_REPAIR = 144;
	exports.HA_ERR_CRASHED_ON_USAGE = 145;
	exports.HA_ERR_LOCK_WAIT_TIMEOUT = 146;
	exports.HA_ERR_LOCK_TABLE_FULL = 147;
	exports.HA_ERR_READ_ONLY_TRANSACTION = 148;
	exports.HA_ERR_LOCK_DEADLOCK = 149;
	exports.HA_ERR_CANNOT_ADD_FOREIGN = 150;
	exports.HA_ERR_NO_REFERENCED_ROW = 151;
	exports.HA_ERR_ROW_IS_REFERENCED = 152;
	exports.HA_ERR_NO_SAVEPOINT = 153;
	exports.HA_ERR_NON_UNIQUE_BLOCK_SIZE = 154;
	exports.HA_ERR_NO_SUCH_TABLE = 155;
	exports.HA_ERR_TABLE_EXIST = 156;
	exports.HA_ERR_NO_CONNECTION = 157;
	exports.HA_ERR_NULL_IN_SPATIAL = 158;
	exports.HA_ERR_TABLE_DEF_CHANGED = 159;
	exports.HA_ERR_NO_PARTITION_FOUND = 160;
	exports.HA_ERR_RBR_LOGGING_FAILED = 161;
	exports.HA_ERR_DROP_INDEX_FK = 162;
	exports.HA_ERR_FOREIGN_DUPLICATE_KEY = 163;
	exports.HA_ERR_TABLE_NEEDS_UPGRADE = 164;
	exports.HA_ERR_TABLE_READONLY = 165;
	exports.HA_ERR_AUTOINC_READ_FAILED = 166;
	exports.HA_ERR_AUTOINC_ERANGE = 167;
	exports.HA_ERR_GENERIC = 168;
	exports.HA_ERR_RECORD_IS_THE_SAME = 169;
	exports.HA_ERR_LOGGING_IMPOSSIBLE = 170;
	exports.HA_ERR_CORRUPT_EVENT = 171;
	exports.HA_ERR_NEW_FILE = 172;
	exports.HA_ERR_ROWS_EVENT_APPLY = 173;
	exports.HA_ERR_INITIALIZATION = 174;
	exports.HA_ERR_FILE_TOO_SHORT = 175;
	exports.HA_ERR_WRONG_CRC = 176;
	exports.HA_ERR_TOO_MANY_CONCURRENT_TRXS = 177;
	exports.HA_ERR_NOT_IN_LOCK_PARTITIONS = 178;
	exports.HA_ERR_INDEX_COL_TOO_LONG = 179;
	exports.HA_ERR_INDEX_CORRUPT = 180;
	exports.HA_ERR_UNDO_REC_TOO_BIG = 181;
	exports.HA_FTS_INVALID_DOCID = 182;
	exports.HA_ERR_TABLE_IN_FK_CHECK = 183;
	exports.HA_ERR_TABLESPACE_EXISTS = 184;
	exports.HA_ERR_TOO_MANY_FIELDS = 185;
	exports.HA_ERR_ROW_IN_WRONG_PARTITION = 186;
	exports.HA_ERR_INNODB_READ_ONLY = 187;
	exports.HA_ERR_FTS_EXCEED_RESULT_CACHE_LIMIT = 188;
	exports.HA_ERR_TEMP_FILE_WRITE_FAILURE = 189;
	exports.HA_ERR_INNODB_FORCED_RECOVERY = 190;
	exports.HA_ERR_FTS_TOO_MANY_WORDS_IN_PHRASE = 191;
	exports.HA_ERR_FK_DEPTH_EXCEEDED = 192;
	exports.HA_MISSING_CREATE_OPTION = 193;
	exports.HA_ERR_SE_OUT_OF_MEMORY = 194;
	exports.HA_ERR_TABLE_CORRUPT = 195;
	exports.HA_ERR_QUERY_INTERRUPTED = 196;
	exports.HA_ERR_TABLESPACE_MISSING = 197;
	exports.HA_ERR_TABLESPACE_IS_NOT_EMPTY = 198;
	exports.HA_ERR_WRONG_FILE_NAME = 199;
	exports.HA_ERR_NOT_ALLOWED_COMMAND = 200;
	exports.HA_ERR_COMPUTE_FAILED = 201;
	exports.HA_ERR_ROW_FORMAT_CHANGED = 202;
	exports.HA_ERR_NO_WAIT_LOCK = 203;
	exports.HA_ERR_DISK_FULL_NOWAIT = 204;
	exports.HA_ERR_NO_SESSION_TEMP = 205;
	exports.HA_ERR_WRONG_TABLE_NAME = 206;
	exports.HA_ERR_TOO_LONG_PATH = 207;
	exports.HA_ERR_SAMPLING_INIT_FAILED = 208;
	exports.HA_ERR_FTS_TOO_MANY_NESTED_EXP = 209;
	exports.ER_HASHCHK = 1e3;
	exports.ER_NISAMCHK = 1001;
	exports.ER_NO = 1002;
	exports.ER_YES = 1003;
	exports.ER_CANT_CREATE_FILE = 1004;
	exports.ER_CANT_CREATE_TABLE = 1005;
	exports.ER_CANT_CREATE_DB = 1006;
	exports.ER_DB_CREATE_EXISTS = 1007;
	exports.ER_DB_DROP_EXISTS = 1008;
	exports.ER_DB_DROP_DELETE = 1009;
	exports.ER_DB_DROP_RMDIR = 1010;
	exports.ER_CANT_DELETE_FILE = 1011;
	exports.ER_CANT_FIND_SYSTEM_REC = 1012;
	exports.ER_CANT_GET_STAT = 1013;
	exports.ER_CANT_GET_WD = 1014;
	exports.ER_CANT_LOCK = 1015;
	exports.ER_CANT_OPEN_FILE = 1016;
	exports.ER_FILE_NOT_FOUND = 1017;
	exports.ER_CANT_READ_DIR = 1018;
	exports.ER_CANT_SET_WD = 1019;
	exports.ER_CHECKREAD = 1020;
	exports.ER_DISK_FULL = 1021;
	exports.ER_DUP_KEY = 1022;
	exports.ER_ERROR_ON_CLOSE = 1023;
	exports.ER_ERROR_ON_READ = 1024;
	exports.ER_ERROR_ON_RENAME = 1025;
	exports.ER_ERROR_ON_WRITE = 1026;
	exports.ER_FILE_USED = 1027;
	exports.ER_FILSORT_ABORT = 1028;
	exports.ER_FORM_NOT_FOUND = 1029;
	exports.ER_GET_ERRNO = 1030;
	exports.ER_ILLEGAL_HA = 1031;
	exports.ER_KEY_NOT_FOUND = 1032;
	exports.ER_NOT_FORM_FILE = 1033;
	exports.ER_NOT_KEYFILE = 1034;
	exports.ER_OLD_KEYFILE = 1035;
	exports.ER_OPEN_AS_READONLY = 1036;
	exports.ER_OUTOFMEMORY = 1037;
	exports.ER_OUT_OF_SORTMEMORY = 1038;
	exports.ER_UNEXPECTED_EOF = 1039;
	exports.ER_CON_COUNT_ERROR = 1040;
	exports.ER_OUT_OF_RESOURCES = 1041;
	exports.ER_BAD_HOST_ERROR = 1042;
	exports.ER_HANDSHAKE_ERROR = 1043;
	exports.ER_DBACCESS_DENIED_ERROR = 1044;
	exports.ER_ACCESS_DENIED_ERROR = 1045;
	exports.ER_NO_DB_ERROR = 1046;
	exports.ER_UNKNOWN_COM_ERROR = 1047;
	exports.ER_BAD_NULL_ERROR = 1048;
	exports.ER_BAD_DB_ERROR = 1049;
	exports.ER_TABLE_EXISTS_ERROR = 1050;
	exports.ER_BAD_TABLE_ERROR = 1051;
	exports.ER_NON_UNIQ_ERROR = 1052;
	exports.ER_SERVER_SHUTDOWN = 1053;
	exports.ER_BAD_FIELD_ERROR = 1054;
	exports.ER_WRONG_FIELD_WITH_GROUP = 1055;
	exports.ER_WRONG_GROUP_FIELD = 1056;
	exports.ER_WRONG_SUM_SELECT = 1057;
	exports.ER_WRONG_VALUE_COUNT = 1058;
	exports.ER_TOO_LONG_IDENT = 1059;
	exports.ER_DUP_FIELDNAME = 1060;
	exports.ER_DUP_KEYNAME = 1061;
	exports.ER_DUP_ENTRY = 1062;
	exports.ER_WRONG_FIELD_SPEC = 1063;
	exports.ER_PARSE_ERROR = 1064;
	exports.ER_EMPTY_QUERY = 1065;
	exports.ER_NONUNIQ_TABLE = 1066;
	exports.ER_INVALID_DEFAULT = 1067;
	exports.ER_MULTIPLE_PRI_KEY = 1068;
	exports.ER_TOO_MANY_KEYS = 1069;
	exports.ER_TOO_MANY_KEY_PARTS = 1070;
	exports.ER_TOO_LONG_KEY = 1071;
	exports.ER_KEY_COLUMN_DOES_NOT_EXITS = 1072;
	exports.ER_BLOB_USED_AS_KEY = 1073;
	exports.ER_TOO_BIG_FIELDLENGTH = 1074;
	exports.ER_WRONG_AUTO_KEY = 1075;
	exports.ER_READY = 1076;
	exports.ER_NORMAL_SHUTDOWN = 1077;
	exports.ER_GOT_SIGNAL = 1078;
	exports.ER_SHUTDOWN_COMPLETE = 1079;
	exports.ER_FORCING_CLOSE = 1080;
	exports.ER_IPSOCK_ERROR = 1081;
	exports.ER_NO_SUCH_INDEX = 1082;
	exports.ER_WRONG_FIELD_TERMINATORS = 1083;
	exports.ER_BLOBS_AND_NO_TERMINATED = 1084;
	exports.ER_TEXTFILE_NOT_READABLE = 1085;
	exports.ER_FILE_EXISTS_ERROR = 1086;
	exports.ER_LOAD_INFO = 1087;
	exports.ER_ALTER_INFO = 1088;
	exports.ER_WRONG_SUB_KEY = 1089;
	exports.ER_CANT_REMOVE_ALL_FIELDS = 1090;
	exports.ER_CANT_DROP_FIELD_OR_KEY = 1091;
	exports.ER_INSERT_INFO = 1092;
	exports.ER_UPDATE_TABLE_USED = 1093;
	exports.ER_NO_SUCH_THREAD = 1094;
	exports.ER_KILL_DENIED_ERROR = 1095;
	exports.ER_NO_TABLES_USED = 1096;
	exports.ER_TOO_BIG_SET = 1097;
	exports.ER_NO_UNIQUE_LOGFILE = 1098;
	exports.ER_TABLE_NOT_LOCKED_FOR_WRITE = 1099;
	exports.ER_TABLE_NOT_LOCKED = 1100;
	exports.ER_BLOB_CANT_HAVE_DEFAULT = 1101;
	exports.ER_WRONG_DB_NAME = 1102;
	exports.ER_WRONG_TABLE_NAME = 1103;
	exports.ER_TOO_BIG_SELECT = 1104;
	exports.ER_UNKNOWN_ERROR = 1105;
	exports.ER_UNKNOWN_PROCEDURE = 1106;
	exports.ER_WRONG_PARAMCOUNT_TO_PROCEDURE = 1107;
	exports.ER_WRONG_PARAMETERS_TO_PROCEDURE = 1108;
	exports.ER_UNKNOWN_TABLE = 1109;
	exports.ER_FIELD_SPECIFIED_TWICE = 1110;
	exports.ER_INVALID_GROUP_FUNC_USE = 1111;
	exports.ER_UNSUPPORTED_EXTENSION = 1112;
	exports.ER_TABLE_MUST_HAVE_COLUMNS = 1113;
	exports.ER_RECORD_FILE_FULL = 1114;
	exports.ER_UNKNOWN_CHARACTER_SET = 1115;
	exports.ER_TOO_MANY_TABLES = 1116;
	exports.ER_TOO_MANY_FIELDS = 1117;
	exports.ER_TOO_BIG_ROWSIZE = 1118;
	exports.ER_STACK_OVERRUN = 1119;
	exports.ER_WRONG_OUTER_JOIN = 1120;
	exports.ER_NULL_COLUMN_IN_INDEX = 1121;
	exports.ER_CANT_FIND_UDF = 1122;
	exports.ER_CANT_INITIALIZE_UDF = 1123;
	exports.ER_UDF_NO_PATHS = 1124;
	exports.ER_UDF_EXISTS = 1125;
	exports.ER_CANT_OPEN_LIBRARY = 1126;
	exports.ER_CANT_FIND_DL_ENTRY = 1127;
	exports.ER_FUNCTION_NOT_DEFINED = 1128;
	exports.ER_HOST_IS_BLOCKED = 1129;
	exports.ER_HOST_NOT_PRIVILEGED = 1130;
	exports.ER_PASSWORD_ANONYMOUS_USER = 1131;
	exports.ER_PASSWORD_NOT_ALLOWED = 1132;
	exports.ER_PASSWORD_NO_MATCH = 1133;
	exports.ER_UPDATE_INFO = 1134;
	exports.ER_CANT_CREATE_THREAD = 1135;
	exports.ER_WRONG_VALUE_COUNT_ON_ROW = 1136;
	exports.ER_CANT_REOPEN_TABLE = 1137;
	exports.ER_INVALID_USE_OF_NULL = 1138;
	exports.ER_REGEXP_ERROR = 1139;
	exports.ER_MIX_OF_GROUP_FUNC_AND_FIELDS = 1140;
	exports.ER_NONEXISTING_GRANT = 1141;
	exports.ER_TABLEACCESS_DENIED_ERROR = 1142;
	exports.ER_COLUMNACCESS_DENIED_ERROR = 1143;
	exports.ER_ILLEGAL_GRANT_FOR_TABLE = 1144;
	exports.ER_GRANT_WRONG_HOST_OR_USER = 1145;
	exports.ER_NO_SUCH_TABLE = 1146;
	exports.ER_NONEXISTING_TABLE_GRANT = 1147;
	exports.ER_NOT_ALLOWED_COMMAND = 1148;
	exports.ER_SYNTAX_ERROR = 1149;
	exports.ER_UNUSED1 = 1150;
	exports.ER_UNUSED2 = 1151;
	exports.ER_ABORTING_CONNECTION = 1152;
	exports.ER_NET_PACKET_TOO_LARGE = 1153;
	exports.ER_NET_READ_ERROR_FROM_PIPE = 1154;
	exports.ER_NET_FCNTL_ERROR = 1155;
	exports.ER_NET_PACKETS_OUT_OF_ORDER = 1156;
	exports.ER_NET_UNCOMPRESS_ERROR = 1157;
	exports.ER_NET_READ_ERROR = 1158;
	exports.ER_NET_READ_INTERRUPTED = 1159;
	exports.ER_NET_ERROR_ON_WRITE = 1160;
	exports.ER_NET_WRITE_INTERRUPTED = 1161;
	exports.ER_TOO_LONG_STRING = 1162;
	exports.ER_TABLE_CANT_HANDLE_BLOB = 1163;
	exports.ER_TABLE_CANT_HANDLE_AUTO_INCREMENT = 1164;
	exports.ER_UNUSED3 = 1165;
	exports.ER_WRONG_COLUMN_NAME = 1166;
	exports.ER_WRONG_KEY_COLUMN = 1167;
	exports.ER_WRONG_MRG_TABLE = 1168;
	exports.ER_DUP_UNIQUE = 1169;
	exports.ER_BLOB_KEY_WITHOUT_LENGTH = 1170;
	exports.ER_PRIMARY_CANT_HAVE_NULL = 1171;
	exports.ER_TOO_MANY_ROWS = 1172;
	exports.ER_REQUIRES_PRIMARY_KEY = 1173;
	exports.ER_NO_RAID_COMPILED = 1174;
	exports.ER_UPDATE_WITHOUT_KEY_IN_SAFE_MODE = 1175;
	exports.ER_KEY_DOES_NOT_EXITS = 1176;
	exports.ER_CHECK_NO_SUCH_TABLE = 1177;
	exports.ER_CHECK_NOT_IMPLEMENTED = 1178;
	exports.ER_CANT_DO_THIS_DURING_AN_TRANSACTION = 1179;
	exports.ER_ERROR_DURING_COMMIT = 1180;
	exports.ER_ERROR_DURING_ROLLBACK = 1181;
	exports.ER_ERROR_DURING_FLUSH_LOGS = 1182;
	exports.ER_ERROR_DURING_CHECKPOINT = 1183;
	exports.ER_NEW_ABORTING_CONNECTION = 1184;
	exports.ER_DUMP_NOT_IMPLEMENTED = 1185;
	exports.ER_FLUSH_MASTER_BINLOG_CLOSED = 1186;
	exports.ER_INDEX_REBUILD = 1187;
	exports.ER_SOURCE = 1188;
	exports.ER_SOURCE_NET_READ = 1189;
	exports.ER_SOURCE_NET_WRITE = 1190;
	exports.ER_FT_MATCHING_KEY_NOT_FOUND = 1191;
	exports.ER_LOCK_OR_ACTIVE_TRANSACTION = 1192;
	exports.ER_UNKNOWN_SYSTEM_VARIABLE = 1193;
	exports.ER_CRASHED_ON_USAGE = 1194;
	exports.ER_CRASHED_ON_REPAIR = 1195;
	exports.ER_WARNING_NOT_COMPLETE_ROLLBACK = 1196;
	exports.ER_TRANS_CACHE_FULL = 1197;
	exports.ER_SLAVE_MUST_STOP = 1198;
	exports.ER_REPLICA_NOT_RUNNING = 1199;
	exports.ER_BAD_REPLICA = 1200;
	exports.ER_CONNECTION_METADATA = 1201;
	exports.ER_REPLICA_THREAD = 1202;
	exports.ER_TOO_MANY_USER_CONNECTIONS = 1203;
	exports.ER_SET_CONSTANTS_ONLY = 1204;
	exports.ER_LOCK_WAIT_TIMEOUT = 1205;
	exports.ER_LOCK_TABLE_FULL = 1206;
	exports.ER_READ_ONLY_TRANSACTION = 1207;
	exports.ER_DROP_DB_WITH_READ_LOCK = 1208;
	exports.ER_CREATE_DB_WITH_READ_LOCK = 1209;
	exports.ER_WRONG_ARGUMENTS = 1210;
	exports.ER_NO_PERMISSION_TO_CREATE_USER = 1211;
	exports.ER_UNION_TABLES_IN_DIFFERENT_DIR = 1212;
	exports.ER_LOCK_DEADLOCK = 1213;
	exports.ER_TABLE_CANT_HANDLE_FT = 1214;
	exports.ER_CANNOT_ADD_FOREIGN = 1215;
	exports.ER_NO_REFERENCED_ROW = 1216;
	exports.ER_ROW_IS_REFERENCED = 1217;
	exports.ER_CONNECT_TO_SOURCE = 1218;
	exports.ER_QUERY_ON_MASTER = 1219;
	exports.ER_ERROR_WHEN_EXECUTING_COMMAND = 1220;
	exports.ER_WRONG_USAGE = 1221;
	exports.ER_WRONG_NUMBER_OF_COLUMNS_IN_SELECT = 1222;
	exports.ER_CANT_UPDATE_WITH_READLOCK = 1223;
	exports.ER_MIXING_NOT_ALLOWED = 1224;
	exports.ER_DUP_ARGUMENT = 1225;
	exports.ER_USER_LIMIT_REACHED = 1226;
	exports.ER_SPECIFIC_ACCESS_DENIED_ERROR = 1227;
	exports.ER_LOCAL_VARIABLE = 1228;
	exports.ER_GLOBAL_VARIABLE = 1229;
	exports.ER_NO_DEFAULT = 1230;
	exports.ER_WRONG_VALUE_FOR_VAR = 1231;
	exports.ER_WRONG_TYPE_FOR_VAR = 1232;
	exports.ER_VAR_CANT_BE_READ = 1233;
	exports.ER_CANT_USE_OPTION_HERE = 1234;
	exports.ER_NOT_SUPPORTED_YET = 1235;
	exports.ER_SOURCE_FATAL_ERROR_READING_BINLOG = 1236;
	exports.ER_REPLICA_IGNORED_TABLE = 1237;
	exports.ER_INCORRECT_GLOBAL_LOCAL_VAR = 1238;
	exports.ER_WRONG_FK_DEF = 1239;
	exports.ER_KEY_REF_DO_NOT_MATCH_TABLE_REF = 1240;
	exports.ER_OPERAND_COLUMNS = 1241;
	exports.ER_SUBQUERY_NO_1_ROW = 1242;
	exports.ER_UNKNOWN_STMT_HANDLER = 1243;
	exports.ER_CORRUPT_HELP_DB = 1244;
	exports.ER_CYCLIC_REFERENCE = 1245;
	exports.ER_AUTO_CONVERT = 1246;
	exports.ER_ILLEGAL_REFERENCE = 1247;
	exports.ER_DERIVED_MUST_HAVE_ALIAS = 1248;
	exports.ER_SELECT_REDUCED = 1249;
	exports.ER_TABLENAME_NOT_ALLOWED_HERE = 1250;
	exports.ER_NOT_SUPPORTED_AUTH_MODE = 1251;
	exports.ER_SPATIAL_CANT_HAVE_NULL = 1252;
	exports.ER_COLLATION_CHARSET_MISMATCH = 1253;
	exports.ER_SLAVE_WAS_RUNNING = 1254;
	exports.ER_SLAVE_WAS_NOT_RUNNING = 1255;
	exports.ER_TOO_BIG_FOR_UNCOMPRESS = 1256;
	exports.ER_ZLIB_Z_MEM_ERROR = 1257;
	exports.ER_ZLIB_Z_BUF_ERROR = 1258;
	exports.ER_ZLIB_Z_DATA_ERROR = 1259;
	exports.ER_CUT_VALUE_GROUP_CONCAT = 1260;
	exports.ER_WARN_TOO_FEW_RECORDS = 1261;
	exports.ER_WARN_TOO_MANY_RECORDS = 1262;
	exports.ER_WARN_NULL_TO_NOTNULL = 1263;
	exports.ER_WARN_DATA_OUT_OF_RANGE = 1264;
	exports.WARN_DATA_TRUNCATED = 1265;
	exports.ER_WARN_USING_OTHER_HANDLER = 1266;
	exports.ER_CANT_AGGREGATE_2COLLATIONS = 1267;
	exports.ER_DROP_USER = 1268;
	exports.ER_REVOKE_GRANTS = 1269;
	exports.ER_CANT_AGGREGATE_3COLLATIONS = 1270;
	exports.ER_CANT_AGGREGATE_NCOLLATIONS = 1271;
	exports.ER_VARIABLE_IS_NOT_STRUCT = 1272;
	exports.ER_UNKNOWN_COLLATION = 1273;
	exports.ER_REPLICA_IGNORED_SSL_PARAMS = 1274;
	exports.ER_SERVER_IS_IN_SECURE_AUTH_MODE = 1275;
	exports.ER_WARN_FIELD_RESOLVED = 1276;
	exports.ER_BAD_REPLICA_UNTIL_COND = 1277;
	exports.ER_MISSING_SKIP_REPLICA = 1278;
	exports.ER_UNTIL_COND_IGNORED = 1279;
	exports.ER_WRONG_NAME_FOR_INDEX = 1280;
	exports.ER_WRONG_NAME_FOR_CATALOG = 1281;
	exports.ER_WARN_QC_RESIZE = 1282;
	exports.ER_BAD_FT_COLUMN = 1283;
	exports.ER_UNKNOWN_KEY_CACHE = 1284;
	exports.ER_WARN_HOSTNAME_WONT_WORK = 1285;
	exports.ER_UNKNOWN_STORAGE_ENGINE = 1286;
	exports.ER_WARN_DEPRECATED_SYNTAX = 1287;
	exports.ER_NON_UPDATABLE_TABLE = 1288;
	exports.ER_FEATURE_DISABLED = 1289;
	exports.ER_OPTION_PREVENTS_STATEMENT = 1290;
	exports.ER_DUPLICATED_VALUE_IN_TYPE = 1291;
	exports.ER_TRUNCATED_WRONG_VALUE = 1292;
	exports.ER_TOO_MUCH_AUTO_TIMESTAMP_COLS = 1293;
	exports.ER_INVALID_ON_UPDATE = 1294;
	exports.ER_UNSUPPORTED_PS = 1295;
	exports.ER_GET_ERRMSG = 1296;
	exports.ER_GET_TEMPORARY_ERRMSG = 1297;
	exports.ER_UNKNOWN_TIME_ZONE = 1298;
	exports.ER_WARN_INVALID_TIMESTAMP = 1299;
	exports.ER_INVALID_CHARACTER_STRING = 1300;
	exports.ER_WARN_ALLOWED_PACKET_OVERFLOWED = 1301;
	exports.ER_CONFLICTING_DECLARATIONS = 1302;
	exports.ER_SP_NO_RECURSIVE_CREATE = 1303;
	exports.ER_SP_ALREADY_EXISTS = 1304;
	exports.ER_SP_DOES_NOT_EXIST = 1305;
	exports.ER_SP_DROP_FAILED = 1306;
	exports.ER_SP_STORE_FAILED = 1307;
	exports.ER_SP_LILABEL_MISMATCH = 1308;
	exports.ER_SP_LABEL_REDEFINE = 1309;
	exports.ER_SP_LABEL_MISMATCH = 1310;
	exports.ER_SP_UNINIT_VAR = 1311;
	exports.ER_SP_BADSELECT = 1312;
	exports.ER_SP_BADRETURN = 1313;
	exports.ER_SP_BADSTATEMENT = 1314;
	exports.ER_UPDATE_LOG_DEPRECATED_IGNORED = 1315;
	exports.ER_UPDATE_LOG_DEPRECATED_TRANSLATED = 1316;
	exports.ER_QUERY_INTERRUPTED = 1317;
	exports.ER_SP_WRONG_NO_OF_ARGS = 1318;
	exports.ER_SP_COND_MISMATCH = 1319;
	exports.ER_SP_NORETURN = 1320;
	exports.ER_SP_NORETURNEND = 1321;
	exports.ER_SP_BAD_CURSOR_QUERY = 1322;
	exports.ER_SP_BAD_CURSOR_SELECT = 1323;
	exports.ER_SP_CURSOR_MISMATCH = 1324;
	exports.ER_SP_CURSOR_ALREADY_OPEN = 1325;
	exports.ER_SP_CURSOR_NOT_OPEN = 1326;
	exports.ER_SP_UNDECLARED_VAR = 1327;
	exports.ER_SP_WRONG_NO_OF_FETCH_ARGS = 1328;
	exports.ER_SP_FETCH_NO_DATA = 1329;
	exports.ER_SP_DUP_PARAM = 1330;
	exports.ER_SP_DUP_VAR = 1331;
	exports.ER_SP_DUP_COND = 1332;
	exports.ER_SP_DUP_CURS = 1333;
	exports.ER_SP_CANT_ALTER = 1334;
	exports.ER_SP_SUBSELECT_NYI = 1335;
	exports.ER_STMT_NOT_ALLOWED_IN_SF_OR_TRG = 1336;
	exports.ER_SP_VARCOND_AFTER_CURSHNDLR = 1337;
	exports.ER_SP_CURSOR_AFTER_HANDLER = 1338;
	exports.ER_SP_CASE_NOT_FOUND = 1339;
	exports.ER_FPARSER_TOO_BIG_FILE = 1340;
	exports.ER_FPARSER_BAD_HEADER = 1341;
	exports.ER_FPARSER_EOF_IN_COMMENT = 1342;
	exports.ER_FPARSER_ERROR_IN_PARAMETER = 1343;
	exports.ER_FPARSER_EOF_IN_UNKNOWN_PARAMETER = 1344;
	exports.ER_VIEW_NO_EXPLAIN = 1345;
	exports.ER_FRM_UNKNOWN_TYPE = 1346;
	exports.ER_WRONG_OBJECT = 1347;
	exports.ER_NONUPDATEABLE_COLUMN = 1348;
	exports.ER_VIEW_SELECT_DERIVED = 1349;
	exports.ER_VIEW_SELECT_CLAUSE = 1350;
	exports.ER_VIEW_SELECT_VARIABLE = 1351;
	exports.ER_VIEW_SELECT_TMPTABLE = 1352;
	exports.ER_VIEW_WRONG_LIST = 1353;
	exports.ER_WARN_VIEW_MERGE = 1354;
	exports.ER_WARN_VIEW_WITHOUT_KEY = 1355;
	exports.ER_VIEW_INVALID = 1356;
	exports.ER_SP_NO_DROP_SP = 1357;
	exports.ER_SP_GOTO_IN_HNDLR = 1358;
	exports.ER_TRG_ALREADY_EXISTS = 1359;
	exports.ER_TRG_DOES_NOT_EXIST = 1360;
	exports.ER_TRG_ON_VIEW_OR_TEMP_TABLE = 1361;
	exports.ER_TRG_CANT_CHANGE_ROW = 1362;
	exports.ER_TRG_NO_SUCH_ROW_IN_TRG = 1363;
	exports.ER_NO_DEFAULT_FOR_FIELD = 1364;
	exports.ER_DIVISION_BY_ZERO = 1365;
	exports.ER_TRUNCATED_WRONG_VALUE_FOR_FIELD = 1366;
	exports.ER_ILLEGAL_VALUE_FOR_TYPE = 1367;
	exports.ER_VIEW_NONUPD_CHECK = 1368;
	exports.ER_VIEW_CHECK_FAILED = 1369;
	exports.ER_PROCACCESS_DENIED_ERROR = 1370;
	exports.ER_RELAY_LOG_FAIL = 1371;
	exports.ER_PASSWD_LENGTH = 1372;
	exports.ER_UNKNOWN_TARGET_BINLOG = 1373;
	exports.ER_IO_ERR_LOG_INDEX_READ = 1374;
	exports.ER_BINLOG_PURGE_PROHIBITED = 1375;
	exports.ER_FSEEK_FAIL = 1376;
	exports.ER_BINLOG_PURGE_FATAL_ERR = 1377;
	exports.ER_LOG_IN_USE = 1378;
	exports.ER_LOG_PURGE_UNKNOWN_ERR = 1379;
	exports.ER_RELAY_LOG_INIT = 1380;
	exports.ER_NO_BINARY_LOGGING = 1381;
	exports.ER_RESERVED_SYNTAX = 1382;
	exports.ER_WSAS_FAILED = 1383;
	exports.ER_DIFF_GROUPS_PROC = 1384;
	exports.ER_NO_GROUP_FOR_PROC = 1385;
	exports.ER_ORDER_WITH_PROC = 1386;
	exports.ER_LOGGING_PROHIBIT_CHANGING_OF = 1387;
	exports.ER_NO_FILE_MAPPING = 1388;
	exports.ER_WRONG_MAGIC = 1389;
	exports.ER_PS_MANY_PARAM = 1390;
	exports.ER_KEY_PART_0 = 1391;
	exports.ER_VIEW_CHECKSUM = 1392;
	exports.ER_VIEW_MULTIUPDATE = 1393;
	exports.ER_VIEW_NO_INSERT_FIELD_LIST = 1394;
	exports.ER_VIEW_DELETE_MERGE_VIEW = 1395;
	exports.ER_CANNOT_USER = 1396;
	exports.ER_XAER_NOTA = 1397;
	exports.ER_XAER_INVAL = 1398;
	exports.ER_XAER_RMFAIL = 1399;
	exports.ER_XAER_OUTSIDE = 1400;
	exports.ER_XAER_RMERR = 1401;
	exports.ER_XA_RBROLLBACK = 1402;
	exports.ER_NONEXISTING_PROC_GRANT = 1403;
	exports.ER_PROC_AUTO_GRANT_FAIL = 1404;
	exports.ER_PROC_AUTO_REVOKE_FAIL = 1405;
	exports.ER_DATA_TOO_LONG = 1406;
	exports.ER_SP_BAD_SQLSTATE = 1407;
	exports.ER_STARTUP = 1408;
	exports.ER_LOAD_FROM_FIXED_SIZE_ROWS_TO_VAR = 1409;
	exports.ER_CANT_CREATE_USER_WITH_GRANT = 1410;
	exports.ER_WRONG_VALUE_FOR_TYPE = 1411;
	exports.ER_TABLE_DEF_CHANGED = 1412;
	exports.ER_SP_DUP_HANDLER = 1413;
	exports.ER_SP_NOT_VAR_ARG = 1414;
	exports.ER_SP_NO_RETSET = 1415;
	exports.ER_CANT_CREATE_GEOMETRY_OBJECT = 1416;
	exports.ER_FAILED_ROUTINE_BREAK_BINLOG = 1417;
	exports.ER_BINLOG_UNSAFE_ROUTINE = 1418;
	exports.ER_BINLOG_CREATE_ROUTINE_NEED_SUPER = 1419;
	exports.ER_EXEC_STMT_WITH_OPEN_CURSOR = 1420;
	exports.ER_STMT_HAS_NO_OPEN_CURSOR = 1421;
	exports.ER_COMMIT_NOT_ALLOWED_IN_SF_OR_TRG = 1422;
	exports.ER_NO_DEFAULT_FOR_VIEW_FIELD = 1423;
	exports.ER_SP_NO_RECURSION = 1424;
	exports.ER_TOO_BIG_SCALE = 1425;
	exports.ER_TOO_BIG_PRECISION = 1426;
	exports.ER_M_BIGGER_THAN_D = 1427;
	exports.ER_WRONG_LOCK_OF_SYSTEM_TABLE = 1428;
	exports.ER_CONNECT_TO_FOREIGN_DATA_SOURCE = 1429;
	exports.ER_QUERY_ON_FOREIGN_DATA_SOURCE = 1430;
	exports.ER_FOREIGN_DATA_SOURCE_DOESNT_EXIST = 1431;
	exports.ER_FOREIGN_DATA_STRING_INVALID_CANT_CREATE = 1432;
	exports.ER_FOREIGN_DATA_STRING_INVALID = 1433;
	exports.ER_CANT_CREATE_FEDERATED_TABLE = 1434;
	exports.ER_TRG_IN_WRONG_SCHEMA = 1435;
	exports.ER_STACK_OVERRUN_NEED_MORE = 1436;
	exports.ER_TOO_LONG_BODY = 1437;
	exports.ER_WARN_CANT_DROP_DEFAULT_KEYCACHE = 1438;
	exports.ER_TOO_BIG_DISPLAYWIDTH = 1439;
	exports.ER_XAER_DUPID = 1440;
	exports.ER_DATETIME_FUNCTION_OVERFLOW = 1441;
	exports.ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG = 1442;
	exports.ER_VIEW_PREVENT_UPDATE = 1443;
	exports.ER_PS_NO_RECURSION = 1444;
	exports.ER_SP_CANT_SET_AUTOCOMMIT = 1445;
	exports.ER_MALFORMED_DEFINER = 1446;
	exports.ER_VIEW_FRM_NO_USER = 1447;
	exports.ER_VIEW_OTHER_USER = 1448;
	exports.ER_NO_SUCH_USER = 1449;
	exports.ER_FORBID_SCHEMA_CHANGE = 1450;
	exports.ER_ROW_IS_REFERENCED_2 = 1451;
	exports.ER_NO_REFERENCED_ROW_2 = 1452;
	exports.ER_SP_BAD_VAR_SHADOW = 1453;
	exports.ER_TRG_NO_DEFINER = 1454;
	exports.ER_OLD_FILE_FORMAT = 1455;
	exports.ER_SP_RECURSION_LIMIT = 1456;
	exports.ER_SP_PROC_TABLE_CORRUPT = 1457;
	exports.ER_SP_WRONG_NAME = 1458;
	exports.ER_TABLE_NEEDS_UPGRADE = 1459;
	exports.ER_SP_NO_AGGREGATE = 1460;
	exports.ER_MAX_PREPARED_STMT_COUNT_REACHED = 1461;
	exports.ER_VIEW_RECURSIVE = 1462;
	exports.ER_NON_GROUPING_FIELD_USED = 1463;
	exports.ER_TABLE_CANT_HANDLE_SPKEYS = 1464;
	exports.ER_NO_TRIGGERS_ON_SYSTEM_SCHEMA = 1465;
	exports.ER_REMOVED_SPACES = 1466;
	exports.ER_AUTOINC_READ_FAILED = 1467;
	exports.ER_USERNAME = 1468;
	exports.ER_HOSTNAME = 1469;
	exports.ER_WRONG_STRING_LENGTH = 1470;
	exports.ER_NON_INSERTABLE_TABLE = 1471;
	exports.ER_ADMIN_WRONG_MRG_TABLE = 1472;
	exports.ER_TOO_HIGH_LEVEL_OF_NESTING_FOR_SELECT = 1473;
	exports.ER_NAME_BECOMES_EMPTY = 1474;
	exports.ER_AMBIGUOUS_FIELD_TERM = 1475;
	exports.ER_FOREIGN_SERVER_EXISTS = 1476;
	exports.ER_FOREIGN_SERVER_DOESNT_EXIST = 1477;
	exports.ER_ILLEGAL_HA_CREATE_OPTION = 1478;
	exports.ER_PARTITION_REQUIRES_VALUES_ERROR = 1479;
	exports.ER_PARTITION_WRONG_VALUES_ERROR = 1480;
	exports.ER_PARTITION_MAXVALUE_ERROR = 1481;
	exports.ER_PARTITION_SUBPARTITION_ERROR = 1482;
	exports.ER_PARTITION_SUBPART_MIX_ERROR = 1483;
	exports.ER_PARTITION_WRONG_NO_PART_ERROR = 1484;
	exports.ER_PARTITION_WRONG_NO_SUBPART_ERROR = 1485;
	exports.ER_WRONG_EXPR_IN_PARTITION_FUNC_ERROR = 1486;
	exports.ER_NO_CONST_EXPR_IN_RANGE_OR_LIST_ERROR = 1487;
	exports.ER_FIELD_NOT_FOUND_PART_ERROR = 1488;
	exports.ER_LIST_OF_FIELDS_ONLY_IN_HASH_ERROR = 1489;
	exports.ER_INCONSISTENT_PARTITION_INFO_ERROR = 1490;
	exports.ER_PARTITION_FUNC_NOT_ALLOWED_ERROR = 1491;
	exports.ER_PARTITIONS_MUST_BE_DEFINED_ERROR = 1492;
	exports.ER_RANGE_NOT_INCREASING_ERROR = 1493;
	exports.ER_INCONSISTENT_TYPE_OF_FUNCTIONS_ERROR = 1494;
	exports.ER_MULTIPLE_DEF_CONST_IN_LIST_PART_ERROR = 1495;
	exports.ER_PARTITION_ENTRY_ERROR = 1496;
	exports.ER_MIX_HANDLER_ERROR = 1497;
	exports.ER_PARTITION_NOT_DEFINED_ERROR = 1498;
	exports.ER_TOO_MANY_PARTITIONS_ERROR = 1499;
	exports.ER_SUBPARTITION_ERROR = 1500;
	exports.ER_CANT_CREATE_HANDLER_FILE = 1501;
	exports.ER_BLOB_FIELD_IN_PART_FUNC_ERROR = 1502;
	exports.ER_UNIQUE_KEY_NEED_ALL_FIELDS_IN_PF = 1503;
	exports.ER_NO_PARTS_ERROR = 1504;
	exports.ER_PARTITION_MGMT_ON_NONPARTITIONED = 1505;
	exports.ER_FOREIGN_KEY_ON_PARTITIONED = 1506;
	exports.ER_DROP_PARTITION_NON_EXISTENT = 1507;
	exports.ER_DROP_LAST_PARTITION = 1508;
	exports.ER_COALESCE_ONLY_ON_HASH_PARTITION = 1509;
	exports.ER_REORG_HASH_ONLY_ON_SAME_NO = 1510;
	exports.ER_REORG_NO_PARAM_ERROR = 1511;
	exports.ER_ONLY_ON_RANGE_LIST_PARTITION = 1512;
	exports.ER_ADD_PARTITION_SUBPART_ERROR = 1513;
	exports.ER_ADD_PARTITION_NO_NEW_PARTITION = 1514;
	exports.ER_COALESCE_PARTITION_NO_PARTITION = 1515;
	exports.ER_REORG_PARTITION_NOT_EXIST = 1516;
	exports.ER_SAME_NAME_PARTITION = 1517;
	exports.ER_NO_BINLOG_ERROR = 1518;
	exports.ER_CONSECUTIVE_REORG_PARTITIONS = 1519;
	exports.ER_REORG_OUTSIDE_RANGE = 1520;
	exports.ER_PARTITION_FUNCTION_FAILURE = 1521;
	exports.ER_PART_STATE_ERROR = 1522;
	exports.ER_LIMITED_PART_RANGE = 1523;
	exports.ER_PLUGIN_IS_NOT_LOADED = 1524;
	exports.ER_WRONG_VALUE = 1525;
	exports.ER_NO_PARTITION_FOR_GIVEN_VALUE = 1526;
	exports.ER_FILEGROUP_OPTION_ONLY_ONCE = 1527;
	exports.ER_CREATE_FILEGROUP_FAILED = 1528;
	exports.ER_DROP_FILEGROUP_FAILED = 1529;
	exports.ER_TABLESPACE_AUTO_EXTEND_ERROR = 1530;
	exports.ER_WRONG_SIZE_NUMBER = 1531;
	exports.ER_SIZE_OVERFLOW_ERROR = 1532;
	exports.ER_ALTER_FILEGROUP_FAILED = 1533;
	exports.ER_BINLOG_ROW_LOGGING_FAILED = 1534;
	exports.ER_BINLOG_ROW_WRONG_TABLE_DEF = 1535;
	exports.ER_BINLOG_ROW_RBR_TO_SBR = 1536;
	exports.ER_EVENT_ALREADY_EXISTS = 1537;
	exports.ER_EVENT_STORE_FAILED = 1538;
	exports.ER_EVENT_DOES_NOT_EXIST = 1539;
	exports.ER_EVENT_CANT_ALTER = 1540;
	exports.ER_EVENT_DROP_FAILED = 1541;
	exports.ER_EVENT_INTERVAL_NOT_POSITIVE_OR_TOO_BIG = 1542;
	exports.ER_EVENT_ENDS_BEFORE_STARTS = 1543;
	exports.ER_EVENT_EXEC_TIME_IN_THE_PAST = 1544;
	exports.ER_EVENT_OPEN_TABLE_FAILED = 1545;
	exports.ER_EVENT_NEITHER_M_EXPR_NOR_M_AT = 1546;
	exports.ER_COL_COUNT_DOESNT_MATCH_CORRUPTED = 1547;
	exports.ER_CANNOT_LOAD_FROM_TABLE = 1548;
	exports.ER_EVENT_CANNOT_DELETE = 1549;
	exports.ER_EVENT_COMPILE_ERROR = 1550;
	exports.ER_EVENT_SAME_NAME = 1551;
	exports.ER_EVENT_DATA_TOO_LONG = 1552;
	exports.ER_DROP_INDEX_FK = 1553;
	exports.ER_WARN_DEPRECATED_SYNTAX_WITH_VER = 1554;
	exports.ER_CANT_WRITE_LOCK_LOG_TABLE = 1555;
	exports.ER_CANT_LOCK_LOG_TABLE = 1556;
	exports.ER_FOREIGN_DUPLICATE_KEY = 1557;
	exports.ER_COL_COUNT_DOESNT_MATCH_PLEASE_UPDATE = 1558;
	exports.ER_TEMP_TABLE_PREVENTS_SWITCH_OUT_OF_RBR = 1559;
	exports.ER_STORED_FUNCTION_PREVENTS_SWITCH_BINLOG_FORMAT = 1560;
	exports.ER_NDB_CANT_SWITCH_BINLOG_FORMAT = 1561;
	exports.ER_PARTITION_NO_TEMPORARY = 1562;
	exports.ER_PARTITION_CONST_DOMAIN_ERROR = 1563;
	exports.ER_PARTITION_FUNCTION_IS_NOT_ALLOWED = 1564;
	exports.ER_DDL_LOG_ERROR = 1565;
	exports.ER_NULL_IN_VALUES_LESS_THAN = 1566;
	exports.ER_WRONG_PARTITION_NAME = 1567;
	exports.ER_CANT_CHANGE_TX_CHARACTERISTICS = 1568;
	exports.ER_DUP_ENTRY_AUTOINCREMENT_CASE = 1569;
	exports.ER_EVENT_MODIFY_QUEUE_ERROR = 1570;
	exports.ER_EVENT_SET_VAR_ERROR = 1571;
	exports.ER_PARTITION_MERGE_ERROR = 1572;
	exports.ER_CANT_ACTIVATE_LOG = 1573;
	exports.ER_RBR_NOT_AVAILABLE = 1574;
	exports.ER_BASE64_DECODE_ERROR = 1575;
	exports.ER_EVENT_RECURSION_FORBIDDEN = 1576;
	exports.ER_EVENTS_DB_ERROR = 1577;
	exports.ER_ONLY_INTEGERS_ALLOWED = 1578;
	exports.ER_UNSUPORTED_LOG_ENGINE = 1579;
	exports.ER_BAD_LOG_STATEMENT = 1580;
	exports.ER_CANT_RENAME_LOG_TABLE = 1581;
	exports.ER_WRONG_PARAMCOUNT_TO_NATIVE_FCT = 1582;
	exports.ER_WRONG_PARAMETERS_TO_NATIVE_FCT = 1583;
	exports.ER_WRONG_PARAMETERS_TO_STORED_FCT = 1584;
	exports.ER_NATIVE_FCT_NAME_COLLISION = 1585;
	exports.ER_DUP_ENTRY_WITH_KEY_NAME = 1586;
	exports.ER_BINLOG_PURGE_EMFILE = 1587;
	exports.ER_EVENT_CANNOT_CREATE_IN_THE_PAST = 1588;
	exports.ER_EVENT_CANNOT_ALTER_IN_THE_PAST = 1589;
	exports.ER_SLAVE_INCIDENT = 1590;
	exports.ER_NO_PARTITION_FOR_GIVEN_VALUE_SILENT = 1591;
	exports.ER_BINLOG_UNSAFE_STATEMENT = 1592;
	exports.ER_BINLOG_FATAL_ERROR = 1593;
	exports.ER_SLAVE_RELAY_LOG_READ_FAILURE = 1594;
	exports.ER_SLAVE_RELAY_LOG_WRITE_FAILURE = 1595;
	exports.ER_SLAVE_CREATE_EVENT_FAILURE = 1596;
	exports.ER_SLAVE_MASTER_COM_FAILURE = 1597;
	exports.ER_BINLOG_LOGGING_IMPOSSIBLE = 1598;
	exports.ER_VIEW_NO_CREATION_CTX = 1599;
	exports.ER_VIEW_INVALID_CREATION_CTX = 1600;
	exports.ER_SR_INVALID_CREATION_CTX = 1601;
	exports.ER_TRG_CORRUPTED_FILE = 1602;
	exports.ER_TRG_NO_CREATION_CTX = 1603;
	exports.ER_TRG_INVALID_CREATION_CTX = 1604;
	exports.ER_EVENT_INVALID_CREATION_CTX = 1605;
	exports.ER_TRG_CANT_OPEN_TABLE = 1606;
	exports.ER_CANT_CREATE_SROUTINE = 1607;
	exports.ER_NEVER_USED = 1608;
	exports.ER_NO_FORMAT_DESCRIPTION_EVENT_BEFORE_BINLOG_STATEMENT = 1609;
	exports.ER_REPLICA_CORRUPT_EVENT = 1610;
	exports.ER_LOAD_DATA_INVALID_COLUMN = 1611;
	exports.ER_LOG_PURGE_NO_FILE = 1612;
	exports.ER_XA_RBTIMEOUT = 1613;
	exports.ER_XA_RBDEADLOCK = 1614;
	exports.ER_NEED_REPREPARE = 1615;
	exports.ER_DELAYED_NOT_SUPPORTED = 1616;
	exports.WARN_NO_CONNECTION_METADATA = 1617;
	exports.WARN_OPTION_IGNORED = 1618;
	exports.ER_PLUGIN_DELETE_BUILTIN = 1619;
	exports.WARN_PLUGIN_BUSY = 1620;
	exports.ER_VARIABLE_IS_READONLY = 1621;
	exports.ER_WARN_ENGINE_TRANSACTION_ROLLBACK = 1622;
	exports.ER_SLAVE_HEARTBEAT_FAILURE = 1623;
	exports.ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE = 1624;
	exports.ER_NDB_REPLICATION_SCHEMA_ERROR = 1625;
	exports.ER_CONFLICT_FN_PARSE_ERROR = 1626;
	exports.ER_EXCEPTIONS_WRITE_ERROR = 1627;
	exports.ER_TOO_LONG_TABLE_COMMENT = 1628;
	exports.ER_TOO_LONG_FIELD_COMMENT = 1629;
	exports.ER_FUNC_INEXISTENT_NAME_COLLISION = 1630;
	exports.ER_DATABASE_NAME = 1631;
	exports.ER_TABLE_NAME = 1632;
	exports.ER_PARTITION_NAME = 1633;
	exports.ER_SUBPARTITION_NAME = 1634;
	exports.ER_TEMPORARY_NAME = 1635;
	exports.ER_RENAMED_NAME = 1636;
	exports.ER_TOO_MANY_CONCURRENT_TRXS = 1637;
	exports.WARN_NON_ASCII_SEPARATOR_NOT_IMPLEMENTED = 1638;
	exports.ER_DEBUG_SYNC_TIMEOUT = 1639;
	exports.ER_DEBUG_SYNC_HIT_LIMIT = 1640;
	exports.ER_DUP_SIGNAL_SET = 1641;
	exports.ER_SIGNAL_WARN = 1642;
	exports.ER_SIGNAL_NOT_FOUND = 1643;
	exports.ER_SIGNAL_EXCEPTION = 1644;
	exports.ER_RESIGNAL_WITHOUT_ACTIVE_HANDLER = 1645;
	exports.ER_SIGNAL_BAD_CONDITION_TYPE = 1646;
	exports.WARN_COND_ITEM_TRUNCATED = 1647;
	exports.ER_COND_ITEM_TOO_LONG = 1648;
	exports.ER_UNKNOWN_LOCALE = 1649;
	exports.ER_REPLICA_IGNORE_SERVER_IDS = 1650;
	exports.ER_QUERY_CACHE_DISABLED = 1651;
	exports.ER_SAME_NAME_PARTITION_FIELD = 1652;
	exports.ER_PARTITION_COLUMN_LIST_ERROR = 1653;
	exports.ER_WRONG_TYPE_COLUMN_VALUE_ERROR = 1654;
	exports.ER_TOO_MANY_PARTITION_FUNC_FIELDS_ERROR = 1655;
	exports.ER_MAXVALUE_IN_VALUES_IN = 1656;
	exports.ER_TOO_MANY_VALUES_ERROR = 1657;
	exports.ER_ROW_SINGLE_PARTITION_FIELD_ERROR = 1658;
	exports.ER_FIELD_TYPE_NOT_ALLOWED_AS_PARTITION_FIELD = 1659;
	exports.ER_PARTITION_FIELDS_TOO_LONG = 1660;
	exports.ER_BINLOG_ROW_ENGINE_AND_STMT_ENGINE = 1661;
	exports.ER_BINLOG_ROW_MODE_AND_STMT_ENGINE = 1662;
	exports.ER_BINLOG_UNSAFE_AND_STMT_ENGINE = 1663;
	exports.ER_BINLOG_ROW_INJECTION_AND_STMT_ENGINE = 1664;
	exports.ER_BINLOG_STMT_MODE_AND_ROW_ENGINE = 1665;
	exports.ER_BINLOG_ROW_INJECTION_AND_STMT_MODE = 1666;
	exports.ER_BINLOG_MULTIPLE_ENGINES_AND_SELF_LOGGING_ENGINE = 1667;
	exports.ER_BINLOG_UNSAFE_LIMIT = 1668;
	exports.ER_UNUSED4 = 1669;
	exports.ER_BINLOG_UNSAFE_SYSTEM_TABLE = 1670;
	exports.ER_BINLOG_UNSAFE_AUTOINC_COLUMNS = 1671;
	exports.ER_BINLOG_UNSAFE_UDF = 1672;
	exports.ER_BINLOG_UNSAFE_SYSTEM_VARIABLE = 1673;
	exports.ER_BINLOG_UNSAFE_SYSTEM_FUNCTION = 1674;
	exports.ER_BINLOG_UNSAFE_NONTRANS_AFTER_TRANS = 1675;
	exports.ER_MESSAGE_AND_STATEMENT = 1676;
	exports.ER_SLAVE_CONVERSION_FAILED = 1677;
	exports.ER_REPLICA_CANT_CREATE_CONVERSION = 1678;
	exports.ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_BINLOG_FORMAT = 1679;
	exports.ER_PATH_LENGTH = 1680;
	exports.ER_WARN_DEPRECATED_SYNTAX_NO_REPLACEMENT = 1681;
	exports.ER_WRONG_NATIVE_TABLE_STRUCTURE = 1682;
	exports.ER_WRONG_PERFSCHEMA_USAGE = 1683;
	exports.ER_WARN_I_S_SKIPPED_TABLE = 1684;
	exports.ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_BINLOG_DIRECT = 1685;
	exports.ER_STORED_FUNCTION_PREVENTS_SWITCH_BINLOG_DIRECT = 1686;
	exports.ER_SPATIAL_MUST_HAVE_GEOM_COL = 1687;
	exports.ER_TOO_LONG_INDEX_COMMENT = 1688;
	exports.ER_LOCK_ABORTED = 1689;
	exports.ER_DATA_OUT_OF_RANGE = 1690;
	exports.ER_WRONG_SPVAR_TYPE_IN_LIMIT = 1691;
	exports.ER_BINLOG_UNSAFE_MULTIPLE_ENGINES_AND_SELF_LOGGING_ENGINE = 1692;
	exports.ER_BINLOG_UNSAFE_MIXED_STATEMENT = 1693;
	exports.ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_SQL_LOG_BIN = 1694;
	exports.ER_STORED_FUNCTION_PREVENTS_SWITCH_SQL_LOG_BIN = 1695;
	exports.ER_FAILED_READ_FROM_PAR_FILE = 1696;
	exports.ER_VALUES_IS_NOT_INT_TYPE_ERROR = 1697;
	exports.ER_ACCESS_DENIED_NO_PASSWORD_ERROR = 1698;
	exports.ER_SET_PASSWORD_AUTH_PLUGIN = 1699;
	exports.ER_GRANT_PLUGIN_USER_EXISTS = 1700;
	exports.ER_TRUNCATE_ILLEGAL_FK = 1701;
	exports.ER_PLUGIN_IS_PERMANENT = 1702;
	exports.ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE_MIN = 1703;
	exports.ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE_MAX = 1704;
	exports.ER_STMT_CACHE_FULL = 1705;
	exports.ER_MULTI_UPDATE_KEY_CONFLICT = 1706;
	exports.ER_TABLE_NEEDS_REBUILD = 1707;
	exports.WARN_OPTION_BELOW_LIMIT = 1708;
	exports.ER_INDEX_COLUMN_TOO_LONG = 1709;
	exports.ER_ERROR_IN_TRIGGER_BODY = 1710;
	exports.ER_ERROR_IN_UNKNOWN_TRIGGER_BODY = 1711;
	exports.ER_INDEX_CORRUPT = 1712;
	exports.ER_UNDO_RECORD_TOO_BIG = 1713;
	exports.ER_BINLOG_UNSAFE_INSERT_IGNORE_SELECT = 1714;
	exports.ER_BINLOG_UNSAFE_INSERT_SELECT_UPDATE = 1715;
	exports.ER_BINLOG_UNSAFE_REPLACE_SELECT = 1716;
	exports.ER_BINLOG_UNSAFE_CREATE_IGNORE_SELECT = 1717;
	exports.ER_BINLOG_UNSAFE_CREATE_REPLACE_SELECT = 1718;
	exports.ER_BINLOG_UNSAFE_UPDATE_IGNORE = 1719;
	exports.ER_PLUGIN_NO_UNINSTALL = 1720;
	exports.ER_PLUGIN_NO_INSTALL = 1721;
	exports.ER_BINLOG_UNSAFE_WRITE_AUTOINC_SELECT = 1722;
	exports.ER_BINLOG_UNSAFE_CREATE_SELECT_AUTOINC = 1723;
	exports.ER_BINLOG_UNSAFE_INSERT_TWO_KEYS = 1724;
	exports.ER_TABLE_IN_FK_CHECK = 1725;
	exports.ER_UNSUPPORTED_ENGINE = 1726;
	exports.ER_BINLOG_UNSAFE_AUTOINC_NOT_FIRST = 1727;
	exports.ER_CANNOT_LOAD_FROM_TABLE_V2 = 1728;
	exports.ER_SOURCE_DELAY_VALUE_OUT_OF_RANGE = 1729;
	exports.ER_ONLY_FD_AND_RBR_EVENTS_ALLOWED_IN_BINLOG_STATEMENT = 1730;
	exports.ER_PARTITION_EXCHANGE_DIFFERENT_OPTION = 1731;
	exports.ER_PARTITION_EXCHANGE_PART_TABLE = 1732;
	exports.ER_PARTITION_EXCHANGE_TEMP_TABLE = 1733;
	exports.ER_PARTITION_INSTEAD_OF_SUBPARTITION = 1734;
	exports.ER_UNKNOWN_PARTITION = 1735;
	exports.ER_TABLES_DIFFERENT_METADATA = 1736;
	exports.ER_ROW_DOES_NOT_MATCH_PARTITION = 1737;
	exports.ER_BINLOG_CACHE_SIZE_GREATER_THAN_MAX = 1738;
	exports.ER_WARN_INDEX_NOT_APPLICABLE = 1739;
	exports.ER_PARTITION_EXCHANGE_FOREIGN_KEY = 1740;
	exports.ER_NO_SUCH_KEY_VALUE = 1741;
	exports.ER_RPL_INFO_DATA_TOO_LONG = 1742;
	exports.ER_NETWORK_READ_EVENT_CHECKSUM_FAILURE = 1743;
	exports.ER_BINLOG_READ_EVENT_CHECKSUM_FAILURE = 1744;
	exports.ER_BINLOG_STMT_CACHE_SIZE_GREATER_THAN_MAX = 1745;
	exports.ER_CANT_UPDATE_TABLE_IN_CREATE_TABLE_SELECT = 1746;
	exports.ER_PARTITION_CLAUSE_ON_NONPARTITIONED = 1747;
	exports.ER_ROW_DOES_NOT_MATCH_GIVEN_PARTITION_SET = 1748;
	exports.ER_NO_SUCH_PARTITION = 1749;
	exports.ER_CHANGE_RPL_INFO_REPOSITORY_FAILURE = 1750;
	exports.ER_WARNING_NOT_COMPLETE_ROLLBACK_WITH_CREATED_TEMP_TABLE = 1751;
	exports.ER_WARNING_NOT_COMPLETE_ROLLBACK_WITH_DROPPED_TEMP_TABLE = 1752;
	exports.ER_MTA_FEATURE_IS_NOT_SUPPORTED = 1753;
	exports.ER_MTA_UPDATED_DBS_GREATER_MAX = 1754;
	exports.ER_MTA_CANT_PARALLEL = 1755;
	exports.ER_MTA_INCONSISTENT_DATA = 1756;
	exports.ER_FULLTEXT_NOT_SUPPORTED_WITH_PARTITIONING = 1757;
	exports.ER_DA_INVALID_CONDITION_NUMBER = 1758;
	exports.ER_INSECURE_PLAIN_TEXT = 1759;
	exports.ER_INSECURE_CHANGE_SOURCE = 1760;
	exports.ER_FOREIGN_DUPLICATE_KEY_WITH_CHILD_INFO = 1761;
	exports.ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO = 1762;
	exports.ER_SQLTHREAD_WITH_SECURE_REPLICA = 1763;
	exports.ER_TABLE_HAS_NO_FT = 1764;
	exports.ER_VARIABLE_NOT_SETTABLE_IN_SF_OR_TRIGGER = 1765;
	exports.ER_VARIABLE_NOT_SETTABLE_IN_TRANSACTION = 1766;
	exports.ER_GTID_NEXT_IS_NOT_IN_GTID_NEXT_LIST = 1767;
	exports.ER_CANT_CHANGE_GTID_NEXT_IN_TRANSACTION = 1768;
	exports.ER_SET_STATEMENT_CANNOT_INVOKE_FUNCTION = 1769;
	exports.ER_GTID_NEXT_CANT_BE_AUTOMATIC_IF_GTID_NEXT_LIST_IS_NON_NULL = 1770;
	exports.ER_SKIPPING_LOGGED_TRANSACTION = 1771;
	exports.ER_MALFORMED_GTID_SET_SPECIFICATION = 1772;
	exports.ER_MALFORMED_GTID_SET_ENCODING = 1773;
	exports.ER_MALFORMED_GTID_SPECIFICATION = 1774;
	exports.ER_GNO_EXHAUSTED = 1775;
	exports.ER_BAD_REPLICA_AUTO_POSITION = 1776;
	exports.ER_AUTO_POSITION_REQUIRES_GTID_MODE_NOT_OFF = 1777;
	exports.ER_CANT_DO_IMPLICIT_COMMIT_IN_TRX_WHEN_GTID_NEXT_IS_SET = 1778;
	exports.ER_GTID_MODE_ON_REQUIRES_ENFORCE_GTID_CONSISTENCY_ON = 1779;
	exports.ER_GTID_MODE_REQUIRES_BINLOG = 1780;
	exports.ER_CANT_SET_GTID_NEXT_TO_GTID_WHEN_GTID_MODE_IS_OFF = 1781;
	exports.ER_CANT_SET_GTID_NEXT_TO_ANONYMOUS_WHEN_GTID_MODE_IS_ON = 1782;
	exports.ER_CANT_SET_GTID_NEXT_LIST_TO_NON_NULL_WHEN_GTID_MODE_IS_OFF = 1783;
	exports.ER_FOUND_GTID_EVENT_WHEN_GTID_MODE_IS_OFF = 1784;
	exports.ER_GTID_UNSAFE_NON_TRANSACTIONAL_TABLE = 1785;
	exports.ER_GTID_UNSAFE_CREATE_SELECT = 1786;
	exports.ER_GTID_UNSAFE_CREATE_DROP_TEMP_TABLE_IN_TRANSACTION = 1787;
	exports.ER_GTID_MODE_CAN_ONLY_CHANGE_ONE_STEP_AT_A_TIME = 1788;
	exports.ER_SOURCE_HAS_PURGED_REQUIRED_GTIDS = 1789;
	exports.ER_CANT_SET_GTID_NEXT_WHEN_OWNING_GTID = 1790;
	exports.ER_UNKNOWN_EXPLAIN_FORMAT = 1791;
	exports.ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION = 1792;
	exports.ER_TOO_LONG_TABLE_PARTITION_COMMENT = 1793;
	exports.ER_REPLICA_CONFIGURATION = 1794;
	exports.ER_INNODB_FT_LIMIT = 1795;
	exports.ER_INNODB_NO_FT_TEMP_TABLE = 1796;
	exports.ER_INNODB_FT_WRONG_DOCID_COLUMN = 1797;
	exports.ER_INNODB_FT_WRONG_DOCID_INDEX = 1798;
	exports.ER_INNODB_ONLINE_LOG_TOO_BIG = 1799;
	exports.ER_UNKNOWN_ALTER_ALGORITHM = 1800;
	exports.ER_UNKNOWN_ALTER_LOCK = 1801;
	exports.ER_MTA_CHANGE_SOURCE_CANT_RUN_WITH_GAPS = 1802;
	exports.ER_MTA_RECOVERY_FAILURE = 1803;
	exports.ER_MTA_RESET_WORKERS = 1804;
	exports.ER_COL_COUNT_DOESNT_MATCH_CORRUPTED_V2 = 1805;
	exports.ER_REPLICA_SILENT_RETRY_TRANSACTION = 1806;
	exports.ER_DISCARD_FK_CHECKS_RUNNING = 1807;
	exports.ER_TABLE_SCHEMA_MISMATCH = 1808;
	exports.ER_TABLE_IN_SYSTEM_TABLESPACE = 1809;
	exports.ER_IO_READ_ERROR = 1810;
	exports.ER_IO_WRITE_ERROR = 1811;
	exports.ER_TABLESPACE_MISSING = 1812;
	exports.ER_TABLESPACE_EXISTS = 1813;
	exports.ER_TABLESPACE_DISCARDED = 1814;
	exports.ER_INTERNAL_ERROR = 1815;
	exports.ER_INNODB_IMPORT_ERROR = 1816;
	exports.ER_INNODB_INDEX_CORRUPT = 1817;
	exports.ER_INVALID_YEAR_COLUMN_LENGTH = 1818;
	exports.ER_NOT_VALID_PASSWORD = 1819;
	exports.ER_MUST_CHANGE_PASSWORD = 1820;
	exports.ER_FK_NO_INDEX_CHILD = 1821;
	exports.ER_FK_NO_INDEX_PARENT = 1822;
	exports.ER_FK_FAIL_ADD_SYSTEM = 1823;
	exports.ER_FK_CANNOT_OPEN_PARENT = 1824;
	exports.ER_FK_INCORRECT_OPTION = 1825;
	exports.ER_FK_DUP_NAME = 1826;
	exports.ER_PASSWORD_FORMAT = 1827;
	exports.ER_FK_COLUMN_CANNOT_DROP = 1828;
	exports.ER_FK_COLUMN_CANNOT_DROP_CHILD = 1829;
	exports.ER_FK_COLUMN_NOT_NULL = 1830;
	exports.ER_DUP_INDEX = 1831;
	exports.ER_FK_COLUMN_CANNOT_CHANGE = 1832;
	exports.ER_FK_COLUMN_CANNOT_CHANGE_CHILD = 1833;
	exports.ER_UNUSED5 = 1834;
	exports.ER_MALFORMED_PACKET = 1835;
	exports.ER_READ_ONLY_MODE = 1836;
	exports.ER_GTID_NEXT_TYPE_UNDEFINED_GTID = 1837;
	exports.ER_VARIABLE_NOT_SETTABLE_IN_SP = 1838;
	exports.ER_CANT_SET_GTID_PURGED_WHEN_GTID_MODE_IS_OFF = 1839;
	exports.ER_CANT_SET_GTID_PURGED_WHEN_GTID_EXECUTED_IS_NOT_EMPTY = 1840;
	exports.ER_CANT_SET_GTID_PURGED_WHEN_OWNED_GTIDS_IS_NOT_EMPTY = 1841;
	exports.ER_GTID_PURGED_WAS_CHANGED = 1842;
	exports.ER_GTID_EXECUTED_WAS_CHANGED = 1843;
	exports.ER_BINLOG_STMT_MODE_AND_NO_REPL_TABLES = 1844;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED = 1845;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON = 1846;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COPY = 1847;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_PARTITION = 1848;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FK_RENAME = 1849;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COLUMN_TYPE = 1850;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FK_CHECK = 1851;
	exports.ER_UNUSED6 = 1852;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_NOPK = 1853;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_AUTOINC = 1854;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_HIDDEN_FTS = 1855;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_CHANGE_FTS = 1856;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FTS = 1857;
	exports.ER_SQL_REPLICA_SKIP_COUNTER_NOT_SETTABLE_IN_GTID_MODE = 1858;
	exports.ER_DUP_UNKNOWN_IN_INDEX = 1859;
	exports.ER_IDENT_CAUSES_TOO_LONG_PATH = 1860;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_NOT_NULL = 1861;
	exports.ER_MUST_CHANGE_PASSWORD_LOGIN = 1862;
	exports.ER_ROW_IN_WRONG_PARTITION = 1863;
	exports.ER_MTA_EVENT_BIGGER_PENDING_JOBS_SIZE_MAX = 1864;
	exports.ER_INNODB_NO_FT_USES_PARSER = 1865;
	exports.ER_BINLOG_LOGICAL_CORRUPTION = 1866;
	exports.ER_WARN_PURGE_LOG_IN_USE = 1867;
	exports.ER_WARN_PURGE_LOG_IS_ACTIVE = 1868;
	exports.ER_AUTO_INCREMENT_CONFLICT = 1869;
	exports.WARN_ON_BLOCKHOLE_IN_RBR = 1870;
	exports.ER_REPLICA_CM_INIT_REPOSITORY = 1871;
	exports.ER_REPLICA_AM_INIT_REPOSITORY = 1872;
	exports.ER_ACCESS_DENIED_CHANGE_USER_ERROR = 1873;
	exports.ER_INNODB_READ_ONLY = 1874;
	exports.ER_STOP_REPLICA_SQL_THREAD_TIMEOUT = 1875;
	exports.ER_STOP_REPLICA_IO_THREAD_TIMEOUT = 1876;
	exports.ER_TABLE_CORRUPT = 1877;
	exports.ER_TEMP_FILE_WRITE_FAILURE = 1878;
	exports.ER_INNODB_FT_AUX_NOT_HEX_ID = 1879;
	exports.ER_OLD_TEMPORALS_UPGRADED = 1880;
	exports.ER_INNODB_FORCED_RECOVERY = 1881;
	exports.ER_AES_INVALID_IV = 1882;
	exports.ER_PLUGIN_CANNOT_BE_UNINSTALLED = 1883;
	exports.ER_GTID_UNSAFE_BINLOG_SPLITTABLE_STATEMENT_AND_ASSIGNED_GTID = 1884;
	exports.ER_REPLICA_HAS_MORE_GTIDS_THAN_SOURCE = 1885;
	exports.ER_MISSING_KEY = 1886;
	exports.WARN_NAMED_PIPE_ACCESS_EVERYONE = 1887;
	exports.ER_FILE_CORRUPT = 3e3;
	exports.ER_ERROR_ON_SOURCE = 3001;
	exports.ER_INCONSISTENT_ERROR = 3002;
	exports.ER_STORAGE_ENGINE_NOT_LOADED = 3003;
	exports.ER_GET_STACKED_DA_WITHOUT_ACTIVE_HANDLER = 3004;
	exports.ER_WARN_LEGACY_SYNTAX_CONVERTED = 3005;
	exports.ER_BINLOG_UNSAFE_FULLTEXT_PLUGIN = 3006;
	exports.ER_CANNOT_DISCARD_TEMPORARY_TABLE = 3007;
	exports.ER_FK_DEPTH_EXCEEDED = 3008;
	exports.ER_COL_COUNT_DOESNT_MATCH_PLEASE_UPDATE_V2 = 3009;
	exports.ER_WARN_TRIGGER_DOESNT_HAVE_CREATED = 3010;
	exports.ER_REFERENCED_TRG_DOES_NOT_EXIST = 3011;
	exports.ER_EXPLAIN_NOT_SUPPORTED = 3012;
	exports.ER_INVALID_FIELD_SIZE = 3013;
	exports.ER_MISSING_HA_CREATE_OPTION = 3014;
	exports.ER_ENGINE_OUT_OF_MEMORY = 3015;
	exports.ER_PASSWORD_EXPIRE_ANONYMOUS_USER = 3016;
	exports.ER_REPLICA_SQL_THREAD_MUST_STOP = 3017;
	exports.ER_NO_FT_MATERIALIZED_SUBQUERY = 3018;
	exports.ER_INNODB_UNDO_LOG_FULL = 3019;
	exports.ER_INVALID_ARGUMENT_FOR_LOGARITHM = 3020;
	exports.ER_REPLICA_CHANNEL_IO_THREAD_MUST_STOP = 3021;
	exports.ER_WARN_OPEN_TEMP_TABLES_MUST_BE_ZERO = 3022;
	exports.ER_WARN_ONLY_SOURCE_LOG_FILE_NO_POS = 3023;
	exports.ER_QUERY_TIMEOUT = 3024;
	exports.ER_NON_RO_SELECT_DISABLE_TIMER = 3025;
	exports.ER_DUP_LIST_ENTRY = 3026;
	exports.ER_SQL_MODE_NO_EFFECT = 3027;
	exports.ER_AGGREGATE_ORDER_FOR_UNION = 3028;
	exports.ER_AGGREGATE_ORDER_NON_AGG_QUERY = 3029;
	exports.ER_REPLICA_WORKER_STOPPED_PREVIOUS_THD_ERROR = 3030;
	exports.ER_DONT_SUPPORT_REPLICA_PRESERVE_COMMIT_ORDER = 3031;
	exports.ER_SERVER_OFFLINE_MODE = 3032;
	exports.ER_GIS_DIFFERENT_SRIDS = 3033;
	exports.ER_GIS_UNSUPPORTED_ARGUMENT = 3034;
	exports.ER_GIS_UNKNOWN_ERROR = 3035;
	exports.ER_GIS_UNKNOWN_EXCEPTION = 3036;
	exports.ER_GIS_INVALID_DATA = 3037;
	exports.ER_BOOST_GEOMETRY_EMPTY_INPUT_EXCEPTION = 3038;
	exports.ER_BOOST_GEOMETRY_CENTROID_EXCEPTION = 3039;
	exports.ER_BOOST_GEOMETRY_OVERLAY_INVALID_INPUT_EXCEPTION = 3040;
	exports.ER_BOOST_GEOMETRY_TURN_INFO_EXCEPTION = 3041;
	exports.ER_BOOST_GEOMETRY_SELF_INTERSECTION_POINT_EXCEPTION = 3042;
	exports.ER_BOOST_GEOMETRY_UNKNOWN_EXCEPTION = 3043;
	exports.ER_STD_BAD_ALLOC_ERROR = 3044;
	exports.ER_STD_DOMAIN_ERROR = 3045;
	exports.ER_STD_LENGTH_ERROR = 3046;
	exports.ER_STD_INVALID_ARGUMENT = 3047;
	exports.ER_STD_OUT_OF_RANGE_ERROR = 3048;
	exports.ER_STD_OVERFLOW_ERROR = 3049;
	exports.ER_STD_RANGE_ERROR = 3050;
	exports.ER_STD_UNDERFLOW_ERROR = 3051;
	exports.ER_STD_LOGIC_ERROR = 3052;
	exports.ER_STD_RUNTIME_ERROR = 3053;
	exports.ER_STD_UNKNOWN_EXCEPTION = 3054;
	exports.ER_GIS_DATA_WRONG_ENDIANESS = 3055;
	exports.ER_CHANGE_SOURCE_PASSWORD_LENGTH = 3056;
	exports.ER_USER_LOCK_WRONG_NAME = 3057;
	exports.ER_USER_LOCK_DEADLOCK = 3058;
	exports.ER_REPLACE_INACCESSIBLE_ROWS = 3059;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_GIS = 3060;
	exports.ER_ILLEGAL_USER_VAR = 3061;
	exports.ER_GTID_MODE_OFF = 3062;
	exports.ER_UNSUPPORTED_BY_REPLICATION_THREAD = 3063;
	exports.ER_INCORRECT_TYPE = 3064;
	exports.ER_FIELD_IN_ORDER_NOT_SELECT = 3065;
	exports.ER_AGGREGATE_IN_ORDER_NOT_SELECT = 3066;
	exports.ER_INVALID_RPL_WILD_TABLE_FILTER_PATTERN = 3067;
	exports.ER_NET_OK_PACKET_TOO_LARGE = 3068;
	exports.ER_INVALID_JSON_DATA = 3069;
	exports.ER_INVALID_GEOJSON_MISSING_MEMBER = 3070;
	exports.ER_INVALID_GEOJSON_WRONG_TYPE = 3071;
	exports.ER_INVALID_GEOJSON_UNSPECIFIED = 3072;
	exports.ER_DIMENSION_UNSUPPORTED = 3073;
	exports.ER_REPLICA_CHANNEL_DOES_NOT_EXIST = 3074;
	exports.ER_SLAVE_MULTIPLE_CHANNELS_HOST_PORT = 3075;
	exports.ER_REPLICA_CHANNEL_NAME_INVALID_OR_TOO_LONG = 3076;
	exports.ER_REPLICA_NEW_CHANNEL_WRONG_REPOSITORY = 3077;
	exports.ER_SLAVE_CHANNEL_DELETE = 3078;
	exports.ER_REPLICA_MULTIPLE_CHANNELS_CMD = 3079;
	exports.ER_REPLICA_MAX_CHANNELS_EXCEEDED = 3080;
	exports.ER_REPLICA_CHANNEL_MUST_STOP = 3081;
	exports.ER_REPLICA_CHANNEL_NOT_RUNNING = 3082;
	exports.ER_REPLICA_CHANNEL_WAS_RUNNING = 3083;
	exports.ER_REPLICA_CHANNEL_WAS_NOT_RUNNING = 3084;
	exports.ER_REPLICA_CHANNEL_SQL_THREAD_MUST_STOP = 3085;
	exports.ER_REPLICA_CHANNEL_SQL_SKIP_COUNTER = 3086;
	exports.ER_WRONG_FIELD_WITH_GROUP_V2 = 3087;
	exports.ER_MIX_OF_GROUP_FUNC_AND_FIELDS_V2 = 3088;
	exports.ER_WARN_DEPRECATED_SYSVAR_UPDATE = 3089;
	exports.ER_WARN_DEPRECATED_SQLMODE = 3090;
	exports.ER_CANNOT_LOG_PARTIAL_DROP_DATABASE_WITH_GTID = 3091;
	exports.ER_GROUP_REPLICATION_CONFIGURATION = 3092;
	exports.ER_GROUP_REPLICATION_RUNNING = 3093;
	exports.ER_GROUP_REPLICATION_APPLIER_INIT_ERROR = 3094;
	exports.ER_GROUP_REPLICATION_STOP_APPLIER_THREAD_TIMEOUT = 3095;
	exports.ER_GROUP_REPLICATION_COMMUNICATION_LAYER_SESSION_ERROR = 3096;
	exports.ER_GROUP_REPLICATION_COMMUNICATION_LAYER_JOIN_ERROR = 3097;
	exports.ER_BEFORE_DML_VALIDATION_ERROR = 3098;
	exports.ER_PREVENTS_VARIABLE_WITHOUT_RBR = 3099;
	exports.ER_RUN_HOOK_ERROR = 3100;
	exports.ER_TRANSACTION_ROLLBACK_DURING_COMMIT = 3101;
	exports.ER_GENERATED_COLUMN_FUNCTION_IS_NOT_ALLOWED = 3102;
	exports.ER_UNSUPPORTED_ALTER_INPLACE_ON_VIRTUAL_COLUMN = 3103;
	exports.ER_WRONG_FK_OPTION_FOR_GENERATED_COLUMN = 3104;
	exports.ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN = 3105;
	exports.ER_UNSUPPORTED_ACTION_ON_GENERATED_COLUMN = 3106;
	exports.ER_GENERATED_COLUMN_NON_PRIOR = 3107;
	exports.ER_DEPENDENT_BY_GENERATED_COLUMN = 3108;
	exports.ER_GENERATED_COLUMN_REF_AUTO_INC = 3109;
	exports.ER_FEATURE_NOT_AVAILABLE = 3110;
	exports.ER_CANT_SET_GTID_MODE = 3111;
	exports.ER_CANT_USE_AUTO_POSITION_WITH_GTID_MODE_OFF = 3112;
	exports.ER_CANT_REPLICATE_ANONYMOUS_WITH_AUTO_POSITION = 3113;
	exports.ER_CANT_REPLICATE_ANONYMOUS_WITH_GTID_MODE_ON = 3114;
	exports.ER_CANT_REPLICATE_GTID_WITH_GTID_MODE_OFF = 3115;
	exports.ER_CANT_ENFORCE_GTID_CONSISTENCY_WITH_ONGOING_GTID_VIOLATING_TX = 3116;
	exports.ER_ENFORCE_GTID_CONSISTENCY_WARN_WITH_ONGOING_GTID_VIOLATING_TX = 3117;
	exports.ER_ACCOUNT_HAS_BEEN_LOCKED = 3118;
	exports.ER_WRONG_TABLESPACE_NAME = 3119;
	exports.ER_TABLESPACE_IS_NOT_EMPTY = 3120;
	exports.ER_WRONG_FILE_NAME = 3121;
	exports.ER_BOOST_GEOMETRY_INCONSISTENT_TURNS_EXCEPTION = 3122;
	exports.ER_WARN_OPTIMIZER_HINT_SYNTAX_ERROR = 3123;
	exports.ER_WARN_BAD_MAX_EXECUTION_TIME = 3124;
	exports.ER_WARN_UNSUPPORTED_MAX_EXECUTION_TIME = 3125;
	exports.ER_WARN_CONFLICTING_HINT = 3126;
	exports.ER_WARN_UNKNOWN_QB_NAME = 3127;
	exports.ER_UNRESOLVED_HINT_NAME = 3128;
	exports.ER_WARN_ON_MODIFYING_GTID_EXECUTED_TABLE = 3129;
	exports.ER_PLUGGABLE_PROTOCOL_COMMAND_NOT_SUPPORTED = 3130;
	exports.ER_LOCKING_SERVICE_WRONG_NAME = 3131;
	exports.ER_LOCKING_SERVICE_DEADLOCK = 3132;
	exports.ER_LOCKING_SERVICE_TIMEOUT = 3133;
	exports.ER_GIS_MAX_POINTS_IN_GEOMETRY_OVERFLOWED = 3134;
	exports.ER_SQL_MODE_MERGED = 3135;
	exports.ER_VTOKEN_PLUGIN_TOKEN_MISMATCH = 3136;
	exports.ER_VTOKEN_PLUGIN_TOKEN_NOT_FOUND = 3137;
	exports.ER_CANT_SET_VARIABLE_WHEN_OWNING_GTID = 3138;
	exports.ER_REPLICA_CHANNEL_OPERATION_NOT_ALLOWED = 3139;
	exports.ER_INVALID_JSON_TEXT = 3140;
	exports.ER_INVALID_JSON_TEXT_IN_PARAM = 3141;
	exports.ER_INVALID_JSON_BINARY_DATA = 3142;
	exports.ER_INVALID_JSON_PATH = 3143;
	exports.ER_INVALID_JSON_CHARSET = 3144;
	exports.ER_INVALID_JSON_CHARSET_IN_FUNCTION = 3145;
	exports.ER_INVALID_TYPE_FOR_JSON = 3146;
	exports.ER_INVALID_CAST_TO_JSON = 3147;
	exports.ER_INVALID_JSON_PATH_CHARSET = 3148;
	exports.ER_INVALID_JSON_PATH_WILDCARD = 3149;
	exports.ER_JSON_VALUE_TOO_BIG = 3150;
	exports.ER_JSON_KEY_TOO_BIG = 3151;
	exports.ER_JSON_USED_AS_KEY = 3152;
	exports.ER_JSON_VACUOUS_PATH = 3153;
	exports.ER_JSON_BAD_ONE_OR_ALL_ARG = 3154;
	exports.ER_NUMERIC_JSON_VALUE_OUT_OF_RANGE = 3155;
	exports.ER_INVALID_JSON_VALUE_FOR_CAST = 3156;
	exports.ER_JSON_DOCUMENT_TOO_DEEP = 3157;
	exports.ER_JSON_DOCUMENT_NULL_KEY = 3158;
	exports.ER_SECURE_TRANSPORT_REQUIRED = 3159;
	exports.ER_NO_SECURE_TRANSPORTS_CONFIGURED = 3160;
	exports.ER_DISABLED_STORAGE_ENGINE = 3161;
	exports.ER_USER_DOES_NOT_EXIST = 3162;
	exports.ER_USER_ALREADY_EXISTS = 3163;
	exports.ER_AUDIT_API_ABORT = 3164;
	exports.ER_INVALID_JSON_PATH_ARRAY_CELL = 3165;
	exports.ER_BUFPOOL_RESIZE_INPROGRESS = 3166;
	exports.ER_FEATURE_DISABLED_SEE_DOC = 3167;
	exports.ER_SERVER_ISNT_AVAILABLE = 3168;
	exports.ER_SESSION_WAS_KILLED = 3169;
	exports.ER_CAPACITY_EXCEEDED = 3170;
	exports.ER_CAPACITY_EXCEEDED_IN_RANGE_OPTIMIZER = 3171;
	exports.ER_TABLE_NEEDS_UPG_PART = 3172;
	exports.ER_CANT_WAIT_FOR_EXECUTED_GTID_SET_WHILE_OWNING_A_GTID = 3173;
	exports.ER_CANNOT_ADD_FOREIGN_BASE_COL_VIRTUAL = 3174;
	exports.ER_CANNOT_CREATE_VIRTUAL_INDEX_CONSTRAINT = 3175;
	exports.ER_ERROR_ON_MODIFYING_GTID_EXECUTED_TABLE = 3176;
	exports.ER_LOCK_REFUSED_BY_ENGINE = 3177;
	exports.ER_UNSUPPORTED_ALTER_ONLINE_ON_VIRTUAL_COLUMN = 3178;
	exports.ER_MASTER_KEY_ROTATION_NOT_SUPPORTED_BY_SE = 3179;
	exports.ER_MASTER_KEY_ROTATION_ERROR_BY_SE = 3180;
	exports.ER_MASTER_KEY_ROTATION_BINLOG_FAILED = 3181;
	exports.ER_MASTER_KEY_ROTATION_SE_UNAVAILABLE = 3182;
	exports.ER_TABLESPACE_CANNOT_ENCRYPT = 3183;
	exports.ER_INVALID_ENCRYPTION_OPTION = 3184;
	exports.ER_CANNOT_FIND_KEY_IN_KEYRING = 3185;
	exports.ER_CAPACITY_EXCEEDED_IN_PARSER = 3186;
	exports.ER_UNSUPPORTED_ALTER_ENCRYPTION_INPLACE = 3187;
	exports.ER_KEYRING_UDF_KEYRING_SERVICE_ERROR = 3188;
	exports.ER_USER_COLUMN_OLD_LENGTH = 3189;
	exports.ER_CANT_RESET_SOURCE = 3190;
	exports.ER_GROUP_REPLICATION_MAX_GROUP_SIZE = 3191;
	exports.ER_CANNOT_ADD_FOREIGN_BASE_COL_STORED = 3192;
	exports.ER_TABLE_REFERENCED = 3193;
	exports.ER_PARTITION_ENGINE_DEPRECATED_FOR_TABLE = 3194;
	exports.ER_WARN_USING_GEOMFROMWKB_TO_SET_SRID_ZERO = 3195;
	exports.ER_WARN_USING_GEOMFROMWKB_TO_SET_SRID = 3196;
	exports.ER_XA_RETRY = 3197;
	exports.ER_KEYRING_AWS_UDF_AWS_KMS_ERROR = 3198;
	exports.ER_BINLOG_UNSAFE_XA = 3199;
	exports.ER_UDF_ERROR = 3200;
	exports.ER_KEYRING_MIGRATION_FAILURE = 3201;
	exports.ER_KEYRING_ACCESS_DENIED_ERROR = 3202;
	exports.ER_KEYRING_MIGRATION_STATUS = 3203;
	exports.ER_PLUGIN_FAILED_TO_OPEN_TABLES = 3204;
	exports.ER_PLUGIN_FAILED_TO_OPEN_TABLE = 3205;
	exports.ER_AUDIT_LOG_NO_KEYRING_PLUGIN_INSTALLED = 3206;
	exports.ER_AUDIT_LOG_ENCRYPTION_PASSWORD_HAS_NOT_BEEN_SET = 3207;
	exports.ER_AUDIT_LOG_COULD_NOT_CREATE_AES_KEY = 3208;
	exports.ER_AUDIT_LOG_ENCRYPTION_PASSWORD_CANNOT_BE_FETCHED = 3209;
	exports.ER_AUDIT_LOG_JSON_FILTERING_NOT_ENABLED = 3210;
	exports.ER_AUDIT_LOG_UDF_INSUFFICIENT_PRIVILEGE = 3211;
	exports.ER_AUDIT_LOG_SUPER_PRIVILEGE_REQUIRED = 3212;
	exports.ER_COULD_NOT_REINITIALIZE_AUDIT_LOG_FILTERS = 3213;
	exports.ER_AUDIT_LOG_UDF_INVALID_ARGUMENT_TYPE = 3214;
	exports.ER_AUDIT_LOG_UDF_INVALID_ARGUMENT_COUNT = 3215;
	exports.ER_AUDIT_LOG_HAS_NOT_BEEN_INSTALLED = 3216;
	exports.ER_AUDIT_LOG_UDF_READ_INVALID_MAX_ARRAY_LENGTH_ARG_TYPE = 3217;
	exports.ER_AUDIT_LOG_UDF_READ_INVALID_MAX_ARRAY_LENGTH_ARG_VALUE = 3218;
	exports.ER_AUDIT_LOG_JSON_FILTER_PARSING_ERROR = 3219;
	exports.ER_AUDIT_LOG_JSON_FILTER_NAME_CANNOT_BE_EMPTY = 3220;
	exports.ER_AUDIT_LOG_JSON_USER_NAME_CANNOT_BE_EMPTY = 3221;
	exports.ER_AUDIT_LOG_JSON_FILTER_DOES_NOT_EXISTS = 3222;
	exports.ER_AUDIT_LOG_USER_FIRST_CHARACTER_MUST_BE_ALPHANUMERIC = 3223;
	exports.ER_AUDIT_LOG_USER_NAME_INVALID_CHARACTER = 3224;
	exports.ER_AUDIT_LOG_HOST_NAME_INVALID_CHARACTER = 3225;
	exports.WARN_DEPRECATED_MAXDB_SQL_MODE_FOR_TIMESTAMP = 3226;
	exports.ER_XA_REPLICATION_FILTERS = 3227;
	exports.ER_CANT_OPEN_ERROR_LOG = 3228;
	exports.ER_GROUPING_ON_TIMESTAMP_IN_DST = 3229;
	exports.ER_CANT_START_SERVER_NAMED_PIPE = 3230;
	exports.ER_WRITE_SET_EXCEEDS_LIMIT = 3231;
	exports.ER_DEPRECATED_TLS_VERSION_SESSION_57 = 3232;
	exports.ER_WARN_DEPRECATED_TLS_VERSION_57 = 3233;
	exports.ER_WARN_WRONG_NATIVE_TABLE_STRUCTURE = 3234;
	exports.ER_AES_INVALID_KDF_NAME = 3235;
	exports.ER_AES_INVALID_KDF_ITERATIONS = 3236;
	exports.WARN_AES_KEY_SIZE = 3237;
	exports.ER_AES_INVALID_KDF_OPTION_SIZE = 3238;
	exports.ER_UNSUPPORT_COMPRESSED_TEMPORARY_TABLE = 3500;
	exports.ER_ACL_OPERATION_FAILED = 3501;
	exports.ER_UNSUPPORTED_INDEX_ALGORITHM = 3502;
	exports.ER_NO_SUCH_DB = 3503;
	exports.ER_TOO_BIG_ENUM = 3504;
	exports.ER_TOO_LONG_SET_ENUM_VALUE = 3505;
	exports.ER_INVALID_DD_OBJECT = 3506;
	exports.ER_UPDATING_DD_TABLE = 3507;
	exports.ER_INVALID_DD_OBJECT_ID = 3508;
	exports.ER_INVALID_DD_OBJECT_NAME = 3509;
	exports.ER_TABLESPACE_MISSING_WITH_NAME = 3510;
	exports.ER_TOO_LONG_ROUTINE_COMMENT = 3511;
	exports.ER_SP_LOAD_FAILED = 3512;
	exports.ER_INVALID_BITWISE_OPERANDS_SIZE = 3513;
	exports.ER_INVALID_BITWISE_AGGREGATE_OPERANDS_SIZE = 3514;
	exports.ER_WARN_UNSUPPORTED_HINT = 3515;
	exports.ER_UNEXPECTED_GEOMETRY_TYPE = 3516;
	exports.ER_SRS_PARSE_ERROR = 3517;
	exports.ER_SRS_PROJ_PARAMETER_MISSING = 3518;
	exports.ER_WARN_SRS_NOT_FOUND = 3519;
	exports.ER_SRS_NOT_CARTESIAN = 3520;
	exports.ER_SRS_NOT_CARTESIAN_UNDEFINED = 3521;
	exports.ER_PK_INDEX_CANT_BE_INVISIBLE = 3522;
	exports.ER_UNKNOWN_AUTHID = 3523;
	exports.ER_FAILED_ROLE_GRANT = 3524;
	exports.ER_OPEN_ROLE_TABLES = 3525;
	exports.ER_FAILED_DEFAULT_ROLES = 3526;
	exports.ER_COMPONENTS_NO_SCHEME = 3527;
	exports.ER_COMPONENTS_NO_SCHEME_SERVICE = 3528;
	exports.ER_COMPONENTS_CANT_LOAD = 3529;
	exports.ER_ROLE_NOT_GRANTED = 3530;
	exports.ER_FAILED_REVOKE_ROLE = 3531;
	exports.ER_RENAME_ROLE = 3532;
	exports.ER_COMPONENTS_CANT_ACQUIRE_SERVICE_IMPLEMENTATION = 3533;
	exports.ER_COMPONENTS_CANT_SATISFY_DEPENDENCY = 3534;
	exports.ER_COMPONENTS_LOAD_CANT_REGISTER_SERVICE_IMPLEMENTATION = 3535;
	exports.ER_COMPONENTS_LOAD_CANT_INITIALIZE = 3536;
	exports.ER_COMPONENTS_UNLOAD_NOT_LOADED = 3537;
	exports.ER_COMPONENTS_UNLOAD_CANT_DEINITIALIZE = 3538;
	exports.ER_COMPONENTS_CANT_RELEASE_SERVICE = 3539;
	exports.ER_COMPONENTS_UNLOAD_CANT_UNREGISTER_SERVICE = 3540;
	exports.ER_COMPONENTS_CANT_UNLOAD = 3541;
	exports.ER_WARN_UNLOAD_THE_NOT_PERSISTED = 3542;
	exports.ER_COMPONENT_TABLE_INCORRECT = 3543;
	exports.ER_COMPONENT_MANIPULATE_ROW_FAILED = 3544;
	exports.ER_COMPONENTS_UNLOAD_DUPLICATE_IN_GROUP = 3545;
	exports.ER_CANT_SET_GTID_PURGED_DUE_SETS_CONSTRAINTS = 3546;
	exports.ER_CANNOT_LOCK_USER_MANAGEMENT_CACHES = 3547;
	exports.ER_SRS_NOT_FOUND = 3548;
	exports.ER_VARIABLE_NOT_PERSISTED = 3549;
	exports.ER_IS_QUERY_INVALID_CLAUSE = 3550;
	exports.ER_UNABLE_TO_STORE_STATISTICS = 3551;
	exports.ER_NO_SYSTEM_SCHEMA_ACCESS = 3552;
	exports.ER_NO_SYSTEM_TABLESPACE_ACCESS = 3553;
	exports.ER_NO_SYSTEM_TABLE_ACCESS = 3554;
	exports.ER_NO_SYSTEM_TABLE_ACCESS_FOR_DICTIONARY_TABLE = 3555;
	exports.ER_NO_SYSTEM_TABLE_ACCESS_FOR_SYSTEM_TABLE = 3556;
	exports.ER_NO_SYSTEM_TABLE_ACCESS_FOR_TABLE = 3557;
	exports.ER_INVALID_OPTION_KEY = 3558;
	exports.ER_INVALID_OPTION_VALUE = 3559;
	exports.ER_INVALID_OPTION_KEY_VALUE_PAIR = 3560;
	exports.ER_INVALID_OPTION_START_CHARACTER = 3561;
	exports.ER_INVALID_OPTION_END_CHARACTER = 3562;
	exports.ER_INVALID_OPTION_CHARACTERS = 3563;
	exports.ER_DUPLICATE_OPTION_KEY = 3564;
	exports.ER_WARN_SRS_NOT_FOUND_AXIS_ORDER = 3565;
	exports.ER_NO_ACCESS_TO_NATIVE_FCT = 3566;
	exports.ER_RESET_SOURCE_TO_VALUE_OUT_OF_RANGE = 3567;
	exports.ER_UNRESOLVED_TABLE_LOCK = 3568;
	exports.ER_DUPLICATE_TABLE_LOCK = 3569;
	exports.ER_BINLOG_UNSAFE_SKIP_LOCKED = 3570;
	exports.ER_BINLOG_UNSAFE_NOWAIT = 3571;
	exports.ER_LOCK_NOWAIT = 3572;
	exports.ER_CTE_RECURSIVE_REQUIRES_UNION = 3573;
	exports.ER_CTE_RECURSIVE_REQUIRES_NONRECURSIVE_FIRST = 3574;
	exports.ER_CTE_RECURSIVE_FORBIDS_AGGREGATION = 3575;
	exports.ER_CTE_RECURSIVE_FORBIDDEN_JOIN_ORDER = 3576;
	exports.ER_CTE_RECURSIVE_REQUIRES_SINGLE_REFERENCE = 3577;
	exports.ER_SWITCH_TMP_ENGINE = 3578;
	exports.ER_WINDOW_NO_SUCH_WINDOW = 3579;
	exports.ER_WINDOW_CIRCULARITY_IN_WINDOW_GRAPH = 3580;
	exports.ER_WINDOW_NO_CHILD_PARTITIONING = 3581;
	exports.ER_WINDOW_NO_INHERIT_FRAME = 3582;
	exports.ER_WINDOW_NO_REDEFINE_ORDER_BY = 3583;
	exports.ER_WINDOW_FRAME_START_ILLEGAL = 3584;
	exports.ER_WINDOW_FRAME_END_ILLEGAL = 3585;
	exports.ER_WINDOW_FRAME_ILLEGAL = 3586;
	exports.ER_WINDOW_RANGE_FRAME_ORDER_TYPE = 3587;
	exports.ER_WINDOW_RANGE_FRAME_TEMPORAL_TYPE = 3588;
	exports.ER_WINDOW_RANGE_FRAME_NUMERIC_TYPE = 3589;
	exports.ER_WINDOW_RANGE_BOUND_NOT_CONSTANT = 3590;
	exports.ER_WINDOW_DUPLICATE_NAME = 3591;
	exports.ER_WINDOW_ILLEGAL_ORDER_BY = 3592;
	exports.ER_WINDOW_INVALID_WINDOW_FUNC_USE = 3593;
	exports.ER_WINDOW_INVALID_WINDOW_FUNC_ALIAS_USE = 3594;
	exports.ER_WINDOW_NESTED_WINDOW_FUNC_USE_IN_WINDOW_SPEC = 3595;
	exports.ER_WINDOW_ROWS_INTERVAL_USE = 3596;
	exports.ER_WINDOW_NO_GROUP_ORDER = 3597;
	exports.ER_WINDOW_EXPLAIN_JSON = 3598;
	exports.ER_WINDOW_FUNCTION_IGNORES_FRAME = 3599;
	exports.ER_WL9236_NOW = 3600;
	exports.ER_INVALID_NO_OF_ARGS = 3601;
	exports.ER_FIELD_IN_GROUPING_NOT_GROUP_BY = 3602;
	exports.ER_TOO_LONG_TABLESPACE_COMMENT = 3603;
	exports.ER_ENGINE_CANT_DROP_TABLE = 3604;
	exports.ER_ENGINE_CANT_DROP_MISSING_TABLE = 3605;
	exports.ER_TABLESPACE_DUP_FILENAME = 3606;
	exports.ER_DB_DROP_RMDIR2 = 3607;
	exports.ER_IMP_NO_FILES_MATCHED = 3608;
	exports.ER_IMP_SCHEMA_DOES_NOT_EXIST = 3609;
	exports.ER_IMP_TABLE_ALREADY_EXISTS = 3610;
	exports.ER_IMP_INCOMPATIBLE_MYSQLD_VERSION = 3611;
	exports.ER_IMP_INCOMPATIBLE_DD_VERSION = 3612;
	exports.ER_IMP_INCOMPATIBLE_SDI_VERSION = 3613;
	exports.ER_WARN_INVALID_HINT = 3614;
	exports.ER_VAR_DOES_NOT_EXIST = 3615;
	exports.ER_LONGITUDE_OUT_OF_RANGE = 3616;
	exports.ER_LATITUDE_OUT_OF_RANGE = 3617;
	exports.ER_NOT_IMPLEMENTED_FOR_GEOGRAPHIC_SRS = 3618;
	exports.ER_ILLEGAL_PRIVILEGE_LEVEL = 3619;
	exports.ER_NO_SYSTEM_VIEW_ACCESS = 3620;
	exports.ER_COMPONENT_FILTER_FLABBERGASTED = 3621;
	exports.ER_PART_EXPR_TOO_LONG = 3622;
	exports.ER_UDF_DROP_DYNAMICALLY_REGISTERED = 3623;
	exports.ER_UNABLE_TO_STORE_COLUMN_STATISTICS = 3624;
	exports.ER_UNABLE_TO_UPDATE_COLUMN_STATISTICS = 3625;
	exports.ER_UNABLE_TO_DROP_COLUMN_STATISTICS = 3626;
	exports.ER_UNABLE_TO_BUILD_HISTOGRAM = 3627;
	exports.ER_MANDATORY_ROLE = 3628;
	exports.ER_MISSING_TABLESPACE_FILE = 3629;
	exports.ER_PERSIST_ONLY_ACCESS_DENIED_ERROR = 3630;
	exports.ER_CMD_NEED_SUPER = 3631;
	exports.ER_PATH_IN_DATADIR = 3632;
	exports.ER_CLONE_DDL_IN_PROGRESS = 3633;
	exports.ER_CLONE_TOO_MANY_CONCURRENT_CLONES = 3634;
	exports.ER_APPLIER_LOG_EVENT_VALIDATION_ERROR = 3635;
	exports.ER_CTE_MAX_RECURSION_DEPTH = 3636;
	exports.ER_NOT_HINT_UPDATABLE_VARIABLE = 3637;
	exports.ER_CREDENTIALS_CONTRADICT_TO_HISTORY = 3638;
	exports.ER_WARNING_PASSWORD_HISTORY_CLAUSES_VOID = 3639;
	exports.ER_CLIENT_DOES_NOT_SUPPORT = 3640;
	exports.ER_I_S_SKIPPED_TABLESPACE = 3641;
	exports.ER_TABLESPACE_ENGINE_MISMATCH = 3642;
	exports.ER_WRONG_SRID_FOR_COLUMN = 3643;
	exports.ER_CANNOT_ALTER_SRID_DUE_TO_INDEX = 3644;
	exports.ER_WARN_BINLOG_PARTIAL_UPDATES_DISABLED = 3645;
	exports.ER_WARN_BINLOG_V1_ROW_EVENTS_DISABLED = 3646;
	exports.ER_WARN_BINLOG_PARTIAL_UPDATES_SUGGESTS_PARTIAL_IMAGES = 3647;
	exports.ER_COULD_NOT_APPLY_JSON_DIFF = 3648;
	exports.ER_CORRUPTED_JSON_DIFF = 3649;
	exports.ER_RESOURCE_GROUP_EXISTS = 3650;
	exports.ER_RESOURCE_GROUP_NOT_EXISTS = 3651;
	exports.ER_INVALID_VCPU_ID = 3652;
	exports.ER_INVALID_VCPU_RANGE = 3653;
	exports.ER_INVALID_THREAD_PRIORITY = 3654;
	exports.ER_DISALLOWED_OPERATION = 3655;
	exports.ER_RESOURCE_GROUP_BUSY = 3656;
	exports.ER_RESOURCE_GROUP_DISABLED = 3657;
	exports.ER_FEATURE_UNSUPPORTED = 3658;
	exports.ER_ATTRIBUTE_IGNORED = 3659;
	exports.ER_INVALID_THREAD_ID = 3660;
	exports.ER_RESOURCE_GROUP_BIND_FAILED = 3661;
	exports.ER_INVALID_USE_OF_FORCE_OPTION = 3662;
	exports.ER_GROUP_REPLICATION_COMMAND_FAILURE = 3663;
	exports.ER_SDI_OPERATION_FAILED = 3664;
	exports.ER_MISSING_JSON_TABLE_VALUE = 3665;
	exports.ER_WRONG_JSON_TABLE_VALUE = 3666;
	exports.ER_TF_MUST_HAVE_ALIAS = 3667;
	exports.ER_TF_FORBIDDEN_JOIN_TYPE = 3668;
	exports.ER_JT_VALUE_OUT_OF_RANGE = 3669;
	exports.ER_JT_MAX_NESTED_PATH = 3670;
	exports.ER_PASSWORD_EXPIRATION_NOT_SUPPORTED_BY_AUTH_METHOD = 3671;
	exports.ER_INVALID_GEOJSON_CRS_NOT_TOP_LEVEL = 3672;
	exports.ER_BAD_NULL_ERROR_NOT_IGNORED = 3673;
	exports.WARN_USELESS_SPATIAL_INDEX = 3674;
	exports.ER_DISK_FULL_NOWAIT = 3675;
	exports.ER_PARSE_ERROR_IN_DIGEST_FN = 3676;
	exports.ER_UNDISCLOSED_PARSE_ERROR_IN_DIGEST_FN = 3677;
	exports.ER_SCHEMA_DIR_EXISTS = 3678;
	exports.ER_SCHEMA_DIR_MISSING = 3679;
	exports.ER_SCHEMA_DIR_CREATE_FAILED = 3680;
	exports.ER_SCHEMA_DIR_UNKNOWN = 3681;
	exports.ER_ONLY_IMPLEMENTED_FOR_SRID_0_AND_4326 = 3682;
	exports.ER_BINLOG_EXPIRE_LOG_DAYS_AND_SECS_USED_TOGETHER = 3683;
	exports.ER_REGEXP_BUFFER_OVERFLOW = 3684;
	exports.ER_REGEXP_ILLEGAL_ARGUMENT = 3685;
	exports.ER_REGEXP_INDEX_OUTOFBOUNDS_ERROR = 3686;
	exports.ER_REGEXP_INTERNAL_ERROR = 3687;
	exports.ER_REGEXP_RULE_SYNTAX = 3688;
	exports.ER_REGEXP_BAD_ESCAPE_SEQUENCE = 3689;
	exports.ER_REGEXP_UNIMPLEMENTED = 3690;
	exports.ER_REGEXP_MISMATCHED_PAREN = 3691;
	exports.ER_REGEXP_BAD_INTERVAL = 3692;
	exports.ER_REGEXP_MAX_LT_MIN = 3693;
	exports.ER_REGEXP_INVALID_BACK_REF = 3694;
	exports.ER_REGEXP_LOOK_BEHIND_LIMIT = 3695;
	exports.ER_REGEXP_MISSING_CLOSE_BRACKET = 3696;
	exports.ER_REGEXP_INVALID_RANGE = 3697;
	exports.ER_REGEXP_STACK_OVERFLOW = 3698;
	exports.ER_REGEXP_TIME_OUT = 3699;
	exports.ER_REGEXP_PATTERN_TOO_BIG = 3700;
	exports.ER_CANT_SET_ERROR_LOG_SERVICE = 3701;
	exports.ER_EMPTY_PIPELINE_FOR_ERROR_LOG_SERVICE = 3702;
	exports.ER_COMPONENT_FILTER_DIAGNOSTICS = 3703;
	exports.ER_NOT_IMPLEMENTED_FOR_CARTESIAN_SRS = 3704;
	exports.ER_NOT_IMPLEMENTED_FOR_PROJECTED_SRS = 3705;
	exports.ER_NONPOSITIVE_RADIUS = 3706;
	exports.ER_RESTART_SERVER_FAILED = 3707;
	exports.ER_SRS_MISSING_MANDATORY_ATTRIBUTE = 3708;
	exports.ER_SRS_MULTIPLE_ATTRIBUTE_DEFINITIONS = 3709;
	exports.ER_SRS_NAME_CANT_BE_EMPTY_OR_WHITESPACE = 3710;
	exports.ER_SRS_ORGANIZATION_CANT_BE_EMPTY_OR_WHITESPACE = 3711;
	exports.ER_SRS_ID_ALREADY_EXISTS = 3712;
	exports.ER_WARN_SRS_ID_ALREADY_EXISTS = 3713;
	exports.ER_CANT_MODIFY_SRID_0 = 3714;
	exports.ER_WARN_RESERVED_SRID_RANGE = 3715;
	exports.ER_CANT_MODIFY_SRS_USED_BY_COLUMN = 3716;
	exports.ER_SRS_INVALID_CHARACTER_IN_ATTRIBUTE = 3717;
	exports.ER_SRS_ATTRIBUTE_STRING_TOO_LONG = 3718;
	exports.ER_DEPRECATED_UTF8_ALIAS = 3719;
	exports.ER_DEPRECATED_NATIONAL = 3720;
	exports.ER_INVALID_DEFAULT_UTF8MB4_COLLATION = 3721;
	exports.ER_UNABLE_TO_COLLECT_LOG_STATUS = 3722;
	exports.ER_RESERVED_TABLESPACE_NAME = 3723;
	exports.ER_UNABLE_TO_SET_OPTION = 3724;
	exports.ER_REPLICA_POSSIBLY_DIVERGED_AFTER_DDL = 3725;
	exports.ER_SRS_NOT_GEOGRAPHIC = 3726;
	exports.ER_POLYGON_TOO_LARGE = 3727;
	exports.ER_SPATIAL_UNIQUE_INDEX = 3728;
	exports.ER_INDEX_TYPE_NOT_SUPPORTED_FOR_SPATIAL_INDEX = 3729;
	exports.ER_FK_CANNOT_DROP_PARENT = 3730;
	exports.ER_GEOMETRY_PARAM_LONGITUDE_OUT_OF_RANGE = 3731;
	exports.ER_GEOMETRY_PARAM_LATITUDE_OUT_OF_RANGE = 3732;
	exports.ER_FK_CANNOT_USE_VIRTUAL_COLUMN = 3733;
	exports.ER_FK_NO_COLUMN_PARENT = 3734;
	exports.ER_CANT_SET_ERROR_SUPPRESSION_LIST = 3735;
	exports.ER_SRS_GEOGCS_INVALID_AXES = 3736;
	exports.ER_SRS_INVALID_SEMI_MAJOR_AXIS = 3737;
	exports.ER_SRS_INVALID_INVERSE_FLATTENING = 3738;
	exports.ER_SRS_INVALID_ANGULAR_UNIT = 3739;
	exports.ER_SRS_INVALID_PRIME_MERIDIAN = 3740;
	exports.ER_TRANSFORM_SOURCE_SRS_NOT_SUPPORTED = 3741;
	exports.ER_TRANSFORM_TARGET_SRS_NOT_SUPPORTED = 3742;
	exports.ER_TRANSFORM_SOURCE_SRS_MISSING_TOWGS84 = 3743;
	exports.ER_TRANSFORM_TARGET_SRS_MISSING_TOWGS84 = 3744;
	exports.ER_TEMP_TABLE_PREVENTS_SWITCH_SESSION_BINLOG_FORMAT = 3745;
	exports.ER_TEMP_TABLE_PREVENTS_SWITCH_GLOBAL_BINLOG_FORMAT = 3746;
	exports.ER_RUNNING_APPLIER_PREVENTS_SWITCH_GLOBAL_BINLOG_FORMAT = 3747;
	exports.ER_CLIENT_GTID_UNSAFE_CREATE_DROP_TEMP_TABLE_IN_TRX_IN_SBR = 3748;
	exports.ER_XA_CANT_CREATE_MDL_BACKUP = 3749;
	exports.ER_TABLE_WITHOUT_PK = 3750;
	exports.ER_WARN_DATA_TRUNCATED_FUNCTIONAL_INDEX = 3751;
	exports.ER_WARN_DATA_OUT_OF_RANGE_FUNCTIONAL_INDEX = 3752;
	exports.ER_FUNCTIONAL_INDEX_ON_JSON_OR_GEOMETRY_FUNCTION = 3753;
	exports.ER_FUNCTIONAL_INDEX_REF_AUTO_INCREMENT = 3754;
	exports.ER_CANNOT_DROP_COLUMN_FUNCTIONAL_INDEX = 3755;
	exports.ER_FUNCTIONAL_INDEX_PRIMARY_KEY = 3756;
	exports.ER_FUNCTIONAL_INDEX_ON_LOB = 3757;
	exports.ER_FUNCTIONAL_INDEX_FUNCTION_IS_NOT_ALLOWED = 3758;
	exports.ER_FULLTEXT_FUNCTIONAL_INDEX = 3759;
	exports.ER_SPATIAL_FUNCTIONAL_INDEX = 3760;
	exports.ER_WRONG_KEY_COLUMN_FUNCTIONAL_INDEX = 3761;
	exports.ER_FUNCTIONAL_INDEX_ON_FIELD = 3762;
	exports.ER_GENERATED_COLUMN_NAMED_FUNCTION_IS_NOT_ALLOWED = 3763;
	exports.ER_GENERATED_COLUMN_ROW_VALUE = 3764;
	exports.ER_GENERATED_COLUMN_VARIABLES = 3765;
	exports.ER_DEPENDENT_BY_DEFAULT_GENERATED_VALUE = 3766;
	exports.ER_DEFAULT_VAL_GENERATED_NON_PRIOR = 3767;
	exports.ER_DEFAULT_VAL_GENERATED_REF_AUTO_INC = 3768;
	exports.ER_DEFAULT_VAL_GENERATED_FUNCTION_IS_NOT_ALLOWED = 3769;
	exports.ER_DEFAULT_VAL_GENERATED_NAMED_FUNCTION_IS_NOT_ALLOWED = 3770;
	exports.ER_DEFAULT_VAL_GENERATED_ROW_VALUE = 3771;
	exports.ER_DEFAULT_VAL_GENERATED_VARIABLES = 3772;
	exports.ER_DEFAULT_AS_VAL_GENERATED = 3773;
	exports.ER_UNSUPPORTED_ACTION_ON_DEFAULT_VAL_GENERATED = 3774;
	exports.ER_GTID_UNSAFE_ALTER_ADD_COL_WITH_DEFAULT_EXPRESSION = 3775;
	exports.ER_FK_CANNOT_CHANGE_ENGINE = 3776;
	exports.ER_WARN_DEPRECATED_USER_SET_EXPR = 3777;
	exports.ER_WARN_DEPRECATED_UTF8MB3_COLLATION = 3778;
	exports.ER_WARN_DEPRECATED_NESTED_COMMENT_SYNTAX = 3779;
	exports.ER_FK_INCOMPATIBLE_COLUMNS = 3780;
	exports.ER_GR_HOLD_WAIT_TIMEOUT = 3781;
	exports.ER_GR_HOLD_KILLED = 3782;
	exports.ER_GR_HOLD_MEMBER_STATUS_ERROR = 3783;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_FETCH_KEY = 3784;
	exports.ER_RPL_ENCRYPTION_KEY_NOT_FOUND = 3785;
	exports.ER_RPL_ENCRYPTION_KEYRING_INVALID_KEY = 3786;
	exports.ER_RPL_ENCRYPTION_HEADER_ERROR = 3787;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_ROTATE_LOGS = 3788;
	exports.ER_RPL_ENCRYPTION_KEY_EXISTS_UNEXPECTED = 3789;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_GENERATE_KEY = 3790;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_STORE_KEY = 3791;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_REMOVE_KEY = 3792;
	exports.ER_RPL_ENCRYPTION_UNABLE_TO_CHANGE_OPTION = 3793;
	exports.ER_RPL_ENCRYPTION_MASTER_KEY_RECOVERY_FAILED = 3794;
	exports.ER_SLOW_LOG_MODE_IGNORED_WHEN_NOT_LOGGING_TO_FILE = 3795;
	exports.ER_GRP_TRX_CONSISTENCY_NOT_ALLOWED = 3796;
	exports.ER_GRP_TRX_CONSISTENCY_BEFORE = 3797;
	exports.ER_GRP_TRX_CONSISTENCY_AFTER_ON_TRX_BEGIN = 3798;
	exports.ER_GRP_TRX_CONSISTENCY_BEGIN_NOT_ALLOWED = 3799;
	exports.ER_FUNCTIONAL_INDEX_ROW_VALUE_IS_NOT_ALLOWED = 3800;
	exports.ER_RPL_ENCRYPTION_FAILED_TO_ENCRYPT = 3801;
	exports.ER_PAGE_TRACKING_NOT_STARTED = 3802;
	exports.ER_PAGE_TRACKING_RANGE_NOT_TRACKED = 3803;
	exports.ER_PAGE_TRACKING_CANNOT_PURGE = 3804;
	exports.ER_RPL_ENCRYPTION_CANNOT_ROTATE_BINLOG_MASTER_KEY = 3805;
	exports.ER_BINLOG_MASTER_KEY_RECOVERY_OUT_OF_COMBINATION = 3806;
	exports.ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_OPERATE_KEY = 3807;
	exports.ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_ROTATE_LOGS = 3808;
	exports.ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_REENCRYPT_LOG = 3809;
	exports.ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_CLEANUP_UNUSED_KEYS = 3810;
	exports.ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_CLEANUP_AUX_KEY = 3811;
	exports.ER_NON_BOOLEAN_EXPR_FOR_CHECK_CONSTRAINT = 3812;
	exports.ER_COLUMN_CHECK_CONSTRAINT_REFERENCES_OTHER_COLUMN = 3813;
	exports.ER_CHECK_CONSTRAINT_NAMED_FUNCTION_IS_NOT_ALLOWED = 3814;
	exports.ER_CHECK_CONSTRAINT_FUNCTION_IS_NOT_ALLOWED = 3815;
	exports.ER_CHECK_CONSTRAINT_VARIABLES = 3816;
	exports.ER_CHECK_CONSTRAINT_ROW_VALUE = 3817;
	exports.ER_CHECK_CONSTRAINT_REFERS_AUTO_INCREMENT_COLUMN = 3818;
	exports.ER_CHECK_CONSTRAINT_VIOLATED = 3819;
	exports.ER_CHECK_CONSTRAINT_REFERS_UNKNOWN_COLUMN = 3820;
	exports.ER_CHECK_CONSTRAINT_NOT_FOUND = 3821;
	exports.ER_CHECK_CONSTRAINT_DUP_NAME = 3822;
	exports.ER_CHECK_CONSTRAINT_CLAUSE_USING_FK_REFER_ACTION_COLUMN = 3823;
	exports.WARN_UNENCRYPTED_TABLE_IN_ENCRYPTED_DB = 3824;
	exports.ER_INVALID_ENCRYPTION_REQUEST = 3825;
	exports.ER_CANNOT_SET_TABLE_ENCRYPTION = 3826;
	exports.ER_CANNOT_SET_DATABASE_ENCRYPTION = 3827;
	exports.ER_CANNOT_SET_TABLESPACE_ENCRYPTION = 3828;
	exports.ER_TABLESPACE_CANNOT_BE_ENCRYPTED = 3829;
	exports.ER_TABLESPACE_CANNOT_BE_DECRYPTED = 3830;
	exports.ER_TABLESPACE_TYPE_UNKNOWN = 3831;
	exports.ER_TARGET_TABLESPACE_UNENCRYPTED = 3832;
	exports.ER_CANNOT_USE_ENCRYPTION_CLAUSE = 3833;
	exports.ER_INVALID_MULTIPLE_CLAUSES = 3834;
	exports.ER_UNSUPPORTED_USE_OF_GRANT_AS = 3835;
	exports.ER_UKNOWN_AUTH_ID_OR_ACCESS_DENIED_FOR_GRANT_AS = 3836;
	exports.ER_DEPENDENT_BY_FUNCTIONAL_INDEX = 3837;
	exports.ER_PLUGIN_NOT_EARLY = 3838;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_START_SUBDIR_PATH = 3839;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_START_TIMEOUT = 3840;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_DIRS_INVALID = 3841;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_LABEL_NOT_FOUND = 3842;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_DIR_EMPTY = 3843;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_NO_SUCH_DIR = 3844;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_DIR_CLASH = 3845;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_DIR_PERMISSIONS = 3846;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_FILE_CREATE = 3847;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_ACTIVE = 3848;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_INACTIVE = 3849;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_FAILED = 3850;
	exports.ER_INNODB_REDO_LOG_ARCHIVE_SESSION = 3851;
	exports.ER_STD_REGEX_ERROR = 3852;
	exports.ER_INVALID_JSON_TYPE = 3853;
	exports.ER_CANNOT_CONVERT_STRING = 3854;
	exports.ER_DEPENDENT_BY_PARTITION_FUNC = 3855;
	exports.ER_WARN_DEPRECATED_FLOAT_AUTO_INCREMENT = 3856;
	exports.ER_RPL_CANT_STOP_REPLICA_WHILE_LOCKED_BACKUP = 3857;
	exports.ER_WARN_DEPRECATED_FLOAT_DIGITS = 3858;
	exports.ER_WARN_DEPRECATED_FLOAT_UNSIGNED = 3859;
	exports.ER_WARN_DEPRECATED_INTEGER_DISPLAY_WIDTH = 3860;
	exports.ER_WARN_DEPRECATED_ZEROFILL = 3861;
	exports.ER_CLONE_DONOR = 3862;
	exports.ER_CLONE_PROTOCOL = 3863;
	exports.ER_CLONE_DONOR_VERSION = 3864;
	exports.ER_CLONE_OS = 3865;
	exports.ER_CLONE_PLATFORM = 3866;
	exports.ER_CLONE_CHARSET = 3867;
	exports.ER_CLONE_CONFIG = 3868;
	exports.ER_CLONE_SYS_CONFIG = 3869;
	exports.ER_CLONE_PLUGIN_MATCH = 3870;
	exports.ER_CLONE_LOOPBACK = 3871;
	exports.ER_CLONE_ENCRYPTION = 3872;
	exports.ER_CLONE_DISK_SPACE = 3873;
	exports.ER_CLONE_IN_PROGRESS = 3874;
	exports.ER_CLONE_DISALLOWED = 3875;
	exports.ER_CANNOT_GRANT_ROLES_TO_ANONYMOUS_USER = 3876;
	exports.ER_SECONDARY_ENGINE_PLUGIN = 3877;
	exports.ER_SECOND_PASSWORD_CANNOT_BE_EMPTY = 3878;
	exports.ER_DB_ACCESS_DENIED = 3879;
	exports.ER_DA_AUTH_ID_WITH_SYSTEM_USER_PRIV_IN_MANDATORY_ROLES = 3880;
	exports.ER_DA_RPL_GTID_TABLE_CANNOT_OPEN = 3881;
	exports.ER_GEOMETRY_IN_UNKNOWN_LENGTH_UNIT = 3882;
	exports.ER_DA_PLUGIN_INSTALL_ERROR = 3883;
	exports.ER_NO_SESSION_TEMP = 3884;
	exports.ER_DA_UNKNOWN_ERROR_NUMBER = 3885;
	exports.ER_COLUMN_CHANGE_SIZE = 3886;
	exports.ER_REGEXP_INVALID_CAPTURE_GROUP_NAME = 3887;
	exports.ER_DA_SSL_LIBRARY_ERROR = 3888;
	exports.ER_SECONDARY_ENGINE = 3889;
	exports.ER_SECONDARY_ENGINE_DDL = 3890;
	exports.ER_INCORRECT_CURRENT_PASSWORD = 3891;
	exports.ER_MISSING_CURRENT_PASSWORD = 3892;
	exports.ER_CURRENT_PASSWORD_NOT_REQUIRED = 3893;
	exports.ER_PASSWORD_CANNOT_BE_RETAINED_ON_PLUGIN_CHANGE = 3894;
	exports.ER_CURRENT_PASSWORD_CANNOT_BE_RETAINED = 3895;
	exports.ER_PARTIAL_REVOKES_EXIST = 3896;
	exports.ER_CANNOT_GRANT_SYSTEM_PRIV_TO_MANDATORY_ROLE = 3897;
	exports.ER_XA_REPLICATION_FILTERS = 3898;
	exports.ER_UNSUPPORTED_SQL_MODE = 3899;
	exports.ER_REGEXP_INVALID_FLAG = 3900;
	exports.ER_PARTIAL_REVOKE_AND_DB_GRANT_BOTH_EXISTS = 3901;
	exports.ER_UNIT_NOT_FOUND = 3902;
	exports.ER_INVALID_JSON_VALUE_FOR_FUNC_INDEX = 3903;
	exports.ER_JSON_VALUE_OUT_OF_RANGE_FOR_FUNC_INDEX = 3904;
	exports.ER_EXCEEDED_MV_KEYS_NUM = 3905;
	exports.ER_EXCEEDED_MV_KEYS_SPACE = 3906;
	exports.ER_FUNCTIONAL_INDEX_DATA_IS_TOO_LONG = 3907;
	exports.ER_WRONG_MVI_VALUE = 3908;
	exports.ER_WARN_FUNC_INDEX_NOT_APPLICABLE = 3909;
	exports.ER_GRP_RPL_UDF_ERROR = 3910;
	exports.ER_UPDATE_GTID_PURGED_WITH_GR = 3911;
	exports.ER_GROUPING_ON_TIMESTAMP_IN_DST = 3912;
	exports.ER_TABLE_NAME_CAUSES_TOO_LONG_PATH = 3913;
	exports.ER_AUDIT_LOG_INSUFFICIENT_PRIVILEGE = 3914;
	exports.ER_AUDIT_LOG_PASSWORD_HAS_BEEN_COPIED = 3915;
	exports.ER_DA_GRP_RPL_STARTED_AUTO_REJOIN = 3916;
	exports.ER_SYSVAR_CHANGE_DURING_QUERY = 3917;
	exports.ER_GLOBSTAT_CHANGE_DURING_QUERY = 3918;
	exports.ER_GRP_RPL_MESSAGE_SERVICE_INIT_FAILURE = 3919;
	exports.ER_CHANGE_SOURCE_WRONG_COMPRESSION_ALGORITHM_CLIENT = 3920;
	exports.ER_CHANGE_SOURCE_WRONG_COMPRESSION_LEVEL_CLIENT = 3921;
	exports.ER_WRONG_COMPRESSION_ALGORITHM_CLIENT = 3922;
	exports.ER_WRONG_COMPRESSION_LEVEL_CLIENT = 3923;
	exports.ER_CHANGE_SOURCE_WRONG_COMPRESSION_ALGORITHM_LIST_CLIENT = 3924;
	exports.ER_CLIENT_PRIVILEGE_CHECKS_USER_CANNOT_BE_ANONYMOUS = 3925;
	exports.ER_CLIENT_PRIVILEGE_CHECKS_USER_DOES_NOT_EXIST = 3926;
	exports.ER_CLIENT_PRIVILEGE_CHECKS_USER_CORRUPT = 3927;
	exports.ER_CLIENT_PRIVILEGE_CHECKS_USER_NEEDS_RPL_APPLIER_PRIV = 3928;
	exports.ER_WARN_DA_PRIVILEGE_NOT_REGISTERED = 3929;
	exports.ER_CLIENT_KEYRING_UDF_KEY_INVALID = 3930;
	exports.ER_CLIENT_KEYRING_UDF_KEY_TYPE_INVALID = 3931;
	exports.ER_CLIENT_KEYRING_UDF_KEY_TOO_LONG = 3932;
	exports.ER_CLIENT_KEYRING_UDF_KEY_TYPE_TOO_LONG = 3933;
	exports.ER_JSON_SCHEMA_VALIDATION_ERROR_WITH_DETAILED_REPORT = 3934;
	exports.ER_DA_UDF_INVALID_CHARSET_SPECIFIED = 3935;
	exports.ER_DA_UDF_INVALID_CHARSET = 3936;
	exports.ER_DA_UDF_INVALID_COLLATION = 3937;
	exports.ER_DA_UDF_INVALID_EXTENSION_ARGUMENT_TYPE = 3938;
	exports.ER_MULTIPLE_CONSTRAINTS_WITH_SAME_NAME = 3939;
	exports.ER_CONSTRAINT_NOT_FOUND = 3940;
	exports.ER_ALTER_CONSTRAINT_ENFORCEMENT_NOT_SUPPORTED = 3941;
	exports.ER_TABLE_VALUE_CONSTRUCTOR_MUST_HAVE_COLUMNS = 3942;
	exports.ER_TABLE_VALUE_CONSTRUCTOR_CANNOT_HAVE_DEFAULT = 3943;
	exports.ER_CLIENT_QUERY_FAILURE_INVALID_NON_ROW_FORMAT = 3944;
	exports.ER_REQUIRE_ROW_FORMAT_INVALID_VALUE = 3945;
	exports.ER_FAILED_TO_DETERMINE_IF_ROLE_IS_MANDATORY = 3946;
	exports.ER_FAILED_TO_FETCH_MANDATORY_ROLE_LIST = 3947;
	exports.ER_CLIENT_LOCAL_FILES_DISABLED = 3948;
	exports.ER_IMP_INCOMPATIBLE_CFG_VERSION = 3949;
	exports.ER_DA_OOM = 3950;
	exports.ER_DA_UDF_INVALID_ARGUMENT_TO_SET_CHARSET = 3951;
	exports.ER_DA_UDF_INVALID_RETURN_TYPE_TO_SET_CHARSET = 3952;
	exports.ER_MULTIPLE_INTO_CLAUSES = 3953;
	exports.ER_MISPLACED_INTO = 3954;
	exports.ER_USER_ACCESS_DENIED_FOR_USER_ACCOUNT_BLOCKED_BY_PASSWORD_LOCK = 3955;
	exports.ER_WARN_DEPRECATED_YEAR_UNSIGNED = 3956;
	exports.ER_CLONE_NETWORK_PACKET = 3957;
	exports.ER_SDI_OPERATION_FAILED_MISSING_RECORD = 3958;
	exports.ER_DEPENDENT_BY_CHECK_CONSTRAINT = 3959;
	exports.ER_GRP_OPERATION_NOT_ALLOWED_GR_MUST_STOP = 3960;
	exports.ER_WARN_DEPRECATED_JSON_TABLE_ON_ERROR_ON_EMPTY = 3961;
	exports.ER_WARN_DEPRECATED_INNER_INTO = 3962;
	exports.ER_WARN_DEPRECATED_VALUES_FUNCTION_ALWAYS_NULL = 3963;
	exports.ER_WARN_DEPRECATED_SQL_CALC_FOUND_ROWS = 3964;
	exports.ER_WARN_DEPRECATED_FOUND_ROWS = 3965;
	exports.ER_MISSING_JSON_VALUE = 3966;
	exports.ER_MULTIPLE_JSON_VALUES = 3967;
	exports.ER_HOSTNAME_TOO_LONG = 3968;
	exports.ER_WARN_CLIENT_DEPRECATED_PARTITION_PREFIX_KEY = 3969;
	exports.ER_GROUP_REPLICATION_USER_EMPTY_MSG = 3970;
	exports.ER_GROUP_REPLICATION_USER_MANDATORY_MSG = 3971;
	exports.ER_GROUP_REPLICATION_PASSWORD_LENGTH = 3972;
	exports.ER_SUBQUERY_TRANSFORM_REJECTED = 3973;
	exports.ER_DA_GRP_RPL_RECOVERY_ENDPOINT_FORMAT = 3974;
	exports.ER_DA_GRP_RPL_RECOVERY_ENDPOINT_INVALID = 3975;
	exports.ER_WRONG_VALUE_FOR_VAR_PLUS_ACTIONABLE_PART = 3976;
	exports.ER_STATEMENT_NOT_ALLOWED_AFTER_START_TRANSACTION = 3977;
	exports.ER_FOREIGN_KEY_WITH_ATOMIC_CREATE_SELECT = 3978;
	exports.ER_NOT_ALLOWED_WITH_START_TRANSACTION = 3979;
	exports.ER_INVALID_JSON_ATTRIBUTE = 3980;
	exports.ER_ENGINE_ATTRIBUTE_NOT_SUPPORTED = 3981;
	exports.ER_INVALID_USER_ATTRIBUTE_JSON = 3982;
	exports.ER_INNODB_REDO_DISABLED = 3983;
	exports.ER_INNODB_REDO_ARCHIVING_ENABLED = 3984;
	exports.ER_MDL_OUT_OF_RESOURCES = 3985;
	exports.ER_IMPLICIT_COMPARISON_FOR_JSON = 3986;
	exports.ER_FUNCTION_DOES_NOT_SUPPORT_CHARACTER_SET = 3987;
	exports.ER_IMPOSSIBLE_STRING_CONVERSION = 3988;
	exports.ER_SCHEMA_READ_ONLY = 3989;
	exports.ER_RPL_ASYNC_RECONNECT_GTID_MODE_OFF = 3990;
	exports.ER_RPL_ASYNC_RECONNECT_AUTO_POSITION_OFF = 3991;
	exports.ER_DISABLE_GTID_MODE_REQUIRES_ASYNC_RECONNECT_OFF = 3992;
	exports.ER_DISABLE_AUTO_POSITION_REQUIRES_ASYNC_RECONNECT_OFF = 3993;
	exports.ER_INVALID_PARAMETER_USE = 3994;
	exports.ER_CHARACTER_SET_MISMATCH = 3995;
	exports.ER_WARN_VAR_VALUE_CHANGE_NOT_SUPPORTED = 3996;
	exports.ER_INVALID_TIME_ZONE_INTERVAL = 3997;
	exports.ER_INVALID_CAST = 3998;
	exports.ER_HYPERGRAPH_NOT_SUPPORTED_YET = 3999;
	exports.ER_WARN_HYPERGRAPH_EXPERIMENTAL = 4e3;
	exports.ER_DA_NO_ERROR_LOG_PARSER_CONFIGURED = 4001;
	exports.ER_DA_ERROR_LOG_TABLE_DISABLED = 4002;
	exports.ER_DA_ERROR_LOG_MULTIPLE_FILTERS = 4003;
	exports.ER_DA_CANT_OPEN_ERROR_LOG = 4004;
	exports.ER_USER_REFERENCED_AS_DEFINER = 4005;
	exports.ER_CANNOT_USER_REFERENCED_AS_DEFINER = 4006;
	exports.ER_REGEX_NUMBER_TOO_BIG = 4007;
	exports.ER_SPVAR_NONINTEGER_TYPE = 4008;
	exports.WARN_UNSUPPORTED_ACL_TABLES_READ = 4009;
	exports.ER_BINLOG_UNSAFE_ACL_TABLE_READ_IN_DML_DDL = 4010;
	exports.ER_STOP_REPLICA_MONITOR_IO_THREAD_TIMEOUT = 4011;
	exports.ER_STARTING_REPLICA_MONITOR_IO_THREAD = 4012;
	exports.ER_CANT_USE_ANONYMOUS_TO_GTID_WITH_GTID_MODE_NOT_ON = 4013;
	exports.ER_CANT_COMBINE_ANONYMOUS_TO_GTID_AND_AUTOPOSITION = 4014;
	exports.ER_ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS_REQUIRES_GTID_MODE_ON = 4015;
	exports.ER_SQL_REPLICA_SKIP_COUNTER_USED_WITH_GTID_MODE_ON = 4016;
	exports.ER_USING_ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS_AS_LOCAL_OR_UUID = 4017;
	exports.ER_CANT_SET_ANONYMOUS_TO_GTID_AND_WAIT_UNTIL_SQL_THD_AFTER_GTIDS = 4018;
	exports.ER_CANT_SET_SQL_AFTER_OR_BEFORE_GTIDS_WITH_ANONYMOUS_TO_GTID = 4019;
	exports.ER_ANONYMOUS_TO_GTID_UUID_SAME_AS_GROUP_NAME = 4020;
	exports.ER_CANT_USE_SAME_UUID_AS_GROUP_NAME = 4021;
	exports.ER_GRP_RPL_RECOVERY_CHANNEL_STILL_RUNNING = 4022;
	exports.ER_INNODB_INVALID_AUTOEXTEND_SIZE_VALUE = 4023;
	exports.ER_INNODB_INCOMPATIBLE_WITH_TABLESPACE = 4024;
	exports.ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE = 4025;
	exports.ER_CANNOT_USE_AUTOEXTEND_SIZE_CLAUSE = 4026;
	exports.ER_ROLE_GRANTED_TO_ITSELF = 4027;
	exports.ER_TABLE_MUST_HAVE_A_VISIBLE_COLUMN = 4028;
	exports.ER_INNODB_COMPRESSION_FAILURE = 4029;
	exports.ER_WARN_ASYNC_CONN_FAILOVER_NETWORK_NAMESPACE = 4030;
	exports.ER_CLIENT_INTERACTION_TIMEOUT = 4031;
	exports.ER_INVALID_CAST_TO_GEOMETRY = 4032;
	exports.ER_INVALID_CAST_POLYGON_RING_DIRECTION = 4033;
	exports.ER_GIS_DIFFERENT_SRIDS_AGGREGATION = 4034;
	exports.ER_RELOAD_KEYRING_FAILURE = 4035;
	exports.ER_SDI_GET_KEYS_INVALID_TABLESPACE = 4036;
	exports.ER_CHANGE_RPL_SRC_WRONG_COMPRESSION_ALGORITHM_SIZE = 4037;
	exports.ER_WARN_DEPRECATED_TLS_VERSION_FOR_CHANNEL_CLI = 4038;
	exports.ER_CANT_USE_SAME_UUID_AS_VIEW_CHANGE_UUID = 4039;
	exports.ER_ANONYMOUS_TO_GTID_UUID_SAME_AS_VIEW_CHANGE_UUID = 4040;
	exports.ER_GRP_RPL_VIEW_CHANGE_UUID_FAIL_GET_VARIABLE = 4041;
	exports.ER_WARN_ADUIT_LOG_MAX_SIZE_AND_PRUNE_SECONDS = 4042;
	exports.ER_WARN_ADUIT_LOG_MAX_SIZE_CLOSE_TO_ROTATE_ON_SIZE = 4043;
	exports.ER_KERBEROS_CREATE_USER = 4044;
	exports.ER_INSTALL_PLUGIN_CONFLICT_CLIENT = 4045;
	exports.ER_DA_ERROR_LOG_COMPONENT_FLUSH_FAILED = 4046;
	exports.ER_WARN_SQL_AFTER_MTS_GAPS_GAP_NOT_CALCULATED = 4047;
	exports.ER_INVALID_ASSIGNMENT_TARGET = 4048;
	exports.ER_OPERATION_NOT_ALLOWED_ON_GR_SECONDARY = 4049;
	exports.ER_GRP_RPL_FAILOVER_CHANNEL_STATUS_PROPAGATION = 4050;
	exports.ER_WARN_AUDIT_LOG_FORMAT_UNIX_TIMESTAMP_ONLY_WHEN_JSON = 4051;
	exports.ER_INVALID_MFA_PLUGIN_SPECIFIED = 4052;
	exports.ER_IDENTIFIED_BY_UNSUPPORTED = 4053;
	exports.ER_INVALID_PLUGIN_FOR_REGISTRATION = 4054;
	exports.ER_PLUGIN_REQUIRES_REGISTRATION = 4055;
	exports.ER_MFA_METHOD_EXISTS = 4056;
	exports.ER_MFA_METHOD_NOT_EXISTS = 4057;
	exports.ER_AUTHENTICATION_POLICY_MISMATCH = 4058;
	exports.ER_PLUGIN_REGISTRATION_DONE = 4059;
	exports.ER_INVALID_USER_FOR_REGISTRATION = 4060;
	exports.ER_USER_REGISTRATION_FAILED = 4061;
	exports.ER_MFA_METHODS_INVALID_ORDER = 4062;
	exports.ER_MFA_METHODS_IDENTICAL = 4063;
	exports.ER_INVALID_MFA_OPERATIONS_FOR_PASSWORDLESS_USER = 4064;
	exports.ER_CHANGE_REPLICATION_SOURCE_NO_OPTIONS_FOR_GTID_ONLY = 4065;
	exports.ER_CHANGE_REP_SOURCE_CANT_DISABLE_REQ_ROW_FORMAT_WITH_GTID_ONLY = 4066;
	exports.ER_CHANGE_REP_SOURCE_CANT_DISABLE_AUTO_POSITION_WITH_GTID_ONLY = 4067;
	exports.ER_CHANGE_REP_SOURCE_CANT_DISABLE_GTID_ONLY_WITHOUT_POSITIONS = 4068;
	exports.ER_CHANGE_REP_SOURCE_CANT_DISABLE_AUTO_POS_WITHOUT_POSITIONS = 4069;
	exports.ER_CHANGE_REP_SOURCE_GR_CHANNEL_WITH_GTID_MODE_NOT_ON = 4070;
	exports.ER_CANT_USE_GTID_ONLY_WITH_GTID_MODE_NOT_ON = 4071;
	exports.ER_WARN_C_DISABLE_GTID_ONLY_WITH_SOURCE_AUTO_POS_INVALID_POS = 4072;
	exports.ER_DA_SSL_FIPS_MODE_ERROR = 4073;
	exports.ER_VALUE_OUT_OF_RANGE = 4074;
	exports.ER_FULLTEXT_WITH_ROLLUP = 4075;
	exports.ER_REGEXP_MISSING_RESOURCE = 4076;
	exports.ER_WARN_REGEXP_USING_DEFAULT = 4077;
	exports.ER_REGEXP_MISSING_FILE = 4078;
	exports.ER_WARN_DEPRECATED_COLLATION = 4079;
	exports.ER_CONCURRENT_PROCEDURE_USAGE = 4080;
	exports.ER_DA_GLOBAL_CONN_LIMIT = 4081;
	exports.ER_DA_CONN_LIMIT = 4082;
	exports.ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COLUMN_TYPE_INSTANT = 4083;
	exports.ER_WARN_SF_UDF_NAME_COLLISION = 4084;
	exports.ER_CANNOT_PURGE_BINLOG_WITH_BACKUP_LOCK = 4085;
	exports.ER_TOO_MANY_WINDOWS = 4086;
	exports.ER_MYSQLBACKUP_CLIENT_MSG = 4087;
	exports.ER_COMMENT_CONTAINS_INVALID_STRING = 4088;
	exports.ER_DEFINITION_CONTAINS_INVALID_STRING = 4089;
	exports.ER_CANT_EXECUTE_COMMAND_WITH_ASSIGNED_GTID_NEXT = 4090;
	exports.ER_XA_TEMP_TABLE = 4091;
	exports.ER_INNODB_MAX_ROW_VERSION = 4092;
	exports.ER_INNODB_INSTANT_ADD_NOT_SUPPORTED_MAX_SIZE = 4093;
	exports.ER_OPERATION_NOT_ALLOWED_WHILE_PRIMARY_CHANGE_IS_RUNNING = 4094;
	exports.ER_WARN_DEPRECATED_DATETIME_DELIMITER = 4095;
	exports.ER_WARN_DEPRECATED_SUPERFLUOUS_DELIMITER = 4096;
	exports.ER_CANNOT_PERSIST_SENSITIVE_VARIABLES = 4097;
	exports.ER_WARN_CANNOT_SECURELY_PERSIST_SENSITIVE_VARIABLES = 4098;
	exports.ER_WARN_TRG_ALREADY_EXISTS = 4099;
	exports.ER_IF_NOT_EXISTS_UNSUPPORTED_TRG_EXISTS_ON_DIFFERENT_TABLE = 4100;
	exports.ER_IF_NOT_EXISTS_UNSUPPORTED_UDF_NATIVE_FCT_NAME_COLLISION = 4101;
	exports.ER_SET_PASSWORD_AUTH_PLUGIN_ERROR = 4102;
	exports.ER_REDUCED_DBLWR_FILE_CORRUPTED = 4103;
	exports.ER_REDUCED_DBLWR_PAGE_FOUND = 4104;
	exports.ER_SRS_INVALID_LATITUDE_OF_ORIGIN = 4105;
	exports.ER_SRS_INVALID_LONGITUDE_OF_ORIGIN = 4106;
	exports.ER_SRS_UNUSED_PROJ_PARAMETER_PRESENT = 4107;
	exports.ER_GIPK_COLUMN_EXISTS = 4108;
	exports.ER_GIPK_FAILED_AUTOINC_COLUMN_EXISTS = 4109;
	exports.ER_GIPK_COLUMN_ALTER_NOT_ALLOWED = 4110;
	exports.ER_DROP_PK_COLUMN_TO_DROP_GIPK = 4111;
	exports.ER_CREATE_SELECT_WITH_GIPK_DISALLOWED_IN_SBR = 4112;
	exports.ER_DA_EXPIRE_LOGS_DAYS_IGNORED = 4113;
	exports.ER_CTE_RECURSIVE_NOT_UNION = 4114;
	exports.ER_COMMAND_BACKEND_FAILED_TO_FETCH_SECURITY_CTX = 4115;
	exports.ER_COMMAND_SERVICE_BACKEND_FAILED = 4116;
	exports.ER_CLIENT_FILE_PRIVILEGE_FOR_REPLICATION_CHECKS = 4117;
	exports.ER_GROUP_REPLICATION_FORCE_MEMBERS_COMMAND_FAILURE = 4118;
	exports.ER_WARN_DEPRECATED_IDENT = 4119;
	exports.ER_INTERSECT_ALL_MAX_DUPLICATES_EXCEEDED = 4120;
	exports.ER_TP_QUERY_THRS_PER_GRP_EXCEEDS_TXN_THR_LIMIT = 4121;
	exports.ER_BAD_TIMESTAMP_FORMAT = 4122;
	exports.ER_SHAPE_PRIDICTION_UDF = 4123;
	exports.ER_SRS_INVALID_HEIGHT = 4124;
	exports.ER_SRS_INVALID_SCALING = 4125;
	exports.ER_SRS_INVALID_ZONE_WIDTH = 4126;
	exports.ER_SRS_INVALID_LATITUDE_POLAR_STERE_VAR_A = 4127;
	exports.ER_WARN_DEPRECATED_CLIENT_NO_SCHEMA_OPTION = 4128;
	exports.ER_TABLE_NOT_EMPTY = 4129;
	exports.ER_TABLE_NO_PRIMARY_KEY = 4130;
	exports.ER_TABLE_IN_SHARED_TABLESPACE = 4131;
	exports.ER_INDEX_OTHER_THAN_PK = 4132;
	exports.ER_LOAD_BULK_DATA_UNSORTED = 4133;
	exports.ER_BULK_EXECUTOR_ERROR = 4134;
	exports.ER_BULK_READER_LIBCURL_INIT_FAILED = 4135;
	exports.ER_BULK_READER_LIBCURL_ERROR = 4136;
	exports.ER_BULK_READER_SERVER_ERROR = 4137;
	exports.ER_BULK_READER_COMMUNICATION_ERROR = 4138;
	exports.ER_BULK_LOAD_DATA_FAILED = 4139;
	exports.ER_BULK_LOADER_COLUMN_TOO_BIG_FOR_LEFTOVER_BUFFER = 4140;
	exports.ER_BULK_LOADER_COMPONENT_ERROR = 4141;
	exports.ER_BULK_LOADER_FILE_CONTAINS_LESS_LINES_THAN_IGNORE_CLAUSE = 4142;
	exports.ER_BULK_PARSER_MISSING_ENCLOSED_BY = 4143;
	exports.ER_BULK_PARSER_ROW_BUFFER_MAX_TOTAL_COLS_EXCEEDED = 4144;
	exports.ER_BULK_PARSER_COPY_BUFFER_SIZE_EXCEEDED = 4145;
	exports.ER_BULK_PARSER_UNEXPECTED_END_OF_INPUT = 4146;
	exports.ER_BULK_PARSER_UNEXPECTED_ROW_TERMINATOR = 4147;
	exports.ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_ENDING_ENCLOSED_BY = 4148;
	exports.ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_NULL_ESCAPE = 4149;
	exports.ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_COLUMN_TERMINATOR = 4150;
	exports.ER_BULK_PARSER_INCOMPLETE_ESCAPE_SEQUENCE = 4151;
	exports.ER_LOAD_BULK_DATA_FAILED = 4152;
	exports.ER_LOAD_BULK_DATA_WRONG_VALUE_FOR_FIELD = 4153;
	exports.ER_LOAD_BULK_DATA_WARN_NULL_TO_NOTNULL = 4154;
	exports.ER_REQUIRE_TABLE_PRIMARY_KEY_CHECK_GENERATE_WITH_GR = 4155;
	exports.ER_CANT_CHANGE_SYS_VAR_IN_READ_ONLY_MODE = 4156;
	exports.ER_INNODB_INSTANT_ADD_DROP_NOT_SUPPORTED_MAX_SIZE = 4157;
	exports.ER_INNODB_INSTANT_ADD_NOT_SUPPORTED_MAX_FIELDS = 4158;
	exports.ER_CANT_SET_PERSISTED = 4159;
	exports.ER_INSTALL_COMPONENT_SET_NULL_VALUE = 4160;
	exports.ER_INSTALL_COMPONENT_SET_UNUSED_VALUE = 4161;
	exports.ER_WARN_DEPRECATED_USER_DEFINED_COLLATIONS = 4162;
	exports[1] = "EE_CANTCREATEFILE";
	exports[2] = "EE_READ";
	exports[3] = "EE_WRITE";
	exports[4] = "EE_BADCLOSE";
	exports[5] = "EE_OUTOFMEMORY";
	exports[6] = "EE_DELETE";
	exports[7] = "EE_LINK";
	exports[9] = "EE_EOFERR";
	exports[10] = "EE_CANTLOCK";
	exports[11] = "EE_CANTUNLOCK";
	exports[12] = "EE_DIR";
	exports[13] = "EE_STAT";
	exports[14] = "EE_CANT_CHSIZE";
	exports[15] = "EE_CANT_OPEN_STREAM";
	exports[16] = "EE_GETWD";
	exports[17] = "EE_SETWD";
	exports[18] = "EE_LINK_WARNING";
	exports[19] = "EE_OPEN_WARNING";
	exports[20] = "EE_DISK_FULL";
	exports[21] = "EE_CANT_MKDIR";
	exports[22] = "EE_UNKNOWN_CHARSET";
	exports[23] = "EE_OUT_OF_FILERESOURCES";
	exports[24] = "EE_CANT_READLINK";
	exports[25] = "EE_CANT_SYMLINK";
	exports[26] = "EE_REALPATH";
	exports[27] = "EE_SYNC";
	exports[28] = "EE_UNKNOWN_COLLATION";
	exports[29] = "EE_FILENOTFOUND";
	exports[30] = "EE_FILE_NOT_CLOSED";
	exports[31] = "EE_CHANGE_OWNERSHIP";
	exports[32] = "EE_CHANGE_PERMISSIONS";
	exports[33] = "EE_CANT_SEEK";
	exports[34] = "EE_CAPACITY_EXCEEDED";
	exports[35] = "EE_DISK_FULL_WITH_RETRY_MSG";
	exports[36] = "EE_FAILED_TO_CREATE_TIMER";
	exports[37] = "EE_FAILED_TO_DELETE_TIMER";
	exports[38] = "EE_FAILED_TO_CREATE_TIMER_QUEUE";
	exports[39] = "EE_FAILED_TO_START_TIMER_NOTIFY_THREAD";
	exports[40] = "EE_FAILED_TO_CREATE_TIMER_NOTIFY_THREAD_INTERRUPT_EVENT";
	exports[41] = "EE_EXITING_TIMER_NOTIFY_THREAD";
	exports[42] = "EE_WIN_LIBRARY_LOAD_FAILED";
	exports[43] = "EE_WIN_RUN_TIME_ERROR_CHECK";
	exports[44] = "EE_FAILED_TO_DETERMINE_LARGE_PAGE_SIZE";
	exports[45] = "EE_FAILED_TO_KILL_ALL_THREADS";
	exports[46] = "EE_FAILED_TO_CREATE_IO_COMPLETION_PORT";
	exports[47] = "EE_FAILED_TO_OPEN_DEFAULTS_FILE";
	exports[48] = "EE_FAILED_TO_HANDLE_DEFAULTS_FILE";
	exports[49] = "EE_WRONG_DIRECTIVE_IN_CONFIG_FILE";
	exports[50] = "EE_SKIPPING_DIRECTIVE_DUE_TO_MAX_INCLUDE_RECURSION";
	exports[51] = "EE_INCORRECT_GRP_DEFINITION_IN_CONFIG_FILE";
	exports[52] = "EE_OPTION_WITHOUT_GRP_IN_CONFIG_FILE";
	exports[53] = "EE_CONFIG_FILE_PERMISSION_ERROR";
	exports[54] = "EE_IGNORE_WORLD_WRITABLE_CONFIG_FILE";
	exports[55] = "EE_USING_DISABLED_OPTION";
	exports[56] = "EE_USING_DISABLED_SHORT_OPTION";
	exports[57] = "EE_USING_PASSWORD_ON_CLI_IS_INSECURE";
	exports[58] = "EE_UNKNOWN_SUFFIX_FOR_VARIABLE";
	exports[59] = "EE_SSL_ERROR_FROM_FILE";
	exports[60] = "EE_SSL_ERROR";
	exports[61] = "EE_NET_SEND_ERROR_IN_BOOTSTRAP";
	exports[62] = "EE_PACKETS_OUT_OF_ORDER";
	exports[63] = "EE_UNKNOWN_PROTOCOL_OPTION";
	exports[64] = "EE_FAILED_TO_LOCATE_SERVER_PUBLIC_KEY";
	exports[65] = "EE_PUBLIC_KEY_NOT_IN_PEM_FORMAT";
	exports[66] = "EE_DEBUG_INFO";
	exports[67] = "EE_UNKNOWN_VARIABLE";
	exports[68] = "EE_UNKNOWN_OPTION";
	exports[69] = "EE_UNKNOWN_SHORT_OPTION";
	exports[70] = "EE_OPTION_WITHOUT_ARGUMENT";
	exports[71] = "EE_OPTION_REQUIRES_ARGUMENT";
	exports[72] = "EE_SHORT_OPTION_REQUIRES_ARGUMENT";
	exports[73] = "EE_OPTION_IGNORED_DUE_TO_INVALID_VALUE";
	exports[74] = "EE_OPTION_WITH_EMPTY_VALUE";
	exports[75] = "EE_FAILED_TO_ASSIGN_MAX_VALUE_TO_OPTION";
	exports[76] = "EE_INCORRECT_BOOLEAN_VALUE_FOR_OPTION";
	exports[77] = "EE_FAILED_TO_SET_OPTION_VALUE";
	exports[78] = "EE_INCORRECT_INT_VALUE_FOR_OPTION";
	exports[79] = "EE_INCORRECT_UINT_VALUE_FOR_OPTION";
	exports[80] = "EE_ADJUSTED_SIGNED_VALUE_FOR_OPTION";
	exports[81] = "EE_ADJUSTED_UNSIGNED_VALUE_FOR_OPTION";
	exports[82] = "EE_ADJUSTED_ULONGLONG_VALUE_FOR_OPTION";
	exports[83] = "EE_ADJUSTED_DOUBLE_VALUE_FOR_OPTION";
	exports[84] = "EE_INVALID_DECIMAL_VALUE_FOR_OPTION";
	exports[85] = "EE_COLLATION_PARSER_ERROR";
	exports[86] = "EE_FAILED_TO_RESET_BEFORE_PRIMARY_IGNORABLE_CHAR";
	exports[87] = "EE_FAILED_TO_RESET_BEFORE_TERTIARY_IGNORABLE_CHAR";
	exports[88] = "EE_SHIFT_CHAR_OUT_OF_RANGE";
	exports[89] = "EE_RESET_CHAR_OUT_OF_RANGE";
	exports[90] = "EE_UNKNOWN_LDML_TAG";
	exports[91] = "EE_FAILED_TO_RESET_BEFORE_SECONDARY_IGNORABLE_CHAR";
	exports[92] = "EE_FAILED_PROCESSING_DIRECTIVE";
	exports[93] = "EE_PTHREAD_KILL_FAILED";
	exports[120] = "HA_ERR_KEY_NOT_FOUND";
	exports[121] = "HA_ERR_FOUND_DUPP_KEY";
	exports[122] = "HA_ERR_INTERNAL_ERROR";
	exports[123] = "HA_ERR_RECORD_CHANGED";
	exports[124] = "HA_ERR_WRONG_INDEX";
	exports[125] = "HA_ERR_ROLLED_BACK";
	exports[126] = "HA_ERR_CRASHED";
	exports[127] = "HA_ERR_WRONG_IN_RECORD";
	exports[128] = "HA_ERR_OUT_OF_MEM";
	exports[130] = "HA_ERR_NOT_A_TABLE";
	exports[131] = "HA_ERR_WRONG_COMMAND";
	exports[132] = "HA_ERR_OLD_FILE";
	exports[133] = "HA_ERR_NO_ACTIVE_RECORD";
	exports[134] = "HA_ERR_RECORD_DELETED";
	exports[135] = "HA_ERR_RECORD_FILE_FULL";
	exports[136] = "HA_ERR_INDEX_FILE_FULL";
	exports[137] = "HA_ERR_END_OF_FILE";
	exports[138] = "HA_ERR_UNSUPPORTED";
	exports[139] = "HA_ERR_TOO_BIG_ROW";
	exports[140] = "HA_WRONG_CREATE_OPTION";
	exports[141] = "HA_ERR_FOUND_DUPP_UNIQUE";
	exports[142] = "HA_ERR_UNKNOWN_CHARSET";
	exports[143] = "HA_ERR_WRONG_MRG_TABLE_DEF";
	exports[144] = "HA_ERR_CRASHED_ON_REPAIR";
	exports[145] = "HA_ERR_CRASHED_ON_USAGE";
	exports[146] = "HA_ERR_LOCK_WAIT_TIMEOUT";
	exports[147] = "HA_ERR_LOCK_TABLE_FULL";
	exports[148] = "HA_ERR_READ_ONLY_TRANSACTION";
	exports[149] = "HA_ERR_LOCK_DEADLOCK";
	exports[150] = "HA_ERR_CANNOT_ADD_FOREIGN";
	exports[151] = "HA_ERR_NO_REFERENCED_ROW";
	exports[152] = "HA_ERR_ROW_IS_REFERENCED";
	exports[153] = "HA_ERR_NO_SAVEPOINT";
	exports[154] = "HA_ERR_NON_UNIQUE_BLOCK_SIZE";
	exports[155] = "HA_ERR_NO_SUCH_TABLE";
	exports[156] = "HA_ERR_TABLE_EXIST";
	exports[157] = "HA_ERR_NO_CONNECTION";
	exports[158] = "HA_ERR_NULL_IN_SPATIAL";
	exports[159] = "HA_ERR_TABLE_DEF_CHANGED";
	exports[160] = "HA_ERR_NO_PARTITION_FOUND";
	exports[161] = "HA_ERR_RBR_LOGGING_FAILED";
	exports[162] = "HA_ERR_DROP_INDEX_FK";
	exports[163] = "HA_ERR_FOREIGN_DUPLICATE_KEY";
	exports[164] = "HA_ERR_TABLE_NEEDS_UPGRADE";
	exports[165] = "HA_ERR_TABLE_READONLY";
	exports[166] = "HA_ERR_AUTOINC_READ_FAILED";
	exports[167] = "HA_ERR_AUTOINC_ERANGE";
	exports[168] = "HA_ERR_GENERIC";
	exports[169] = "HA_ERR_RECORD_IS_THE_SAME";
	exports[170] = "HA_ERR_LOGGING_IMPOSSIBLE";
	exports[171] = "HA_ERR_CORRUPT_EVENT";
	exports[172] = "HA_ERR_NEW_FILE";
	exports[173] = "HA_ERR_ROWS_EVENT_APPLY";
	exports[174] = "HA_ERR_INITIALIZATION";
	exports[175] = "HA_ERR_FILE_TOO_SHORT";
	exports[176] = "HA_ERR_WRONG_CRC";
	exports[177] = "HA_ERR_TOO_MANY_CONCURRENT_TRXS";
	exports[178] = "HA_ERR_NOT_IN_LOCK_PARTITIONS";
	exports[179] = "HA_ERR_INDEX_COL_TOO_LONG";
	exports[180] = "HA_ERR_INDEX_CORRUPT";
	exports[181] = "HA_ERR_UNDO_REC_TOO_BIG";
	exports[182] = "HA_FTS_INVALID_DOCID";
	exports[183] = "HA_ERR_TABLE_IN_FK_CHECK";
	exports[184] = "HA_ERR_TABLESPACE_EXISTS";
	exports[185] = "HA_ERR_TOO_MANY_FIELDS";
	exports[186] = "HA_ERR_ROW_IN_WRONG_PARTITION";
	exports[187] = "HA_ERR_INNODB_READ_ONLY";
	exports[188] = "HA_ERR_FTS_EXCEED_RESULT_CACHE_LIMIT";
	exports[189] = "HA_ERR_TEMP_FILE_WRITE_FAILURE";
	exports[190] = "HA_ERR_INNODB_FORCED_RECOVERY";
	exports[191] = "HA_ERR_FTS_TOO_MANY_WORDS_IN_PHRASE";
	exports[192] = "HA_ERR_FK_DEPTH_EXCEEDED";
	exports[193] = "HA_MISSING_CREATE_OPTION";
	exports[194] = "HA_ERR_SE_OUT_OF_MEMORY";
	exports[195] = "HA_ERR_TABLE_CORRUPT";
	exports[196] = "HA_ERR_QUERY_INTERRUPTED";
	exports[197] = "HA_ERR_TABLESPACE_MISSING";
	exports[198] = "HA_ERR_TABLESPACE_IS_NOT_EMPTY";
	exports[199] = "HA_ERR_WRONG_FILE_NAME";
	exports[200] = "HA_ERR_NOT_ALLOWED_COMMAND";
	exports[201] = "HA_ERR_COMPUTE_FAILED";
	exports[202] = "HA_ERR_ROW_FORMAT_CHANGED";
	exports[203] = "HA_ERR_NO_WAIT_LOCK";
	exports[204] = "HA_ERR_DISK_FULL_NOWAIT";
	exports[205] = "HA_ERR_NO_SESSION_TEMP";
	exports[206] = "HA_ERR_WRONG_TABLE_NAME";
	exports[207] = "HA_ERR_TOO_LONG_PATH";
	exports[208] = "HA_ERR_SAMPLING_INIT_FAILED";
	exports[209] = "HA_ERR_FTS_TOO_MANY_NESTED_EXP";
	exports[1e3] = "ER_HASHCHK";
	exports[1001] = "ER_NISAMCHK";
	exports[1002] = "ER_NO";
	exports[1003] = "ER_YES";
	exports[1004] = "ER_CANT_CREATE_FILE";
	exports[1005] = "ER_CANT_CREATE_TABLE";
	exports[1006] = "ER_CANT_CREATE_DB";
	exports[1007] = "ER_DB_CREATE_EXISTS";
	exports[1008] = "ER_DB_DROP_EXISTS";
	exports[1009] = "ER_DB_DROP_DELETE";
	exports[1010] = "ER_DB_DROP_RMDIR";
	exports[1011] = "ER_CANT_DELETE_FILE";
	exports[1012] = "ER_CANT_FIND_SYSTEM_REC";
	exports[1013] = "ER_CANT_GET_STAT";
	exports[1014] = "ER_CANT_GET_WD";
	exports[1015] = "ER_CANT_LOCK";
	exports[1016] = "ER_CANT_OPEN_FILE";
	exports[1017] = "ER_FILE_NOT_FOUND";
	exports[1018] = "ER_CANT_READ_DIR";
	exports[1019] = "ER_CANT_SET_WD";
	exports[1020] = "ER_CHECKREAD";
	exports[1021] = "ER_DISK_FULL";
	exports[1022] = "ER_DUP_KEY";
	exports[1023] = "ER_ERROR_ON_CLOSE";
	exports[1024] = "ER_ERROR_ON_READ";
	exports[1025] = "ER_ERROR_ON_RENAME";
	exports[1026] = "ER_ERROR_ON_WRITE";
	exports[1027] = "ER_FILE_USED";
	exports[1028] = "ER_FILSORT_ABORT";
	exports[1029] = "ER_FORM_NOT_FOUND";
	exports[1030] = "ER_GET_ERRNO";
	exports[1031] = "ER_ILLEGAL_HA";
	exports[1032] = "ER_KEY_NOT_FOUND";
	exports[1033] = "ER_NOT_FORM_FILE";
	exports[1034] = "ER_NOT_KEYFILE";
	exports[1035] = "ER_OLD_KEYFILE";
	exports[1036] = "ER_OPEN_AS_READONLY";
	exports[1037] = "ER_OUTOFMEMORY";
	exports[1038] = "ER_OUT_OF_SORTMEMORY";
	exports[1039] = "ER_UNEXPECTED_EOF";
	exports[1040] = "ER_CON_COUNT_ERROR";
	exports[1041] = "ER_OUT_OF_RESOURCES";
	exports[1042] = "ER_BAD_HOST_ERROR";
	exports[1043] = "ER_HANDSHAKE_ERROR";
	exports[1044] = "ER_DBACCESS_DENIED_ERROR";
	exports[1045] = "ER_ACCESS_DENIED_ERROR";
	exports[1046] = "ER_NO_DB_ERROR";
	exports[1047] = "ER_UNKNOWN_COM_ERROR";
	exports[1048] = "ER_BAD_NULL_ERROR";
	exports[1049] = "ER_BAD_DB_ERROR";
	exports[1050] = "ER_TABLE_EXISTS_ERROR";
	exports[1051] = "ER_BAD_TABLE_ERROR";
	exports[1052] = "ER_NON_UNIQ_ERROR";
	exports[1053] = "ER_SERVER_SHUTDOWN";
	exports[1054] = "ER_BAD_FIELD_ERROR";
	exports[1055] = "ER_WRONG_FIELD_WITH_GROUP";
	exports[1056] = "ER_WRONG_GROUP_FIELD";
	exports[1057] = "ER_WRONG_SUM_SELECT";
	exports[1058] = "ER_WRONG_VALUE_COUNT";
	exports[1059] = "ER_TOO_LONG_IDENT";
	exports[1060] = "ER_DUP_FIELDNAME";
	exports[1061] = "ER_DUP_KEYNAME";
	exports[1062] = "ER_DUP_ENTRY";
	exports[1063] = "ER_WRONG_FIELD_SPEC";
	exports[1064] = "ER_PARSE_ERROR";
	exports[1065] = "ER_EMPTY_QUERY";
	exports[1066] = "ER_NONUNIQ_TABLE";
	exports[1067] = "ER_INVALID_DEFAULT";
	exports[1068] = "ER_MULTIPLE_PRI_KEY";
	exports[1069] = "ER_TOO_MANY_KEYS";
	exports[1070] = "ER_TOO_MANY_KEY_PARTS";
	exports[1071] = "ER_TOO_LONG_KEY";
	exports[1072] = "ER_KEY_COLUMN_DOES_NOT_EXITS";
	exports[1073] = "ER_BLOB_USED_AS_KEY";
	exports[1074] = "ER_TOO_BIG_FIELDLENGTH";
	exports[1075] = "ER_WRONG_AUTO_KEY";
	exports[1076] = "ER_READY";
	exports[1077] = "ER_NORMAL_SHUTDOWN";
	exports[1078] = "ER_GOT_SIGNAL";
	exports[1079] = "ER_SHUTDOWN_COMPLETE";
	exports[1080] = "ER_FORCING_CLOSE";
	exports[1081] = "ER_IPSOCK_ERROR";
	exports[1082] = "ER_NO_SUCH_INDEX";
	exports[1083] = "ER_WRONG_FIELD_TERMINATORS";
	exports[1084] = "ER_BLOBS_AND_NO_TERMINATED";
	exports[1085] = "ER_TEXTFILE_NOT_READABLE";
	exports[1086] = "ER_FILE_EXISTS_ERROR";
	exports[1087] = "ER_LOAD_INFO";
	exports[1088] = "ER_ALTER_INFO";
	exports[1089] = "ER_WRONG_SUB_KEY";
	exports[1090] = "ER_CANT_REMOVE_ALL_FIELDS";
	exports[1091] = "ER_CANT_DROP_FIELD_OR_KEY";
	exports[1092] = "ER_INSERT_INFO";
	exports[1093] = "ER_UPDATE_TABLE_USED";
	exports[1094] = "ER_NO_SUCH_THREAD";
	exports[1095] = "ER_KILL_DENIED_ERROR";
	exports[1096] = "ER_NO_TABLES_USED";
	exports[1097] = "ER_TOO_BIG_SET";
	exports[1098] = "ER_NO_UNIQUE_LOGFILE";
	exports[1099] = "ER_TABLE_NOT_LOCKED_FOR_WRITE";
	exports[1100] = "ER_TABLE_NOT_LOCKED";
	exports[1101] = "ER_BLOB_CANT_HAVE_DEFAULT";
	exports[1102] = "ER_WRONG_DB_NAME";
	exports[1103] = "ER_WRONG_TABLE_NAME";
	exports[1104] = "ER_TOO_BIG_SELECT";
	exports[1105] = "ER_UNKNOWN_ERROR";
	exports[1106] = "ER_UNKNOWN_PROCEDURE";
	exports[1107] = "ER_WRONG_PARAMCOUNT_TO_PROCEDURE";
	exports[1108] = "ER_WRONG_PARAMETERS_TO_PROCEDURE";
	exports[1109] = "ER_UNKNOWN_TABLE";
	exports[1110] = "ER_FIELD_SPECIFIED_TWICE";
	exports[1111] = "ER_INVALID_GROUP_FUNC_USE";
	exports[1112] = "ER_UNSUPPORTED_EXTENSION";
	exports[1113] = "ER_TABLE_MUST_HAVE_COLUMNS";
	exports[1114] = "ER_RECORD_FILE_FULL";
	exports[1115] = "ER_UNKNOWN_CHARACTER_SET";
	exports[1116] = "ER_TOO_MANY_TABLES";
	exports[1117] = "ER_TOO_MANY_FIELDS";
	exports[1118] = "ER_TOO_BIG_ROWSIZE";
	exports[1119] = "ER_STACK_OVERRUN";
	exports[1120] = "ER_WRONG_OUTER_JOIN";
	exports[1121] = "ER_NULL_COLUMN_IN_INDEX";
	exports[1122] = "ER_CANT_FIND_UDF";
	exports[1123] = "ER_CANT_INITIALIZE_UDF";
	exports[1124] = "ER_UDF_NO_PATHS";
	exports[1125] = "ER_UDF_EXISTS";
	exports[1126] = "ER_CANT_OPEN_LIBRARY";
	exports[1127] = "ER_CANT_FIND_DL_ENTRY";
	exports[1128] = "ER_FUNCTION_NOT_DEFINED";
	exports[1129] = "ER_HOST_IS_BLOCKED";
	exports[1130] = "ER_HOST_NOT_PRIVILEGED";
	exports[1131] = "ER_PASSWORD_ANONYMOUS_USER";
	exports[1132] = "ER_PASSWORD_NOT_ALLOWED";
	exports[1133] = "ER_PASSWORD_NO_MATCH";
	exports[1134] = "ER_UPDATE_INFO";
	exports[1135] = "ER_CANT_CREATE_THREAD";
	exports[1136] = "ER_WRONG_VALUE_COUNT_ON_ROW";
	exports[1137] = "ER_CANT_REOPEN_TABLE";
	exports[1138] = "ER_INVALID_USE_OF_NULL";
	exports[1139] = "ER_REGEXP_ERROR";
	exports[1140] = "ER_MIX_OF_GROUP_FUNC_AND_FIELDS";
	exports[1141] = "ER_NONEXISTING_GRANT";
	exports[1142] = "ER_TABLEACCESS_DENIED_ERROR";
	exports[1143] = "ER_COLUMNACCESS_DENIED_ERROR";
	exports[1144] = "ER_ILLEGAL_GRANT_FOR_TABLE";
	exports[1145] = "ER_GRANT_WRONG_HOST_OR_USER";
	exports[1146] = "ER_NO_SUCH_TABLE";
	exports[1147] = "ER_NONEXISTING_TABLE_GRANT";
	exports[1148] = "ER_NOT_ALLOWED_COMMAND";
	exports[1149] = "ER_SYNTAX_ERROR";
	exports[1150] = "ER_UNUSED1";
	exports[1151] = "ER_UNUSED2";
	exports[1152] = "ER_ABORTING_CONNECTION";
	exports[1153] = "ER_NET_PACKET_TOO_LARGE";
	exports[1154] = "ER_NET_READ_ERROR_FROM_PIPE";
	exports[1155] = "ER_NET_FCNTL_ERROR";
	exports[1156] = "ER_NET_PACKETS_OUT_OF_ORDER";
	exports[1157] = "ER_NET_UNCOMPRESS_ERROR";
	exports[1158] = "ER_NET_READ_ERROR";
	exports[1159] = "ER_NET_READ_INTERRUPTED";
	exports[1160] = "ER_NET_ERROR_ON_WRITE";
	exports[1161] = "ER_NET_WRITE_INTERRUPTED";
	exports[1162] = "ER_TOO_LONG_STRING";
	exports[1163] = "ER_TABLE_CANT_HANDLE_BLOB";
	exports[1164] = "ER_TABLE_CANT_HANDLE_AUTO_INCREMENT";
	exports[1165] = "ER_UNUSED3";
	exports[1166] = "ER_WRONG_COLUMN_NAME";
	exports[1167] = "ER_WRONG_KEY_COLUMN";
	exports[1168] = "ER_WRONG_MRG_TABLE";
	exports[1169] = "ER_DUP_UNIQUE";
	exports[1170] = "ER_BLOB_KEY_WITHOUT_LENGTH";
	exports[1171] = "ER_PRIMARY_CANT_HAVE_NULL";
	exports[1172] = "ER_TOO_MANY_ROWS";
	exports[1173] = "ER_REQUIRES_PRIMARY_KEY";
	exports[1174] = "ER_NO_RAID_COMPILED";
	exports[1175] = "ER_UPDATE_WITHOUT_KEY_IN_SAFE_MODE";
	exports[1176] = "ER_KEY_DOES_NOT_EXITS";
	exports[1177] = "ER_CHECK_NO_SUCH_TABLE";
	exports[1178] = "ER_CHECK_NOT_IMPLEMENTED";
	exports[1179] = "ER_CANT_DO_THIS_DURING_AN_TRANSACTION";
	exports[1180] = "ER_ERROR_DURING_COMMIT";
	exports[1181] = "ER_ERROR_DURING_ROLLBACK";
	exports[1182] = "ER_ERROR_DURING_FLUSH_LOGS";
	exports[1183] = "ER_ERROR_DURING_CHECKPOINT";
	exports[1184] = "ER_NEW_ABORTING_CONNECTION";
	exports[1185] = "ER_DUMP_NOT_IMPLEMENTED";
	exports[1186] = "ER_FLUSH_MASTER_BINLOG_CLOSED";
	exports[1187] = "ER_INDEX_REBUILD";
	exports[1188] = "ER_SOURCE";
	exports[1189] = "ER_SOURCE_NET_READ";
	exports[1190] = "ER_SOURCE_NET_WRITE";
	exports[1191] = "ER_FT_MATCHING_KEY_NOT_FOUND";
	exports[1192] = "ER_LOCK_OR_ACTIVE_TRANSACTION";
	exports[1193] = "ER_UNKNOWN_SYSTEM_VARIABLE";
	exports[1194] = "ER_CRASHED_ON_USAGE";
	exports[1195] = "ER_CRASHED_ON_REPAIR";
	exports[1196] = "ER_WARNING_NOT_COMPLETE_ROLLBACK";
	exports[1197] = "ER_TRANS_CACHE_FULL";
	exports[1198] = "ER_SLAVE_MUST_STOP";
	exports[1199] = "ER_REPLICA_NOT_RUNNING";
	exports[1200] = "ER_BAD_REPLICA";
	exports[1201] = "ER_CONNECTION_METADATA";
	exports[1202] = "ER_REPLICA_THREAD";
	exports[1203] = "ER_TOO_MANY_USER_CONNECTIONS";
	exports[1204] = "ER_SET_CONSTANTS_ONLY";
	exports[1205] = "ER_LOCK_WAIT_TIMEOUT";
	exports[1206] = "ER_LOCK_TABLE_FULL";
	exports[1207] = "ER_READ_ONLY_TRANSACTION";
	exports[1208] = "ER_DROP_DB_WITH_READ_LOCK";
	exports[1209] = "ER_CREATE_DB_WITH_READ_LOCK";
	exports[1210] = "ER_WRONG_ARGUMENTS";
	exports[1211] = "ER_NO_PERMISSION_TO_CREATE_USER";
	exports[1212] = "ER_UNION_TABLES_IN_DIFFERENT_DIR";
	exports[1213] = "ER_LOCK_DEADLOCK";
	exports[1214] = "ER_TABLE_CANT_HANDLE_FT";
	exports[1215] = "ER_CANNOT_ADD_FOREIGN";
	exports[1216] = "ER_NO_REFERENCED_ROW";
	exports[1217] = "ER_ROW_IS_REFERENCED";
	exports[1218] = "ER_CONNECT_TO_SOURCE";
	exports[1219] = "ER_QUERY_ON_MASTER";
	exports[1220] = "ER_ERROR_WHEN_EXECUTING_COMMAND";
	exports[1221] = "ER_WRONG_USAGE";
	exports[1222] = "ER_WRONG_NUMBER_OF_COLUMNS_IN_SELECT";
	exports[1223] = "ER_CANT_UPDATE_WITH_READLOCK";
	exports[1224] = "ER_MIXING_NOT_ALLOWED";
	exports[1225] = "ER_DUP_ARGUMENT";
	exports[1226] = "ER_USER_LIMIT_REACHED";
	exports[1227] = "ER_SPECIFIC_ACCESS_DENIED_ERROR";
	exports[1228] = "ER_LOCAL_VARIABLE";
	exports[1229] = "ER_GLOBAL_VARIABLE";
	exports[1230] = "ER_NO_DEFAULT";
	exports[1231] = "ER_WRONG_VALUE_FOR_VAR";
	exports[1232] = "ER_WRONG_TYPE_FOR_VAR";
	exports[1233] = "ER_VAR_CANT_BE_READ";
	exports[1234] = "ER_CANT_USE_OPTION_HERE";
	exports[1235] = "ER_NOT_SUPPORTED_YET";
	exports[1236] = "ER_SOURCE_FATAL_ERROR_READING_BINLOG";
	exports[1237] = "ER_REPLICA_IGNORED_TABLE";
	exports[1238] = "ER_INCORRECT_GLOBAL_LOCAL_VAR";
	exports[1239] = "ER_WRONG_FK_DEF";
	exports[1240] = "ER_KEY_REF_DO_NOT_MATCH_TABLE_REF";
	exports[1241] = "ER_OPERAND_COLUMNS";
	exports[1242] = "ER_SUBQUERY_NO_1_ROW";
	exports[1243] = "ER_UNKNOWN_STMT_HANDLER";
	exports[1244] = "ER_CORRUPT_HELP_DB";
	exports[1245] = "ER_CYCLIC_REFERENCE";
	exports[1246] = "ER_AUTO_CONVERT";
	exports[1247] = "ER_ILLEGAL_REFERENCE";
	exports[1248] = "ER_DERIVED_MUST_HAVE_ALIAS";
	exports[1249] = "ER_SELECT_REDUCED";
	exports[1250] = "ER_TABLENAME_NOT_ALLOWED_HERE";
	exports[1251] = "ER_NOT_SUPPORTED_AUTH_MODE";
	exports[1252] = "ER_SPATIAL_CANT_HAVE_NULL";
	exports[1253] = "ER_COLLATION_CHARSET_MISMATCH";
	exports[1254] = "ER_SLAVE_WAS_RUNNING";
	exports[1255] = "ER_SLAVE_WAS_NOT_RUNNING";
	exports[1256] = "ER_TOO_BIG_FOR_UNCOMPRESS";
	exports[1257] = "ER_ZLIB_Z_MEM_ERROR";
	exports[1258] = "ER_ZLIB_Z_BUF_ERROR";
	exports[1259] = "ER_ZLIB_Z_DATA_ERROR";
	exports[1260] = "ER_CUT_VALUE_GROUP_CONCAT";
	exports[1261] = "ER_WARN_TOO_FEW_RECORDS";
	exports[1262] = "ER_WARN_TOO_MANY_RECORDS";
	exports[1263] = "ER_WARN_NULL_TO_NOTNULL";
	exports[1264] = "ER_WARN_DATA_OUT_OF_RANGE";
	exports[1265] = "WARN_DATA_TRUNCATED";
	exports[1266] = "ER_WARN_USING_OTHER_HANDLER";
	exports[1267] = "ER_CANT_AGGREGATE_2COLLATIONS";
	exports[1268] = "ER_DROP_USER";
	exports[1269] = "ER_REVOKE_GRANTS";
	exports[1270] = "ER_CANT_AGGREGATE_3COLLATIONS";
	exports[1271] = "ER_CANT_AGGREGATE_NCOLLATIONS";
	exports[1272] = "ER_VARIABLE_IS_NOT_STRUCT";
	exports[1273] = "ER_UNKNOWN_COLLATION";
	exports[1274] = "ER_REPLICA_IGNORED_SSL_PARAMS";
	exports[1275] = "ER_SERVER_IS_IN_SECURE_AUTH_MODE";
	exports[1276] = "ER_WARN_FIELD_RESOLVED";
	exports[1277] = "ER_BAD_REPLICA_UNTIL_COND";
	exports[1278] = "ER_MISSING_SKIP_REPLICA";
	exports[1279] = "ER_UNTIL_COND_IGNORED";
	exports[1280] = "ER_WRONG_NAME_FOR_INDEX";
	exports[1281] = "ER_WRONG_NAME_FOR_CATALOG";
	exports[1282] = "ER_WARN_QC_RESIZE";
	exports[1283] = "ER_BAD_FT_COLUMN";
	exports[1284] = "ER_UNKNOWN_KEY_CACHE";
	exports[1285] = "ER_WARN_HOSTNAME_WONT_WORK";
	exports[1286] = "ER_UNKNOWN_STORAGE_ENGINE";
	exports[1287] = "ER_WARN_DEPRECATED_SYNTAX";
	exports[1288] = "ER_NON_UPDATABLE_TABLE";
	exports[1289] = "ER_FEATURE_DISABLED";
	exports[1290] = "ER_OPTION_PREVENTS_STATEMENT";
	exports[1291] = "ER_DUPLICATED_VALUE_IN_TYPE";
	exports[1292] = "ER_TRUNCATED_WRONG_VALUE";
	exports[1293] = "ER_TOO_MUCH_AUTO_TIMESTAMP_COLS";
	exports[1294] = "ER_INVALID_ON_UPDATE";
	exports[1295] = "ER_UNSUPPORTED_PS";
	exports[1296] = "ER_GET_ERRMSG";
	exports[1297] = "ER_GET_TEMPORARY_ERRMSG";
	exports[1298] = "ER_UNKNOWN_TIME_ZONE";
	exports[1299] = "ER_WARN_INVALID_TIMESTAMP";
	exports[1300] = "ER_INVALID_CHARACTER_STRING";
	exports[1301] = "ER_WARN_ALLOWED_PACKET_OVERFLOWED";
	exports[1302] = "ER_CONFLICTING_DECLARATIONS";
	exports[1303] = "ER_SP_NO_RECURSIVE_CREATE";
	exports[1304] = "ER_SP_ALREADY_EXISTS";
	exports[1305] = "ER_SP_DOES_NOT_EXIST";
	exports[1306] = "ER_SP_DROP_FAILED";
	exports[1307] = "ER_SP_STORE_FAILED";
	exports[1308] = "ER_SP_LILABEL_MISMATCH";
	exports[1309] = "ER_SP_LABEL_REDEFINE";
	exports[1310] = "ER_SP_LABEL_MISMATCH";
	exports[1311] = "ER_SP_UNINIT_VAR";
	exports[1312] = "ER_SP_BADSELECT";
	exports[1313] = "ER_SP_BADRETURN";
	exports[1314] = "ER_SP_BADSTATEMENT";
	exports[1315] = "ER_UPDATE_LOG_DEPRECATED_IGNORED";
	exports[1316] = "ER_UPDATE_LOG_DEPRECATED_TRANSLATED";
	exports[1317] = "ER_QUERY_INTERRUPTED";
	exports[1318] = "ER_SP_WRONG_NO_OF_ARGS";
	exports[1319] = "ER_SP_COND_MISMATCH";
	exports[1320] = "ER_SP_NORETURN";
	exports[1321] = "ER_SP_NORETURNEND";
	exports[1322] = "ER_SP_BAD_CURSOR_QUERY";
	exports[1323] = "ER_SP_BAD_CURSOR_SELECT";
	exports[1324] = "ER_SP_CURSOR_MISMATCH";
	exports[1325] = "ER_SP_CURSOR_ALREADY_OPEN";
	exports[1326] = "ER_SP_CURSOR_NOT_OPEN";
	exports[1327] = "ER_SP_UNDECLARED_VAR";
	exports[1328] = "ER_SP_WRONG_NO_OF_FETCH_ARGS";
	exports[1329] = "ER_SP_FETCH_NO_DATA";
	exports[1330] = "ER_SP_DUP_PARAM";
	exports[1331] = "ER_SP_DUP_VAR";
	exports[1332] = "ER_SP_DUP_COND";
	exports[1333] = "ER_SP_DUP_CURS";
	exports[1334] = "ER_SP_CANT_ALTER";
	exports[1335] = "ER_SP_SUBSELECT_NYI";
	exports[1336] = "ER_STMT_NOT_ALLOWED_IN_SF_OR_TRG";
	exports[1337] = "ER_SP_VARCOND_AFTER_CURSHNDLR";
	exports[1338] = "ER_SP_CURSOR_AFTER_HANDLER";
	exports[1339] = "ER_SP_CASE_NOT_FOUND";
	exports[1340] = "ER_FPARSER_TOO_BIG_FILE";
	exports[1341] = "ER_FPARSER_BAD_HEADER";
	exports[1342] = "ER_FPARSER_EOF_IN_COMMENT";
	exports[1343] = "ER_FPARSER_ERROR_IN_PARAMETER";
	exports[1344] = "ER_FPARSER_EOF_IN_UNKNOWN_PARAMETER";
	exports[1345] = "ER_VIEW_NO_EXPLAIN";
	exports[1346] = "ER_FRM_UNKNOWN_TYPE";
	exports[1347] = "ER_WRONG_OBJECT";
	exports[1348] = "ER_NONUPDATEABLE_COLUMN";
	exports[1349] = "ER_VIEW_SELECT_DERIVED";
	exports[1350] = "ER_VIEW_SELECT_CLAUSE";
	exports[1351] = "ER_VIEW_SELECT_VARIABLE";
	exports[1352] = "ER_VIEW_SELECT_TMPTABLE";
	exports[1353] = "ER_VIEW_WRONG_LIST";
	exports[1354] = "ER_WARN_VIEW_MERGE";
	exports[1355] = "ER_WARN_VIEW_WITHOUT_KEY";
	exports[1356] = "ER_VIEW_INVALID";
	exports[1357] = "ER_SP_NO_DROP_SP";
	exports[1358] = "ER_SP_GOTO_IN_HNDLR";
	exports[1359] = "ER_TRG_ALREADY_EXISTS";
	exports[1360] = "ER_TRG_DOES_NOT_EXIST";
	exports[1361] = "ER_TRG_ON_VIEW_OR_TEMP_TABLE";
	exports[1362] = "ER_TRG_CANT_CHANGE_ROW";
	exports[1363] = "ER_TRG_NO_SUCH_ROW_IN_TRG";
	exports[1364] = "ER_NO_DEFAULT_FOR_FIELD";
	exports[1365] = "ER_DIVISION_BY_ZERO";
	exports[1366] = "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD";
	exports[1367] = "ER_ILLEGAL_VALUE_FOR_TYPE";
	exports[1368] = "ER_VIEW_NONUPD_CHECK";
	exports[1369] = "ER_VIEW_CHECK_FAILED";
	exports[1370] = "ER_PROCACCESS_DENIED_ERROR";
	exports[1371] = "ER_RELAY_LOG_FAIL";
	exports[1372] = "ER_PASSWD_LENGTH";
	exports[1373] = "ER_UNKNOWN_TARGET_BINLOG";
	exports[1374] = "ER_IO_ERR_LOG_INDEX_READ";
	exports[1375] = "ER_BINLOG_PURGE_PROHIBITED";
	exports[1376] = "ER_FSEEK_FAIL";
	exports[1377] = "ER_BINLOG_PURGE_FATAL_ERR";
	exports[1378] = "ER_LOG_IN_USE";
	exports[1379] = "ER_LOG_PURGE_UNKNOWN_ERR";
	exports[1380] = "ER_RELAY_LOG_INIT";
	exports[1381] = "ER_NO_BINARY_LOGGING";
	exports[1382] = "ER_RESERVED_SYNTAX";
	exports[1383] = "ER_WSAS_FAILED";
	exports[1384] = "ER_DIFF_GROUPS_PROC";
	exports[1385] = "ER_NO_GROUP_FOR_PROC";
	exports[1386] = "ER_ORDER_WITH_PROC";
	exports[1387] = "ER_LOGGING_PROHIBIT_CHANGING_OF";
	exports[1388] = "ER_NO_FILE_MAPPING";
	exports[1389] = "ER_WRONG_MAGIC";
	exports[1390] = "ER_PS_MANY_PARAM";
	exports[1391] = "ER_KEY_PART_0";
	exports[1392] = "ER_VIEW_CHECKSUM";
	exports[1393] = "ER_VIEW_MULTIUPDATE";
	exports[1394] = "ER_VIEW_NO_INSERT_FIELD_LIST";
	exports[1395] = "ER_VIEW_DELETE_MERGE_VIEW";
	exports[1396] = "ER_CANNOT_USER";
	exports[1397] = "ER_XAER_NOTA";
	exports[1398] = "ER_XAER_INVAL";
	exports[1399] = "ER_XAER_RMFAIL";
	exports[1400] = "ER_XAER_OUTSIDE";
	exports[1401] = "ER_XAER_RMERR";
	exports[1402] = "ER_XA_RBROLLBACK";
	exports[1403] = "ER_NONEXISTING_PROC_GRANT";
	exports[1404] = "ER_PROC_AUTO_GRANT_FAIL";
	exports[1405] = "ER_PROC_AUTO_REVOKE_FAIL";
	exports[1406] = "ER_DATA_TOO_LONG";
	exports[1407] = "ER_SP_BAD_SQLSTATE";
	exports[1408] = "ER_STARTUP";
	exports[1409] = "ER_LOAD_FROM_FIXED_SIZE_ROWS_TO_VAR";
	exports[1410] = "ER_CANT_CREATE_USER_WITH_GRANT";
	exports[1411] = "ER_WRONG_VALUE_FOR_TYPE";
	exports[1412] = "ER_TABLE_DEF_CHANGED";
	exports[1413] = "ER_SP_DUP_HANDLER";
	exports[1414] = "ER_SP_NOT_VAR_ARG";
	exports[1415] = "ER_SP_NO_RETSET";
	exports[1416] = "ER_CANT_CREATE_GEOMETRY_OBJECT";
	exports[1417] = "ER_FAILED_ROUTINE_BREAK_BINLOG";
	exports[1418] = "ER_BINLOG_UNSAFE_ROUTINE";
	exports[1419] = "ER_BINLOG_CREATE_ROUTINE_NEED_SUPER";
	exports[1420] = "ER_EXEC_STMT_WITH_OPEN_CURSOR";
	exports[1421] = "ER_STMT_HAS_NO_OPEN_CURSOR";
	exports[1422] = "ER_COMMIT_NOT_ALLOWED_IN_SF_OR_TRG";
	exports[1423] = "ER_NO_DEFAULT_FOR_VIEW_FIELD";
	exports[1424] = "ER_SP_NO_RECURSION";
	exports[1425] = "ER_TOO_BIG_SCALE";
	exports[1426] = "ER_TOO_BIG_PRECISION";
	exports[1427] = "ER_M_BIGGER_THAN_D";
	exports[1428] = "ER_WRONG_LOCK_OF_SYSTEM_TABLE";
	exports[1429] = "ER_CONNECT_TO_FOREIGN_DATA_SOURCE";
	exports[1430] = "ER_QUERY_ON_FOREIGN_DATA_SOURCE";
	exports[1431] = "ER_FOREIGN_DATA_SOURCE_DOESNT_EXIST";
	exports[1432] = "ER_FOREIGN_DATA_STRING_INVALID_CANT_CREATE";
	exports[1433] = "ER_FOREIGN_DATA_STRING_INVALID";
	exports[1434] = "ER_CANT_CREATE_FEDERATED_TABLE";
	exports[1435] = "ER_TRG_IN_WRONG_SCHEMA";
	exports[1436] = "ER_STACK_OVERRUN_NEED_MORE";
	exports[1437] = "ER_TOO_LONG_BODY";
	exports[1438] = "ER_WARN_CANT_DROP_DEFAULT_KEYCACHE";
	exports[1439] = "ER_TOO_BIG_DISPLAYWIDTH";
	exports[1440] = "ER_XAER_DUPID";
	exports[1441] = "ER_DATETIME_FUNCTION_OVERFLOW";
	exports[1442] = "ER_CANT_UPDATE_USED_TABLE_IN_SF_OR_TRG";
	exports[1443] = "ER_VIEW_PREVENT_UPDATE";
	exports[1444] = "ER_PS_NO_RECURSION";
	exports[1445] = "ER_SP_CANT_SET_AUTOCOMMIT";
	exports[1446] = "ER_MALFORMED_DEFINER";
	exports[1447] = "ER_VIEW_FRM_NO_USER";
	exports[1448] = "ER_VIEW_OTHER_USER";
	exports[1449] = "ER_NO_SUCH_USER";
	exports[1450] = "ER_FORBID_SCHEMA_CHANGE";
	exports[1451] = "ER_ROW_IS_REFERENCED_2";
	exports[1452] = "ER_NO_REFERENCED_ROW_2";
	exports[1453] = "ER_SP_BAD_VAR_SHADOW";
	exports[1454] = "ER_TRG_NO_DEFINER";
	exports[1455] = "ER_OLD_FILE_FORMAT";
	exports[1456] = "ER_SP_RECURSION_LIMIT";
	exports[1457] = "ER_SP_PROC_TABLE_CORRUPT";
	exports[1458] = "ER_SP_WRONG_NAME";
	exports[1459] = "ER_TABLE_NEEDS_UPGRADE";
	exports[1460] = "ER_SP_NO_AGGREGATE";
	exports[1461] = "ER_MAX_PREPARED_STMT_COUNT_REACHED";
	exports[1462] = "ER_VIEW_RECURSIVE";
	exports[1463] = "ER_NON_GROUPING_FIELD_USED";
	exports[1464] = "ER_TABLE_CANT_HANDLE_SPKEYS";
	exports[1465] = "ER_NO_TRIGGERS_ON_SYSTEM_SCHEMA";
	exports[1466] = "ER_REMOVED_SPACES";
	exports[1467] = "ER_AUTOINC_READ_FAILED";
	exports[1468] = "ER_USERNAME";
	exports[1469] = "ER_HOSTNAME";
	exports[1470] = "ER_WRONG_STRING_LENGTH";
	exports[1471] = "ER_NON_INSERTABLE_TABLE";
	exports[1472] = "ER_ADMIN_WRONG_MRG_TABLE";
	exports[1473] = "ER_TOO_HIGH_LEVEL_OF_NESTING_FOR_SELECT";
	exports[1474] = "ER_NAME_BECOMES_EMPTY";
	exports[1475] = "ER_AMBIGUOUS_FIELD_TERM";
	exports[1476] = "ER_FOREIGN_SERVER_EXISTS";
	exports[1477] = "ER_FOREIGN_SERVER_DOESNT_EXIST";
	exports[1478] = "ER_ILLEGAL_HA_CREATE_OPTION";
	exports[1479] = "ER_PARTITION_REQUIRES_VALUES_ERROR";
	exports[1480] = "ER_PARTITION_WRONG_VALUES_ERROR";
	exports[1481] = "ER_PARTITION_MAXVALUE_ERROR";
	exports[1482] = "ER_PARTITION_SUBPARTITION_ERROR";
	exports[1483] = "ER_PARTITION_SUBPART_MIX_ERROR";
	exports[1484] = "ER_PARTITION_WRONG_NO_PART_ERROR";
	exports[1485] = "ER_PARTITION_WRONG_NO_SUBPART_ERROR";
	exports[1486] = "ER_WRONG_EXPR_IN_PARTITION_FUNC_ERROR";
	exports[1487] = "ER_NO_CONST_EXPR_IN_RANGE_OR_LIST_ERROR";
	exports[1488] = "ER_FIELD_NOT_FOUND_PART_ERROR";
	exports[1489] = "ER_LIST_OF_FIELDS_ONLY_IN_HASH_ERROR";
	exports[1490] = "ER_INCONSISTENT_PARTITION_INFO_ERROR";
	exports[1491] = "ER_PARTITION_FUNC_NOT_ALLOWED_ERROR";
	exports[1492] = "ER_PARTITIONS_MUST_BE_DEFINED_ERROR";
	exports[1493] = "ER_RANGE_NOT_INCREASING_ERROR";
	exports[1494] = "ER_INCONSISTENT_TYPE_OF_FUNCTIONS_ERROR";
	exports[1495] = "ER_MULTIPLE_DEF_CONST_IN_LIST_PART_ERROR";
	exports[1496] = "ER_PARTITION_ENTRY_ERROR";
	exports[1497] = "ER_MIX_HANDLER_ERROR";
	exports[1498] = "ER_PARTITION_NOT_DEFINED_ERROR";
	exports[1499] = "ER_TOO_MANY_PARTITIONS_ERROR";
	exports[1500] = "ER_SUBPARTITION_ERROR";
	exports[1501] = "ER_CANT_CREATE_HANDLER_FILE";
	exports[1502] = "ER_BLOB_FIELD_IN_PART_FUNC_ERROR";
	exports[1503] = "ER_UNIQUE_KEY_NEED_ALL_FIELDS_IN_PF";
	exports[1504] = "ER_NO_PARTS_ERROR";
	exports[1505] = "ER_PARTITION_MGMT_ON_NONPARTITIONED";
	exports[1506] = "ER_FOREIGN_KEY_ON_PARTITIONED";
	exports[1507] = "ER_DROP_PARTITION_NON_EXISTENT";
	exports[1508] = "ER_DROP_LAST_PARTITION";
	exports[1509] = "ER_COALESCE_ONLY_ON_HASH_PARTITION";
	exports[1510] = "ER_REORG_HASH_ONLY_ON_SAME_NO";
	exports[1511] = "ER_REORG_NO_PARAM_ERROR";
	exports[1512] = "ER_ONLY_ON_RANGE_LIST_PARTITION";
	exports[1513] = "ER_ADD_PARTITION_SUBPART_ERROR";
	exports[1514] = "ER_ADD_PARTITION_NO_NEW_PARTITION";
	exports[1515] = "ER_COALESCE_PARTITION_NO_PARTITION";
	exports[1516] = "ER_REORG_PARTITION_NOT_EXIST";
	exports[1517] = "ER_SAME_NAME_PARTITION";
	exports[1518] = "ER_NO_BINLOG_ERROR";
	exports[1519] = "ER_CONSECUTIVE_REORG_PARTITIONS";
	exports[1520] = "ER_REORG_OUTSIDE_RANGE";
	exports[1521] = "ER_PARTITION_FUNCTION_FAILURE";
	exports[1522] = "ER_PART_STATE_ERROR";
	exports[1523] = "ER_LIMITED_PART_RANGE";
	exports[1524] = "ER_PLUGIN_IS_NOT_LOADED";
	exports[1525] = "ER_WRONG_VALUE";
	exports[1526] = "ER_NO_PARTITION_FOR_GIVEN_VALUE";
	exports[1527] = "ER_FILEGROUP_OPTION_ONLY_ONCE";
	exports[1528] = "ER_CREATE_FILEGROUP_FAILED";
	exports[1529] = "ER_DROP_FILEGROUP_FAILED";
	exports[1530] = "ER_TABLESPACE_AUTO_EXTEND_ERROR";
	exports[1531] = "ER_WRONG_SIZE_NUMBER";
	exports[1532] = "ER_SIZE_OVERFLOW_ERROR";
	exports[1533] = "ER_ALTER_FILEGROUP_FAILED";
	exports[1534] = "ER_BINLOG_ROW_LOGGING_FAILED";
	exports[1535] = "ER_BINLOG_ROW_WRONG_TABLE_DEF";
	exports[1536] = "ER_BINLOG_ROW_RBR_TO_SBR";
	exports[1537] = "ER_EVENT_ALREADY_EXISTS";
	exports[1538] = "ER_EVENT_STORE_FAILED";
	exports[1539] = "ER_EVENT_DOES_NOT_EXIST";
	exports[1540] = "ER_EVENT_CANT_ALTER";
	exports[1541] = "ER_EVENT_DROP_FAILED";
	exports[1542] = "ER_EVENT_INTERVAL_NOT_POSITIVE_OR_TOO_BIG";
	exports[1543] = "ER_EVENT_ENDS_BEFORE_STARTS";
	exports[1544] = "ER_EVENT_EXEC_TIME_IN_THE_PAST";
	exports[1545] = "ER_EVENT_OPEN_TABLE_FAILED";
	exports[1546] = "ER_EVENT_NEITHER_M_EXPR_NOR_M_AT";
	exports[1547] = "ER_COL_COUNT_DOESNT_MATCH_CORRUPTED";
	exports[1548] = "ER_CANNOT_LOAD_FROM_TABLE";
	exports[1549] = "ER_EVENT_CANNOT_DELETE";
	exports[1550] = "ER_EVENT_COMPILE_ERROR";
	exports[1551] = "ER_EVENT_SAME_NAME";
	exports[1552] = "ER_EVENT_DATA_TOO_LONG";
	exports[1553] = "ER_DROP_INDEX_FK";
	exports[1554] = "ER_WARN_DEPRECATED_SYNTAX_WITH_VER";
	exports[1555] = "ER_CANT_WRITE_LOCK_LOG_TABLE";
	exports[1556] = "ER_CANT_LOCK_LOG_TABLE";
	exports[1557] = "ER_FOREIGN_DUPLICATE_KEY";
	exports[1558] = "ER_COL_COUNT_DOESNT_MATCH_PLEASE_UPDATE";
	exports[1559] = "ER_TEMP_TABLE_PREVENTS_SWITCH_OUT_OF_RBR";
	exports[1560] = "ER_STORED_FUNCTION_PREVENTS_SWITCH_BINLOG_FORMAT";
	exports[1561] = "ER_NDB_CANT_SWITCH_BINLOG_FORMAT";
	exports[1562] = "ER_PARTITION_NO_TEMPORARY";
	exports[1563] = "ER_PARTITION_CONST_DOMAIN_ERROR";
	exports[1564] = "ER_PARTITION_FUNCTION_IS_NOT_ALLOWED";
	exports[1565] = "ER_DDL_LOG_ERROR";
	exports[1566] = "ER_NULL_IN_VALUES_LESS_THAN";
	exports[1567] = "ER_WRONG_PARTITION_NAME";
	exports[1568] = "ER_CANT_CHANGE_TX_CHARACTERISTICS";
	exports[1569] = "ER_DUP_ENTRY_AUTOINCREMENT_CASE";
	exports[1570] = "ER_EVENT_MODIFY_QUEUE_ERROR";
	exports[1571] = "ER_EVENT_SET_VAR_ERROR";
	exports[1572] = "ER_PARTITION_MERGE_ERROR";
	exports[1573] = "ER_CANT_ACTIVATE_LOG";
	exports[1574] = "ER_RBR_NOT_AVAILABLE";
	exports[1575] = "ER_BASE64_DECODE_ERROR";
	exports[1576] = "ER_EVENT_RECURSION_FORBIDDEN";
	exports[1577] = "ER_EVENTS_DB_ERROR";
	exports[1578] = "ER_ONLY_INTEGERS_ALLOWED";
	exports[1579] = "ER_UNSUPORTED_LOG_ENGINE";
	exports[1580] = "ER_BAD_LOG_STATEMENT";
	exports[1581] = "ER_CANT_RENAME_LOG_TABLE";
	exports[1582] = "ER_WRONG_PARAMCOUNT_TO_NATIVE_FCT";
	exports[1583] = "ER_WRONG_PARAMETERS_TO_NATIVE_FCT";
	exports[1584] = "ER_WRONG_PARAMETERS_TO_STORED_FCT";
	exports[1585] = "ER_NATIVE_FCT_NAME_COLLISION";
	exports[1586] = "ER_DUP_ENTRY_WITH_KEY_NAME";
	exports[1587] = "ER_BINLOG_PURGE_EMFILE";
	exports[1588] = "ER_EVENT_CANNOT_CREATE_IN_THE_PAST";
	exports[1589] = "ER_EVENT_CANNOT_ALTER_IN_THE_PAST";
	exports[1590] = "ER_SLAVE_INCIDENT";
	exports[1591] = "ER_NO_PARTITION_FOR_GIVEN_VALUE_SILENT";
	exports[1592] = "ER_BINLOG_UNSAFE_STATEMENT";
	exports[1593] = "ER_BINLOG_FATAL_ERROR";
	exports[1594] = "ER_SLAVE_RELAY_LOG_READ_FAILURE";
	exports[1595] = "ER_SLAVE_RELAY_LOG_WRITE_FAILURE";
	exports[1596] = "ER_SLAVE_CREATE_EVENT_FAILURE";
	exports[1597] = "ER_SLAVE_MASTER_COM_FAILURE";
	exports[1598] = "ER_BINLOG_LOGGING_IMPOSSIBLE";
	exports[1599] = "ER_VIEW_NO_CREATION_CTX";
	exports[1600] = "ER_VIEW_INVALID_CREATION_CTX";
	exports[1601] = "ER_SR_INVALID_CREATION_CTX";
	exports[1602] = "ER_TRG_CORRUPTED_FILE";
	exports[1603] = "ER_TRG_NO_CREATION_CTX";
	exports[1604] = "ER_TRG_INVALID_CREATION_CTX";
	exports[1605] = "ER_EVENT_INVALID_CREATION_CTX";
	exports[1606] = "ER_TRG_CANT_OPEN_TABLE";
	exports[1607] = "ER_CANT_CREATE_SROUTINE";
	exports[1608] = "ER_NEVER_USED";
	exports[1609] = "ER_NO_FORMAT_DESCRIPTION_EVENT_BEFORE_BINLOG_STATEMENT";
	exports[1610] = "ER_REPLICA_CORRUPT_EVENT";
	exports[1611] = "ER_LOAD_DATA_INVALID_COLUMN";
	exports[1612] = "ER_LOG_PURGE_NO_FILE";
	exports[1613] = "ER_XA_RBTIMEOUT";
	exports[1614] = "ER_XA_RBDEADLOCK";
	exports[1615] = "ER_NEED_REPREPARE";
	exports[1616] = "ER_DELAYED_NOT_SUPPORTED";
	exports[1617] = "WARN_NO_CONNECTION_METADATA";
	exports[1618] = "WARN_OPTION_IGNORED";
	exports[1619] = "ER_PLUGIN_DELETE_BUILTIN";
	exports[1620] = "WARN_PLUGIN_BUSY";
	exports[1621] = "ER_VARIABLE_IS_READONLY";
	exports[1622] = "ER_WARN_ENGINE_TRANSACTION_ROLLBACK";
	exports[1623] = "ER_SLAVE_HEARTBEAT_FAILURE";
	exports[1624] = "ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE";
	exports[1625] = "ER_NDB_REPLICATION_SCHEMA_ERROR";
	exports[1626] = "ER_CONFLICT_FN_PARSE_ERROR";
	exports[1627] = "ER_EXCEPTIONS_WRITE_ERROR";
	exports[1628] = "ER_TOO_LONG_TABLE_COMMENT";
	exports[1629] = "ER_TOO_LONG_FIELD_COMMENT";
	exports[1630] = "ER_FUNC_INEXISTENT_NAME_COLLISION";
	exports[1631] = "ER_DATABASE_NAME";
	exports[1632] = "ER_TABLE_NAME";
	exports[1633] = "ER_PARTITION_NAME";
	exports[1634] = "ER_SUBPARTITION_NAME";
	exports[1635] = "ER_TEMPORARY_NAME";
	exports[1636] = "ER_RENAMED_NAME";
	exports[1637] = "ER_TOO_MANY_CONCURRENT_TRXS";
	exports[1638] = "WARN_NON_ASCII_SEPARATOR_NOT_IMPLEMENTED";
	exports[1639] = "ER_DEBUG_SYNC_TIMEOUT";
	exports[1640] = "ER_DEBUG_SYNC_HIT_LIMIT";
	exports[1641] = "ER_DUP_SIGNAL_SET";
	exports[1642] = "ER_SIGNAL_WARN";
	exports[1643] = "ER_SIGNAL_NOT_FOUND";
	exports[1644] = "ER_SIGNAL_EXCEPTION";
	exports[1645] = "ER_RESIGNAL_WITHOUT_ACTIVE_HANDLER";
	exports[1646] = "ER_SIGNAL_BAD_CONDITION_TYPE";
	exports[1647] = "WARN_COND_ITEM_TRUNCATED";
	exports[1648] = "ER_COND_ITEM_TOO_LONG";
	exports[1649] = "ER_UNKNOWN_LOCALE";
	exports[1650] = "ER_REPLICA_IGNORE_SERVER_IDS";
	exports[1651] = "ER_QUERY_CACHE_DISABLED";
	exports[1652] = "ER_SAME_NAME_PARTITION_FIELD";
	exports[1653] = "ER_PARTITION_COLUMN_LIST_ERROR";
	exports[1654] = "ER_WRONG_TYPE_COLUMN_VALUE_ERROR";
	exports[1655] = "ER_TOO_MANY_PARTITION_FUNC_FIELDS_ERROR";
	exports[1656] = "ER_MAXVALUE_IN_VALUES_IN";
	exports[1657] = "ER_TOO_MANY_VALUES_ERROR";
	exports[1658] = "ER_ROW_SINGLE_PARTITION_FIELD_ERROR";
	exports[1659] = "ER_FIELD_TYPE_NOT_ALLOWED_AS_PARTITION_FIELD";
	exports[1660] = "ER_PARTITION_FIELDS_TOO_LONG";
	exports[1661] = "ER_BINLOG_ROW_ENGINE_AND_STMT_ENGINE";
	exports[1662] = "ER_BINLOG_ROW_MODE_AND_STMT_ENGINE";
	exports[1663] = "ER_BINLOG_UNSAFE_AND_STMT_ENGINE";
	exports[1664] = "ER_BINLOG_ROW_INJECTION_AND_STMT_ENGINE";
	exports[1665] = "ER_BINLOG_STMT_MODE_AND_ROW_ENGINE";
	exports[1666] = "ER_BINLOG_ROW_INJECTION_AND_STMT_MODE";
	exports[1667] = "ER_BINLOG_MULTIPLE_ENGINES_AND_SELF_LOGGING_ENGINE";
	exports[1668] = "ER_BINLOG_UNSAFE_LIMIT";
	exports[1669] = "ER_UNUSED4";
	exports[1670] = "ER_BINLOG_UNSAFE_SYSTEM_TABLE";
	exports[1671] = "ER_BINLOG_UNSAFE_AUTOINC_COLUMNS";
	exports[1672] = "ER_BINLOG_UNSAFE_UDF";
	exports[1673] = "ER_BINLOG_UNSAFE_SYSTEM_VARIABLE";
	exports[1674] = "ER_BINLOG_UNSAFE_SYSTEM_FUNCTION";
	exports[1675] = "ER_BINLOG_UNSAFE_NONTRANS_AFTER_TRANS";
	exports[1676] = "ER_MESSAGE_AND_STATEMENT";
	exports[1677] = "ER_SLAVE_CONVERSION_FAILED";
	exports[1678] = "ER_REPLICA_CANT_CREATE_CONVERSION";
	exports[1679] = "ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_BINLOG_FORMAT";
	exports[1680] = "ER_PATH_LENGTH";
	exports[1681] = "ER_WARN_DEPRECATED_SYNTAX_NO_REPLACEMENT";
	exports[1682] = "ER_WRONG_NATIVE_TABLE_STRUCTURE";
	exports[1683] = "ER_WRONG_PERFSCHEMA_USAGE";
	exports[1684] = "ER_WARN_I_S_SKIPPED_TABLE";
	exports[1685] = "ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_BINLOG_DIRECT";
	exports[1686] = "ER_STORED_FUNCTION_PREVENTS_SWITCH_BINLOG_DIRECT";
	exports[1687] = "ER_SPATIAL_MUST_HAVE_GEOM_COL";
	exports[1688] = "ER_TOO_LONG_INDEX_COMMENT";
	exports[1689] = "ER_LOCK_ABORTED";
	exports[1690] = "ER_DATA_OUT_OF_RANGE";
	exports[1691] = "ER_WRONG_SPVAR_TYPE_IN_LIMIT";
	exports[1692] = "ER_BINLOG_UNSAFE_MULTIPLE_ENGINES_AND_SELF_LOGGING_ENGINE";
	exports[1693] = "ER_BINLOG_UNSAFE_MIXED_STATEMENT";
	exports[1694] = "ER_INSIDE_TRANSACTION_PREVENTS_SWITCH_SQL_LOG_BIN";
	exports[1695] = "ER_STORED_FUNCTION_PREVENTS_SWITCH_SQL_LOG_BIN";
	exports[1696] = "ER_FAILED_READ_FROM_PAR_FILE";
	exports[1697] = "ER_VALUES_IS_NOT_INT_TYPE_ERROR";
	exports[1698] = "ER_ACCESS_DENIED_NO_PASSWORD_ERROR";
	exports[1699] = "ER_SET_PASSWORD_AUTH_PLUGIN";
	exports[1700] = "ER_GRANT_PLUGIN_USER_EXISTS";
	exports[1701] = "ER_TRUNCATE_ILLEGAL_FK";
	exports[1702] = "ER_PLUGIN_IS_PERMANENT";
	exports[1703] = "ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE_MIN";
	exports[1704] = "ER_REPLICA_HEARTBEAT_VALUE_OUT_OF_RANGE_MAX";
	exports[1705] = "ER_STMT_CACHE_FULL";
	exports[1706] = "ER_MULTI_UPDATE_KEY_CONFLICT";
	exports[1707] = "ER_TABLE_NEEDS_REBUILD";
	exports[1708] = "WARN_OPTION_BELOW_LIMIT";
	exports[1709] = "ER_INDEX_COLUMN_TOO_LONG";
	exports[1710] = "ER_ERROR_IN_TRIGGER_BODY";
	exports[1711] = "ER_ERROR_IN_UNKNOWN_TRIGGER_BODY";
	exports[1712] = "ER_INDEX_CORRUPT";
	exports[1713] = "ER_UNDO_RECORD_TOO_BIG";
	exports[1714] = "ER_BINLOG_UNSAFE_INSERT_IGNORE_SELECT";
	exports[1715] = "ER_BINLOG_UNSAFE_INSERT_SELECT_UPDATE";
	exports[1716] = "ER_BINLOG_UNSAFE_REPLACE_SELECT";
	exports[1717] = "ER_BINLOG_UNSAFE_CREATE_IGNORE_SELECT";
	exports[1718] = "ER_BINLOG_UNSAFE_CREATE_REPLACE_SELECT";
	exports[1719] = "ER_BINLOG_UNSAFE_UPDATE_IGNORE";
	exports[1720] = "ER_PLUGIN_NO_UNINSTALL";
	exports[1721] = "ER_PLUGIN_NO_INSTALL";
	exports[1722] = "ER_BINLOG_UNSAFE_WRITE_AUTOINC_SELECT";
	exports[1723] = "ER_BINLOG_UNSAFE_CREATE_SELECT_AUTOINC";
	exports[1724] = "ER_BINLOG_UNSAFE_INSERT_TWO_KEYS";
	exports[1725] = "ER_TABLE_IN_FK_CHECK";
	exports[1726] = "ER_UNSUPPORTED_ENGINE";
	exports[1727] = "ER_BINLOG_UNSAFE_AUTOINC_NOT_FIRST";
	exports[1728] = "ER_CANNOT_LOAD_FROM_TABLE_V2";
	exports[1729] = "ER_SOURCE_DELAY_VALUE_OUT_OF_RANGE";
	exports[1730] = "ER_ONLY_FD_AND_RBR_EVENTS_ALLOWED_IN_BINLOG_STATEMENT";
	exports[1731] = "ER_PARTITION_EXCHANGE_DIFFERENT_OPTION";
	exports[1732] = "ER_PARTITION_EXCHANGE_PART_TABLE";
	exports[1733] = "ER_PARTITION_EXCHANGE_TEMP_TABLE";
	exports[1734] = "ER_PARTITION_INSTEAD_OF_SUBPARTITION";
	exports[1735] = "ER_UNKNOWN_PARTITION";
	exports[1736] = "ER_TABLES_DIFFERENT_METADATA";
	exports[1737] = "ER_ROW_DOES_NOT_MATCH_PARTITION";
	exports[1738] = "ER_BINLOG_CACHE_SIZE_GREATER_THAN_MAX";
	exports[1739] = "ER_WARN_INDEX_NOT_APPLICABLE";
	exports[1740] = "ER_PARTITION_EXCHANGE_FOREIGN_KEY";
	exports[1741] = "ER_NO_SUCH_KEY_VALUE";
	exports[1742] = "ER_RPL_INFO_DATA_TOO_LONG";
	exports[1743] = "ER_NETWORK_READ_EVENT_CHECKSUM_FAILURE";
	exports[1744] = "ER_BINLOG_READ_EVENT_CHECKSUM_FAILURE";
	exports[1745] = "ER_BINLOG_STMT_CACHE_SIZE_GREATER_THAN_MAX";
	exports[1746] = "ER_CANT_UPDATE_TABLE_IN_CREATE_TABLE_SELECT";
	exports[1747] = "ER_PARTITION_CLAUSE_ON_NONPARTITIONED";
	exports[1748] = "ER_ROW_DOES_NOT_MATCH_GIVEN_PARTITION_SET";
	exports[1749] = "ER_NO_SUCH_PARTITION";
	exports[1750] = "ER_CHANGE_RPL_INFO_REPOSITORY_FAILURE";
	exports[1751] = "ER_WARNING_NOT_COMPLETE_ROLLBACK_WITH_CREATED_TEMP_TABLE";
	exports[1752] = "ER_WARNING_NOT_COMPLETE_ROLLBACK_WITH_DROPPED_TEMP_TABLE";
	exports[1753] = "ER_MTA_FEATURE_IS_NOT_SUPPORTED";
	exports[1754] = "ER_MTA_UPDATED_DBS_GREATER_MAX";
	exports[1755] = "ER_MTA_CANT_PARALLEL";
	exports[1756] = "ER_MTA_INCONSISTENT_DATA";
	exports[1757] = "ER_FULLTEXT_NOT_SUPPORTED_WITH_PARTITIONING";
	exports[1758] = "ER_DA_INVALID_CONDITION_NUMBER";
	exports[1759] = "ER_INSECURE_PLAIN_TEXT";
	exports[1760] = "ER_INSECURE_CHANGE_SOURCE";
	exports[1761] = "ER_FOREIGN_DUPLICATE_KEY_WITH_CHILD_INFO";
	exports[1762] = "ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO";
	exports[1763] = "ER_SQLTHREAD_WITH_SECURE_REPLICA";
	exports[1764] = "ER_TABLE_HAS_NO_FT";
	exports[1765] = "ER_VARIABLE_NOT_SETTABLE_IN_SF_OR_TRIGGER";
	exports[1766] = "ER_VARIABLE_NOT_SETTABLE_IN_TRANSACTION";
	exports[1767] = "ER_GTID_NEXT_IS_NOT_IN_GTID_NEXT_LIST";
	exports[1768] = "ER_CANT_CHANGE_GTID_NEXT_IN_TRANSACTION";
	exports[1769] = "ER_SET_STATEMENT_CANNOT_INVOKE_FUNCTION";
	exports[1770] = "ER_GTID_NEXT_CANT_BE_AUTOMATIC_IF_GTID_NEXT_LIST_IS_NON_NULL";
	exports[1771] = "ER_SKIPPING_LOGGED_TRANSACTION";
	exports[1772] = "ER_MALFORMED_GTID_SET_SPECIFICATION";
	exports[1773] = "ER_MALFORMED_GTID_SET_ENCODING";
	exports[1774] = "ER_MALFORMED_GTID_SPECIFICATION";
	exports[1775] = "ER_GNO_EXHAUSTED";
	exports[1776] = "ER_BAD_REPLICA_AUTO_POSITION";
	exports[1777] = "ER_AUTO_POSITION_REQUIRES_GTID_MODE_NOT_OFF";
	exports[1778] = "ER_CANT_DO_IMPLICIT_COMMIT_IN_TRX_WHEN_GTID_NEXT_IS_SET";
	exports[1779] = "ER_GTID_MODE_ON_REQUIRES_ENFORCE_GTID_CONSISTENCY_ON";
	exports[1780] = "ER_GTID_MODE_REQUIRES_BINLOG";
	exports[1781] = "ER_CANT_SET_GTID_NEXT_TO_GTID_WHEN_GTID_MODE_IS_OFF";
	exports[1782] = "ER_CANT_SET_GTID_NEXT_TO_ANONYMOUS_WHEN_GTID_MODE_IS_ON";
	exports[1783] = "ER_CANT_SET_GTID_NEXT_LIST_TO_NON_NULL_WHEN_GTID_MODE_IS_OFF";
	exports[1784] = "ER_FOUND_GTID_EVENT_WHEN_GTID_MODE_IS_OFF";
	exports[1785] = "ER_GTID_UNSAFE_NON_TRANSACTIONAL_TABLE";
	exports[1786] = "ER_GTID_UNSAFE_CREATE_SELECT";
	exports[1787] = "ER_GTID_UNSAFE_CREATE_DROP_TEMP_TABLE_IN_TRANSACTION";
	exports[1788] = "ER_GTID_MODE_CAN_ONLY_CHANGE_ONE_STEP_AT_A_TIME";
	exports[1789] = "ER_SOURCE_HAS_PURGED_REQUIRED_GTIDS";
	exports[1790] = "ER_CANT_SET_GTID_NEXT_WHEN_OWNING_GTID";
	exports[1791] = "ER_UNKNOWN_EXPLAIN_FORMAT";
	exports[1792] = "ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION";
	exports[1793] = "ER_TOO_LONG_TABLE_PARTITION_COMMENT";
	exports[1794] = "ER_REPLICA_CONFIGURATION";
	exports[1795] = "ER_INNODB_FT_LIMIT";
	exports[1796] = "ER_INNODB_NO_FT_TEMP_TABLE";
	exports[1797] = "ER_INNODB_FT_WRONG_DOCID_COLUMN";
	exports[1798] = "ER_INNODB_FT_WRONG_DOCID_INDEX";
	exports[1799] = "ER_INNODB_ONLINE_LOG_TOO_BIG";
	exports[1800] = "ER_UNKNOWN_ALTER_ALGORITHM";
	exports[1801] = "ER_UNKNOWN_ALTER_LOCK";
	exports[1802] = "ER_MTA_CHANGE_SOURCE_CANT_RUN_WITH_GAPS";
	exports[1803] = "ER_MTA_RECOVERY_FAILURE";
	exports[1804] = "ER_MTA_RESET_WORKERS";
	exports[1805] = "ER_COL_COUNT_DOESNT_MATCH_CORRUPTED_V2";
	exports[1806] = "ER_REPLICA_SILENT_RETRY_TRANSACTION";
	exports[1807] = "ER_DISCARD_FK_CHECKS_RUNNING";
	exports[1808] = "ER_TABLE_SCHEMA_MISMATCH";
	exports[1809] = "ER_TABLE_IN_SYSTEM_TABLESPACE";
	exports[1810] = "ER_IO_READ_ERROR";
	exports[1811] = "ER_IO_WRITE_ERROR";
	exports[1812] = "ER_TABLESPACE_MISSING";
	exports[1813] = "ER_TABLESPACE_EXISTS";
	exports[1814] = "ER_TABLESPACE_DISCARDED";
	exports[1815] = "ER_INTERNAL_ERROR";
	exports[1816] = "ER_INNODB_IMPORT_ERROR";
	exports[1817] = "ER_INNODB_INDEX_CORRUPT";
	exports[1818] = "ER_INVALID_YEAR_COLUMN_LENGTH";
	exports[1819] = "ER_NOT_VALID_PASSWORD";
	exports[1820] = "ER_MUST_CHANGE_PASSWORD";
	exports[1821] = "ER_FK_NO_INDEX_CHILD";
	exports[1822] = "ER_FK_NO_INDEX_PARENT";
	exports[1823] = "ER_FK_FAIL_ADD_SYSTEM";
	exports[1824] = "ER_FK_CANNOT_OPEN_PARENT";
	exports[1825] = "ER_FK_INCORRECT_OPTION";
	exports[1826] = "ER_FK_DUP_NAME";
	exports[1827] = "ER_PASSWORD_FORMAT";
	exports[1828] = "ER_FK_COLUMN_CANNOT_DROP";
	exports[1829] = "ER_FK_COLUMN_CANNOT_DROP_CHILD";
	exports[1830] = "ER_FK_COLUMN_NOT_NULL";
	exports[1831] = "ER_DUP_INDEX";
	exports[1832] = "ER_FK_COLUMN_CANNOT_CHANGE";
	exports[1833] = "ER_FK_COLUMN_CANNOT_CHANGE_CHILD";
	exports[1834] = "ER_UNUSED5";
	exports[1835] = "ER_MALFORMED_PACKET";
	exports[1836] = "ER_READ_ONLY_MODE";
	exports[1837] = "ER_GTID_NEXT_TYPE_UNDEFINED_GTID";
	exports[1838] = "ER_VARIABLE_NOT_SETTABLE_IN_SP";
	exports[1839] = "ER_CANT_SET_GTID_PURGED_WHEN_GTID_MODE_IS_OFF";
	exports[1840] = "ER_CANT_SET_GTID_PURGED_WHEN_GTID_EXECUTED_IS_NOT_EMPTY";
	exports[1841] = "ER_CANT_SET_GTID_PURGED_WHEN_OWNED_GTIDS_IS_NOT_EMPTY";
	exports[1842] = "ER_GTID_PURGED_WAS_CHANGED";
	exports[1843] = "ER_GTID_EXECUTED_WAS_CHANGED";
	exports[1844] = "ER_BINLOG_STMT_MODE_AND_NO_REPL_TABLES";
	exports[1845] = "ER_ALTER_OPERATION_NOT_SUPPORTED";
	exports[1846] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON";
	exports[1847] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COPY";
	exports[1848] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_PARTITION";
	exports[1849] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FK_RENAME";
	exports[1850] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COLUMN_TYPE";
	exports[1851] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FK_CHECK";
	exports[1852] = "ER_UNUSED6";
	exports[1853] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_NOPK";
	exports[1854] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_AUTOINC";
	exports[1855] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_HIDDEN_FTS";
	exports[1856] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_CHANGE_FTS";
	exports[1857] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_FTS";
	exports[1858] = "ER_SQL_REPLICA_SKIP_COUNTER_NOT_SETTABLE_IN_GTID_MODE";
	exports[1859] = "ER_DUP_UNKNOWN_IN_INDEX";
	exports[1860] = "ER_IDENT_CAUSES_TOO_LONG_PATH";
	exports[1861] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_NOT_NULL";
	exports[1862] = "ER_MUST_CHANGE_PASSWORD_LOGIN";
	exports[1863] = "ER_ROW_IN_WRONG_PARTITION";
	exports[1864] = "ER_MTA_EVENT_BIGGER_PENDING_JOBS_SIZE_MAX";
	exports[1865] = "ER_INNODB_NO_FT_USES_PARSER";
	exports[1866] = "ER_BINLOG_LOGICAL_CORRUPTION";
	exports[1867] = "ER_WARN_PURGE_LOG_IN_USE";
	exports[1868] = "ER_WARN_PURGE_LOG_IS_ACTIVE";
	exports[1869] = "ER_AUTO_INCREMENT_CONFLICT";
	exports[1870] = "WARN_ON_BLOCKHOLE_IN_RBR";
	exports[1871] = "ER_REPLICA_CM_INIT_REPOSITORY";
	exports[1872] = "ER_REPLICA_AM_INIT_REPOSITORY";
	exports[1873] = "ER_ACCESS_DENIED_CHANGE_USER_ERROR";
	exports[1874] = "ER_INNODB_READ_ONLY";
	exports[1875] = "ER_STOP_REPLICA_SQL_THREAD_TIMEOUT";
	exports[1876] = "ER_STOP_REPLICA_IO_THREAD_TIMEOUT";
	exports[1877] = "ER_TABLE_CORRUPT";
	exports[1878] = "ER_TEMP_FILE_WRITE_FAILURE";
	exports[1879] = "ER_INNODB_FT_AUX_NOT_HEX_ID";
	exports[1880] = "ER_OLD_TEMPORALS_UPGRADED";
	exports[1881] = "ER_INNODB_FORCED_RECOVERY";
	exports[1882] = "ER_AES_INVALID_IV";
	exports[1883] = "ER_PLUGIN_CANNOT_BE_UNINSTALLED";
	exports[1884] = "ER_GTID_UNSAFE_BINLOG_SPLITTABLE_STATEMENT_AND_ASSIGNED_GTID";
	exports[1885] = "ER_REPLICA_HAS_MORE_GTIDS_THAN_SOURCE";
	exports[1886] = "ER_MISSING_KEY";
	exports[1887] = "WARN_NAMED_PIPE_ACCESS_EVERYONE";
	exports[3e3] = "ER_FILE_CORRUPT";
	exports[3001] = "ER_ERROR_ON_SOURCE";
	exports[3002] = "ER_INCONSISTENT_ERROR";
	exports[3003] = "ER_STORAGE_ENGINE_NOT_LOADED";
	exports[3004] = "ER_GET_STACKED_DA_WITHOUT_ACTIVE_HANDLER";
	exports[3005] = "ER_WARN_LEGACY_SYNTAX_CONVERTED";
	exports[3006] = "ER_BINLOG_UNSAFE_FULLTEXT_PLUGIN";
	exports[3007] = "ER_CANNOT_DISCARD_TEMPORARY_TABLE";
	exports[3008] = "ER_FK_DEPTH_EXCEEDED";
	exports[3009] = "ER_COL_COUNT_DOESNT_MATCH_PLEASE_UPDATE_V2";
	exports[3010] = "ER_WARN_TRIGGER_DOESNT_HAVE_CREATED";
	exports[3011] = "ER_REFERENCED_TRG_DOES_NOT_EXIST";
	exports[3012] = "ER_EXPLAIN_NOT_SUPPORTED";
	exports[3013] = "ER_INVALID_FIELD_SIZE";
	exports[3014] = "ER_MISSING_HA_CREATE_OPTION";
	exports[3015] = "ER_ENGINE_OUT_OF_MEMORY";
	exports[3016] = "ER_PASSWORD_EXPIRE_ANONYMOUS_USER";
	exports[3017] = "ER_REPLICA_SQL_THREAD_MUST_STOP";
	exports[3018] = "ER_NO_FT_MATERIALIZED_SUBQUERY";
	exports[3019] = "ER_INNODB_UNDO_LOG_FULL";
	exports[3020] = "ER_INVALID_ARGUMENT_FOR_LOGARITHM";
	exports[3021] = "ER_REPLICA_CHANNEL_IO_THREAD_MUST_STOP";
	exports[3022] = "ER_WARN_OPEN_TEMP_TABLES_MUST_BE_ZERO";
	exports[3023] = "ER_WARN_ONLY_SOURCE_LOG_FILE_NO_POS";
	exports[3024] = "ER_QUERY_TIMEOUT";
	exports[3025] = "ER_NON_RO_SELECT_DISABLE_TIMER";
	exports[3026] = "ER_DUP_LIST_ENTRY";
	exports[3027] = "ER_SQL_MODE_NO_EFFECT";
	exports[3028] = "ER_AGGREGATE_ORDER_FOR_UNION";
	exports[3029] = "ER_AGGREGATE_ORDER_NON_AGG_QUERY";
	exports[3030] = "ER_REPLICA_WORKER_STOPPED_PREVIOUS_THD_ERROR";
	exports[3031] = "ER_DONT_SUPPORT_REPLICA_PRESERVE_COMMIT_ORDER";
	exports[3032] = "ER_SERVER_OFFLINE_MODE";
	exports[3033] = "ER_GIS_DIFFERENT_SRIDS";
	exports[3034] = "ER_GIS_UNSUPPORTED_ARGUMENT";
	exports[3035] = "ER_GIS_UNKNOWN_ERROR";
	exports[3036] = "ER_GIS_UNKNOWN_EXCEPTION";
	exports[3037] = "ER_GIS_INVALID_DATA";
	exports[3038] = "ER_BOOST_GEOMETRY_EMPTY_INPUT_EXCEPTION";
	exports[3039] = "ER_BOOST_GEOMETRY_CENTROID_EXCEPTION";
	exports[3040] = "ER_BOOST_GEOMETRY_OVERLAY_INVALID_INPUT_EXCEPTION";
	exports[3041] = "ER_BOOST_GEOMETRY_TURN_INFO_EXCEPTION";
	exports[3042] = "ER_BOOST_GEOMETRY_SELF_INTERSECTION_POINT_EXCEPTION";
	exports[3043] = "ER_BOOST_GEOMETRY_UNKNOWN_EXCEPTION";
	exports[3044] = "ER_STD_BAD_ALLOC_ERROR";
	exports[3045] = "ER_STD_DOMAIN_ERROR";
	exports[3046] = "ER_STD_LENGTH_ERROR";
	exports[3047] = "ER_STD_INVALID_ARGUMENT";
	exports[3048] = "ER_STD_OUT_OF_RANGE_ERROR";
	exports[3049] = "ER_STD_OVERFLOW_ERROR";
	exports[3050] = "ER_STD_RANGE_ERROR";
	exports[3051] = "ER_STD_UNDERFLOW_ERROR";
	exports[3052] = "ER_STD_LOGIC_ERROR";
	exports[3053] = "ER_STD_RUNTIME_ERROR";
	exports[3054] = "ER_STD_UNKNOWN_EXCEPTION";
	exports[3055] = "ER_GIS_DATA_WRONG_ENDIANESS";
	exports[3056] = "ER_CHANGE_SOURCE_PASSWORD_LENGTH";
	exports[3057] = "ER_USER_LOCK_WRONG_NAME";
	exports[3058] = "ER_USER_LOCK_DEADLOCK";
	exports[3059] = "ER_REPLACE_INACCESSIBLE_ROWS";
	exports[3060] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_GIS";
	exports[3061] = "ER_ILLEGAL_USER_VAR";
	exports[3062] = "ER_GTID_MODE_OFF";
	exports[3063] = "ER_UNSUPPORTED_BY_REPLICATION_THREAD";
	exports[3064] = "ER_INCORRECT_TYPE";
	exports[3065] = "ER_FIELD_IN_ORDER_NOT_SELECT";
	exports[3066] = "ER_AGGREGATE_IN_ORDER_NOT_SELECT";
	exports[3067] = "ER_INVALID_RPL_WILD_TABLE_FILTER_PATTERN";
	exports[3068] = "ER_NET_OK_PACKET_TOO_LARGE";
	exports[3069] = "ER_INVALID_JSON_DATA";
	exports[3070] = "ER_INVALID_GEOJSON_MISSING_MEMBER";
	exports[3071] = "ER_INVALID_GEOJSON_WRONG_TYPE";
	exports[3072] = "ER_INVALID_GEOJSON_UNSPECIFIED";
	exports[3073] = "ER_DIMENSION_UNSUPPORTED";
	exports[3074] = "ER_REPLICA_CHANNEL_DOES_NOT_EXIST";
	exports[3075] = "ER_SLAVE_MULTIPLE_CHANNELS_HOST_PORT";
	exports[3076] = "ER_REPLICA_CHANNEL_NAME_INVALID_OR_TOO_LONG";
	exports[3077] = "ER_REPLICA_NEW_CHANNEL_WRONG_REPOSITORY";
	exports[3078] = "ER_SLAVE_CHANNEL_DELETE";
	exports[3079] = "ER_REPLICA_MULTIPLE_CHANNELS_CMD";
	exports[3080] = "ER_REPLICA_MAX_CHANNELS_EXCEEDED";
	exports[3081] = "ER_REPLICA_CHANNEL_MUST_STOP";
	exports[3082] = "ER_REPLICA_CHANNEL_NOT_RUNNING";
	exports[3083] = "ER_REPLICA_CHANNEL_WAS_RUNNING";
	exports[3084] = "ER_REPLICA_CHANNEL_WAS_NOT_RUNNING";
	exports[3085] = "ER_REPLICA_CHANNEL_SQL_THREAD_MUST_STOP";
	exports[3086] = "ER_REPLICA_CHANNEL_SQL_SKIP_COUNTER";
	exports[3087] = "ER_WRONG_FIELD_WITH_GROUP_V2";
	exports[3088] = "ER_MIX_OF_GROUP_FUNC_AND_FIELDS_V2";
	exports[3089] = "ER_WARN_DEPRECATED_SYSVAR_UPDATE";
	exports[3090] = "ER_WARN_DEPRECATED_SQLMODE";
	exports[3091] = "ER_CANNOT_LOG_PARTIAL_DROP_DATABASE_WITH_GTID";
	exports[3092] = "ER_GROUP_REPLICATION_CONFIGURATION";
	exports[3093] = "ER_GROUP_REPLICATION_RUNNING";
	exports[3094] = "ER_GROUP_REPLICATION_APPLIER_INIT_ERROR";
	exports[3095] = "ER_GROUP_REPLICATION_STOP_APPLIER_THREAD_TIMEOUT";
	exports[3096] = "ER_GROUP_REPLICATION_COMMUNICATION_LAYER_SESSION_ERROR";
	exports[3097] = "ER_GROUP_REPLICATION_COMMUNICATION_LAYER_JOIN_ERROR";
	exports[3098] = "ER_BEFORE_DML_VALIDATION_ERROR";
	exports[3099] = "ER_PREVENTS_VARIABLE_WITHOUT_RBR";
	exports[3100] = "ER_RUN_HOOK_ERROR";
	exports[3101] = "ER_TRANSACTION_ROLLBACK_DURING_COMMIT";
	exports[3102] = "ER_GENERATED_COLUMN_FUNCTION_IS_NOT_ALLOWED";
	exports[3103] = "ER_UNSUPPORTED_ALTER_INPLACE_ON_VIRTUAL_COLUMN";
	exports[3104] = "ER_WRONG_FK_OPTION_FOR_GENERATED_COLUMN";
	exports[3105] = "ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN";
	exports[3106] = "ER_UNSUPPORTED_ACTION_ON_GENERATED_COLUMN";
	exports[3107] = "ER_GENERATED_COLUMN_NON_PRIOR";
	exports[3108] = "ER_DEPENDENT_BY_GENERATED_COLUMN";
	exports[3109] = "ER_GENERATED_COLUMN_REF_AUTO_INC";
	exports[3110] = "ER_FEATURE_NOT_AVAILABLE";
	exports[3111] = "ER_CANT_SET_GTID_MODE";
	exports[3112] = "ER_CANT_USE_AUTO_POSITION_WITH_GTID_MODE_OFF";
	exports[3113] = "ER_CANT_REPLICATE_ANONYMOUS_WITH_AUTO_POSITION";
	exports[3114] = "ER_CANT_REPLICATE_ANONYMOUS_WITH_GTID_MODE_ON";
	exports[3115] = "ER_CANT_REPLICATE_GTID_WITH_GTID_MODE_OFF";
	exports[3116] = "ER_CANT_ENFORCE_GTID_CONSISTENCY_WITH_ONGOING_GTID_VIOLATING_TX";
	exports[3117] = "ER_ENFORCE_GTID_CONSISTENCY_WARN_WITH_ONGOING_GTID_VIOLATING_TX";
	exports[3118] = "ER_ACCOUNT_HAS_BEEN_LOCKED";
	exports[3119] = "ER_WRONG_TABLESPACE_NAME";
	exports[3120] = "ER_TABLESPACE_IS_NOT_EMPTY";
	exports[3121] = "ER_WRONG_FILE_NAME";
	exports[3122] = "ER_BOOST_GEOMETRY_INCONSISTENT_TURNS_EXCEPTION";
	exports[3123] = "ER_WARN_OPTIMIZER_HINT_SYNTAX_ERROR";
	exports[3124] = "ER_WARN_BAD_MAX_EXECUTION_TIME";
	exports[3125] = "ER_WARN_UNSUPPORTED_MAX_EXECUTION_TIME";
	exports[3126] = "ER_WARN_CONFLICTING_HINT";
	exports[3127] = "ER_WARN_UNKNOWN_QB_NAME";
	exports[3128] = "ER_UNRESOLVED_HINT_NAME";
	exports[3129] = "ER_WARN_ON_MODIFYING_GTID_EXECUTED_TABLE";
	exports[3130] = "ER_PLUGGABLE_PROTOCOL_COMMAND_NOT_SUPPORTED";
	exports[3131] = "ER_LOCKING_SERVICE_WRONG_NAME";
	exports[3132] = "ER_LOCKING_SERVICE_DEADLOCK";
	exports[3133] = "ER_LOCKING_SERVICE_TIMEOUT";
	exports[3134] = "ER_GIS_MAX_POINTS_IN_GEOMETRY_OVERFLOWED";
	exports[3135] = "ER_SQL_MODE_MERGED";
	exports[3136] = "ER_VTOKEN_PLUGIN_TOKEN_MISMATCH";
	exports[3137] = "ER_VTOKEN_PLUGIN_TOKEN_NOT_FOUND";
	exports[3138] = "ER_CANT_SET_VARIABLE_WHEN_OWNING_GTID";
	exports[3139] = "ER_REPLICA_CHANNEL_OPERATION_NOT_ALLOWED";
	exports[3140] = "ER_INVALID_JSON_TEXT";
	exports[3141] = "ER_INVALID_JSON_TEXT_IN_PARAM";
	exports[3142] = "ER_INVALID_JSON_BINARY_DATA";
	exports[3143] = "ER_INVALID_JSON_PATH";
	exports[3144] = "ER_INVALID_JSON_CHARSET";
	exports[3145] = "ER_INVALID_JSON_CHARSET_IN_FUNCTION";
	exports[3146] = "ER_INVALID_TYPE_FOR_JSON";
	exports[3147] = "ER_INVALID_CAST_TO_JSON";
	exports[3148] = "ER_INVALID_JSON_PATH_CHARSET";
	exports[3149] = "ER_INVALID_JSON_PATH_WILDCARD";
	exports[3150] = "ER_JSON_VALUE_TOO_BIG";
	exports[3151] = "ER_JSON_KEY_TOO_BIG";
	exports[3152] = "ER_JSON_USED_AS_KEY";
	exports[3153] = "ER_JSON_VACUOUS_PATH";
	exports[3154] = "ER_JSON_BAD_ONE_OR_ALL_ARG";
	exports[3155] = "ER_NUMERIC_JSON_VALUE_OUT_OF_RANGE";
	exports[3156] = "ER_INVALID_JSON_VALUE_FOR_CAST";
	exports[3157] = "ER_JSON_DOCUMENT_TOO_DEEP";
	exports[3158] = "ER_JSON_DOCUMENT_NULL_KEY";
	exports[3159] = "ER_SECURE_TRANSPORT_REQUIRED";
	exports[3160] = "ER_NO_SECURE_TRANSPORTS_CONFIGURED";
	exports[3161] = "ER_DISABLED_STORAGE_ENGINE";
	exports[3162] = "ER_USER_DOES_NOT_EXIST";
	exports[3163] = "ER_USER_ALREADY_EXISTS";
	exports[3164] = "ER_AUDIT_API_ABORT";
	exports[3165] = "ER_INVALID_JSON_PATH_ARRAY_CELL";
	exports[3166] = "ER_BUFPOOL_RESIZE_INPROGRESS";
	exports[3167] = "ER_FEATURE_DISABLED_SEE_DOC";
	exports[3168] = "ER_SERVER_ISNT_AVAILABLE";
	exports[3169] = "ER_SESSION_WAS_KILLED";
	exports[3170] = "ER_CAPACITY_EXCEEDED";
	exports[3171] = "ER_CAPACITY_EXCEEDED_IN_RANGE_OPTIMIZER";
	exports[3172] = "ER_TABLE_NEEDS_UPG_PART";
	exports[3173] = "ER_CANT_WAIT_FOR_EXECUTED_GTID_SET_WHILE_OWNING_A_GTID";
	exports[3174] = "ER_CANNOT_ADD_FOREIGN_BASE_COL_VIRTUAL";
	exports[3175] = "ER_CANNOT_CREATE_VIRTUAL_INDEX_CONSTRAINT";
	exports[3176] = "ER_ERROR_ON_MODIFYING_GTID_EXECUTED_TABLE";
	exports[3177] = "ER_LOCK_REFUSED_BY_ENGINE";
	exports[3178] = "ER_UNSUPPORTED_ALTER_ONLINE_ON_VIRTUAL_COLUMN";
	exports[3179] = "ER_MASTER_KEY_ROTATION_NOT_SUPPORTED_BY_SE";
	exports[3180] = "ER_MASTER_KEY_ROTATION_ERROR_BY_SE";
	exports[3181] = "ER_MASTER_KEY_ROTATION_BINLOG_FAILED";
	exports[3182] = "ER_MASTER_KEY_ROTATION_SE_UNAVAILABLE";
	exports[3183] = "ER_TABLESPACE_CANNOT_ENCRYPT";
	exports[3184] = "ER_INVALID_ENCRYPTION_OPTION";
	exports[3185] = "ER_CANNOT_FIND_KEY_IN_KEYRING";
	exports[3186] = "ER_CAPACITY_EXCEEDED_IN_PARSER";
	exports[3187] = "ER_UNSUPPORTED_ALTER_ENCRYPTION_INPLACE";
	exports[3188] = "ER_KEYRING_UDF_KEYRING_SERVICE_ERROR";
	exports[3189] = "ER_USER_COLUMN_OLD_LENGTH";
	exports[3190] = "ER_CANT_RESET_SOURCE";
	exports[3191] = "ER_GROUP_REPLICATION_MAX_GROUP_SIZE";
	exports[3192] = "ER_CANNOT_ADD_FOREIGN_BASE_COL_STORED";
	exports[3193] = "ER_TABLE_REFERENCED";
	exports[3194] = "ER_PARTITION_ENGINE_DEPRECATED_FOR_TABLE";
	exports[3195] = "ER_WARN_USING_GEOMFROMWKB_TO_SET_SRID_ZERO";
	exports[3196] = "ER_WARN_USING_GEOMFROMWKB_TO_SET_SRID";
	exports[3197] = "ER_XA_RETRY";
	exports[3198] = "ER_KEYRING_AWS_UDF_AWS_KMS_ERROR";
	exports[3199] = "ER_BINLOG_UNSAFE_XA";
	exports[3200] = "ER_UDF_ERROR";
	exports[3201] = "ER_KEYRING_MIGRATION_FAILURE";
	exports[3202] = "ER_KEYRING_ACCESS_DENIED_ERROR";
	exports[3203] = "ER_KEYRING_MIGRATION_STATUS";
	exports[3204] = "ER_PLUGIN_FAILED_TO_OPEN_TABLES";
	exports[3205] = "ER_PLUGIN_FAILED_TO_OPEN_TABLE";
	exports[3206] = "ER_AUDIT_LOG_NO_KEYRING_PLUGIN_INSTALLED";
	exports[3207] = "ER_AUDIT_LOG_ENCRYPTION_PASSWORD_HAS_NOT_BEEN_SET";
	exports[3208] = "ER_AUDIT_LOG_COULD_NOT_CREATE_AES_KEY";
	exports[3209] = "ER_AUDIT_LOG_ENCRYPTION_PASSWORD_CANNOT_BE_FETCHED";
	exports[3210] = "ER_AUDIT_LOG_JSON_FILTERING_NOT_ENABLED";
	exports[3211] = "ER_AUDIT_LOG_UDF_INSUFFICIENT_PRIVILEGE";
	exports[3212] = "ER_AUDIT_LOG_SUPER_PRIVILEGE_REQUIRED";
	exports[3213] = "ER_COULD_NOT_REINITIALIZE_AUDIT_LOG_FILTERS";
	exports[3214] = "ER_AUDIT_LOG_UDF_INVALID_ARGUMENT_TYPE";
	exports[3215] = "ER_AUDIT_LOG_UDF_INVALID_ARGUMENT_COUNT";
	exports[3216] = "ER_AUDIT_LOG_HAS_NOT_BEEN_INSTALLED";
	exports[3217] = "ER_AUDIT_LOG_UDF_READ_INVALID_MAX_ARRAY_LENGTH_ARG_TYPE";
	exports[3218] = "ER_AUDIT_LOG_UDF_READ_INVALID_MAX_ARRAY_LENGTH_ARG_VALUE";
	exports[3219] = "ER_AUDIT_LOG_JSON_FILTER_PARSING_ERROR";
	exports[3220] = "ER_AUDIT_LOG_JSON_FILTER_NAME_CANNOT_BE_EMPTY";
	exports[3221] = "ER_AUDIT_LOG_JSON_USER_NAME_CANNOT_BE_EMPTY";
	exports[3222] = "ER_AUDIT_LOG_JSON_FILTER_DOES_NOT_EXISTS";
	exports[3223] = "ER_AUDIT_LOG_USER_FIRST_CHARACTER_MUST_BE_ALPHANUMERIC";
	exports[3224] = "ER_AUDIT_LOG_USER_NAME_INVALID_CHARACTER";
	exports[3225] = "ER_AUDIT_LOG_HOST_NAME_INVALID_CHARACTER";
	exports[3226] = "WARN_DEPRECATED_MAXDB_SQL_MODE_FOR_TIMESTAMP";
	exports[3227] = "ER_XA_REPLICATION_FILTERS";
	exports[3228] = "ER_CANT_OPEN_ERROR_LOG";
	exports[3229] = "ER_GROUPING_ON_TIMESTAMP_IN_DST";
	exports[3230] = "ER_CANT_START_SERVER_NAMED_PIPE";
	exports[3231] = "ER_WRITE_SET_EXCEEDS_LIMIT";
	exports[3232] = "ER_DEPRECATED_TLS_VERSION_SESSION_57";
	exports[3233] = "ER_WARN_DEPRECATED_TLS_VERSION_57";
	exports[3234] = "ER_WARN_WRONG_NATIVE_TABLE_STRUCTURE";
	exports[3235] = "ER_AES_INVALID_KDF_NAME";
	exports[3236] = "ER_AES_INVALID_KDF_ITERATIONS";
	exports[3237] = "WARN_AES_KEY_SIZE";
	exports[3238] = "ER_AES_INVALID_KDF_OPTION_SIZE";
	exports[3500] = "ER_UNSUPPORT_COMPRESSED_TEMPORARY_TABLE";
	exports[3501] = "ER_ACL_OPERATION_FAILED";
	exports[3502] = "ER_UNSUPPORTED_INDEX_ALGORITHM";
	exports[3503] = "ER_NO_SUCH_DB";
	exports[3504] = "ER_TOO_BIG_ENUM";
	exports[3505] = "ER_TOO_LONG_SET_ENUM_VALUE";
	exports[3506] = "ER_INVALID_DD_OBJECT";
	exports[3507] = "ER_UPDATING_DD_TABLE";
	exports[3508] = "ER_INVALID_DD_OBJECT_ID";
	exports[3509] = "ER_INVALID_DD_OBJECT_NAME";
	exports[3510] = "ER_TABLESPACE_MISSING_WITH_NAME";
	exports[3511] = "ER_TOO_LONG_ROUTINE_COMMENT";
	exports[3512] = "ER_SP_LOAD_FAILED";
	exports[3513] = "ER_INVALID_BITWISE_OPERANDS_SIZE";
	exports[3514] = "ER_INVALID_BITWISE_AGGREGATE_OPERANDS_SIZE";
	exports[3515] = "ER_WARN_UNSUPPORTED_HINT";
	exports[3516] = "ER_UNEXPECTED_GEOMETRY_TYPE";
	exports[3517] = "ER_SRS_PARSE_ERROR";
	exports[3518] = "ER_SRS_PROJ_PARAMETER_MISSING";
	exports[3519] = "ER_WARN_SRS_NOT_FOUND";
	exports[3520] = "ER_SRS_NOT_CARTESIAN";
	exports[3521] = "ER_SRS_NOT_CARTESIAN_UNDEFINED";
	exports[3522] = "ER_PK_INDEX_CANT_BE_INVISIBLE";
	exports[3523] = "ER_UNKNOWN_AUTHID";
	exports[3524] = "ER_FAILED_ROLE_GRANT";
	exports[3525] = "ER_OPEN_ROLE_TABLES";
	exports[3526] = "ER_FAILED_DEFAULT_ROLES";
	exports[3527] = "ER_COMPONENTS_NO_SCHEME";
	exports[3528] = "ER_COMPONENTS_NO_SCHEME_SERVICE";
	exports[3529] = "ER_COMPONENTS_CANT_LOAD";
	exports[3530] = "ER_ROLE_NOT_GRANTED";
	exports[3531] = "ER_FAILED_REVOKE_ROLE";
	exports[3532] = "ER_RENAME_ROLE";
	exports[3533] = "ER_COMPONENTS_CANT_ACQUIRE_SERVICE_IMPLEMENTATION";
	exports[3534] = "ER_COMPONENTS_CANT_SATISFY_DEPENDENCY";
	exports[3535] = "ER_COMPONENTS_LOAD_CANT_REGISTER_SERVICE_IMPLEMENTATION";
	exports[3536] = "ER_COMPONENTS_LOAD_CANT_INITIALIZE";
	exports[3537] = "ER_COMPONENTS_UNLOAD_NOT_LOADED";
	exports[3538] = "ER_COMPONENTS_UNLOAD_CANT_DEINITIALIZE";
	exports[3539] = "ER_COMPONENTS_CANT_RELEASE_SERVICE";
	exports[3540] = "ER_COMPONENTS_UNLOAD_CANT_UNREGISTER_SERVICE";
	exports[3541] = "ER_COMPONENTS_CANT_UNLOAD";
	exports[3542] = "ER_WARN_UNLOAD_THE_NOT_PERSISTED";
	exports[3543] = "ER_COMPONENT_TABLE_INCORRECT";
	exports[3544] = "ER_COMPONENT_MANIPULATE_ROW_FAILED";
	exports[3545] = "ER_COMPONENTS_UNLOAD_DUPLICATE_IN_GROUP";
	exports[3546] = "ER_CANT_SET_GTID_PURGED_DUE_SETS_CONSTRAINTS";
	exports[3547] = "ER_CANNOT_LOCK_USER_MANAGEMENT_CACHES";
	exports[3548] = "ER_SRS_NOT_FOUND";
	exports[3549] = "ER_VARIABLE_NOT_PERSISTED";
	exports[3550] = "ER_IS_QUERY_INVALID_CLAUSE";
	exports[3551] = "ER_UNABLE_TO_STORE_STATISTICS";
	exports[3552] = "ER_NO_SYSTEM_SCHEMA_ACCESS";
	exports[3553] = "ER_NO_SYSTEM_TABLESPACE_ACCESS";
	exports[3554] = "ER_NO_SYSTEM_TABLE_ACCESS";
	exports[3555] = "ER_NO_SYSTEM_TABLE_ACCESS_FOR_DICTIONARY_TABLE";
	exports[3556] = "ER_NO_SYSTEM_TABLE_ACCESS_FOR_SYSTEM_TABLE";
	exports[3557] = "ER_NO_SYSTEM_TABLE_ACCESS_FOR_TABLE";
	exports[3558] = "ER_INVALID_OPTION_KEY";
	exports[3559] = "ER_INVALID_OPTION_VALUE";
	exports[3560] = "ER_INVALID_OPTION_KEY_VALUE_PAIR";
	exports[3561] = "ER_INVALID_OPTION_START_CHARACTER";
	exports[3562] = "ER_INVALID_OPTION_END_CHARACTER";
	exports[3563] = "ER_INVALID_OPTION_CHARACTERS";
	exports[3564] = "ER_DUPLICATE_OPTION_KEY";
	exports[3565] = "ER_WARN_SRS_NOT_FOUND_AXIS_ORDER";
	exports[3566] = "ER_NO_ACCESS_TO_NATIVE_FCT";
	exports[3567] = "ER_RESET_SOURCE_TO_VALUE_OUT_OF_RANGE";
	exports[3568] = "ER_UNRESOLVED_TABLE_LOCK";
	exports[3569] = "ER_DUPLICATE_TABLE_LOCK";
	exports[3570] = "ER_BINLOG_UNSAFE_SKIP_LOCKED";
	exports[3571] = "ER_BINLOG_UNSAFE_NOWAIT";
	exports[3572] = "ER_LOCK_NOWAIT";
	exports[3573] = "ER_CTE_RECURSIVE_REQUIRES_UNION";
	exports[3574] = "ER_CTE_RECURSIVE_REQUIRES_NONRECURSIVE_FIRST";
	exports[3575] = "ER_CTE_RECURSIVE_FORBIDS_AGGREGATION";
	exports[3576] = "ER_CTE_RECURSIVE_FORBIDDEN_JOIN_ORDER";
	exports[3577] = "ER_CTE_RECURSIVE_REQUIRES_SINGLE_REFERENCE";
	exports[3578] = "ER_SWITCH_TMP_ENGINE";
	exports[3579] = "ER_WINDOW_NO_SUCH_WINDOW";
	exports[3580] = "ER_WINDOW_CIRCULARITY_IN_WINDOW_GRAPH";
	exports[3581] = "ER_WINDOW_NO_CHILD_PARTITIONING";
	exports[3582] = "ER_WINDOW_NO_INHERIT_FRAME";
	exports[3583] = "ER_WINDOW_NO_REDEFINE_ORDER_BY";
	exports[3584] = "ER_WINDOW_FRAME_START_ILLEGAL";
	exports[3585] = "ER_WINDOW_FRAME_END_ILLEGAL";
	exports[3586] = "ER_WINDOW_FRAME_ILLEGAL";
	exports[3587] = "ER_WINDOW_RANGE_FRAME_ORDER_TYPE";
	exports[3588] = "ER_WINDOW_RANGE_FRAME_TEMPORAL_TYPE";
	exports[3589] = "ER_WINDOW_RANGE_FRAME_NUMERIC_TYPE";
	exports[3590] = "ER_WINDOW_RANGE_BOUND_NOT_CONSTANT";
	exports[3591] = "ER_WINDOW_DUPLICATE_NAME";
	exports[3592] = "ER_WINDOW_ILLEGAL_ORDER_BY";
	exports[3593] = "ER_WINDOW_INVALID_WINDOW_FUNC_USE";
	exports[3594] = "ER_WINDOW_INVALID_WINDOW_FUNC_ALIAS_USE";
	exports[3595] = "ER_WINDOW_NESTED_WINDOW_FUNC_USE_IN_WINDOW_SPEC";
	exports[3596] = "ER_WINDOW_ROWS_INTERVAL_USE";
	exports[3597] = "ER_WINDOW_NO_GROUP_ORDER";
	exports[3598] = "ER_WINDOW_EXPLAIN_JSON";
	exports[3599] = "ER_WINDOW_FUNCTION_IGNORES_FRAME";
	exports[3600] = "ER_WL9236_NOW";
	exports[3601] = "ER_INVALID_NO_OF_ARGS";
	exports[3602] = "ER_FIELD_IN_GROUPING_NOT_GROUP_BY";
	exports[3603] = "ER_TOO_LONG_TABLESPACE_COMMENT";
	exports[3604] = "ER_ENGINE_CANT_DROP_TABLE";
	exports[3605] = "ER_ENGINE_CANT_DROP_MISSING_TABLE";
	exports[3606] = "ER_TABLESPACE_DUP_FILENAME";
	exports[3607] = "ER_DB_DROP_RMDIR2";
	exports[3608] = "ER_IMP_NO_FILES_MATCHED";
	exports[3609] = "ER_IMP_SCHEMA_DOES_NOT_EXIST";
	exports[3610] = "ER_IMP_TABLE_ALREADY_EXISTS";
	exports[3611] = "ER_IMP_INCOMPATIBLE_MYSQLD_VERSION";
	exports[3612] = "ER_IMP_INCOMPATIBLE_DD_VERSION";
	exports[3613] = "ER_IMP_INCOMPATIBLE_SDI_VERSION";
	exports[3614] = "ER_WARN_INVALID_HINT";
	exports[3615] = "ER_VAR_DOES_NOT_EXIST";
	exports[3616] = "ER_LONGITUDE_OUT_OF_RANGE";
	exports[3617] = "ER_LATITUDE_OUT_OF_RANGE";
	exports[3618] = "ER_NOT_IMPLEMENTED_FOR_GEOGRAPHIC_SRS";
	exports[3619] = "ER_ILLEGAL_PRIVILEGE_LEVEL";
	exports[3620] = "ER_NO_SYSTEM_VIEW_ACCESS";
	exports[3621] = "ER_COMPONENT_FILTER_FLABBERGASTED";
	exports[3622] = "ER_PART_EXPR_TOO_LONG";
	exports[3623] = "ER_UDF_DROP_DYNAMICALLY_REGISTERED";
	exports[3624] = "ER_UNABLE_TO_STORE_COLUMN_STATISTICS";
	exports[3625] = "ER_UNABLE_TO_UPDATE_COLUMN_STATISTICS";
	exports[3626] = "ER_UNABLE_TO_DROP_COLUMN_STATISTICS";
	exports[3627] = "ER_UNABLE_TO_BUILD_HISTOGRAM";
	exports[3628] = "ER_MANDATORY_ROLE";
	exports[3629] = "ER_MISSING_TABLESPACE_FILE";
	exports[3630] = "ER_PERSIST_ONLY_ACCESS_DENIED_ERROR";
	exports[3631] = "ER_CMD_NEED_SUPER";
	exports[3632] = "ER_PATH_IN_DATADIR";
	exports[3633] = "ER_CLONE_DDL_IN_PROGRESS";
	exports[3634] = "ER_CLONE_TOO_MANY_CONCURRENT_CLONES";
	exports[3635] = "ER_APPLIER_LOG_EVENT_VALIDATION_ERROR";
	exports[3636] = "ER_CTE_MAX_RECURSION_DEPTH";
	exports[3637] = "ER_NOT_HINT_UPDATABLE_VARIABLE";
	exports[3638] = "ER_CREDENTIALS_CONTRADICT_TO_HISTORY";
	exports[3639] = "ER_WARNING_PASSWORD_HISTORY_CLAUSES_VOID";
	exports[3640] = "ER_CLIENT_DOES_NOT_SUPPORT";
	exports[3641] = "ER_I_S_SKIPPED_TABLESPACE";
	exports[3642] = "ER_TABLESPACE_ENGINE_MISMATCH";
	exports[3643] = "ER_WRONG_SRID_FOR_COLUMN";
	exports[3644] = "ER_CANNOT_ALTER_SRID_DUE_TO_INDEX";
	exports[3645] = "ER_WARN_BINLOG_PARTIAL_UPDATES_DISABLED";
	exports[3646] = "ER_WARN_BINLOG_V1_ROW_EVENTS_DISABLED";
	exports[3647] = "ER_WARN_BINLOG_PARTIAL_UPDATES_SUGGESTS_PARTIAL_IMAGES";
	exports[3648] = "ER_COULD_NOT_APPLY_JSON_DIFF";
	exports[3649] = "ER_CORRUPTED_JSON_DIFF";
	exports[3650] = "ER_RESOURCE_GROUP_EXISTS";
	exports[3651] = "ER_RESOURCE_GROUP_NOT_EXISTS";
	exports[3652] = "ER_INVALID_VCPU_ID";
	exports[3653] = "ER_INVALID_VCPU_RANGE";
	exports[3654] = "ER_INVALID_THREAD_PRIORITY";
	exports[3655] = "ER_DISALLOWED_OPERATION";
	exports[3656] = "ER_RESOURCE_GROUP_BUSY";
	exports[3657] = "ER_RESOURCE_GROUP_DISABLED";
	exports[3658] = "ER_FEATURE_UNSUPPORTED";
	exports[3659] = "ER_ATTRIBUTE_IGNORED";
	exports[3660] = "ER_INVALID_THREAD_ID";
	exports[3661] = "ER_RESOURCE_GROUP_BIND_FAILED";
	exports[3662] = "ER_INVALID_USE_OF_FORCE_OPTION";
	exports[3663] = "ER_GROUP_REPLICATION_COMMAND_FAILURE";
	exports[3664] = "ER_SDI_OPERATION_FAILED";
	exports[3665] = "ER_MISSING_JSON_TABLE_VALUE";
	exports[3666] = "ER_WRONG_JSON_TABLE_VALUE";
	exports[3667] = "ER_TF_MUST_HAVE_ALIAS";
	exports[3668] = "ER_TF_FORBIDDEN_JOIN_TYPE";
	exports[3669] = "ER_JT_VALUE_OUT_OF_RANGE";
	exports[3670] = "ER_JT_MAX_NESTED_PATH";
	exports[3671] = "ER_PASSWORD_EXPIRATION_NOT_SUPPORTED_BY_AUTH_METHOD";
	exports[3672] = "ER_INVALID_GEOJSON_CRS_NOT_TOP_LEVEL";
	exports[3673] = "ER_BAD_NULL_ERROR_NOT_IGNORED";
	exports[3674] = "WARN_USELESS_SPATIAL_INDEX";
	exports[3675] = "ER_DISK_FULL_NOWAIT";
	exports[3676] = "ER_PARSE_ERROR_IN_DIGEST_FN";
	exports[3677] = "ER_UNDISCLOSED_PARSE_ERROR_IN_DIGEST_FN";
	exports[3678] = "ER_SCHEMA_DIR_EXISTS";
	exports[3679] = "ER_SCHEMA_DIR_MISSING";
	exports[3680] = "ER_SCHEMA_DIR_CREATE_FAILED";
	exports[3681] = "ER_SCHEMA_DIR_UNKNOWN";
	exports[3682] = "ER_ONLY_IMPLEMENTED_FOR_SRID_0_AND_4326";
	exports[3683] = "ER_BINLOG_EXPIRE_LOG_DAYS_AND_SECS_USED_TOGETHER";
	exports[3684] = "ER_REGEXP_BUFFER_OVERFLOW";
	exports[3685] = "ER_REGEXP_ILLEGAL_ARGUMENT";
	exports[3686] = "ER_REGEXP_INDEX_OUTOFBOUNDS_ERROR";
	exports[3687] = "ER_REGEXP_INTERNAL_ERROR";
	exports[3688] = "ER_REGEXP_RULE_SYNTAX";
	exports[3689] = "ER_REGEXP_BAD_ESCAPE_SEQUENCE";
	exports[3690] = "ER_REGEXP_UNIMPLEMENTED";
	exports[3691] = "ER_REGEXP_MISMATCHED_PAREN";
	exports[3692] = "ER_REGEXP_BAD_INTERVAL";
	exports[3693] = "ER_REGEXP_MAX_LT_MIN";
	exports[3694] = "ER_REGEXP_INVALID_BACK_REF";
	exports[3695] = "ER_REGEXP_LOOK_BEHIND_LIMIT";
	exports[3696] = "ER_REGEXP_MISSING_CLOSE_BRACKET";
	exports[3697] = "ER_REGEXP_INVALID_RANGE";
	exports[3698] = "ER_REGEXP_STACK_OVERFLOW";
	exports[3699] = "ER_REGEXP_TIME_OUT";
	exports[3700] = "ER_REGEXP_PATTERN_TOO_BIG";
	exports[3701] = "ER_CANT_SET_ERROR_LOG_SERVICE";
	exports[3702] = "ER_EMPTY_PIPELINE_FOR_ERROR_LOG_SERVICE";
	exports[3703] = "ER_COMPONENT_FILTER_DIAGNOSTICS";
	exports[3704] = "ER_NOT_IMPLEMENTED_FOR_CARTESIAN_SRS";
	exports[3705] = "ER_NOT_IMPLEMENTED_FOR_PROJECTED_SRS";
	exports[3706] = "ER_NONPOSITIVE_RADIUS";
	exports[3707] = "ER_RESTART_SERVER_FAILED";
	exports[3708] = "ER_SRS_MISSING_MANDATORY_ATTRIBUTE";
	exports[3709] = "ER_SRS_MULTIPLE_ATTRIBUTE_DEFINITIONS";
	exports[3710] = "ER_SRS_NAME_CANT_BE_EMPTY_OR_WHITESPACE";
	exports[3711] = "ER_SRS_ORGANIZATION_CANT_BE_EMPTY_OR_WHITESPACE";
	exports[3712] = "ER_SRS_ID_ALREADY_EXISTS";
	exports[3713] = "ER_WARN_SRS_ID_ALREADY_EXISTS";
	exports[3714] = "ER_CANT_MODIFY_SRID_0";
	exports[3715] = "ER_WARN_RESERVED_SRID_RANGE";
	exports[3716] = "ER_CANT_MODIFY_SRS_USED_BY_COLUMN";
	exports[3717] = "ER_SRS_INVALID_CHARACTER_IN_ATTRIBUTE";
	exports[3718] = "ER_SRS_ATTRIBUTE_STRING_TOO_LONG";
	exports[3719] = "ER_DEPRECATED_UTF8_ALIAS";
	exports[3720] = "ER_DEPRECATED_NATIONAL";
	exports[3721] = "ER_INVALID_DEFAULT_UTF8MB4_COLLATION";
	exports[3722] = "ER_UNABLE_TO_COLLECT_LOG_STATUS";
	exports[3723] = "ER_RESERVED_TABLESPACE_NAME";
	exports[3724] = "ER_UNABLE_TO_SET_OPTION";
	exports[3725] = "ER_REPLICA_POSSIBLY_DIVERGED_AFTER_DDL";
	exports[3726] = "ER_SRS_NOT_GEOGRAPHIC";
	exports[3727] = "ER_POLYGON_TOO_LARGE";
	exports[3728] = "ER_SPATIAL_UNIQUE_INDEX";
	exports[3729] = "ER_INDEX_TYPE_NOT_SUPPORTED_FOR_SPATIAL_INDEX";
	exports[3730] = "ER_FK_CANNOT_DROP_PARENT";
	exports[3731] = "ER_GEOMETRY_PARAM_LONGITUDE_OUT_OF_RANGE";
	exports[3732] = "ER_GEOMETRY_PARAM_LATITUDE_OUT_OF_RANGE";
	exports[3733] = "ER_FK_CANNOT_USE_VIRTUAL_COLUMN";
	exports[3734] = "ER_FK_NO_COLUMN_PARENT";
	exports[3735] = "ER_CANT_SET_ERROR_SUPPRESSION_LIST";
	exports[3736] = "ER_SRS_GEOGCS_INVALID_AXES";
	exports[3737] = "ER_SRS_INVALID_SEMI_MAJOR_AXIS";
	exports[3738] = "ER_SRS_INVALID_INVERSE_FLATTENING";
	exports[3739] = "ER_SRS_INVALID_ANGULAR_UNIT";
	exports[3740] = "ER_SRS_INVALID_PRIME_MERIDIAN";
	exports[3741] = "ER_TRANSFORM_SOURCE_SRS_NOT_SUPPORTED";
	exports[3742] = "ER_TRANSFORM_TARGET_SRS_NOT_SUPPORTED";
	exports[3743] = "ER_TRANSFORM_SOURCE_SRS_MISSING_TOWGS84";
	exports[3744] = "ER_TRANSFORM_TARGET_SRS_MISSING_TOWGS84";
	exports[3745] = "ER_TEMP_TABLE_PREVENTS_SWITCH_SESSION_BINLOG_FORMAT";
	exports[3746] = "ER_TEMP_TABLE_PREVENTS_SWITCH_GLOBAL_BINLOG_FORMAT";
	exports[3747] = "ER_RUNNING_APPLIER_PREVENTS_SWITCH_GLOBAL_BINLOG_FORMAT";
	exports[3748] = "ER_CLIENT_GTID_UNSAFE_CREATE_DROP_TEMP_TABLE_IN_TRX_IN_SBR";
	exports[3749] = "ER_XA_CANT_CREATE_MDL_BACKUP";
	exports[3750] = "ER_TABLE_WITHOUT_PK";
	exports[3751] = "ER_WARN_DATA_TRUNCATED_FUNCTIONAL_INDEX";
	exports[3752] = "ER_WARN_DATA_OUT_OF_RANGE_FUNCTIONAL_INDEX";
	exports[3753] = "ER_FUNCTIONAL_INDEX_ON_JSON_OR_GEOMETRY_FUNCTION";
	exports[3754] = "ER_FUNCTIONAL_INDEX_REF_AUTO_INCREMENT";
	exports[3755] = "ER_CANNOT_DROP_COLUMN_FUNCTIONAL_INDEX";
	exports[3756] = "ER_FUNCTIONAL_INDEX_PRIMARY_KEY";
	exports[3757] = "ER_FUNCTIONAL_INDEX_ON_LOB";
	exports[3758] = "ER_FUNCTIONAL_INDEX_FUNCTION_IS_NOT_ALLOWED";
	exports[3759] = "ER_FULLTEXT_FUNCTIONAL_INDEX";
	exports[3760] = "ER_SPATIAL_FUNCTIONAL_INDEX";
	exports[3761] = "ER_WRONG_KEY_COLUMN_FUNCTIONAL_INDEX";
	exports[3762] = "ER_FUNCTIONAL_INDEX_ON_FIELD";
	exports[3763] = "ER_GENERATED_COLUMN_NAMED_FUNCTION_IS_NOT_ALLOWED";
	exports[3764] = "ER_GENERATED_COLUMN_ROW_VALUE";
	exports[3765] = "ER_GENERATED_COLUMN_VARIABLES";
	exports[3766] = "ER_DEPENDENT_BY_DEFAULT_GENERATED_VALUE";
	exports[3767] = "ER_DEFAULT_VAL_GENERATED_NON_PRIOR";
	exports[3768] = "ER_DEFAULT_VAL_GENERATED_REF_AUTO_INC";
	exports[3769] = "ER_DEFAULT_VAL_GENERATED_FUNCTION_IS_NOT_ALLOWED";
	exports[3770] = "ER_DEFAULT_VAL_GENERATED_NAMED_FUNCTION_IS_NOT_ALLOWED";
	exports[3771] = "ER_DEFAULT_VAL_GENERATED_ROW_VALUE";
	exports[3772] = "ER_DEFAULT_VAL_GENERATED_VARIABLES";
	exports[3773] = "ER_DEFAULT_AS_VAL_GENERATED";
	exports[3774] = "ER_UNSUPPORTED_ACTION_ON_DEFAULT_VAL_GENERATED";
	exports[3775] = "ER_GTID_UNSAFE_ALTER_ADD_COL_WITH_DEFAULT_EXPRESSION";
	exports[3776] = "ER_FK_CANNOT_CHANGE_ENGINE";
	exports[3777] = "ER_WARN_DEPRECATED_USER_SET_EXPR";
	exports[3778] = "ER_WARN_DEPRECATED_UTF8MB3_COLLATION";
	exports[3779] = "ER_WARN_DEPRECATED_NESTED_COMMENT_SYNTAX";
	exports[3780] = "ER_FK_INCOMPATIBLE_COLUMNS";
	exports[3781] = "ER_GR_HOLD_WAIT_TIMEOUT";
	exports[3782] = "ER_GR_HOLD_KILLED";
	exports[3783] = "ER_GR_HOLD_MEMBER_STATUS_ERROR";
	exports[3784] = "ER_RPL_ENCRYPTION_FAILED_TO_FETCH_KEY";
	exports[3785] = "ER_RPL_ENCRYPTION_KEY_NOT_FOUND";
	exports[3786] = "ER_RPL_ENCRYPTION_KEYRING_INVALID_KEY";
	exports[3787] = "ER_RPL_ENCRYPTION_HEADER_ERROR";
	exports[3788] = "ER_RPL_ENCRYPTION_FAILED_TO_ROTATE_LOGS";
	exports[3789] = "ER_RPL_ENCRYPTION_KEY_EXISTS_UNEXPECTED";
	exports[3790] = "ER_RPL_ENCRYPTION_FAILED_TO_GENERATE_KEY";
	exports[3791] = "ER_RPL_ENCRYPTION_FAILED_TO_STORE_KEY";
	exports[3792] = "ER_RPL_ENCRYPTION_FAILED_TO_REMOVE_KEY";
	exports[3793] = "ER_RPL_ENCRYPTION_UNABLE_TO_CHANGE_OPTION";
	exports[3794] = "ER_RPL_ENCRYPTION_MASTER_KEY_RECOVERY_FAILED";
	exports[3795] = "ER_SLOW_LOG_MODE_IGNORED_WHEN_NOT_LOGGING_TO_FILE";
	exports[3796] = "ER_GRP_TRX_CONSISTENCY_NOT_ALLOWED";
	exports[3797] = "ER_GRP_TRX_CONSISTENCY_BEFORE";
	exports[3798] = "ER_GRP_TRX_CONSISTENCY_AFTER_ON_TRX_BEGIN";
	exports[3799] = "ER_GRP_TRX_CONSISTENCY_BEGIN_NOT_ALLOWED";
	exports[3800] = "ER_FUNCTIONAL_INDEX_ROW_VALUE_IS_NOT_ALLOWED";
	exports[3801] = "ER_RPL_ENCRYPTION_FAILED_TO_ENCRYPT";
	exports[3802] = "ER_PAGE_TRACKING_NOT_STARTED";
	exports[3803] = "ER_PAGE_TRACKING_RANGE_NOT_TRACKED";
	exports[3804] = "ER_PAGE_TRACKING_CANNOT_PURGE";
	exports[3805] = "ER_RPL_ENCRYPTION_CANNOT_ROTATE_BINLOG_MASTER_KEY";
	exports[3806] = "ER_BINLOG_MASTER_KEY_RECOVERY_OUT_OF_COMBINATION";
	exports[3807] = "ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_OPERATE_KEY";
	exports[3808] = "ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_ROTATE_LOGS";
	exports[3809] = "ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_REENCRYPT_LOG";
	exports[3810] = "ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_CLEANUP_UNUSED_KEYS";
	exports[3811] = "ER_BINLOG_MASTER_KEY_ROTATION_FAIL_TO_CLEANUP_AUX_KEY";
	exports[3812] = "ER_NON_BOOLEAN_EXPR_FOR_CHECK_CONSTRAINT";
	exports[3813] = "ER_COLUMN_CHECK_CONSTRAINT_REFERENCES_OTHER_COLUMN";
	exports[3814] = "ER_CHECK_CONSTRAINT_NAMED_FUNCTION_IS_NOT_ALLOWED";
	exports[3815] = "ER_CHECK_CONSTRAINT_FUNCTION_IS_NOT_ALLOWED";
	exports[3816] = "ER_CHECK_CONSTRAINT_VARIABLES";
	exports[3817] = "ER_CHECK_CONSTRAINT_ROW_VALUE";
	exports[3818] = "ER_CHECK_CONSTRAINT_REFERS_AUTO_INCREMENT_COLUMN";
	exports[3819] = "ER_CHECK_CONSTRAINT_VIOLATED";
	exports[3820] = "ER_CHECK_CONSTRAINT_REFERS_UNKNOWN_COLUMN";
	exports[3821] = "ER_CHECK_CONSTRAINT_NOT_FOUND";
	exports[3822] = "ER_CHECK_CONSTRAINT_DUP_NAME";
	exports[3823] = "ER_CHECK_CONSTRAINT_CLAUSE_USING_FK_REFER_ACTION_COLUMN";
	exports[3824] = "WARN_UNENCRYPTED_TABLE_IN_ENCRYPTED_DB";
	exports[3825] = "ER_INVALID_ENCRYPTION_REQUEST";
	exports[3826] = "ER_CANNOT_SET_TABLE_ENCRYPTION";
	exports[3827] = "ER_CANNOT_SET_DATABASE_ENCRYPTION";
	exports[3828] = "ER_CANNOT_SET_TABLESPACE_ENCRYPTION";
	exports[3829] = "ER_TABLESPACE_CANNOT_BE_ENCRYPTED";
	exports[3830] = "ER_TABLESPACE_CANNOT_BE_DECRYPTED";
	exports[3831] = "ER_TABLESPACE_TYPE_UNKNOWN";
	exports[3832] = "ER_TARGET_TABLESPACE_UNENCRYPTED";
	exports[3833] = "ER_CANNOT_USE_ENCRYPTION_CLAUSE";
	exports[3834] = "ER_INVALID_MULTIPLE_CLAUSES";
	exports[3835] = "ER_UNSUPPORTED_USE_OF_GRANT_AS";
	exports[3836] = "ER_UKNOWN_AUTH_ID_OR_ACCESS_DENIED_FOR_GRANT_AS";
	exports[3837] = "ER_DEPENDENT_BY_FUNCTIONAL_INDEX";
	exports[3838] = "ER_PLUGIN_NOT_EARLY";
	exports[3839] = "ER_INNODB_REDO_LOG_ARCHIVE_START_SUBDIR_PATH";
	exports[3840] = "ER_INNODB_REDO_LOG_ARCHIVE_START_TIMEOUT";
	exports[3841] = "ER_INNODB_REDO_LOG_ARCHIVE_DIRS_INVALID";
	exports[3842] = "ER_INNODB_REDO_LOG_ARCHIVE_LABEL_NOT_FOUND";
	exports[3843] = "ER_INNODB_REDO_LOG_ARCHIVE_DIR_EMPTY";
	exports[3844] = "ER_INNODB_REDO_LOG_ARCHIVE_NO_SUCH_DIR";
	exports[3845] = "ER_INNODB_REDO_LOG_ARCHIVE_DIR_CLASH";
	exports[3846] = "ER_INNODB_REDO_LOG_ARCHIVE_DIR_PERMISSIONS";
	exports[3847] = "ER_INNODB_REDO_LOG_ARCHIVE_FILE_CREATE";
	exports[3848] = "ER_INNODB_REDO_LOG_ARCHIVE_ACTIVE";
	exports[3849] = "ER_INNODB_REDO_LOG_ARCHIVE_INACTIVE";
	exports[3850] = "ER_INNODB_REDO_LOG_ARCHIVE_FAILED";
	exports[3851] = "ER_INNODB_REDO_LOG_ARCHIVE_SESSION";
	exports[3852] = "ER_STD_REGEX_ERROR";
	exports[3853] = "ER_INVALID_JSON_TYPE";
	exports[3854] = "ER_CANNOT_CONVERT_STRING";
	exports[3855] = "ER_DEPENDENT_BY_PARTITION_FUNC";
	exports[3856] = "ER_WARN_DEPRECATED_FLOAT_AUTO_INCREMENT";
	exports[3857] = "ER_RPL_CANT_STOP_REPLICA_WHILE_LOCKED_BACKUP";
	exports[3858] = "ER_WARN_DEPRECATED_FLOAT_DIGITS";
	exports[3859] = "ER_WARN_DEPRECATED_FLOAT_UNSIGNED";
	exports[3860] = "ER_WARN_DEPRECATED_INTEGER_DISPLAY_WIDTH";
	exports[3861] = "ER_WARN_DEPRECATED_ZEROFILL";
	exports[3862] = "ER_CLONE_DONOR";
	exports[3863] = "ER_CLONE_PROTOCOL";
	exports[3864] = "ER_CLONE_DONOR_VERSION";
	exports[3865] = "ER_CLONE_OS";
	exports[3866] = "ER_CLONE_PLATFORM";
	exports[3867] = "ER_CLONE_CHARSET";
	exports[3868] = "ER_CLONE_CONFIG";
	exports[3869] = "ER_CLONE_SYS_CONFIG";
	exports[3870] = "ER_CLONE_PLUGIN_MATCH";
	exports[3871] = "ER_CLONE_LOOPBACK";
	exports[3872] = "ER_CLONE_ENCRYPTION";
	exports[3873] = "ER_CLONE_DISK_SPACE";
	exports[3874] = "ER_CLONE_IN_PROGRESS";
	exports[3875] = "ER_CLONE_DISALLOWED";
	exports[3876] = "ER_CANNOT_GRANT_ROLES_TO_ANONYMOUS_USER";
	exports[3877] = "ER_SECONDARY_ENGINE_PLUGIN";
	exports[3878] = "ER_SECOND_PASSWORD_CANNOT_BE_EMPTY";
	exports[3879] = "ER_DB_ACCESS_DENIED";
	exports[3880] = "ER_DA_AUTH_ID_WITH_SYSTEM_USER_PRIV_IN_MANDATORY_ROLES";
	exports[3881] = "ER_DA_RPL_GTID_TABLE_CANNOT_OPEN";
	exports[3882] = "ER_GEOMETRY_IN_UNKNOWN_LENGTH_UNIT";
	exports[3883] = "ER_DA_PLUGIN_INSTALL_ERROR";
	exports[3884] = "ER_NO_SESSION_TEMP";
	exports[3885] = "ER_DA_UNKNOWN_ERROR_NUMBER";
	exports[3886] = "ER_COLUMN_CHANGE_SIZE";
	exports[3887] = "ER_REGEXP_INVALID_CAPTURE_GROUP_NAME";
	exports[3888] = "ER_DA_SSL_LIBRARY_ERROR";
	exports[3889] = "ER_SECONDARY_ENGINE";
	exports[3890] = "ER_SECONDARY_ENGINE_DDL";
	exports[3891] = "ER_INCORRECT_CURRENT_PASSWORD";
	exports[3892] = "ER_MISSING_CURRENT_PASSWORD";
	exports[3893] = "ER_CURRENT_PASSWORD_NOT_REQUIRED";
	exports[3894] = "ER_PASSWORD_CANNOT_BE_RETAINED_ON_PLUGIN_CHANGE";
	exports[3895] = "ER_CURRENT_PASSWORD_CANNOT_BE_RETAINED";
	exports[3896] = "ER_PARTIAL_REVOKES_EXIST";
	exports[3897] = "ER_CANNOT_GRANT_SYSTEM_PRIV_TO_MANDATORY_ROLE";
	exports[3898] = "ER_XA_REPLICATION_FILTERS";
	exports[3899] = "ER_UNSUPPORTED_SQL_MODE";
	exports[3900] = "ER_REGEXP_INVALID_FLAG";
	exports[3901] = "ER_PARTIAL_REVOKE_AND_DB_GRANT_BOTH_EXISTS";
	exports[3902] = "ER_UNIT_NOT_FOUND";
	exports[3903] = "ER_INVALID_JSON_VALUE_FOR_FUNC_INDEX";
	exports[3904] = "ER_JSON_VALUE_OUT_OF_RANGE_FOR_FUNC_INDEX";
	exports[3905] = "ER_EXCEEDED_MV_KEYS_NUM";
	exports[3906] = "ER_EXCEEDED_MV_KEYS_SPACE";
	exports[3907] = "ER_FUNCTIONAL_INDEX_DATA_IS_TOO_LONG";
	exports[3908] = "ER_WRONG_MVI_VALUE";
	exports[3909] = "ER_WARN_FUNC_INDEX_NOT_APPLICABLE";
	exports[3910] = "ER_GRP_RPL_UDF_ERROR";
	exports[3911] = "ER_UPDATE_GTID_PURGED_WITH_GR";
	exports[3912] = "ER_GROUPING_ON_TIMESTAMP_IN_DST";
	exports[3913] = "ER_TABLE_NAME_CAUSES_TOO_LONG_PATH";
	exports[3914] = "ER_AUDIT_LOG_INSUFFICIENT_PRIVILEGE";
	exports[3915] = "ER_AUDIT_LOG_PASSWORD_HAS_BEEN_COPIED";
	exports[3916] = "ER_DA_GRP_RPL_STARTED_AUTO_REJOIN";
	exports[3917] = "ER_SYSVAR_CHANGE_DURING_QUERY";
	exports[3918] = "ER_GLOBSTAT_CHANGE_DURING_QUERY";
	exports[3919] = "ER_GRP_RPL_MESSAGE_SERVICE_INIT_FAILURE";
	exports[3920] = "ER_CHANGE_SOURCE_WRONG_COMPRESSION_ALGORITHM_CLIENT";
	exports[3921] = "ER_CHANGE_SOURCE_WRONG_COMPRESSION_LEVEL_CLIENT";
	exports[3922] = "ER_WRONG_COMPRESSION_ALGORITHM_CLIENT";
	exports[3923] = "ER_WRONG_COMPRESSION_LEVEL_CLIENT";
	exports[3924] = "ER_CHANGE_SOURCE_WRONG_COMPRESSION_ALGORITHM_LIST_CLIENT";
	exports[3925] = "ER_CLIENT_PRIVILEGE_CHECKS_USER_CANNOT_BE_ANONYMOUS";
	exports[3926] = "ER_CLIENT_PRIVILEGE_CHECKS_USER_DOES_NOT_EXIST";
	exports[3927] = "ER_CLIENT_PRIVILEGE_CHECKS_USER_CORRUPT";
	exports[3928] = "ER_CLIENT_PRIVILEGE_CHECKS_USER_NEEDS_RPL_APPLIER_PRIV";
	exports[3929] = "ER_WARN_DA_PRIVILEGE_NOT_REGISTERED";
	exports[3930] = "ER_CLIENT_KEYRING_UDF_KEY_INVALID";
	exports[3931] = "ER_CLIENT_KEYRING_UDF_KEY_TYPE_INVALID";
	exports[3932] = "ER_CLIENT_KEYRING_UDF_KEY_TOO_LONG";
	exports[3933] = "ER_CLIENT_KEYRING_UDF_KEY_TYPE_TOO_LONG";
	exports[3934] = "ER_JSON_SCHEMA_VALIDATION_ERROR_WITH_DETAILED_REPORT";
	exports[3935] = "ER_DA_UDF_INVALID_CHARSET_SPECIFIED";
	exports[3936] = "ER_DA_UDF_INVALID_CHARSET";
	exports[3937] = "ER_DA_UDF_INVALID_COLLATION";
	exports[3938] = "ER_DA_UDF_INVALID_EXTENSION_ARGUMENT_TYPE";
	exports[3939] = "ER_MULTIPLE_CONSTRAINTS_WITH_SAME_NAME";
	exports[3940] = "ER_CONSTRAINT_NOT_FOUND";
	exports[3941] = "ER_ALTER_CONSTRAINT_ENFORCEMENT_NOT_SUPPORTED";
	exports[3942] = "ER_TABLE_VALUE_CONSTRUCTOR_MUST_HAVE_COLUMNS";
	exports[3943] = "ER_TABLE_VALUE_CONSTRUCTOR_CANNOT_HAVE_DEFAULT";
	exports[3944] = "ER_CLIENT_QUERY_FAILURE_INVALID_NON_ROW_FORMAT";
	exports[3945] = "ER_REQUIRE_ROW_FORMAT_INVALID_VALUE";
	exports[3946] = "ER_FAILED_TO_DETERMINE_IF_ROLE_IS_MANDATORY";
	exports[3947] = "ER_FAILED_TO_FETCH_MANDATORY_ROLE_LIST";
	exports[3948] = "ER_CLIENT_LOCAL_FILES_DISABLED";
	exports[3949] = "ER_IMP_INCOMPATIBLE_CFG_VERSION";
	exports[3950] = "ER_DA_OOM";
	exports[3951] = "ER_DA_UDF_INVALID_ARGUMENT_TO_SET_CHARSET";
	exports[3952] = "ER_DA_UDF_INVALID_RETURN_TYPE_TO_SET_CHARSET";
	exports[3953] = "ER_MULTIPLE_INTO_CLAUSES";
	exports[3954] = "ER_MISPLACED_INTO";
	exports[3955] = "ER_USER_ACCESS_DENIED_FOR_USER_ACCOUNT_BLOCKED_BY_PASSWORD_LOCK";
	exports[3956] = "ER_WARN_DEPRECATED_YEAR_UNSIGNED";
	exports[3957] = "ER_CLONE_NETWORK_PACKET";
	exports[3958] = "ER_SDI_OPERATION_FAILED_MISSING_RECORD";
	exports[3959] = "ER_DEPENDENT_BY_CHECK_CONSTRAINT";
	exports[3960] = "ER_GRP_OPERATION_NOT_ALLOWED_GR_MUST_STOP";
	exports[3961] = "ER_WARN_DEPRECATED_JSON_TABLE_ON_ERROR_ON_EMPTY";
	exports[3962] = "ER_WARN_DEPRECATED_INNER_INTO";
	exports[3963] = "ER_WARN_DEPRECATED_VALUES_FUNCTION_ALWAYS_NULL";
	exports[3964] = "ER_WARN_DEPRECATED_SQL_CALC_FOUND_ROWS";
	exports[3965] = "ER_WARN_DEPRECATED_FOUND_ROWS";
	exports[3966] = "ER_MISSING_JSON_VALUE";
	exports[3967] = "ER_MULTIPLE_JSON_VALUES";
	exports[3968] = "ER_HOSTNAME_TOO_LONG";
	exports[3969] = "ER_WARN_CLIENT_DEPRECATED_PARTITION_PREFIX_KEY";
	exports[3970] = "ER_GROUP_REPLICATION_USER_EMPTY_MSG";
	exports[3971] = "ER_GROUP_REPLICATION_USER_MANDATORY_MSG";
	exports[3972] = "ER_GROUP_REPLICATION_PASSWORD_LENGTH";
	exports[3973] = "ER_SUBQUERY_TRANSFORM_REJECTED";
	exports[3974] = "ER_DA_GRP_RPL_RECOVERY_ENDPOINT_FORMAT";
	exports[3975] = "ER_DA_GRP_RPL_RECOVERY_ENDPOINT_INVALID";
	exports[3976] = "ER_WRONG_VALUE_FOR_VAR_PLUS_ACTIONABLE_PART";
	exports[3977] = "ER_STATEMENT_NOT_ALLOWED_AFTER_START_TRANSACTION";
	exports[3978] = "ER_FOREIGN_KEY_WITH_ATOMIC_CREATE_SELECT";
	exports[3979] = "ER_NOT_ALLOWED_WITH_START_TRANSACTION";
	exports[3980] = "ER_INVALID_JSON_ATTRIBUTE";
	exports[3981] = "ER_ENGINE_ATTRIBUTE_NOT_SUPPORTED";
	exports[3982] = "ER_INVALID_USER_ATTRIBUTE_JSON";
	exports[3983] = "ER_INNODB_REDO_DISABLED";
	exports[3984] = "ER_INNODB_REDO_ARCHIVING_ENABLED";
	exports[3985] = "ER_MDL_OUT_OF_RESOURCES";
	exports[3986] = "ER_IMPLICIT_COMPARISON_FOR_JSON";
	exports[3987] = "ER_FUNCTION_DOES_NOT_SUPPORT_CHARACTER_SET";
	exports[3988] = "ER_IMPOSSIBLE_STRING_CONVERSION";
	exports[3989] = "ER_SCHEMA_READ_ONLY";
	exports[3990] = "ER_RPL_ASYNC_RECONNECT_GTID_MODE_OFF";
	exports[3991] = "ER_RPL_ASYNC_RECONNECT_AUTO_POSITION_OFF";
	exports[3992] = "ER_DISABLE_GTID_MODE_REQUIRES_ASYNC_RECONNECT_OFF";
	exports[3993] = "ER_DISABLE_AUTO_POSITION_REQUIRES_ASYNC_RECONNECT_OFF";
	exports[3994] = "ER_INVALID_PARAMETER_USE";
	exports[3995] = "ER_CHARACTER_SET_MISMATCH";
	exports[3996] = "ER_WARN_VAR_VALUE_CHANGE_NOT_SUPPORTED";
	exports[3997] = "ER_INVALID_TIME_ZONE_INTERVAL";
	exports[3998] = "ER_INVALID_CAST";
	exports[3999] = "ER_HYPERGRAPH_NOT_SUPPORTED_YET";
	exports[4e3] = "ER_WARN_HYPERGRAPH_EXPERIMENTAL";
	exports[4001] = "ER_DA_NO_ERROR_LOG_PARSER_CONFIGURED";
	exports[4002] = "ER_DA_ERROR_LOG_TABLE_DISABLED";
	exports[4003] = "ER_DA_ERROR_LOG_MULTIPLE_FILTERS";
	exports[4004] = "ER_DA_CANT_OPEN_ERROR_LOG";
	exports[4005] = "ER_USER_REFERENCED_AS_DEFINER";
	exports[4006] = "ER_CANNOT_USER_REFERENCED_AS_DEFINER";
	exports[4007] = "ER_REGEX_NUMBER_TOO_BIG";
	exports[4008] = "ER_SPVAR_NONINTEGER_TYPE";
	exports[4009] = "WARN_UNSUPPORTED_ACL_TABLES_READ";
	exports[4010] = "ER_BINLOG_UNSAFE_ACL_TABLE_READ_IN_DML_DDL";
	exports[4011] = "ER_STOP_REPLICA_MONITOR_IO_THREAD_TIMEOUT";
	exports[4012] = "ER_STARTING_REPLICA_MONITOR_IO_THREAD";
	exports[4013] = "ER_CANT_USE_ANONYMOUS_TO_GTID_WITH_GTID_MODE_NOT_ON";
	exports[4014] = "ER_CANT_COMBINE_ANONYMOUS_TO_GTID_AND_AUTOPOSITION";
	exports[4015] = "ER_ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS_REQUIRES_GTID_MODE_ON";
	exports[4016] = "ER_SQL_REPLICA_SKIP_COUNTER_USED_WITH_GTID_MODE_ON";
	exports[4017] = "ER_USING_ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS_AS_LOCAL_OR_UUID";
	exports[4018] = "ER_CANT_SET_ANONYMOUS_TO_GTID_AND_WAIT_UNTIL_SQL_THD_AFTER_GTIDS";
	exports[4019] = "ER_CANT_SET_SQL_AFTER_OR_BEFORE_GTIDS_WITH_ANONYMOUS_TO_GTID";
	exports[4020] = "ER_ANONYMOUS_TO_GTID_UUID_SAME_AS_GROUP_NAME";
	exports[4021] = "ER_CANT_USE_SAME_UUID_AS_GROUP_NAME";
	exports[4022] = "ER_GRP_RPL_RECOVERY_CHANNEL_STILL_RUNNING";
	exports[4023] = "ER_INNODB_INVALID_AUTOEXTEND_SIZE_VALUE";
	exports[4024] = "ER_INNODB_INCOMPATIBLE_WITH_TABLESPACE";
	exports[4025] = "ER_INNODB_AUTOEXTEND_SIZE_OUT_OF_RANGE";
	exports[4026] = "ER_CANNOT_USE_AUTOEXTEND_SIZE_CLAUSE";
	exports[4027] = "ER_ROLE_GRANTED_TO_ITSELF";
	exports[4028] = "ER_TABLE_MUST_HAVE_A_VISIBLE_COLUMN";
	exports[4029] = "ER_INNODB_COMPRESSION_FAILURE";
	exports[4030] = "ER_WARN_ASYNC_CONN_FAILOVER_NETWORK_NAMESPACE";
	exports[4031] = "ER_CLIENT_INTERACTION_TIMEOUT";
	exports[4032] = "ER_INVALID_CAST_TO_GEOMETRY";
	exports[4033] = "ER_INVALID_CAST_POLYGON_RING_DIRECTION";
	exports[4034] = "ER_GIS_DIFFERENT_SRIDS_AGGREGATION";
	exports[4035] = "ER_RELOAD_KEYRING_FAILURE";
	exports[4036] = "ER_SDI_GET_KEYS_INVALID_TABLESPACE";
	exports[4037] = "ER_CHANGE_RPL_SRC_WRONG_COMPRESSION_ALGORITHM_SIZE";
	exports[4038] = "ER_WARN_DEPRECATED_TLS_VERSION_FOR_CHANNEL_CLI";
	exports[4039] = "ER_CANT_USE_SAME_UUID_AS_VIEW_CHANGE_UUID";
	exports[4040] = "ER_ANONYMOUS_TO_GTID_UUID_SAME_AS_VIEW_CHANGE_UUID";
	exports[4041] = "ER_GRP_RPL_VIEW_CHANGE_UUID_FAIL_GET_VARIABLE";
	exports[4042] = "ER_WARN_ADUIT_LOG_MAX_SIZE_AND_PRUNE_SECONDS";
	exports[4043] = "ER_WARN_ADUIT_LOG_MAX_SIZE_CLOSE_TO_ROTATE_ON_SIZE";
	exports[4044] = "ER_KERBEROS_CREATE_USER";
	exports[4045] = "ER_INSTALL_PLUGIN_CONFLICT_CLIENT";
	exports[4046] = "ER_DA_ERROR_LOG_COMPONENT_FLUSH_FAILED";
	exports[4047] = "ER_WARN_SQL_AFTER_MTS_GAPS_GAP_NOT_CALCULATED";
	exports[4048] = "ER_INVALID_ASSIGNMENT_TARGET";
	exports[4049] = "ER_OPERATION_NOT_ALLOWED_ON_GR_SECONDARY";
	exports[4050] = "ER_GRP_RPL_FAILOVER_CHANNEL_STATUS_PROPAGATION";
	exports[4051] = "ER_WARN_AUDIT_LOG_FORMAT_UNIX_TIMESTAMP_ONLY_WHEN_JSON";
	exports[4052] = "ER_INVALID_MFA_PLUGIN_SPECIFIED";
	exports[4053] = "ER_IDENTIFIED_BY_UNSUPPORTED";
	exports[4054] = "ER_INVALID_PLUGIN_FOR_REGISTRATION";
	exports[4055] = "ER_PLUGIN_REQUIRES_REGISTRATION";
	exports[4056] = "ER_MFA_METHOD_EXISTS";
	exports[4057] = "ER_MFA_METHOD_NOT_EXISTS";
	exports[4058] = "ER_AUTHENTICATION_POLICY_MISMATCH";
	exports[4059] = "ER_PLUGIN_REGISTRATION_DONE";
	exports[4060] = "ER_INVALID_USER_FOR_REGISTRATION";
	exports[4061] = "ER_USER_REGISTRATION_FAILED";
	exports[4062] = "ER_MFA_METHODS_INVALID_ORDER";
	exports[4063] = "ER_MFA_METHODS_IDENTICAL";
	exports[4064] = "ER_INVALID_MFA_OPERATIONS_FOR_PASSWORDLESS_USER";
	exports[4065] = "ER_CHANGE_REPLICATION_SOURCE_NO_OPTIONS_FOR_GTID_ONLY";
	exports[4066] = "ER_CHANGE_REP_SOURCE_CANT_DISABLE_REQ_ROW_FORMAT_WITH_GTID_ONLY";
	exports[4067] = "ER_CHANGE_REP_SOURCE_CANT_DISABLE_AUTO_POSITION_WITH_GTID_ONLY";
	exports[4068] = "ER_CHANGE_REP_SOURCE_CANT_DISABLE_GTID_ONLY_WITHOUT_POSITIONS";
	exports[4069] = "ER_CHANGE_REP_SOURCE_CANT_DISABLE_AUTO_POS_WITHOUT_POSITIONS";
	exports[4070] = "ER_CHANGE_REP_SOURCE_GR_CHANNEL_WITH_GTID_MODE_NOT_ON";
	exports[4071] = "ER_CANT_USE_GTID_ONLY_WITH_GTID_MODE_NOT_ON";
	exports[4072] = "ER_WARN_C_DISABLE_GTID_ONLY_WITH_SOURCE_AUTO_POS_INVALID_POS";
	exports[4073] = "ER_DA_SSL_FIPS_MODE_ERROR";
	exports[4074] = "ER_VALUE_OUT_OF_RANGE";
	exports[4075] = "ER_FULLTEXT_WITH_ROLLUP";
	exports[4076] = "ER_REGEXP_MISSING_RESOURCE";
	exports[4077] = "ER_WARN_REGEXP_USING_DEFAULT";
	exports[4078] = "ER_REGEXP_MISSING_FILE";
	exports[4079] = "ER_WARN_DEPRECATED_COLLATION";
	exports[4080] = "ER_CONCURRENT_PROCEDURE_USAGE";
	exports[4081] = "ER_DA_GLOBAL_CONN_LIMIT";
	exports[4082] = "ER_DA_CONN_LIMIT";
	exports[4083] = "ER_ALTER_OPERATION_NOT_SUPPORTED_REASON_COLUMN_TYPE_INSTANT";
	exports[4084] = "ER_WARN_SF_UDF_NAME_COLLISION";
	exports[4085] = "ER_CANNOT_PURGE_BINLOG_WITH_BACKUP_LOCK";
	exports[4086] = "ER_TOO_MANY_WINDOWS";
	exports[4087] = "ER_MYSQLBACKUP_CLIENT_MSG";
	exports[4088] = "ER_COMMENT_CONTAINS_INVALID_STRING";
	exports[4089] = "ER_DEFINITION_CONTAINS_INVALID_STRING";
	exports[4090] = "ER_CANT_EXECUTE_COMMAND_WITH_ASSIGNED_GTID_NEXT";
	exports[4091] = "ER_XA_TEMP_TABLE";
	exports[4092] = "ER_INNODB_MAX_ROW_VERSION";
	exports[4093] = "ER_INNODB_INSTANT_ADD_NOT_SUPPORTED_MAX_SIZE";
	exports[4094] = "ER_OPERATION_NOT_ALLOWED_WHILE_PRIMARY_CHANGE_IS_RUNNING";
	exports[4095] = "ER_WARN_DEPRECATED_DATETIME_DELIMITER";
	exports[4096] = "ER_WARN_DEPRECATED_SUPERFLUOUS_DELIMITER";
	exports[4097] = "ER_CANNOT_PERSIST_SENSITIVE_VARIABLES";
	exports[4098] = "ER_WARN_CANNOT_SECURELY_PERSIST_SENSITIVE_VARIABLES";
	exports[4099] = "ER_WARN_TRG_ALREADY_EXISTS";
	exports[4100] = "ER_IF_NOT_EXISTS_UNSUPPORTED_TRG_EXISTS_ON_DIFFERENT_TABLE";
	exports[4101] = "ER_IF_NOT_EXISTS_UNSUPPORTED_UDF_NATIVE_FCT_NAME_COLLISION";
	exports[4102] = "ER_SET_PASSWORD_AUTH_PLUGIN_ERROR";
	exports[4103] = "ER_REDUCED_DBLWR_FILE_CORRUPTED";
	exports[4104] = "ER_REDUCED_DBLWR_PAGE_FOUND";
	exports[4105] = "ER_SRS_INVALID_LATITUDE_OF_ORIGIN";
	exports[4106] = "ER_SRS_INVALID_LONGITUDE_OF_ORIGIN";
	exports[4107] = "ER_SRS_UNUSED_PROJ_PARAMETER_PRESENT";
	exports[4108] = "ER_GIPK_COLUMN_EXISTS";
	exports[4109] = "ER_GIPK_FAILED_AUTOINC_COLUMN_EXISTS";
	exports[4110] = "ER_GIPK_COLUMN_ALTER_NOT_ALLOWED";
	exports[4111] = "ER_DROP_PK_COLUMN_TO_DROP_GIPK";
	exports[4112] = "ER_CREATE_SELECT_WITH_GIPK_DISALLOWED_IN_SBR";
	exports[4113] = "ER_DA_EXPIRE_LOGS_DAYS_IGNORED";
	exports[4114] = "ER_CTE_RECURSIVE_NOT_UNION";
	exports[4115] = "ER_COMMAND_BACKEND_FAILED_TO_FETCH_SECURITY_CTX";
	exports[4116] = "ER_COMMAND_SERVICE_BACKEND_FAILED";
	exports[4117] = "ER_CLIENT_FILE_PRIVILEGE_FOR_REPLICATION_CHECKS";
	exports[4118] = "ER_GROUP_REPLICATION_FORCE_MEMBERS_COMMAND_FAILURE";
	exports[4119] = "ER_WARN_DEPRECATED_IDENT";
	exports[4120] = "ER_INTERSECT_ALL_MAX_DUPLICATES_EXCEEDED";
	exports[4121] = "ER_TP_QUERY_THRS_PER_GRP_EXCEEDS_TXN_THR_LIMIT";
	exports[4122] = "ER_BAD_TIMESTAMP_FORMAT";
	exports[4123] = "ER_SHAPE_PRIDICTION_UDF";
	exports[4124] = "ER_SRS_INVALID_HEIGHT";
	exports[4125] = "ER_SRS_INVALID_SCALING";
	exports[4126] = "ER_SRS_INVALID_ZONE_WIDTH";
	exports[4127] = "ER_SRS_INVALID_LATITUDE_POLAR_STERE_VAR_A";
	exports[4128] = "ER_WARN_DEPRECATED_CLIENT_NO_SCHEMA_OPTION";
	exports[4129] = "ER_TABLE_NOT_EMPTY";
	exports[4130] = "ER_TABLE_NO_PRIMARY_KEY";
	exports[4131] = "ER_TABLE_IN_SHARED_TABLESPACE";
	exports[4132] = "ER_INDEX_OTHER_THAN_PK";
	exports[4133] = "ER_LOAD_BULK_DATA_UNSORTED";
	exports[4134] = "ER_BULK_EXECUTOR_ERROR";
	exports[4135] = "ER_BULK_READER_LIBCURL_INIT_FAILED";
	exports[4136] = "ER_BULK_READER_LIBCURL_ERROR";
	exports[4137] = "ER_BULK_READER_SERVER_ERROR";
	exports[4138] = "ER_BULK_READER_COMMUNICATION_ERROR";
	exports[4139] = "ER_BULK_LOAD_DATA_FAILED";
	exports[4140] = "ER_BULK_LOADER_COLUMN_TOO_BIG_FOR_LEFTOVER_BUFFER";
	exports[4141] = "ER_BULK_LOADER_COMPONENT_ERROR";
	exports[4142] = "ER_BULK_LOADER_FILE_CONTAINS_LESS_LINES_THAN_IGNORE_CLAUSE";
	exports[4143] = "ER_BULK_PARSER_MISSING_ENCLOSED_BY";
	exports[4144] = "ER_BULK_PARSER_ROW_BUFFER_MAX_TOTAL_COLS_EXCEEDED";
	exports[4145] = "ER_BULK_PARSER_COPY_BUFFER_SIZE_EXCEEDED";
	exports[4146] = "ER_BULK_PARSER_UNEXPECTED_END_OF_INPUT";
	exports[4147] = "ER_BULK_PARSER_UNEXPECTED_ROW_TERMINATOR";
	exports[4148] = "ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_ENDING_ENCLOSED_BY";
	exports[4149] = "ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_NULL_ESCAPE";
	exports[4150] = "ER_BULK_PARSER_UNEXPECTED_CHAR_AFTER_COLUMN_TERMINATOR";
	exports[4151] = "ER_BULK_PARSER_INCOMPLETE_ESCAPE_SEQUENCE";
	exports[4152] = "ER_LOAD_BULK_DATA_FAILED";
	exports[4153] = "ER_LOAD_BULK_DATA_WRONG_VALUE_FOR_FIELD";
	exports[4154] = "ER_LOAD_BULK_DATA_WARN_NULL_TO_NOTNULL";
	exports[4155] = "ER_REQUIRE_TABLE_PRIMARY_KEY_CHECK_GENERATE_WITH_GR";
	exports[4156] = "ER_CANT_CHANGE_SYS_VAR_IN_READ_ONLY_MODE";
	exports[4157] = "ER_INNODB_INSTANT_ADD_DROP_NOT_SUPPORTED_MAX_SIZE";
	exports[4158] = "ER_INNODB_INSTANT_ADD_NOT_SUPPORTED_MAX_FIELDS";
	exports[4159] = "ER_CANT_SET_PERSISTED";
	exports[4160] = "ER_INSTALL_COMPONENT_SET_NULL_VALUE";
	exports[4161] = "ER_INSTALL_COMPONENT_SET_UNUSED_VALUE";
	exports[4162] = "ER_WARN_DEPRECATED_USER_DEFINED_COLLATIONS";
}) });

//#endregion
//#region ../../node_modules/.pnpm/long@5.3.2/node_modules/long/umd/index.js
var require_umd = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/long@5.3.2/node_modules/long/umd/index.js": ((exports, module) => {
	(function(global, factory) {
		function preferDefault(exports$1) {
			return exports$1.default || exports$1;
		}
		if (typeof define === "function" && define.amd) define([], function() {
			var exports$1 = {};
			factory(exports$1);
			return preferDefault(exports$1);
		});
		else if (typeof exports === "object") {
			factory(exports);
			if (typeof module === "object") module.exports = preferDefault(exports);
		} else (function() {
			var exports$1 = {};
			factory(exports$1);
			global.Long = preferDefault(exports$1);
		})();
	})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : exports, function(_exports) {
		Object.defineProperty(_exports, "__esModule", { value: true });
		_exports.default = void 0;
		/**
		* @license
		* Copyright 2009 The Closure Library Authors
		* Copyright 2020 Daniel Wirtz / The long.js Authors.
		*
		* Licensed under the Apache License, Version 2.0 (the "License");
		* you may not use this file except in compliance with the License.
		* You may obtain a copy of the License at
		*
		*     http://www.apache.org/licenses/LICENSE-2.0
		*
		* Unless required by applicable law or agreed to in writing, software
		* distributed under the License is distributed on an "AS IS" BASIS,
		* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
		* See the License for the specific language governing permissions and
		* limitations under the License.
		*
		* SPDX-License-Identifier: Apache-2.0
		*/
		var wasm = null;
		try {
			wasm = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array([
				0,
				97,
				115,
				109,
				1,
				0,
				0,
				0,
				1,
				13,
				2,
				96,
				0,
				1,
				127,
				96,
				4,
				127,
				127,
				127,
				127,
				1,
				127,
				3,
				7,
				6,
				0,
				1,
				1,
				1,
				1,
				1,
				6,
				6,
				1,
				127,
				1,
				65,
				0,
				11,
				7,
				50,
				6,
				3,
				109,
				117,
				108,
				0,
				1,
				5,
				100,
				105,
				118,
				95,
				115,
				0,
				2,
				5,
				100,
				105,
				118,
				95,
				117,
				0,
				3,
				5,
				114,
				101,
				109,
				95,
				115,
				0,
				4,
				5,
				114,
				101,
				109,
				95,
				117,
				0,
				5,
				8,
				103,
				101,
				116,
				95,
				104,
				105,
				103,
				104,
				0,
				0,
				10,
				191,
				1,
				6,
				4,
				0,
				35,
				0,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				126,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				127,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				128,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				129,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11,
				36,
				1,
				1,
				126,
				32,
				0,
				173,
				32,
				1,
				173,
				66,
				32,
				134,
				132,
				32,
				2,
				173,
				32,
				3,
				173,
				66,
				32,
				134,
				132,
				130,
				34,
				4,
				66,
				32,
				135,
				167,
				36,
				0,
				32,
				4,
				167,
				11
			])), {}).exports;
		} catch {}
		/**
		* Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
		*  See the from* functions below for more convenient ways of constructing Longs.
		* @exports Long
		* @class A Long class for representing a 64 bit two's-complement integer value.
		* @param {number} low The low (signed) 32 bits of the long
		* @param {number} high The high (signed) 32 bits of the long
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @constructor
		*/
		function Long$1(low, high, unsigned) {
			/**
			* The low 32 bits as a signed value.
			* @type {number}
			*/
			this.low = low | 0;
			/**
			* The high 32 bits as a signed value.
			* @type {number}
			*/
			this.high = high | 0;
			/**
			* Whether unsigned or not.
			* @type {boolean}
			*/
			this.unsigned = !!unsigned;
		}
		/**
		* An indicator used to reliably determine if an object is a Long or not.
		* @type {boolean}
		* @const
		* @private
		*/
		Long$1.prototype.__isLong__;
		Object.defineProperty(Long$1.prototype, "__isLong__", { value: true });
		/**
		* @function
		* @param {*} obj Object
		* @returns {boolean}
		* @inner
		*/
		function isLong(obj) {
			return (obj && obj["__isLong__"]) === true;
		}
		/**
		* @function
		* @param {*} value number
		* @returns {number}
		* @inner
		*/
		function ctz32(value) {
			var c = Math.clz32(value & -value);
			return value ? 31 - c : c;
		}
		/**
		* Tests if the specified object is a Long.
		* @function
		* @param {*} obj Object
		* @returns {boolean}
		*/
		Long$1.isLong = isLong;
		/**
		* A cache of the Long representations of small integer values.
		* @type {!Object}
		* @inner
		*/
		var INT_CACHE = {};
		/**
		* A cache of the Long representations of small unsigned integer values.
		* @type {!Object}
		* @inner
		*/
		var UINT_CACHE = {};
		/**
		* @param {number} value
		* @param {boolean=} unsigned
		* @returns {!Long}
		* @inner
		*/
		function fromInt(value, unsigned) {
			var obj, cachedObj, cache;
			if (unsigned) {
				value >>>= 0;
				if (cache = 0 <= value && value < 256) {
					cachedObj = UINT_CACHE[value];
					if (cachedObj) return cachedObj;
				}
				obj = fromBits(value, 0, true);
				if (cache) UINT_CACHE[value] = obj;
				return obj;
			} else {
				value |= 0;
				if (cache = -128 <= value && value < 128) {
					cachedObj = INT_CACHE[value];
					if (cachedObj) return cachedObj;
				}
				obj = fromBits(value, value < 0 ? -1 : 0, false);
				if (cache) INT_CACHE[value] = obj;
				return obj;
			}
		}
		/**
		* Returns a Long representing the given 32 bit integer value.
		* @function
		* @param {number} value The 32 bit integer in question
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {!Long} The corresponding Long value
		*/
		Long$1.fromInt = fromInt;
		/**
		* @param {number} value
		* @param {boolean=} unsigned
		* @returns {!Long}
		* @inner
		*/
		function fromNumber(value, unsigned) {
			if (isNaN(value)) return unsigned ? UZERO : ZERO;
			if (unsigned) {
				if (value < 0) return UZERO;
				if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
			} else {
				if (value <= -TWO_PWR_63_DBL) return MIN_VALUE;
				if (value + 1 >= TWO_PWR_63_DBL) return MAX_VALUE;
			}
			if (value < 0) return fromNumber(-value, unsigned).neg();
			return fromBits(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0, unsigned);
		}
		/**
		* Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
		* @function
		* @param {number} value The number in question
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {!Long} The corresponding Long value
		*/
		Long$1.fromNumber = fromNumber;
		/**
		* @param {number} lowBits
		* @param {number} highBits
		* @param {boolean=} unsigned
		* @returns {!Long}
		* @inner
		*/
		function fromBits(lowBits, highBits, unsigned) {
			return new Long$1(lowBits, highBits, unsigned);
		}
		/**
		* Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
		*  assumed to use 32 bits.
		* @function
		* @param {number} lowBits The low 32 bits
		* @param {number} highBits The high 32 bits
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {!Long} The corresponding Long value
		*/
		Long$1.fromBits = fromBits;
		/**
		* @function
		* @param {number} base
		* @param {number} exponent
		* @returns {number}
		* @inner
		*/
		var pow_dbl = Math.pow;
		/**
		* @param {string} str
		* @param {(boolean|number)=} unsigned
		* @param {number=} radix
		* @returns {!Long}
		* @inner
		*/
		function fromString(str, unsigned, radix) {
			if (str.length === 0) throw Error("empty string");
			if (typeof unsigned === "number") {
				radix = unsigned;
				unsigned = false;
			} else unsigned = !!unsigned;
			if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity") return unsigned ? UZERO : ZERO;
			radix = radix || 10;
			if (radix < 2 || 36 < radix) throw RangeError("radix");
			var p;
			if ((p = str.indexOf("-")) > 0) throw Error("interior hyphen");
			else if (p === 0) return fromString(str.substring(1), unsigned, radix).neg();
			var radixToPower = fromNumber(pow_dbl(radix, 8));
			var result = ZERO;
			for (var i$4 = 0; i$4 < str.length; i$4 += 8) {
				var size = Math.min(8, str.length - i$4), value = parseInt(str.substring(i$4, i$4 + size), radix);
				if (size < 8) {
					var power = fromNumber(pow_dbl(radix, size));
					result = result.mul(power).add(fromNumber(value));
				} else {
					result = result.mul(radixToPower);
					result = result.add(fromNumber(value));
				}
			}
			result.unsigned = unsigned;
			return result;
		}
		/**
		* Returns a Long representation of the given string, written using the specified radix.
		* @function
		* @param {string} str The textual representation of the Long
		* @param {(boolean|number)=} unsigned Whether unsigned or not, defaults to signed
		* @param {number=} radix The radix in which the text is written (2-36), defaults to 10
		* @returns {!Long} The corresponding Long value
		*/
		Long$1.fromString = fromString;
		/**
		* @function
		* @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val
		* @param {boolean=} unsigned
		* @returns {!Long}
		* @inner
		*/
		function fromValue(val, unsigned) {
			if (typeof val === "number") return fromNumber(val, unsigned);
			if (typeof val === "string") return fromString(val, unsigned);
			return fromBits(val.low, val.high, typeof unsigned === "boolean" ? unsigned : val.unsigned);
		}
		/**
		* Converts the specified value to a Long using the appropriate from* function for its type.
		* @function
		* @param {!Long|number|bigint|string|!{low: number, high: number, unsigned: boolean}} val Value
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {!Long}
		*/
		Long$1.fromValue = fromValue;
		/**
		* @type {number}
		* @const
		* @inner
		*/
		var TWO_PWR_16_DBL = 65536;
		/**
		* @type {number}
		* @const
		* @inner
		*/
		var TWO_PWR_24_DBL = 1 << 24;
		/**
		* @type {number}
		* @const
		* @inner
		*/
		var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
		/**
		* @type {number}
		* @const
		* @inner
		*/
		var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
		/**
		* @type {number}
		* @const
		* @inner
		*/
		var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
		/**
		* @type {!Long}
		* @const
		* @inner
		*/
		var TWO_PWR_24 = fromInt(TWO_PWR_24_DBL);
		/**
		* @type {!Long}
		* @inner
		*/
		var ZERO = fromInt(0);
		/**
		* Signed zero.
		* @type {!Long}
		*/
		Long$1.ZERO = ZERO;
		/**
		* @type {!Long}
		* @inner
		*/
		var UZERO = fromInt(0, true);
		/**
		* Unsigned zero.
		* @type {!Long}
		*/
		Long$1.UZERO = UZERO;
		/**
		* @type {!Long}
		* @inner
		*/
		var ONE = fromInt(1);
		/**
		* Signed one.
		* @type {!Long}
		*/
		Long$1.ONE = ONE;
		/**
		* @type {!Long}
		* @inner
		*/
		var UONE = fromInt(1, true);
		/**
		* Unsigned one.
		* @type {!Long}
		*/
		Long$1.UONE = UONE;
		/**
		* @type {!Long}
		* @inner
		*/
		var NEG_ONE = fromInt(-1);
		/**
		* Signed negative one.
		* @type {!Long}
		*/
		Long$1.NEG_ONE = NEG_ONE;
		/**
		* @type {!Long}
		* @inner
		*/
		var MAX_VALUE = fromBits(-1, 2147483647, false);
		/**
		* Maximum signed value.
		* @type {!Long}
		*/
		Long$1.MAX_VALUE = MAX_VALUE;
		/**
		* @type {!Long}
		* @inner
		*/
		var MAX_UNSIGNED_VALUE = fromBits(-1, -1, true);
		/**
		* Maximum unsigned value.
		* @type {!Long}
		*/
		Long$1.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;
		/**
		* @type {!Long}
		* @inner
		*/
		var MIN_VALUE = fromBits(0, -2147483648, false);
		/**
		* Minimum signed value.
		* @type {!Long}
		*/
		Long$1.MIN_VALUE = MIN_VALUE;
		/**
		* @alias Long.prototype
		* @inner
		*/
		var LongPrototype = Long$1.prototype;
		/**
		* Converts the Long to a 32 bit integer, assuming it is a 32 bit integer.
		* @this {!Long}
		* @returns {number}
		*/
		LongPrototype.toInt = function toInt() {
			return this.unsigned ? this.low >>> 0 : this.low;
		};
		/**
		* Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa).
		* @this {!Long}
		* @returns {number}
		*/
		LongPrototype.toNumber = function toNumber() {
			if (this.unsigned) return (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0);
			return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
		};
		/**
		* Converts the Long to a string written in the specified radix.
		* @this {!Long}
		* @param {number=} radix Radix (2-36), defaults to 10
		* @returns {string}
		* @override
		* @throws {RangeError} If `radix` is out of range
		*/
		LongPrototype.toString = function toString(radix) {
			radix = radix || 10;
			if (radix < 2 || 36 < radix) throw RangeError("radix");
			if (this.isZero()) return "0";
			if (this.isNegative()) if (this.eq(MIN_VALUE)) {
				var radixLong = fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
				return div.toString(radix) + rem1.toInt().toString(radix);
			} else return "-" + this.neg().toString(radix);
			var radixToPower = fromNumber(pow_dbl(radix, 6), this.unsigned), rem = this;
			var result = "";
			while (true) {
				var remDiv = rem.div(radixToPower), digits = (rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0).toString(radix);
				rem = remDiv;
				if (rem.isZero()) return digits + result;
				else {
					while (digits.length < 6) digits = "0" + digits;
					result = "" + digits + result;
				}
			}
		};
		/**
		* Gets the high 32 bits as a signed integer.
		* @this {!Long}
		* @returns {number} Signed high bits
		*/
		LongPrototype.getHighBits = function getHighBits() {
			return this.high;
		};
		/**
		* Gets the high 32 bits as an unsigned integer.
		* @this {!Long}
		* @returns {number} Unsigned high bits
		*/
		LongPrototype.getHighBitsUnsigned = function getHighBitsUnsigned() {
			return this.high >>> 0;
		};
		/**
		* Gets the low 32 bits as a signed integer.
		* @this {!Long}
		* @returns {number} Signed low bits
		*/
		LongPrototype.getLowBits = function getLowBits() {
			return this.low;
		};
		/**
		* Gets the low 32 bits as an unsigned integer.
		* @this {!Long}
		* @returns {number} Unsigned low bits
		*/
		LongPrototype.getLowBitsUnsigned = function getLowBitsUnsigned() {
			return this.low >>> 0;
		};
		/**
		* Gets the number of bits needed to represent the absolute value of this Long.
		* @this {!Long}
		* @returns {number}
		*/
		LongPrototype.getNumBitsAbs = function getNumBitsAbs() {
			if (this.isNegative()) return this.eq(MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
			var val = this.high != 0 ? this.high : this.low;
			for (var bit = 31; bit > 0; bit--) if ((val & 1 << bit) != 0) break;
			return this.high != 0 ? bit + 33 : bit + 1;
		};
		/**
		* Tests if this Long can be safely represented as a JavaScript number.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isSafeInteger = function isSafeInteger() {
			var top11Bits = this.high >> 21;
			if (!top11Bits) return true;
			if (this.unsigned) return false;
			return top11Bits === -1 && !(this.low === 0 && this.high === -2097152);
		};
		/**
		* Tests if this Long's value equals zero.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isZero = function isZero() {
			return this.high === 0 && this.low === 0;
		};
		/**
		* Tests if this Long's value equals zero. This is an alias of {@link Long#isZero}.
		* @returns {boolean}
		*/
		LongPrototype.eqz = LongPrototype.isZero;
		/**
		* Tests if this Long's value is negative.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isNegative = function isNegative() {
			return !this.unsigned && this.high < 0;
		};
		/**
		* Tests if this Long's value is positive or zero.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isPositive = function isPositive() {
			return this.unsigned || this.high >= 0;
		};
		/**
		* Tests if this Long's value is odd.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isOdd = function isOdd() {
			return (this.low & 1) === 1;
		};
		/**
		* Tests if this Long's value is even.
		* @this {!Long}
		* @returns {boolean}
		*/
		LongPrototype.isEven = function isEven() {
			return (this.low & 1) === 0;
		};
		/**
		* Tests if this Long's value equals the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.equals = function equals(other) {
			if (!isLong(other)) other = fromValue(other);
			if (this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
			return this.high === other.high && this.low === other.low;
		};
		/**
		* Tests if this Long's value equals the specified's. This is an alias of {@link Long#equals}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.eq = LongPrototype.equals;
		/**
		* Tests if this Long's value differs from the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.notEquals = function notEquals(other) {
			return !this.eq(other);
		};
		/**
		* Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.neq = LongPrototype.notEquals;
		/**
		* Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.ne = LongPrototype.notEquals;
		/**
		* Tests if this Long's value is less than the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.lessThan = function lessThan(other) {
			return this.comp(other) < 0;
		};
		/**
		* Tests if this Long's value is less than the specified's. This is an alias of {@link Long#lessThan}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.lt = LongPrototype.lessThan;
		/**
		* Tests if this Long's value is less than or equal the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.lessThanOrEqual = function lessThanOrEqual(other) {
			return this.comp(other) <= 0;
		};
		/**
		* Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.lte = LongPrototype.lessThanOrEqual;
		/**
		* Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.le = LongPrototype.lessThanOrEqual;
		/**
		* Tests if this Long's value is greater than the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.greaterThan = function greaterThan(other) {
			return this.comp(other) > 0;
		};
		/**
		* Tests if this Long's value is greater than the specified's. This is an alias of {@link Long#greaterThan}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.gt = LongPrototype.greaterThan;
		/**
		* Tests if this Long's value is greater than or equal the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.greaterThanOrEqual = function greaterThanOrEqual(other) {
			return this.comp(other) >= 0;
		};
		/**
		* Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.gte = LongPrototype.greaterThanOrEqual;
		/**
		* Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {boolean}
		*/
		LongPrototype.ge = LongPrototype.greaterThanOrEqual;
		/**
		* Compares this Long's value with the specified's.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other value
		* @returns {number} 0 if they are the same, 1 if the this is greater and -1
		*  if the given one is greater
		*/
		LongPrototype.compare = function compare(other) {
			if (!isLong(other)) other = fromValue(other);
			if (this.eq(other)) return 0;
			var thisNeg = this.isNegative(), otherNeg = other.isNegative();
			if (thisNeg && !otherNeg) return -1;
			if (!thisNeg && otherNeg) return 1;
			if (!this.unsigned) return this.sub(other).isNegative() ? -1 : 1;
			return other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1;
		};
		/**
		* Compares this Long's value with the specified's. This is an alias of {@link Long#compare}.
		* @function
		* @param {!Long|number|bigint|string} other Other value
		* @returns {number} 0 if they are the same, 1 if the this is greater and -1
		*  if the given one is greater
		*/
		LongPrototype.comp = LongPrototype.compare;
		/**
		* Negates this Long's value.
		* @this {!Long}
		* @returns {!Long} Negated Long
		*/
		LongPrototype.negate = function negate() {
			if (!this.unsigned && this.eq(MIN_VALUE)) return MIN_VALUE;
			return this.not().add(ONE);
		};
		/**
		* Negates this Long's value. This is an alias of {@link Long#negate}.
		* @function
		* @returns {!Long} Negated Long
		*/
		LongPrototype.neg = LongPrototype.negate;
		/**
		* Returns the sum of this and the specified Long.
		* @this {!Long}
		* @param {!Long|number|bigint|string} addend Addend
		* @returns {!Long} Sum
		*/
		LongPrototype.add = function add(addend) {
			if (!isLong(addend)) addend = fromValue(addend);
			var a48 = this.high >>> 16;
			var a32 = this.high & 65535;
			var a16 = this.low >>> 16;
			var a00 = this.low & 65535;
			var b48 = addend.high >>> 16;
			var b32 = addend.high & 65535;
			var b16 = addend.low >>> 16;
			var b00 = addend.low & 65535;
			var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
			c00 += a00 + b00;
			c16 += c00 >>> 16;
			c00 &= 65535;
			c16 += a16 + b16;
			c32 += c16 >>> 16;
			c16 &= 65535;
			c32 += a32 + b32;
			c48 += c32 >>> 16;
			c32 &= 65535;
			c48 += a48 + b48;
			c48 &= 65535;
			return fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
		};
		/**
		* Returns the difference of this and the specified Long.
		* @this {!Long}
		* @param {!Long|number|bigint|string} subtrahend Subtrahend
		* @returns {!Long} Difference
		*/
		LongPrototype.subtract = function subtract(subtrahend) {
			if (!isLong(subtrahend)) subtrahend = fromValue(subtrahend);
			return this.add(subtrahend.neg());
		};
		/**
		* Returns the difference of this and the specified Long. This is an alias of {@link Long#subtract}.
		* @function
		* @param {!Long|number|bigint|string} subtrahend Subtrahend
		* @returns {!Long} Difference
		*/
		LongPrototype.sub = LongPrototype.subtract;
		/**
		* Returns the product of this and the specified Long.
		* @this {!Long}
		* @param {!Long|number|bigint|string} multiplier Multiplier
		* @returns {!Long} Product
		*/
		LongPrototype.multiply = function multiply(multiplier) {
			if (this.isZero()) return this;
			if (!isLong(multiplier)) multiplier = fromValue(multiplier);
			if (wasm) return fromBits(wasm["mul"](this.low, this.high, multiplier.low, multiplier.high), wasm["get_high"](), this.unsigned);
			if (multiplier.isZero()) return this.unsigned ? UZERO : ZERO;
			if (this.eq(MIN_VALUE)) return multiplier.isOdd() ? MIN_VALUE : ZERO;
			if (multiplier.eq(MIN_VALUE)) return this.isOdd() ? MIN_VALUE : ZERO;
			if (this.isNegative()) if (multiplier.isNegative()) return this.neg().mul(multiplier.neg());
			else return this.neg().mul(multiplier).neg();
			else if (multiplier.isNegative()) return this.mul(multiplier.neg()).neg();
			if (this.lt(TWO_PWR_24) && multiplier.lt(TWO_PWR_24)) return fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);
			var a48 = this.high >>> 16;
			var a32 = this.high & 65535;
			var a16 = this.low >>> 16;
			var a00 = this.low & 65535;
			var b48 = multiplier.high >>> 16;
			var b32 = multiplier.high & 65535;
			var b16 = multiplier.low >>> 16;
			var b00 = multiplier.low & 65535;
			var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
			c00 += a00 * b00;
			c16 += c00 >>> 16;
			c00 &= 65535;
			c16 += a16 * b00;
			c32 += c16 >>> 16;
			c16 &= 65535;
			c16 += a00 * b16;
			c32 += c16 >>> 16;
			c16 &= 65535;
			c32 += a32 * b00;
			c48 += c32 >>> 16;
			c32 &= 65535;
			c32 += a16 * b16;
			c48 += c32 >>> 16;
			c32 &= 65535;
			c32 += a00 * b32;
			c48 += c32 >>> 16;
			c32 &= 65535;
			c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
			c48 &= 65535;
			return fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
		};
		/**
		* Returns the product of this and the specified Long. This is an alias of {@link Long#multiply}.
		* @function
		* @param {!Long|number|bigint|string} multiplier Multiplier
		* @returns {!Long} Product
		*/
		LongPrototype.mul = LongPrototype.multiply;
		/**
		* Returns this Long divided by the specified. The result is signed if this Long is signed or
		*  unsigned if this Long is unsigned.
		* @this {!Long}
		* @param {!Long|number|bigint|string} divisor Divisor
		* @returns {!Long} Quotient
		*/
		LongPrototype.divide = function divide(divisor) {
			if (!isLong(divisor)) divisor = fromValue(divisor);
			if (divisor.isZero()) throw Error("division by zero");
			if (wasm) {
				if (!this.unsigned && this.high === -2147483648 && divisor.low === -1 && divisor.high === -1) return this;
				return fromBits((this.unsigned ? wasm["div_u"] : wasm["div_s"])(this.low, this.high, divisor.low, divisor.high), wasm["get_high"](), this.unsigned);
			}
			if (this.isZero()) return this.unsigned ? UZERO : ZERO;
			var approx, rem, res;
			if (!this.unsigned) {
				if (this.eq(MIN_VALUE)) if (divisor.eq(ONE) || divisor.eq(NEG_ONE)) return MIN_VALUE;
				else if (divisor.eq(MIN_VALUE)) return ONE;
				else {
					approx = this.shr(1).div(divisor).shl(1);
					if (approx.eq(ZERO)) return divisor.isNegative() ? ONE : NEG_ONE;
					else {
						rem = this.sub(divisor.mul(approx));
						res = approx.add(rem.div(divisor));
						return res;
					}
				}
				else if (divisor.eq(MIN_VALUE)) return this.unsigned ? UZERO : ZERO;
				if (this.isNegative()) {
					if (divisor.isNegative()) return this.neg().div(divisor.neg());
					return this.neg().div(divisor).neg();
				} else if (divisor.isNegative()) return this.div(divisor.neg()).neg();
				res = ZERO;
			} else {
				if (!divisor.unsigned) divisor = divisor.toUnsigned();
				if (divisor.gt(this)) return UZERO;
				if (divisor.gt(this.shru(1))) return UONE;
				res = UZERO;
			}
			rem = this;
			while (rem.gte(divisor)) {
				approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
				var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = log2 <= 48 ? 1 : pow_dbl(2, log2 - 48), approxRes = fromNumber(approx), approxRem = approxRes.mul(divisor);
				while (approxRem.isNegative() || approxRem.gt(rem)) {
					approx -= delta;
					approxRes = fromNumber(approx, this.unsigned);
					approxRem = approxRes.mul(divisor);
				}
				if (approxRes.isZero()) approxRes = ONE;
				res = res.add(approxRes);
				rem = rem.sub(approxRem);
			}
			return res;
		};
		/**
		* Returns this Long divided by the specified. This is an alias of {@link Long#divide}.
		* @function
		* @param {!Long|number|bigint|string} divisor Divisor
		* @returns {!Long} Quotient
		*/
		LongPrototype.div = LongPrototype.divide;
		/**
		* Returns this Long modulo the specified.
		* @this {!Long}
		* @param {!Long|number|bigint|string} divisor Divisor
		* @returns {!Long} Remainder
		*/
		LongPrototype.modulo = function modulo(divisor) {
			if (!isLong(divisor)) divisor = fromValue(divisor);
			if (wasm) return fromBits((this.unsigned ? wasm["rem_u"] : wasm["rem_s"])(this.low, this.high, divisor.low, divisor.high), wasm["get_high"](), this.unsigned);
			return this.sub(this.div(divisor).mul(divisor));
		};
		/**
		* Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
		* @function
		* @param {!Long|number|bigint|string} divisor Divisor
		* @returns {!Long} Remainder
		*/
		LongPrototype.mod = LongPrototype.modulo;
		/**
		* Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
		* @function
		* @param {!Long|number|bigint|string} divisor Divisor
		* @returns {!Long} Remainder
		*/
		LongPrototype.rem = LongPrototype.modulo;
		/**
		* Returns the bitwise NOT of this Long.
		* @this {!Long}
		* @returns {!Long}
		*/
		LongPrototype.not = function not() {
			return fromBits(~this.low, ~this.high, this.unsigned);
		};
		/**
		* Returns count leading zeros of this Long.
		* @this {!Long}
		* @returns {!number}
		*/
		LongPrototype.countLeadingZeros = function countLeadingZeros() {
			return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
		};
		/**
		* Returns count leading zeros. This is an alias of {@link Long#countLeadingZeros}.
		* @function
		* @param {!Long}
		* @returns {!number}
		*/
		LongPrototype.clz = LongPrototype.countLeadingZeros;
		/**
		* Returns count trailing zeros of this Long.
		* @this {!Long}
		* @returns {!number}
		*/
		LongPrototype.countTrailingZeros = function countTrailingZeros() {
			return this.low ? ctz32(this.low) : ctz32(this.high) + 32;
		};
		/**
		* Returns count trailing zeros. This is an alias of {@link Long#countTrailingZeros}.
		* @function
		* @param {!Long}
		* @returns {!number}
		*/
		LongPrototype.ctz = LongPrototype.countTrailingZeros;
		/**
		* Returns the bitwise AND of this Long and the specified.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other Long
		* @returns {!Long}
		*/
		LongPrototype.and = function and(other) {
			if (!isLong(other)) other = fromValue(other);
			return fromBits(this.low & other.low, this.high & other.high, this.unsigned);
		};
		/**
		* Returns the bitwise OR of this Long and the specified.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other Long
		* @returns {!Long}
		*/
		LongPrototype.or = function or(other) {
			if (!isLong(other)) other = fromValue(other);
			return fromBits(this.low | other.low, this.high | other.high, this.unsigned);
		};
		/**
		* Returns the bitwise XOR of this Long and the given one.
		* @this {!Long}
		* @param {!Long|number|bigint|string} other Other Long
		* @returns {!Long}
		*/
		LongPrototype.xor = function xor$2(other) {
			if (!isLong(other)) other = fromValue(other);
			return fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
		};
		/**
		* Returns this Long with bits shifted to the left by the given amount.
		* @this {!Long}
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shiftLeft = function shiftLeft(numBits) {
			if (isLong(numBits)) numBits = numBits.toInt();
			if ((numBits &= 63) === 0) return this;
			else if (numBits < 32) return fromBits(this.low << numBits, this.high << numBits | this.low >>> 32 - numBits, this.unsigned);
			else return fromBits(0, this.low << numBits - 32, this.unsigned);
		};
		/**
		* Returns this Long with bits shifted to the left by the given amount. This is an alias of {@link Long#shiftLeft}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shl = LongPrototype.shiftLeft;
		/**
		* Returns this Long with bits arithmetically shifted to the right by the given amount.
		* @this {!Long}
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shiftRight = function shiftRight(numBits) {
			if (isLong(numBits)) numBits = numBits.toInt();
			if ((numBits &= 63) === 0) return this;
			else if (numBits < 32) return fromBits(this.low >>> numBits | this.high << 32 - numBits, this.high >> numBits, this.unsigned);
			else return fromBits(this.high >> numBits - 32, this.high >= 0 ? 0 : -1, this.unsigned);
		};
		/**
		* Returns this Long with bits arithmetically shifted to the right by the given amount. This is an alias of {@link Long#shiftRight}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shr = LongPrototype.shiftRight;
		/**
		* Returns this Long with bits logically shifted to the right by the given amount.
		* @this {!Long}
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shiftRightUnsigned = function shiftRightUnsigned(numBits) {
			if (isLong(numBits)) numBits = numBits.toInt();
			if ((numBits &= 63) === 0) return this;
			if (numBits < 32) return fromBits(this.low >>> numBits | this.high << 32 - numBits, this.high >>> numBits, this.unsigned);
			if (numBits === 32) return fromBits(this.high, 0, this.unsigned);
			return fromBits(this.high >>> numBits - 32, 0, this.unsigned);
		};
		/**
		* Returns this Long with bits logically shifted to the right by the given amount. This is an alias of {@link Long#shiftRightUnsigned}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shru = LongPrototype.shiftRightUnsigned;
		/**
		* Returns this Long with bits logically shifted to the right by the given amount. This is an alias of {@link Long#shiftRightUnsigned}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Shifted Long
		*/
		LongPrototype.shr_u = LongPrototype.shiftRightUnsigned;
		/**
		* Returns this Long with bits rotated to the left by the given amount.
		* @this {!Long}
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Rotated Long
		*/
		LongPrototype.rotateLeft = function rotateLeft(numBits) {
			var b;
			if (isLong(numBits)) numBits = numBits.toInt();
			if ((numBits &= 63) === 0) return this;
			if (numBits === 32) return fromBits(this.high, this.low, this.unsigned);
			if (numBits < 32) {
				b = 32 - numBits;
				return fromBits(this.low << numBits | this.high >>> b, this.high << numBits | this.low >>> b, this.unsigned);
			}
			numBits -= 32;
			b = 32 - numBits;
			return fromBits(this.high << numBits | this.low >>> b, this.low << numBits | this.high >>> b, this.unsigned);
		};
		/**
		* Returns this Long with bits rotated to the left by the given amount. This is an alias of {@link Long#rotateLeft}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Rotated Long
		*/
		LongPrototype.rotl = LongPrototype.rotateLeft;
		/**
		* Returns this Long with bits rotated to the right by the given amount.
		* @this {!Long}
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Rotated Long
		*/
		LongPrototype.rotateRight = function rotateRight(numBits) {
			var b;
			if (isLong(numBits)) numBits = numBits.toInt();
			if ((numBits &= 63) === 0) return this;
			if (numBits === 32) return fromBits(this.high, this.low, this.unsigned);
			if (numBits < 32) {
				b = 32 - numBits;
				return fromBits(this.high << b | this.low >>> numBits, this.low << b | this.high >>> numBits, this.unsigned);
			}
			numBits -= 32;
			b = 32 - numBits;
			return fromBits(this.low << b | this.high >>> numBits, this.high << b | this.low >>> numBits, this.unsigned);
		};
		/**
		* Returns this Long with bits rotated to the right by the given amount. This is an alias of {@link Long#rotateRight}.
		* @function
		* @param {number|!Long} numBits Number of bits
		* @returns {!Long} Rotated Long
		*/
		LongPrototype.rotr = LongPrototype.rotateRight;
		/**
		* Converts this Long to signed.
		* @this {!Long}
		* @returns {!Long} Signed long
		*/
		LongPrototype.toSigned = function toSigned() {
			if (!this.unsigned) return this;
			return fromBits(this.low, this.high, false);
		};
		/**
		* Converts this Long to unsigned.
		* @this {!Long}
		* @returns {!Long} Unsigned long
		*/
		LongPrototype.toUnsigned = function toUnsigned() {
			if (this.unsigned) return this;
			return fromBits(this.low, this.high, true);
		};
		/**
		* Converts this Long to its byte representation.
		* @param {boolean=} le Whether little or big endian, defaults to big endian
		* @this {!Long}
		* @returns {!Array.<number>} Byte representation
		*/
		LongPrototype.toBytes = function toBytes(le) {
			return le ? this.toBytesLE() : this.toBytesBE();
		};
		/**
		* Converts this Long to its little endian byte representation.
		* @this {!Long}
		* @returns {!Array.<number>} Little endian byte representation
		*/
		LongPrototype.toBytesLE = function toBytesLE() {
			var hi = this.high, lo = this.low;
			return [
				lo & 255,
				lo >>> 8 & 255,
				lo >>> 16 & 255,
				lo >>> 24,
				hi & 255,
				hi >>> 8 & 255,
				hi >>> 16 & 255,
				hi >>> 24
			];
		};
		/**
		* Converts this Long to its big endian byte representation.
		* @this {!Long}
		* @returns {!Array.<number>} Big endian byte representation
		*/
		LongPrototype.toBytesBE = function toBytesBE() {
			var hi = this.high, lo = this.low;
			return [
				hi >>> 24,
				hi >>> 16 & 255,
				hi >>> 8 & 255,
				hi & 255,
				lo >>> 24,
				lo >>> 16 & 255,
				lo >>> 8 & 255,
				lo & 255
			];
		};
		/**
		* Creates a Long from its byte representation.
		* @param {!Array.<number>} bytes Byte representation
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @param {boolean=} le Whether little or big endian, defaults to big endian
		* @returns {Long} The corresponding Long value
		*/
		Long$1.fromBytes = function fromBytes(bytes, unsigned, le) {
			return le ? Long$1.fromBytesLE(bytes, unsigned) : Long$1.fromBytesBE(bytes, unsigned);
		};
		/**
		* Creates a Long from its little endian byte representation.
		* @param {!Array.<number>} bytes Little endian byte representation
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {Long} The corresponding Long value
		*/
		Long$1.fromBytesLE = function fromBytesLE(bytes, unsigned) {
			return new Long$1(bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24, bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24, unsigned);
		};
		/**
		* Creates a Long from its big endian byte representation.
		* @param {!Array.<number>} bytes Big endian byte representation
		* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
		* @returns {Long} The corresponding Long value
		*/
		Long$1.fromBytesBE = function fromBytesBE(bytes, unsigned) {
			return new Long$1(bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7], bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3], unsigned);
		};
		if (typeof BigInt === "function") {
			/**
			* Returns a Long representing the given big integer.
			* @function
			* @param {number} value The big integer value
			* @param {boolean=} unsigned Whether unsigned or not, defaults to signed
			* @returns {!Long} The corresponding Long value
			*/
			Long$1.fromBigInt = function fromBigInt(value, unsigned) {
				return fromBits(Number(BigInt.asIntN(32, value)), Number(BigInt.asIntN(32, value >> BigInt(32))), unsigned);
			};
			Long$1.fromValue = function fromValueWithBigInt(value, unsigned) {
				if (typeof value === "bigint") return Long$1.fromBigInt(value, unsigned);
				return fromValue(value, unsigned);
			};
			/**
			* Converts the Long to its big integer representation.
			* @this {!Long}
			* @returns {bigint}
			*/
			LongPrototype.toBigInt = function toBigInt() {
				var lowBigInt = BigInt(this.low >>> 0);
				return BigInt(this.unsigned ? this.high >>> 0 : this.high) << BigInt(32) | lowBigInt;
			};
		}
		_exports.default = Long$1;
	});
}) });

//#endregion
//#region ../../node_modules/.pnpm/safer-buffer@2.1.2/node_modules/safer-buffer/safer.js
var require_safer = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/safer-buffer@2.1.2/node_modules/safer-buffer/safer.js": ((exports, module) => {
	var buffer = __require("buffer");
	var Buffer$9 = buffer.Buffer;
	var safer = {};
	var key;
	for (key in buffer) {
		if (!buffer.hasOwnProperty(key)) continue;
		if (key === "SlowBuffer" || key === "Buffer") continue;
		safer[key] = buffer[key];
	}
	var Safer = safer.Buffer = {};
	for (key in Buffer$9) {
		if (!Buffer$9.hasOwnProperty(key)) continue;
		if (key === "allocUnsafe" || key === "allocUnsafeSlow") continue;
		Safer[key] = Buffer$9[key];
	}
	safer.Buffer.prototype = Buffer$9.prototype;
	if (!Safer.from || Safer.from === Uint8Array.from) Safer.from = function(value, encodingOrOffset, length) {
		if (typeof value === "number") throw new TypeError("The \"value\" argument must not be of type number. Received type " + typeof value);
		if (value && typeof value.length === "undefined") throw new TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
		return Buffer$9(value, encodingOrOffset, length);
	};
	if (!Safer.alloc) Safer.alloc = function(size, fill, encoding) {
		if (typeof size !== "number") throw new TypeError("The \"size\" argument must be of type number. Received type " + typeof size);
		if (size < 0 || size >= 2 * (1 << 30)) throw new RangeError("The value \"" + size + "\" is invalid for option \"size\"");
		var buf = Buffer$9(size);
		if (!fill || fill.length === 0) buf.fill(0);
		else if (typeof encoding === "string") buf.fill(fill, encoding);
		else buf.fill(fill);
		return buf;
	};
	if (!safer.kStringMaxLength) try {
		safer.kStringMaxLength = process.binding("buffer").kStringMaxLength;
	} catch (e) {}
	if (!safer.constants) {
		safer.constants = { MAX_LENGTH: safer.kMaxLength };
		if (safer.kStringMaxLength) safer.constants.MAX_STRING_LENGTH = safer.kStringMaxLength;
	}
	module.exports = safer;
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/bom-handling.js
var require_bom_handling = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/bom-handling.js": ((exports) => {
	var BOMChar = "﻿";
	exports.PrependBOM = PrependBOMWrapper;
	function PrependBOMWrapper(encoder, options) {
		this.encoder = encoder;
		this.addBOM = true;
	}
	PrependBOMWrapper.prototype.write = function(str) {
		if (this.addBOM) {
			str = BOMChar + str;
			this.addBOM = false;
		}
		return this.encoder.write(str);
	};
	PrependBOMWrapper.prototype.end = function() {
		return this.encoder.end();
	};
	exports.StripBOM = StripBOMWrapper;
	function StripBOMWrapper(decoder, options) {
		this.decoder = decoder;
		this.pass = false;
		this.options = options || {};
	}
	StripBOMWrapper.prototype.write = function(buf) {
		var res = this.decoder.write(buf);
		if (this.pass || !res) return res;
		if (res[0] === BOMChar) {
			res = res.slice(1);
			if (typeof this.options.stripBOM === "function") this.options.stripBOM();
		}
		this.pass = true;
		return res;
	};
	StripBOMWrapper.prototype.end = function() {
		return this.decoder.end();
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/helpers/merge-exports.js
var require_merge_exports = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/helpers/merge-exports.js": ((exports, module) => {
	var hasOwn = typeof Object.hasOwn === "undefined" ? Function.call.bind(Object.prototype.hasOwnProperty) : Object.hasOwn;
	function mergeModules$2(target, module$2) {
		for (var key$1 in module$2) if (hasOwn(module$2, key$1)) target[key$1] = module$2[key$1];
	}
	module.exports = mergeModules$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/internal.js
var require_internal = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/internal.js": ((exports, module) => {
	var Buffer$8 = require_safer().Buffer;
	module.exports = {
		utf8: {
			type: "_internal",
			bomAware: true
		},
		cesu8: {
			type: "_internal",
			bomAware: true
		},
		unicode11utf8: "utf8",
		ucs2: {
			type: "_internal",
			bomAware: true
		},
		utf16le: "ucs2",
		binary: { type: "_internal" },
		base64: { type: "_internal" },
		hex: { type: "_internal" },
		_internal: InternalCodec
	};
	function InternalCodec(codecOptions, iconv$1) {
		this.enc = codecOptions.encodingName;
		this.bomAware = codecOptions.bomAware;
		if (this.enc === "base64") this.encoder = InternalEncoderBase64;
		else if (this.enc === "utf8") this.encoder = InternalEncoderUtf8;
		else if (this.enc === "cesu8") {
			this.enc = "utf8";
			this.encoder = InternalEncoderCesu8;
			if (Buffer$8.from("eda0bdedb2a9", "hex").toString() !== "💩") {
				this.decoder = InternalDecoderCesu8;
				this.defaultCharUnicode = iconv$1.defaultCharUnicode;
			}
		}
	}
	InternalCodec.prototype.encoder = InternalEncoder;
	InternalCodec.prototype.decoder = InternalDecoder;
	var StringDecoder = __require("string_decoder").StringDecoder;
	function InternalDecoder(options, codec) {
		this.decoder = new StringDecoder(codec.enc);
	}
	InternalDecoder.prototype.write = function(buf) {
		if (!Buffer$8.isBuffer(buf)) buf = Buffer$8.from(buf);
		return this.decoder.write(buf);
	};
	InternalDecoder.prototype.end = function() {
		return this.decoder.end();
	};
	function InternalEncoder(options, codec) {
		this.enc = codec.enc;
	}
	InternalEncoder.prototype.write = function(str) {
		return Buffer$8.from(str, this.enc);
	};
	InternalEncoder.prototype.end = function() {};
	function InternalEncoderBase64(options, codec) {
		this.prevStr = "";
	}
	InternalEncoderBase64.prototype.write = function(str) {
		str = this.prevStr + str;
		var completeQuads = str.length - str.length % 4;
		this.prevStr = str.slice(completeQuads);
		str = str.slice(0, completeQuads);
		return Buffer$8.from(str, "base64");
	};
	InternalEncoderBase64.prototype.end = function() {
		return Buffer$8.from(this.prevStr, "base64");
	};
	function InternalEncoderCesu8(options, codec) {}
	InternalEncoderCesu8.prototype.write = function(str) {
		var buf = Buffer$8.alloc(str.length * 3);
		var bufIdx = 0;
		for (var i$4 = 0; i$4 < str.length; i$4++) {
			var charCode = str.charCodeAt(i$4);
			if (charCode < 128) buf[bufIdx++] = charCode;
			else if (charCode < 2048) {
				buf[bufIdx++] = 192 + (charCode >>> 6);
				buf[bufIdx++] = 128 + (charCode & 63);
			} else {
				buf[bufIdx++] = 224 + (charCode >>> 12);
				buf[bufIdx++] = 128 + (charCode >>> 6 & 63);
				buf[bufIdx++] = 128 + (charCode & 63);
			}
		}
		return buf.slice(0, bufIdx);
	};
	InternalEncoderCesu8.prototype.end = function() {};
	function InternalDecoderCesu8(options, codec) {
		this.acc = 0;
		this.contBytes = 0;
		this.accBytes = 0;
		this.defaultCharUnicode = codec.defaultCharUnicode;
	}
	InternalDecoderCesu8.prototype.write = function(buf) {
		var acc = this.acc;
		var contBytes = this.contBytes;
		var accBytes = this.accBytes;
		var res = "";
		for (var i$4 = 0; i$4 < buf.length; i$4++) {
			var curByte = buf[i$4];
			if ((curByte & 192) !== 128) {
				if (contBytes > 0) {
					res += this.defaultCharUnicode;
					contBytes = 0;
				}
				if (curByte < 128) res += String.fromCharCode(curByte);
				else if (curByte < 224) {
					acc = curByte & 31;
					contBytes = 1;
					accBytes = 1;
				} else if (curByte < 240) {
					acc = curByte & 15;
					contBytes = 2;
					accBytes = 1;
				} else res += this.defaultCharUnicode;
			} else if (contBytes > 0) {
				acc = acc << 6 | curByte & 63;
				contBytes--;
				accBytes++;
				if (contBytes === 0) if (accBytes === 2 && acc < 128 && acc > 0) res += this.defaultCharUnicode;
				else if (accBytes === 3 && acc < 2048) res += this.defaultCharUnicode;
				else res += String.fromCharCode(acc);
			} else res += this.defaultCharUnicode;
		}
		this.acc = acc;
		this.contBytes = contBytes;
		this.accBytes = accBytes;
		return res;
	};
	InternalDecoderCesu8.prototype.end = function() {
		var res = 0;
		if (this.contBytes > 0) res += this.defaultCharUnicode;
		return res;
	};
	function InternalEncoderUtf8(options, codec) {
		this.highSurrogate = "";
	}
	InternalEncoderUtf8.prototype.write = function(str) {
		if (this.highSurrogate) {
			str = this.highSurrogate + str;
			this.highSurrogate = "";
		}
		if (str.length > 0) {
			var charCode = str.charCodeAt(str.length - 1);
			if (charCode >= 55296 && charCode < 56320) {
				this.highSurrogate = str[str.length - 1];
				str = str.slice(0, str.length - 1);
			}
		}
		return Buffer$8.from(str, this.enc);
	};
	InternalEncoderUtf8.prototype.end = function() {
		if (this.highSurrogate) {
			var str = this.highSurrogate;
			this.highSurrogate = "";
			return Buffer$8.from(str, this.enc);
		}
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf32.js
var require_utf32 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf32.js": ((exports) => {
	var Buffer$7 = require_safer().Buffer;
	exports._utf32 = Utf32Codec;
	function Utf32Codec(codecOptions, iconv$1) {
		this.iconv = iconv$1;
		this.bomAware = true;
		this.isLE = codecOptions.isLE;
	}
	exports.utf32le = {
		type: "_utf32",
		isLE: true
	};
	exports.utf32be = {
		type: "_utf32",
		isLE: false
	};
	exports.ucs4le = "utf32le";
	exports.ucs4be = "utf32be";
	Utf32Codec.prototype.encoder = Utf32Encoder;
	Utf32Codec.prototype.decoder = Utf32Decoder;
	function Utf32Encoder(options, codec) {
		this.isLE = codec.isLE;
		this.highSurrogate = 0;
	}
	Utf32Encoder.prototype.write = function(str) {
		var src = Buffer$7.from(str, "ucs2");
		var dst = Buffer$7.alloc(src.length * 2);
		var write32 = this.isLE ? dst.writeUInt32LE : dst.writeUInt32BE;
		var offset = 0;
		for (var i$4 = 0; i$4 < src.length; i$4 += 2) {
			var code = src.readUInt16LE(i$4);
			var isHighSurrogate = code >= 55296 && code < 56320;
			var isLowSurrogate = code >= 56320 && code < 57344;
			if (this.highSurrogate) if (isHighSurrogate || !isLowSurrogate) {
				write32.call(dst, this.highSurrogate, offset);
				offset += 4;
			} else {
				var codepoint = (this.highSurrogate - 55296 << 10 | code - 56320) + 65536;
				write32.call(dst, codepoint, offset);
				offset += 4;
				this.highSurrogate = 0;
				continue;
			}
			if (isHighSurrogate) this.highSurrogate = code;
			else {
				write32.call(dst, code, offset);
				offset += 4;
				this.highSurrogate = 0;
			}
		}
		if (offset < dst.length) dst = dst.slice(0, offset);
		return dst;
	};
	Utf32Encoder.prototype.end = function() {
		if (!this.highSurrogate) return;
		var buf = Buffer$7.alloc(4);
		if (this.isLE) buf.writeUInt32LE(this.highSurrogate, 0);
		else buf.writeUInt32BE(this.highSurrogate, 0);
		this.highSurrogate = 0;
		return buf;
	};
	function Utf32Decoder(options, codec) {
		this.isLE = codec.isLE;
		this.badChar = codec.iconv.defaultCharUnicode.charCodeAt(0);
		this.overflow = [];
	}
	Utf32Decoder.prototype.write = function(src) {
		if (src.length === 0) return "";
		var i$4 = 0;
		var codepoint = 0;
		var dst = Buffer$7.alloc(src.length + 4);
		var offset = 0;
		var isLE = this.isLE;
		var overflow = this.overflow;
		var badChar = this.badChar;
		if (overflow.length > 0) {
			for (; i$4 < src.length && overflow.length < 4; i$4++) overflow.push(src[i$4]);
			if (overflow.length === 4) {
				if (isLE) codepoint = overflow[i$4] | overflow[i$4 + 1] << 8 | overflow[i$4 + 2] << 16 | overflow[i$4 + 3] << 24;
				else codepoint = overflow[i$4 + 3] | overflow[i$4 + 2] << 8 | overflow[i$4 + 1] << 16 | overflow[i$4] << 24;
				overflow.length = 0;
				offset = _writeCodepoint(dst, offset, codepoint, badChar);
			}
		}
		for (; i$4 < src.length - 3; i$4 += 4) {
			if (isLE) codepoint = src[i$4] | src[i$4 + 1] << 8 | src[i$4 + 2] << 16 | src[i$4 + 3] << 24;
			else codepoint = src[i$4 + 3] | src[i$4 + 2] << 8 | src[i$4 + 1] << 16 | src[i$4] << 24;
			offset = _writeCodepoint(dst, offset, codepoint, badChar);
		}
		for (; i$4 < src.length; i$4++) overflow.push(src[i$4]);
		return dst.slice(0, offset).toString("ucs2");
	};
	function _writeCodepoint(dst, offset, codepoint, badChar) {
		if (codepoint < 0 || codepoint > 1114111) codepoint = badChar;
		if (codepoint >= 65536) {
			codepoint -= 65536;
			var high = 55296 | codepoint >> 10;
			dst[offset++] = high & 255;
			dst[offset++] = high >> 8;
			var codepoint = 56320 | codepoint & 1023;
		}
		dst[offset++] = codepoint & 255;
		dst[offset++] = codepoint >> 8;
		return offset;
	}
	Utf32Decoder.prototype.end = function() {
		this.overflow.length = 0;
	};
	exports.utf32 = Utf32AutoCodec;
	exports.ucs4 = "utf32";
	function Utf32AutoCodec(options, iconv$1) {
		this.iconv = iconv$1;
	}
	Utf32AutoCodec.prototype.encoder = Utf32AutoEncoder;
	Utf32AutoCodec.prototype.decoder = Utf32AutoDecoder;
	function Utf32AutoEncoder(options, codec) {
		options = options || {};
		if (options.addBOM === void 0) options.addBOM = true;
		this.encoder = codec.iconv.getEncoder(options.defaultEncoding || "utf-32le", options);
	}
	Utf32AutoEncoder.prototype.write = function(str) {
		return this.encoder.write(str);
	};
	Utf32AutoEncoder.prototype.end = function() {
		return this.encoder.end();
	};
	function Utf32AutoDecoder(options, codec) {
		this.decoder = null;
		this.initialBufs = [];
		this.initialBufsLen = 0;
		this.options = options || {};
		this.iconv = codec.iconv;
	}
	Utf32AutoDecoder.prototype.write = function(buf) {
		if (!this.decoder) {
			this.initialBufs.push(buf);
			this.initialBufsLen += buf.length;
			if (this.initialBufsLen < 32) return "";
			var encoding = detectEncoding$1(this.initialBufs, this.options.defaultEncoding);
			this.decoder = this.iconv.getDecoder(encoding, this.options);
			var resStr = "";
			for (var i$4 = 0; i$4 < this.initialBufs.length; i$4++) resStr += this.decoder.write(this.initialBufs[i$4]);
			this.initialBufs.length = this.initialBufsLen = 0;
			return resStr;
		}
		return this.decoder.write(buf);
	};
	Utf32AutoDecoder.prototype.end = function() {
		if (!this.decoder) {
			var encoding = detectEncoding$1(this.initialBufs, this.options.defaultEncoding);
			this.decoder = this.iconv.getDecoder(encoding, this.options);
			var resStr = "";
			for (var i$4 = 0; i$4 < this.initialBufs.length; i$4++) resStr += this.decoder.write(this.initialBufs[i$4]);
			var trail = this.decoder.end();
			if (trail) resStr += trail;
			this.initialBufs.length = this.initialBufsLen = 0;
			return resStr;
		}
		return this.decoder.end();
	};
	function detectEncoding$1(bufs, defaultEncoding) {
		var b = [];
		var charsProcessed = 0;
		var invalidLE = 0;
		var invalidBE = 0;
		var bmpCharsLE = 0;
		var bmpCharsBE = 0;
		outerLoop: for (var i$4 = 0; i$4 < bufs.length; i$4++) {
			var buf = bufs[i$4];
			for (var j = 0; j < buf.length; j++) {
				b.push(buf[j]);
				if (b.length === 4) {
					if (charsProcessed === 0) {
						if (b[0] === 255 && b[1] === 254 && b[2] === 0 && b[3] === 0) return "utf-32le";
						if (b[0] === 0 && b[1] === 0 && b[2] === 254 && b[3] === 255) return "utf-32be";
					}
					if (b[0] !== 0 || b[1] > 16) invalidBE++;
					if (b[3] !== 0 || b[2] > 16) invalidLE++;
					if (b[0] === 0 && b[1] === 0 && (b[2] !== 0 || b[3] !== 0)) bmpCharsBE++;
					if ((b[0] !== 0 || b[1] !== 0) && b[2] === 0 && b[3] === 0) bmpCharsLE++;
					b.length = 0;
					charsProcessed++;
					if (charsProcessed >= 100) break outerLoop;
				}
			}
		}
		if (bmpCharsBE - invalidBE > bmpCharsLE - invalidLE) return "utf-32be";
		if (bmpCharsBE - invalidBE < bmpCharsLE - invalidLE) return "utf-32le";
		return defaultEncoding || "utf-32le";
	}
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf16.js
var require_utf16 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf16.js": ((exports) => {
	var Buffer$6 = require_safer().Buffer;
	exports.utf16be = Utf16BECodec;
	function Utf16BECodec() {}
	Utf16BECodec.prototype.encoder = Utf16BEEncoder;
	Utf16BECodec.prototype.decoder = Utf16BEDecoder;
	Utf16BECodec.prototype.bomAware = true;
	function Utf16BEEncoder() {}
	Utf16BEEncoder.prototype.write = function(str) {
		var buf = Buffer$6.from(str, "ucs2");
		for (var i$4 = 0; i$4 < buf.length; i$4 += 2) {
			var tmp = buf[i$4];
			buf[i$4] = buf[i$4 + 1];
			buf[i$4 + 1] = tmp;
		}
		return buf;
	};
	Utf16BEEncoder.prototype.end = function() {};
	function Utf16BEDecoder() {
		this.overflowByte = -1;
	}
	Utf16BEDecoder.prototype.write = function(buf) {
		if (buf.length == 0) return "";
		var buf2 = Buffer$6.alloc(buf.length + 1);
		var i$4 = 0;
		var j = 0;
		if (this.overflowByte !== -1) {
			buf2[0] = buf[0];
			buf2[1] = this.overflowByte;
			i$4 = 1;
			j = 2;
		}
		for (; i$4 < buf.length - 1; i$4 += 2, j += 2) {
			buf2[j] = buf[i$4 + 1];
			buf2[j + 1] = buf[i$4];
		}
		this.overflowByte = i$4 == buf.length - 1 ? buf[buf.length - 1] : -1;
		return buf2.slice(0, j).toString("ucs2");
	};
	Utf16BEDecoder.prototype.end = function() {
		this.overflowByte = -1;
	};
	exports.utf16 = Utf16Codec;
	function Utf16Codec(codecOptions, iconv$1) {
		this.iconv = iconv$1;
	}
	Utf16Codec.prototype.encoder = Utf16Encoder;
	Utf16Codec.prototype.decoder = Utf16Decoder;
	function Utf16Encoder(options, codec) {
		options = options || {};
		if (options.addBOM === void 0) options.addBOM = true;
		this.encoder = codec.iconv.getEncoder("utf-16le", options);
	}
	Utf16Encoder.prototype.write = function(str) {
		return this.encoder.write(str);
	};
	Utf16Encoder.prototype.end = function() {
		return this.encoder.end();
	};
	function Utf16Decoder(options, codec) {
		this.decoder = null;
		this.initialBufs = [];
		this.initialBufsLen = 0;
		this.options = options || {};
		this.iconv = codec.iconv;
	}
	Utf16Decoder.prototype.write = function(buf) {
		if (!this.decoder) {
			this.initialBufs.push(buf);
			this.initialBufsLen += buf.length;
			if (this.initialBufsLen < 16) return "";
			var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
			this.decoder = this.iconv.getDecoder(encoding, this.options);
			var resStr = "";
			for (var i$4 = 0; i$4 < this.initialBufs.length; i$4++) resStr += this.decoder.write(this.initialBufs[i$4]);
			this.initialBufs.length = this.initialBufsLen = 0;
			return resStr;
		}
		return this.decoder.write(buf);
	};
	Utf16Decoder.prototype.end = function() {
		if (!this.decoder) {
			var encoding = detectEncoding(this.initialBufs, this.options.defaultEncoding);
			this.decoder = this.iconv.getDecoder(encoding, this.options);
			var resStr = "";
			for (var i$4 = 0; i$4 < this.initialBufs.length; i$4++) resStr += this.decoder.write(this.initialBufs[i$4]);
			var trail = this.decoder.end();
			if (trail) resStr += trail;
			this.initialBufs.length = this.initialBufsLen = 0;
			return resStr;
		}
		return this.decoder.end();
	};
	function detectEncoding(bufs, defaultEncoding) {
		var b = [];
		var charsProcessed = 0;
		var asciiCharsLE = 0;
		var asciiCharsBE = 0;
		outerLoop: for (var i$4 = 0; i$4 < bufs.length; i$4++) {
			var buf = bufs[i$4];
			for (var j = 0; j < buf.length; j++) {
				b.push(buf[j]);
				if (b.length === 2) {
					if (charsProcessed === 0) {
						if (b[0] === 255 && b[1] === 254) return "utf-16le";
						if (b[0] === 254 && b[1] === 255) return "utf-16be";
					}
					if (b[0] === 0 && b[1] !== 0) asciiCharsBE++;
					if (b[0] !== 0 && b[1] === 0) asciiCharsLE++;
					b.length = 0;
					charsProcessed++;
					if (charsProcessed >= 100) break outerLoop;
				}
			}
		}
		if (asciiCharsBE > asciiCharsLE) return "utf-16be";
		if (asciiCharsBE < asciiCharsLE) return "utf-16le";
		return defaultEncoding || "utf-16le";
	}
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf7.js
var require_utf7 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/utf7.js": ((exports) => {
	var Buffer$5 = require_safer().Buffer;
	exports.utf7 = Utf7Codec;
	exports.unicode11utf7 = "utf7";
	function Utf7Codec(codecOptions, iconv$1) {
		this.iconv = iconv$1;
	}
	Utf7Codec.prototype.encoder = Utf7Encoder;
	Utf7Codec.prototype.decoder = Utf7Decoder;
	Utf7Codec.prototype.bomAware = true;
	var nonDirectChars = /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g;
	function Utf7Encoder(options, codec) {
		this.iconv = codec.iconv;
	}
	Utf7Encoder.prototype.write = function(str) {
		return Buffer$5.from(str.replace(nonDirectChars, function(chunk) {
			return "+" + (chunk === "+" ? "" : this.iconv.encode(chunk, "utf16-be").toString("base64").replace(/=+$/, "")) + "-";
		}.bind(this)));
	};
	Utf7Encoder.prototype.end = function() {};
	function Utf7Decoder(options, codec) {
		this.iconv = codec.iconv;
		this.inBase64 = false;
		this.base64Accum = "";
	}
	var base64Regex = /[A-Za-z0-9\/+]/;
	var base64Chars = [];
	for (var i$3 = 0; i$3 < 256; i$3++) base64Chars[i$3] = base64Regex.test(String.fromCharCode(i$3));
	var plusChar = "+".charCodeAt(0);
	var minusChar = "-".charCodeAt(0);
	var andChar = "&".charCodeAt(0);
	Utf7Decoder.prototype.write = function(buf) {
		var res = "";
		var lastI = 0;
		var inBase64 = this.inBase64;
		var base64Accum = this.base64Accum;
		for (var i$4 = 0; i$4 < buf.length; i$4++) if (!inBase64) {
			if (buf[i$4] == plusChar) {
				res += this.iconv.decode(buf.slice(lastI, i$4), "ascii");
				lastI = i$4 + 1;
				inBase64 = true;
			}
		} else if (!base64Chars[buf[i$4]]) {
			if (i$4 == lastI && buf[i$4] == minusChar) res += "+";
			else {
				var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i$4), "ascii");
				res += this.iconv.decode(Buffer$5.from(b64str, "base64"), "utf16-be");
			}
			if (buf[i$4] != minusChar) i$4--;
			lastI = i$4 + 1;
			inBase64 = false;
			base64Accum = "";
		}
		if (!inBase64) res += this.iconv.decode(buf.slice(lastI), "ascii");
		else {
			var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), "ascii");
			var canBeDecoded = b64str.length - b64str.length % 8;
			base64Accum = b64str.slice(canBeDecoded);
			b64str = b64str.slice(0, canBeDecoded);
			res += this.iconv.decode(Buffer$5.from(b64str, "base64"), "utf16-be");
		}
		this.inBase64 = inBase64;
		this.base64Accum = base64Accum;
		return res;
	};
	Utf7Decoder.prototype.end = function() {
		var res = "";
		if (this.inBase64 && this.base64Accum.length > 0) res = this.iconv.decode(Buffer$5.from(this.base64Accum, "base64"), "utf16-be");
		this.inBase64 = false;
		this.base64Accum = "";
		return res;
	};
	exports.utf7imap = Utf7IMAPCodec;
	function Utf7IMAPCodec(codecOptions, iconv$1) {
		this.iconv = iconv$1;
	}
	Utf7IMAPCodec.prototype.encoder = Utf7IMAPEncoder;
	Utf7IMAPCodec.prototype.decoder = Utf7IMAPDecoder;
	Utf7IMAPCodec.prototype.bomAware = true;
	function Utf7IMAPEncoder(options, codec) {
		this.iconv = codec.iconv;
		this.inBase64 = false;
		this.base64Accum = Buffer$5.alloc(6);
		this.base64AccumIdx = 0;
	}
	Utf7IMAPEncoder.prototype.write = function(str) {
		var inBase64 = this.inBase64;
		var base64Accum = this.base64Accum;
		var base64AccumIdx = this.base64AccumIdx;
		var buf = Buffer$5.alloc(str.length * 5 + 10);
		var bufIdx = 0;
		for (var i$4 = 0; i$4 < str.length; i$4++) {
			var uChar = str.charCodeAt(i$4);
			if (uChar >= 32 && uChar <= 126) {
				if (inBase64) {
					if (base64AccumIdx > 0) {
						bufIdx += buf.write(base64Accum.slice(0, base64AccumIdx).toString("base64").replace(/\//g, ",").replace(/=+$/, ""), bufIdx);
						base64AccumIdx = 0;
					}
					buf[bufIdx++] = minusChar;
					inBase64 = false;
				}
				if (!inBase64) {
					buf[bufIdx++] = uChar;
					if (uChar === andChar) buf[bufIdx++] = minusChar;
				}
			} else {
				if (!inBase64) {
					buf[bufIdx++] = andChar;
					inBase64 = true;
				}
				if (inBase64) {
					base64Accum[base64AccumIdx++] = uChar >> 8;
					base64Accum[base64AccumIdx++] = uChar & 255;
					if (base64AccumIdx == base64Accum.length) {
						bufIdx += buf.write(base64Accum.toString("base64").replace(/\//g, ","), bufIdx);
						base64AccumIdx = 0;
					}
				}
			}
		}
		this.inBase64 = inBase64;
		this.base64AccumIdx = base64AccumIdx;
		return buf.slice(0, bufIdx);
	};
	Utf7IMAPEncoder.prototype.end = function() {
		var buf = Buffer$5.alloc(10);
		var bufIdx = 0;
		if (this.inBase64) {
			if (this.base64AccumIdx > 0) {
				bufIdx += buf.write(this.base64Accum.slice(0, this.base64AccumIdx).toString("base64").replace(/\//g, ",").replace(/=+$/, ""), bufIdx);
				this.base64AccumIdx = 0;
			}
			buf[bufIdx++] = minusChar;
			this.inBase64 = false;
		}
		return buf.slice(0, bufIdx);
	};
	function Utf7IMAPDecoder(options, codec) {
		this.iconv = codec.iconv;
		this.inBase64 = false;
		this.base64Accum = "";
	}
	var base64IMAPChars = base64Chars.slice();
	base64IMAPChars[",".charCodeAt(0)] = true;
	Utf7IMAPDecoder.prototype.write = function(buf) {
		var res = "";
		var lastI = 0;
		var inBase64 = this.inBase64;
		var base64Accum = this.base64Accum;
		for (var i$4 = 0; i$4 < buf.length; i$4++) if (!inBase64) {
			if (buf[i$4] == andChar) {
				res += this.iconv.decode(buf.slice(lastI, i$4), "ascii");
				lastI = i$4 + 1;
				inBase64 = true;
			}
		} else if (!base64IMAPChars[buf[i$4]]) {
			if (i$4 == lastI && buf[i$4] == minusChar) res += "&";
			else {
				var b64str = base64Accum + this.iconv.decode(buf.slice(lastI, i$4), "ascii").replace(/,/g, "/");
				res += this.iconv.decode(Buffer$5.from(b64str, "base64"), "utf16-be");
			}
			if (buf[i$4] != minusChar) i$4--;
			lastI = i$4 + 1;
			inBase64 = false;
			base64Accum = "";
		}
		if (!inBase64) res += this.iconv.decode(buf.slice(lastI), "ascii");
		else {
			var b64str = base64Accum + this.iconv.decode(buf.slice(lastI), "ascii").replace(/,/g, "/");
			var canBeDecoded = b64str.length - b64str.length % 8;
			base64Accum = b64str.slice(canBeDecoded);
			b64str = b64str.slice(0, canBeDecoded);
			res += this.iconv.decode(Buffer$5.from(b64str, "base64"), "utf16-be");
		}
		this.inBase64 = inBase64;
		this.base64Accum = base64Accum;
		return res;
	};
	Utf7IMAPDecoder.prototype.end = function() {
		var res = "";
		if (this.inBase64 && this.base64Accum.length > 0) res = this.iconv.decode(Buffer$5.from(this.base64Accum, "base64"), "utf16-be");
		this.inBase64 = false;
		this.base64Accum = "";
		return res;
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-codec.js
var require_sbcs_codec = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-codec.js": ((exports) => {
	var Buffer$4 = require_safer().Buffer;
	exports._sbcs = SBCSCodec;
	function SBCSCodec(codecOptions, iconv$1) {
		if (!codecOptions) throw new Error("SBCS codec is called without the data.");
		if (!codecOptions.chars || codecOptions.chars.length !== 128 && codecOptions.chars.length !== 256) throw new Error("Encoding '" + codecOptions.type + "' has incorrect 'chars' (must be of len 128 or 256)");
		if (codecOptions.chars.length === 128) {
			var asciiString = "";
			for (var i$4 = 0; i$4 < 128; i$4++) asciiString += String.fromCharCode(i$4);
			codecOptions.chars = asciiString + codecOptions.chars;
		}
		this.decodeBuf = Buffer$4.from(codecOptions.chars, "ucs2");
		var encodeBuf = Buffer$4.alloc(65536, iconv$1.defaultCharSingleByte.charCodeAt(0));
		for (var i$4 = 0; i$4 < codecOptions.chars.length; i$4++) encodeBuf[codecOptions.chars.charCodeAt(i$4)] = i$4;
		this.encodeBuf = encodeBuf;
	}
	SBCSCodec.prototype.encoder = SBCSEncoder;
	SBCSCodec.prototype.decoder = SBCSDecoder;
	function SBCSEncoder(options, codec) {
		this.encodeBuf = codec.encodeBuf;
	}
	SBCSEncoder.prototype.write = function(str) {
		var buf = Buffer$4.alloc(str.length);
		for (var i$4 = 0; i$4 < str.length; i$4++) buf[i$4] = this.encodeBuf[str.charCodeAt(i$4)];
		return buf;
	};
	SBCSEncoder.prototype.end = function() {};
	function SBCSDecoder(options, codec) {
		this.decodeBuf = codec.decodeBuf;
	}
	SBCSDecoder.prototype.write = function(buf) {
		var decodeBuf = this.decodeBuf;
		var newBuf = Buffer$4.alloc(buf.length * 2);
		var idx1 = 0;
		var idx2 = 0;
		for (var i$4 = 0; i$4 < buf.length; i$4++) {
			idx1 = buf[i$4] * 2;
			idx2 = i$4 * 2;
			newBuf[idx2] = decodeBuf[idx1];
			newBuf[idx2 + 1] = decodeBuf[idx1 + 1];
		}
		return newBuf.toString("ucs2");
	};
	SBCSDecoder.prototype.end = function() {};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-data.js
var require_sbcs_data = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-data.js": ((exports, module) => {
	module.exports = {
		10029: "maccenteuro",
		maccenteuro: {
			type: "_sbcs",
			chars: "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»…\xA0ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
		},
		808: "cp808",
		ibm808: "cp808",
		cp808: {
			type: "_sbcs",
			chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■\xA0"
		},
		mik: {
			type: "_sbcs",
			chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя└┴┬├─┼╣║╚╔╩╦╠═╬┐░▒▓│┤№§╗╝┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		cp720: {
			type: "_sbcs",
			chars: "éâàçêëèïîّْô¤ـûùءآأؤ£إئابةتثجحخدذرزسشص«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ضطظعغفµقكلمنهوىي≡ًٌٍَُِ≈°∙·√ⁿ²■\xA0"
		},
		ascii8bit: "ascii",
		usascii: "ascii",
		ansix34: "ascii",
		ansix341968: "ascii",
		ansix341986: "ascii",
		csascii: "ascii",
		cp367: "ascii",
		ibm367: "ascii",
		isoir6: "ascii",
		iso646us: "ascii",
		iso646irv: "ascii",
		us: "ascii",
		latin1: "iso88591",
		latin2: "iso88592",
		latin3: "iso88593",
		latin4: "iso88594",
		latin5: "iso88599",
		latin6: "iso885910",
		latin7: "iso885913",
		latin8: "iso885914",
		latin9: "iso885915",
		latin10: "iso885916",
		csisolatin1: "iso88591",
		csisolatin2: "iso88592",
		csisolatin3: "iso88593",
		csisolatin4: "iso88594",
		csisolatincyrillic: "iso88595",
		csisolatinarabic: "iso88596",
		csisolatingreek: "iso88597",
		csisolatinhebrew: "iso88598",
		csisolatin5: "iso88599",
		csisolatin6: "iso885910",
		l1: "iso88591",
		l2: "iso88592",
		l3: "iso88593",
		l4: "iso88594",
		l5: "iso88599",
		l6: "iso885910",
		l7: "iso885913",
		l8: "iso885914",
		l9: "iso885915",
		l10: "iso885916",
		isoir14: "iso646jp",
		isoir57: "iso646cn",
		isoir100: "iso88591",
		isoir101: "iso88592",
		isoir109: "iso88593",
		isoir110: "iso88594",
		isoir144: "iso88595",
		isoir127: "iso88596",
		isoir126: "iso88597",
		isoir138: "iso88598",
		isoir148: "iso88599",
		isoir157: "iso885910",
		isoir166: "tis620",
		isoir179: "iso885913",
		isoir199: "iso885914",
		isoir203: "iso885915",
		isoir226: "iso885916",
		cp819: "iso88591",
		ibm819: "iso88591",
		cyrillic: "iso88595",
		arabic: "iso88596",
		arabic8: "iso88596",
		ecma114: "iso88596",
		asmo708: "iso88596",
		greek: "iso88597",
		greek8: "iso88597",
		ecma118: "iso88597",
		elot928: "iso88597",
		hebrew: "iso88598",
		hebrew8: "iso88598",
		turkish: "iso88599",
		turkish8: "iso88599",
		thai: "iso885911",
		thai8: "iso885911",
		celtic: "iso885914",
		celtic8: "iso885914",
		isoceltic: "iso885914",
		tis6200: "tis620",
		tis62025291: "tis620",
		tis62025330: "tis620",
		1e4: "macroman",
		10006: "macgreek",
		10007: "maccyrillic",
		10079: "maciceland",
		10081: "macturkish",
		cspc8codepage437: "cp437",
		cspc775baltic: "cp775",
		cspc850multilingual: "cp850",
		cspcp852: "cp852",
		cspc862latinhebrew: "cp862",
		cpgr: "cp869",
		msee: "cp1250",
		mscyrl: "cp1251",
		msansi: "cp1252",
		msgreek: "cp1253",
		msturk: "cp1254",
		mshebr: "cp1255",
		msarab: "cp1256",
		winbaltrim: "cp1257",
		cp20866: "koi8r",
		20866: "koi8r",
		ibm878: "koi8r",
		cskoi8r: "koi8r",
		cp21866: "koi8u",
		21866: "koi8u",
		ibm1168: "koi8u",
		strk10482002: "rk1048",
		tcvn5712: "tcvn",
		tcvn57121: "tcvn",
		gb198880: "iso646cn",
		cn: "iso646cn",
		csiso14jisc6220ro: "iso646jp",
		jisc62201969ro: "iso646jp",
		jp: "iso646jp",
		cshproman8: "hproman8",
		r8: "hproman8",
		roman8: "hproman8",
		xroman8: "hproman8",
		ibm1051: "hproman8",
		mac: "macintosh",
		csmacintosh: "macintosh"
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-data-generated.js
var require_sbcs_data_generated = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/sbcs-data-generated.js": ((exports, module) => {
	module.exports = {
		"437": "cp437",
		"737": "cp737",
		"775": "cp775",
		"850": "cp850",
		"852": "cp852",
		"855": "cp855",
		"856": "cp856",
		"857": "cp857",
		"858": "cp858",
		"860": "cp860",
		"861": "cp861",
		"862": "cp862",
		"863": "cp863",
		"864": "cp864",
		"865": "cp865",
		"866": "cp866",
		"869": "cp869",
		"874": "windows874",
		"922": "cp922",
		"1046": "cp1046",
		"1124": "cp1124",
		"1125": "cp1125",
		"1129": "cp1129",
		"1133": "cp1133",
		"1161": "cp1161",
		"1162": "cp1162",
		"1163": "cp1163",
		"1250": "windows1250",
		"1251": "windows1251",
		"1252": "windows1252",
		"1253": "windows1253",
		"1254": "windows1254",
		"1255": "windows1255",
		"1256": "windows1256",
		"1257": "windows1257",
		"1258": "windows1258",
		"28591": "iso88591",
		"28592": "iso88592",
		"28593": "iso88593",
		"28594": "iso88594",
		"28595": "iso88595",
		"28596": "iso88596",
		"28597": "iso88597",
		"28598": "iso88598",
		"28599": "iso88599",
		"28600": "iso885910",
		"28601": "iso885911",
		"28603": "iso885913",
		"28604": "iso885914",
		"28605": "iso885915",
		"28606": "iso885916",
		"windows874": {
			"type": "_sbcs",
			"chars": "€����…�����������‘’“”•–—��������\xA0กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
		},
		"win874": "windows874",
		"cp874": "windows874",
		"windows1250": {
			"type": "_sbcs",
			"chars": "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź\xA0ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
		},
		"win1250": "windows1250",
		"cp1250": "windows1250",
		"windows1251": {
			"type": "_sbcs",
			"chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ\xA0ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
		},
		"win1251": "windows1251",
		"cp1251": "windows1251",
		"windows1252": {
			"type": "_sbcs",
			"chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
		},
		"win1252": "windows1252",
		"cp1252": "windows1252",
		"windows1253": {
			"type": "_sbcs",
			"chars": "€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›����\xA0΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
		},
		"win1253": "windows1253",
		"cp1253": "windows1253",
		"windows1254": {
			"type": "_sbcs",
			"chars": "€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
		},
		"win1254": "windows1254",
		"cp1254": "windows1254",
		"windows1255": {
			"type": "_sbcs",
			"chars": "€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›����\xA0¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹֺֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
		},
		"win1255": "windows1255",
		"cp1255": "windows1255",
		"windows1256": {
			"type": "_sbcs",
			"chars": "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں\xA0،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے"
		},
		"win1256": "windows1256",
		"cp1256": "windows1256",
		"windows1257": {
			"type": "_sbcs",
			"chars": "€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛�\xA0�¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙"
		},
		"win1257": "windows1257",
		"cp1257": "windows1257",
		"windows1258": {
			"type": "_sbcs",
			"chars": "€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
		},
		"win1258": "windows1258",
		"cp1258": "windows1258",
		"iso88591": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
		},
		"cp28591": "iso88591",
		"iso88592": {
			"type": "_sbcs",
			"chars": "\xA0Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
		},
		"cp28592": "iso88592",
		"iso88593": {
			"type": "_sbcs",
			"chars": "\xA0Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙"
		},
		"cp28593": "iso88593",
		"iso88594": {
			"type": "_sbcs",
			"chars": "\xA0ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙"
		},
		"cp28594": "iso88594",
		"iso88595": {
			"type": "_sbcs",
			"chars": "\xA0ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ"
		},
		"cp28595": "iso88595",
		"iso88596": {
			"type": "_sbcs",
			"chars": "\xA0���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������"
		},
		"cp28596": "iso88596",
		"iso88597": {
			"type": "_sbcs",
			"chars": "\xA0‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
		},
		"cp28597": "iso88597",
		"iso88598": {
			"type": "_sbcs",
			"chars": "\xA0�¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
		},
		"cp28598": "iso88598",
		"iso88599": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
		},
		"cp28599": "iso88599",
		"iso885910": {
			"type": "_sbcs",
			"chars": "\xA0ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ"
		},
		"cp28600": "iso885910",
		"iso885911": {
			"type": "_sbcs",
			"chars": "\xA0กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
		},
		"cp28601": "iso885911",
		"iso885913": {
			"type": "_sbcs",
			"chars": "\xA0”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’"
		},
		"cp28603": "iso885913",
		"iso885914": {
			"type": "_sbcs",
			"chars": "\xA0Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ"
		},
		"cp28604": "iso885914",
		"iso885915": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
		},
		"cp28605": "iso885915",
		"iso885916": {
			"type": "_sbcs",
			"chars": "\xA0ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ"
		},
		"cp28606": "iso885916",
		"cp437": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm437": "cp437",
		"csibm437": "cp437",
		"cp737": {
			"type": "_sbcs",
			"chars": "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm737": "cp737",
		"csibm737": "cp737",
		"cp775": {
			"type": "_sbcs",
			"chars": "ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■\xA0"
		},
		"ibm775": "cp775",
		"csibm775": "cp775",
		"cp850": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■\xA0"
		},
		"ibm850": "cp850",
		"csibm850": "cp850",
		"cp852": {
			"type": "_sbcs",
			"chars": "ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■\xA0"
		},
		"ibm852": "cp852",
		"csibm852": "cp852",
		"cp855": {
			"type": "_sbcs",
			"chars": "ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■\xA0"
		},
		"ibm855": "cp855",
		"csibm855": "cp855",
		"cp856": {
			"type": "_sbcs",
			"chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■\xA0"
		},
		"ibm856": "cp856",
		"csibm856": "cp856",
		"cp857": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■\xA0"
		},
		"ibm857": "cp857",
		"csibm857": "cp857",
		"cp858": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■\xA0"
		},
		"ibm858": "cp858",
		"csibm858": "cp858",
		"cp860": {
			"type": "_sbcs",
			"chars": "ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm860": "cp860",
		"csibm860": "cp860",
		"cp861": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm861": "cp861",
		"csibm861": "cp861",
		"cp862": {
			"type": "_sbcs",
			"chars": "אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm862": "cp862",
		"csibm862": "cp862",
		"cp863": {
			"type": "_sbcs",
			"chars": "ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm863": "cp863",
		"csibm863": "cp863",
		"cp864": {
			"type": "_sbcs",
			"chars": "\0\x07\b	\n\v\f\r\x1B !\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ�\xA0­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�"
		},
		"ibm864": "cp864",
		"csibm864": "cp864",
		"cp865": {
			"type": "_sbcs",
			"chars": "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xA0"
		},
		"ibm865": "cp865",
		"csibm865": "cp865",
		"cp866": {
			"type": "_sbcs",
			"chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■\xA0"
		},
		"ibm866": "cp866",
		"csibm866": "cp866",
		"cp869": {
			"type": "_sbcs",
			"chars": "������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■\xA0"
		},
		"ibm869": "cp869",
		"csibm869": "cp869",
		"cp922": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ"
		},
		"ibm922": "cp922",
		"csibm922": "cp922",
		"cp1046": {
			"type": "_sbcs",
			"chars": "ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ\xA0¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�"
		},
		"ibm1046": "cp1046",
		"csibm1046": "cp1046",
		"cp1124": {
			"type": "_sbcs",
			"chars": "\xA0ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ"
		},
		"ibm1124": "cp1124",
		"csibm1124": "cp1124",
		"cp1125": {
			"type": "_sbcs",
			"chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■\xA0"
		},
		"ibm1125": "cp1125",
		"csibm1125": "cp1125",
		"cp1129": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
		},
		"ibm1129": "cp1129",
		"csibm1129": "cp1129",
		"cp1133": {
			"type": "_sbcs",
			"chars": "\xA0ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�"
		},
		"ibm1133": "cp1133",
		"csibm1133": "cp1133",
		"cp1161": {
			"type": "_sbcs",
			"chars": "��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦\xA0"
		},
		"ibm1161": "cp1161",
		"csibm1161": "cp1161",
		"cp1162": {
			"type": "_sbcs",
			"chars": "€…‘’“”•–—\xA0กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
		},
		"ibm1162": "cp1162",
		"csibm1162": "cp1162",
		"cp1163": {
			"type": "_sbcs",
			"chars": "\xA0¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
		},
		"ibm1163": "cp1163",
		"csibm1163": "cp1163",
		"maccroatian": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č…\xA0ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ"
		},
		"maccyrillic": {
			"type": "_sbcs",
			"chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»…\xA0ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
		},
		"macgreek": {
			"type": "_sbcs",
			"chars": "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»…\xA0ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�"
		},
		"maciceland": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
		},
		"macroman": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
		},
		"macromania": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
		},
		"macthai": {
			"type": "_sbcs",
			"chars": "«»…“”�•‘’�\xA0กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����"
		},
		"macturkish": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ"
		},
		"macukraine": {
			"type": "_sbcs",
			"chars": "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»…\xA0ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
		},
		"koi8r": {
			"type": "_sbcs",
			"chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥\xA0⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
		},
		"koi8u": {
			"type": "_sbcs",
			"chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥\xA0⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
		},
		"koi8ru": {
			"type": "_sbcs",
			"chars": "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥\xA0⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
		},
		"koi8t": {
			"type": "_sbcs",
			"chars": "қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
		},
		"armscii8": {
			"type": "_sbcs",
			"chars": "\xA0�և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�"
		},
		"rk1048": {
			"type": "_sbcs",
			"chars": "ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ\xA0ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
		},
		"tcvn": {
			"type": "_sbcs",
			"chars": "\0ÚỤỪỬỮ\x07\b	\n\v\f\rỨỰỲỶỸÝỴ\x1B !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ\xA0ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ"
		},
		"georgianacademy": {
			"type": "_sbcs",
			"chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
		},
		"georgianps": {
			"type": "_sbcs",
			"chars": "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ\xA0¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
		},
		"pt154": {
			"type": "_sbcs",
			"chars": "ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ\xA0ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
		},
		"viscii": {
			"type": "_sbcs",
			"chars": "\0ẲẴẪ\x07\b	\n\v\f\rỶỸ\x1BỴ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ"
		},
		"iso646cn": {
			"type": "_sbcs",
			"chars": "\0\x07\b	\n\v\f\r\x1B !\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
		},
		"iso646jp": {
			"type": "_sbcs",
			"chars": "\0\x07\b	\n\v\f\r\x1B !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
		},
		"hproman8": {
			"type": "_sbcs",
			"chars": "\xA0ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�"
		},
		"macintosh": {
			"type": "_sbcs",
			"chars": "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xA0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
		},
		"ascii": {
			"type": "_sbcs",
			"chars": "��������������������������������������������������������������������������������������������������������������������������������"
		},
		"tis620": {
			"type": "_sbcs",
			"chars": "���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
		}
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/dbcs-codec.js
var require_dbcs_codec = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/dbcs-codec.js": ((exports) => {
	var Buffer$3 = require_safer().Buffer;
	exports._dbcs = DBCSCodec;
	var UNASSIGNED = -1;
	var GB18030_CODE = -2;
	var SEQ_START = -10;
	var NODE_START = -1e3;
	var UNASSIGNED_NODE = new Array(256);
	var DEF_CHAR = -1;
	for (var i$2 = 0; i$2 < 256; i$2++) UNASSIGNED_NODE[i$2] = UNASSIGNED;
	function DBCSCodec(codecOptions, iconv$1) {
		this.encodingName = codecOptions.encodingName;
		if (!codecOptions) throw new Error("DBCS codec is called without the data.");
		if (!codecOptions.table) throw new Error("Encoding '" + this.encodingName + "' has no data.");
		var mappingTable = codecOptions.table();
		this.decodeTables = [];
		this.decodeTables[0] = UNASSIGNED_NODE.slice(0);
		this.decodeTableSeq = [];
		for (var i$4 = 0; i$4 < mappingTable.length; i$4++) this._addDecodeChunk(mappingTable[i$4]);
		if (typeof codecOptions.gb18030 === "function") {
			this.gb18030 = codecOptions.gb18030();
			var commonThirdByteNodeIdx = this.decodeTables.length;
			this.decodeTables.push(UNASSIGNED_NODE.slice(0));
			var commonFourthByteNodeIdx = this.decodeTables.length;
			this.decodeTables.push(UNASSIGNED_NODE.slice(0));
			var firstByteNode = this.decodeTables[0];
			for (var i$4 = 129; i$4 <= 254; i$4++) {
				var secondByteNode = this.decodeTables[NODE_START - firstByteNode[i$4]];
				for (var j = 48; j <= 57; j++) {
					if (secondByteNode[j] === UNASSIGNED) secondByteNode[j] = NODE_START - commonThirdByteNodeIdx;
					else if (secondByteNode[j] > NODE_START) throw new Error("gb18030 decode tables conflict at byte 2");
					var thirdByteNode = this.decodeTables[NODE_START - secondByteNode[j]];
					for (var k = 129; k <= 254; k++) {
						if (thirdByteNode[k] === UNASSIGNED) thirdByteNode[k] = NODE_START - commonFourthByteNodeIdx;
						else if (thirdByteNode[k] === NODE_START - commonFourthByteNodeIdx) continue;
						else if (thirdByteNode[k] > NODE_START) throw new Error("gb18030 decode tables conflict at byte 3");
						var fourthByteNode = this.decodeTables[NODE_START - thirdByteNode[k]];
						for (var l = 48; l <= 57; l++) if (fourthByteNode[l] === UNASSIGNED) fourthByteNode[l] = GB18030_CODE;
					}
				}
			}
		}
		this.defaultCharUnicode = iconv$1.defaultCharUnicode;
		this.encodeTable = [];
		this.encodeTableSeq = [];
		var skipEncodeChars = {};
		if (codecOptions.encodeSkipVals) for (var i$4 = 0; i$4 < codecOptions.encodeSkipVals.length; i$4++) {
			var val = codecOptions.encodeSkipVals[i$4];
			if (typeof val === "number") skipEncodeChars[val] = true;
			else for (var j = val.from; j <= val.to; j++) skipEncodeChars[j] = true;
		}
		this._fillEncodeTable(0, 0, skipEncodeChars);
		if (codecOptions.encodeAdd) {
			for (var uChar in codecOptions.encodeAdd) if (Object.prototype.hasOwnProperty.call(codecOptions.encodeAdd, uChar)) this._setEncodeChar(uChar.charCodeAt(0), codecOptions.encodeAdd[uChar]);
		}
		this.defCharSB = this.encodeTable[0][iconv$1.defaultCharSingleByte.charCodeAt(0)];
		if (this.defCharSB === UNASSIGNED) this.defCharSB = this.encodeTable[0]["?"];
		if (this.defCharSB === UNASSIGNED) this.defCharSB = "?".charCodeAt(0);
	}
	DBCSCodec.prototype.encoder = DBCSEncoder;
	DBCSCodec.prototype.decoder = DBCSDecoder;
	DBCSCodec.prototype._getDecodeTrieNode = function(addr) {
		var bytes = [];
		for (; addr > 0; addr >>>= 8) bytes.push(addr & 255);
		if (bytes.length == 0) bytes.push(0);
		var node = this.decodeTables[0];
		for (var i$4 = bytes.length - 1; i$4 > 0; i$4--) {
			var val = node[bytes[i$4]];
			if (val == UNASSIGNED) {
				node[bytes[i$4]] = NODE_START - this.decodeTables.length;
				this.decodeTables.push(node = UNASSIGNED_NODE.slice(0));
			} else if (val <= NODE_START) node = this.decodeTables[NODE_START - val];
			else throw new Error("Overwrite byte in " + this.encodingName + ", addr: " + addr.toString(16));
		}
		return node;
	};
	DBCSCodec.prototype._addDecodeChunk = function(chunk) {
		var curAddr = parseInt(chunk[0], 16);
		var writeTable = this._getDecodeTrieNode(curAddr);
		curAddr = curAddr & 255;
		for (var k = 1; k < chunk.length; k++) {
			var part = chunk[k];
			if (typeof part === "string") for (var l = 0; l < part.length;) {
				var code = part.charCodeAt(l++);
				if (code >= 55296 && code < 56320) {
					var codeTrail = part.charCodeAt(l++);
					if (codeTrail >= 56320 && codeTrail < 57344) writeTable[curAddr++] = 65536 + (code - 55296) * 1024 + (codeTrail - 56320);
					else throw new Error("Incorrect surrogate pair in " + this.encodingName + " at chunk " + chunk[0]);
				} else if (code > 4080 && code <= 4095) {
					var len = 4095 - code + 2;
					var seq = [];
					for (var m = 0; m < len; m++) seq.push(part.charCodeAt(l++));
					writeTable[curAddr++] = SEQ_START - this.decodeTableSeq.length;
					this.decodeTableSeq.push(seq);
				} else writeTable[curAddr++] = code;
			}
			else if (typeof part === "number") {
				var charCode = writeTable[curAddr - 1] + 1;
				for (var l = 0; l < part; l++) writeTable[curAddr++] = charCode++;
			} else throw new Error("Incorrect type '" + typeof part + "' given in " + this.encodingName + " at chunk " + chunk[0]);
		}
		if (curAddr > 255) throw new Error("Incorrect chunk in " + this.encodingName + " at addr " + chunk[0] + ": too long" + curAddr);
	};
	DBCSCodec.prototype._getEncodeBucket = function(uCode) {
		var high = uCode >> 8;
		if (this.encodeTable[high] === void 0) this.encodeTable[high] = UNASSIGNED_NODE.slice(0);
		return this.encodeTable[high];
	};
	DBCSCodec.prototype._setEncodeChar = function(uCode, dbcsCode) {
		var bucket = this._getEncodeBucket(uCode);
		var low = uCode & 255;
		if (bucket[low] <= SEQ_START) this.encodeTableSeq[SEQ_START - bucket[low]][DEF_CHAR] = dbcsCode;
		else if (bucket[low] == UNASSIGNED) bucket[low] = dbcsCode;
	};
	DBCSCodec.prototype._setEncodeSequence = function(seq, dbcsCode) {
		var uCode = seq[0];
		var bucket = this._getEncodeBucket(uCode);
		var low = uCode & 255;
		var node;
		if (bucket[low] <= SEQ_START) node = this.encodeTableSeq[SEQ_START - bucket[low]];
		else {
			node = {};
			if (bucket[low] !== UNASSIGNED) node[DEF_CHAR] = bucket[low];
			bucket[low] = SEQ_START - this.encodeTableSeq.length;
			this.encodeTableSeq.push(node);
		}
		for (var j = 1; j < seq.length - 1; j++) {
			var oldVal = node[uCode];
			if (typeof oldVal === "object") node = oldVal;
			else {
				node = node[uCode] = {};
				if (oldVal !== void 0) node[DEF_CHAR] = oldVal;
			}
		}
		uCode = seq[seq.length - 1];
		node[uCode] = dbcsCode;
	};
	DBCSCodec.prototype._fillEncodeTable = function(nodeIdx, prefix, skipEncodeChars) {
		var node = this.decodeTables[nodeIdx];
		var hasValues = false;
		var subNodeEmpty = {};
		for (var i$4 = 0; i$4 < 256; i$4++) {
			var uCode = node[i$4];
			var mbCode = prefix + i$4;
			if (skipEncodeChars[mbCode]) continue;
			if (uCode >= 0) {
				this._setEncodeChar(uCode, mbCode);
				hasValues = true;
			} else if (uCode <= NODE_START) {
				var subNodeIdx = NODE_START - uCode;
				if (!subNodeEmpty[subNodeIdx]) {
					var newPrefix = mbCode << 8 >>> 0;
					if (this._fillEncodeTable(subNodeIdx, newPrefix, skipEncodeChars)) hasValues = true;
					else subNodeEmpty[subNodeIdx] = true;
				}
			} else if (uCode <= SEQ_START) {
				this._setEncodeSequence(this.decodeTableSeq[SEQ_START - uCode], mbCode);
				hasValues = true;
			}
		}
		return hasValues;
	};
	function DBCSEncoder(options, codec) {
		this.leadSurrogate = -1;
		this.seqObj = void 0;
		this.encodeTable = codec.encodeTable;
		this.encodeTableSeq = codec.encodeTableSeq;
		this.defaultCharSingleByte = codec.defCharSB;
		this.gb18030 = codec.gb18030;
	}
	DBCSEncoder.prototype.write = function(str) {
		var newBuf = Buffer$3.alloc(str.length * (this.gb18030 ? 4 : 3));
		var leadSurrogate = this.leadSurrogate;
		var seqObj = this.seqObj;
		var nextChar = -1;
		var i$4 = 0;
		var j = 0;
		while (true) {
			if (nextChar === -1) {
				if (i$4 == str.length) break;
				var uCode = str.charCodeAt(i$4++);
			} else {
				var uCode = nextChar;
				nextChar = -1;
			}
			if (uCode >= 55296 && uCode < 57344) if (uCode < 56320) if (leadSurrogate === -1) {
				leadSurrogate = uCode;
				continue;
			} else {
				leadSurrogate = uCode;
				uCode = UNASSIGNED;
			}
			else if (leadSurrogate !== -1) {
				uCode = 65536 + (leadSurrogate - 55296) * 1024 + (uCode - 56320);
				leadSurrogate = -1;
			} else uCode = UNASSIGNED;
			else if (leadSurrogate !== -1) {
				nextChar = uCode;
				uCode = UNASSIGNED;
				leadSurrogate = -1;
			}
			var dbcsCode = UNASSIGNED;
			if (seqObj !== void 0 && uCode != UNASSIGNED) {
				var resCode = seqObj[uCode];
				if (typeof resCode === "object") {
					seqObj = resCode;
					continue;
				} else if (typeof resCode === "number") dbcsCode = resCode;
				else if (resCode == void 0) {
					resCode = seqObj[DEF_CHAR];
					if (resCode !== void 0) {
						dbcsCode = resCode;
						nextChar = uCode;
					}
				}
				seqObj = void 0;
			} else if (uCode >= 0) {
				var subtable = this.encodeTable[uCode >> 8];
				if (subtable !== void 0) dbcsCode = subtable[uCode & 255];
				if (dbcsCode <= SEQ_START) {
					seqObj = this.encodeTableSeq[SEQ_START - dbcsCode];
					continue;
				}
				if (dbcsCode == UNASSIGNED && this.gb18030) {
					var idx = findIdx(this.gb18030.uChars, uCode);
					if (idx != -1) {
						var dbcsCode = this.gb18030.gbChars[idx] + (uCode - this.gb18030.uChars[idx]);
						newBuf[j++] = 129 + Math.floor(dbcsCode / 12600);
						dbcsCode = dbcsCode % 12600;
						newBuf[j++] = 48 + Math.floor(dbcsCode / 1260);
						dbcsCode = dbcsCode % 1260;
						newBuf[j++] = 129 + Math.floor(dbcsCode / 10);
						dbcsCode = dbcsCode % 10;
						newBuf[j++] = 48 + dbcsCode;
						continue;
					}
				}
			}
			if (dbcsCode === UNASSIGNED) dbcsCode = this.defaultCharSingleByte;
			if (dbcsCode < 256) newBuf[j++] = dbcsCode;
			else if (dbcsCode < 65536) {
				newBuf[j++] = dbcsCode >> 8;
				newBuf[j++] = dbcsCode & 255;
			} else if (dbcsCode < 16777216) {
				newBuf[j++] = dbcsCode >> 16;
				newBuf[j++] = dbcsCode >> 8 & 255;
				newBuf[j++] = dbcsCode & 255;
			} else {
				newBuf[j++] = dbcsCode >>> 24;
				newBuf[j++] = dbcsCode >>> 16 & 255;
				newBuf[j++] = dbcsCode >>> 8 & 255;
				newBuf[j++] = dbcsCode & 255;
			}
		}
		this.seqObj = seqObj;
		this.leadSurrogate = leadSurrogate;
		return newBuf.slice(0, j);
	};
	DBCSEncoder.prototype.end = function() {
		if (this.leadSurrogate === -1 && this.seqObj === void 0) return;
		var newBuf = Buffer$3.alloc(10);
		var j = 0;
		if (this.seqObj) {
			var dbcsCode = this.seqObj[DEF_CHAR];
			if (dbcsCode !== void 0) if (dbcsCode < 256) newBuf[j++] = dbcsCode;
			else {
				newBuf[j++] = dbcsCode >> 8;
				newBuf[j++] = dbcsCode & 255;
			}
			this.seqObj = void 0;
		}
		if (this.leadSurrogate !== -1) {
			newBuf[j++] = this.defaultCharSingleByte;
			this.leadSurrogate = -1;
		}
		return newBuf.slice(0, j);
	};
	DBCSEncoder.prototype.findIdx = findIdx;
	function DBCSDecoder(options, codec) {
		this.nodeIdx = 0;
		this.prevBytes = [];
		this.decodeTables = codec.decodeTables;
		this.decodeTableSeq = codec.decodeTableSeq;
		this.defaultCharUnicode = codec.defaultCharUnicode;
		this.gb18030 = codec.gb18030;
	}
	DBCSDecoder.prototype.write = function(buf) {
		var newBuf = Buffer$3.alloc(buf.length * 2);
		var nodeIdx = this.nodeIdx;
		var prevBytes = this.prevBytes;
		var prevOffset = this.prevBytes.length;
		var seqStart = -this.prevBytes.length;
		var uCode;
		for (var i$4 = 0, j = 0; i$4 < buf.length; i$4++) {
			var curByte = i$4 >= 0 ? buf[i$4] : prevBytes[i$4 + prevOffset];
			var uCode = this.decodeTables[nodeIdx][curByte];
			if (uCode >= 0) {} else if (uCode === UNASSIGNED) {
				uCode = this.defaultCharUnicode.charCodeAt(0);
				i$4 = seqStart;
			} else if (uCode === GB18030_CODE) {
				if (i$4 >= 3) var ptr = (buf[i$4 - 3] - 129) * 12600 + (buf[i$4 - 2] - 48) * 1260 + (buf[i$4 - 1] - 129) * 10 + (curByte - 48);
				else var ptr = (prevBytes[i$4 - 3 + prevOffset] - 129) * 12600 + ((i$4 - 2 >= 0 ? buf[i$4 - 2] : prevBytes[i$4 - 2 + prevOffset]) - 48) * 1260 + ((i$4 - 1 >= 0 ? buf[i$4 - 1] : prevBytes[i$4 - 1 + prevOffset]) - 129) * 10 + (curByte - 48);
				var idx = findIdx(this.gb18030.gbChars, ptr);
				uCode = this.gb18030.uChars[idx] + ptr - this.gb18030.gbChars[idx];
			} else if (uCode <= NODE_START) {
				nodeIdx = NODE_START - uCode;
				continue;
			} else if (uCode <= SEQ_START) {
				var seq = this.decodeTableSeq[SEQ_START - uCode];
				for (var k = 0; k < seq.length - 1; k++) {
					uCode = seq[k];
					newBuf[j++] = uCode & 255;
					newBuf[j++] = uCode >> 8;
				}
				uCode = seq[seq.length - 1];
			} else throw new Error("iconv-lite internal error: invalid decoding table value " + uCode + " at " + nodeIdx + "/" + curByte);
			if (uCode >= 65536) {
				uCode -= 65536;
				var uCodeLead = 55296 | uCode >> 10;
				newBuf[j++] = uCodeLead & 255;
				newBuf[j++] = uCodeLead >> 8;
				uCode = 56320 | uCode & 1023;
			}
			newBuf[j++] = uCode & 255;
			newBuf[j++] = uCode >> 8;
			nodeIdx = 0;
			seqStart = i$4 + 1;
		}
		this.nodeIdx = nodeIdx;
		this.prevBytes = seqStart >= 0 ? Array.prototype.slice.call(buf, seqStart) : prevBytes.slice(seqStart + prevOffset).concat(Array.prototype.slice.call(buf));
		return newBuf.slice(0, j).toString("ucs2");
	};
	DBCSDecoder.prototype.end = function() {
		var ret = "";
		while (this.prevBytes.length > 0) {
			ret += this.defaultCharUnicode;
			var bytesArr = this.prevBytes.slice(1);
			this.prevBytes = [];
			this.nodeIdx = 0;
			if (bytesArr.length > 0) ret += this.write(bytesArr);
		}
		this.prevBytes = [];
		this.nodeIdx = 0;
		return ret;
	};
	function findIdx(table, val) {
		if (table[0] > val) return -1;
		var l = 0;
		var r = table.length;
		while (l < r - 1) {
			var mid = l + (r - l + 1 >> 1);
			if (table[mid] <= val) l = mid;
			else r = mid;
		}
		return l;
	}
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/shiftjis.json
var require_shiftjis = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/shiftjis.json": ((exports, module) => {
	module.exports = [
		[
			"0",
			"\0",
			128
		],
		[
			"a1",
			"｡",
			62
		],
		[
			"8140",
			"　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",
			9,
			"＋－±×"
		],
		["8180", "÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓"],
		["81b8", "∈∋⊆⊇⊂⊃∪∩"],
		["81c8", "∧∨￢⇒⇔∀∃"],
		["81da", "∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
		["81f0", "Å‰♯♭♪†‡¶"],
		["81fc", "◯"],
		[
			"824f",
			"０",
			9
		],
		[
			"8260",
			"Ａ",
			25
		],
		[
			"8281",
			"ａ",
			25
		],
		[
			"829f",
			"ぁ",
			82
		],
		[
			"8340",
			"ァ",
			62
		],
		[
			"8380",
			"ム",
			22
		],
		[
			"839f",
			"Α",
			16,
			"Σ",
			6
		],
		[
			"83bf",
			"α",
			16,
			"σ",
			6
		],
		[
			"8440",
			"А",
			5,
			"ЁЖ",
			25
		],
		[
			"8470",
			"а",
			5,
			"ёж",
			7
		],
		[
			"8480",
			"о",
			17
		],
		["849f", "─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
		[
			"8740",
			"①",
			19,
			"Ⅰ",
			9
		],
		["875f", "㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
		["877e", "㍻"],
		[
			"8780",
			"〝〟№㏍℡㊤",
			4,
			"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"
		],
		["889f", "亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
		["8940", "院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円"],
		["8980", "園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
		["8a40", "魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫"],
		["8a80", "橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
		["8b40", "機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救"],
		["8b80", "朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
		["8c40", "掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨"],
		["8c80", "劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
		["8d40", "后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降"],
		["8d80", "項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
		["8e40", "察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止"],
		["8e80", "死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
		["8f40", "宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳"],
		["8f80", "準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
		["9040", "拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨"],
		["9080", "逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
		["9140", "繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻"],
		["9180", "操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
		["9240", "叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄"],
		["9280", "逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
		["9340", "邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬"],
		["9380", "凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
		["9440", "如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅"],
		["9480", "楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
		["9540", "鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷"],
		["9580", "斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
		["9640", "法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆"],
		["9680", "摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
		["9740", "諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲"],
		["9780", "沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
		["9840", "蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
		["989f", "弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
		["9940", "僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭"],
		["9980", "凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
		["9a40", "咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸"],
		["9a80", "噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
		["9b40", "奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀"],
		["9b80", "它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
		["9c40", "廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠"],
		["9c80", "怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
		["9d40", "戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫"],
		["9d80", "捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
		["9e40", "曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎"],
		["9e80", "梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
		["9f40", "檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯"],
		["9f80", "麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
		["e040", "漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝"],
		["e080", "烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
		["e140", "瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿"],
		["e180", "痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
		["e240", "磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰"],
		["e280", "窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
		["e340", "紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷"],
		["e380", "縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
		["e440", "隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤"],
		["e480", "艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
		["e540", "蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬"],
		["e580", "蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
		["e640", "襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧"],
		["e680", "諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
		["e740", "蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜"],
		["e780", "轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
		["e840", "錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙"],
		["e880", "閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
		["e940", "顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃"],
		["e980", "騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
		["ea40", "鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯"],
		["ea80", "黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠堯槇遙瑤凜熙"],
		["ed40", "纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏"],
		["ed80", "塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
		["ee40", "犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙"],
		["ee80", "蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
		[
			"eeef",
			"ⅰ",
			9,
			"￢￤＇＂"
		],
		[
			"f040",
			"",
			62
		],
		[
			"f080",
			"",
			124
		],
		[
			"f140",
			"",
			62
		],
		[
			"f180",
			"",
			124
		],
		[
			"f240",
			"",
			62
		],
		[
			"f280",
			"",
			124
		],
		[
			"f340",
			"",
			62
		],
		[
			"f380",
			"",
			124
		],
		[
			"f440",
			"",
			62
		],
		[
			"f480",
			"",
			124
		],
		[
			"f540",
			"",
			62
		],
		[
			"f580",
			"",
			124
		],
		[
			"f640",
			"",
			62
		],
		[
			"f680",
			"",
			124
		],
		[
			"f740",
			"",
			62
		],
		[
			"f780",
			"",
			124
		],
		[
			"f840",
			"",
			62
		],
		[
			"f880",
			"",
			124
		],
		["f940", ""],
		[
			"fa40",
			"ⅰ",
			9,
			"Ⅰ",
			9,
			"￢￤＇＂㈱№℡∵纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊"
		],
		["fa80", "兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯"],
		["fb40", "涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神"],
		["fb80", "祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙"],
		["fc40", "髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/eucjp.json
var require_eucjp = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/eucjp.json": ((exports, module) => {
	module.exports = [
		[
			"0",
			"\0",
			127
		],
		[
			"8ea1",
			"｡",
			62
		],
		[
			"a1a1",
			"　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",
			9,
			"＋－±×÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇"
		],
		["a2a1", "◆□■△▲▽▼※〒→←↑↓〓"],
		["a2ba", "∈∋⊆⊇⊂⊃∪∩"],
		["a2ca", "∧∨￢⇒⇔∀∃"],
		["a2dc", "∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
		["a2f2", "Å‰♯♭♪†‡¶"],
		["a2fe", "◯"],
		[
			"a3b0",
			"０",
			9
		],
		[
			"a3c1",
			"Ａ",
			25
		],
		[
			"a3e1",
			"ａ",
			25
		],
		[
			"a4a1",
			"ぁ",
			82
		],
		[
			"a5a1",
			"ァ",
			85
		],
		[
			"a6a1",
			"Α",
			16,
			"Σ",
			6
		],
		[
			"a6c1",
			"α",
			16,
			"σ",
			6
		],
		[
			"a7a1",
			"А",
			5,
			"ЁЖ",
			25
		],
		[
			"a7d1",
			"а",
			5,
			"ёж",
			25
		],
		["a8a1", "─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
		[
			"ada1",
			"①",
			19,
			"Ⅰ",
			9
		],
		["adc0", "㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
		[
			"addf",
			"㍻〝〟№㏍℡㊤",
			4,
			"㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"
		],
		["b0a1", "亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
		["b1a1", "院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応"],
		["b2a1", "押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
		["b3a1", "魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱"],
		["b4a1", "粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
		["b5a1", "機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京"],
		["b6a1", "供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
		["b7a1", "掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲"],
		["b8a1", "検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
		["b9a1", "后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込"],
		["baa1", "此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
		["bba1", "察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時"],
		["bca1", "次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
		["bda1", "宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償"],
		["bea1", "勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
		["bfa1", "拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾"],
		["c0a1", "澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
		["c1a1", "繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎"],
		["c2a1", "臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
		["c3a1", "叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵"],
		["c4a1", "帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
		["c5a1", "邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到"],
		["c6a1", "董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
		["c7a1", "如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦"],
		["c8a1", "函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
		["c9a1", "鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服"],
		["caa1", "福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
		["cba1", "法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満"],
		["cca1", "漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
		["cda1", "諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃"],
		["cea1", "痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
		["cfa1", "蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
		["d0a1", "弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
		["d1a1", "僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨"],
		["d2a1", "辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
		["d3a1", "咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉"],
		["d4a1", "圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
		["d5a1", "奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓"],
		["d6a1", "屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
		["d7a1", "廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚"],
		["d8a1", "悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
		["d9a1", "戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼"],
		["daa1", "據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
		["dba1", "曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍"],
		["dca1", "棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
		["dda1", "檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾"],
		["dea1", "沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
		["dfa1", "漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼"],
		["e0a1", "燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
		["e1a1", "瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰"],
		["e2a1", "癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
		["e3a1", "磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐"],
		["e4a1", "筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
		["e5a1", "紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺"],
		["e6a1", "罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
		["e7a1", "隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙"],
		["e8a1", "茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
		["e9a1", "蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙"],
		["eaa1", "蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
		["eba1", "襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫"],
		["eca1", "譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
		["eda1", "蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸"],
		["eea1", "遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
		["efa1", "錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞"],
		["f0a1", "陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
		["f1a1", "顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷"],
		["f2a1", "髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
		["f3a1", "鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠"],
		["f4a1", "堯槇遙瑤凜熙"],
		["f9a1", "纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德"],
		["faa1", "忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
		["fba1", "犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚"],
		["fca1", "釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
		[
			"fcf1",
			"ⅰ",
			9,
			"￢￤＇＂"
		],
		["8fa2af", "˘ˇ¸˙˝¯˛˚～΄΅"],
		["8fa2c2", "¡¦¿"],
		["8fa2eb", "ºª©®™¤№"],
		["8fa6e1", "ΆΈΉΊΪ"],
		["8fa6e7", "Ό"],
		["8fa6e9", "ΎΫ"],
		["8fa6ec", "Ώ"],
		["8fa6f1", "άέήίϊΐόςύϋΰώ"],
		[
			"8fa7c2",
			"Ђ",
			10,
			"ЎЏ"
		],
		[
			"8fa7f2",
			"ђ",
			10,
			"ўџ"
		],
		["8fa9a1", "ÆĐ"],
		["8fa9a4", "Ħ"],
		["8fa9a6", "Ĳ"],
		["8fa9a8", "ŁĿ"],
		["8fa9ab", "ŊØŒ"],
		["8fa9af", "ŦÞ"],
		["8fa9c1", "æđðħıĳĸłŀŉŋøœßŧþ"],
		["8faaa1", "ÁÀÄÂĂǍĀĄÅÃĆĈČÇĊĎÉÈËÊĚĖĒĘ"],
		["8faaba", "ĜĞĢĠĤÍÌÏÎǏİĪĮĨĴĶĹĽĻŃŇŅÑÓÒÖÔǑŐŌÕŔŘŖŚŜŠŞŤŢÚÙÜÛŬǓŰŪŲŮŨǗǛǙǕŴÝŸŶŹŽŻ"],
		["8faba1", "áàäâăǎāąåãćĉčçċďéèëêěėēęǵĝğ"],
		["8fabbd", "ġĥíìïîǐ"],
		["8fabc5", "īįĩĵķĺľļńňņñóòöôǒőōõŕřŗśŝšşťţúùüûŭǔűūųůũǘǜǚǖŵýÿŷźžż"],
		["8fb0a1", "丂丄丅丌丒丟丣两丨丫丮丯丰丵乀乁乄乇乑乚乜乣乨乩乴乵乹乿亍亖亗亝亯亹仃仐仚仛仠仡仢仨仯仱仳仵份仾仿伀伂伃伈伋伌伒伕伖众伙伮伱你伳伵伷伹伻伾佀佂佈佉佋佌佒佔佖佘佟佣佪佬佮佱佷佸佹佺佽佾侁侂侄"],
		["8fb1a1", "侅侉侊侌侎侐侒侓侔侗侙侚侞侟侲侷侹侻侼侽侾俀俁俅俆俈俉俋俌俍俏俒俜俠俢俰俲俼俽俿倀倁倄倇倊倌倎倐倓倗倘倛倜倝倞倢倧倮倰倲倳倵偀偁偂偅偆偊偌偎偑偒偓偗偙偟偠偢偣偦偧偪偭偰偱倻傁傃傄傆傊傎傏傐"],
		[
			"8fb2a1",
			"傒傓傔傖傛傜傞",
			4,
			"傪傯傰傹傺傽僀僃僄僇僌僎僐僓僔僘僜僝僟僢僤僦僨僩僯僱僶僺僾儃儆儇儈儋儌儍儎僲儐儗儙儛儜儝儞儣儧儨儬儭儯儱儳儴儵儸儹兂兊兏兓兕兗兘兟兤兦兾冃冄冋冎冘冝冡冣冭冸冺冼冾冿凂"
		],
		["8fb3a1", "凈减凑凒凓凕凘凞凢凥凮凲凳凴凷刁刂刅划刓刕刖刘刢刨刱刲刵刼剅剉剕剗剘剚剜剟剠剡剦剮剷剸剹劀劂劅劊劌劓劕劖劗劘劚劜劤劥劦劧劯劰劶劷劸劺劻劽勀勄勆勈勌勏勑勔勖勛勜勡勥勨勩勪勬勰勱勴勶勷匀匃匊匋"],
		["8fb4a1", "匌匑匓匘匛匜匞匟匥匧匨匩匫匬匭匰匲匵匼匽匾卂卌卋卙卛卡卣卥卬卭卲卹卾厃厇厈厎厓厔厙厝厡厤厪厫厯厲厴厵厷厸厺厽叀叅叏叒叓叕叚叝叞叠另叧叵吂吓吚吡吧吨吪启吱吴吵呃呄呇呍呏呞呢呤呦呧呩呫呭呮呴呿"],
		["8fb5a1", "咁咃咅咈咉咍咑咕咖咜咟咡咦咧咩咪咭咮咱咷咹咺咻咿哆哊响哎哠哪哬哯哶哼哾哿唀唁唅唈唉唌唍唎唕唪唫唲唵唶唻唼唽啁啇啉啊啍啐啑啘啚啛啞啠啡啤啦啿喁喂喆喈喎喏喑喒喓喔喗喣喤喭喲喿嗁嗃嗆嗉嗋嗌嗎嗑嗒"],
		[
			"8fb6a1",
			"嗓嗗嗘嗛嗞嗢嗩嗶嗿嘅嘈嘊嘍",
			5,
			"嘙嘬嘰嘳嘵嘷嘹嘻嘼嘽嘿噀噁噃噄噆噉噋噍噏噔噞噠噡噢噣噦噩噭噯噱噲噵嚄嚅嚈嚋嚌嚕嚙嚚嚝嚞嚟嚦嚧嚨嚩嚫嚬嚭嚱嚳嚷嚾囅囉囊囋囏囐囌囍囙囜囝囟囡囤",
			4,
			"囱囫园"
		],
		[
			"8fb7a1",
			"囶囷圁圂圇圊圌圑圕圚圛圝圠圢圣圤圥圩圪圬圮圯圳圴圽圾圿坅坆坌坍坒坢坥坧坨坫坭",
			4,
			"坳坴坵坷坹坺坻坼坾垁垃垌垔垗垙垚垜垝垞垟垡垕垧垨垩垬垸垽埇埈埌埏埕埝埞埤埦埧埩埭埰埵埶埸埽埾埿堃堄堈堉埡"
		],
		["8fb8a1", "堌堍堛堞堟堠堦堧堭堲堹堿塉塌塍塏塐塕塟塡塤塧塨塸塼塿墀墁墇墈墉墊墌墍墏墐墔墖墝墠墡墢墦墩墱墲壄墼壂壈壍壎壐壒壔壖壚壝壡壢壩壳夅夆夋夌夒夓夔虁夝夡夣夤夨夯夰夳夵夶夿奃奆奒奓奙奛奝奞奟奡奣奫奭"],
		["8fb9a1", "奯奲奵奶她奻奼妋妌妎妒妕妗妟妤妧妭妮妯妰妳妷妺妼姁姃姄姈姊姍姒姝姞姟姣姤姧姮姯姱姲姴姷娀娄娌娍娎娒娓娞娣娤娧娨娪娭娰婄婅婇婈婌婐婕婞婣婥婧婭婷婺婻婾媋媐媓媖媙媜媞媟媠媢媧媬媱媲媳媵媸媺媻媿"],
		[
			"8fbaa1",
			"嫄嫆嫈嫏嫚嫜嫠嫥嫪嫮嫵嫶嫽嬀嬁嬈嬗嬴嬙嬛嬝嬡嬥嬭嬸孁孋孌孒孖孞孨孮孯孼孽孾孿宁宄宆宊宎宐宑宓宔宖宨宩宬宭宯宱宲宷宺宼寀寁寍寏寖",
			4,
			"寠寯寱寴寽尌尗尞尟尣尦尩尫尬尮尰尲尵尶屙屚屜屢屣屧屨屩"
		],
		["8fbba1", "屭屰屴屵屺屻屼屽岇岈岊岏岒岝岟岠岢岣岦岪岲岴岵岺峉峋峒峝峗峮峱峲峴崁崆崍崒崫崣崤崦崧崱崴崹崽崿嵂嵃嵆嵈嵕嵑嵙嵊嵟嵠嵡嵢嵤嵪嵭嵰嵹嵺嵾嵿嶁嶃嶈嶊嶒嶓嶔嶕嶙嶛嶟嶠嶧嶫嶰嶴嶸嶹巃巇巋巐巎巘巙巠巤"],
		[
			"8fbca1",
			"巩巸巹帀帇帍帒帔帕帘帟帠帮帨帲帵帾幋幐幉幑幖幘幛幜幞幨幪",
			4,
			"幰庀庋庎庢庤庥庨庪庬庱庳庽庾庿廆廌廋廎廑廒廔廕廜廞廥廫异弆弇弈弎弙弜弝弡弢弣弤弨弫弬弮弰弴弶弻弽弿彀彄彅彇彍彐彔彘彛彠彣彤彧"
		],
		[
			"8fbda1",
			"彯彲彴彵彸彺彽彾徉徍徏徖徜徝徢徧徫徤徬徯徰徱徸忄忇忈忉忋忐",
			4,
			"忞忡忢忨忩忪忬忭忮忯忲忳忶忺忼怇怊怍怓怔怗怘怚怟怤怭怳怵恀恇恈恉恌恑恔恖恗恝恡恧恱恾恿悂悆悈悊悎悑悓悕悘悝悞悢悤悥您悰悱悷"
		],
		[
			"8fbea1",
			"悻悾惂惄惈惉惊惋惎惏惔惕惙惛惝惞惢惥惲惵惸惼惽愂愇愊愌愐",
			4,
			"愖愗愙愜愞愢愪愫愰愱愵愶愷愹慁慅慆慉慞慠慬慲慸慻慼慿憀憁憃憄憋憍憒憓憗憘憜憝憟憠憥憨憪憭憸憹憼懀懁懂懎懏懕懜懝懞懟懡懢懧懩懥"
		],
		["8fbfa1", "懬懭懯戁戃戄戇戓戕戜戠戢戣戧戩戫戹戽扂扃扄扆扌扐扑扒扔扖扚扜扤扭扯扳扺扽抍抎抏抐抦抨抳抶抷抺抾抿拄拎拕拖拚拪拲拴拼拽挃挄挊挋挍挐挓挖挘挩挪挭挵挶挹挼捁捂捃捄捆捊捋捎捒捓捔捘捛捥捦捬捭捱捴捵"],
		["8fc0a1", "捸捼捽捿掂掄掇掊掐掔掕掙掚掞掤掦掭掮掯掽揁揅揈揎揑揓揔揕揜揠揥揪揬揲揳揵揸揹搉搊搐搒搔搘搞搠搢搤搥搩搪搯搰搵搽搿摋摏摑摒摓摔摚摛摜摝摟摠摡摣摭摳摴摻摽撅撇撏撐撑撘撙撛撝撟撡撣撦撨撬撳撽撾撿"],
		["8fc1a1", "擄擉擊擋擌擎擐擑擕擗擤擥擩擪擭擰擵擷擻擿攁攄攈攉攊攏攓攔攖攙攛攞攟攢攦攩攮攱攺攼攽敃敇敉敐敒敔敟敠敧敫敺敽斁斅斊斒斕斘斝斠斣斦斮斲斳斴斿旂旈旉旎旐旔旖旘旟旰旲旴旵旹旾旿昀昄昈昉昍昑昒昕昖昝"],
		["8fc2a1", "昞昡昢昣昤昦昩昪昫昬昮昰昱昳昹昷晀晅晆晊晌晑晎晗晘晙晛晜晠晡曻晪晫晬晾晳晵晿晷晸晹晻暀晼暋暌暍暐暒暙暚暛暜暟暠暤暭暱暲暵暻暿曀曂曃曈曌曎曏曔曛曟曨曫曬曮曺朅朇朎朓朙朜朠朢朳朾杅杇杈杌杔杕杝"],
		[
			"8fc3a1",
			"杦杬杮杴杶杻极构枎枏枑枓枖枘枙枛枰枱枲枵枻枼枽柹柀柂柃柅柈柉柒柗柙柜柡柦柰柲柶柷桒栔栙栝栟栨栧栬栭栯栰栱栳栻栿桄桅桊桌桕桗桘桛桫桮",
			4,
			"桵桹桺桻桼梂梄梆梈梖梘梚梜梡梣梥梩梪梮梲梻棅棈棌棏"
		],
		["8fc4a1", "棐棑棓棖棙棜棝棥棨棪棫棬棭棰棱棵棶棻棼棽椆椉椊椐椑椓椖椗椱椳椵椸椻楂楅楉楎楗楛楣楤楥楦楨楩楬楰楱楲楺楻楿榀榍榒榖榘榡榥榦榨榫榭榯榷榸榺榼槅槈槑槖槗槢槥槮槯槱槳槵槾樀樁樃樏樑樕樚樝樠樤樨樰樲"],
		["8fc5a1", "樴樷樻樾樿橅橆橉橊橎橐橑橒橕橖橛橤橧橪橱橳橾檁檃檆檇檉檋檑檛檝檞檟檥檫檯檰檱檴檽檾檿櫆櫉櫈櫌櫐櫔櫕櫖櫜櫝櫤櫧櫬櫰櫱櫲櫼櫽欂欃欆欇欉欏欐欑欗欛欞欤欨欫欬欯欵欶欻欿歆歊歍歒歖歘歝歠歧歫歮歰歵歽"],
		["8fc6a1", "歾殂殅殗殛殟殠殢殣殨殩殬殭殮殰殸殹殽殾毃毄毉毌毖毚毡毣毦毧毮毱毷毹毿氂氄氅氉氍氎氐氒氙氟氦氧氨氬氮氳氵氶氺氻氿汊汋汍汏汒汔汙汛汜汫汭汯汴汶汸汹汻沅沆沇沉沔沕沗沘沜沟沰沲沴泂泆泍泏泐泑泒泔泖"],
		["8fc7a1", "泚泜泠泧泩泫泬泮泲泴洄洇洊洎洏洑洓洚洦洧洨汧洮洯洱洹洼洿浗浞浟浡浥浧浯浰浼涂涇涑涒涔涖涗涘涪涬涴涷涹涽涿淄淈淊淎淏淖淛淝淟淠淢淥淩淯淰淴淶淼渀渄渞渢渧渲渶渹渻渼湄湅湈湉湋湏湑湒湓湔湗湜湝湞"],
		["8fc8a1", "湢湣湨湳湻湽溍溓溙溠溧溭溮溱溳溻溿滀滁滃滇滈滊滍滎滏滫滭滮滹滻滽漄漈漊漌漍漖漘漚漛漦漩漪漯漰漳漶漻漼漭潏潑潒潓潗潙潚潝潞潡潢潨潬潽潾澃澇澈澋澌澍澐澒澓澔澖澚澟澠澥澦澧澨澮澯澰澵澶澼濅濇濈濊"],
		[
			"8fc9a1",
			"濚濞濨濩濰濵濹濼濽瀀瀅瀆瀇瀍瀗瀠瀣瀯瀴瀷瀹瀼灃灄灈灉灊灋灔灕灝灞灎灤灥灬灮灵灶灾炁炅炆炔",
			4,
			"炛炤炫炰炱炴炷烊烑烓烔烕烖烘烜烤烺焃",
			4,
			"焋焌焏焞焠焫焭焯焰焱焸煁煅煆煇煊煋煐煒煗煚煜煞煠"
		],
		["8fcaa1", "煨煹熀熅熇熌熒熚熛熠熢熯熰熲熳熺熿燀燁燄燋燌燓燖燙燚燜燸燾爀爇爈爉爓爗爚爝爟爤爫爯爴爸爹牁牂牃牅牎牏牐牓牕牖牚牜牞牠牣牨牫牮牯牱牷牸牻牼牿犄犉犍犎犓犛犨犭犮犱犴犾狁狇狉狌狕狖狘狟狥狳狴狺狻"],
		["8fcba1", "狾猂猄猅猇猋猍猒猓猘猙猞猢猤猧猨猬猱猲猵猺猻猽獃獍獐獒獖獘獝獞獟獠獦獧獩獫獬獮獯獱獷獹獼玀玁玃玅玆玎玐玓玕玗玘玜玞玟玠玢玥玦玪玫玭玵玷玹玼玽玿珅珆珉珋珌珏珒珓珖珙珝珡珣珦珧珩珴珵珷珹珺珻珽"],
		[
			"8fcca1",
			"珿琀琁琄琇琊琑琚琛琤琦琨",
			9,
			"琹瑀瑃瑄瑆瑇瑋瑍瑑瑒瑗瑝瑢瑦瑧瑨瑫瑭瑮瑱瑲璀璁璅璆璇璉璏璐璑璒璘璙璚璜璟璠璡璣璦璨璩璪璫璮璯璱璲璵璹璻璿瓈瓉瓌瓐瓓瓘瓚瓛瓞瓟瓤瓨瓪瓫瓯瓴瓺瓻瓼瓿甆"
		],
		[
			"8fcda1",
			"甒甖甗甠甡甤甧甩甪甯甶甹甽甾甿畀畃畇畈畎畐畒畗畞畟畡畯畱畹",
			5,
			"疁疅疐疒疓疕疙疜疢疤疴疺疿痀痁痄痆痌痎痏痗痜痟痠痡痤痧痬痮痯痱痹瘀瘂瘃瘄瘇瘈瘊瘌瘏瘒瘓瘕瘖瘙瘛瘜瘝瘞瘣瘥瘦瘩瘭瘲瘳瘵瘸瘹"
		],
		[
			"8fcea1",
			"瘺瘼癊癀癁癃癄癅癉癋癕癙癟癤癥癭癮癯癱癴皁皅皌皍皕皛皜皝皟皠皢",
			6,
			"皪皭皽盁盅盉盋盌盎盔盙盠盦盨盬盰盱盶盹盼眀眆眊眎眒眔眕眗眙眚眜眢眨眭眮眯眴眵眶眹眽眾睂睅睆睊睍睎睏睒睖睗睜睞睟睠睢"
		],
		["8fcfa1", "睤睧睪睬睰睲睳睴睺睽瞀瞄瞌瞍瞔瞕瞖瞚瞟瞢瞧瞪瞮瞯瞱瞵瞾矃矉矑矒矕矙矞矟矠矤矦矪矬矰矱矴矸矻砅砆砉砍砎砑砝砡砢砣砭砮砰砵砷硃硄硇硈硌硎硒硜硞硠硡硣硤硨硪确硺硾碊碏碔碘碡碝碞碟碤碨碬碭碰碱碲碳"],
		["8fd0a1", "碻碽碿磇磈磉磌磎磒磓磕磖磤磛磟磠磡磦磪磲磳礀磶磷磺磻磿礆礌礐礚礜礞礟礠礥礧礩礭礱礴礵礻礽礿祄祅祆祊祋祏祑祔祘祛祜祧祩祫祲祹祻祼祾禋禌禑禓禔禕禖禘禛禜禡禨禩禫禯禱禴禸离秂秄秇秈秊秏秔秖秚秝秞"],
		["8fd1a1", "秠秢秥秪秫秭秱秸秼稂稃稇稉稊稌稑稕稛稞稡稧稫稭稯稰稴稵稸稹稺穄穅穇穈穌穕穖穙穜穝穟穠穥穧穪穭穵穸穾窀窂窅窆窊窋窐窑窔窞窠窣窬窳窵窹窻窼竆竉竌竎竑竛竨竩竫竬竱竴竻竽竾笇笔笟笣笧笩笪笫笭笮笯笰"],
		[
			"8fd2a1",
			"笱笴笽笿筀筁筇筎筕筠筤筦筩筪筭筯筲筳筷箄箉箎箐箑箖箛箞箠箥箬箯箰箲箵箶箺箻箼箽篂篅篈篊篔篖篗篙篚篛篨篪篲篴篵篸篹篺篼篾簁簂簃簄簆簉簋簌簎簏簙簛簠簥簦簨簬簱簳簴簶簹簺籆籊籕籑籒籓籙",
			5
		],
		["8fd3a1", "籡籣籧籩籭籮籰籲籹籼籽粆粇粏粔粞粠粦粰粶粷粺粻粼粿糄糇糈糉糍糏糓糔糕糗糙糚糝糦糩糫糵紃紇紈紉紏紑紒紓紖紝紞紣紦紪紭紱紼紽紾絀絁絇絈絍絑絓絗絙絚絜絝絥絧絪絰絸絺絻絿綁綂綃綅綆綈綋綌綍綑綖綗綝"],
		[
			"8fd4a1",
			"綞綦綧綪綳綶綷綹緂",
			4,
			"緌緍緎緗緙縀緢緥緦緪緫緭緱緵緶緹緺縈縐縑縕縗縜縝縠縧縨縬縭縯縳縶縿繄繅繇繎繐繒繘繟繡繢繥繫繮繯繳繸繾纁纆纇纊纍纑纕纘纚纝纞缼缻缽缾缿罃罄罇罏罒罓罛罜罝罡罣罤罥罦罭"
		],
		["8fd5a1", "罱罽罾罿羀羋羍羏羐羑羖羗羜羡羢羦羪羭羴羼羿翀翃翈翎翏翛翟翣翥翨翬翮翯翲翺翽翾翿耇耈耊耍耎耏耑耓耔耖耝耞耟耠耤耦耬耮耰耴耵耷耹耺耼耾聀聄聠聤聦聭聱聵肁肈肎肜肞肦肧肫肸肹胈胍胏胒胔胕胗胘胠胭胮"],
		["8fd6a1", "胰胲胳胶胹胺胾脃脋脖脗脘脜脞脠脤脧脬脰脵脺脼腅腇腊腌腒腗腠腡腧腨腩腭腯腷膁膐膄膅膆膋膎膖膘膛膞膢膮膲膴膻臋臃臅臊臎臏臕臗臛臝臞臡臤臫臬臰臱臲臵臶臸臹臽臿舀舃舏舓舔舙舚舝舡舢舨舲舴舺艃艄艅艆"],
		["8fd7a1", "艋艎艏艑艖艜艠艣艧艭艴艻艽艿芀芁芃芄芇芉芊芎芑芔芖芘芚芛芠芡芣芤芧芨芩芪芮芰芲芴芷芺芼芾芿苆苐苕苚苠苢苤苨苪苭苯苶苷苽苾茀茁茇茈茊茋荔茛茝茞茟茡茢茬茭茮茰茳茷茺茼茽荂荃荄荇荍荎荑荕荖荗荰荸"],
		["8fd8a1", "荽荿莀莂莄莆莍莒莔莕莘莙莛莜莝莦莧莩莬莾莿菀菇菉菏菐菑菔菝荓菨菪菶菸菹菼萁萆萊萏萑萕萙莭萯萹葅葇葈葊葍葏葑葒葖葘葙葚葜葠葤葥葧葪葰葳葴葶葸葼葽蒁蒅蒒蒓蒕蒞蒦蒨蒩蒪蒯蒱蒴蒺蒽蒾蓀蓂蓇蓈蓌蓏蓓"],
		[
			"8fd9a1",
			"蓜蓧蓪蓯蓰蓱蓲蓷蔲蓺蓻蓽蔂蔃蔇蔌蔎蔐蔜蔞蔢蔣蔤蔥蔧蔪蔫蔯蔳蔴蔶蔿蕆蕏",
			4,
			"蕖蕙蕜",
			6,
			"蕤蕫蕯蕹蕺蕻蕽蕿薁薅薆薉薋薌薏薓薘薝薟薠薢薥薧薴薶薷薸薼薽薾薿藂藇藊藋藎薭藘藚藟藠藦藨藭藳藶藼"
		],
		[
			"8fdaa1",
			"藿蘀蘄蘅蘍蘎蘐蘑蘒蘘蘙蘛蘞蘡蘧蘩蘶蘸蘺蘼蘽虀虂虆虒虓虖虗虘虙虝虠",
			4,
			"虩虬虯虵虶虷虺蚍蚑蚖蚘蚚蚜蚡蚦蚧蚨蚭蚱蚳蚴蚵蚷蚸蚹蚿蛀蛁蛃蛅蛑蛒蛕蛗蛚蛜蛠蛣蛥蛧蚈蛺蛼蛽蜄蜅蜇蜋蜎蜏蜐蜓蜔蜙蜞蜟蜡蜣"
		],
		[
			"8fdba1",
			"蜨蜮蜯蜱蜲蜹蜺蜼蜽蜾蝀蝃蝅蝍蝘蝝蝡蝤蝥蝯蝱蝲蝻螃",
			6,
			"螋螌螐螓螕螗螘螙螞螠螣螧螬螭螮螱螵螾螿蟁蟈蟉蟊蟎蟕蟖蟙蟚蟜蟟蟢蟣蟤蟪蟫蟭蟱蟳蟸蟺蟿蠁蠃蠆蠉蠊蠋蠐蠙蠒蠓蠔蠘蠚蠛蠜蠞蠟蠨蠭蠮蠰蠲蠵"
		],
		[
			"8fdca1",
			"蠺蠼衁衃衅衈衉衊衋衎衑衕衖衘衚衜衟衠衤衩衱衹衻袀袘袚袛袜袟袠袨袪袺袽袾裀裊",
			4,
			"裑裒裓裛裞裧裯裰裱裵裷褁褆褍褎褏褕褖褘褙褚褜褠褦褧褨褰褱褲褵褹褺褾襀襂襅襆襉襏襒襗襚襛襜襡襢襣襫襮襰襳襵襺"
		],
		[
			"8fdda1",
			"襻襼襽覉覍覐覔覕覛覜覟覠覥覰覴覵覶覷覼觔",
			4,
			"觥觩觫觭觱觳觶觹觽觿訄訅訇訏訑訒訔訕訞訠訢訤訦訫訬訯訵訷訽訾詀詃詅詇詉詍詎詓詖詗詘詜詝詡詥詧詵詶詷詹詺詻詾詿誀誃誆誋誏誐誒誖誗誙誟誧誩誮誯誳"
		],
		[
			"8fdea1",
			"誶誷誻誾諃諆諈諉諊諑諓諔諕諗諝諟諬諰諴諵諶諼諿謅謆謋謑謜謞謟謊謭謰謷謼譂",
			4,
			"譈譒譓譔譙譍譞譣譭譶譸譹譼譾讁讄讅讋讍讏讔讕讜讞讟谸谹谽谾豅豇豉豋豏豑豓豔豗豘豛豝豙豣豤豦豨豩豭豳豵豶豻豾貆"
		],
		["8fdfa1", "貇貋貐貒貓貙貛貜貤貹貺賅賆賉賋賏賖賕賙賝賡賨賬賯賰賲賵賷賸賾賿贁贃贉贒贗贛赥赩赬赮赿趂趄趈趍趐趑趕趞趟趠趦趫趬趯趲趵趷趹趻跀跅跆跇跈跊跎跑跔跕跗跙跤跥跧跬跰趼跱跲跴跽踁踄踅踆踋踑踔踖踠踡踢"],
		["8fe0a1", "踣踦踧踱踳踶踷踸踹踽蹀蹁蹋蹍蹎蹏蹔蹛蹜蹝蹞蹡蹢蹩蹬蹭蹯蹰蹱蹹蹺蹻躂躃躉躐躒躕躚躛躝躞躢躧躩躭躮躳躵躺躻軀軁軃軄軇軏軑軔軜軨軮軰軱軷軹軺軭輀輂輇輈輏輐輖輗輘輞輠輡輣輥輧輨輬輭輮輴輵輶輷輺轀轁"],
		[
			"8fe1a1",
			"轃轇轏轑",
			4,
			"轘轝轞轥辝辠辡辤辥辦辵辶辸达迀迁迆迊迋迍运迒迓迕迠迣迤迨迮迱迵迶迻迾适逄逈逌逘逛逨逩逯逪逬逭逳逴逷逿遃遄遌遛遝遢遦遧遬遰遴遹邅邈邋邌邎邐邕邗邘邙邛邠邡邢邥邰邲邳邴邶邽郌邾郃"
		],
		["8fe2a1", "郄郅郇郈郕郗郘郙郜郝郟郥郒郶郫郯郰郴郾郿鄀鄄鄅鄆鄈鄍鄐鄔鄖鄗鄘鄚鄜鄞鄠鄥鄢鄣鄧鄩鄮鄯鄱鄴鄶鄷鄹鄺鄼鄽酃酇酈酏酓酗酙酚酛酡酤酧酭酴酹酺酻醁醃醅醆醊醎醑醓醔醕醘醞醡醦醨醬醭醮醰醱醲醳醶醻醼醽醿"],
		[
			"8fe3a1",
			"釂釃釅釓釔釗釙釚釞釤釥釩釪釬",
			5,
			"釷釹釻釽鈀鈁鈄鈅鈆鈇鈉鈊鈌鈐鈒鈓鈖鈘鈜鈝鈣鈤鈥鈦鈨鈮鈯鈰鈳鈵鈶鈸鈹鈺鈼鈾鉀鉂鉃鉆鉇鉊鉍鉎鉏鉑鉘鉙鉜鉝鉠鉡鉥鉧鉨鉩鉮鉯鉰鉵",
			4,
			"鉻鉼鉽鉿銈銉銊銍銎銒銗"
		],
		[
			"8fe4a1",
			"銙銟銠銤銥銧銨銫銯銲銶銸銺銻銼銽銿",
			4,
			"鋅鋆鋇鋈鋋鋌鋍鋎鋐鋓鋕鋗鋘鋙鋜鋝鋟鋠鋡鋣鋥鋧鋨鋬鋮鋰鋹鋻鋿錀錂錈錍錑錔錕錜錝錞錟錡錤錥錧錩錪錳錴錶錷鍇鍈鍉鍐鍑鍒鍕鍗鍘鍚鍞鍤鍥鍧鍩鍪鍭鍯鍰鍱鍳鍴鍶"
		],
		[
			"8fe5a1",
			"鍺鍽鍿鎀鎁鎂鎈鎊鎋鎍鎏鎒鎕鎘鎛鎞鎡鎣鎤鎦鎨鎫鎴鎵鎶鎺鎩鏁鏄鏅鏆鏇鏉",
			4,
			"鏓鏙鏜鏞鏟鏢鏦鏧鏹鏷鏸鏺鏻鏽鐁鐂鐄鐈鐉鐍鐎鐏鐕鐖鐗鐟鐮鐯鐱鐲鐳鐴鐻鐿鐽鑃鑅鑈鑊鑌鑕鑙鑜鑟鑡鑣鑨鑫鑭鑮鑯鑱鑲钄钃镸镹"
		],
		["8fe6a1", "镾閄閈閌閍閎閝閞閟閡閦閩閫閬閴閶閺閽閿闆闈闉闋闐闑闒闓闙闚闝闞闟闠闤闦阝阞阢阤阥阦阬阱阳阷阸阹阺阼阽陁陒陔陖陗陘陡陮陴陻陼陾陿隁隂隃隄隉隑隖隚隝隟隤隥隦隩隮隯隳隺雊雒嶲雘雚雝雞雟雩雯雱雺霂"],
		["8fe7a1", "霃霅霉霚霛霝霡霢霣霨霱霳靁靃靊靎靏靕靗靘靚靛靣靧靪靮靳靶靷靸靻靽靿鞀鞉鞕鞖鞗鞙鞚鞞鞟鞢鞬鞮鞱鞲鞵鞶鞸鞹鞺鞼鞾鞿韁韄韅韇韉韊韌韍韎韐韑韔韗韘韙韝韞韠韛韡韤韯韱韴韷韸韺頇頊頙頍頎頔頖頜頞頠頣頦"],
		[
			"8fe8a1",
			"頫頮頯頰頲頳頵頥頾顄顇顊顑顒顓顖顗顙顚顢顣顥顦顪顬颫颭颮颰颴颷颸颺颻颿飂飅飈飌飡飣飥飦飧飪飳飶餂餇餈餑餕餖餗餚餛餜餟餢餦餧餫餱",
			4,
			"餹餺餻餼饀饁饆饇饈饍饎饔饘饙饛饜饞饟饠馛馝馟馦馰馱馲馵"
		],
		[
			"8fe9a1",
			"馹馺馽馿駃駉駓駔駙駚駜駞駧駪駫駬駰駴駵駹駽駾騂騃騄騋騌騐騑騖騞騠騢騣騤騧騭騮騳騵騶騸驇驁驄驊驋驌驎驑驔驖驝骪骬骮骯骲骴骵骶骹骻骾骿髁髃髆髈髎髐髒髕髖髗髛髜髠髤髥髧髩髬髲髳髵髹髺髽髿",
			4
		],
		[
			"8feaa1",
			"鬄鬅鬈鬉鬋鬌鬍鬎鬐鬒鬖鬙鬛鬜鬠鬦鬫鬭鬳鬴鬵鬷鬹鬺鬽魈魋魌魕魖魗魛魞魡魣魥魦魨魪",
			4,
			"魳魵魷魸魹魿鮀鮄鮅鮆鮇鮉鮊鮋鮍鮏鮐鮔鮚鮝鮞鮦鮧鮩鮬鮰鮱鮲鮷鮸鮻鮼鮾鮿鯁鯇鯈鯎鯐鯗鯘鯝鯟鯥鯧鯪鯫鯯鯳鯷鯸"
		],
		[
			"8feba1",
			"鯹鯺鯽鯿鰀鰂鰋鰏鰑鰖鰘鰙鰚鰜鰞鰢鰣鰦",
			4,
			"鰱鰵鰶鰷鰽鱁鱃鱄鱅鱉鱊鱎鱏鱐鱓鱔鱖鱘鱛鱝鱞鱟鱣鱩鱪鱜鱫鱨鱮鱰鱲鱵鱷鱻鳦鳲鳷鳹鴋鴂鴑鴗鴘鴜鴝鴞鴯鴰鴲鴳鴴鴺鴼鵅鴽鵂鵃鵇鵊鵓鵔鵟鵣鵢鵥鵩鵪鵫鵰鵶鵷鵻"
		],
		["8feca1", "鵼鵾鶃鶄鶆鶊鶍鶎鶒鶓鶕鶖鶗鶘鶡鶪鶬鶮鶱鶵鶹鶼鶿鷃鷇鷉鷊鷔鷕鷖鷗鷚鷞鷟鷠鷥鷧鷩鷫鷮鷰鷳鷴鷾鸊鸂鸇鸎鸐鸑鸒鸕鸖鸙鸜鸝鹺鹻鹼麀麂麃麄麅麇麎麏麖麘麛麞麤麨麬麮麯麰麳麴麵黆黈黋黕黟黤黧黬黭黮黰黱黲黵"],
		[
			"8feda1",
			"黸黿鼂鼃鼉鼏鼐鼑鼒鼔鼖鼗鼙鼚鼛鼟鼢鼦鼪鼫鼯鼱鼲鼴鼷鼹鼺鼼鼽鼿齁齃",
			4,
			"齓齕齖齗齘齚齝齞齨齩齭",
			4,
			"齳齵齺齽龏龐龑龒龔龖龗龞龡龢龣龥"
		]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp936.json
var require_cp936 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp936.json": ((exports, module) => {
	module.exports = [
		[
			"0",
			"\0",
			127,
			"€"
		],
		[
			"8140",
			"丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪",
			5,
			"乲乴",
			9,
			"乿",
			6,
			"亇亊"
		],
		[
			"8180",
			"亐亖亗亙亜亝亞亣亪亯亰亱亴亶亷亸亹亼亽亾仈仌仏仐仒仚仛仜仠仢仦仧仩仭仮仯仱仴仸仹仺仼仾伀伂",
			6,
			"伋伌伒",
			4,
			"伜伝伡伣伨伩伬伭伮伱伳伵伷伹伻伾",
			4,
			"佄佅佇",
			5,
			"佒佔佖佡佢佦佨佪佫佭佮佱佲併佷佸佹佺佽侀侁侂侅來侇侊侌侎侐侒侓侕侖侘侙侚侜侞侟価侢"
		],
		[
			"8240",
			"侤侫侭侰",
			4,
			"侶",
			8,
			"俀俁係俆俇俈俉俋俌俍俒",
			4,
			"俙俛俠俢俤俥俧俫俬俰俲俴俵俶俷俹俻俼俽俿",
			11
		],
		[
			"8280",
			"個倎倐們倓倕倖倗倛倝倞倠倢倣値倧倫倯",
			10,
			"倻倽倿偀偁偂偄偅偆偉偊偋偍偐",
			4,
			"偖偗偘偙偛偝",
			7,
			"偦",
			5,
			"偭",
			8,
			"偸偹偺偼偽傁傂傃傄傆傇傉傊傋傌傎",
			20,
			"傤傦傪傫傭",
			4,
			"傳",
			6,
			"傼"
		],
		[
			"8340",
			"傽",
			17,
			"僐",
			5,
			"僗僘僙僛",
			10,
			"僨僩僪僫僯僰僱僲僴僶",
			4,
			"僼",
			9,
			"儈"
		],
		[
			"8380",
			"儉儊儌",
			5,
			"儓",
			13,
			"儢",
			28,
			"兂兇兊兌兎兏児兒兓兗兘兙兛兝",
			4,
			"兣兤兦內兩兪兯兲兺兾兿冃冄円冇冊冋冎冏冐冑冓冔冘冚冝冞冟冡冣冦",
			4,
			"冭冮冴冸冹冺冾冿凁凂凃凅凈凊凍凎凐凒",
			5
		],
		[
			"8440",
			"凘凙凚凜凞凟凢凣凥",
			5,
			"凬凮凱凲凴凷凾刄刅刉刋刌刏刐刓刔刕刜刞刟刡刢刣別刦刧刪刬刯刱刲刴刵刼刾剄",
			5,
			"剋剎剏剒剓剕剗剘"
		],
		[
			"8480",
			"剙剚剛剝剟剠剢剣剤剦剨剫剬剭剮剰剱剳",
			9,
			"剾劀劃",
			4,
			"劉",
			6,
			"劑劒劔",
			6,
			"劜劤劥劦劧劮劯劰労",
			9,
			"勀勁勂勄勅勆勈勊勌勍勎勏勑勓勔動勗務",
			5,
			"勠勡勢勣勥",
			10,
			"勱",
			7,
			"勻勼勽匁匂匃匄匇匉匊匋匌匎"
		],
		[
			"8540",
			"匑匒匓匔匘匛匜匞匟匢匤匥匧匨匩匫匬匭匯",
			9,
			"匼匽區卂卄卆卋卌卍卐協単卙卛卝卥卨卪卬卭卲卶卹卻卼卽卾厀厁厃厇厈厊厎厏"
		],
		[
			"8580",
			"厐",
			4,
			"厖厗厙厛厜厞厠厡厤厧厪厫厬厭厯",
			6,
			"厷厸厹厺厼厽厾叀參",
			4,
			"収叏叐叒叓叕叚叜叝叞叡叢叧叴叺叾叿吀吂吅吇吋吔吘吙吚吜吢吤吥吪吰吳吶吷吺吽吿呁呂呄呅呇呉呌呍呎呏呑呚呝",
			4,
			"呣呥呧呩",
			7,
			"呴呹呺呾呿咁咃咅咇咈咉咊咍咑咓咗咘咜咞咟咠咡"
		],
		[
			"8640",
			"咢咥咮咰咲咵咶咷咹咺咼咾哃哅哊哋哖哘哛哠",
			4,
			"哫哬哯哰哱哴",
			5,
			"哻哾唀唂唃唄唅唈唊",
			4,
			"唒唓唕",
			5,
			"唜唝唞唟唡唥唦"
		],
		[
			"8680",
			"唨唩唫唭唲唴唵唶唸唹唺唻唽啀啂啅啇啈啋",
			4,
			"啑啒啓啔啗",
			4,
			"啝啞啟啠啢啣啨啩啫啯",
			5,
			"啹啺啽啿喅喆喌喍喎喐喒喓喕喖喗喚喛喞喠",
			6,
			"喨",
			8,
			"喲喴営喸喺喼喿",
			4,
			"嗆嗇嗈嗊嗋嗎嗏嗐嗕嗗",
			4,
			"嗞嗠嗢嗧嗩嗭嗮嗰嗱嗴嗶嗸",
			4,
			"嗿嘂嘃嘄嘅"
		],
		[
			"8740",
			"嘆嘇嘊嘋嘍嘐",
			7,
			"嘙嘚嘜嘝嘠嘡嘢嘥嘦嘨嘩嘪嘫嘮嘯嘰嘳嘵嘷嘸嘺嘼嘽嘾噀",
			11,
			"噏",
			4,
			"噕噖噚噛噝",
			4
		],
		[
			"8780",
			"噣噥噦噧噭噮噯噰噲噳噴噵噷噸噹噺噽",
			7,
			"嚇",
			6,
			"嚐嚑嚒嚔",
			14,
			"嚤",
			10,
			"嚰",
			6,
			"嚸嚹嚺嚻嚽",
			12,
			"囋",
			8,
			"囕囖囘囙囜団囥",
			5,
			"囬囮囯囲図囶囷囸囻囼圀圁圂圅圇國",
			6
		],
		[
			"8840",
			"園",
			9,
			"圝圞圠圡圢圤圥圦圧圫圱圲圴",
			4,
			"圼圽圿坁坃坄坅坆坈坉坋坒",
			4,
			"坘坙坢坣坥坧坬坮坰坱坲坴坵坸坹坺坽坾坿垀"
		],
		[
			"8880",
			"垁垇垈垉垊垍",
			4,
			"垔",
			6,
			"垜垝垞垟垥垨垪垬垯垰垱垳垵垶垷垹",
			8,
			"埄",
			6,
			"埌埍埐埑埓埖埗埛埜埞埡埢埣埥",
			7,
			"埮埰埱埲埳埵埶執埻埼埾埿堁堃堄堅堈堉堊堌堎堏堐堒堓堔堖堗堘堚堛堜堝堟堢堣堥",
			4,
			"堫",
			4,
			"報堲堳場堶",
			7
		],
		[
			"8940",
			"堾",
			5,
			"塅",
			6,
			"塎塏塐塒塓塕塖塗塙",
			4,
			"塟",
			5,
			"塦",
			4,
			"塭",
			16,
			"塿墂墄墆墇墈墊墋墌"
		],
		[
			"8980",
			"墍",
			4,
			"墔",
			4,
			"墛墜墝墠",
			7,
			"墪",
			17,
			"墽墾墿壀壂壃壄壆",
			10,
			"壒壓壔壖",
			13,
			"壥",
			5,
			"壭壯壱売壴壵壷壸壺",
			7,
			"夃夅夆夈",
			4,
			"夎夐夑夒夓夗夘夛夝夞夠夡夢夣夦夨夬夰夲夳夵夶夻"
		],
		[
			"8a40",
			"夽夾夿奀奃奅奆奊奌奍奐奒奓奙奛",
			4,
			"奡奣奤奦",
			12,
			"奵奷奺奻奼奾奿妀妅妉妋妌妎妏妐妑妔妕妘妚妛妜妝妟妠妡妢妦"
		],
		[
			"8a80",
			"妧妬妭妰妱妳",
			5,
			"妺妼妽妿",
			6,
			"姇姈姉姌姍姎姏姕姖姙姛姞",
			4,
			"姤姦姧姩姪姫姭",
			11,
			"姺姼姽姾娀娂娊娋娍娎娏娐娒娔娕娖娗娙娚娛娝娞娡娢娤娦娧娨娪",
			6,
			"娳娵娷",
			4,
			"娽娾娿婁",
			4,
			"婇婈婋",
			9,
			"婖婗婘婙婛",
			5
		],
		[
			"8b40",
			"婡婣婤婥婦婨婩婫",
			8,
			"婸婹婻婼婽婾媀",
			17,
			"媓",
			6,
			"媜",
			13,
			"媫媬"
		],
		[
			"8b80",
			"媭",
			4,
			"媴媶媷媹",
			4,
			"媿嫀嫃",
			5,
			"嫊嫋嫍",
			4,
			"嫓嫕嫗嫙嫚嫛嫝嫞嫟嫢嫤嫥嫧嫨嫪嫬",
			4,
			"嫲",
			22,
			"嬊",
			11,
			"嬘",
			25,
			"嬳嬵嬶嬸",
			7,
			"孁",
			6
		],
		[
			"8c40",
			"孈",
			7,
			"孒孖孞孠孡孧孨孫孭孮孯孲孴孶孷學孹孻孼孾孿宂宆宊宍宎宐宑宒宔宖実宧宨宩宬宭宮宯宱宲宷宺宻宼寀寁寃寈寉寊寋寍寎寏"
		],
		[
			"8c80",
			"寑寔",
			8,
			"寠寢寣實寧審",
			4,
			"寯寱",
			6,
			"寽対尀専尃尅將專尋尌對導尐尒尓尗尙尛尞尟尠尡尣尦尨尩尪尫尭尮尯尰尲尳尵尶尷屃屄屆屇屌屍屒屓屔屖屗屘屚屛屜屝屟屢層屧",
			6,
			"屰屲",
			6,
			"屻屼屽屾岀岃",
			4,
			"岉岊岋岎岏岒岓岕岝",
			4,
			"岤",
			4
		],
		[
			"8d40",
			"岪岮岯岰岲岴岶岹岺岻岼岾峀峂峃峅",
			5,
			"峌",
			5,
			"峓",
			5,
			"峚",
			6,
			"峢峣峧峩峫峬峮峯峱",
			9,
			"峼",
			4
		],
		[
			"8d80",
			"崁崄崅崈",
			5,
			"崏",
			4,
			"崕崗崘崙崚崜崝崟",
			4,
			"崥崨崪崫崬崯",
			4,
			"崵",
			7,
			"崿",
			7,
			"嵈嵉嵍",
			10,
			"嵙嵚嵜嵞",
			10,
			"嵪嵭嵮嵰嵱嵲嵳嵵",
			12,
			"嶃",
			21,
			"嶚嶛嶜嶞嶟嶠"
		],
		[
			"8e40",
			"嶡",
			21,
			"嶸",
			12,
			"巆",
			6,
			"巎",
			12,
			"巜巟巠巣巤巪巬巭"
		],
		[
			"8e80",
			"巰巵巶巸",
			4,
			"巿帀帄帇帉帊帋帍帎帒帓帗帞",
			7,
			"帨",
			4,
			"帯帰帲",
			4,
			"帹帺帾帿幀幁幃幆",
			5,
			"幍",
			6,
			"幖",
			4,
			"幜幝幟幠幣",
			14,
			"幵幷幹幾庁庂広庅庈庉庌庍庎庒庘庛庝庡庢庣庤庨",
			4,
			"庮",
			4,
			"庴庺庻庼庽庿",
			6
		],
		[
			"8f40",
			"廆廇廈廋",
			5,
			"廔廕廗廘廙廚廜",
			11,
			"廩廫",
			8,
			"廵廸廹廻廼廽弅弆弇弉弌弍弎弐弒弔弖弙弚弜弝弞弡弢弣弤"
		],
		[
			"8f80",
			"弨弫弬弮弰弲",
			6,
			"弻弽弾弿彁",
			14,
			"彑彔彙彚彛彜彞彟彠彣彥彧彨彫彮彯彲彴彵彶彸彺彽彾彿徃徆徍徎徏徑従徔徖徚徛徝從徟徠徢",
			5,
			"復徫徬徯",
			5,
			"徶徸徹徺徻徾",
			4,
			"忇忈忊忋忎忓忔忕忚忛応忞忟忢忣忥忦忨忩忬忯忰忲忳忴忶忷忹忺忼怇"
		],
		[
			"9040",
			"怈怉怋怌怐怑怓怗怘怚怞怟怢怣怤怬怭怮怰",
			4,
			"怶",
			4,
			"怽怾恀恄",
			6,
			"恌恎恏恑恓恔恖恗恘恛恜恞恟恠恡恥恦恮恱恲恴恵恷恾悀"
		],
		[
			"9080",
			"悁悂悅悆悇悈悊悋悎悏悐悑悓悕悗悘悙悜悞悡悢悤悥悧悩悪悮悰悳悵悶悷悹悺悽",
			7,
			"惇惈惉惌",
			4,
			"惒惓惔惖惗惙惛惞惡",
			4,
			"惪惱惲惵惷惸惻",
			4,
			"愂愃愄愅愇愊愋愌愐",
			4,
			"愖愗愘愙愛愜愝愞愡愢愥愨愩愪愬",
			18,
			"慀",
			6
		],
		[
			"9140",
			"慇慉態慍慏慐慒慓慔慖",
			6,
			"慞慟慠慡慣慤慥慦慩",
			6,
			"慱慲慳慴慶慸",
			18,
			"憌憍憏",
			4,
			"憕"
		],
		[
			"9180",
			"憖",
			6,
			"憞",
			8,
			"憪憫憭",
			9,
			"憸",
			5,
			"憿懀懁懃",
			4,
			"應懌",
			4,
			"懓懕",
			16,
			"懧",
			13,
			"懶",
			8,
			"戀",
			5,
			"戇戉戓戔戙戜戝戞戠戣戦戧戨戩戫戭戯戰戱戲戵戶戸",
			4,
			"扂扄扅扆扊"
		],
		[
			"9240",
			"扏扐払扖扗扙扚扜",
			6,
			"扤扥扨扱扲扴扵扷扸扺扻扽抁抂抃抅抆抇抈抋",
			5,
			"抔抙抜抝択抣抦抧抩抪抭抮抯抰抲抳抴抶抷抸抺抾拀拁"
		],
		[
			"9280",
			"拃拋拏拑拕拝拞拠拡拤拪拫拰拲拵拸拹拺拻挀挃挄挅挆挊挋挌挍挏挐挒挓挔挕挗挘挙挜挦挧挩挬挭挮挰挱挳",
			5,
			"挻挼挾挿捀捁捄捇捈捊捑捒捓捔捖",
			7,
			"捠捤捥捦捨捪捫捬捯捰捲捳捴捵捸捹捼捽捾捿掁掃掄掅掆掋掍掑掓掔掕掗掙",
			6,
			"採掤掦掫掯掱掲掵掶掹掻掽掿揀"
		],
		[
			"9340",
			"揁揂揃揅揇揈揊揋揌揑揓揔揕揗",
			6,
			"揟揢揤",
			4,
			"揫揬揮揯揰揱揳揵揷揹揺揻揼揾搃搄搆",
			4,
			"損搎搑搒搕",
			5,
			"搝搟搢搣搤"
		],
		[
			"9380",
			"搥搧搨搩搫搮",
			5,
			"搵",
			4,
			"搻搼搾摀摂摃摉摋",
			6,
			"摓摕摖摗摙",
			4,
			"摟",
			7,
			"摨摪摫摬摮",
			9,
			"摻",
			6,
			"撃撆撈",
			8,
			"撓撔撗撘撚撛撜撝撟",
			4,
			"撥撦撧撨撪撫撯撱撲撳撴撶撹撻撽撾撿擁擃擄擆",
			6,
			"擏擑擓擔擕擖擙據"
		],
		[
			"9440",
			"擛擜擝擟擠擡擣擥擧",
			24,
			"攁",
			7,
			"攊",
			7,
			"攓",
			4,
			"攙",
			8
		],
		[
			"9480",
			"攢攣攤攦",
			4,
			"攬攭攰攱攲攳攷攺攼攽敀",
			4,
			"敆敇敊敋敍敎敐敒敓敔敗敘敚敜敟敠敡敤敥敧敨敩敪敭敮敯敱敳敵敶數",
			14,
			"斈斉斊斍斎斏斒斔斕斖斘斚斝斞斠斢斣斦斨斪斬斮斱",
			7,
			"斺斻斾斿旀旂旇旈旉旊旍旐旑旓旔旕旘",
			7,
			"旡旣旤旪旫"
		],
		[
			"9540",
			"旲旳旴旵旸旹旻",
			4,
			"昁昄昅昇昈昉昋昍昐昑昒昖昗昘昚昛昜昞昡昢昣昤昦昩昪昫昬昮昰昲昳昷",
			4,
			"昽昿晀時晄",
			6,
			"晍晎晐晑晘"
		],
		[
			"9580",
			"晙晛晜晝晞晠晢晣晥晧晩",
			4,
			"晱晲晳晵晸晹晻晼晽晿暀暁暃暅暆暈暉暊暋暍暎暏暐暒暓暔暕暘",
			4,
			"暞",
			8,
			"暩",
			4,
			"暯",
			4,
			"暵暶暷暸暺暻暼暽暿",
			25,
			"曚曞",
			7,
			"曧曨曪",
			5,
			"曱曵曶書曺曻曽朁朂會"
		],
		[
			"9640",
			"朄朅朆朇朌朎朏朑朒朓朖朘朙朚朜朞朠",
			5,
			"朧朩朮朰朲朳朶朷朸朹朻朼朾朿杁杄杅杇杊杋杍杒杔杕杗",
			4,
			"杝杢杣杤杦杧杫杬杮東杴杶"
		],
		[
			"9680",
			"杸杹杺杻杽枀枂枃枅枆枈枊枌枍枎枏枑枒枓枔枖枙枛枟枠枡枤枦枩枬枮枱枲枴枹",
			7,
			"柂柅",
			9,
			"柕柖柗柛柟柡柣柤柦柧柨柪柫柭柮柲柵",
			7,
			"柾栁栂栃栄栆栍栐栒栔栕栘",
			4,
			"栞栟栠栢",
			6,
			"栫",
			6,
			"栴栵栶栺栻栿桇桋桍桏桒桖",
			5
		],
		[
			"9740",
			"桜桝桞桟桪桬",
			7,
			"桵桸",
			8,
			"梂梄梇",
			7,
			"梐梑梒梔梕梖梘",
			9,
			"梣梤梥梩梪梫梬梮梱梲梴梶梷梸"
		],
		[
			"9780",
			"梹",
			6,
			"棁棃",
			5,
			"棊棌棎棏棐棑棓棔棖棗棙棛",
			4,
			"棡棢棤",
			9,
			"棯棲棳棴棶棷棸棻棽棾棿椀椂椃椄椆",
			4,
			"椌椏椑椓",
			11,
			"椡椢椣椥",
			7,
			"椮椯椱椲椳椵椶椷椸椺椻椼椾楀楁楃",
			16,
			"楕楖楘楙楛楜楟"
		],
		[
			"9840",
			"楡楢楤楥楧楨楩楪楬業楯楰楲",
			4,
			"楺楻楽楾楿榁榃榅榊榋榌榎",
			5,
			"榖榗榙榚榝",
			9,
			"榩榪榬榮榯榰榲榳榵榶榸榹榺榼榽"
		],
		[
			"9880",
			"榾榿槀槂",
			7,
			"構槍槏槑槒槓槕",
			5,
			"槜槝槞槡",
			11,
			"槮槯槰槱槳",
			9,
			"槾樀",
			9,
			"樋",
			11,
			"標",
			5,
			"樠樢",
			5,
			"権樫樬樭樮樰樲樳樴樶",
			6,
			"樿",
			4,
			"橅橆橈",
			7,
			"橑",
			6,
			"橚"
		],
		[
			"9940",
			"橜",
			4,
			"橢橣橤橦",
			10,
			"橲",
			6,
			"橺橻橽橾橿檁檂檃檅",
			8,
			"檏檒",
			4,
			"檘",
			7,
			"檡",
			5
		],
		[
			"9980",
			"檧檨檪檭",
			114,
			"欥欦欨",
			6
		],
		[
			"9a40",
			"欯欰欱欳欴欵欶欸欻欼欽欿歀歁歂歄歅歈歊歋歍",
			11,
			"歚",
			7,
			"歨歩歫",
			13,
			"歺歽歾歿殀殅殈"
		],
		[
			"9a80",
			"殌殎殏殐殑殔殕殗殘殙殜",
			4,
			"殢",
			7,
			"殫",
			7,
			"殶殸",
			6,
			"毀毃毄毆",
			4,
			"毌毎毐毑毘毚毜",
			4,
			"毢",
			7,
			"毬毭毮毰毱毲毴毶毷毸毺毻毼毾",
			6,
			"氈",
			4,
			"氎氒気氜氝氞氠氣氥氫氬氭氱氳氶氷氹氺氻氼氾氿汃汄汅汈汋",
			4,
			"汑汒汓汖汘"
		],
		[
			"9b40",
			"汙汚汢汣汥汦汧汫",
			4,
			"汱汳汵汷汸決汻汼汿沀沄沇沊沋沍沎沑沒沕沖沗沘沚沜沝沞沠沢沨沬沯沰沴沵沶沷沺泀況泂泃泆泇泈泋泍泎泏泑泒泘"
		],
		[
			"9b80",
			"泙泚泜泝泟泤泦泧泩泬泭泲泴泹泿洀洂洃洅洆洈洉洊洍洏洐洑洓洔洕洖洘洜洝洟",
			5,
			"洦洨洩洬洭洯洰洴洶洷洸洺洿浀浂浄浉浌浐浕浖浗浘浛浝浟浡浢浤浥浧浨浫浬浭浰浱浲浳浵浶浹浺浻浽",
			4,
			"涃涄涆涇涊涋涍涏涐涒涖",
			4,
			"涜涢涥涬涭涰涱涳涴涶涷涹",
			5,
			"淁淂淃淈淉淊"
		],
		[
			"9c40",
			"淍淎淏淐淒淓淔淕淗淚淛淜淟淢淣淥淧淨淩淪淭淯淰淲淴淵淶淸淺淽",
			7,
			"渆渇済渉渋渏渒渓渕渘渙減渜渞渟渢渦渧渨渪測渮渰渱渳渵"
		],
		[
			"9c80",
			"渶渷渹渻",
			7,
			"湅",
			7,
			"湏湐湑湒湕湗湙湚湜湝湞湠",
			10,
			"湬湭湯",
			14,
			"満溁溂溄溇溈溊",
			4,
			"溑",
			6,
			"溙溚溛溝溞溠溡溣溤溦溨溩溫溬溭溮溰溳溵溸溹溼溾溿滀滃滄滅滆滈滉滊滌滍滎滐滒滖滘滙滛滜滝滣滧滪",
			5
		],
		[
			"9d40",
			"滰滱滲滳滵滶滷滸滺",
			7,
			"漃漄漅漇漈漊",
			4,
			"漐漑漒漖",
			9,
			"漡漢漣漥漦漧漨漬漮漰漲漴漵漷",
			6,
			"漿潀潁潂"
		],
		[
			"9d80",
			"潃潄潅潈潉潊潌潎",
			9,
			"潙潚潛潝潟潠潡潣潤潥潧",
			5,
			"潯潰潱潳潵潶潷潹潻潽",
			6,
			"澅澆澇澊澋澏",
			12,
			"澝澞澟澠澢",
			4,
			"澨",
			10,
			"澴澵澷澸澺",
			5,
			"濁濃",
			5,
			"濊",
			6,
			"濓",
			10,
			"濟濢濣濤濥"
		],
		[
			"9e40",
			"濦",
			7,
			"濰",
			32,
			"瀒",
			7,
			"瀜",
			6,
			"瀤",
			6
		],
		[
			"9e80",
			"瀫",
			9,
			"瀶瀷瀸瀺",
			17,
			"灍灎灐",
			13,
			"灟",
			11,
			"灮灱灲灳灴灷灹灺灻災炁炂炃炄炆炇炈炋炌炍炏炐炑炓炗炘炚炛炞",
			12,
			"炰炲炴炵炶為炾炿烄烅烆烇烉烋",
			12,
			"烚"
		],
		[
			"9f40",
			"烜烝烞烠烡烢烣烥烪烮烰",
			6,
			"烸烺烻烼烾",
			10,
			"焋",
			4,
			"焑焒焔焗焛",
			10,
			"焧",
			7,
			"焲焳焴"
		],
		[
			"9f80",
			"焵焷",
			13,
			"煆煇煈煉煋煍煏",
			12,
			"煝煟",
			4,
			"煥煩",
			4,
			"煯煰煱煴煵煶煷煹煻煼煾",
			5,
			"熅",
			4,
			"熋熌熍熎熐熑熒熓熕熖熗熚",
			4,
			"熡",
			6,
			"熩熪熫熭",
			5,
			"熴熶熷熸熺",
			8,
			"燄",
			9,
			"燏",
			4
		],
		[
			"a040",
			"燖",
			9,
			"燡燢燣燤燦燨",
			5,
			"燯",
			9,
			"燺",
			11,
			"爇",
			19
		],
		[
			"a080",
			"爛爜爞",
			9,
			"爩爫爭爮爯爲爳爴爺爼爾牀",
			6,
			"牉牊牋牎牏牐牑牓牔牕牗牘牚牜牞牠牣牤牥牨牪牫牬牭牰牱牳牴牶牷牸牻牼牽犂犃犅",
			4,
			"犌犎犐犑犓",
			11,
			"犠",
			11,
			"犮犱犲犳犵犺",
			6,
			"狅狆狇狉狊狋狌狏狑狓狔狕狖狘狚狛"
		],
		[
			"a1a1",
			"　、。·ˉˇ¨〃々—～‖…‘’“”〔〕〈",
			7,
			"〖〗【】±×÷∶∧∨∑∏∪∩∈∷√⊥∥∠⌒⊙∫∮≡≌≈∽∝≠≮≯≤≥∞∵∴♂♀°′″℃＄¤￠￡‰§№☆★○●◎◇◆□■△▲※→←↑↓〓"
		],
		[
			"a2a1",
			"ⅰ",
			9
		],
		[
			"a2b1",
			"⒈",
			19,
			"⑴",
			19,
			"①",
			9
		],
		[
			"a2e5",
			"㈠",
			9
		],
		[
			"a2f1",
			"Ⅰ",
			11
		],
		[
			"a3a1",
			"！＂＃￥％",
			88,
			"￣"
		],
		[
			"a4a1",
			"ぁ",
			82
		],
		[
			"a5a1",
			"ァ",
			85
		],
		[
			"a6a1",
			"Α",
			16,
			"Σ",
			6
		],
		[
			"a6c1",
			"α",
			16,
			"σ",
			6
		],
		["a6e0", "︵︶︹︺︿﹀︽︾﹁﹂﹃﹄"],
		["a6ee", "︻︼︷︸︱"],
		["a6f4", "︳︴"],
		[
			"a7a1",
			"А",
			5,
			"ЁЖ",
			25
		],
		[
			"a7d1",
			"а",
			5,
			"ёж",
			25
		],
		[
			"a840",
			"ˊˋ˙–―‥‵℅℉↖↗↘↙∕∟∣≒≦≧⊿═",
			35,
			"▁",
			6
		],
		[
			"a880",
			"█",
			7,
			"▓▔▕▼▽◢◣◤◥☉⊕〒〝〞"
		],
		["a8a1", "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑ"],
		["a8bd", "ńň"],
		["a8c0", "ɡ"],
		[
			"a8c5",
			"ㄅ",
			36
		],
		[
			"a940",
			"〡",
			8,
			"㊣㎎㎏㎜㎝㎞㎡㏄㏎㏑㏒㏕︰￢￤"
		],
		["a959", "℡㈱"],
		["a95c", "‐"],
		[
			"a960",
			"ー゛゜ヽヾ〆ゝゞ﹉",
			9,
			"﹔﹕﹖﹗﹙",
			8
		],
		[
			"a980",
			"﹢",
			4,
			"﹨﹩﹪﹫"
		],
		["a996", "〇"],
		[
			"a9a4",
			"─",
			75
		],
		[
			"aa40",
			"狜狝狟狢",
			5,
			"狪狫狵狶狹狽狾狿猀猂猄",
			5,
			"猋猌猍猏猐猑猒猔猘猙猚猟猠猣猤猦猧猨猭猯猰猲猳猵猶猺猻猼猽獀",
			8
		],
		[
			"aa80",
			"獉獊獋獌獎獏獑獓獔獕獖獘",
			7,
			"獡",
			10,
			"獮獰獱"
		],
		[
			"ab40",
			"獲",
			11,
			"獿",
			4,
			"玅玆玈玊玌玍玏玐玒玓玔玕玗玘玙玚玜玝玞玠玡玣",
			5,
			"玪玬玭玱玴玵玶玸玹玼玽玾玿珁珃",
			4
		],
		[
			"ab80",
			"珋珌珎珒",
			6,
			"珚珛珜珝珟珡珢珣珤珦珨珪珫珬珮珯珰珱珳",
			4
		],
		[
			"ac40",
			"珸",
			10,
			"琄琇琈琋琌琍琎琑",
			8,
			"琜",
			5,
			"琣琤琧琩琫琭琯琱琲琷",
			4,
			"琽琾琿瑀瑂",
			11
		],
		[
			"ac80",
			"瑎",
			6,
			"瑖瑘瑝瑠",
			12,
			"瑮瑯瑱",
			4,
			"瑸瑹瑺"
		],
		[
			"ad40",
			"瑻瑼瑽瑿璂璄璅璆璈璉璊璌璍璏璑",
			10,
			"璝璟",
			7,
			"璪",
			15,
			"璻",
			12
		],
		[
			"ad80",
			"瓈",
			9,
			"瓓",
			8,
			"瓝瓟瓡瓥瓧",
			6,
			"瓰瓱瓲"
		],
		[
			"ae40",
			"瓳瓵瓸",
			6,
			"甀甁甂甃甅",
			7,
			"甎甐甒甔甕甖甗甛甝甞甠",
			4,
			"甦甧甪甮甴甶甹甼甽甿畁畂畃畄畆畇畉畊畍畐畑畒畓畕畖畗畘"
		],
		[
			"ae80",
			"畝",
			7,
			"畧畨畩畫",
			6,
			"畳畵當畷畺",
			4,
			"疀疁疂疄疅疇"
		],
		[
			"af40",
			"疈疉疊疌疍疎疐疓疕疘疛疜疞疢疦",
			4,
			"疭疶疷疺疻疿痀痁痆痋痌痎痏痐痑痓痗痙痚痜痝痟痠痡痥痩痬痭痮痯痲痳痵痶痷痸痺痻痽痾瘂瘄瘆瘇"
		],
		["af80", "瘈瘉瘋瘍瘎瘏瘑瘒瘓瘔瘖瘚瘜瘝瘞瘡瘣瘧瘨瘬瘮瘯瘱瘲瘶瘷瘹瘺瘻瘽癁療癄"],
		[
			"b040",
			"癅",
			6,
			"癎",
			5,
			"癕癗",
			4,
			"癝癟癠癡癢癤",
			6,
			"癬癭癮癰",
			7,
			"癹発發癿皀皁皃皅皉皊皌皍皏皐皒皔皕皗皘皚皛"
		],
		[
			"b080",
			"皜",
			7,
			"皥",
			8,
			"皯皰皳皵",
			9,
			"盀盁盃啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥"
		],
		[
			"b140",
			"盄盇盉盋盌盓盕盙盚盜盝盞盠",
			4,
			"盦",
			7,
			"盰盳盵盶盷盺盻盽盿眀眂眃眅眆眊県眎",
			10,
			"眛眜眝眞眡眣眤眥眧眪眫"
		],
		[
			"b180",
			"眬眮眰",
			4,
			"眹眻眽眾眿睂睄睅睆睈",
			7,
			"睒",
			7,
			"睜薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳"
		],
		[
			"b240",
			"睝睞睟睠睤睧睩睪睭",
			11,
			"睺睻睼瞁瞂瞃瞆",
			5,
			"瞏瞐瞓",
			11,
			"瞡瞣瞤瞦瞨瞫瞭瞮瞯瞱瞲瞴瞶",
			4
		],
		[
			"b280",
			"瞼瞾矀",
			12,
			"矎",
			8,
			"矘矙矚矝",
			4,
			"矤病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭插叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖"
		],
		[
			"b340",
			"矦矨矪矯矰矱矲矴矵矷矹矺矻矼砃",
			5,
			"砊砋砎砏砐砓砕砙砛砞砠砡砢砤砨砪砫砮砯砱砲砳砵砶砽砿硁硂硃硄硆硈硉硊硋硍硏硑硓硔硘硙硚"
		],
		[
			"b380",
			"硛硜硞",
			11,
			"硯",
			7,
			"硸硹硺硻硽",
			6,
			"场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚"
		],
		[
			"b440",
			"碄碅碆碈碊碋碏碐碒碔碕碖碙碝碞碠碢碤碦碨",
			7,
			"碵碶碷碸確碻碼碽碿磀磂磃磄磆磇磈磌磍磎磏磑磒磓磖磗磘磚",
			9
		],
		[
			"b480",
			"磤磥磦磧磩磪磫磭",
			4,
			"磳磵磶磸磹磻",
			5,
			"礂礃礄礆",
			6,
			"础储矗搐触处揣川穿椽传船喘串疮窗幢床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错搭达答瘩打大呆歹傣戴带殆代贷袋待逮"
		],
		[
			"b540",
			"礍",
			5,
			"礔",
			9,
			"礟",
			4,
			"礥",
			14,
			"礵",
			4,
			"礽礿祂祃祄祅祇祊",
			8,
			"祔祕祘祙祡祣"
		],
		[
			"b580",
			"祤祦祩祪祫祬祮祰",
			6,
			"祹祻",
			4,
			"禂禃禆禇禈禉禋禌禍禎禐禑禒怠耽担丹单郸掸胆旦氮但惮淡诞弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等瞪凳邓堤低滴迪敌笛狄涤翟嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠"
		],
		[
			"b640",
			"禓",
			6,
			"禛",
			11,
			"禨",
			10,
			"禴",
			4,
			"禼禿秂秄秅秇秈秊秌秎秏秐秓秔秖秗秙",
			5,
			"秠秡秢秥秨秪"
		],
		[
			"b680",
			"秬秮秱",
			6,
			"秹秺秼秾秿稁稄稅稇稈稉稊稌稏",
			4,
			"稕稖稘稙稛稜丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二"
		],
		[
			"b740",
			"稝稟稡稢稤",
			14,
			"稴稵稶稸稺稾穀",
			5,
			"穇",
			9,
			"穒",
			4,
			"穘",
			16
		],
		[
			"b780",
			"穩",
			6,
			"穱穲穳穵穻穼穽穾窂窅窇窉窊窋窌窎窏窐窓窔窙窚窛窞窡窢贰发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服"
		],
		[
			"b840",
			"窣窤窧窩窪窫窮",
			4,
			"窴",
			10,
			"竀",
			10,
			"竌",
			9,
			"竗竘竚竛竜竝竡竢竤竧",
			5,
			"竮竰竱竲竳"
		],
		[
			"b880",
			"竴",
			4,
			"竻竼竾笀笁笂笅笇笉笌笍笎笐笒笓笖笗笘笚笜笝笟笡笢笣笧笩笭浮涪福袱弗甫抚辅俯釜斧脯腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹"
		],
		[
			"b940",
			"笯笰笲笴笵笶笷笹笻笽笿",
			5,
			"筆筈筊筍筎筓筕筗筙筜筞筟筡筣",
			10,
			"筯筰筳筴筶筸筺筼筽筿箁箂箃箄箆",
			6,
			"箎箏"
		],
		[
			"b980",
			"箑箒箓箖箘箙箚箛箞箟箠箣箤箥箮箯箰箲箳箵箶箷箹",
			7,
			"篂篃範埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过哈"
		],
		[
			"ba40",
			"篅篈築篊篋篍篎篏篐篒篔",
			4,
			"篛篜篞篟篠篢篣篤篧篨篩篫篬篭篯篰篲",
			4,
			"篸篹篺篻篽篿",
			7,
			"簈簉簊簍簎簐",
			5,
			"簗簘簙"
		],
		[
			"ba80",
			"簚",
			4,
			"簠",
			5,
			"簨簩簫",
			12,
			"簹",
			5,
			"籂骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖"
		],
		[
			"bb40",
			"籃",
			9,
			"籎",
			36,
			"籵",
			5,
			"籾",
			9
		],
		[
			"bb80",
			"粈粊",
			6,
			"粓粔粖粙粚粛粠粡粣粦粧粨粩粫粬粭粯粰粴",
			4,
			"粺粻弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸击圾基机畸稽积箕"
		],
		[
			"bc40",
			"粿糀糂糃糄糆糉糋糎",
			6,
			"糘糚糛糝糞糡",
			6,
			"糩",
			5,
			"糰",
			7,
			"糹糺糼",
			13,
			"紋",
			5
		],
		[
			"bc80",
			"紑",
			14,
			"紡紣紤紥紦紨紩紪紬紭紮細",
			6,
			"肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件"
		],
		[
			"bd40",
			"紷",
			54,
			"絯",
			7
		],
		[
			"bd80",
			"絸",
			32,
			"健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸"
		],
		[
			"be40",
			"継",
			12,
			"綧",
			6,
			"綯",
			42
		],
		[
			"be80",
			"線",
			32,
			"尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵觉决诀绝均菌钧军君峻"
		],
		[
			"bf40",
			"緻",
			62
		],
		[
			"bf80",
			"縺縼",
			4,
			"繂",
			4,
			"繈",
			21,
			"俊竣浚郡骏喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀"
		],
		[
			"c040",
			"繞",
			35,
			"纃",
			23,
			"纜纝纞"
		],
		[
			"c080",
			"纮纴纻纼绖绤绬绹缊缐缞缷缹缻",
			6,
			"罃罆",
			9,
			"罒罓馈愧溃坤昆捆困括扩廓阔垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐"
		],
		[
			"c140",
			"罖罙罛罜罝罞罠罣",
			4,
			"罫罬罭罯罰罳罵罶罷罸罺罻罼罽罿羀羂",
			7,
			"羋羍羏",
			4,
			"羕",
			4,
			"羛羜羠羢羣羥羦羨",
			6,
			"羱"
		],
		[
			"c180",
			"羳",
			4,
			"羺羻羾翀翂翃翄翆翇翈翉翋翍翏",
			4,
			"翖翗翙",
			5,
			"翢翣痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿"
		],
		[
			"c240",
			"翤翧翨翪翫翬翭翯翲翴",
			6,
			"翽翾翿耂耇耈耉耊耎耏耑耓耚耛耝耞耟耡耣耤耫",
			5,
			"耲耴耹耺耼耾聀聁聄聅聇聈聉聎聏聐聑聓聕聖聗"
		],
		[
			"c280",
			"聙聛",
			13,
			"聫",
			5,
			"聲",
			11,
			"隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫"
		],
		[
			"c340",
			"聾肁肂肅肈肊肍",
			5,
			"肔肕肗肙肞肣肦肧肨肬肰肳肵肶肸肹肻胅胇",
			4,
			"胏",
			6,
			"胘胟胠胢胣胦胮胵胷胹胻胾胿脀脁脃脄脅脇脈脋"
		],
		[
			"c380",
			"脌脕脗脙脛脜脝脟",
			12,
			"脭脮脰脳脴脵脷脹",
			4,
			"脿谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸"
		],
		[
			"c440",
			"腀",
			5,
			"腇腉腍腎腏腒腖腗腘腛",
			4,
			"腡腢腣腤腦腨腪腫腬腯腲腳腵腶腷腸膁膃",
			4,
			"膉膋膌膍膎膐膒",
			5,
			"膙膚膞",
			4,
			"膤膥"
		],
		[
			"c480",
			"膧膩膫",
			7,
			"膴",
			5,
			"膼膽膾膿臄臅臇臈臉臋臍",
			6,
			"摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁"
		],
		[
			"c540",
			"臔",
			14,
			"臤臥臦臨臩臫臮",
			4,
			"臵",
			5,
			"臽臿舃與",
			4,
			"舎舏舑舓舕",
			5,
			"舝舠舤舥舦舧舩舮舲舺舼舽舿"
		],
		[
			"c580",
			"艀艁艂艃艅艆艈艊艌艍艎艐",
			7,
			"艙艛艜艝艞艠",
			7,
			"艩拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺哦欧鸥殴藕呕偶沤啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗"
		],
		["c640", "艪艫艬艭艱艵艶艷艸艻艼芀芁芃芅芆芇芉芌芐芓芔芕芖芚芛芞芠芢芣芧芲芵芶芺芻芼芿苀苂苃苅苆苉苐苖苙苚苝苢苧苨苩苪苬苭苮苰苲苳苵苶苸"],
		[
			"c680",
			"苺苼",
			4,
			"茊茋茍茐茒茓茖茘茙茝",
			9,
			"茩茪茮茰茲茷茻茽啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇瞥拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐"
		],
		[
			"c740",
			"茾茿荁荂荄荅荈荊",
			4,
			"荓荕",
			4,
			"荝荢荰",
			6,
			"荹荺荾",
			6,
			"莇莈莊莋莌莍莏莐莑莔莕莖莗莙莚莝莟莡",
			6,
			"莬莭莮"
		],
		["c780", "莯莵莻莾莿菂菃菄菆菈菉菋菍菎菐菑菒菓菕菗菙菚菛菞菢菣菤菦菧菨菫菬菭恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠"],
		[
			"c840",
			"菮華菳",
			4,
			"菺菻菼菾菿萀萂萅萇萈萉萊萐萒",
			5,
			"萙萚萛萞",
			5,
			"萩",
			7,
			"萲",
			5,
			"萹萺萻萾",
			7,
			"葇葈葉"
		],
		[
			"c880",
			"葊",
			6,
			"葒",
			4,
			"葘葝葞葟葠葢葤",
			4,
			"葪葮葯葰葲葴葷葹葻葼取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱撒洒萨腮鳃塞赛三叁"
		],
		[
			"c940",
			"葽",
			4,
			"蒃蒄蒅蒆蒊蒍蒏",
			7,
			"蒘蒚蒛蒝蒞蒟蒠蒢",
			12,
			"蒰蒱蒳蒵蒶蒷蒻蒼蒾蓀蓂蓃蓅蓆蓇蓈蓋蓌蓎蓏蓒蓔蓕蓗"
		],
		[
			"c980",
			"蓘",
			4,
			"蓞蓡蓢蓤蓧",
			4,
			"蓭蓮蓯蓱",
			10,
			"蓽蓾蔀蔁蔂伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳"
		],
		[
			"ca40",
			"蔃",
			8,
			"蔍蔎蔏蔐蔒蔔蔕蔖蔘蔙蔛蔜蔝蔞蔠蔢",
			8,
			"蔭",
			9,
			"蔾",
			4,
			"蕄蕅蕆蕇蕋",
			10
		],
		[
			"ca80",
			"蕗蕘蕚蕛蕜蕝蕟",
			4,
			"蕥蕦蕧蕩",
			8,
			"蕳蕵蕶蕷蕸蕼蕽蕿薀薁省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱"
		],
		[
			"cb40",
			"薂薃薆薈",
			6,
			"薐",
			10,
			"薝",
			6,
			"薥薦薧薩薫薬薭薱",
			5,
			"薸薺",
			6,
			"藂",
			6,
			"藊",
			4,
			"藑藒"
		],
		[
			"cb80",
			"藔藖",
			5,
			"藝",
			6,
			"藥藦藧藨藪",
			14,
			"恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所塌他它她塔"
		],
		[
			"cc40",
			"藹藺藼藽藾蘀",
			4,
			"蘆",
			10,
			"蘒蘓蘔蘕蘗",
			15,
			"蘨蘪",
			13,
			"蘹蘺蘻蘽蘾蘿虀"
		],
		[
			"cc80",
			"虁",
			11,
			"虒虓處",
			4,
			"虛虜虝號虠虡虣",
			7,
			"獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃"
		],
		[
			"cd40",
			"虭虯虰虲",
			6,
			"蚃",
			6,
			"蚎",
			4,
			"蚔蚖",
			5,
			"蚞",
			4,
			"蚥蚦蚫蚭蚮蚲蚳蚷蚸蚹蚻",
			4,
			"蛁蛂蛃蛅蛈蛌蛍蛒蛓蛕蛖蛗蛚蛜"
		],
		["cd80", "蛝蛠蛡蛢蛣蛥蛦蛧蛨蛪蛫蛬蛯蛵蛶蛷蛺蛻蛼蛽蛿蜁蜄蜅蜆蜋蜌蜎蜏蜐蜑蜔蜖汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威"],
		[
			"ce40",
			"蜙蜛蜝蜟蜠蜤蜦蜧蜨蜪蜫蜬蜭蜯蜰蜲蜳蜵蜶蜸蜹蜺蜼蜽蝀",
			6,
			"蝊蝋蝍蝏蝐蝑蝒蝔蝕蝖蝘蝚",
			5,
			"蝡蝢蝦",
			7,
			"蝯蝱蝲蝳蝵"
		],
		[
			"ce80",
			"蝷蝸蝹蝺蝿螀螁螄螆螇螉螊螌螎",
			4,
			"螔螕螖螘",
			6,
			"螠",
			4,
			"巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误昔熙析西硒矽晰嘻吸锡牺"
		],
		[
			"cf40",
			"螥螦螧螩螪螮螰螱螲螴螶螷螸螹螻螼螾螿蟁",
			4,
			"蟇蟈蟉蟌",
			4,
			"蟔",
			6,
			"蟜蟝蟞蟟蟡蟢蟣蟤蟦蟧蟨蟩蟫蟬蟭蟯",
			9
		],
		[
			"cf80",
			"蟺蟻蟼蟽蟿蠀蠁蠂蠄",
			5,
			"蠋",
			7,
			"蠔蠗蠘蠙蠚蠜",
			4,
			"蠣稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤衔舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓"
		],
		[
			"d040",
			"蠤",
			13,
			"蠳",
			5,
			"蠺蠻蠽蠾蠿衁衂衃衆",
			5,
			"衎",
			5,
			"衕衖衘衚",
			6,
			"衦衧衪衭衯衱衳衴衵衶衸衹衺"
		],
		[
			"d080",
			"衻衼袀袃袆袇袉袊袌袎袏袐袑袓袔袕袗",
			4,
			"袝",
			4,
			"袣袥",
			5,
			"小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄"
		],
		[
			"d140",
			"袬袮袯袰袲",
			4,
			"袸袹袺袻袽袾袿裀裃裄裇裈裊裋裌裍裏裐裑裓裖裗裚",
			4,
			"裠裡裦裧裩",
			6,
			"裲裵裶裷裺裻製裿褀褁褃",
			5
		],
		[
			"d180",
			"褉褋",
			4,
			"褑褔",
			4,
			"褜",
			4,
			"褢褣褤褦褧褨褩褬褭褮褯褱褲褳褵褷选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶"
		],
		[
			"d240",
			"褸",
			8,
			"襂襃襅",
			24,
			"襠",
			5,
			"襧",
			19,
			"襼"
		],
		[
			"d280",
			"襽襾覀覂覄覅覇",
			26,
			"摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑屹亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐"
		],
		[
			"d340",
			"覢",
			30,
			"觃觍觓觔觕觗觘觙觛觝觟觠觡觢觤觧觨觩觪觬觭觮觰觱觲觴",
			6
		],
		[
			"d380",
			"觻",
			4,
			"訁",
			5,
			"計",
			21,
			"印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉"
		],
		[
			"d440",
			"訞",
			31,
			"訿",
			8,
			"詉",
			21
		],
		[
			"d480",
			"詟",
			25,
			"詺",
			6,
			"浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧"
		],
		[
			"d540",
			"誁",
			7,
			"誋",
			7,
			"誔",
			46
		],
		[
			"d580",
			"諃",
			32,
			"铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮折哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政"
		],
		[
			"d640",
			"諤",
			34,
			"謈",
			27
		],
		[
			"d680",
			"謤謥謧",
			30,
			"帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑"
		],
		[
			"d740",
			"譆",
			31,
			"譧",
			4,
			"譭",
			25
		],
		[
			"d780",
			"讇",
			24,
			"讬讱讻诇诐诪谉谞住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座"
		],
		[
			"d840",
			"谸",
			8,
			"豂豃豄豅豈豊豋豍",
			7,
			"豖豗豘豙豛",
			5,
			"豣",
			6,
			"豬",
			6,
			"豴豵豶豷豻",
			6,
			"貃貄貆貇"
		],
		[
			"d880",
			"貈貋貍",
			6,
			"貕貖貗貙",
			20,
			"亍丌兀丐廿卅丕亘丞鬲孬噩丨禺丿匕乇夭爻卮氐囟胤馗毓睾鼗丶亟鼐乜乩亓芈孛啬嘏仄厍厝厣厥厮靥赝匚叵匦匮匾赜卦卣刂刈刎刭刳刿剀剌剞剡剜蒯剽劂劁劐劓冂罔亻仃仉仂仨仡仫仞伛仳伢佤仵伥伧伉伫佞佧攸佚佝"
		],
		[
			"d940",
			"貮",
			62
		],
		[
			"d980",
			"賭",
			32,
			"佟佗伲伽佶佴侑侉侃侏佾佻侪佼侬侔俦俨俪俅俚俣俜俑俟俸倩偌俳倬倏倮倭俾倜倌倥倨偾偃偕偈偎偬偻傥傧傩傺僖儆僭僬僦僮儇儋仝氽佘佥俎龠汆籴兮巽黉馘冁夔勹匍訇匐凫夙兕亠兖亳衮袤亵脔裒禀嬴蠃羸冫冱冽冼"
		],
		[
			"da40",
			"贎",
			14,
			"贠赑赒赗赟赥赨赩赪赬赮赯赱赲赸",
			8,
			"趂趃趆趇趈趉趌",
			4,
			"趒趓趕",
			9,
			"趠趡"
		],
		[
			"da80",
			"趢趤",
			12,
			"趲趶趷趹趻趽跀跁跂跅跇跈跉跊跍跐跒跓跔凇冖冢冥讠讦讧讪讴讵讷诂诃诋诏诎诒诓诔诖诘诙诜诟诠诤诨诩诮诰诳诶诹诼诿谀谂谄谇谌谏谑谒谔谕谖谙谛谘谝谟谠谡谥谧谪谫谮谯谲谳谵谶卩卺阝阢阡阱阪阽阼陂陉陔陟陧陬陲陴隈隍隗隰邗邛邝邙邬邡邴邳邶邺"
		],
		[
			"db40",
			"跕跘跙跜跠跡跢跥跦跧跩跭跮跰跱跲跴跶跼跾",
			6,
			"踆踇踈踋踍踎踐踑踒踓踕",
			7,
			"踠踡踤",
			4,
			"踫踭踰踲踳踴踶踷踸踻踼踾"
		],
		[
			"db80",
			"踿蹃蹅蹆蹌",
			4,
			"蹓",
			5,
			"蹚",
			11,
			"蹧蹨蹪蹫蹮蹱邸邰郏郅邾郐郄郇郓郦郢郜郗郛郫郯郾鄄鄢鄞鄣鄱鄯鄹酃酆刍奂劢劬劭劾哿勐勖勰叟燮矍廴凵凼鬯厶弁畚巯坌垩垡塾墼壅壑圩圬圪圳圹圮圯坜圻坂坩垅坫垆坼坻坨坭坶坳垭垤垌垲埏垧垴垓垠埕埘埚埙埒垸埴埯埸埤埝"
		],
		[
			"dc40",
			"蹳蹵蹷",
			4,
			"蹽蹾躀躂躃躄躆躈",
			6,
			"躑躒躓躕",
			6,
			"躝躟",
			11,
			"躭躮躰躱躳",
			6,
			"躻",
			7
		],
		[
			"dc80",
			"軃",
			10,
			"軏",
			21,
			"堋堍埽埭堀堞堙塄堠塥塬墁墉墚墀馨鼙懿艹艽艿芏芊芨芄芎芑芗芙芫芸芾芰苈苊苣芘芷芮苋苌苁芩芴芡芪芟苄苎芤苡茉苷苤茏茇苜苴苒苘茌苻苓茑茚茆茔茕苠苕茜荑荛荜茈莒茼茴茱莛荞茯荏荇荃荟荀茗荠茭茺茳荦荥"
		],
		[
			"dd40",
			"軥",
			62
		],
		[
			"dd80",
			"輤",
			32,
			"荨茛荩荬荪荭荮莰荸莳莴莠莪莓莜莅荼莶莩荽莸荻莘莞莨莺莼菁萁菥菘堇萘萋菝菽菖萜萸萑萆菔菟萏萃菸菹菪菅菀萦菰菡葜葑葚葙葳蒇蒈葺蒉葸萼葆葩葶蒌蒎萱葭蓁蓍蓐蓦蒽蓓蓊蒿蒺蓠蒡蒹蒴蒗蓥蓣蔌甍蔸蓰蔹蔟蔺"
		],
		[
			"de40",
			"轅",
			32,
			"轪辀辌辒辝辠辡辢辤辥辦辧辪辬辭辮辯農辳辴辵辷辸辺辻込辿迀迃迆"
		],
		[
			"de80",
			"迉",
			4,
			"迏迒迖迗迚迠迡迣迧迬迯迱迲迴迵迶迺迻迼迾迿逇逈逌逎逓逕逘蕖蔻蓿蓼蕙蕈蕨蕤蕞蕺瞢蕃蕲蕻薤薨薇薏蕹薮薜薅薹薷薰藓藁藜藿蘧蘅蘩蘖蘼廾弈夼奁耷奕奚奘匏尢尥尬尴扌扪抟抻拊拚拗拮挢拶挹捋捃掭揶捱捺掎掴捭掬掊捩掮掼揲揸揠揿揄揞揎摒揆掾摅摁搋搛搠搌搦搡摞撄摭撖"
		],
		[
			"df40",
			"這逜連逤逥逧",
			5,
			"逰",
			4,
			"逷逹逺逽逿遀遃遅遆遈",
			4,
			"過達違遖遙遚遜",
			5,
			"遤遦遧適遪遫遬遯",
			4,
			"遶",
			6,
			"遾邁"
		],
		[
			"df80",
			"還邅邆邇邉邊邌",
			4,
			"邒邔邖邘邚邜邞邟邠邤邥邧邨邩邫邭邲邷邼邽邿郀摺撷撸撙撺擀擐擗擤擢攉攥攮弋忒甙弑卟叱叽叩叨叻吒吖吆呋呒呓呔呖呃吡呗呙吣吲咂咔呷呱呤咚咛咄呶呦咝哐咭哂咴哒咧咦哓哔呲咣哕咻咿哌哙哚哜咩咪咤哝哏哞唛哧唠哽唔哳唢唣唏唑唧唪啧喏喵啉啭啁啕唿啐唼"
		],
		[
			"e040",
			"郂郃郆郈郉郋郌郍郒郔郕郖郘郙郚郞郟郠郣郤郥郩郪郬郮郰郱郲郳郵郶郷郹郺郻郼郿鄀鄁鄃鄅",
			19,
			"鄚鄛鄜"
		],
		[
			"e080",
			"鄝鄟鄠鄡鄤",
			10,
			"鄰鄲",
			6,
			"鄺",
			8,
			"酄唷啖啵啶啷唳唰啜喋嗒喃喱喹喈喁喟啾嗖喑啻嗟喽喾喔喙嗪嗷嗉嘟嗑嗫嗬嗔嗦嗝嗄嗯嗥嗲嗳嗌嗍嗨嗵嗤辔嘞嘈嘌嘁嘤嘣嗾嘀嘧嘭噘嘹噗嘬噍噢噙噜噌噔嚆噤噱噫噻噼嚅嚓嚯囔囗囝囡囵囫囹囿圄圊圉圜帏帙帔帑帱帻帼"
		],
		[
			"e140",
			"酅酇酈酑酓酔酕酖酘酙酛酜酟酠酦酧酨酫酭酳酺酻酼醀",
			4,
			"醆醈醊醎醏醓",
			6,
			"醜",
			5,
			"醤",
			5,
			"醫醬醰醱醲醳醶醷醸醹醻"
		],
		[
			"e180",
			"醼",
			10,
			"釈釋釐釒",
			9,
			"針",
			8,
			"帷幄幔幛幞幡岌屺岍岐岖岈岘岙岑岚岜岵岢岽岬岫岱岣峁岷峄峒峤峋峥崂崃崧崦崮崤崞崆崛嵘崾崴崽嵬嵛嵯嵝嵫嵋嵊嵩嵴嶂嶙嶝豳嶷巅彳彷徂徇徉後徕徙徜徨徭徵徼衢彡犭犰犴犷犸狃狁狎狍狒狨狯狩狲狴狷猁狳猃狺"
		],
		[
			"e240",
			"釦",
			62
		],
		[
			"e280",
			"鈥",
			32,
			"狻猗猓猡猊猞猝猕猢猹猥猬猸猱獐獍獗獠獬獯獾舛夥飧夤夂饣饧",
			5,
			"饴饷饽馀馄馇馊馍馐馑馓馔馕庀庑庋庖庥庠庹庵庾庳赓廒廑廛廨廪膺忄忉忖忏怃忮怄忡忤忾怅怆忪忭忸怙怵怦怛怏怍怩怫怊怿怡恸恹恻恺恂"
		],
		[
			"e340",
			"鉆",
			45,
			"鉵",
			16
		],
		[
			"e380",
			"銆",
			7,
			"銏",
			24,
			"恪恽悖悚悭悝悃悒悌悛惬悻悱惝惘惆惚悴愠愦愕愣惴愀愎愫慊慵憬憔憧憷懔懵忝隳闩闫闱闳闵闶闼闾阃阄阆阈阊阋阌阍阏阒阕阖阗阙阚丬爿戕氵汔汜汊沣沅沐沔沌汨汩汴汶沆沩泐泔沭泷泸泱泗沲泠泖泺泫泮沱泓泯泾"
		],
		[
			"e440",
			"銨",
			5,
			"銯",
			24,
			"鋉",
			31
		],
		[
			"e480",
			"鋩",
			32,
			"洹洧洌浃浈洇洄洙洎洫浍洮洵洚浏浒浔洳涑浯涞涠浞涓涔浜浠浼浣渚淇淅淞渎涿淠渑淦淝淙渖涫渌涮渫湮湎湫溲湟溆湓湔渲渥湄滟溱溘滠漭滢溥溧溽溻溷滗溴滏溏滂溟潢潆潇漤漕滹漯漶潋潴漪漉漩澉澍澌潸潲潼潺濑"
		],
		[
			"e540",
			"錊",
			51,
			"錿",
			10
		],
		[
			"e580",
			"鍊",
			31,
			"鍫濉澧澹澶濂濡濮濞濠濯瀚瀣瀛瀹瀵灏灞宀宄宕宓宥宸甯骞搴寤寮褰寰蹇謇辶迓迕迥迮迤迩迦迳迨逅逄逋逦逑逍逖逡逵逶逭逯遄遑遒遐遨遘遢遛暹遴遽邂邈邃邋彐彗彖彘尻咫屐屙孱屣屦羼弪弩弭艴弼鬻屮妁妃妍妩妪妣"
		],
		[
			"e640",
			"鍬",
			34,
			"鎐",
			27
		],
		[
			"e680",
			"鎬",
			29,
			"鏋鏌鏍妗姊妫妞妤姒妲妯姗妾娅娆姝娈姣姘姹娌娉娲娴娑娣娓婀婧婊婕娼婢婵胬媪媛婷婺媾嫫媲嫒嫔媸嫠嫣嫱嫖嫦嫘嫜嬉嬗嬖嬲嬷孀尕尜孚孥孳孑孓孢驵驷驸驺驿驽骀骁骅骈骊骐骒骓骖骘骛骜骝骟骠骢骣骥骧纟纡纣纥纨纩"
		],
		[
			"e740",
			"鏎",
			7,
			"鏗",
			54
		],
		[
			"e780",
			"鐎",
			32,
			"纭纰纾绀绁绂绉绋绌绐绔绗绛绠绡绨绫绮绯绱绲缍绶绺绻绾缁缂缃缇缈缋缌缏缑缒缗缙缜缛缟缡",
			6,
			"缪缫缬缭缯",
			4,
			"缵幺畿巛甾邕玎玑玮玢玟珏珂珑玷玳珀珉珈珥珙顼琊珩珧珞玺珲琏琪瑛琦琥琨琰琮琬"
		],
		[
			"e840",
			"鐯",
			14,
			"鐿",
			43,
			"鑬鑭鑮鑯"
		],
		[
			"e880",
			"鑰",
			20,
			"钑钖钘铇铏铓铔铚铦铻锜锠琛琚瑁瑜瑗瑕瑙瑷瑭瑾璜璎璀璁璇璋璞璨璩璐璧瓒璺韪韫韬杌杓杞杈杩枥枇杪杳枘枧杵枨枞枭枋杷杼柰栉柘栊柩枰栌柙枵柚枳柝栀柃枸柢栎柁柽栲栳桠桡桎桢桄桤梃栝桕桦桁桧桀栾桊桉栩梵梏桴桷梓桫棂楮棼椟椠棹"
		],
		[
			"e940",
			"锧锳锽镃镈镋镕镚镠镮镴镵長",
			7,
			"門",
			42
		],
		[
			"e980",
			"閫",
			32,
			"椤棰椋椁楗棣椐楱椹楠楂楝榄楫榀榘楸椴槌榇榈槎榉楦楣楹榛榧榻榫榭槔榱槁槊槟榕槠榍槿樯槭樗樘橥槲橄樾檠橐橛樵檎橹樽樨橘橼檑檐檩檗檫猷獒殁殂殇殄殒殓殍殚殛殡殪轫轭轱轲轳轵轶轸轷轹轺轼轾辁辂辄辇辋"
		],
		[
			"ea40",
			"闌",
			27,
			"闬闿阇阓阘阛阞阠阣",
			6,
			"阫阬阭阯阰阷阸阹阺阾陁陃陊陎陏陑陒陓陖陗"
		],
		[
			"ea80",
			"陘陙陚陜陝陞陠陣陥陦陫陭",
			4,
			"陳陸",
			12,
			"隇隉隊辍辎辏辘辚軎戋戗戛戟戢戡戥戤戬臧瓯瓴瓿甏甑甓攴旮旯旰昊昙杲昃昕昀炅曷昝昴昱昶昵耆晟晔晁晏晖晡晗晷暄暌暧暝暾曛曜曦曩贲贳贶贻贽赀赅赆赈赉赇赍赕赙觇觊觋觌觎觏觐觑牮犟牝牦牯牾牿犄犋犍犏犒挈挲掰"
		],
		[
			"eb40",
			"隌階隑隒隓隕隖隚際隝",
			9,
			"隨",
			7,
			"隱隲隴隵隷隸隺隻隿雂雃雈雊雋雐雑雓雔雖",
			9,
			"雡",
			6,
			"雫"
		],
		[
			"eb80",
			"雬雭雮雰雱雲雴雵雸雺電雼雽雿霂霃霅霊霋霌霐霑霒霔霕霗",
			4,
			"霝霟霠搿擘耄毪毳毽毵毹氅氇氆氍氕氘氙氚氡氩氤氪氲攵敕敫牍牒牖爰虢刖肟肜肓肼朊肽肱肫肭肴肷胧胨胩胪胛胂胄胙胍胗朐胝胫胱胴胭脍脎胲胼朕脒豚脶脞脬脘脲腈腌腓腴腙腚腱腠腩腼腽腭腧塍媵膈膂膑滕膣膪臌朦臊膻"
		],
		[
			"ec40",
			"霡",
			8,
			"霫霬霮霯霱霳",
			4,
			"霺霻霼霽霿",
			18,
			"靔靕靗靘靚靜靝靟靣靤靦靧靨靪",
			7
		],
		[
			"ec80",
			"靲靵靷",
			4,
			"靽",
			7,
			"鞆",
			4,
			"鞌鞎鞏鞐鞓鞕鞖鞗鞙",
			4,
			"臁膦欤欷欹歃歆歙飑飒飓飕飙飚殳彀毂觳斐齑斓於旆旄旃旌旎旒旖炀炜炖炝炻烀炷炫炱烨烊焐焓焖焯焱煳煜煨煅煲煊煸煺熘熳熵熨熠燠燔燧燹爝爨灬焘煦熹戾戽扃扈扉礻祀祆祉祛祜祓祚祢祗祠祯祧祺禅禊禚禧禳忑忐"
		],
		[
			"ed40",
			"鞞鞟鞡鞢鞤",
			6,
			"鞬鞮鞰鞱鞳鞵",
			46
		],
		[
			"ed80",
			"韤韥韨韮",
			4,
			"韴韷",
			23,
			"怼恝恚恧恁恙恣悫愆愍慝憩憝懋懑戆肀聿沓泶淼矶矸砀砉砗砘砑斫砭砜砝砹砺砻砟砼砥砬砣砩硎硭硖硗砦硐硇硌硪碛碓碚碇碜碡碣碲碹碥磔磙磉磬磲礅磴礓礤礞礴龛黹黻黼盱眄眍盹眇眈眚眢眙眭眦眵眸睐睑睇睃睚睨"
		],
		[
			"ee40",
			"頏",
			62
		],
		[
			"ee80",
			"顎",
			32,
			"睢睥睿瞍睽瞀瞌瞑瞟瞠瞰瞵瞽町畀畎畋畈畛畲畹疃罘罡罟詈罨罴罱罹羁罾盍盥蠲钅钆钇钋钊钌钍钏钐钔钗钕钚钛钜钣钤钫钪钭钬钯钰钲钴钶",
			4,
			"钼钽钿铄铈",
			6,
			"铐铑铒铕铖铗铙铘铛铞铟铠铢铤铥铧铨铪"
		],
		[
			"ef40",
			"顯",
			5,
			"颋颎颒颕颙颣風",
			37,
			"飏飐飔飖飗飛飜飝飠",
			4
		],
		[
			"ef80",
			"飥飦飩",
			30,
			"铩铫铮铯铳铴铵铷铹铼铽铿锃锂锆锇锉锊锍锎锏锒",
			4,
			"锘锛锝锞锟锢锪锫锩锬锱锲锴锶锷锸锼锾锿镂锵镄镅镆镉镌镎镏镒镓镔镖镗镘镙镛镞镟镝镡镢镤",
			8,
			"镯镱镲镳锺矧矬雉秕秭秣秫稆嵇稃稂稞稔"
		],
		[
			"f040",
			"餈",
			4,
			"餎餏餑",
			28,
			"餯",
			26
		],
		[
			"f080",
			"饊",
			9,
			"饖",
			12,
			"饤饦饳饸饹饻饾馂馃馉稹稷穑黏馥穰皈皎皓皙皤瓞瓠甬鸠鸢鸨",
			4,
			"鸲鸱鸶鸸鸷鸹鸺鸾鹁鹂鹄鹆鹇鹈鹉鹋鹌鹎鹑鹕鹗鹚鹛鹜鹞鹣鹦",
			6,
			"鹱鹭鹳疒疔疖疠疝疬疣疳疴疸痄疱疰痃痂痖痍痣痨痦痤痫痧瘃痱痼痿瘐瘀瘅瘌瘗瘊瘥瘘瘕瘙"
		],
		[
			"f140",
			"馌馎馚",
			10,
			"馦馧馩",
			47
		],
		[
			"f180",
			"駙",
			32,
			"瘛瘼瘢瘠癀瘭瘰瘿瘵癃瘾瘳癍癞癔癜癖癫癯翊竦穸穹窀窆窈窕窦窠窬窨窭窳衤衩衲衽衿袂袢裆袷袼裉裢裎裣裥裱褚裼裨裾裰褡褙褓褛褊褴褫褶襁襦襻疋胥皲皴矜耒耔耖耜耠耢耥耦耧耩耨耱耋耵聃聆聍聒聩聱覃顸颀颃"
		],
		[
			"f240",
			"駺",
			62
		],
		[
			"f280",
			"騹",
			32,
			"颉颌颍颏颔颚颛颞颟颡颢颥颦虍虔虬虮虿虺虼虻蚨蚍蚋蚬蚝蚧蚣蚪蚓蚩蚶蛄蚵蛎蚰蚺蚱蚯蛉蛏蚴蛩蛱蛲蛭蛳蛐蜓蛞蛴蛟蛘蛑蜃蜇蛸蜈蜊蜍蜉蜣蜻蜞蜥蜮蜚蜾蝈蜴蜱蜩蜷蜿螂蜢蝽蝾蝻蝠蝰蝌蝮螋蝓蝣蝼蝤蝙蝥螓螯螨蟒"
		],
		[
			"f340",
			"驚",
			17,
			"驲骃骉骍骎骔骕骙骦骩",
			6,
			"骲骳骴骵骹骻骽骾骿髃髄髆",
			4,
			"髍髎髏髐髒體髕髖髗髙髚髛髜"
		],
		[
			"f380",
			"髝髞髠髢髣髤髥髧髨髩髪髬髮髰",
			8,
			"髺髼",
			6,
			"鬄鬅鬆蟆螈螅螭螗螃螫蟥螬螵螳蟋蟓螽蟑蟀蟊蟛蟪蟠蟮蠖蠓蟾蠊蠛蠡蠹蠼缶罂罄罅舐竺竽笈笃笄笕笊笫笏筇笸笪笙笮笱笠笥笤笳笾笞筘筚筅筵筌筝筠筮筻筢筲筱箐箦箧箸箬箝箨箅箪箜箢箫箴篑篁篌篝篚篥篦篪簌篾篼簏簖簋"
		],
		[
			"f440",
			"鬇鬉",
			5,
			"鬐鬑鬒鬔",
			10,
			"鬠鬡鬢鬤",
			10,
			"鬰鬱鬳",
			7,
			"鬽鬾鬿魀魆魊魋魌魎魐魒魓魕",
			5
		],
		[
			"f480",
			"魛",
			32,
			"簟簪簦簸籁籀臾舁舂舄臬衄舡舢舣舭舯舨舫舸舻舳舴舾艄艉艋艏艚艟艨衾袅袈裘裟襞羝羟羧羯羰羲籼敉粑粝粜粞粢粲粼粽糁糇糌糍糈糅糗糨艮暨羿翎翕翥翡翦翩翮翳糸絷綦綮繇纛麸麴赳趄趔趑趱赧赭豇豉酊酐酎酏酤"
		],
		[
			"f540",
			"魼",
			62
		],
		[
			"f580",
			"鮻",
			32,
			"酢酡酰酩酯酽酾酲酴酹醌醅醐醍醑醢醣醪醭醮醯醵醴醺豕鹾趸跫踅蹙蹩趵趿趼趺跄跖跗跚跞跎跏跛跆跬跷跸跣跹跻跤踉跽踔踝踟踬踮踣踯踺蹀踹踵踽踱蹉蹁蹂蹑蹒蹊蹰蹶蹼蹯蹴躅躏躔躐躜躞豸貂貊貅貘貔斛觖觞觚觜"
		],
		[
			"f640",
			"鯜",
			62
		],
		[
			"f680",
			"鰛",
			32,
			"觥觫觯訾謦靓雩雳雯霆霁霈霏霎霪霭霰霾龀龃龅",
			5,
			"龌黾鼋鼍隹隼隽雎雒瞿雠銎銮鋈錾鍪鏊鎏鐾鑫鱿鲂鲅鲆鲇鲈稣鲋鲎鲐鲑鲒鲔鲕鲚鲛鲞",
			5,
			"鲥",
			4,
			"鲫鲭鲮鲰",
			7,
			"鲺鲻鲼鲽鳄鳅鳆鳇鳊鳋"
		],
		[
			"f740",
			"鰼",
			62
		],
		[
			"f780",
			"鱻鱽鱾鲀鲃鲄鲉鲊鲌鲏鲓鲖鲗鲘鲙鲝鲪鲬鲯鲹鲾",
			4,
			"鳈鳉鳑鳒鳚鳛鳠鳡鳌",
			4,
			"鳓鳔鳕鳗鳘鳙鳜鳝鳟鳢靼鞅鞑鞒鞔鞯鞫鞣鞲鞴骱骰骷鹘骶骺骼髁髀髅髂髋髌髑魅魃魇魉魈魍魑飨餍餮饕饔髟髡髦髯髫髻髭髹鬈鬏鬓鬟鬣麽麾縻麂麇麈麋麒鏖麝麟黛黜黝黠黟黢黩黧黥黪黯鼢鼬鼯鼹鼷鼽鼾齄"
		],
		[
			"f840",
			"鳣",
			62
		],
		[
			"f880",
			"鴢",
			32
		],
		[
			"f940",
			"鵃",
			62
		],
		[
			"f980",
			"鶂",
			32
		],
		[
			"fa40",
			"鶣",
			62
		],
		[
			"fa80",
			"鷢",
			32
		],
		[
			"fb40",
			"鸃",
			27,
			"鸤鸧鸮鸰鸴鸻鸼鹀鹍鹐鹒鹓鹔鹖鹙鹝鹟鹠鹡鹢鹥鹮鹯鹲鹴",
			9,
			"麀"
		],
		[
			"fb80",
			"麁麃麄麅麆麉麊麌",
			5,
			"麔",
			8,
			"麞麠",
			5,
			"麧麨麩麪"
		],
		[
			"fc40",
			"麫",
			8,
			"麵麶麷麹麺麼麿",
			4,
			"黅黆黇黈黊黋黌黐黒黓黕黖黗黙黚點黡黣黤黦黨黫黬黭黮黰",
			8,
			"黺黽黿",
			6
		],
		[
			"fc80",
			"鼆",
			4,
			"鼌鼏鼑鼒鼔鼕鼖鼘鼚",
			5,
			"鼡鼣",
			8,
			"鼭鼮鼰鼱"
		],
		[
			"fd40",
			"鼲",
			4,
			"鼸鼺鼼鼿",
			4,
			"齅",
			10,
			"齒",
			38
		],
		[
			"fd80",
			"齹",
			5,
			"龁龂龍",
			11,
			"龜龝龞龡",
			4,
			"郎凉秊裏隣"
		],
		["fe40", "兀嗀﨎﨏﨑﨓﨔礼﨟蘒﨡﨣﨤﨧﨨﨩"]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/gbk-added.json
var require_gbk_added = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/gbk-added.json": ((exports, module) => {
	module.exports = [
		[
			"a140",
			"",
			62
		],
		[
			"a180",
			"",
			32
		],
		[
			"a240",
			"",
			62
		],
		[
			"a280",
			"",
			32
		],
		[
			"a2ab",
			"",
			5
		],
		["a2e3", "€"],
		["a2ef", ""],
		["a2fd", ""],
		[
			"a340",
			"",
			62
		],
		[
			"a380",
			"",
			31,
			"　"
		],
		[
			"a440",
			"",
			62
		],
		[
			"a480",
			"",
			32
		],
		[
			"a4f4",
			"",
			10
		],
		[
			"a540",
			"",
			62
		],
		[
			"a580",
			"",
			32
		],
		[
			"a5f7",
			"",
			7
		],
		[
			"a640",
			"",
			62
		],
		[
			"a680",
			"",
			32
		],
		[
			"a6b9",
			"",
			7
		],
		[
			"a6d9",
			"",
			6
		],
		["a6ec", ""],
		["a6f3", ""],
		[
			"a6f6",
			"",
			8
		],
		[
			"a740",
			"",
			62
		],
		[
			"a780",
			"",
			32
		],
		[
			"a7c2",
			"",
			14
		],
		[
			"a7f2",
			"",
			12
		],
		[
			"a896",
			"",
			10
		],
		["a8bc", "ḿ"],
		["a8bf", "ǹ"],
		["a8c1", ""],
		[
			"a8ea",
			"",
			20
		],
		["a958", ""],
		["a95b", ""],
		["a95d", ""],
		[
			"a989",
			"〾⿰",
			11
		],
		[
			"a997",
			"",
			12
		],
		[
			"a9f0",
			"",
			14
		],
		[
			"aaa1",
			"",
			93
		],
		[
			"aba1",
			"",
			93
		],
		[
			"aca1",
			"",
			93
		],
		[
			"ada1",
			"",
			93
		],
		[
			"aea1",
			"",
			93
		],
		[
			"afa1",
			"",
			93
		],
		[
			"d7fa",
			"",
			4
		],
		[
			"f8a1",
			"",
			93
		],
		[
			"f9a1",
			"",
			93
		],
		[
			"faa1",
			"",
			93
		],
		[
			"fba1",
			"",
			93
		],
		[
			"fca1",
			"",
			93
		],
		[
			"fda1",
			"",
			93
		],
		["fe50", "⺁⺄㑳㑇⺈⺋㖞㘚㘎⺌⺗㥮㤘㧏㧟㩳㧐㭎㱮㳠⺧⺪䁖䅟⺮䌷⺳⺶⺷䎱䎬⺻䏝䓖䙡䙌"],
		[
			"fe80",
			"䜣䜩䝼䞍⻊䥇䥺䥽䦂䦃䦅䦆䦟䦛䦷䦶䲣䲟䲠䲡䱷䲢䴓",
			6,
			"䶮",
			93
		],
		["8135f437", ""]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/gb18030-ranges.json
var require_gb18030_ranges = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/gb18030-ranges.json": ((exports, module) => {
	module.exports = {
		"uChars": [
			128,
			165,
			169,
			178,
			184,
			216,
			226,
			235,
			238,
			244,
			248,
			251,
			253,
			258,
			276,
			284,
			300,
			325,
			329,
			334,
			364,
			463,
			465,
			467,
			469,
			471,
			473,
			475,
			477,
			506,
			594,
			610,
			712,
			716,
			730,
			930,
			938,
			962,
			970,
			1026,
			1104,
			1106,
			8209,
			8215,
			8218,
			8222,
			8231,
			8241,
			8244,
			8246,
			8252,
			8365,
			8452,
			8454,
			8458,
			8471,
			8482,
			8556,
			8570,
			8596,
			8602,
			8713,
			8720,
			8722,
			8726,
			8731,
			8737,
			8740,
			8742,
			8748,
			8751,
			8760,
			8766,
			8777,
			8781,
			8787,
			8802,
			8808,
			8816,
			8854,
			8858,
			8870,
			8896,
			8979,
			9322,
			9372,
			9548,
			9588,
			9616,
			9622,
			9634,
			9652,
			9662,
			9672,
			9676,
			9680,
			9702,
			9735,
			9738,
			9793,
			9795,
			11906,
			11909,
			11913,
			11917,
			11928,
			11944,
			11947,
			11951,
			11956,
			11960,
			11964,
			11979,
			12284,
			12292,
			12312,
			12319,
			12330,
			12351,
			12436,
			12447,
			12535,
			12543,
			12586,
			12842,
			12850,
			12964,
			13200,
			13215,
			13218,
			13253,
			13263,
			13267,
			13270,
			13384,
			13428,
			13727,
			13839,
			13851,
			14617,
			14703,
			14801,
			14816,
			14964,
			15183,
			15471,
			15585,
			16471,
			16736,
			17208,
			17325,
			17330,
			17374,
			17623,
			17997,
			18018,
			18212,
			18218,
			18301,
			18318,
			18760,
			18811,
			18814,
			18820,
			18823,
			18844,
			18848,
			18872,
			19576,
			19620,
			19738,
			19887,
			40870,
			59244,
			59336,
			59367,
			59413,
			59417,
			59423,
			59431,
			59437,
			59443,
			59452,
			59460,
			59478,
			59493,
			63789,
			63866,
			63894,
			63976,
			63986,
			64016,
			64018,
			64021,
			64025,
			64034,
			64037,
			64042,
			65074,
			65093,
			65107,
			65112,
			65127,
			65132,
			65375,
			65510,
			65536
		],
		"gbChars": [
			0,
			36,
			38,
			45,
			50,
			81,
			89,
			95,
			96,
			100,
			103,
			104,
			105,
			109,
			126,
			133,
			148,
			172,
			175,
			179,
			208,
			306,
			307,
			308,
			309,
			310,
			311,
			312,
			313,
			341,
			428,
			443,
			544,
			545,
			558,
			741,
			742,
			749,
			750,
			805,
			819,
			820,
			7922,
			7924,
			7925,
			7927,
			7934,
			7943,
			7944,
			7945,
			7950,
			8062,
			8148,
			8149,
			8152,
			8164,
			8174,
			8236,
			8240,
			8262,
			8264,
			8374,
			8380,
			8381,
			8384,
			8388,
			8390,
			8392,
			8393,
			8394,
			8396,
			8401,
			8406,
			8416,
			8419,
			8424,
			8437,
			8439,
			8445,
			8482,
			8485,
			8496,
			8521,
			8603,
			8936,
			8946,
			9046,
			9050,
			9063,
			9066,
			9076,
			9092,
			9100,
			9108,
			9111,
			9113,
			9131,
			9162,
			9164,
			9218,
			9219,
			11329,
			11331,
			11334,
			11336,
			11346,
			11361,
			11363,
			11366,
			11370,
			11372,
			11375,
			11389,
			11682,
			11686,
			11687,
			11692,
			11694,
			11714,
			11716,
			11723,
			11725,
			11730,
			11736,
			11982,
			11989,
			12102,
			12336,
			12348,
			12350,
			12384,
			12393,
			12395,
			12397,
			12510,
			12553,
			12851,
			12962,
			12973,
			13738,
			13823,
			13919,
			13933,
			14080,
			14298,
			14585,
			14698,
			15583,
			15847,
			16318,
			16434,
			16438,
			16481,
			16729,
			17102,
			17122,
			17315,
			17320,
			17402,
			17418,
			17859,
			17909,
			17911,
			17915,
			17916,
			17936,
			17939,
			17961,
			18664,
			18703,
			18814,
			18962,
			19043,
			33469,
			33470,
			33471,
			33484,
			33485,
			33490,
			33497,
			33501,
			33505,
			33513,
			33520,
			33536,
			33550,
			37845,
			37921,
			37948,
			38029,
			38038,
			38064,
			38065,
			38066,
			38069,
			38075,
			38076,
			38078,
			39108,
			39109,
			39113,
			39114,
			39115,
			39116,
			39265,
			39394,
			189e3
		]
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp949.json
var require_cp949 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp949.json": ((exports, module) => {
	module.exports = [
		[
			"0",
			"\0",
			127
		],
		[
			"8141",
			"갂갃갅갆갋",
			4,
			"갘갞갟갡갢갣갥",
			6,
			"갮갲갳갴"
		],
		[
			"8161",
			"갵갶갷갺갻갽갾갿걁",
			9,
			"걌걎",
			5,
			"걕"
		],
		[
			"8181",
			"걖걗걙걚걛걝",
			18,
			"걲걳걵걶걹걻",
			4,
			"겂겇겈겍겎겏겑겒겓겕",
			6,
			"겞겢",
			5,
			"겫겭겮겱",
			6,
			"겺겾겿곀곂곃곅곆곇곉곊곋곍",
			7,
			"곖곘",
			7,
			"곢곣곥곦곩곫곭곮곲곴곷",
			4,
			"곾곿괁괂괃괅괇",
			4,
			"괎괐괒괓"
		],
		[
			"8241",
			"괔괕괖괗괙괚괛괝괞괟괡",
			7,
			"괪괫괮",
			5
		],
		[
			"8261",
			"괶괷괹괺괻괽",
			6,
			"굆굈굊",
			5,
			"굑굒굓굕굖굗"
		],
		[
			"8281",
			"굙",
			7,
			"굢굤",
			7,
			"굮굯굱굲굷굸굹굺굾궀궃",
			4,
			"궊궋궍궎궏궑",
			10,
			"궞",
			5,
			"궥",
			17,
			"궸",
			7,
			"귂귃귅귆귇귉",
			6,
			"귒귔",
			7,
			"귝귞귟귡귢귣귥",
			18
		],
		[
			"8341",
			"귺귻귽귾긂",
			5,
			"긊긌긎",
			5,
			"긕",
			7
		],
		[
			"8361",
			"긝",
			18,
			"긲긳긵긶긹긻긼"
		],
		[
			"8381",
			"긽긾긿깂깄깇깈깉깋깏깑깒깓깕깗",
			4,
			"깞깢깣깤깦깧깪깫깭깮깯깱",
			6,
			"깺깾",
			5,
			"꺆",
			5,
			"꺍",
			46,
			"꺿껁껂껃껅",
			6,
			"껎껒",
			5,
			"껚껛껝",
			8
		],
		[
			"8441",
			"껦껧껩껪껬껮",
			5,
			"껵껶껷껹껺껻껽",
			8
		],
		[
			"8461",
			"꼆꼉꼊꼋꼌꼎꼏꼑",
			18
		],
		[
			"8481",
			"꼤",
			7,
			"꼮꼯꼱꼳꼵",
			6,
			"꼾꽀꽄꽅꽆꽇꽊",
			5,
			"꽑",
			10,
			"꽞",
			5,
			"꽦",
			18,
			"꽺",
			5,
			"꾁꾂꾃꾅꾆꾇꾉",
			6,
			"꾒꾓꾔꾖",
			5,
			"꾝",
			26,
			"꾺꾻꾽꾾"
		],
		[
			"8541",
			"꾿꿁",
			5,
			"꿊꿌꿏",
			4,
			"꿕",
			6,
			"꿝",
			4
		],
		[
			"8561",
			"꿢",
			5,
			"꿪",
			5,
			"꿲꿳꿵꿶꿷꿹",
			6,
			"뀂뀃"
		],
		[
			"8581",
			"뀅",
			6,
			"뀍뀎뀏뀑뀒뀓뀕",
			6,
			"뀞",
			9,
			"뀩",
			26,
			"끆끇끉끋끍끏끐끑끒끖끘끚끛끜끞",
			29,
			"끾끿낁낂낃낅",
			6,
			"낎낐낒",
			5,
			"낛낝낞낣낤"
		],
		[
			"8641",
			"낥낦낧낪낰낲낶낷낹낺낻낽",
			6,
			"냆냊",
			5,
			"냒"
		],
		[
			"8661",
			"냓냕냖냗냙",
			6,
			"냡냢냣냤냦",
			10
		],
		[
			"8681",
			"냱",
			22,
			"넊넍넎넏넑넔넕넖넗넚넞",
			4,
			"넦넧넩넪넫넭",
			6,
			"넶넺",
			5,
			"녂녃녅녆녇녉",
			6,
			"녒녓녖녗녙녚녛녝녞녟녡",
			22,
			"녺녻녽녾녿놁놃",
			4,
			"놊놌놎놏놐놑놕놖놗놙놚놛놝"
		],
		[
			"8741",
			"놞",
			9,
			"놩",
			15
		],
		[
			"8761",
			"놹",
			18,
			"뇍뇎뇏뇑뇒뇓뇕"
		],
		[
			"8781",
			"뇖",
			5,
			"뇞뇠",
			7,
			"뇪뇫뇭뇮뇯뇱",
			7,
			"뇺뇼뇾",
			5,
			"눆눇눉눊눍",
			6,
			"눖눘눚",
			5,
			"눡",
			18,
			"눵",
			6,
			"눽",
			26,
			"뉙뉚뉛뉝뉞뉟뉡",
			6,
			"뉪",
			4
		],
		[
			"8841",
			"뉯",
			4,
			"뉶",
			5,
			"뉽",
			6,
			"늆늇늈늊",
			4
		],
		[
			"8861",
			"늏늒늓늕늖늗늛",
			4,
			"늢늤늧늨늩늫늭늮늯늱늲늳늵늶늷"
		],
		[
			"8881",
			"늸",
			15,
			"닊닋닍닎닏닑닓",
			4,
			"닚닜닞닟닠닡닣닧닩닪닰닱닲닶닼닽닾댂댃댅댆댇댉",
			6,
			"댒댖",
			5,
			"댝",
			54,
			"덗덙덚덝덠덡덢덣"
		],
		[
			"8941",
			"덦덨덪덬덭덯덲덳덵덶덷덹",
			6,
			"뎂뎆",
			5,
			"뎍"
		],
		[
			"8961",
			"뎎뎏뎑뎒뎓뎕",
			10,
			"뎢",
			5,
			"뎩뎪뎫뎭"
		],
		[
			"8981",
			"뎮",
			21,
			"돆돇돉돊돍돏돑돒돓돖돘돚돜돞돟돡돢돣돥돦돧돩",
			18,
			"돽",
			18,
			"됑",
			6,
			"됙됚됛됝됞됟됡",
			6,
			"됪됬",
			7,
			"됵",
			15
		],
		[
			"8a41",
			"둅",
			10,
			"둒둓둕둖둗둙",
			6,
			"둢둤둦"
		],
		[
			"8a61",
			"둧",
			4,
			"둭",
			18,
			"뒁뒂"
		],
		[
			"8a81",
			"뒃",
			4,
			"뒉",
			19,
			"뒞",
			5,
			"뒥뒦뒧뒩뒪뒫뒭",
			7,
			"뒶뒸뒺",
			5,
			"듁듂듃듅듆듇듉",
			6,
			"듑듒듓듔듖",
			5,
			"듞듟듡듢듥듧",
			4,
			"듮듰듲",
			5,
			"듹",
			26,
			"딖딗딙딚딝"
		],
		[
			"8b41",
			"딞",
			5,
			"딦딫",
			4,
			"딲딳딵딶딷딹",
			6,
			"땂땆"
		],
		[
			"8b61",
			"땇땈땉땊땎땏땑땒땓땕",
			6,
			"땞땢",
			8
		],
		[
			"8b81",
			"땫",
			52,
			"떢떣떥떦떧떩떬떭떮떯떲떶",
			4,
			"떾떿뗁뗂뗃뗅",
			6,
			"뗎뗒",
			5,
			"뗙",
			18,
			"뗭",
			18
		],
		[
			"8c41",
			"똀",
			15,
			"똒똓똕똖똗똙",
			4
		],
		[
			"8c61",
			"똞",
			6,
			"똦",
			5,
			"똭",
			6,
			"똵",
			5
		],
		[
			"8c81",
			"똻",
			12,
			"뙉",
			26,
			"뙥뙦뙧뙩",
			50,
			"뚞뚟뚡뚢뚣뚥",
			5,
			"뚭뚮뚯뚰뚲",
			16
		],
		[
			"8d41",
			"뛃",
			16,
			"뛕",
			8
		],
		[
			"8d61",
			"뛞",
			17,
			"뛱뛲뛳뛵뛶뛷뛹뛺"
		],
		[
			"8d81",
			"뛻",
			4,
			"뜂뜃뜄뜆",
			33,
			"뜪뜫뜭뜮뜱",
			6,
			"뜺뜼",
			7,
			"띅띆띇띉띊띋띍",
			6,
			"띖",
			9,
			"띡띢띣띥띦띧띩",
			6,
			"띲띴띶",
			5,
			"띾띿랁랂랃랅",
			6,
			"랎랓랔랕랚랛랝랞"
		],
		[
			"8e41",
			"랟랡",
			6,
			"랪랮",
			5,
			"랶랷랹",
			8
		],
		[
			"8e61",
			"럂",
			4,
			"럈럊",
			19
		],
		[
			"8e81",
			"럞",
			13,
			"럮럯럱럲럳럵",
			6,
			"럾렂",
			4,
			"렊렋렍렎렏렑",
			6,
			"렚렜렞",
			5,
			"렦렧렩렪렫렭",
			6,
			"렶렺",
			5,
			"롁롂롃롅",
			11,
			"롒롔",
			7,
			"롞롟롡롢롣롥",
			6,
			"롮롰롲",
			5,
			"롹롺롻롽",
			7
		],
		[
			"8f41",
			"뢅",
			7,
			"뢎",
			17
		],
		[
			"8f61",
			"뢠",
			7,
			"뢩",
			6,
			"뢱뢲뢳뢵뢶뢷뢹",
			4
		],
		[
			"8f81",
			"뢾뢿룂룄룆",
			5,
			"룍룎룏룑룒룓룕",
			7,
			"룞룠룢",
			5,
			"룪룫룭룮룯룱",
			6,
			"룺룼룾",
			5,
			"뤅",
			18,
			"뤙",
			6,
			"뤡",
			26,
			"뤾뤿륁륂륃륅",
			6,
			"륍륎륐륒",
			5
		],
		[
			"9041",
			"륚륛륝륞륟륡",
			6,
			"륪륬륮",
			5,
			"륶륷륹륺륻륽"
		],
		[
			"9061",
			"륾",
			5,
			"릆릈릋릌릏",
			15
		],
		[
			"9081",
			"릟",
			12,
			"릮릯릱릲릳릵",
			6,
			"릾맀맂",
			5,
			"맊맋맍맓",
			4,
			"맚맜맟맠맢맦맧맩맪맫맭",
			6,
			"맶맻",
			4,
			"먂",
			5,
			"먉",
			11,
			"먖",
			33,
			"먺먻먽먾먿멁멃멄멅멆"
		],
		[
			"9141",
			"멇멊멌멏멐멑멒멖멗멙멚멛멝",
			6,
			"멦멪",
			5
		],
		[
			"9161",
			"멲멳멵멶멷멹",
			9,
			"몆몈몉몊몋몍",
			5
		],
		[
			"9181",
			"몓",
			20,
			"몪몭몮몯몱몳",
			4,
			"몺몼몾",
			5,
			"뫅뫆뫇뫉",
			14,
			"뫚",
			33,
			"뫽뫾뫿묁묂묃묅",
			7,
			"묎묐묒",
			5,
			"묙묚묛묝묞묟묡",
			6
		],
		[
			"9241",
			"묨묪묬",
			7,
			"묷묹묺묿",
			4,
			"뭆뭈뭊뭋뭌뭎뭑뭒"
		],
		[
			"9261",
			"뭓뭕뭖뭗뭙",
			7,
			"뭢뭤",
			7,
			"뭭",
			4
		],
		[
			"9281",
			"뭲",
			21,
			"뮉뮊뮋뮍뮎뮏뮑",
			18,
			"뮥뮦뮧뮩뮪뮫뮭",
			6,
			"뮵뮶뮸",
			7,
			"믁믂믃믅믆믇믉",
			6,
			"믑믒믔",
			35,
			"믺믻믽믾밁"
		],
		[
			"9341",
			"밃",
			4,
			"밊밎밐밒밓밙밚밠밡밢밣밦밨밪밫밬밮밯밲밳밵"
		],
		[
			"9361",
			"밶밷밹",
			6,
			"뱂뱆뱇뱈뱊뱋뱎뱏뱑",
			8
		],
		[
			"9381",
			"뱚뱛뱜뱞",
			37,
			"벆벇벉벊벍벏",
			4,
			"벖벘벛",
			4,
			"벢벣벥벦벩",
			6,
			"벲벶",
			5,
			"벾벿볁볂볃볅",
			7,
			"볎볒볓볔볖볗볙볚볛볝",
			22,
			"볷볹볺볻볽"
		],
		[
			"9441",
			"볾",
			5,
			"봆봈봊",
			5,
			"봑봒봓봕",
			8
		],
		[
			"9461",
			"봞",
			5,
			"봥",
			6,
			"봭",
			12
		],
		[
			"9481",
			"봺",
			5,
			"뵁",
			6,
			"뵊뵋뵍뵎뵏뵑",
			6,
			"뵚",
			9,
			"뵥뵦뵧뵩",
			22,
			"붂붃붅붆붋",
			4,
			"붒붔붖붗붘붛붝",
			6,
			"붥",
			10,
			"붱",
			6,
			"붹",
			24
		],
		[
			"9541",
			"뷒뷓뷖뷗뷙뷚뷛뷝",
			11,
			"뷪",
			5,
			"뷱"
		],
		[
			"9561",
			"뷲뷳뷵뷶뷷뷹",
			6,
			"븁븂븄븆",
			5,
			"븎븏븑븒븓"
		],
		[
			"9581",
			"븕",
			6,
			"븞븠",
			35,
			"빆빇빉빊빋빍빏",
			4,
			"빖빘빜빝빞빟빢빣빥빦빧빩빫",
			4,
			"빲빶",
			4,
			"빾빿뺁뺂뺃뺅",
			6,
			"뺎뺒",
			5,
			"뺚",
			13,
			"뺩",
			14
		],
		[
			"9641",
			"뺸",
			23,
			"뻒뻓"
		],
		[
			"9661",
			"뻕뻖뻙",
			6,
			"뻡뻢뻦",
			5,
			"뻭",
			8
		],
		[
			"9681",
			"뻶",
			10,
			"뼂",
			5,
			"뼊",
			13,
			"뼚뼞",
			33,
			"뽂뽃뽅뽆뽇뽉",
			6,
			"뽒뽓뽔뽖",
			44
		],
		[
			"9741",
			"뾃",
			16,
			"뾕",
			8
		],
		[
			"9761",
			"뾞",
			17,
			"뾱",
			7
		],
		[
			"9781",
			"뾹",
			11,
			"뿆",
			5,
			"뿎뿏뿑뿒뿓뿕",
			6,
			"뿝뿞뿠뿢",
			89,
			"쀽쀾쀿"
		],
		[
			"9841",
			"쁀",
			16,
			"쁒",
			5,
			"쁙쁚쁛"
		],
		[
			"9861",
			"쁝쁞쁟쁡",
			6,
			"쁪",
			15
		],
		[
			"9881",
			"쁺",
			21,
			"삒삓삕삖삗삙",
			6,
			"삢삤삦",
			5,
			"삮삱삲삷",
			4,
			"삾샂샃샄샆샇샊샋샍샎샏샑",
			6,
			"샚샞",
			5,
			"샦샧샩샪샫샭",
			6,
			"샶샸샺",
			5,
			"섁섂섃섅섆섇섉",
			6,
			"섑섒섓섔섖",
			5,
			"섡섢섥섨섩섪섫섮"
		],
		[
			"9941",
			"섲섳섴섵섷섺섻섽섾섿셁",
			6,
			"셊셎",
			5,
			"셖셗"
		],
		[
			"9961",
			"셙셚셛셝",
			6,
			"셦셪",
			5,
			"셱셲셳셵셶셷셹셺셻"
		],
		[
			"9981",
			"셼",
			8,
			"솆",
			5,
			"솏솑솒솓솕솗",
			4,
			"솞솠솢솣솤솦솧솪솫솭솮솯솱",
			11,
			"솾",
			5,
			"쇅쇆쇇쇉쇊쇋쇍",
			6,
			"쇕쇖쇙",
			6,
			"쇡쇢쇣쇥쇦쇧쇩",
			6,
			"쇲쇴",
			7,
			"쇾쇿숁숂숃숅",
			6,
			"숎숐숒",
			5,
			"숚숛숝숞숡숢숣"
		],
		[
			"9a41",
			"숤숥숦숧숪숬숮숰숳숵",
			16
		],
		[
			"9a61",
			"쉆쉇쉉",
			6,
			"쉒쉓쉕쉖쉗쉙",
			6,
			"쉡쉢쉣쉤쉦"
		],
		[
			"9a81",
			"쉧",
			4,
			"쉮쉯쉱쉲쉳쉵",
			6,
			"쉾슀슂",
			5,
			"슊",
			5,
			"슑",
			6,
			"슙슚슜슞",
			5,
			"슦슧슩슪슫슮",
			5,
			"슶슸슺",
			33,
			"싞싟싡싢싥",
			5,
			"싮싰싲싳싴싵싷싺싽싾싿쌁",
			6,
			"쌊쌋쌎쌏"
		],
		[
			"9b41",
			"쌐쌑쌒쌖쌗쌙쌚쌛쌝",
			6,
			"쌦쌧쌪",
			8
		],
		[
			"9b61",
			"쌳",
			17,
			"썆",
			7
		],
		[
			"9b81",
			"썎",
			25,
			"썪썫썭썮썯썱썳",
			4,
			"썺썻썾",
			5,
			"쎅쎆쎇쎉쎊쎋쎍",
			50,
			"쏁",
			22,
			"쏚"
		],
		[
			"9c41",
			"쏛쏝쏞쏡쏣",
			4,
			"쏪쏫쏬쏮",
			5,
			"쏶쏷쏹",
			5
		],
		[
			"9c61",
			"쏿",
			8,
			"쐉",
			6,
			"쐑",
			9
		],
		[
			"9c81",
			"쐛",
			8,
			"쐥",
			6,
			"쐭쐮쐯쐱쐲쐳쐵",
			6,
			"쐾",
			9,
			"쑉",
			26,
			"쑦쑧쑩쑪쑫쑭",
			6,
			"쑶쑷쑸쑺",
			5,
			"쒁",
			18,
			"쒕",
			6,
			"쒝",
			12
		],
		[
			"9d41",
			"쒪",
			13,
			"쒹쒺쒻쒽",
			8
		],
		[
			"9d61",
			"쓆",
			25
		],
		[
			"9d81",
			"쓠",
			8,
			"쓪",
			5,
			"쓲쓳쓵쓶쓷쓹쓻쓼쓽쓾씂",
			9,
			"씍씎씏씑씒씓씕",
			6,
			"씝",
			10,
			"씪씫씭씮씯씱",
			6,
			"씺씼씾",
			5,
			"앆앇앋앏앐앑앒앖앚앛앜앟앢앣앥앦앧앩",
			6,
			"앲앶",
			5,
			"앾앿얁얂얃얅얆얈얉얊얋얎얐얒얓얔"
		],
		[
			"9e41",
			"얖얙얚얛얝얞얟얡",
			7,
			"얪",
			9,
			"얶"
		],
		[
			"9e61",
			"얷얺얿",
			4,
			"엋엍엏엒엓엕엖엗엙",
			6,
			"엢엤엦엧"
		],
		[
			"9e81",
			"엨엩엪엫엯엱엲엳엵엸엹엺엻옂옃옄옉옊옋옍옎옏옑",
			6,
			"옚옝",
			6,
			"옦옧옩옪옫옯옱옲옶옸옺옼옽옾옿왂왃왅왆왇왉",
			6,
			"왒왖",
			5,
			"왞왟왡",
			10,
			"왭왮왰왲",
			5,
			"왺왻왽왾왿욁",
			6,
			"욊욌욎",
			5,
			"욖욗욙욚욛욝",
			6,
			"욦"
		],
		[
			"9f41",
			"욨욪",
			5,
			"욲욳욵욶욷욻",
			4,
			"웂웄웆",
			5,
			"웎"
		],
		[
			"9f61",
			"웏웑웒웓웕",
			6,
			"웞웟웢",
			5,
			"웪웫웭웮웯웱웲"
		],
		[
			"9f81",
			"웳",
			4,
			"웺웻웼웾",
			5,
			"윆윇윉윊윋윍",
			6,
			"윖윘윚",
			5,
			"윢윣윥윦윧윩",
			6,
			"윲윴윶윸윹윺윻윾윿읁읂읃읅",
			4,
			"읋읎읐읙읚읛읝읞읟읡",
			6,
			"읩읪읬",
			7,
			"읶읷읹읺읻읿잀잁잂잆잋잌잍잏잒잓잕잙잛",
			4,
			"잢잧",
			4,
			"잮잯잱잲잳잵잶잷"
		],
		[
			"a041",
			"잸잹잺잻잾쟂",
			5,
			"쟊쟋쟍쟏쟑",
			6,
			"쟙쟚쟛쟜"
		],
		[
			"a061",
			"쟞",
			5,
			"쟥쟦쟧쟩쟪쟫쟭",
			13
		],
		[
			"a081",
			"쟻",
			4,
			"젂젃젅젆젇젉젋",
			4,
			"젒젔젗",
			4,
			"젞젟젡젢젣젥",
			6,
			"젮젰젲",
			5,
			"젹젺젻젽젾젿졁",
			6,
			"졊졋졎",
			5,
			"졕",
			26,
			"졲졳졵졶졷졹졻",
			4,
			"좂좄좈좉좊좎",
			5,
			"좕",
			7,
			"좞좠좢좣좤"
		],
		[
			"a141",
			"좥좦좧좩",
			18,
			"좾좿죀죁"
		],
		[
			"a161",
			"죂죃죅죆죇죉죊죋죍",
			6,
			"죖죘죚",
			5,
			"죢죣죥"
		],
		[
			"a181",
			"죦",
			14,
			"죶",
			5,
			"죾죿줁줂줃줇",
			4,
			"줎　、。·‥…¨〃­―∥＼∼‘’“”〔〕〈",
			9,
			"±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§※☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓≪≫√∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢"
		],
		[
			"a241",
			"줐줒",
			5,
			"줙",
			18
		],
		[
			"a261",
			"줭",
			6,
			"줵",
			18
		],
		[
			"a281",
			"쥈",
			7,
			"쥒쥓쥕쥖쥗쥙",
			6,
			"쥢쥤",
			7,
			"쥭쥮쥯⇒⇔∀∃´～ˇ˘˝˚˙¸˛¡¿ː∮∑∏¤℉‰◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®"
		],
		[
			"a341",
			"쥱쥲쥳쥵",
			6,
			"쥽",
			10,
			"즊즋즍즎즏"
		],
		[
			"a361",
			"즑",
			6,
			"즚즜즞",
			16
		],
		[
			"a381",
			"즯",
			16,
			"짂짃짅짆짉짋",
			4,
			"짒짔짗짘짛！",
			58,
			"￦］",
			32,
			"￣"
		],
		[
			"a441",
			"짞짟짡짣짥짦짨짩짪짫짮짲",
			5,
			"짺짻짽짾짿쨁쨂쨃쨄"
		],
		[
			"a461",
			"쨅쨆쨇쨊쨎",
			5,
			"쨕쨖쨗쨙",
			12
		],
		[
			"a481",
			"쨦쨧쨨쨪",
			28,
			"ㄱ",
			93
		],
		[
			"a541",
			"쩇",
			4,
			"쩎쩏쩑쩒쩓쩕",
			6,
			"쩞쩢",
			5,
			"쩩쩪"
		],
		[
			"a561",
			"쩫",
			17,
			"쩾",
			5,
			"쪅쪆"
		],
		[
			"a581",
			"쪇",
			16,
			"쪙",
			14,
			"ⅰ",
			9
		],
		[
			"a5b0",
			"Ⅰ",
			9
		],
		[
			"a5c1",
			"Α",
			16,
			"Σ",
			6
		],
		[
			"a5e1",
			"α",
			16,
			"σ",
			6
		],
		[
			"a641",
			"쪨",
			19,
			"쪾쪿쫁쫂쫃쫅"
		],
		[
			"a661",
			"쫆",
			5,
			"쫎쫐쫒쫔쫕쫖쫗쫚",
			5,
			"쫡",
			6
		],
		[
			"a681",
			"쫨쫩쫪쫫쫭",
			6,
			"쫵",
			18,
			"쬉쬊─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂┒┑┚┙┖┕┎┍┞┟┡┢┦┧┩┪┭┮┱┲┵┶┹┺┽┾╀╁╃",
			7
		],
		[
			"a741",
			"쬋",
			4,
			"쬑쬒쬓쬕쬖쬗쬙",
			6,
			"쬢",
			7
		],
		[
			"a761",
			"쬪",
			22,
			"쭂쭃쭄"
		],
		[
			"a781",
			"쭅쭆쭇쭊쭋쭍쭎쭏쭑",
			6,
			"쭚쭛쭜쭞",
			5,
			"쭥",
			7,
			"㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙",
			9,
			"㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰",
			9,
			"㎀",
			4,
			"㎺",
			5,
			"㎐",
			4,
			"Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆"
		],
		[
			"a841",
			"쭭",
			10,
			"쭺",
			14
		],
		[
			"a861",
			"쮉",
			18,
			"쮝",
			6
		],
		[
			"a881",
			"쮤",
			19,
			"쮹",
			11,
			"ÆÐªĦ"
		],
		["a8a6", "Ĳ"],
		["a8a8", "ĿŁØŒºÞŦŊ"],
		[
			"a8b1",
			"㉠",
			27,
			"ⓐ",
			25,
			"①",
			14,
			"½⅓⅔¼¾⅛⅜⅝⅞"
		],
		[
			"a941",
			"쯅",
			14,
			"쯕",
			10
		],
		[
			"a961",
			"쯠쯡쯢쯣쯥쯦쯨쯪",
			18
		],
		[
			"a981",
			"쯽",
			14,
			"찎찏찑찒찓찕",
			6,
			"찞찟찠찣찤æđðħıĳĸŀłøœßþŧŋŉ㈀",
			27,
			"⒜",
			25,
			"⑴",
			14,
			"¹²³⁴ⁿ₁₂₃₄"
		],
		[
			"aa41",
			"찥찦찪찫찭찯찱",
			6,
			"찺찿",
			4,
			"챆챇챉챊챋챍챎"
		],
		[
			"aa61",
			"챏",
			4,
			"챖챚",
			5,
			"챡챢챣챥챧챩",
			6,
			"챱챲"
		],
		[
			"aa81",
			"챳챴챶",
			29,
			"ぁ",
			82
		],
		[
			"ab41",
			"첔첕첖첗첚첛첝첞첟첡",
			6,
			"첪첮",
			5,
			"첶첷첹"
		],
		[
			"ab61",
			"첺첻첽",
			6,
			"쳆쳈쳊",
			5,
			"쳑쳒쳓쳕",
			5
		],
		[
			"ab81",
			"쳛",
			8,
			"쳥",
			6,
			"쳭쳮쳯쳱",
			12,
			"ァ",
			85
		],
		[
			"ac41",
			"쳾쳿촀촂",
			5,
			"촊촋촍촎촏촑",
			6,
			"촚촜촞촟촠"
		],
		[
			"ac61",
			"촡촢촣촥촦촧촩촪촫촭",
			11,
			"촺",
			4
		],
		[
			"ac81",
			"촿",
			28,
			"쵝쵞쵟А",
			5,
			"ЁЖ",
			25
		],
		[
			"acd1",
			"а",
			5,
			"ёж",
			25
		],
		[
			"ad41",
			"쵡쵢쵣쵥",
			6,
			"쵮쵰쵲",
			5,
			"쵹",
			7
		],
		[
			"ad61",
			"춁",
			6,
			"춉",
			10,
			"춖춗춙춚춛춝춞춟"
		],
		[
			"ad81",
			"춠춡춢춣춦춨춪",
			5,
			"춱",
			18,
			"췅"
		],
		[
			"ae41",
			"췆",
			5,
			"췍췎췏췑",
			16
		],
		[
			"ae61",
			"췢",
			5,
			"췩췪췫췭췮췯췱",
			6,
			"췺췼췾",
			4
		],
		[
			"ae81",
			"츃츅츆츇츉츊츋츍",
			6,
			"츕츖츗츘츚",
			5,
			"츢츣츥츦츧츩츪츫"
		],
		[
			"af41",
			"츬츭츮츯츲츴츶",
			19
		],
		[
			"af61",
			"칊",
			13,
			"칚칛칝칞칢",
			5,
			"칪칬"
		],
		[
			"af81",
			"칮",
			5,
			"칶칷칹칺칻칽",
			6,
			"캆캈캊",
			5,
			"캒캓캕캖캗캙"
		],
		[
			"b041",
			"캚",
			5,
			"캢캦",
			5,
			"캮",
			12
		],
		[
			"b061",
			"캻",
			5,
			"컂",
			19
		],
		[
			"b081",
			"컖",
			13,
			"컦컧컩컪컭",
			6,
			"컶컺",
			5,
			"가각간갇갈갉갊감",
			7,
			"같",
			4,
			"갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆"
		],
		[
			"b141",
			"켂켃켅켆켇켉",
			6,
			"켒켔켖",
			5,
			"켝켞켟켡켢켣"
		],
		[
			"b161",
			"켥",
			6,
			"켮켲",
			5,
			"켹",
			11
		],
		[
			"b181",
			"콅",
			14,
			"콖콗콙콚콛콝",
			6,
			"콦콨콪콫콬괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸"
		],
		[
			"b241",
			"콭콮콯콲콳콵콶콷콹",
			6,
			"쾁쾂쾃쾄쾆",
			5,
			"쾍"
		],
		[
			"b261",
			"쾎",
			18,
			"쾢",
			5,
			"쾩"
		],
		[
			"b281",
			"쾪",
			5,
			"쾱",
			18,
			"쿅",
			6,
			"깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙"
		],
		[
			"b341",
			"쿌",
			19,
			"쿢쿣쿥쿦쿧쿩"
		],
		[
			"b361",
			"쿪",
			5,
			"쿲쿴쿶",
			5,
			"쿽쿾쿿퀁퀂퀃퀅",
			5
		],
		[
			"b381",
			"퀋",
			5,
			"퀒",
			5,
			"퀙",
			19,
			"끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫",
			4,
			"낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝"
		],
		[
			"b441",
			"퀮",
			5,
			"퀶퀷퀹퀺퀻퀽",
			6,
			"큆큈큊",
			5
		],
		[
			"b461",
			"큑큒큓큕큖큗큙",
			6,
			"큡",
			10,
			"큮큯"
		],
		[
			"b481",
			"큱큲큳큵",
			6,
			"큾큿킀킂",
			18,
			"뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫",
			4,
			"닳담답닷",
			4,
			"닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥"
		],
		[
			"b541",
			"킕",
			14,
			"킦킧킩킪킫킭",
			5
		],
		[
			"b561",
			"킳킶킸킺",
			5,
			"탂탃탅탆탇탊",
			5,
			"탒탖",
			4
		],
		[
			"b581",
			"탛탞탟탡탢탣탥",
			6,
			"탮탲",
			5,
			"탹",
			11,
			"덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸"
		],
		[
			"b641",
			"턅",
			7,
			"턎",
			17
		],
		[
			"b661",
			"턠",
			15,
			"턲턳턵턶턷턹턻턼턽턾"
		],
		[
			"b681",
			"턿텂텆",
			5,
			"텎텏텑텒텓텕",
			6,
			"텞텠텢",
			5,
			"텩텪텫텭땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗"
		],
		[
			"b741",
			"텮",
			13,
			"텽",
			6,
			"톅톆톇톉톊"
		],
		[
			"b761",
			"톋",
			20,
			"톢톣톥톦톧"
		],
		[
			"b781",
			"톩",
			6,
			"톲톴톶톷톸톹톻톽톾톿퇁",
			14,
			"래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩"
		],
		[
			"b841",
			"퇐",
			7,
			"퇙",
			17
		],
		[
			"b861",
			"퇫",
			8,
			"퇵퇶퇷퇹",
			13
		],
		[
			"b881",
			"툈툊",
			5,
			"툑",
			24,
			"륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많",
			4,
			"맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼"
		],
		[
			"b941",
			"툪툫툮툯툱툲툳툵",
			6,
			"툾퉀퉂",
			5,
			"퉉퉊퉋퉌"
		],
		[
			"b961",
			"퉍",
			14,
			"퉝",
			6,
			"퉥퉦퉧퉨"
		],
		[
			"b981",
			"퉩",
			22,
			"튂튃튅튆튇튉튊튋튌묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바",
			4,
			"받",
			4,
			"밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗"
		],
		[
			"ba41",
			"튍튎튏튒튓튔튖",
			5,
			"튝튞튟튡튢튣튥",
			6,
			"튭"
		],
		[
			"ba61",
			"튮튯튰튲",
			5,
			"튺튻튽튾틁틃",
			4,
			"틊틌",
			5
		],
		[
			"ba81",
			"틒틓틕틖틗틙틚틛틝",
			6,
			"틦",
			9,
			"틲틳틵틶틷틹틺벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤"
		],
		[
			"bb41",
			"틻",
			4,
			"팂팄팆",
			5,
			"팏팑팒팓팕팗",
			4,
			"팞팢팣"
		],
		[
			"bb61",
			"팤팦팧팪팫팭팮팯팱",
			6,
			"팺팾",
			5,
			"퍆퍇퍈퍉"
		],
		[
			"bb81",
			"퍊",
			31,
			"빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤"
		],
		[
			"bc41",
			"퍪",
			17,
			"퍾퍿펁펂펃펅펆펇"
		],
		[
			"bc61",
			"펈펉펊펋펎펒",
			5,
			"펚펛펝펞펟펡",
			6,
			"펪펬펮"
		],
		[
			"bc81",
			"펯",
			4,
			"펵펶펷펹펺펻펽",
			6,
			"폆폇폊",
			5,
			"폑",
			5,
			"샥샨샬샴샵샷샹섀섄섈섐섕서",
			4,
			"섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭"
		],
		[
			"bd41",
			"폗폙",
			7,
			"폢폤",
			7,
			"폮폯폱폲폳폵폶폷"
		],
		[
			"bd61",
			"폸폹폺폻폾퐀퐂",
			5,
			"퐉",
			13
		],
		[
			"bd81",
			"퐗",
			5,
			"퐞",
			25,
			"숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰"
		],
		[
			"be41",
			"퐸",
			7,
			"푁푂푃푅",
			14
		],
		[
			"be61",
			"푔",
			7,
			"푝푞푟푡푢푣푥",
			7,
			"푮푰푱푲"
		],
		[
			"be81",
			"푳",
			4,
			"푺푻푽푾풁풃",
			4,
			"풊풌풎",
			5,
			"풕",
			8,
			"쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄",
			6,
			"엌엎"
		],
		[
			"bf41",
			"풞",
			10,
			"풪",
			14
		],
		[
			"bf61",
			"풹",
			18,
			"퓍퓎퓏퓑퓒퓓퓕"
		],
		[
			"bf81",
			"퓖",
			5,
			"퓝퓞퓠",
			7,
			"퓩퓪퓫퓭퓮퓯퓱",
			6,
			"퓹퓺퓼에엑엔엘엠엡엣엥여역엮연열엶엷염",
			5,
			"옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨"
		],
		[
			"c041",
			"퓾",
			5,
			"픅픆픇픉픊픋픍",
			6,
			"픖픘",
			5
		],
		[
			"c061",
			"픞",
			25
		],
		[
			"c081",
			"픸픹픺픻픾픿핁핂핃핅",
			6,
			"핎핐핒",
			5,
			"핚핛핝핞핟핡핢핣웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응",
			7,
			"읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊"
		],
		[
			"c141",
			"핤핦핧핪핬핮",
			5,
			"핶핷핹핺핻핽",
			6,
			"햆햊햋"
		],
		[
			"c161",
			"햌햍햎햏햑",
			19,
			"햦햧"
		],
		[
			"c181",
			"햨",
			31,
			"점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓"
		],
		[
			"c241",
			"헊헋헍헎헏헑헓",
			4,
			"헚헜헞",
			5,
			"헦헧헩헪헫헭헮"
		],
		[
			"c261",
			"헯",
			4,
			"헶헸헺",
			5,
			"혂혃혅혆혇혉",
			6,
			"혒"
		],
		[
			"c281",
			"혖",
			5,
			"혝혞혟혡혢혣혥",
			7,
			"혮",
			9,
			"혺혻징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻"
		],
		[
			"c341",
			"혽혾혿홁홂홃홄홆홇홊홌홎홏홐홒홓홖홗홙홚홛홝",
			4
		],
		[
			"c361",
			"홢",
			4,
			"홨홪",
			5,
			"홲홳홵",
			11
		],
		[
			"c381",
			"횁횂횄횆",
			5,
			"횎횏횑횒횓횕",
			7,
			"횞횠횢",
			5,
			"횩횪찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층"
		],
		[
			"c441",
			"횫횭횮횯횱",
			7,
			"횺횼",
			7,
			"훆훇훉훊훋"
		],
		[
			"c461",
			"훍훎훏훐훒훓훕훖훘훚",
			5,
			"훡훢훣훥훦훧훩",
			4
		],
		[
			"c481",
			"훮훯훱훲훳훴훶",
			5,
			"훾훿휁휂휃휅",
			11,
			"휒휓휔치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼"
		],
		[
			"c541",
			"휕휖휗휚휛휝휞휟휡",
			6,
			"휪휬휮",
			5,
			"휶휷휹"
		],
		[
			"c561",
			"휺휻휽",
			6,
			"흅흆흈흊",
			5,
			"흒흓흕흚",
			4
		],
		[
			"c581",
			"흟흢흤흦흧흨흪흫흭흮흯흱흲흳흵",
			6,
			"흾흿힀힂",
			5,
			"힊힋큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜"
		],
		[
			"c641",
			"힍힎힏힑",
			6,
			"힚힜힞",
			5
		],
		["c6a1", "퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁"],
		["c7a1", "퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠"],
		["c8a1", "혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝"],
		["caa1", "伽佳假價加可呵哥嘉嫁家暇架枷柯歌珂痂稼苛茄街袈訶賈跏軻迦駕刻却各恪慤殼珏脚覺角閣侃刊墾奸姦干幹懇揀杆柬桿澗癎看磵稈竿簡肝艮艱諫間乫喝曷渴碣竭葛褐蝎鞨勘坎堪嵌感憾戡敢柑橄減甘疳監瞰紺邯鑑鑒龕"],
		["cba1", "匣岬甲胛鉀閘剛堈姜岡崗康强彊慷江畺疆糠絳綱羌腔舡薑襁講鋼降鱇介价個凱塏愷愾慨改槪漑疥皆盖箇芥蓋豈鎧開喀客坑更粳羹醵倨去居巨拒据據擧渠炬祛距踞車遽鉅鋸乾件健巾建愆楗腱虔蹇鍵騫乞傑杰桀儉劍劒檢"],
		["cca1", "瞼鈐黔劫怯迲偈憩揭擊格檄激膈覡隔堅牽犬甄絹繭肩見譴遣鵑抉決潔結缺訣兼慊箝謙鉗鎌京俓倞傾儆勁勍卿坰境庚徑慶憬擎敬景暻更梗涇炅烱璟璥瓊痙硬磬竟競絅經耕耿脛莖警輕逕鏡頃頸驚鯨係啓堺契季屆悸戒桂械"],
		["cda1", "棨溪界癸磎稽系繫繼計誡谿階鷄古叩告呱固姑孤尻庫拷攷故敲暠枯槁沽痼皐睾稿羔考股膏苦苽菰藁蠱袴誥賈辜錮雇顧高鼓哭斛曲梏穀谷鵠困坤崑昆梱棍滾琨袞鯤汨滑骨供公共功孔工恐恭拱控攻珙空蚣貢鞏串寡戈果瓜"],
		["cea1", "科菓誇課跨過鍋顆廓槨藿郭串冠官寬慣棺款灌琯瓘管罐菅觀貫關館刮恝括适侊光匡壙廣曠洸炚狂珖筐胱鑛卦掛罫乖傀塊壞怪愧拐槐魁宏紘肱轟交僑咬喬嬌嶠巧攪敎校橋狡皎矯絞翹膠蕎蛟較轎郊餃驕鮫丘久九仇俱具勾"],
		["cfa1", "區口句咎嘔坵垢寇嶇廐懼拘救枸柩構歐毆毬求溝灸狗玖球瞿矩究絿耉臼舅舊苟衢謳購軀逑邱鉤銶駒驅鳩鷗龜國局菊鞠鞫麴君窘群裙軍郡堀屈掘窟宮弓穹窮芎躬倦券勸卷圈拳捲權淃眷厥獗蕨蹶闕机櫃潰詭軌饋句晷歸貴"],
		["d0a1", "鬼龜叫圭奎揆槻珪硅窺竅糾葵規赳逵閨勻均畇筠菌鈞龜橘克剋劇戟棘極隙僅劤勤懃斤根槿瑾筋芹菫覲謹近饉契今妗擒昑檎琴禁禽芩衾衿襟金錦伋及急扱汲級給亘兢矜肯企伎其冀嗜器圻基埼夔奇妓寄岐崎己幾忌技旗旣"],
		[
			"d1a1",
			"朞期杞棋棄機欺氣汽沂淇玘琦琪璂璣畸畿碁磯祁祇祈祺箕紀綺羈耆耭肌記譏豈起錡錤飢饑騎騏驥麒緊佶吉拮桔金喫儺喇奈娜懦懶拏拿癩",
			5,
			"那樂",
			4,
			"諾酪駱亂卵暖欄煖爛蘭難鸞捏捺南嵐枏楠湳濫男藍襤拉"
		],
		[
			"d2a1",
			"納臘蠟衲囊娘廊",
			4,
			"乃來內奈柰耐冷女年撚秊念恬拈捻寧寗努勞奴弩怒擄櫓爐瑙盧",
			5,
			"駑魯",
			10,
			"濃籠聾膿農惱牢磊腦賂雷尿壘",
			7,
			"嫩訥杻紐勒",
			5,
			"能菱陵尼泥匿溺多茶"
		],
		["d3a1", "丹亶但單團壇彖斷旦檀段湍短端簞緞蛋袒鄲鍛撻澾獺疸達啖坍憺擔曇淡湛潭澹痰聃膽蕁覃談譚錟沓畓答踏遝唐堂塘幢戇撞棠當糖螳黨代垈坮大對岱帶待戴擡玳臺袋貸隊黛宅德悳倒刀到圖堵塗導屠島嶋度徒悼挑掉搗桃"],
		["d4a1", "棹櫂淘渡滔濤燾盜睹禱稻萄覩賭跳蹈逃途道都鍍陶韜毒瀆牘犢獨督禿篤纛讀墩惇敦旽暾沌焞燉豚頓乭突仝冬凍動同憧東桐棟洞潼疼瞳童胴董銅兜斗杜枓痘竇荳讀豆逗頭屯臀芚遁遯鈍得嶝橙燈登等藤謄鄧騰喇懶拏癩羅"],
		["d5a1", "蘿螺裸邏樂洛烙珞絡落諾酪駱丹亂卵欄欒瀾爛蘭鸞剌辣嵐擥攬欖濫籃纜藍襤覽拉臘蠟廊朗浪狼琅瑯螂郞來崍徠萊冷掠略亮倆兩凉梁樑粮粱糧良諒輛量侶儷勵呂廬慮戾旅櫚濾礪藜蠣閭驢驪麗黎力曆歷瀝礫轢靂憐戀攣漣"],
		["d6a1", "煉璉練聯蓮輦連鍊冽列劣洌烈裂廉斂殮濂簾獵令伶囹寧岺嶺怜玲笭羚翎聆逞鈴零靈領齡例澧禮醴隷勞怒撈擄櫓潞瀘爐盧老蘆虜路輅露魯鷺鹵碌祿綠菉錄鹿麓論壟弄朧瀧瓏籠聾儡瀨牢磊賂賚賴雷了僚寮廖料燎療瞭聊蓼"],
		["d7a1", "遼鬧龍壘婁屢樓淚漏瘻累縷蔞褸鏤陋劉旒柳榴流溜瀏琉瑠留瘤硫謬類六戮陸侖倫崙淪綸輪律慄栗率隆勒肋凜凌楞稜綾菱陵俚利厘吏唎履悧李梨浬犁狸理璃異痢籬罹羸莉裏裡里釐離鯉吝潾燐璘藺躪隣鱗麟林淋琳臨霖砬"],
		["d8a1", "立笠粒摩瑪痲碼磨馬魔麻寞幕漠膜莫邈万卍娩巒彎慢挽晩曼滿漫灣瞞萬蔓蠻輓饅鰻唜抹末沫茉襪靺亡妄忘忙望網罔芒茫莽輞邙埋妹媒寐昧枚梅每煤罵買賣邁魅脈貊陌驀麥孟氓猛盲盟萌冪覓免冕勉棉沔眄眠綿緬面麵滅"],
		["d9a1", "蔑冥名命明暝椧溟皿瞑茗蓂螟酩銘鳴袂侮冒募姆帽慕摸摹暮某模母毛牟牡瑁眸矛耗芼茅謀謨貌木沐牧目睦穆鶩歿沒夢朦蒙卯墓妙廟描昴杳渺猫竗苗錨務巫憮懋戊拇撫无楙武毋無珷畝繆舞茂蕪誣貿霧鵡墨默們刎吻問文"],
		["daa1", "汶紊紋聞蚊門雯勿沕物味媚尾嵋彌微未梶楣渼湄眉米美薇謎迷靡黴岷悶愍憫敏旻旼民泯玟珉緡閔密蜜謐剝博拍搏撲朴樸泊珀璞箔粕縛膊舶薄迫雹駁伴半反叛拌搬攀斑槃泮潘班畔瘢盤盼磐磻礬絆般蟠返頒飯勃拔撥渤潑"],
		["dba1", "發跋醱鉢髮魃倣傍坊妨尨幇彷房放方旁昉枋榜滂磅紡肪膀舫芳蒡蚌訪謗邦防龐倍俳北培徘拜排杯湃焙盃背胚裴裵褙賠輩配陪伯佰帛柏栢白百魄幡樊煩燔番磻繁蕃藩飜伐筏罰閥凡帆梵氾汎泛犯範范法琺僻劈壁擘檗璧癖"],
		["dca1", "碧蘗闢霹便卞弁變辨辯邊別瞥鱉鼈丙倂兵屛幷昞昺柄棅炳甁病秉竝輧餠騈保堡報寶普步洑湺潽珤甫菩補褓譜輔伏僕匐卜宓復服福腹茯蔔複覆輹輻馥鰒本乶俸奉封峯峰捧棒烽熢琫縫蓬蜂逢鋒鳳不付俯傅剖副否咐埠夫婦"],
		["dda1", "孚孵富府復扶敷斧浮溥父符簿缶腐腑膚艀芙莩訃負賦賻赴趺部釜阜附駙鳧北分吩噴墳奔奮忿憤扮昐汾焚盆粉糞紛芬賁雰不佛弗彿拂崩朋棚硼繃鵬丕備匕匪卑妃婢庇悲憊扉批斐枇榧比毖毗毘沸泌琵痺砒碑秕秘粃緋翡肥"],
		["dea1", "脾臂菲蜚裨誹譬費鄙非飛鼻嚬嬪彬斌檳殯浜濱瀕牝玭貧賓頻憑氷聘騁乍事些仕伺似使俟僿史司唆嗣四士奢娑寫寺射巳師徙思捨斜斯柶査梭死沙泗渣瀉獅砂社祀祠私篩紗絲肆舍莎蓑蛇裟詐詞謝賜赦辭邪飼駟麝削數朔索"],
		["dfa1", "傘刪山散汕珊産疝算蒜酸霰乷撒殺煞薩三參杉森渗芟蔘衫揷澁鈒颯上傷像償商喪嘗孀尙峠常床庠廂想桑橡湘爽牀狀相祥箱翔裳觴詳象賞霜塞璽賽嗇塞穡索色牲生甥省笙墅壻嶼序庶徐恕抒捿敍暑曙書栖棲犀瑞筮絮緖署"],
		["e0a1", "胥舒薯西誓逝鋤黍鼠夕奭席惜昔晳析汐淅潟石碩蓆釋錫仙僊先善嬋宣扇敾旋渲煽琁瑄璇璿癬禪線繕羨腺膳船蘚蟬詵跣選銑鐥饍鮮卨屑楔泄洩渫舌薛褻設說雪齧剡暹殲纖蟾贍閃陝攝涉燮葉城姓宬性惺成星晟猩珹盛省筬"],
		["e1a1", "聖聲腥誠醒世勢歲洗稅笹細說貰召嘯塑宵小少巢所掃搔昭梳沼消溯瀟炤燒甦疏疎瘙笑篠簫素紹蔬蕭蘇訴逍遡邵銷韶騷俗屬束涑粟續謖贖速孫巽損蓀遜飡率宋悚松淞訟誦送頌刷殺灑碎鎖衰釗修受嗽囚垂壽嫂守岫峀帥愁"],
		["e2a1", "戍手授搜收數樹殊水洙漱燧狩獸琇璲瘦睡秀穗竪粹綏綬繡羞脩茱蒐蓚藪袖誰讐輸遂邃酬銖銹隋隧隨雖需須首髓鬚叔塾夙孰宿淑潚熟琡璹肅菽巡徇循恂旬栒楯橓殉洵淳珣盾瞬筍純脣舜荀蓴蕣詢諄醇錞順馴戌術述鉥崇崧"],
		["e3a1", "嵩瑟膝蝨濕拾習褶襲丞乘僧勝升承昇繩蠅陞侍匙嘶始媤尸屎屍市弑恃施是時枾柴猜矢示翅蒔蓍視試詩諡豕豺埴寔式息拭植殖湜熄篒蝕識軾食飾伸侁信呻娠宸愼新晨燼申神紳腎臣莘薪藎蜃訊身辛辰迅失室實悉審尋心沁"],
		["e4a1", "沈深瀋甚芯諶什十拾雙氏亞俄兒啞娥峨我牙芽莪蛾衙訝阿雅餓鴉鵝堊岳嶽幄惡愕握樂渥鄂鍔顎鰐齷安岸按晏案眼雁鞍顔鮟斡謁軋閼唵岩巖庵暗癌菴闇壓押狎鴨仰央怏昻殃秧鴦厓哀埃崖愛曖涯碍艾隘靄厄扼掖液縊腋額"],
		["e5a1", "櫻罌鶯鸚也倻冶夜惹揶椰爺耶若野弱掠略約若葯蒻藥躍亮佯兩凉壤孃恙揚攘敭暘梁楊樣洋瀁煬痒瘍禳穰糧羊良襄諒讓釀陽量養圄御於漁瘀禦語馭魚齬億憶抑檍臆偃堰彦焉言諺孼蘖俺儼嚴奄掩淹嶪業円予余勵呂女如廬"],
		["e6a1", "旅歟汝濾璵礖礪與艅茹輿轝閭餘驪麗黎亦力域役易曆歷疫繹譯轢逆驛嚥堧姸娟宴年延憐戀捐挻撚椽沇沿涎涓淵演漣烟然煙煉燃燕璉硏硯秊筵緣練縯聯衍軟輦蓮連鉛鍊鳶列劣咽悅涅烈熱裂說閱厭廉念捻染殮炎焰琰艶苒"],
		["e7a1", "簾閻髥鹽曄獵燁葉令囹塋寧嶺嶸影怜映暎楹榮永泳渶潁濚瀛瀯煐營獰玲瑛瑩瓔盈穎纓羚聆英詠迎鈴鍈零霙靈領乂倪例刈叡曳汭濊猊睿穢芮藝蘂禮裔詣譽豫醴銳隸霓預五伍俉傲午吾吳嗚塢墺奧娛寤悟惡懊敖旿晤梧汚澳"],
		["e8a1", "烏熬獒筽蜈誤鰲鼇屋沃獄玉鈺溫瑥瘟穩縕蘊兀壅擁瓮甕癰翁邕雍饔渦瓦窩窪臥蛙蝸訛婉完宛梡椀浣玩琓琬碗緩翫脘腕莞豌阮頑曰往旺枉汪王倭娃歪矮外嵬巍猥畏了僚僥凹堯夭妖姚寥寮尿嶢拗搖撓擾料曜樂橈燎燿瑤療"],
		["e9a1", "窈窯繇繞耀腰蓼蟯要謠遙遼邀饒慾欲浴縟褥辱俑傭冗勇埇墉容庸慂榕涌湧溶熔瑢用甬聳茸蓉踊鎔鏞龍于佑偶優又友右宇寓尤愚憂旴牛玗瑀盂祐禑禹紆羽芋藕虞迂遇郵釪隅雨雩勖彧旭昱栯煜稶郁頊云暈橒殞澐熉耘芸蕓"],
		["eaa1", "運隕雲韻蔚鬱亐熊雄元原員圓園垣媛嫄寃怨愿援沅洹湲源爰猿瑗苑袁轅遠阮院願鴛月越鉞位偉僞危圍委威尉慰暐渭爲瑋緯胃萎葦蔿蝟衛褘謂違韋魏乳侑儒兪劉唯喩孺宥幼幽庾悠惟愈愉揄攸有杻柔柚柳楡楢油洧流游溜"],
		["eba1", "濡猶猷琉瑜由留癒硫紐維臾萸裕誘諛諭踰蹂遊逾遺酉釉鍮類六堉戮毓肉育陸倫允奫尹崙淪潤玧胤贇輪鈗閏律慄栗率聿戎瀜絨融隆垠恩慇殷誾銀隱乙吟淫蔭陰音飮揖泣邑凝應膺鷹依倚儀宜意懿擬椅毅疑矣義艤薏蟻衣誼"],
		["eca1", "議醫二以伊利吏夷姨履已弛彛怡易李梨泥爾珥理異痍痢移罹而耳肄苡荑裏裡貽貳邇里離飴餌匿溺瀷益翊翌翼謚人仁刃印吝咽因姻寅引忍湮燐璘絪茵藺蚓認隣靭靷鱗麟一佚佾壹日溢逸鎰馹任壬妊姙恁林淋稔臨荏賃入卄"],
		["eda1", "立笠粒仍剩孕芿仔刺咨姉姿子字孜恣慈滋炙煮玆瓷疵磁紫者自茨蔗藉諮資雌作勺嚼斫昨灼炸爵綽芍酌雀鵲孱棧殘潺盞岑暫潛箴簪蠶雜丈仗匠場墻壯奬將帳庄張掌暲杖樟檣欌漿牆狀獐璋章粧腸臟臧莊葬蔣薔藏裝贓醬長"],
		["eea1", "障再哉在宰才材栽梓渽滓災縡裁財載齋齎爭箏諍錚佇低儲咀姐底抵杵楮樗沮渚狙猪疽箸紵苧菹著藷詛貯躇這邸雎齟勣吊嫡寂摘敵滴狄炙的積笛籍績翟荻謫賊赤跡蹟迪迹適鏑佃佺傳全典前剪塡塼奠專展廛悛戰栓殿氈澱"],
		["efa1", "煎琠田甸畑癲筌箋箭篆纏詮輾轉鈿銓錢鐫電顚顫餞切截折浙癤竊節絶占岾店漸点粘霑鮎點接摺蝶丁井亭停偵呈姃定幀庭廷征情挺政整旌晶晸柾楨檉正汀淀淨渟湞瀞炡玎珽町睛碇禎程穽精綎艇訂諪貞鄭酊釘鉦鋌錠霆靖"],
		["f0a1", "靜頂鼎制劑啼堤帝弟悌提梯濟祭第臍薺製諸蹄醍除際霽題齊俎兆凋助嘲弔彫措操早晁曺曹朝條棗槽漕潮照燥爪璪眺祖祚租稠窕粗糟組繰肇藻蚤詔調趙躁造遭釣阻雕鳥族簇足鏃存尊卒拙猝倧宗從悰慫棕淙琮種終綜縱腫"],
		["f1a1", "踪踵鍾鐘佐坐左座挫罪主住侏做姝胄呪周嗾奏宙州廚晝朱柱株注洲湊澍炷珠疇籌紂紬綢舟蛛註誅走躊輳週酎酒鑄駐竹粥俊儁准埈寯峻晙樽浚準濬焌畯竣蠢逡遵雋駿茁中仲衆重卽櫛楫汁葺增憎曾拯烝甑症繒蒸證贈之只"],
		["f2a1", "咫地址志持指摯支旨智枝枳止池沚漬知砥祉祗紙肢脂至芝芷蜘誌識贄趾遲直稙稷織職唇嗔塵振搢晉晋桭榛殄津溱珍瑨璡畛疹盡眞瞋秦縉縝臻蔯袗診賑軫辰進鎭陣陳震侄叱姪嫉帙桎瓆疾秩窒膣蛭質跌迭斟朕什執潗緝輯"],
		["f3a1", "鏶集徵懲澄且侘借叉嗟嵯差次此磋箚茶蹉車遮捉搾着窄錯鑿齪撰澯燦璨瓚竄簒纂粲纘讚贊鑽餐饌刹察擦札紮僭參塹慘慙懺斬站讒讖倉倡創唱娼廠彰愴敞昌昶暢槍滄漲猖瘡窓脹艙菖蒼債埰寀寨彩採砦綵菜蔡采釵冊柵策"],
		["f4a1", "責凄妻悽處倜刺剔尺慽戚拓擲斥滌瘠脊蹠陟隻仟千喘天川擅泉淺玔穿舛薦賤踐遷釧闡阡韆凸哲喆徹撤澈綴輟轍鐵僉尖沾添甛瞻簽籤詹諂堞妾帖捷牒疊睫諜貼輒廳晴淸聽菁請靑鯖切剃替涕滯締諦逮遞體初剿哨憔抄招梢"],
		["f5a1", "椒楚樵炒焦硝礁礎秒稍肖艸苕草蕉貂超酢醋醮促囑燭矗蜀觸寸忖村邨叢塚寵悤憁摠總聰蔥銃撮催崔最墜抽推椎楸樞湫皺秋芻萩諏趨追鄒酋醜錐錘鎚雛騶鰍丑畜祝竺筑築縮蓄蹙蹴軸逐春椿瑃出朮黜充忠沖蟲衝衷悴膵萃"],
		["f6a1", "贅取吹嘴娶就炊翠聚脆臭趣醉驟鷲側仄厠惻測層侈値嗤峙幟恥梔治淄熾痔痴癡稚穉緇緻置致蚩輜雉馳齒則勅飭親七柒漆侵寢枕沈浸琛砧針鍼蟄秤稱快他咤唾墮妥惰打拖朶楕舵陀馱駝倬卓啄坼度托拓擢晫柝濁濯琢琸託"],
		["f7a1", "鐸呑嘆坦彈憚歎灘炭綻誕奪脫探眈耽貪塔搭榻宕帑湯糖蕩兌台太怠態殆汰泰笞胎苔跆邰颱宅擇澤撑攄兎吐土討慟桶洞痛筒統通堆槌腿褪退頹偸套妬投透鬪慝特闖坡婆巴把播擺杷波派爬琶破罷芭跛頗判坂板版瓣販辦鈑"],
		["f8a1", "阪八叭捌佩唄悖敗沛浿牌狽稗覇貝彭澎烹膨愎便偏扁片篇編翩遍鞭騙貶坪平枰萍評吠嬖幣廢弊斃肺蔽閉陛佈包匍匏咆哺圃布怖抛抱捕暴泡浦疱砲胞脯苞葡蒲袍褒逋鋪飽鮑幅暴曝瀑爆輻俵剽彪慓杓標漂瓢票表豹飇飄驃"],
		["f9a1", "品稟楓諷豊風馮彼披疲皮被避陂匹弼必泌珌畢疋筆苾馝乏逼下何厦夏廈昰河瑕荷蝦賀遐霞鰕壑學虐謔鶴寒恨悍旱汗漢澣瀚罕翰閑閒限韓割轄函含咸啣喊檻涵緘艦銜陷鹹合哈盒蛤閤闔陜亢伉姮嫦巷恒抗杭桁沆港缸肛航"],
		["faa1", "行降項亥偕咳垓奚孩害懈楷海瀣蟹解該諧邂駭骸劾核倖幸杏荇行享向嚮珦鄕響餉饗香噓墟虛許憲櫶獻軒歇險驗奕爀赫革俔峴弦懸晛泫炫玄玹現眩睍絃絢縣舷衒見賢鉉顯孑穴血頁嫌俠協夾峽挾浹狹脅脇莢鋏頰亨兄刑型"],
		["fba1", "形泂滎瀅灐炯熒珩瑩荊螢衡逈邢鎣馨兮彗惠慧暳蕙蹊醯鞋乎互呼壕壺好岵弧戶扈昊晧毫浩淏湖滸澔濠濩灝狐琥瑚瓠皓祜糊縞胡芦葫蒿虎號蝴護豪鎬頀顥惑或酷婚昏混渾琿魂忽惚笏哄弘汞泓洪烘紅虹訌鴻化和嬅樺火畵"],
		["fca1", "禍禾花華話譁貨靴廓擴攫確碻穫丸喚奐宦幻患換歡晥桓渙煥環紈還驩鰥活滑猾豁闊凰幌徨恍惶愰慌晃晄榥況湟滉潢煌璜皇篁簧荒蝗遑隍黃匯回廻徊恢悔懷晦會檜淮澮灰獪繪膾茴蛔誨賄劃獲宖橫鐄哮嚆孝效斅曉梟涍淆"],
		["fda1", "爻肴酵驍侯候厚后吼喉嗅帿後朽煦珝逅勛勳塤壎焄熏燻薰訓暈薨喧暄煊萱卉喙毁彙徽揮暉煇諱輝麾休携烋畦虧恤譎鷸兇凶匈洶胸黑昕欣炘痕吃屹紇訖欠欽歆吸恰洽翕興僖凞喜噫囍姬嬉希憙憘戱晞曦熙熹熺犧禧稀羲詰"]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp950.json
var require_cp950 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/cp950.json": ((exports, module) => {
	module.exports = [
		[
			"0",
			"\0",
			127
		],
		["a140", "　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚"],
		[
			"a1a1",
			"﹛﹜﹝﹞‘’“”〝〞‵′＃＆＊※§〃○●△▲◎☆★◇◆□■▽▼㊣℅¯￣＿ˍ﹉﹊﹍﹎﹋﹌﹟﹠﹡＋－×÷±√＜＞＝≦≧≠∞≒≡﹢",
			4,
			"～∩∪⊥∠∟⊿㏒㏑∫∮∵∴♀♂⊕⊙↑↓←→↖↗↙↘∥∣／"
		],
		[
			"a240",
			"＼∕﹨＄￥〒￠￡％＠℃℉﹩﹪﹫㏕㎜㎝㎞㏎㎡㎎㎏㏄°兙兛兞兝兡兣嗧瓩糎▁",
			7,
			"▏▎▍▌▋▊▉┼┴┬┤├▔─│▕┌┐└┘╭"
		],
		[
			"a2a1",
			"╮╰╯═╞╪╡◢◣◥◤╱╲╳０",
			9,
			"Ⅰ",
			9,
			"〡",
			8,
			"十卄卅Ａ",
			25,
			"ａ",
			21
		],
		[
			"a340",
			"ｗｘｙｚΑ",
			16,
			"Σ",
			6,
			"α",
			16,
			"σ",
			6,
			"ㄅ",
			10
		],
		[
			"a3a1",
			"ㄐ",
			25,
			"˙ˉˊˇˋ"
		],
		["a3e1", "€"],
		["a440", "一乙丁七乃九了二人儿入八几刀刁力匕十卜又三下丈上丫丸凡久么也乞于亡兀刃勺千叉口土士夕大女子孑孓寸小尢尸山川工己已巳巾干廾弋弓才"],
		["a4a1", "丑丐不中丰丹之尹予云井互五亢仁什仃仆仇仍今介仄元允內六兮公冗凶分切刈勻勾勿化匹午升卅卞厄友及反壬天夫太夭孔少尤尺屯巴幻廿弔引心戈戶手扎支文斗斤方日曰月木欠止歹毋比毛氏水火爪父爻片牙牛犬王丙"],
		["a540", "世丕且丘主乍乏乎以付仔仕他仗代令仙仞充兄冉冊冬凹出凸刊加功包匆北匝仟半卉卡占卯卮去可古右召叮叩叨叼司叵叫另只史叱台句叭叻四囚外"],
		["a5a1", "央失奴奶孕它尼巨巧左市布平幼弁弘弗必戊打扔扒扑斥旦朮本未末札正母民氐永汁汀氾犯玄玉瓜瓦甘生用甩田由甲申疋白皮皿目矛矢石示禾穴立丞丟乒乓乩亙交亦亥仿伉伙伊伕伍伐休伏仲件任仰仳份企伋光兇兆先全"],
		["a640", "共再冰列刑划刎刖劣匈匡匠印危吉吏同吊吐吁吋各向名合吃后吆吒因回囝圳地在圭圬圯圩夙多夷夸妄奸妃好她如妁字存宇守宅安寺尖屹州帆并年"],
		["a6a1", "式弛忙忖戎戌戍成扣扛托收早旨旬旭曲曳有朽朴朱朵次此死氖汝汗汙江池汐汕污汛汍汎灰牟牝百竹米糸缶羊羽老考而耒耳聿肉肋肌臣自至臼舌舛舟艮色艾虫血行衣西阡串亨位住佇佗佞伴佛何估佐佑伽伺伸佃佔似但佣"],
		["a740", "作你伯低伶余佝佈佚兌克免兵冶冷別判利刪刨劫助努劬匣即卵吝吭吞吾否呎吧呆呃吳呈呂君吩告吹吻吸吮吵吶吠吼呀吱含吟听囪困囤囫坊坑址坍"],
		["a7a1", "均坎圾坐坏圻壯夾妝妒妨妞妣妙妖妍妤妓妊妥孝孜孚孛完宋宏尬局屁尿尾岐岑岔岌巫希序庇床廷弄弟彤形彷役忘忌志忍忱快忸忪戒我抄抗抖技扶抉扭把扼找批扳抒扯折扮投抓抑抆改攻攸旱更束李杏材村杜杖杞杉杆杠"],
		["a840", "杓杗步每求汞沙沁沈沉沅沛汪決沐汰沌汨沖沒汽沃汲汾汴沆汶沍沔沘沂灶灼災灸牢牡牠狄狂玖甬甫男甸皂盯矣私秀禿究系罕肖肓肝肘肛肚育良芒"],
		["a8a1", "芋芍見角言谷豆豕貝赤走足身車辛辰迂迆迅迄巡邑邢邪邦那酉釆里防阮阱阪阬並乖乳事些亞享京佯依侍佳使佬供例來侃佰併侈佩佻侖佾侏侑佺兔兒兕兩具其典冽函刻券刷刺到刮制剁劾劻卒協卓卑卦卷卸卹取叔受味呵"],
		["a940", "咖呸咕咀呻呷咄咒咆呼咐呱呶和咚呢周咋命咎固垃坷坪坩坡坦坤坼夜奉奇奈奄奔妾妻委妹妮姑姆姐姍始姓姊妯妳姒姅孟孤季宗定官宜宙宛尚屈居"],
		["a9a1", "屆岷岡岸岩岫岱岳帘帚帖帕帛帑幸庚店府底庖延弦弧弩往征彿彼忝忠忽念忿怏怔怯怵怖怪怕怡性怩怫怛或戕房戾所承拉拌拄抿拂抹拒招披拓拔拋拈抨抽押拐拙拇拍抵拚抱拘拖拗拆抬拎放斧於旺昔易昌昆昂明昀昏昕昊"],
		["aa40", "昇服朋杭枋枕東果杳杷枇枝林杯杰板枉松析杵枚枓杼杪杲欣武歧歿氓氛泣注泳沱泌泥河沽沾沼波沫法泓沸泄油況沮泗泅泱沿治泡泛泊沬泯泜泖泠"],
		["aaa1", "炕炎炒炊炙爬爭爸版牧物狀狎狙狗狐玩玨玟玫玥甽疝疙疚的盂盲直知矽社祀祁秉秈空穹竺糾罔羌羋者肺肥肢肱股肫肩肴肪肯臥臾舍芳芝芙芭芽芟芹花芬芥芯芸芣芰芾芷虎虱初表軋迎返近邵邸邱邶采金長門阜陀阿阻附"],
		["ab40", "陂隹雨青非亟亭亮信侵侯便俠俑俏保促侶俘俟俊俗侮俐俄係俚俎俞侷兗冒冑冠剎剃削前剌剋則勇勉勃勁匍南卻厚叛咬哀咨哎哉咸咦咳哇哂咽咪品"],
		["aba1", "哄哈咯咫咱咻咩咧咿囿垂型垠垣垢城垮垓奕契奏奎奐姜姘姿姣姨娃姥姪姚姦威姻孩宣宦室客宥封屎屏屍屋峙峒巷帝帥帟幽庠度建弈弭彥很待徊律徇後徉怒思怠急怎怨恍恰恨恢恆恃恬恫恪恤扁拜挖按拼拭持拮拽指拱拷"],
		["ac40", "拯括拾拴挑挂政故斫施既春昭映昧是星昨昱昤曷柿染柱柔某柬架枯柵柩柯柄柑枴柚查枸柏柞柳枰柙柢柝柒歪殃殆段毒毗氟泉洋洲洪流津洌洱洞洗"],
		["aca1", "活洽派洶洛泵洹洧洸洩洮洵洎洫炫為炳炬炯炭炸炮炤爰牲牯牴狩狠狡玷珊玻玲珍珀玳甚甭畏界畎畋疫疤疥疢疣癸皆皇皈盈盆盃盅省盹相眉看盾盼眇矜砂研砌砍祆祉祈祇禹禺科秒秋穿突竿竽籽紂紅紀紉紇約紆缸美羿耄"],
		["ad40", "耐耍耑耶胖胥胚胃胄背胡胛胎胞胤胝致舢苧范茅苣苛苦茄若茂茉苒苗英茁苜苔苑苞苓苟苯茆虐虹虻虺衍衫要觔計訂訃貞負赴赳趴軍軌述迦迢迪迥"],
		["ada1", "迭迫迤迨郊郎郁郃酋酊重閂限陋陌降面革韋韭音頁風飛食首香乘亳倌倍倣俯倦倥俸倩倖倆值借倚倒們俺倀倔倨俱倡個候倘俳修倭倪俾倫倉兼冤冥冢凍凌准凋剖剜剔剛剝匪卿原厝叟哨唐唁唷哼哥哲唆哺唔哩哭員唉哮哪"],
		["ae40", "哦唧唇哽唏圃圄埂埔埋埃堉夏套奘奚娑娘娜娟娛娓姬娠娣娩娥娌娉孫屘宰害家宴宮宵容宸射屑展屐峭峽峻峪峨峰島崁峴差席師庫庭座弱徒徑徐恙"],
		["aea1", "恣恥恐恕恭恩息悄悟悚悍悔悌悅悖扇拳挈拿捎挾振捕捂捆捏捉挺捐挽挪挫挨捍捌效敉料旁旅時晉晏晃晒晌晅晁書朔朕朗校核案框桓根桂桔栩梳栗桌桑栽柴桐桀格桃株桅栓栘桁殊殉殷氣氧氨氦氤泰浪涕消涇浦浸海浙涓"],
		["af40", "浬涉浮浚浴浩涌涊浹涅浥涔烊烘烤烙烈烏爹特狼狹狽狸狷玆班琉珮珠珪珞畔畝畜畚留疾病症疲疳疽疼疹痂疸皋皰益盍盎眩真眠眨矩砰砧砸砝破砷"],
		["afa1", "砥砭砠砟砲祕祐祠祟祖神祝祗祚秤秣秧租秦秩秘窄窈站笆笑粉紡紗紋紊素索純紐紕級紜納紙紛缺罟羔翅翁耆耘耕耙耗耽耿胱脂胰脅胭胴脆胸胳脈能脊胼胯臭臬舀舐航舫舨般芻茫荒荔荊茸荐草茵茴荏茲茹茶茗荀茱茨荃"],
		["b040", "虔蚊蚪蚓蚤蚩蚌蚣蚜衰衷袁袂衽衹記訐討訌訕訊託訓訖訏訑豈豺豹財貢起躬軒軔軏辱送逆迷退迺迴逃追逅迸邕郡郝郢酒配酌釘針釗釜釙閃院陣陡"],
		["b0a1", "陛陝除陘陞隻飢馬骨高鬥鬲鬼乾偺偽停假偃偌做偉健偶偎偕偵側偷偏倏偯偭兜冕凰剪副勒務勘動匐匏匙匿區匾參曼商啪啦啄啞啡啃啊唱啖問啕唯啤唸售啜唬啣唳啁啗圈國圉域堅堊堆埠埤基堂堵執培夠奢娶婁婉婦婪婀"],
		["b140", "娼婢婚婆婊孰寇寅寄寂宿密尉專將屠屜屝崇崆崎崛崖崢崑崩崔崙崤崧崗巢常帶帳帷康庸庶庵庾張強彗彬彩彫得徙從徘御徠徜恿患悉悠您惋悴惦悽"],
		["b1a1", "情悻悵惜悼惘惕惆惟悸惚惇戚戛扈掠控捲掖探接捷捧掘措捱掩掉掃掛捫推掄授掙採掬排掏掀捻捩捨捺敝敖救教敗啟敏敘敕敔斜斛斬族旋旌旎晝晚晤晨晦晞曹勗望梁梯梢梓梵桿桶梱梧梗械梃棄梭梆梅梔條梨梟梡梂欲殺"],
		["b240", "毫毬氫涎涼淳淙液淡淌淤添淺清淇淋涯淑涮淞淹涸混淵淅淒渚涵淚淫淘淪深淮淨淆淄涪淬涿淦烹焉焊烽烯爽牽犁猜猛猖猓猙率琅琊球理現琍瓠瓶"],
		["b2a1", "瓷甜產略畦畢異疏痔痕疵痊痍皎盔盒盛眷眾眼眶眸眺硫硃硎祥票祭移窒窕笠笨笛第符笙笞笮粒粗粕絆絃統紮紹紼絀細紳組累終紲紱缽羞羚翌翎習耜聊聆脯脖脣脫脩脰脤舂舵舷舶船莎莞莘荸莢莖莽莫莒莊莓莉莠荷荻荼"],
		["b340", "莆莧處彪蛇蛀蚶蛄蚵蛆蛋蚱蚯蛉術袞袈被袒袖袍袋覓規訪訝訣訥許設訟訛訢豉豚販責貫貨貪貧赧赦趾趺軛軟這逍通逗連速逝逐逕逞造透逢逖逛途"],
		["b3a1", "部郭都酗野釵釦釣釧釭釩閉陪陵陳陸陰陴陶陷陬雀雪雩章竟頂頃魚鳥鹵鹿麥麻傢傍傅備傑傀傖傘傚最凱割剴創剩勞勝勛博厥啻喀喧啼喊喝喘喂喜喪喔喇喋喃喳單喟唾喲喚喻喬喱啾喉喫喙圍堯堪場堤堰報堡堝堠壹壺奠"],
		["b440", "婷媚婿媒媛媧孳孱寒富寓寐尊尋就嵌嵐崴嵇巽幅帽幀幃幾廊廁廂廄弼彭復循徨惑惡悲悶惠愜愣惺愕惰惻惴慨惱愎惶愉愀愒戟扉掣掌描揀揩揉揆揍"],
		["b4a1", "插揣提握揖揭揮捶援揪換摒揚揹敞敦敢散斑斐斯普晰晴晶景暑智晾晷曾替期朝棺棕棠棘棗椅棟棵森棧棹棒棲棣棋棍植椒椎棉棚楮棻款欺欽殘殖殼毯氮氯氬港游湔渡渲湧湊渠渥渣減湛湘渤湖湮渭渦湯渴湍渺測湃渝渾滋"],
		["b540", "溉渙湎湣湄湲湩湟焙焚焦焰無然煮焜牌犄犀猶猥猴猩琺琪琳琢琥琵琶琴琯琛琦琨甥甦畫番痢痛痣痙痘痞痠登發皖皓皴盜睏短硝硬硯稍稈程稅稀窘"],
		["b5a1", "窗窖童竣等策筆筐筒答筍筋筏筑粟粥絞結絨絕紫絮絲絡給絢絰絳善翔翕耋聒肅腕腔腋腑腎脹腆脾腌腓腴舒舜菩萃菸萍菠菅萋菁華菱菴著萊菰萌菌菽菲菊萸萎萄菜萇菔菟虛蛟蛙蛭蛔蛛蛤蛐蛞街裁裂袱覃視註詠評詞証詁"],
		["b640", "詔詛詐詆訴診訶詖象貂貯貼貳貽賁費賀貴買貶貿貸越超趁跎距跋跚跑跌跛跆軻軸軼辜逮逵週逸進逶鄂郵鄉郾酣酥量鈔鈕鈣鈉鈞鈍鈐鈇鈑閔閏開閑"],
		["b6a1", "間閒閎隊階隋陽隅隆隍陲隄雁雅雄集雇雯雲韌項順須飧飪飯飩飲飭馮馭黃黍黑亂傭債傲傳僅傾催傷傻傯僇剿剷剽募勦勤勢勣匯嗟嗨嗓嗦嗎嗜嗇嗑嗣嗤嗯嗚嗡嗅嗆嗥嗉園圓塞塑塘塗塚塔填塌塭塊塢塒塋奧嫁嫉嫌媾媽媼"],
		["b740", "媳嫂媲嵩嵯幌幹廉廈弒彙徬微愚意慈感想愛惹愁愈慎慌慄慍愾愴愧愍愆愷戡戢搓搾搞搪搭搽搬搏搜搔損搶搖搗搆敬斟新暗暉暇暈暖暄暘暍會榔業"],
		["b7a1", "楚楷楠楔極椰概楊楨楫楞楓楹榆楝楣楛歇歲毀殿毓毽溢溯滓溶滂源溝滇滅溥溘溼溺溫滑準溜滄滔溪溧溴煎煙煩煤煉照煜煬煦煌煥煞煆煨煖爺牒猷獅猿猾瑯瑚瑕瑟瑞瑁琿瑙瑛瑜當畸瘀痰瘁痲痱痺痿痴痳盞盟睛睫睦睞督"],
		["b840", "睹睪睬睜睥睨睢矮碎碰碗碘碌碉硼碑碓硿祺祿禁萬禽稜稚稠稔稟稞窟窠筷節筠筮筧粱粳粵經絹綑綁綏絛置罩罪署義羨群聖聘肆肄腱腰腸腥腮腳腫"],
		["b8a1", "腹腺腦舅艇蒂葷落萱葵葦葫葉葬葛萼萵葡董葩葭葆虞虜號蛹蜓蜈蜇蜀蛾蛻蜂蜃蜆蜊衙裟裔裙補裘裝裡裊裕裒覜解詫該詳試詩詰誇詼詣誠話誅詭詢詮詬詹詻訾詨豢貊貉賊資賈賄貲賃賂賅跡跟跨路跳跺跪跤跦躲較載軾輊"],
		["b940", "辟農運遊道遂達逼違遐遇遏過遍遑逾遁鄒鄗酬酪酩釉鈷鉗鈸鈽鉀鈾鉛鉋鉤鉑鈴鉉鉍鉅鈹鈿鉚閘隘隔隕雍雋雉雊雷電雹零靖靴靶預頑頓頊頒頌飼飴"],
		["b9a1", "飽飾馳馱馴髡鳩麂鼎鼓鼠僧僮僥僖僭僚僕像僑僱僎僩兢凳劃劂匱厭嗾嘀嘛嘗嗽嘔嘆嘉嘍嘎嗷嘖嘟嘈嘐嗶團圖塵塾境墓墊塹墅塽壽夥夢夤奪奩嫡嫦嫩嫗嫖嫘嫣孵寞寧寡寥實寨寢寤察對屢嶄嶇幛幣幕幗幔廓廖弊彆彰徹慇"],
		["ba40", "愿態慷慢慣慟慚慘慵截撇摘摔撤摸摟摺摑摧搴摭摻敲斡旗旖暢暨暝榜榨榕槁榮槓構榛榷榻榫榴槐槍榭槌榦槃榣歉歌氳漳演滾漓滴漩漾漠漬漏漂漢"],
		["baa1", "滿滯漆漱漸漲漣漕漫漯澈漪滬漁滲滌滷熔熙煽熊熄熒爾犒犖獄獐瑤瑣瑪瑰瑭甄疑瘧瘍瘋瘉瘓盡監瞄睽睿睡磁碟碧碳碩碣禎福禍種稱窪窩竭端管箕箋筵算箝箔箏箸箇箄粹粽精綻綰綜綽綾綠緊綴網綱綺綢綿綵綸維緒緇綬"],
		["bb40", "罰翠翡翟聞聚肇腐膀膏膈膊腿膂臧臺與舔舞艋蓉蒿蓆蓄蒙蒞蒲蒜蓋蒸蓀蓓蒐蒼蓑蓊蜿蜜蜻蜢蜥蜴蜘蝕蜷蜩裳褂裴裹裸製裨褚裯誦誌語誣認誡誓誤"],
		["bba1", "說誥誨誘誑誚誧豪貍貌賓賑賒赫趙趕跼輔輒輕輓辣遠遘遜遣遙遞遢遝遛鄙鄘鄞酵酸酷酴鉸銀銅銘銖鉻銓銜銨鉼銑閡閨閩閣閥閤隙障際雌雒需靼鞅韶頗領颯颱餃餅餌餉駁骯骰髦魁魂鳴鳶鳳麼鼻齊億儀僻僵價儂儈儉儅凜"],
		["bc40", "劇劈劉劍劊勰厲嘮嘻嘹嘲嘿嘴嘩噓噎噗噴嘶嘯嘰墀墟增墳墜墮墩墦奭嬉嫻嬋嫵嬌嬈寮寬審寫層履嶝嶔幢幟幡廢廚廟廝廣廠彈影德徵慶慧慮慝慕憂"],
		["bca1", "慼慰慫慾憧憐憫憎憬憚憤憔憮戮摩摯摹撞撲撈撐撰撥撓撕撩撒撮播撫撚撬撙撢撳敵敷數暮暫暴暱樣樟槨樁樞標槽模樓樊槳樂樅槭樑歐歎殤毅毆漿潼澄潑潦潔澆潭潛潸潮澎潺潰潤澗潘滕潯潠潟熟熬熱熨牖犛獎獗瑩璋璃"],
		["bd40", "瑾璀畿瘠瘩瘟瘤瘦瘡瘢皚皺盤瞎瞇瞌瞑瞋磋磅確磊碾磕碼磐稿稼穀稽稷稻窯窮箭箱範箴篆篇篁箠篌糊締練緯緻緘緬緝編緣線緞緩綞緙緲緹罵罷羯"],
		["bda1", "翩耦膛膜膝膠膚膘蔗蔽蔚蓮蔬蔭蔓蔑蔣蔡蔔蓬蔥蓿蔆螂蝴蝶蝠蝦蝸蝨蝙蝗蝌蝓衛衝褐複褒褓褕褊誼諒談諄誕請諸課諉諂調誰論諍誶誹諛豌豎豬賠賞賦賤賬賭賢賣賜質賡赭趟趣踫踐踝踢踏踩踟踡踞躺輝輛輟輩輦輪輜輞"],
		["be40", "輥適遮遨遭遷鄰鄭鄧鄱醇醉醋醃鋅銻銷鋪銬鋤鋁銳銼鋒鋇鋰銲閭閱霄霆震霉靠鞍鞋鞏頡頫頜颳養餓餒餘駝駐駟駛駑駕駒駙骷髮髯鬧魅魄魷魯鴆鴉"],
		["bea1", "鴃麩麾黎墨齒儒儘儔儐儕冀冪凝劑劓勳噙噫噹噩噤噸噪器噥噱噯噬噢噶壁墾壇壅奮嬝嬴學寰導彊憲憑憩憊懍憶憾懊懈戰擅擁擋撻撼據擄擇擂操撿擒擔撾整曆曉暹曄曇暸樽樸樺橙橫橘樹橄橢橡橋橇樵機橈歙歷氅濂澱澡"],
		["bf40", "濃澤濁澧澳激澹澶澦澠澴熾燉燐燒燈燕熹燎燙燜燃燄獨璜璣璘璟璞瓢甌甍瘴瘸瘺盧盥瞠瞞瞟瞥磨磚磬磧禦積穎穆穌穋窺篙簑築篤篛篡篩篦糕糖縊"],
		["bfa1", "縑縈縛縣縞縝縉縐罹羲翰翱翮耨膳膩膨臻興艘艙蕊蕙蕈蕨蕩蕃蕉蕭蕪蕞螃螟螞螢融衡褪褲褥褫褡親覦諦諺諫諱謀諜諧諮諾謁謂諷諭諳諶諼豫豭貓賴蹄踱踴蹂踹踵輻輯輸輳辨辦遵遴選遲遼遺鄴醒錠錶鋸錳錯錢鋼錫錄錚"],
		["c040", "錐錦錡錕錮錙閻隧隨險雕霎霑霖霍霓霏靛靜靦鞘頰頸頻頷頭頹頤餐館餞餛餡餚駭駢駱骸骼髻髭鬨鮑鴕鴣鴦鴨鴒鴛默黔龍龜優償儡儲勵嚎嚀嚐嚅嚇"],
		["c0a1", "嚏壕壓壑壎嬰嬪嬤孺尷屨嶼嶺嶽嶸幫彌徽應懂懇懦懋戲戴擎擊擘擠擰擦擬擱擢擭斂斃曙曖檀檔檄檢檜櫛檣橾檗檐檠歜殮毚氈濘濱濟濠濛濤濫濯澀濬濡濩濕濮濰燧營燮燦燥燭燬燴燠爵牆獰獲璩環璦璨癆療癌盪瞳瞪瞰瞬"],
		["c140", "瞧瞭矯磷磺磴磯礁禧禪穗窿簇簍篾篷簌篠糠糜糞糢糟糙糝縮績繆縷縲繃縫總縱繅繁縴縹繈縵縿縯罄翳翼聱聲聰聯聳臆臃膺臂臀膿膽臉膾臨舉艱薪"],
		["c1a1", "薄蕾薜薑薔薯薛薇薨薊虧蟀蟑螳蟒蟆螫螻螺蟈蟋褻褶襄褸褽覬謎謗謙講謊謠謝謄謐豁谿豳賺賽購賸賻趨蹉蹋蹈蹊轄輾轂轅輿避遽還邁邂邀鄹醣醞醜鍍鎂錨鍵鍊鍥鍋錘鍾鍬鍛鍰鍚鍔闊闋闌闈闆隱隸雖霜霞鞠韓顆颶餵騁"],
		["c240", "駿鮮鮫鮪鮭鴻鴿麋黏點黜黝黛鼾齋叢嚕嚮壙壘嬸彝懣戳擴擲擾攆擺擻擷斷曜朦檳檬櫃檻檸櫂檮檯歟歸殯瀉瀋濾瀆濺瀑瀏燻燼燾燸獷獵璧璿甕癖癘"],
		["c2a1", "癒瞽瞿瞻瞼礎禮穡穢穠竄竅簫簧簪簞簣簡糧織繕繞繚繡繒繙罈翹翻職聶臍臏舊藏薩藍藐藉薰薺薹薦蟯蟬蟲蟠覆覲觴謨謹謬謫豐贅蹙蹣蹦蹤蹟蹕軀轉轍邇邃邈醫醬釐鎔鎊鎖鎢鎳鎮鎬鎰鎘鎚鎗闔闖闐闕離雜雙雛雞霤鞣鞦"],
		["c340", "鞭韹額顏題顎顓颺餾餿餽餮馥騎髁鬃鬆魏魎魍鯊鯉鯽鯈鯀鵑鵝鵠黠鼕鼬儳嚥壞壟壢寵龐廬懲懷懶懵攀攏曠曝櫥櫝櫚櫓瀛瀟瀨瀚瀝瀕瀘爆爍牘犢獸"],
		["c3a1", "獺璽瓊瓣疇疆癟癡矇礙禱穫穩簾簿簸簽簷籀繫繭繹繩繪羅繳羶羹羸臘藩藝藪藕藤藥藷蟻蠅蠍蟹蟾襠襟襖襞譁譜識證譚譎譏譆譙贈贊蹼蹲躇蹶蹬蹺蹴轔轎辭邊邋醱醮鏡鏑鏟鏃鏈鏜鏝鏖鏢鏍鏘鏤鏗鏨關隴難霪霧靡韜韻類"],
		["c440", "願顛颼饅饉騖騙鬍鯨鯧鯖鯛鶉鵡鵲鵪鵬麒麗麓麴勸嚨嚷嚶嚴嚼壤孀孃孽寶巉懸懺攘攔攙曦朧櫬瀾瀰瀲爐獻瓏癢癥礦礪礬礫竇競籌籃籍糯糰辮繽繼"],
		["c4a1", "纂罌耀臚艦藻藹蘑藺蘆蘋蘇蘊蠔蠕襤覺觸議譬警譯譟譫贏贍躉躁躅躂醴釋鐘鐃鏽闡霰飄饒饑馨騫騰騷騵鰓鰍鹹麵黨鼯齟齣齡儷儸囁囀囂夔屬巍懼懾攝攜斕曩櫻欄櫺殲灌爛犧瓖瓔癩矓籐纏續羼蘗蘭蘚蠣蠢蠡蠟襪襬覽譴"],
		["c540", "護譽贓躊躍躋轟辯醺鐮鐳鐵鐺鐸鐲鐫闢霸霹露響顧顥饗驅驃驀騾髏魔魑鰭鰥鶯鶴鷂鶸麝黯鼙齜齦齧儼儻囈囊囉孿巔巒彎懿攤權歡灑灘玀瓤疊癮癬"],
		["c5a1", "禳籠籟聾聽臟襲襯觼讀贖贗躑躓轡酈鑄鑑鑒霽霾韃韁顫饕驕驍髒鬚鱉鰱鰾鰻鷓鷗鼴齬齪龔囌巖戀攣攫攪曬欐瓚竊籤籣籥纓纖纔臢蘸蘿蠱變邐邏鑣鑠鑤靨顯饜驚驛驗髓體髑鱔鱗鱖鷥麟黴囑壩攬灞癱癲矗罐羈蠶蠹衢讓讒"],
		["c640", "讖艷贛釀鑪靂靈靄韆顰驟鬢魘鱟鷹鷺鹼鹽鼇齷齲廳欖灣籬籮蠻觀躡釁鑲鑰顱饞髖鬣黌灤矚讚鑷韉驢驥纜讜躪釅鑽鑾鑼鱷鱸黷豔鑿鸚爨驪鬱鸛鸞籲"],
		["c940", "乂乜凵匚厂万丌乇亍囗兀屮彳丏冇与丮亓仂仉仈冘勼卬厹圠夃夬尐巿旡殳毌气爿丱丼仨仜仩仡仝仚刌匜卌圢圣夗夯宁宄尒尻屴屳帄庀庂忉戉扐氕"],
		["c9a1", "氶汃氿氻犮犰玊禸肊阞伎优伬仵伔仱伀价伈伝伂伅伢伓伄仴伒冱刓刉刐劦匢匟卍厊吇囡囟圮圪圴夼妀奼妅奻奾奷奿孖尕尥屼屺屻屾巟幵庄异弚彴忕忔忏扜扞扤扡扦扢扙扠扚扥旯旮朾朹朸朻机朿朼朳氘汆汒汜汏汊汔汋"],
		["ca40", "汌灱牞犴犵玎甪癿穵网艸艼芀艽艿虍襾邙邗邘邛邔阢阤阠阣佖伻佢佉体佤伾佧佒佟佁佘伭伳伿佡冏冹刜刞刡劭劮匉卣卲厎厏吰吷吪呔呅吙吜吥吘"],
		["caa1", "吽呏呁吨吤呇囮囧囥坁坅坌坉坋坒夆奀妦妘妠妗妎妢妐妏妧妡宎宒尨尪岍岏岈岋岉岒岊岆岓岕巠帊帎庋庉庌庈庍弅弝彸彶忒忑忐忭忨忮忳忡忤忣忺忯忷忻怀忴戺抃抌抎抏抔抇扱扻扺扰抁抈扷扽扲扴攷旰旴旳旲旵杅杇"],
		["cb40", "杙杕杌杈杝杍杚杋毐氙氚汸汧汫沄沋沏汱汯汩沚汭沇沕沜汦汳汥汻沎灴灺牣犿犽狃狆狁犺狅玕玗玓玔玒町甹疔疕皁礽耴肕肙肐肒肜芐芏芅芎芑芓"],
		["cba1", "芊芃芄豸迉辿邟邡邥邞邧邠阰阨阯阭丳侘佼侅佽侀侇佶佴侉侄佷佌侗佪侚佹侁佸侐侜侔侞侒侂侕佫佮冞冼冾刵刲刳剆刱劼匊匋匼厒厔咇呿咁咑咂咈呫呺呾呥呬呴呦咍呯呡呠咘呣呧呤囷囹坯坲坭坫坱坰坶垀坵坻坳坴坢"],
		["cc40", "坨坽夌奅妵妺姏姎妲姌姁妶妼姃姖妱妽姀姈妴姇孢孥宓宕屄屇岮岤岠岵岯岨岬岟岣岭岢岪岧岝岥岶岰岦帗帔帙弨弢弣弤彔徂彾彽忞忥怭怦怙怲怋"],
		["cca1", "怴怊怗怳怚怞怬怢怍怐怮怓怑怌怉怜戔戽抭抴拑抾抪抶拊抮抳抯抻抩抰抸攽斨斻昉旼昄昒昈旻昃昋昍昅旽昑昐曶朊枅杬枎枒杶杻枘枆构杴枍枌杺枟枑枙枃杽极杸杹枔欥殀歾毞氝沓泬泫泮泙沶泔沭泧沷泐泂沺泃泆泭泲"],
		["cd40", "泒泝沴沊沝沀泞泀洰泍泇沰泹泏泩泑炔炘炅炓炆炄炑炖炂炚炃牪狖狋狘狉狜狒狔狚狌狑玤玡玭玦玢玠玬玝瓝瓨甿畀甾疌疘皯盳盱盰盵矸矼矹矻矺"],
		["cda1", "矷祂礿秅穸穻竻籵糽耵肏肮肣肸肵肭舠芠苀芫芚芘芛芵芧芮芼芞芺芴芨芡芩苂芤苃芶芢虰虯虭虮豖迒迋迓迍迖迕迗邲邴邯邳邰阹阽阼阺陃俍俅俓侲俉俋俁俔俜俙侻侳俛俇俖侺俀侹俬剄剉勀勂匽卼厗厖厙厘咺咡咭咥哏"],
		["ce40", "哃茍咷咮哖咶哅哆咠呰咼咢咾呲哞咰垵垞垟垤垌垗垝垛垔垘垏垙垥垚垕壴复奓姡姞姮娀姱姝姺姽姼姶姤姲姷姛姩姳姵姠姾姴姭宨屌峐峘峌峗峋峛"],
		["cea1", "峞峚峉峇峊峖峓峔峏峈峆峎峟峸巹帡帢帣帠帤庰庤庢庛庣庥弇弮彖徆怷怹恔恲恞恅恓恇恉恛恌恀恂恟怤恄恘恦恮扂扃拏挍挋拵挎挃拫拹挏挌拸拶挀挓挔拺挕拻拰敁敃斪斿昶昡昲昵昜昦昢昳昫昺昝昴昹昮朏朐柁柲柈枺"],
		["cf40", "柜枻柸柘柀枷柅柫柤柟枵柍枳柷柶柮柣柂枹柎柧柰枲柼柆柭柌枮柦柛柺柉柊柃柪柋欨殂殄殶毖毘毠氠氡洨洴洭洟洼洿洒洊泚洳洄洙洺洚洑洀洝浂"],
		["cfa1", "洁洘洷洃洏浀洇洠洬洈洢洉洐炷炟炾炱炰炡炴炵炩牁牉牊牬牰牳牮狊狤狨狫狟狪狦狣玅珌珂珈珅玹玶玵玴珫玿珇玾珃珆玸珋瓬瓮甮畇畈疧疪癹盄眈眃眄眅眊盷盻盺矧矨砆砑砒砅砐砏砎砉砃砓祊祌祋祅祄秕种秏秖秎窀"],
		["d040", "穾竑笀笁籺籸籹籿粀粁紃紈紁罘羑羍羾耇耎耏耔耷胘胇胠胑胈胂胐胅胣胙胜胊胕胉胏胗胦胍臿舡芔苙苾苹茇苨茀苕茺苫苖苴苬苡苲苵茌苻苶苰苪"],
		["d0a1", "苤苠苺苳苭虷虴虼虳衁衎衧衪衩觓訄訇赲迣迡迮迠郱邽邿郕郅邾郇郋郈釔釓陔陏陑陓陊陎倞倅倇倓倢倰倛俵俴倳倷倬俶俷倗倜倠倧倵倯倱倎党冔冓凊凄凅凈凎剡剚剒剞剟剕剢勍匎厞唦哢唗唒哧哳哤唚哿唄唈哫唑唅哱"],
		["d140", "唊哻哷哸哠唎唃唋圁圂埌堲埕埒垺埆垽垼垸垶垿埇埐垹埁夎奊娙娖娭娮娕娏娗娊娞娳孬宧宭宬尃屖屔峬峿峮峱峷崀峹帩帨庨庮庪庬弳弰彧恝恚恧"],
		["d1a1", "恁悢悈悀悒悁悝悃悕悛悗悇悜悎戙扆拲挐捖挬捄捅挶捃揤挹捋捊挼挩捁挴捘捔捙挭捇挳捚捑挸捗捀捈敊敆旆旃旄旂晊晟晇晑朒朓栟栚桉栲栳栻桋桏栖栱栜栵栫栭栯桎桄栴栝栒栔栦栨栮桍栺栥栠欬欯欭欱欴歭肂殈毦毤"],
		["d240", "毨毣毢毧氥浺浣浤浶洍浡涒浘浢浭浯涑涍淯浿涆浞浧浠涗浰浼浟涂涘洯浨涋浾涀涄洖涃浻浽浵涐烜烓烑烝烋缹烢烗烒烞烠烔烍烅烆烇烚烎烡牂牸"],
		["d2a1", "牷牶猀狺狴狾狶狳狻猁珓珙珥珖玼珧珣珩珜珒珛珔珝珚珗珘珨瓞瓟瓴瓵甡畛畟疰痁疻痄痀疿疶疺皊盉眝眛眐眓眒眣眑眕眙眚眢眧砣砬砢砵砯砨砮砫砡砩砳砪砱祔祛祏祜祓祒祑秫秬秠秮秭秪秜秞秝窆窉窅窋窌窊窇竘笐"],
		["d340", "笄笓笅笏笈笊笎笉笒粄粑粊粌粈粍粅紞紝紑紎紘紖紓紟紒紏紌罜罡罞罠罝罛羖羒翃翂翀耖耾耹胺胲胹胵脁胻脀舁舯舥茳茭荄茙荑茥荖茿荁茦茜茢"],
		["d3a1", "荂荎茛茪茈茼荍茖茤茠茷茯茩荇荅荌荓茞茬荋茧荈虓虒蚢蚨蚖蚍蚑蚞蚇蚗蚆蚋蚚蚅蚥蚙蚡蚧蚕蚘蚎蚝蚐蚔衃衄衭衵衶衲袀衱衿衯袃衾衴衼訒豇豗豻貤貣赶赸趵趷趶軑軓迾迵适迿迻逄迼迶郖郠郙郚郣郟郥郘郛郗郜郤酐"],
		["d440", "酎酏釕釢釚陜陟隼飣髟鬯乿偰偪偡偞偠偓偋偝偲偈偍偁偛偊偢倕偅偟偩偫偣偤偆偀偮偳偗偑凐剫剭剬剮勖勓匭厜啵啶唼啍啐唴唪啑啢唶唵唰啒啅"],
		["d4a1", "唌唲啥啎唹啈唭唻啀啋圊圇埻堔埢埶埜埴堀埭埽堈埸堋埳埏堇埮埣埲埥埬埡堎埼堐埧堁堌埱埩埰堍堄奜婠婘婕婧婞娸娵婭婐婟婥婬婓婤婗婃婝婒婄婛婈媎娾婍娹婌婰婩婇婑婖婂婜孲孮寁寀屙崞崋崝崚崠崌崨崍崦崥崏"],
		["d540", "崰崒崣崟崮帾帴庱庴庹庲庳弶弸徛徖徟悊悐悆悾悰悺惓惔惏惤惙惝惈悱惛悷惊悿惃惍惀挲捥掊掂捽掽掞掭掝掗掫掎捯掇掐据掯捵掜捭掮捼掤挻掟"],
		["d5a1", "捸掅掁掑掍捰敓旍晥晡晛晙晜晢朘桹梇梐梜桭桮梮梫楖桯梣梬梩桵桴梲梏桷梒桼桫桲梪梀桱桾梛梖梋梠梉梤桸桻梑梌梊桽欶欳欷欸殑殏殍殎殌氪淀涫涴涳湴涬淩淢涷淶淔渀淈淠淟淖涾淥淜淝淛淴淊涽淭淰涺淕淂淏淉"],
		["d640", "淐淲淓淽淗淍淣涻烺焍烷焗烴焌烰焄烳焐烼烿焆焓焀烸烶焋焂焎牾牻牼牿猝猗猇猑猘猊猈狿猏猞玈珶珸珵琄琁珽琇琀珺珼珿琌琋珴琈畤畣痎痒痏"],
		["d6a1", "痋痌痑痐皏皉盓眹眯眭眱眲眴眳眽眥眻眵硈硒硉硍硊硌砦硅硐祤祧祩祪祣祫祡离秺秸秶秷窏窔窐笵筇笴笥笰笢笤笳笘笪笝笱笫笭笯笲笸笚笣粔粘粖粣紵紽紸紶紺絅紬紩絁絇紾紿絊紻紨罣羕羜羝羛翊翋翍翐翑翇翏翉耟"],
		["d740", "耞耛聇聃聈脘脥脙脛脭脟脬脞脡脕脧脝脢舑舸舳舺舴舲艴莐莣莨莍荺荳莤荴莏莁莕莙荵莔莩荽莃莌莝莛莪莋荾莥莯莈莗莰荿莦莇莮荶莚虙虖蚿蚷"],
		["d7a1", "蛂蛁蛅蚺蚰蛈蚹蚳蚸蛌蚴蚻蚼蛃蚽蚾衒袉袕袨袢袪袚袑袡袟袘袧袙袛袗袤袬袌袓袎覂觖觙觕訰訧訬訞谹谻豜豝豽貥赽赻赹趼跂趹趿跁軘軞軝軜軗軠軡逤逋逑逜逌逡郯郪郰郴郲郳郔郫郬郩酖酘酚酓酕釬釴釱釳釸釤釹釪"],
		["d840", "釫釷釨釮镺閆閈陼陭陫陱陯隿靪頄飥馗傛傕傔傞傋傣傃傌傎傝偨傜傒傂傇兟凔匒匑厤厧喑喨喥喭啷噅喢喓喈喏喵喁喣喒喤啽喌喦啿喕喡喎圌堩堷"],
		["d8a1", "堙堞堧堣堨埵塈堥堜堛堳堿堶堮堹堸堭堬堻奡媯媔媟婺媢媞婸媦婼媥媬媕媮娷媄媊媗媃媋媩婻婽媌媜媏媓媝寪寍寋寔寑寊寎尌尰崷嵃嵫嵁嵋崿崵嵑嵎嵕崳崺嵒崽崱嵙嵂崹嵉崸崼崲崶嵀嵅幄幁彘徦徥徫惉悹惌惢惎惄愔"],
		["d940", "惲愊愖愅惵愓惸惼惾惁愃愘愝愐惿愄愋扊掔掱掰揎揥揨揯揃撝揳揊揠揶揕揲揵摡揟掾揝揜揄揘揓揂揇揌揋揈揰揗揙攲敧敪敤敜敨敥斌斝斞斮旐旒"],
		["d9a1", "晼晬晻暀晱晹晪晲朁椌棓椄棜椪棬棪棱椏棖棷棫棤棶椓椐棳棡椇棌椈楰梴椑棯棆椔棸棐棽棼棨椋椊椗棎棈棝棞棦棴棑椆棔棩椕椥棇欹欻欿欼殔殗殙殕殽毰毲毳氰淼湆湇渟湉溈渼渽湅湢渫渿湁湝湳渜渳湋湀湑渻渃渮湞"],
		["da40", "湨湜湡渱渨湠湱湫渹渢渰湓湥渧湸湤湷湕湹湒湦渵渶湚焠焞焯烻焮焱焣焥焢焲焟焨焺焛牋牚犈犉犆犅犋猒猋猰猢猱猳猧猲猭猦猣猵猌琮琬琰琫琖"],
		["daa1", "琚琡琭琱琤琣琝琩琠琲瓻甯畯畬痧痚痡痦痝痟痤痗皕皒盚睆睇睄睍睅睊睎睋睌矞矬硠硤硥硜硭硱硪确硰硩硨硞硢祴祳祲祰稂稊稃稌稄窙竦竤筊笻筄筈筌筎筀筘筅粢粞粨粡絘絯絣絓絖絧絪絏絭絜絫絒絔絩絑絟絎缾缿罥"],
		["db40", "罦羢羠羡翗聑聏聐胾胔腃腊腒腏腇脽腍脺臦臮臷臸臹舄舼舽舿艵茻菏菹萣菀菨萒菧菤菼菶萐菆菈菫菣莿萁菝菥菘菿菡菋菎菖菵菉萉萏菞萑萆菂菳"],
		["dba1", "菕菺菇菑菪萓菃菬菮菄菻菗菢萛菛菾蛘蛢蛦蛓蛣蛚蛪蛝蛫蛜蛬蛩蛗蛨蛑衈衖衕袺裗袹袸裀袾袶袼袷袽袲褁裉覕覘覗觝觚觛詎詍訹詙詀詗詘詄詅詒詈詑詊詌詏豟貁貀貺貾貰貹貵趄趀趉跘跓跍跇跖跜跏跕跙跈跗跅軯軷軺"],
		["dc40", "軹軦軮軥軵軧軨軶軫軱軬軴軩逭逴逯鄆鄬鄄郿郼鄈郹郻鄁鄀鄇鄅鄃酡酤酟酢酠鈁鈊鈥鈃鈚鈦鈏鈌鈀鈒釿釽鈆鈄鈧鈂鈜鈤鈙鈗鈅鈖镻閍閌閐隇陾隈"],
		["dca1", "隉隃隀雂雈雃雱雰靬靰靮頇颩飫鳦黹亃亄亶傽傿僆傮僄僊傴僈僂傰僁傺傱僋僉傶傸凗剺剸剻剼嗃嗛嗌嗐嗋嗊嗝嗀嗔嗄嗩喿嗒喍嗏嗕嗢嗖嗈嗲嗍嗙嗂圔塓塨塤塏塍塉塯塕塎塝塙塥塛堽塣塱壼嫇嫄嫋媺媸媱媵媰媿嫈媻嫆"],
		["dd40", "媷嫀嫊媴媶嫍媹媐寖寘寙尟尳嵱嵣嵊嵥嵲嵬嵞嵨嵧嵢巰幏幎幊幍幋廅廌廆廋廇彀徯徭惷慉慊愫慅愶愲愮慆愯慏愩慀戠酨戣戥戤揅揱揫搐搒搉搠搤"],
		["dda1", "搳摃搟搕搘搹搷搢搣搌搦搰搨摁搵搯搊搚摀搥搧搋揧搛搮搡搎敯斒旓暆暌暕暐暋暊暙暔晸朠楦楟椸楎楢楱椿楅楪椹楂楗楙楺楈楉椵楬椳椽楥棰楸椴楩楀楯楄楶楘楁楴楌椻楋椷楜楏楑椲楒椯楻椼歆歅歃歂歈歁殛嗀毻毼"],
		["de40", "毹毷毸溛滖滈溏滀溟溓溔溠溱溹滆滒溽滁溞滉溷溰滍溦滏溲溾滃滜滘溙溒溎溍溤溡溿溳滐滊溗溮溣煇煔煒煣煠煁煝煢煲煸煪煡煂煘煃煋煰煟煐煓"],
		["dea1", "煄煍煚牏犍犌犑犐犎猼獂猻猺獀獊獉瑄瑊瑋瑒瑑瑗瑀瑏瑐瑎瑂瑆瑍瑔瓡瓿瓾瓽甝畹畷榃痯瘏瘃痷痾痼痹痸瘐痻痶痭痵痽皙皵盝睕睟睠睒睖睚睩睧睔睙睭矠碇碚碔碏碄碕碅碆碡碃硹碙碀碖硻祼禂祽祹稑稘稙稒稗稕稢稓"],
		["df40", "稛稐窣窢窞竫筦筤筭筴筩筲筥筳筱筰筡筸筶筣粲粴粯綈綆綀綍絿綅絺綎絻綃絼綌綔綄絽綒罭罫罧罨罬羦羥羧翛翜耡腤腠腷腜腩腛腢腲朡腞腶腧腯"],
		["dfa1", "腄腡舝艉艄艀艂艅蓱萿葖葶葹蒏蒍葥葑葀蒆葧萰葍葽葚葙葴葳葝蔇葞萷萺萴葺葃葸萲葅萩菙葋萯葂萭葟葰萹葎葌葒葯蓅蒎萻葇萶萳葨葾葄萫葠葔葮葐蜋蜄蛷蜌蛺蛖蛵蝍蛸蜎蜉蜁蛶蜍蜅裖裋裍裎裞裛裚裌裐覅覛觟觥觤"],
		["e040", "觡觠觢觜触詶誆詿詡訿詷誂誄詵誃誁詴詺谼豋豊豥豤豦貆貄貅賌赨赩趑趌趎趏趍趓趔趐趒跰跠跬跱跮跐跩跣跢跧跲跫跴輆軿輁輀輅輇輈輂輋遒逿"],
		["e0a1", "遄遉逽鄐鄍鄏鄑鄖鄔鄋鄎酮酯鉈鉒鈰鈺鉦鈳鉥鉞銃鈮鉊鉆鉭鉬鉏鉠鉧鉯鈶鉡鉰鈱鉔鉣鉐鉲鉎鉓鉌鉖鈲閟閜閞閛隒隓隑隗雎雺雽雸雵靳靷靸靲頏頍頎颬飶飹馯馲馰馵骭骫魛鳪鳭鳧麀黽僦僔僗僨僳僛僪僝僤僓僬僰僯僣僠"],
		["e140", "凘劀劁勩勫匰厬嘧嘕嘌嘒嗼嘏嘜嘁嘓嘂嗺嘝嘄嗿嗹墉塼墐墘墆墁塿塴墋塺墇墑墎塶墂墈塻墔墏壾奫嫜嫮嫥嫕嫪嫚嫭嫫嫳嫢嫠嫛嫬嫞嫝嫙嫨嫟孷寠"],
		["e1a1", "寣屣嶂嶀嵽嶆嵺嶁嵷嶊嶉嶈嵾嵼嶍嵹嵿幘幙幓廘廑廗廎廜廕廙廒廔彄彃彯徶愬愨慁慞慱慳慒慓慲慬憀慴慔慺慛慥愻慪慡慖戩戧戫搫摍摛摝摴摶摲摳摽摵摦撦摎撂摞摜摋摓摠摐摿搿摬摫摙摥摷敳斠暡暠暟朅朄朢榱榶槉"],
		["e240", "榠槎榖榰榬榼榑榙榎榧榍榩榾榯榿槄榽榤槔榹槊榚槏榳榓榪榡榞槙榗榐槂榵榥槆歊歍歋殞殟殠毃毄毾滎滵滱漃漥滸漷滻漮漉潎漙漚漧漘漻漒滭漊"],
		["e2a1", "漶潳滹滮漭潀漰漼漵滫漇漎潃漅滽滶漹漜滼漺漟漍漞漈漡熇熐熉熀熅熂熏煻熆熁熗牄牓犗犕犓獃獍獑獌瑢瑳瑱瑵瑲瑧瑮甀甂甃畽疐瘖瘈瘌瘕瘑瘊瘔皸瞁睼瞅瞂睮瞀睯睾瞃碲碪碴碭碨硾碫碞碥碠碬碢碤禘禊禋禖禕禔禓"],
		["e340", "禗禈禒禐稫穊稰稯稨稦窨窫窬竮箈箜箊箑箐箖箍箌箛箎箅箘劄箙箤箂粻粿粼粺綧綷緂綣綪緁緀緅綝緎緄緆緋緌綯綹綖綼綟綦綮綩綡緉罳翢翣翥翞"],
		["e3a1", "耤聝聜膉膆膃膇膍膌膋舕蒗蒤蒡蒟蒺蓎蓂蒬蒮蒫蒹蒴蓁蓍蒪蒚蒱蓐蒝蒧蒻蒢蒔蓇蓌蒛蒩蒯蒨蓖蒘蒶蓏蒠蓗蓔蓒蓛蒰蒑虡蜳蜣蜨蝫蝀蜮蜞蜡蜙蜛蝃蜬蝁蜾蝆蜠蜲蜪蜭蜼蜒蜺蜱蜵蝂蜦蜧蜸蜤蜚蜰蜑裷裧裱裲裺裾裮裼裶裻"],
		["e440", "裰裬裫覝覡覟覞觩觫觨誫誙誋誒誏誖谽豨豩賕賏賗趖踉踂跿踍跽踊踃踇踆踅跾踀踄輐輑輎輍鄣鄜鄠鄢鄟鄝鄚鄤鄡鄛酺酲酹酳銥銤鉶銛鉺銠銔銪銍"],
		["e4a1", "銦銚銫鉹銗鉿銣鋮銎銂銕銢鉽銈銡銊銆銌銙銧鉾銇銩銝銋鈭隞隡雿靘靽靺靾鞃鞀鞂靻鞄鞁靿韎韍頖颭颮餂餀餇馝馜駃馹馻馺駂馽駇骱髣髧鬾鬿魠魡魟鳱鳲鳵麧僿儃儰僸儆儇僶僾儋儌僽儊劋劌勱勯噈噂噌嘵噁噊噉噆噘"],
		["e540", "噚噀嘳嘽嘬嘾嘸嘪嘺圚墫墝墱墠墣墯墬墥墡壿嫿嫴嫽嫷嫶嬃嫸嬂嫹嬁嬇嬅嬏屧嶙嶗嶟嶒嶢嶓嶕嶠嶜嶡嶚嶞幩幝幠幜緳廛廞廡彉徲憋憃慹憱憰憢憉"],
		["e5a1", "憛憓憯憭憟憒憪憡憍慦憳戭摮摰撖撠撅撗撜撏撋撊撌撣撟摨撱撘敶敺敹敻斲斳暵暰暩暲暷暪暯樀樆樗槥槸樕槱槤樠槿槬槢樛樝槾樧槲槮樔槷槧橀樈槦槻樍槼槫樉樄樘樥樏槶樦樇槴樖歑殥殣殢殦氁氀毿氂潁漦潾澇濆澒"],
		["e640", "澍澉澌潢潏澅潚澖潶潬澂潕潲潒潐潗澔澓潝漀潡潫潽潧澐潓澋潩潿澕潣潷潪潻熲熯熛熰熠熚熩熵熝熥熞熤熡熪熜熧熳犘犚獘獒獞獟獠獝獛獡獚獙"],
		["e6a1", "獢璇璉璊璆璁瑽璅璈瑼瑹甈甇畾瘥瘞瘙瘝瘜瘣瘚瘨瘛皜皝皞皛瞍瞏瞉瞈磍碻磏磌磑磎磔磈磃磄磉禚禡禠禜禢禛歶稹窲窴窳箷篋箾箬篎箯箹篊箵糅糈糌糋緷緛緪緧緗緡縃緺緦緶緱緰緮緟罶羬羰羭翭翫翪翬翦翨聤聧膣膟"],
		["e740", "膞膕膢膙膗舖艏艓艒艐艎艑蔤蔻蔏蔀蔩蔎蔉蔍蔟蔊蔧蔜蓻蔫蓺蔈蔌蓴蔪蓲蔕蓷蓫蓳蓼蔒蓪蓩蔖蓾蔨蔝蔮蔂蓽蔞蓶蔱蔦蓧蓨蓰蓯蓹蔘蔠蔰蔋蔙蔯虢"],
		["e7a1", "蝖蝣蝤蝷蟡蝳蝘蝔蝛蝒蝡蝚蝑蝞蝭蝪蝐蝎蝟蝝蝯蝬蝺蝮蝜蝥蝏蝻蝵蝢蝧蝩衚褅褌褔褋褗褘褙褆褖褑褎褉覢覤覣觭觰觬諏諆誸諓諑諔諕誻諗誾諀諅諘諃誺誽諙谾豍貏賥賟賙賨賚賝賧趠趜趡趛踠踣踥踤踮踕踛踖踑踙踦踧"],
		["e840", "踔踒踘踓踜踗踚輬輤輘輚輠輣輖輗遳遰遯遧遫鄯鄫鄩鄪鄲鄦鄮醅醆醊醁醂醄醀鋐鋃鋄鋀鋙銶鋏鋱鋟鋘鋩鋗鋝鋌鋯鋂鋨鋊鋈鋎鋦鋍鋕鋉鋠鋞鋧鋑鋓"],
		["e8a1", "銵鋡鋆銴镼閬閫閮閰隤隢雓霅霈霂靚鞊鞎鞈韐韏頞頝頦頩頨頠頛頧颲餈飺餑餔餖餗餕駜駍駏駓駔駎駉駖駘駋駗駌骳髬髫髳髲髱魆魃魧魴魱魦魶魵魰魨魤魬鳼鳺鳽鳿鳷鴇鴀鳹鳻鴈鴅鴄麃黓鼏鼐儜儓儗儚儑凞匴叡噰噠噮"],
		["e940", "噳噦噣噭噲噞噷圜圛壈墽壉墿墺壂墼壆嬗嬙嬛嬡嬔嬓嬐嬖嬨嬚嬠嬞寯嶬嶱嶩嶧嶵嶰嶮嶪嶨嶲嶭嶯嶴幧幨幦幯廩廧廦廨廥彋徼憝憨憖懅憴懆懁懌憺"],
		["e9a1", "憿憸憌擗擖擐擏擉撽撉擃擛擳擙攳敿敼斢曈暾曀曊曋曏暽暻暺曌朣樴橦橉橧樲橨樾橝橭橶橛橑樨橚樻樿橁橪橤橐橏橔橯橩橠樼橞橖橕橍橎橆歕歔歖殧殪殫毈毇氄氃氆澭濋澣濇澼濎濈潞濄澽澞濊澨瀄澥澮澺澬澪濏澿澸"],
		["ea40", "澢濉澫濍澯澲澰燅燂熿熸燖燀燁燋燔燊燇燏熽燘熼燆燚燛犝犞獩獦獧獬獥獫獪瑿璚璠璔璒璕璡甋疀瘯瘭瘱瘽瘳瘼瘵瘲瘰皻盦瞚瞝瞡瞜瞛瞢瞣瞕瞙"],
		["eaa1", "瞗磝磩磥磪磞磣磛磡磢磭磟磠禤穄穈穇窶窸窵窱窷篞篣篧篝篕篥篚篨篹篔篪篢篜篫篘篟糒糔糗糐糑縒縡縗縌縟縠縓縎縜縕縚縢縋縏縖縍縔縥縤罃罻罼罺羱翯耪耩聬膱膦膮膹膵膫膰膬膴膲膷膧臲艕艖艗蕖蕅蕫蕍蕓蕡蕘"],
		["eb40", "蕀蕆蕤蕁蕢蕄蕑蕇蕣蔾蕛蕱蕎蕮蕵蕕蕧蕠薌蕦蕝蕔蕥蕬虣虥虤螛螏螗螓螒螈螁螖螘蝹螇螣螅螐螑螝螄螔螜螚螉褞褦褰褭褮褧褱褢褩褣褯褬褟觱諠"],
		["eba1", "諢諲諴諵諝謔諤諟諰諈諞諡諨諿諯諻貑貒貐賵賮賱賰賳赬赮趥趧踳踾踸蹀蹅踶踼踽蹁踰踿躽輶輮輵輲輹輷輴遶遹遻邆郺鄳鄵鄶醓醐醑醍醏錧錞錈錟錆錏鍺錸錼錛錣錒錁鍆錭錎錍鋋錝鋺錥錓鋹鋷錴錂錤鋿錩錹錵錪錔錌"],
		["ec40", "錋鋾錉錀鋻錖閼闍閾閹閺閶閿閵閽隩雔霋霒霐鞙鞗鞔韰韸頵頯頲餤餟餧餩馞駮駬駥駤駰駣駪駩駧骹骿骴骻髶髺髹髷鬳鮀鮅鮇魼魾魻鮂鮓鮒鮐魺鮕"],
		["eca1", "魽鮈鴥鴗鴠鴞鴔鴩鴝鴘鴢鴐鴙鴟麈麆麇麮麭黕黖黺鼒鼽儦儥儢儤儠儩勴嚓嚌嚍嚆嚄嚃噾嚂噿嚁壖壔壏壒嬭嬥嬲嬣嬬嬧嬦嬯嬮孻寱寲嶷幬幪徾徻懃憵憼懧懠懥懤懨懞擯擩擣擫擤擨斁斀斶旚曒檍檖檁檥檉檟檛檡檞檇檓檎"],
		["ed40", "檕檃檨檤檑橿檦檚檅檌檒歛殭氉濌澩濴濔濣濜濭濧濦濞濲濝濢濨燡燱燨燲燤燰燢獳獮獯璗璲璫璐璪璭璱璥璯甐甑甒甏疄癃癈癉癇皤盩瞵瞫瞲瞷瞶"],
		["eda1", "瞴瞱瞨矰磳磽礂磻磼磲礅磹磾礄禫禨穜穛穖穘穔穚窾竀竁簅簏篲簀篿篻簎篴簋篳簂簉簃簁篸篽簆篰篱簐簊糨縭縼繂縳顈縸縪繉繀繇縩繌縰縻縶繄縺罅罿罾罽翴翲耬膻臄臌臊臅臇膼臩艛艚艜薃薀薏薧薕薠薋薣蕻薤薚薞"],
		["ee40", "蕷蕼薉薡蕺蕸蕗薎薖薆薍薙薝薁薢薂薈薅蕹蕶薘薐薟虨螾螪螭蟅螰螬螹螵螼螮蟉蟃蟂蟌螷螯蟄蟊螴螶螿螸螽蟞螲褵褳褼褾襁襒褷襂覭覯覮觲觳謞"],
		["eea1", "謘謖謑謅謋謢謏謒謕謇謍謈謆謜謓謚豏豰豲豱豯貕貔賹赯蹎蹍蹓蹐蹌蹇轃轀邅遾鄸醚醢醛醙醟醡醝醠鎡鎃鎯鍤鍖鍇鍼鍘鍜鍶鍉鍐鍑鍠鍭鎏鍌鍪鍹鍗鍕鍒鍏鍱鍷鍻鍡鍞鍣鍧鎀鍎鍙闇闀闉闃闅閷隮隰隬霠霟霘霝霙鞚鞡鞜"],
		["ef40", "鞞鞝韕韔韱顁顄顊顉顅顃餥餫餬餪餳餲餯餭餱餰馘馣馡騂駺駴駷駹駸駶駻駽駾駼騃骾髾髽鬁髼魈鮚鮨鮞鮛鮦鮡鮥鮤鮆鮢鮠鮯鴳鵁鵧鴶鴮鴯鴱鴸鴰"],
		["efa1", "鵅鵂鵃鴾鴷鵀鴽翵鴭麊麉麍麰黈黚黻黿鼤鼣鼢齔龠儱儭儮嚘嚜嚗嚚嚝嚙奰嬼屩屪巀幭幮懘懟懭懮懱懪懰懫懖懩擿攄擽擸攁攃擼斔旛曚曛曘櫅檹檽櫡櫆檺檶檷櫇檴檭歞毉氋瀇瀌瀍瀁瀅瀔瀎濿瀀濻瀦濼濷瀊爁燿燹爃燽獶"],
		["f040", "璸瓀璵瓁璾璶璻瓂甔甓癜癤癙癐癓癗癚皦皽盬矂瞺磿礌礓礔礉礐礒礑禭禬穟簜簩簙簠簟簭簝簦簨簢簥簰繜繐繖繣繘繢繟繑繠繗繓羵羳翷翸聵臑臒"],
		["f0a1", "臐艟艞薴藆藀藃藂薳薵薽藇藄薿藋藎藈藅薱薶藒蘤薸薷薾虩蟧蟦蟢蟛蟫蟪蟥蟟蟳蟤蟔蟜蟓蟭蟘蟣螤蟗蟙蠁蟴蟨蟝襓襋襏襌襆襐襑襉謪謧謣謳謰謵譇謯謼謾謱謥謷謦謶謮謤謻謽謺豂豵貙貘貗賾贄贂贀蹜蹢蹠蹗蹖蹞蹥蹧"],
		["f140", "蹛蹚蹡蹝蹩蹔轆轇轈轋鄨鄺鄻鄾醨醥醧醯醪鎵鎌鎒鎷鎛鎝鎉鎧鎎鎪鎞鎦鎕鎈鎙鎟鎍鎱鎑鎲鎤鎨鎴鎣鎥闒闓闑隳雗雚巂雟雘雝霣霢霥鞬鞮鞨鞫鞤鞪"],
		["f1a1", "鞢鞥韗韙韖韘韺顐顑顒颸饁餼餺騏騋騉騍騄騑騊騅騇騆髀髜鬈鬄鬅鬩鬵魊魌魋鯇鯆鯃鮿鯁鮵鮸鯓鮶鯄鮹鮽鵜鵓鵏鵊鵛鵋鵙鵖鵌鵗鵒鵔鵟鵘鵚麎麌黟鼁鼀鼖鼥鼫鼪鼩鼨齌齕儴儵劖勷厴嚫嚭嚦嚧嚪嚬壚壝壛夒嬽嬾嬿巃幰"],
		["f240", "徿懻攇攐攍攉攌攎斄旞旝曞櫧櫠櫌櫑櫙櫋櫟櫜櫐櫫櫏櫍櫞歠殰氌瀙瀧瀠瀖瀫瀡瀢瀣瀩瀗瀤瀜瀪爌爊爇爂爅犥犦犤犣犡瓋瓅璷瓃甖癠矉矊矄矱礝礛"],
		["f2a1", "礡礜礗礞禰穧穨簳簼簹簬簻糬糪繶繵繸繰繷繯繺繲繴繨罋罊羃羆羷翽翾聸臗臕艤艡艣藫藱藭藙藡藨藚藗藬藲藸藘藟藣藜藑藰藦藯藞藢蠀蟺蠃蟶蟷蠉蠌蠋蠆蟼蠈蟿蠊蠂襢襚襛襗襡襜襘襝襙覈覷覶觶譐譈譊譀譓譖譔譋譕"],
		["f340", "譑譂譒譗豃豷豶貚贆贇贉趬趪趭趫蹭蹸蹳蹪蹯蹻軂轒轑轏轐轓辴酀鄿醰醭鏞鏇鏏鏂鏚鏐鏹鏬鏌鏙鎩鏦鏊鏔鏮鏣鏕鏄鏎鏀鏒鏧镽闚闛雡霩霫霬霨霦"],
		["f3a1", "鞳鞷鞶韝韞韟顜顙顝顗颿颽颻颾饈饇饃馦馧騚騕騥騝騤騛騢騠騧騣騞騜騔髂鬋鬊鬎鬌鬷鯪鯫鯠鯞鯤鯦鯢鯰鯔鯗鯬鯜鯙鯥鯕鯡鯚鵷鶁鶊鶄鶈鵱鶀鵸鶆鶋鶌鵽鵫鵴鵵鵰鵩鶅鵳鵻鶂鵯鵹鵿鶇鵨麔麑黀黼鼭齀齁齍齖齗齘匷嚲"],
		["f440", "嚵嚳壣孅巆巇廮廯忀忁懹攗攖攕攓旟曨曣曤櫳櫰櫪櫨櫹櫱櫮櫯瀼瀵瀯瀷瀴瀱灂瀸瀿瀺瀹灀瀻瀳灁爓爔犨獽獼璺皫皪皾盭矌矎矏矍矲礥礣礧礨礤礩"],
		["f4a1", "禲穮穬穭竷籉籈籊籇籅糮繻繾纁纀羺翿聹臛臙舋艨艩蘢藿蘁藾蘛蘀藶蘄蘉蘅蘌藽蠙蠐蠑蠗蠓蠖襣襦覹觷譠譪譝譨譣譥譧譭趮躆躈躄轙轖轗轕轘轚邍酃酁醷醵醲醳鐋鐓鏻鐠鐏鐔鏾鐕鐐鐨鐙鐍鏵鐀鏷鐇鐎鐖鐒鏺鐉鏸鐊鏿"],
		["f540", "鏼鐌鏶鐑鐆闞闠闟霮霯鞹鞻韽韾顠顢顣顟飁飂饐饎饙饌饋饓騲騴騱騬騪騶騩騮騸騭髇髊髆鬐鬒鬑鰋鰈鯷鰅鰒鯸鱀鰇鰎鰆鰗鰔鰉鶟鶙鶤鶝鶒鶘鶐鶛"],
		["f5a1", "鶠鶔鶜鶪鶗鶡鶚鶢鶨鶞鶣鶿鶩鶖鶦鶧麙麛麚黥黤黧黦鼰鼮齛齠齞齝齙龑儺儹劘劗囃嚽嚾孈孇巋巏廱懽攛欂櫼欃櫸欀灃灄灊灈灉灅灆爝爚爙獾甗癪矐礭礱礯籔籓糲纊纇纈纋纆纍罍羻耰臝蘘蘪蘦蘟蘣蘜蘙蘧蘮蘡蘠蘩蘞蘥"],
		["f640", "蠩蠝蠛蠠蠤蠜蠫衊襭襩襮襫觺譹譸譅譺譻贐贔趯躎躌轞轛轝酆酄酅醹鐿鐻鐶鐩鐽鐼鐰鐹鐪鐷鐬鑀鐱闥闤闣霵霺鞿韡顤飉飆飀饘饖騹騽驆驄驂驁騺"],
		["f6a1", "騿髍鬕鬗鬘鬖鬺魒鰫鰝鰜鰬鰣鰨鰩鰤鰡鶷鶶鶼鷁鷇鷊鷏鶾鷅鷃鶻鶵鷎鶹鶺鶬鷈鶱鶭鷌鶳鷍鶲鹺麜黫黮黭鼛鼘鼚鼱齎齥齤龒亹囆囅囋奱孋孌巕巑廲攡攠攦攢欋欈欉氍灕灖灗灒爞爟犩獿瓘瓕瓙瓗癭皭礵禴穰穱籗籜籙籛籚"],
		["f740", "糴糱纑罏羇臞艫蘴蘵蘳蘬蘲蘶蠬蠨蠦蠪蠥襱覿覾觻譾讄讂讆讅譿贕躕躔躚躒躐躖躗轠轢酇鑌鑐鑊鑋鑏鑇鑅鑈鑉鑆霿韣顪顩飋饔饛驎驓驔驌驏驈驊"],
		["f7a1", "驉驒驐髐鬙鬫鬻魖魕鱆鱈鰿鱄鰹鰳鱁鰼鰷鰴鰲鰽鰶鷛鷒鷞鷚鷋鷐鷜鷑鷟鷩鷙鷘鷖鷵鷕鷝麶黰鼵鼳鼲齂齫龕龢儽劙壨壧奲孍巘蠯彏戁戃戄攩攥斖曫欑欒欏毊灛灚爢玂玁玃癰矔籧籦纕艬蘺虀蘹蘼蘱蘻蘾蠰蠲蠮蠳襶襴襳觾"],
		["f840", "讌讎讋讈豅贙躘轤轣醼鑢鑕鑝鑗鑞韄韅頀驖驙鬞鬟鬠鱒鱘鱐鱊鱍鱋鱕鱙鱌鱎鷻鷷鷯鷣鷫鷸鷤鷶鷡鷮鷦鷲鷰鷢鷬鷴鷳鷨鷭黂黐黲黳鼆鼜鼸鼷鼶齃齏"],
		["f8a1", "齱齰齮齯囓囍孎屭攭曭曮欓灟灡灝灠爣瓛瓥矕礸禷禶籪纗羉艭虃蠸蠷蠵衋讔讕躞躟躠躝醾醽釂鑫鑨鑩雥靆靃靇韇韥驞髕魙鱣鱧鱦鱢鱞鱠鸂鷾鸇鸃鸆鸅鸀鸁鸉鷿鷽鸄麠鼞齆齴齵齶囔攮斸欘欙欗欚灢爦犪矘矙礹籩籫糶纚"],
		["f940", "纘纛纙臠臡虆虇虈襹襺襼襻觿讘讙躥躤躣鑮鑭鑯鑱鑳靉顲饟鱨鱮鱭鸋鸍鸐鸏鸒鸑麡黵鼉齇齸齻齺齹圞灦籯蠼趲躦釃鑴鑸鑶鑵驠鱴鱳鱱鱵鸔鸓黶鼊"],
		["f9a1", "龤灨灥糷虪蠾蠽蠿讞貜躩軉靋顳顴飌饡馫驤驦驧鬤鸕鸗齈戇欞爧虌躨钂钀钁驩驨鬮鸙爩虋讟钃鱹麷癵驫鱺鸝灩灪麤齾齉龘碁銹裏墻恒粧嫺╔╦╗╠╬╣╚╩╝╒╤╕╞╪╡╘╧╛╓╥╖╟╫╢╙╨╜║═╭╮╰╯▓"]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/big5-added.json
var require_big5_added = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/tables/big5-added.json": ((exports, module) => {
	module.exports = [
		["8740", "䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻"],
		["8767", "綕夝𨮹㷴霴𧯯寛𡵞媤㘥𩺰嫑宷峼杮薓𩥅瑡璝㡵𡵓𣚞𦀡㻬"],
		["87a1", "𥣞㫵竼龗𤅡𨤍𣇪𠪊𣉞䌊蒄龖鐯䤰蘓墖靊鈘秐稲晠権袝瑌篅枂稬剏遆㓦珄𥶹瓆鿇垳䤯呌䄱𣚎堘穲𧭥讏䚮𦺈䆁𥶙箮𢒼鿈𢓁𢓉𢓌鿉蔄𣖻䂴鿊䓡𪷿拁灮鿋"],
		[
			"8840",
			"㇀",
			4,
			"𠄌㇅𠃑𠃍㇆㇇𠃋𡿨㇈𠃊㇉㇊㇋㇌𠄎㇍㇎ĀÁǍÀĒÉĚÈŌÓǑÒ࿿Ê̄Ế࿿Ê̌ỀÊāáǎàɑēéěèīíǐìōóǒòūúǔùǖǘǚ"
		],
		["88a1", "ǜü࿿ê̄ế࿿ê̌ềêɡ⏚⏛"],
		["8940", "𪎩𡅅"],
		["8943", "攊"],
		["8946", "丽滝鵎釟"],
		["894c", "𧜵撑会伨侨兖兴农凤务动医华发变团声处备夲头学实実岚庆总斉柾栄桥济炼电纤纬纺织经统缆缷艺苏药视设询车轧轮"],
		["89a1", "琑糼緍楆竉刧"],
		["89ab", "醌碸酞肼"],
		["89b0", "贋胶𠧧"],
		["89b5", "肟黇䳍鷉鸌䰾𩷶𧀎鸊𪄳㗁"],
		["89c1", "溚舾甙"],
		["89c5", "䤑马骏龙禇𨑬𡷊𠗐𢫦两亁亀亇亿仫伷㑌侽㹈倃傈㑽㒓㒥円夅凛凼刅争剹劐匧㗇厩㕑厰㕓参吣㕭㕲㚁咓咣咴咹哐哯唘唣唨㖘唿㖥㖿嗗㗅"],
		["8a40", "𧶄唥"],
		["8a43", "𠱂𠴕𥄫喐𢳆㧬𠍁蹆𤶸𩓥䁓𨂾睺𢰸㨴䟕𨅝𦧲𤷪擝𠵼𠾴𠳕𡃴撍蹾𠺖𠰋𠽤𢲩𨉖𤓓"],
		["8a64", "𠵆𩩍𨃩䟴𤺧𢳂骲㩧𩗴㿭㔆𥋇𩟔𧣈𢵄鵮頕"],
		["8a76", "䏙𦂥撴哣𢵌𢯊𡁷㧻𡁯"],
		["8aa1", "𦛚𦜖𧦠擪𥁒𠱃蹨𢆡𨭌𠜱"],
		["8aac", "䠋𠆩㿺塳𢶍"],
		["8ab2", "𤗈𠓼𦂗𠽌𠶖啹䂻䎺"],
		["8abb", "䪴𢩦𡂝膪飵𠶜捹㧾𢝵跀嚡摼㹃"],
		["8ac9", "𪘁𠸉𢫏𢳉"],
		["8ace", "𡃈𣧂㦒㨆𨊛㕸𥹉𢃇噒𠼱𢲲𩜠㒼氽𤸻"],
		["8adf", "𧕴𢺋𢈈𪙛𨳍𠹺𠰴𦠜羓𡃏𢠃𢤹㗻𥇣𠺌𠾍𠺪㾓𠼰𠵇𡅏𠹌"],
		["8af6", "𠺫𠮩𠵈𡃀𡄽㿹𢚖搲𠾭"],
		["8b40", "𣏴𧘹𢯎𠵾𠵿𢱑𢱕㨘𠺘𡃇𠼮𪘲𦭐𨳒𨶙𨳊閪哌苄喹"],
		["8b55", "𩻃鰦骶𧝞𢷮煀腭胬尜𦕲脴㞗卟𨂽醶𠻺𠸏𠹷𠻻㗝𤷫㘉𠳖嚯𢞵𡃉𠸐𠹸𡁸𡅈𨈇𡑕𠹹𤹐𢶤婔𡀝𡀞𡃵𡃶垜𠸑"],
		["8ba1", "𧚔𨋍𠾵𠹻𥅾㜃𠾶𡆀𥋘𪊽𤧚𡠺𤅷𨉼墙剨㘚𥜽箲孨䠀䬬鼧䧧鰟鮍𥭴𣄽嗻㗲嚉丨夂𡯁屮靑𠂆乛亻㔾尣彑忄㣺扌攵歺氵氺灬爫丬犭𤣩罒礻糹罓𦉪㓁"],
		["8bde", "𦍋耂肀𦘒𦥑卝衤见𧢲讠贝钅镸长门𨸏韦页风飞饣𩠐鱼鸟黄歯龜丷𠂇阝户钢"],
		["8c40", "倻淾𩱳龦㷉袏𤅎灷峵䬠𥇍㕙𥴰愢𨨲辧釶熑朙玺𣊁𪄇㲋𡦀䬐磤琂冮𨜏䀉橣𪊺䈣蘏𠩯稪𩥇𨫪靕灍匤𢁾鏴盙𨧣龧矝亣俰傼丯众龨吴綋墒壐𡶶庒庙忂𢜒斋"],
		["8ca1", "𣏹椙橃𣱣泿"],
		["8ca7", "爀𤔅玌㻛𤨓嬕璹讃𥲤𥚕窓篬糃繬苸薗龩袐龪躹龫迏蕟駠鈡龬𨶹𡐿䁱䊢娚"],
		["8cc9", "顨杫䉶圽"],
		["8cce", "藖𤥻芿𧄍䲁𦵴嵻𦬕𦾾龭龮宖龯曧繛湗秊㶈䓃𣉖𢞖䎚䔶"],
		["8ce6", "峕𣬚諹屸㴒𣕑嵸龲煗䕘𤃬𡸣䱷㥸㑊𠆤𦱁諌侴𠈹妿腬顖𩣺弻"],
		["8d40", "𠮟"],
		["8d42", "𢇁𨥭䄂䚻𩁹㼇龳𪆵䃸㟖䛷𦱆䅼𨚲𧏿䕭㣔𥒚䕡䔛䶉䱻䵶䗪㿈𤬏㙡䓞䒽䇭崾嵈嵖㷼㠏嶤嶹㠠㠸幂庽弥徃㤈㤔㤿㥍惗愽峥㦉憷憹懏㦸戬抐拥挘㧸嚱"],
		["8da1", "㨃揢揻搇摚㩋擀崕嘡龟㪗斆㪽旿晓㫲暒㬢朖㭂枤栀㭘桊梄㭲㭱㭻椉楃牜楤榟榅㮼槖㯝橥橴橱檂㯬檙㯲檫檵櫔櫶殁毁毪汵沪㳋洂洆洦涁㳯涤涱渕渘温溆𨧀溻滢滚齿滨滩漤漴㵆𣽁澁澾㵪㵵熷岙㶊瀬㶑灐灔灯灿炉𠌥䏁㗱𠻘"],
		["8e40", "𣻗垾𦻓焾𥟠㙎榢𨯩孴穉𥣡𩓙穥穽𥦬窻窰竂竃燑𦒍䇊竚竝竪䇯咲𥰁笋筕笩𥌎𥳾箢筯莜𥮴𦱿篐萡箒箸𥴠㶭𥱥蒒篺簆簵𥳁籄粃𤢂粦晽𤕸糉糇糦籴糳糵糎"],
		["8ea1", "繧䔝𦹄絝𦻖璍綉綫焵綳緒𤁗𦀩緤㴓緵𡟹緥𨍭縝𦄡𦅚繮纒䌫鑬縧罀罁罇礶𦋐駡羗𦍑羣𡙡𠁨䕜𣝦䔃𨌺翺𦒉者耈耝耨耯𪂇𦳃耻耼聡𢜔䦉𦘦𣷣𦛨朥肧𨩈脇脚墰𢛶汿𦒘𤾸擧𡒊舘𡡞橓𤩥𤪕䑺舩𠬍𦩒𣵾俹𡓽蓢荢𦬊𤦧𣔰𡝳𣷸芪椛芳䇛"],
		["8f40", "蕋苐茚𠸖𡞴㛁𣅽𣕚艻苢茘𣺋𦶣𦬅𦮗𣗎㶿茝嗬莅䔋𦶥莬菁菓㑾𦻔橗蕚㒖𦹂𢻯葘𥯤葱㷓䓤檧葊𣲵祘蒨𦮖𦹷𦹃蓞萏莑䒠蒓蓤𥲑䉀𥳀䕃蔴嫲𦺙䔧蕳䔖枿蘖"],
		["8fa1", "𨘥𨘻藁𧂈蘂𡖂𧃍䕫䕪蘨㙈𡢢号𧎚虾蝱𪃸蟮𢰧螱蟚蠏噡虬桖䘏衅衆𧗠𣶹𧗤衞袜䙛袴袵揁装睷𧜏覇覊覦覩覧覼𨨥觧𧤤𧪽誜瞓釾誐𧩙竩𧬺𣾏䜓𧬸煼謌謟𥐰𥕥謿譌譍誩𤩺讐讛誯𡛟䘕衏貛𧵔𧶏貫㜥𧵓賖𧶘𧶽贒贃𡤐賛灜贑𤳉㻐起"],
		["9040", "趩𨀂𡀔𤦊㭼𨆼𧄌竧躭躶軃鋔輙輭𨍥𨐒辥錃𪊟𠩐辳䤪𨧞𨔽𣶻廸𣉢迹𪀔𨚼𨔁𢌥㦀𦻗逷𨔼𧪾遡𨕬𨘋邨𨜓郄𨛦邮都酧㫰醩釄粬𨤳𡺉鈎沟鉁鉢𥖹銹𨫆𣲛𨬌𥗛"],
		["90a1", "𠴱錬鍫𨫡𨯫炏嫃𨫢𨫥䥥鉄𨯬𨰹𨯿鍳鑛躼閅閦鐦閠濶䊹𢙺𨛘𡉼𣸮䧟氜陻隖䅬隣𦻕懚隶磵𨫠隽双䦡𦲸𠉴𦐐𩂯𩃥𤫑𡤕𣌊霱虂霶䨏䔽䖅𤫩灵孁霛靜𩇕靗孊𩇫靟鐥僐𣂷𣂼鞉鞟鞱鞾韀韒韠𥑬韮琜𩐳響韵𩐝𧥺䫑頴頳顋顦㬎𧅵㵑𠘰𤅜"],
		["9140", "𥜆飊颷飈飇䫿𦴧𡛓喰飡飦飬鍸餹𤨩䭲𩡗𩤅駵騌騻騐驘𥜥㛄𩂱𩯕髠髢𩬅髴䰎鬔鬭𨘀倴鬴𦦨㣃𣁽魐魀𩴾婅𡡣鮎𤉋鰂鯿鰌𩹨鷔𩾷𪆒𪆫𪃡𪄣𪇟鵾鶃𪄴鸎梈"],
		["91a1", "鷄𢅛𪆓𪈠𡤻𪈳鴹𪂹𪊴麐麕麞麢䴴麪麯𤍤黁㭠㧥㴝伲㞾𨰫鼂鼈䮖鐤𦶢鼗鼖鼹嚟嚊齅馸𩂋韲葿齢齩竜龎爖䮾𤥵𤦻煷𤧸𤍈𤩑玞𨯚𡣺禟𨥾𨸶鍩鏳𨩄鋬鎁鏋𨥬𤒹爗㻫睲穃烐𤑳𤏸煾𡟯炣𡢾𣖙㻇𡢅𥐯𡟸㜢𡛻𡠹㛡𡝴𡣑𥽋㜣𡛀坛𤨥𡏾𡊨"],
		["9240", "𡏆𡒶蔃𣚦蔃葕𤦔𧅥𣸱𥕜𣻻𧁒䓴𣛮𩦝𦼦柹㜳㰕㷧塬𡤢栐䁗𣜿𤃡𤂋𤄏𦰡哋嚞𦚱嚒𠿟𠮨𠸍鏆𨬓鎜仸儫㠙𤐶亼𠑥𠍿佋侊𥙑婨𠆫𠏋㦙𠌊𠐔㐵伩𠋀𨺳𠉵諚𠈌亘"],
		["92a1", "働儍侢伃𤨎𣺊佂倮偬傁俌俥偘僼兙兛兝兞湶𣖕𣸹𣺿浲𡢄𣺉冨凃𠗠䓝𠒣𠒒𠒑赺𨪜𠜎剙劤𠡳勡鍮䙺熌𤎌𠰠𤦬𡃤槑𠸝瑹㻞璙琔瑖玘䮎𤪼𤂍叐㖄爏𤃉喴𠍅响𠯆圝鉝雴鍦埝垍坿㘾壋媙𨩆𡛺𡝯𡜐娬妸銏婾嫏娒𥥆𡧳𡡡𤊕㛵洅瑃娡𥺃"],
		["9340", "媁𨯗𠐓鏠璌𡌃焅䥲鐈𨧻鎽㞠尞岞幞幈𡦖𡥼𣫮廍孏𡤃𡤄㜁𡢠㛝𡛾㛓脪𨩇𡶺𣑲𨦨弌弎𡤧𡞫婫𡜻孄蘔𧗽衠恾𢡠𢘫忛㺸𢖯𢖾𩂈𦽳懀𠀾𠁆𢘛憙憘恵𢲛𢴇𤛔𩅍"],
		["93a1", "摱𤙥𢭪㨩𢬢𣑐𩣪𢹸挷𪑛撶挱揑𤧣𢵧护𢲡搻敫楲㯴𣂎𣊭𤦉𣊫唍𣋠𡣙𩐿曎𣊉𣆳㫠䆐𥖄𨬢𥖏𡛼𥕛𥐥磮𣄃𡠪𣈴㑤𣈏𣆂𤋉暎𦴤晫䮓昰𧡰𡷫晣𣋒𣋡昞𥡲㣑𣠺𣞼㮙𣞢𣏾瓐㮖枏𤘪梶栞㯄檾㡣𣟕𤒇樳橒櫉欅𡤒攑梘橌㯗橺歗𣿀𣲚鎠鋲𨯪𨫋"],
		["9440", "銉𨀞𨧜鑧涥漋𤧬浧𣽿㶏渄𤀼娽渊塇洤硂焻𤌚𤉶烱牐犇犔𤞏𤜥兹𤪤𠗫瑺𣻸𣙟𤩊𤤗𥿡㼆㺱𤫟𨰣𣼵悧㻳瓌琼鎇琷䒟𦷪䕑疃㽣𤳙𤴆㽘畕癳𪗆㬙瑨𨫌𤦫𤦎㫻"],
		["94a1", "㷍𤩎㻿𤧅𤣳釺圲鍂𨫣𡡤僟𥈡𥇧睸𣈲眎眏睻𤚗𣞁㩞𤣰琸璛㺿𤪺𤫇䃈𤪖𦆮錇𥖁砞碍碈磒珐祙𧝁𥛣䄎禛蒖禥樭𣻺稺秴䅮𡛦䄲鈵秱𠵌𤦌𠊙𣶺𡝮㖗啫㕰㚪𠇔𠰍竢婙𢛵𥪯𥪜娍𠉛磰娪𥯆竾䇹籝籭䈑𥮳𥺼𥺦糍𤧹𡞰粎籼粮檲緜縇緓罎𦉡"],
		["9540", "𦅜𧭈綗𥺂䉪𦭵𠤖柖𠁎𣗏埄𦐒𦏸𤥢翝笧𠠬𥫩𥵃笌𥸎駦虅驣樜𣐿㧢𤧷𦖭騟𦖠蒀𧄧𦳑䓪脷䐂胆脉腂𦞴飃𦩂艢艥𦩑葓𦶧蘐𧈛媆䅿𡡀嬫𡢡嫤𡣘蚠蜨𣶏蠭𧐢娂"],
		["95a1", "衮佅袇袿裦襥襍𥚃襔𧞅𧞄𨯵𨯙𨮜𨧹㺭蒣䛵䛏㟲訽訜𩑈彍鈫𤊄旔焩烄𡡅鵭貟賩𧷜妚矃姰䍮㛔踪躧𤰉輰轊䋴汘澻𢌡䢛潹溋𡟚鯩㚵𤤯邻邗啱䤆醻鐄𨩋䁢𨫼鐧𨰝𨰻蓥訫閙閧閗閖𨴴瑅㻂𤣿𤩂𤏪㻧𣈥随𨻧𨹦𨹥㻌𤧭𤩸𣿮琒瑫㻼靁𩂰"],
		["9640", "桇䨝𩂓𥟟靝鍨𨦉𨰦𨬯𦎾銺嬑譩䤼珹𤈛鞛靱餸𠼦巁𨯅𤪲頟𩓚鋶𩗗釥䓀𨭐𤩧𨭤飜𨩅㼀鈪䤥萔餻饍𧬆㷽馛䭯馪驜𨭥𥣈檏騡嫾騯𩣱䮐𩥈馼䮽䮗鍽塲𡌂堢𤦸"],
		["96a1", "𡓨硄𢜟𣶸棅㵽鑘㤧慐𢞁𢥫愇鱏鱓鱻鰵鰐魿鯏𩸭鮟𪇵𪃾鴡䲮𤄄鸘䲰鴌𪆴𪃭𪃳𩤯鶥蒽𦸒𦿟𦮂藼䔳𦶤𦺄𦷰萠藮𦸀𣟗𦁤秢𣖜𣙀䤭𤧞㵢鏛銾鍈𠊿碹鉷鑍俤㑀遤𥕝砽硔碶硋𡝗𣇉𤥁㚚佲濚濙瀞瀞吔𤆵垻壳垊鴖埗焴㒯𤆬燫𦱀𤾗嬨𡞵𨩉"],
		["9740", "愌嫎娋䊼𤒈㜬䭻𨧼鎻鎸𡣖𠼝葲𦳀𡐓𤋺𢰦𤏁妔𣶷𦝁綨𦅛𦂤𤦹𤦋𨧺鋥珢㻩璴𨭣𡢟㻡𤪳櫘珳珻㻖𤨾𤪔𡟙𤩦𠎧𡐤𤧥瑈𤤖炥𤥶銄珦鍟𠓾錱𨫎𨨖鎆𨯧𥗕䤵𨪂煫"],
		["97a1", "𤥃𠳿嚤𠘚𠯫𠲸唂秄𡟺緾𡛂𤩐𡡒䔮鐁㜊𨫀𤦭妰𡢿𡢃𧒄媡㛢𣵛㚰鉟婹𨪁𡡢鍴㳍𠪴䪖㦊僴㵩㵌𡎜煵䋻𨈘渏𩃤䓫浗𧹏灧沯㳖𣿭𣸭渂漌㵯𠏵畑㚼㓈䚀㻚䡱姄鉮䤾轁𨰜𦯀堒埈㛖𡑒烾𤍢𤩱𢿣𡊰𢎽梹楧𡎘𣓥𧯴𣛟𨪃𣟖𣏺𤲟樚𣚭𦲷萾䓟䓎"],
		["9840", "𦴦𦵑𦲂𦿞漗𧄉茽𡜺菭𦲀𧁓𡟛妉媂𡞳婡婱𡤅𤇼㜭姯𡜼㛇熎鎐暚𤊥婮娫𤊓樫𣻹𧜶𤑛𤋊焝𤉙𨧡侰𦴨峂𤓎𧹍𤎽樌𤉖𡌄炦焳𤏩㶥泟勇𤩏繥姫崯㷳彜𤩝𡟟綤萦"],
		["98a1", "咅𣫺𣌀𠈔坾𠣕𠘙㿥𡾞𪊶瀃𩅛嵰玏糓𨩙𩐠俈翧狍猐𧫴猸猹𥛶獁獈㺩𧬘遬燵𤣲珡臶㻊県㻑沢国琙琞琟㻢㻰㻴㻺瓓㼎㽓畂畭畲疍㽼痈痜㿀癍㿗癴㿜発𤽜熈嘣覀塩䀝睃䀹条䁅㗛瞘䁪䁯属瞾矋売砘点砜䂨砹硇硑硦葈𥔵礳栃礲䄃"],
		["9940", "䄉禑禙辻稆込䅧窑䆲窼艹䇄竏竛䇏両筢筬筻簒簛䉠䉺类粜䊌粸䊔糭输烀𠳏総緔緐緽羮羴犟䎗耠耥笹耮耱联㷌垴炠肷胩䏭脌猪脎脒畠脔䐁㬹腖腙腚"],
		["99a1", "䐓堺腼膄䐥膓䐭膥埯臁臤艔䒏芦艶苊苘苿䒰荗险榊萅烵葤惣蒈䔄蒾蓡蓸蔐蔸蕒䔻蕯蕰藠䕷虲蚒蚲蛯际螋䘆䘗袮裿褤襇覑𧥧訩訸誔誴豑賔賲贜䞘塟跃䟭仮踺嗘坔蹱嗵躰䠷軎転軤軭軲辷迁迊迌逳駄䢭飠鈓䤞鈨鉘鉫銱銮銿"],
		["9a40", "鋣鋫鋳鋴鋽鍃鎄鎭䥅䥑麿鐗匁鐝鐭鐾䥪鑔鑹锭関䦧间阳䧥枠䨤靀䨵鞲韂噔䫤惨颹䬙飱塄餎餙冴餜餷饂饝饢䭰駅䮝騼鬏窃魩鮁鯝鯱鯴䱭鰠㝯𡯂鵉鰺"],
		["9aa1", "黾噐鶓鶽鷀鷼银辶鹻麬麱麽黆铜黢黱黸竈齄𠂔𠊷𠎠椚铃妬𠓗塀铁㞹𠗕𠘕𠙶𡚺块煳𠫂𠫍𠮿呪吆𠯋咞𠯻𠰻𠱓𠱥𠱼惧𠲍噺𠲵𠳝𠳭𠵯𠶲𠷈楕鰯螥𠸄𠸎𠻗𠾐𠼭𠹳尠𠾼帋𡁜𡁏𡁶朞𡁻𡂈𡂖㙇𡂿𡃓𡄯𡄻卤蒭𡋣𡍵𡌶讁𡕷𡘙𡟃𡟇乸炻𡠭𡥪"],
		["9b40", "𡨭𡩅𡰪𡱰𡲬𡻈拃𡻕𡼕熘桕𢁅槩㛈𢉼𢏗𢏺𢜪𢡱𢥏苽𢥧𢦓𢫕覥𢫨辠𢬎鞸𢬿顇骽𢱌"],
		["9b62", "𢲈𢲷𥯨𢴈𢴒𢶷𢶕𢹂𢽴𢿌𣀳𣁦𣌟𣏞徱晈暿𧩹𣕧𣗳爁𤦺矗𣘚𣜖纇𠍆墵朎"],
		["9ba1", "椘𣪧𧙗𥿢𣸑𣺹𧗾𢂚䣐䪸𤄙𨪚𤋮𤌍𤀻𤌴𤎖𤩅𠗊凒𠘑妟𡺨㮾𣳿𤐄𤓖垈𤙴㦛𤜯𨗨𩧉㝢𢇃譞𨭎駖𤠒𤣻𤨕爉𤫀𠱸奥𤺥𤾆𠝹軚𥀬劏圿煱𥊙𥐙𣽊𤪧喼𥑆𥑮𦭒釔㑳𥔿𧘲𥕞䜘𥕢𥕦𥟇𤤿𥡝偦㓻𣏌惞𥤃䝼𨥈𥪮𥮉𥰆𡶐垡煑澶𦄂𧰒遖𦆲𤾚譢𦐂𦑊"],
		["9c40", "嵛𦯷輶𦒄𡤜諪𤧶𦒈𣿯𦔒䯀𦖿𦚵𢜛鑥𥟡憕娧晉侻嚹𤔡𦛼乪𤤴陖涏𦲽㘘襷𦞙𦡮𦐑𦡞營𦣇筂𩃀𠨑𦤦鄄𦤹穅鷰𦧺騦𦨭㙟𦑩𠀡禃𦨴𦭛崬𣔙菏𦮝䛐𦲤画补𦶮墶"],
		["9ca1", "㜜𢖍𧁋𧇍㱔𧊀𧊅銁𢅺𧊋錰𧋦𤧐氹钟𧑐𠻸蠧裵𢤦𨑳𡞱溸𤨪𡠠㦤㚹尐秣䔿暶𩲭𩢤襃𧟌𧡘囖䃟𡘊㦡𣜯𨃨𡏅熭荦𧧝𩆨婧䲷𧂯𨦫𧧽𧨊𧬋𧵦𤅺筃祾𨀉澵𪋟樃𨌘厢𦸇鎿栶靝𨅯𨀣𦦵𡏭𣈯𨁈嶅𨰰𨂃圕頣𨥉嶫𤦈斾槕叒𤪥𣾁㰑朶𨂐𨃴𨄮𡾡𨅏"],
		["9d40", "𨆉𨆯𨈚𨌆𨌯𨎊㗊𨑨𨚪䣺揦𨥖砈鉕𨦸䏲𨧧䏟𨧨𨭆𨯔姸𨰉輋𨿅𩃬筑𩄐𩄼㷷𩅞𤫊运犏嚋𩓧𩗩𩖰𩖸𩜲𩣑𩥉𩥪𩧃𩨨𩬎𩵚𩶛纟𩻸𩼣䲤镇𪊓熢𪋿䶑递𪗋䶜𠲜达嗁"],
		["9da1", "辺𢒰边𤪓䔉繿潖檱仪㓤𨬬𧢝㜺躀𡟵𨀤𨭬𨮙𧨾𦚯㷫𧙕𣲷𥘵𥥖亚𥺁𦉘嚿𠹭踎孭𣺈𤲞揞拐𡟶𡡻攰嘭𥱊吚𥌑㷆𩶘䱽嘢嘞罉𥻘奵𣵀蝰东𠿪𠵉𣚺脗鵞贘瘻鱅癎瞹鍅吲腈苷嘥脲萘肽嗪祢噃吖𠺝㗎嘅嗱曱𨋢㘭甴嗰喺咗啲𠱁𠲖廐𥅈𠹶𢱢"],
		["9e40", "𠺢麫絚嗞𡁵抝靭咔賍燶酶揼掹揾啩𢭃鱲𢺳冚㓟𠶧冧呍唞唓癦踭𦢊疱肶蠄螆裇膶萜𡃁䓬猄𤜆宐茋𦢓噻𢛴𧴯𤆣𧵳𦻐𧊶酰𡇙鈈𣳼𪚩𠺬𠻹牦𡲢䝎𤿂𧿹𠿫䃺"],
		["9ea1", "鱝攟𢶠䣳𤟠𩵼𠿬𠸊恢𧖣𠿭"],
		["9ead", "𦁈𡆇熣纎鵐业丄㕷嬍沲卧㚬㧜卽㚥𤘘墚𤭮舭呋垪𥪕𠥹"],
		["9ec5", "㩒𢑥獴𩺬䴉鯭𣳾𩼰䱛𤾩𩖞𩿞葜𣶶𧊲𦞳𣜠挮紥𣻷𣸬㨪逈勌㹴㙺䗩𠒎癀嫰𠺶硺𧼮墧䂿噼鮋嵴癔𪐴麅䳡痹㟻愙𣃚𤏲"],
		["9ef5", "噝𡊩垧𤥣𩸆刴𧂮㖭汊鵼"],
		["9f40", "籖鬹埞𡝬屓擓𩓐𦌵𧅤蚭𠴨𦴢𤫢𠵱"],
		["9f4f", "凾𡼏嶎霃𡷑麁遌笟鬂峑箣扨挵髿篏鬪籾鬮籂粆鰕篼鬉鼗鰛𤤾齚啳寃俽麘俲剠㸆勑坧偖妷帒韈鶫轜呩鞴饀鞺匬愰"],
		["9fa1", "椬叚鰊鴂䰻陁榀傦畆𡝭駚剳"],
		["9fae", "酙隁酜"],
		["9fb2", "酑𨺗捿𦴣櫊嘑醎畺抅𠏼獏籰𥰡𣳽"],
		["9fc1", "𤤙盖鮝个𠳔莾衂"],
		["9fc9", "届槀僭坺刟巵从氱𠇲伹咜哚劚趂㗾弌㗳"],
		["9fdb", "歒酼龥鮗頮颴骺麨麄煺笔"],
		["9fe7", "毺蠘罸"],
		["9feb", "嘠𪙊蹷齓"],
		["9ff0", "跔蹏鸜踁抂𨍽踨蹵竓𤩷稾磘泪詧瘇"],
		["a040", "𨩚鼦泎蟖痃𪊲硓咢贌狢獱謭猂瓱賫𤪻蘯徺袠䒷"],
		["a055", "𡠻𦸅"],
		["a058", "詾𢔛"],
		["a05b", "惽癧髗鵄鍮鮏蟵"],
		["a063", "蠏賷猬霡鮰㗖犲䰇籑饊𦅙慙䰄麖慽"],
		["a073", "坟慯抦戹拎㩜懢厪𣏵捤栂㗒"],
		["a0a1", "嵗𨯂迚𨸹"],
		["a0a6", "僙𡵆礆匲阸𠼻䁥"],
		["a0ae", "矾"],
		["a0b0", "糂𥼚糚稭聦聣絍甅瓲覔舚朌聢𧒆聛瓰脃眤覉𦟌畓𦻑螩蟎臈螌詉貭譃眫瓸蓚㘵榲趦"],
		["a0d4", "覩瑨涹蟁𤀑瓧㷛煶悤憜㳑煢恷"],
		["a0e2", "罱𨬭牐惩䭾删㰘𣳇𥻗𧙖𥔱𡥄𡋾𩤃𦷜𧂭峁𦆭𨨏𣙷𠃮𦡆𤼎䕢嬟𦍌齐麦𦉫"],
		[
			"a3c0",
			"␀",
			31,
			"␡"
		],
		[
			"c6a1",
			"①",
			9,
			"⑴",
			9,
			"ⅰ",
			9,
			"丶丿亅亠冂冖冫勹匸卩厶夊宀巛⼳广廴彐彡攴无疒癶辵隶¨ˆヽヾゝゞ〃仝々〆〇ー［］✽ぁ",
			23
		],
		[
			"c740",
			"す",
			58,
			"ァアィイ"
		],
		[
			"c7a1",
			"ゥ",
			81,
			"А",
			5,
			"ЁЖ",
			4
		],
		[
			"c840",
			"Л",
			26,
			"ёж",
			25,
			"⇧↸↹㇏𠃌乚𠂊刂䒑"
		],
		["c8a1", "龰冈龱𧘇"],
		["c8cd", "￢￤＇＂㈱№℡゛゜⺀⺄⺆⺇⺈⺊⺌⺍⺕⺜⺝⺥⺧⺪⺬⺮⺶⺼⺾⻆⻊⻌⻍⻏⻖⻗⻞⻣"],
		["c8f5", "ʃɐɛɔɵœøŋʊɪ"],
		["f9fe", "￭"],
		["fa40", "𠕇鋛𠗟𣿅蕌䊵珯况㙉𤥂𨧤鍄𡧛苮𣳈砼杄拟𤤳𨦪𠊠𦮳𡌅侫𢓭倈𦴩𧪄𣘀𤪱𢔓倩𠍾徤𠎀𠍇滛𠐟偽儁㑺儎顬㝃萖𤦤𠒇兠𣎴兪𠯿𢃼𠋥𢔰𠖎𣈳𡦃宂蝽𠖳𣲙冲冸"],
		["faa1", "鴴凉减凑㳜凓𤪦决凢卂凭菍椾𣜭彻刋刦刼劵剗劔効勅簕蕂勠蘍𦬓包𨫞啉滙𣾀𠥔𣿬匳卄𠯢泋𡜦栛珕恊㺪㣌𡛨燝䒢卭却𨚫卾卿𡖖𡘓矦厓𨪛厠厫厮玧𥝲㽙玜叁叅汉义埾叙㪫𠮏叠𣿫𢶣叶𠱷吓灹唫晗浛呭𦭓𠵴啝咏咤䞦𡜍𠻝㶴𠵍"],
		["fb40", "𨦼𢚘啇䳭启琗喆喩嘅𡣗𤀺䕒𤐵暳𡂴嘷曍𣊊暤暭噍噏磱囱鞇叾圀囯园𨭦㘣𡉏坆𤆥汮炋坂㚱𦱾埦𡐖堃𡑔𤍣堦𤯵塜墪㕡壠壜𡈼壻寿坃𪅐𤉸鏓㖡够梦㛃湙"],
		["fba1", "𡘾娤啓𡚒蔅姉𠵎𦲁𦴪𡟜姙𡟻𡞲𦶦浱𡠨𡛕姹𦹅媫婣㛦𤦩婷㜈媖瑥嫓𦾡𢕔㶅𡤑㜲𡚸広勐孶斈孼𧨎䀄䡝𠈄寕慠𡨴𥧌𠖥寳宝䴐尅𡭄尓珎尔𡲥𦬨屉䣝岅峩峯嶋𡷹𡸷崐崘嵆𡺤岺巗苼㠭𤤁𢁉𢅳芇㠶㯂帮檊幵幺𤒼𠳓厦亷廐厨𡝱帉廴𨒂"],
		["fc40", "廹廻㢠廼栾鐛弍𠇁弢㫞䢮𡌺强𦢈𢏐彘𢑱彣鞽𦹮彲鍀𨨶徧嶶㵟𥉐𡽪𧃸𢙨釖𠊞𨨩怱暅𡡷㥣㷇㘹垐𢞴祱㹀悞悤悳𤦂𤦏𧩓璤僡媠慤萤慂慈𦻒憁凴𠙖憇宪𣾷"],
		["fca1", "𢡟懓𨮝𩥝懐㤲𢦀𢣁怣慜攞掋𠄘担𡝰拕𢸍捬𤧟㨗搸揸𡎎𡟼撐澊𢸶頔𤂌𥜝擡擥鑻㩦携㩗敍漖𤨨𤨣斅敭敟𣁾斵𤥀䬷旑䃘𡠩无旣忟𣐀昘𣇷𣇸晄𣆤𣆥晋𠹵晧𥇦晳晴𡸽𣈱𨗴𣇈𥌓矅𢣷馤朂𤎜𤨡㬫槺𣟂杞杧杢𤇍𩃭柗䓩栢湐鈼栁𣏦𦶠桝"],
		["fd40", "𣑯槡樋𨫟楳棃𣗍椁椀㴲㨁𣘼㮀枬楡𨩊䋼椶榘㮡𠏉荣傐槹𣙙𢄪橅𣜃檝㯳枱櫈𩆜㰍欝𠤣惞欵歴𢟍溵𣫛𠎵𡥘㝀吡𣭚毡𣻼毜氷𢒋𤣱𦭑汚舦汹𣶼䓅𣶽𤆤𤤌𤤀"],
		["fda1", "𣳉㛥㳫𠴲鮃𣇹𢒑羏样𦴥𦶡𦷫涖浜湼漄𤥿𤂅𦹲蔳𦽴凇沜渝萮𨬡港𣸯瑓𣾂秌湏媑𣁋濸㜍澝𣸰滺𡒗𤀽䕕鏰潄潜㵎潴𩅰㴻澟𤅄濓𤂑𤅕𤀹𣿰𣾴𤄿凟𤅖𤅗𤅀𦇝灋灾炧炁烌烕烖烟䄄㷨熴熖𤉷焫煅媈煊煮岜𤍥煏鍢𤋁焬𤑚𤨧𤨢熺𨯨炽爎"],
		["fe40", "鑂爕夑鑃爤鍁𥘅爮牀𤥴梽牕牗㹕𣁄栍漽犂猪猫𤠣𨠫䣭𨠄猨献珏玪𠰺𦨮珉瑉𤇢𡛧𤨤昣㛅𤦷𤦍𤧻珷琕椃𤨦琹𠗃㻗瑜𢢭瑠𨺲瑇珤瑶莹瑬㜰瑴鏱樬璂䥓𤪌"],
		["fea1", "𤅟𤩹𨮏孆𨰃𡢞瓈𡦈甎瓩甞𨻙𡩋寗𨺬鎅畍畊畧畮𤾂㼄𤴓疎瑝疞疴瘂瘬癑癏癯癶𦏵皐臯㟸𦤑𦤎皡皥皷盌𦾟葢𥂝𥅽𡸜眞眦着撯𥈠睘𣊬瞯𨥤𨥨𡛁矴砉𡍶𤨒棊碯磇磓隥礮𥗠磗礴碱𧘌辸袄𨬫𦂃𢘜禆褀椂禀𥡗禝𧬹礼禩渪𧄦㺨秆𩄍秔"]
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/dbcs-data.js
var require_dbcs_data = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/dbcs-data.js": ((exports, module) => {
	module.exports = {
		shiftjis: {
			type: "_dbcs",
			table: function() {
				return require_shiftjis();
			},
			encodeAdd: {
				"¥": 92,
				"‾": 126
			},
			encodeSkipVals: [{
				from: 60736,
				to: 63808
			}]
		},
		csshiftjis: "shiftjis",
		mskanji: "shiftjis",
		sjis: "shiftjis",
		windows31j: "shiftjis",
		ms31j: "shiftjis",
		xsjis: "shiftjis",
		windows932: "shiftjis",
		ms932: "shiftjis",
		932: "shiftjis",
		cp932: "shiftjis",
		eucjp: {
			type: "_dbcs",
			table: function() {
				return require_eucjp();
			},
			encodeAdd: {
				"¥": 92,
				"‾": 126
			}
		},
		gb2312: "cp936",
		gb231280: "cp936",
		gb23121980: "cp936",
		csgb2312: "cp936",
		csiso58gb231280: "cp936",
		euccn: "cp936",
		windows936: "cp936",
		ms936: "cp936",
		936: "cp936",
		cp936: {
			type: "_dbcs",
			table: function() {
				return require_cp936();
			}
		},
		gbk: {
			type: "_dbcs",
			table: function() {
				return require_cp936().concat(require_gbk_added());
			}
		},
		xgbk: "gbk",
		isoir58: "gbk",
		gb18030: {
			type: "_dbcs",
			table: function() {
				return require_cp936().concat(require_gbk_added());
			},
			gb18030: function() {
				return require_gb18030_ranges();
			},
			encodeSkipVals: [128],
			encodeAdd: { "€": 41699 }
		},
		chinese: "gb18030",
		windows949: "cp949",
		ms949: "cp949",
		949: "cp949",
		cp949: {
			type: "_dbcs",
			table: function() {
				return require_cp949();
			}
		},
		cseuckr: "cp949",
		csksc56011987: "cp949",
		euckr: "cp949",
		isoir149: "cp949",
		korean: "cp949",
		ksc56011987: "cp949",
		ksc56011989: "cp949",
		ksc5601: "cp949",
		windows950: "cp950",
		ms950: "cp950",
		950: "cp950",
		cp950: {
			type: "_dbcs",
			table: function() {
				return require_cp950();
			}
		},
		big5: "big5hkscs",
		big5hkscs: {
			type: "_dbcs",
			table: function() {
				return require_cp950().concat(require_big5_added());
			},
			encodeSkipVals: [
				36457,
				36463,
				36478,
				36523,
				36532,
				36557,
				36560,
				36695,
				36713,
				36718,
				36811,
				36862,
				36973,
				36986,
				37060,
				37084,
				37105,
				37311,
				37551,
				37552,
				37553,
				37554,
				37585,
				37959,
				38090,
				38361,
				38652,
				39285,
				39798,
				39800,
				39803,
				39878,
				39902,
				39916,
				39926,
				40002,
				40019,
				40034,
				40040,
				40043,
				40055,
				40124,
				40125,
				40144,
				40279,
				40282,
				40388,
				40431,
				40443,
				40617,
				40687,
				40701,
				40800,
				40907,
				41079,
				41180,
				41183,
				36812,
				37576,
				38468,
				38637,
				41636,
				41637,
				41639,
				41638,
				41676,
				41678
			]
		},
		cnbig5: "big5hkscs",
		csbig5: "big5hkscs",
		xxbig5: "big5hkscs"
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/index.js
var require_encodings = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/encodings/index.js": ((exports) => {
	var mergeModules$1 = require_merge_exports();
	var modules = [
		require_internal(),
		require_utf32(),
		require_utf16(),
		require_utf7(),
		require_sbcs_codec(),
		require_sbcs_data(),
		require_sbcs_data_generated(),
		require_dbcs_codec(),
		require_dbcs_data()
	];
	for (var i$1 = 0; i$1 < modules.length; i$1++) {
		var module$1 = modules[i$1];
		mergeModules$1(exports, module$1);
	}
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/streams.js
var require_streams = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/streams.js": ((exports, module) => {
	var Buffer$2 = require_safer().Buffer;
	module.exports = function(streamModule$1) {
		var Transform = streamModule$1.Transform;
		function IconvLiteEncoderStream(conv, options) {
			this.conv = conv;
			options = options || {};
			options.decodeStrings = false;
			Transform.call(this, options);
		}
		IconvLiteEncoderStream.prototype = Object.create(Transform.prototype, { constructor: { value: IconvLiteEncoderStream } });
		IconvLiteEncoderStream.prototype._transform = function(chunk, encoding, done) {
			if (typeof chunk !== "string") return done(/* @__PURE__ */ new Error("Iconv encoding stream needs strings as its input."));
			try {
				var res = this.conv.write(chunk);
				if (res && res.length) this.push(res);
				done();
			} catch (e) {
				done(e);
			}
		};
		IconvLiteEncoderStream.prototype._flush = function(done) {
			try {
				var res = this.conv.end();
				if (res && res.length) this.push(res);
				done();
			} catch (e) {
				done(e);
			}
		};
		IconvLiteEncoderStream.prototype.collect = function(cb) {
			var chunks = [];
			this.on("error", cb);
			this.on("data", function(chunk) {
				chunks.push(chunk);
			});
			this.on("end", function() {
				cb(null, Buffer$2.concat(chunks));
			});
			return this;
		};
		function IconvLiteDecoderStream(conv, options) {
			this.conv = conv;
			options = options || {};
			options.encoding = this.encoding = "utf8";
			Transform.call(this, options);
		}
		IconvLiteDecoderStream.prototype = Object.create(Transform.prototype, { constructor: { value: IconvLiteDecoderStream } });
		IconvLiteDecoderStream.prototype._transform = function(chunk, encoding, done) {
			if (!Buffer$2.isBuffer(chunk) && !(chunk instanceof Uint8Array)) return done(/* @__PURE__ */ new Error("Iconv decoding stream needs buffers as its input."));
			try {
				var res = this.conv.write(chunk);
				if (res && res.length) this.push(res, this.encoding);
				done();
			} catch (e) {
				done(e);
			}
		};
		IconvLiteDecoderStream.prototype._flush = function(done) {
			try {
				var res = this.conv.end();
				if (res && res.length) this.push(res, this.encoding);
				done();
			} catch (e) {
				done(e);
			}
		};
		IconvLiteDecoderStream.prototype.collect = function(cb) {
			var res = "";
			this.on("error", cb);
			this.on("data", function(chunk) {
				res += chunk;
			});
			this.on("end", function() {
				cb(null, res);
			});
			return this;
		};
		return {
			IconvLiteEncoderStream,
			IconvLiteDecoderStream
		};
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/index.js
var require_lib$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/iconv-lite@0.7.0/node_modules/iconv-lite/lib/index.js": ((exports, module) => {
	var Buffer$1 = require_safer().Buffer;
	var bomHandling = require_bom_handling();
	var mergeModules = require_merge_exports();
	var iconv = module.exports;
	iconv.encodings = null;
	iconv.defaultCharUnicode = "�";
	iconv.defaultCharSingleByte = "?";
	iconv.encode = function encode(str, encoding, options) {
		str = "" + (str || "");
		var encoder = iconv.getEncoder(encoding, options);
		var res = encoder.write(str);
		var trail = encoder.end();
		return trail && trail.length > 0 ? Buffer$1.concat([res, trail]) : res;
	};
	iconv.decode = function decode(buf, encoding, options) {
		if (typeof buf === "string") {
			if (!iconv.skipDecodeWarning) {
				console.error("Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding");
				iconv.skipDecodeWarning = true;
			}
			buf = Buffer$1.from("" + (buf || ""), "binary");
		}
		var decoder = iconv.getDecoder(encoding, options);
		var res = decoder.write(buf);
		var trail = decoder.end();
		return trail ? res + trail : res;
	};
	iconv.encodingExists = function encodingExists(enc) {
		try {
			iconv.getCodec(enc);
			return true;
		} catch (e) {
			return false;
		}
	};
	iconv.toEncoding = iconv.encode;
	iconv.fromEncoding = iconv.decode;
	iconv._codecDataCache = { __proto__: null };
	iconv.getCodec = function getCodec(encoding) {
		if (!iconv.encodings) {
			var raw = require_encodings();
			iconv.encodings = { __proto__: null };
			mergeModules(iconv.encodings, raw);
		}
		var enc = iconv._canonicalizeEncoding(encoding);
		var codecOptions = {};
		while (true) {
			var codec = iconv._codecDataCache[enc];
			if (codec) return codec;
			var codecDef = iconv.encodings[enc];
			switch (typeof codecDef) {
				case "string":
					enc = codecDef;
					break;
				case "object":
					for (var key$1 in codecDef) codecOptions[key$1] = codecDef[key$1];
					if (!codecOptions.encodingName) codecOptions.encodingName = enc;
					enc = codecDef.type;
					break;
				case "function":
					if (!codecOptions.encodingName) codecOptions.encodingName = enc;
					codec = new codecDef(codecOptions, iconv);
					iconv._codecDataCache[codecOptions.encodingName] = codec;
					return codec;
				default: throw new Error("Encoding not recognized: '" + encoding + "' (searched as: '" + enc + "')");
			}
		}
	};
	iconv._canonicalizeEncoding = function(encoding) {
		return ("" + encoding).toLowerCase().replace(/:\d{4}$|[^0-9a-z]/g, "");
	};
	iconv.getEncoder = function getEncoder(encoding, options) {
		var codec = iconv.getCodec(encoding);
		var encoder = new codec.encoder(options, codec);
		if (codec.bomAware && options && options.addBOM) encoder = new bomHandling.PrependBOM(encoder, options);
		return encoder;
	};
	iconv.getDecoder = function getDecoder(encoding, options) {
		var codec = iconv.getCodec(encoding);
		var decoder = new codec.decoder(options, codec);
		if (codec.bomAware && !(options && options.stripBOM === false)) decoder = new bomHandling.StripBOM(decoder, options);
		return decoder;
	};
	iconv.enableStreamingAPI = function enableStreamingAPI(streamModule$1) {
		if (iconv.supportsStreams) return;
		var streams = require_streams()(streamModule$1);
		iconv.IconvLiteEncoderStream = streams.IconvLiteEncoderStream;
		iconv.IconvLiteDecoderStream = streams.IconvLiteDecoderStream;
		iconv.encodeStream = function encodeStream(encoding, options) {
			return new iconv.IconvLiteEncoderStream(iconv.getEncoder(encoding, options), options);
		};
		iconv.decodeStream = function decodeStream(encoding, options) {
			return new iconv.IconvLiteDecoderStream(iconv.getDecoder(encoding, options), options);
		};
		iconv.supportsStreams = true;
	};
	var streamModule;
	try {
		streamModule = __require("stream");
	} catch (e) {}
	if (streamModule && streamModule.Transform) iconv.enableStreamingAPI(streamModule);
	else iconv.encodeStream = iconv.decodeStream = function() {
		throw new Error("iconv-lite Streaming API is not enabled. Use iconv.enableStreamingAPI(require('stream')); to enable it.");
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/string.js
var require_string = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/string.js": ((exports) => {
	const Iconv = require_lib$1();
	const { createLRU: createLRU$1 } = require_lib$2();
	const decoderCache = createLRU$1({ max: 500 });
	exports.decode = function(buffer$1, encoding, start, end, options) {
		if (Buffer.isEncoding(encoding)) return buffer$1.toString(encoding, start, end);
		let decoder;
		if (!options) {
			decoder = decoderCache.get(encoding);
			if (!decoder) {
				decoder = Iconv.getDecoder(encoding);
				decoderCache.set(encoding, decoder);
			}
		} else {
			const decoderArgs = {
				encoding,
				options
			};
			const decoderKey = JSON.stringify(decoderArgs);
			decoder = decoderCache.get(decoderKey);
			if (!decoder) {
				decoder = Iconv.getDecoder(decoderArgs.encoding, decoderArgs.options);
				decoderCache.set(decoderKey, decoder);
			}
		}
		const res = decoder.write(buffer$1.slice(start, end));
		const trail = decoder.end();
		return trail ? res + trail : res;
	};
	exports.encode = function(string, encoding, options) {
		if (Buffer.isEncoding(encoding)) return Buffer.from(string, encoding);
		const encoder = Iconv.getEncoder(encoding, options || {});
		const res = encoder.write(string);
		const trail = encoder.end();
		return trail && trail.length > 0 ? Buffer.concat([res, trail]) : res;
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/types.js
var require_types = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/types.js": ((exports, module) => {
	module.exports = {
		0: "DECIMAL",
		1: "TINY",
		2: "SHORT",
		3: "LONG",
		4: "FLOAT",
		5: "DOUBLE",
		6: "NULL",
		7: "TIMESTAMP",
		8: "LONGLONG",
		9: "INT24",
		10: "DATE",
		11: "TIME",
		12: "DATETIME",
		13: "YEAR",
		14: "NEWDATE",
		15: "VARCHAR",
		16: "BIT",
		245: "JSON",
		246: "NEWDECIMAL",
		247: "ENUM",
		248: "SET",
		249: "TINY_BLOB",
		250: "MEDIUM_BLOB",
		251: "LONG_BLOB",
		252: "BLOB",
		253: "VAR_STRING",
		254: "STRING",
		255: "GEOMETRY"
	};
	module.exports.DECIMAL = 0;
	module.exports.TINY = 1;
	module.exports.SHORT = 2;
	module.exports.LONG = 3;
	module.exports.FLOAT = 4;
	module.exports.DOUBLE = 5;
	module.exports.NULL = 6;
	module.exports.TIMESTAMP = 7;
	module.exports.LONGLONG = 8;
	module.exports.INT24 = 9;
	module.exports.DATE = 10;
	module.exports.TIME = 11;
	module.exports.DATETIME = 12;
	module.exports.YEAR = 13;
	module.exports.NEWDATE = 14;
	module.exports.VARCHAR = 15;
	module.exports.BIT = 16;
	module.exports.VECTOR = 242;
	module.exports.JSON = 245;
	module.exports.NEWDECIMAL = 246;
	module.exports.ENUM = 247;
	module.exports.SET = 248;
	module.exports.TINY_BLOB = 249;
	module.exports.MEDIUM_BLOB = 250;
	module.exports.LONG_BLOB = 251;
	module.exports.BLOB = 252;
	module.exports.VAR_STRING = 253;
	module.exports.STRING = 254;
	module.exports.GEOMETRY = 255;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/packet.js
var require_packet = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/packet.js": ((exports, module) => {
	const ErrorCodeToName = require_errors();
	const NativeBuffer = __require("buffer").Buffer;
	const Long = require_umd();
	const StringParser$3 = require_string();
	const Types$6 = require_types();
	const INVALID_DATE = /* @__PURE__ */ new Date(NaN);
	const pad = "000000000000";
	function leftPad(num, value) {
		const s = value.toString();
		if (s.length >= num) return s;
		return (pad + s).slice(-num);
	}
	const minus = "-".charCodeAt(0);
	const plus = "+".charCodeAt(0);
	const dot = ".".charCodeAt(0);
	const exponent = "e".charCodeAt(0);
	const exponentCapital = "E".charCodeAt(0);
	var Packet$22 = class Packet$22 {
		constructor(id, buffer$1, start, end) {
			this.sequenceId = id;
			this.numPackets = 1;
			this.buffer = buffer$1;
			this.start = start;
			this.offset = start + 4;
			this.end = end;
		}
		reset() {
			this.offset = this.start + 4;
		}
		length() {
			return this.end - this.start;
		}
		slice() {
			return this.buffer.slice(this.start, this.end);
		}
		dump() {
			console.log([this.buffer.asciiSlice(this.start, this.end)], this.buffer.slice(this.start, this.end), this.length(), this.sequenceId);
		}
		haveMoreData() {
			return this.end > this.offset;
		}
		skip(num) {
			this.offset += num;
		}
		readInt8() {
			return this.buffer[this.offset++];
		}
		readInt16() {
			this.offset += 2;
			return this.buffer.readUInt16LE(this.offset - 2);
		}
		readInt24() {
			return this.readInt16() + (this.readInt8() << 16);
		}
		readInt32() {
			this.offset += 4;
			return this.buffer.readUInt32LE(this.offset - 4);
		}
		readSInt8() {
			return this.buffer.readInt8(this.offset++);
		}
		readSInt16() {
			this.offset += 2;
			return this.buffer.readInt16LE(this.offset - 2);
		}
		readSInt32() {
			this.offset += 4;
			return this.buffer.readInt32LE(this.offset - 4);
		}
		readInt64JSNumber() {
			return new Long(this.readInt32(), this.readInt32(), true).toNumber();
		}
		readSInt64JSNumber() {
			const word0 = this.readInt32();
			const word1 = this.readInt32();
			if (!(word1 & 2147483648)) return word0 + 4294967296 * word1;
			return new Long(word0, word1, false).toNumber();
		}
		readInt64String() {
			return new Long(this.readInt32(), this.readInt32(), true).toString();
		}
		readSInt64String() {
			return new Long(this.readInt32(), this.readInt32(), false).toString();
		}
		readInt64() {
			let res = new Long(this.readInt32(), this.readInt32(), true);
			const resNumber = res.toNumber();
			const resString = res.toString();
			res = resNumber.toString() === resString ? resNumber : resString;
			return res;
		}
		readSInt64() {
			let res = new Long(this.readInt32(), this.readInt32(), false);
			const resNumber = res.toNumber();
			const resString = res.toString();
			res = resNumber.toString() === resString ? resNumber : resString;
			return res;
		}
		isEOF() {
			return this.buffer[this.offset] === 254 && this.length() < 13;
		}
		eofStatusFlags() {
			return this.buffer.readInt16LE(this.offset + 3);
		}
		eofWarningCount() {
			return this.buffer.readInt16LE(this.offset + 1);
		}
		readLengthCodedNumber(bigNumberStrings, signed) {
			const byte1 = this.buffer[this.offset++];
			if (byte1 < 251) return byte1;
			return this.readLengthCodedNumberExt(byte1, bigNumberStrings, signed);
		}
		readLengthCodedNumberSigned(bigNumberStrings) {
			return this.readLengthCodedNumber(bigNumberStrings, true);
		}
		readLengthCodedNumberExt(tag, bigNumberStrings, signed) {
			let word0, word1;
			let res;
			if (tag === 251) return null;
			if (tag === 252) return this.readInt8() + (this.readInt8() << 8);
			if (tag === 253) return this.readInt8() + (this.readInt8() << 8) + (this.readInt8() << 16);
			if (tag === 254) {
				word0 = this.readInt32();
				word1 = this.readInt32();
				if (word1 === 0) return word0;
				if (word1 < 2097152) return word1 * 4294967296 + word0;
				res = new Long(word0, word1, !signed);
				const resNumber = res.toNumber();
				const resString = res.toString();
				res = resNumber.toString() === resString ? resNumber : resString;
				return bigNumberStrings ? resString : res;
			}
			console.trace();
			throw new Error(`Should not reach here: ${tag}`);
		}
		readFloat() {
			const res = this.buffer.readFloatLE(this.offset);
			this.offset += 4;
			return res;
		}
		readDouble() {
			const res = this.buffer.readDoubleLE(this.offset);
			this.offset += 8;
			return res;
		}
		readBuffer(len) {
			if (typeof len === "undefined") len = this.end - this.offset;
			this.offset += len;
			return this.buffer.slice(this.offset - len, this.offset);
		}
		readDateTime(timezone) {
			if (!timezone || timezone === "Z" || timezone === "local") {
				const length = this.readInt8();
				if (length === 251) return null;
				let y = 0;
				let m = 0;
				let d = 0;
				let H = 0;
				let M = 0;
				let S = 0;
				let ms = 0;
				if (length > 3) {
					y = this.readInt16();
					m = this.readInt8();
					d = this.readInt8();
				}
				if (length > 6) {
					H = this.readInt8();
					M = this.readInt8();
					S = this.readInt8();
				}
				if (length > 10) ms = this.readInt32() / 1e3;
				if (y + m + d + H + M + S + ms === 0) return INVALID_DATE;
				if (timezone === "Z") return new Date(Date.UTC(y, m - 1, d, H, M, S, ms));
				return new Date(y, m - 1, d, H, M, S, ms);
			}
			let str = this.readDateTimeString(6, "T", null);
			if (str.length === 10) str += "T00:00:00";
			return new Date(str + timezone);
		}
		readDateTimeString(decimals, timeSep, columnType) {
			const length = this.readInt8();
			let y = 0;
			let m = 0;
			let d = 0;
			let H = 0;
			let M = 0;
			let S = 0;
			let ms = 0;
			let str;
			if (length > 3) {
				y = this.readInt16();
				m = this.readInt8();
				d = this.readInt8();
				str = [
					leftPad(4, y),
					leftPad(2, m),
					leftPad(2, d)
				].join("-");
			}
			if (length > 6) {
				H = this.readInt8();
				M = this.readInt8();
				S = this.readInt8();
				str += `${timeSep || " "}${[
					leftPad(2, H),
					leftPad(2, M),
					leftPad(2, S)
				].join(":")}`;
			} else if (columnType === Types$6.DATETIME) str += " 00:00:00";
			if (length > 10) {
				ms = this.readInt32();
				str += ".";
				if (decimals) {
					ms = leftPad(6, ms);
					if (ms.length > decimals) ms = ms.substring(0, decimals);
				}
				str += ms;
			}
			return str;
		}
		readTimeString(convertTtoMs) {
			const length = this.readInt8();
			if (length === 0) return "00:00:00";
			const sign = this.readInt8() ? -1 : 1;
			let d = 0;
			let H = 0;
			let M = 0;
			let S = 0;
			let ms = 0;
			if (length > 6) {
				d = this.readInt32();
				H = this.readInt8();
				M = this.readInt8();
				S = this.readInt8();
			}
			if (length > 10) ms = this.readInt32();
			if (convertTtoMs) {
				H += d * 24;
				M += H * 60;
				S += M * 60;
				ms += S * 1e3;
				ms *= sign;
				return ms;
			}
			return (sign === -1 ? "-" : "") + [
				leftPad(2, d * 24 + H),
				leftPad(2, M),
				leftPad(2, S)
			].join(":") + (ms ? `.${ms}`.replace(/0+$/, "") : "");
		}
		readLengthCodedString(encoding) {
			const len = this.readLengthCodedNumber();
			if (len === null) return null;
			this.offset += len;
			return StringParser$3.decode(this.buffer, encoding, this.offset - len, this.offset);
		}
		readLengthCodedBuffer() {
			const len = this.readLengthCodedNumber();
			if (len === null) return null;
			return this.readBuffer(len);
		}
		readNullTerminatedString(encoding) {
			const start = this.offset;
			let end = this.offset;
			while (this.buffer[end]) end = end + 1;
			this.offset = end + 1;
			return StringParser$3.decode(this.buffer, encoding, start, end);
		}
		readString(len, encoding) {
			if (typeof len === "string" && typeof encoding === "undefined") {
				encoding = len;
				len = void 0;
			}
			if (typeof len === "undefined") len = this.end - this.offset;
			this.offset += len;
			return StringParser$3.decode(this.buffer, encoding, this.offset - len, this.offset);
		}
		parseInt(len, supportBigNumbers) {
			if (len === null) return null;
			if (len >= 14 && !supportBigNumbers) {
				const s = this.buffer.toString("ascii", this.offset, this.offset + len);
				this.offset += len;
				return Number(s);
			}
			let result = 0;
			const start = this.offset;
			const end = this.offset + len;
			let sign = 1;
			if (len === 0) return 0;
			if (this.buffer[this.offset] === minus) {
				this.offset++;
				sign = -1;
			}
			let str;
			const numDigits = end - this.offset;
			if (supportBigNumbers) {
				if (numDigits >= 15) {
					str = this.readString(end - this.offset, "binary");
					result = parseInt(str, 10);
					if (result.toString() === str) return sign * result;
					return sign === -1 ? `-${str}` : str;
				}
				if (numDigits > 16) {
					str = this.readString(end - this.offset);
					return sign === -1 ? `-${str}` : str;
				}
			}
			if (this.buffer[this.offset] === plus) this.offset++;
			while (this.offset < end) {
				result *= 10;
				result += this.buffer[this.offset] - 48;
				this.offset++;
			}
			const num = result * sign;
			if (!supportBigNumbers) return num;
			str = this.buffer.toString("ascii", start, end);
			if (num.toString() === str) return num;
			return str;
		}
		parseIntNoBigCheck(len) {
			if (len === null) return null;
			let result = 0;
			const end = this.offset + len;
			let sign = 1;
			if (len === 0) return 0;
			if (this.buffer[this.offset] === minus) {
				this.offset++;
				sign = -1;
			}
			if (this.buffer[this.offset] === plus) this.offset++;
			while (this.offset < end) {
				result *= 10;
				result += this.buffer[this.offset] - 48;
				this.offset++;
			}
			return result * sign;
		}
		parseGeometryValue() {
			const buffer$1 = this.readLengthCodedBuffer();
			let offset = 4;
			if (buffer$1 === null || !buffer$1.length) return null;
			function parseGeometry() {
				let x, y, i$4, j, numPoints, line;
				let result = null;
				const byteOrder = buffer$1.readUInt8(offset);
				offset += 1;
				const wkbType = byteOrder ? buffer$1.readUInt32LE(offset) : buffer$1.readUInt32BE(offset);
				offset += 4;
				switch (wkbType) {
					case 1:
						x = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
						offset += 8;
						y = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
						offset += 8;
						result = {
							x,
							y
						};
						break;
					case 2:
						numPoints = byteOrder ? buffer$1.readUInt32LE(offset) : buffer$1.readUInt32BE(offset);
						offset += 4;
						result = [];
						for (i$4 = numPoints; i$4 > 0; i$4--) {
							x = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
							offset += 8;
							y = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
							offset += 8;
							result.push({
								x,
								y
							});
						}
						break;
					case 3:
						const numRings = byteOrder ? buffer$1.readUInt32LE(offset) : buffer$1.readUInt32BE(offset);
						offset += 4;
						result = [];
						for (i$4 = numRings; i$4 > 0; i$4--) {
							numPoints = byteOrder ? buffer$1.readUInt32LE(offset) : buffer$1.readUInt32BE(offset);
							offset += 4;
							line = [];
							for (j = numPoints; j > 0; j--) {
								x = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
								offset += 8;
								y = byteOrder ? buffer$1.readDoubleLE(offset) : buffer$1.readDoubleBE(offset);
								offset += 8;
								line.push({
									x,
									y
								});
							}
							result.push(line);
						}
						break;
					case 4:
					case 5:
					case 6:
					case 7:
						const num = byteOrder ? buffer$1.readUInt32LE(offset) : buffer$1.readUInt32BE(offset);
						offset += 4;
						result = [];
						for (i$4 = num; i$4 > 0; i$4--) result.push(parseGeometry());
						break;
				}
				return result;
			}
			return parseGeometry();
		}
		parseVector() {
			const bufLen = this.readLengthCodedNumber();
			const vectorEnd = this.offset + bufLen;
			const result = [];
			while (this.offset < vectorEnd && this.offset < this.end) result.push(this.readFloat());
			return result;
		}
		parseDate(timezone) {
			const strLen = this.readLengthCodedNumber();
			if (strLen === null) return null;
			if (strLen !== 10) return /* @__PURE__ */ new Date(NaN);
			const y = this.parseInt(4);
			this.offset++;
			const m = this.parseInt(2);
			this.offset++;
			const d = this.parseInt(2);
			if (!timezone || timezone === "local") return new Date(y, m - 1, d);
			if (timezone === "Z") return new Date(Date.UTC(y, m - 1, d));
			return /* @__PURE__ */ new Date(`${leftPad(4, y)}-${leftPad(2, m)}-${leftPad(2, d)}T00:00:00${timezone}`);
		}
		parseDateTime(timezone) {
			const str = this.readLengthCodedString("binary");
			if (str === null) return null;
			if (!timezone || timezone === "local") return new Date(str);
			return /* @__PURE__ */ new Date(`${str}${timezone}`);
		}
		parseFloat(len) {
			if (len === null) return null;
			let result = 0;
			const end = this.offset + len;
			let factor = 1;
			let pastDot = false;
			let charCode = 0;
			if (len === 0) return 0;
			if (this.buffer[this.offset] === minus) {
				this.offset++;
				factor = -1;
			}
			if (this.buffer[this.offset] === plus) this.offset++;
			while (this.offset < end) {
				charCode = this.buffer[this.offset];
				if (charCode === dot) {
					pastDot = true;
					this.offset++;
				} else if (charCode === exponent || charCode === exponentCapital) {
					this.offset++;
					const exponentValue = this.parseInt(end - this.offset);
					return result / factor * Math.pow(10, exponentValue);
				} else {
					result *= 10;
					result += this.buffer[this.offset] - 48;
					this.offset++;
					if (pastDot) factor = factor * 10;
				}
			}
			return result / factor;
		}
		parseLengthCodedIntNoBigCheck() {
			return this.parseIntNoBigCheck(this.readLengthCodedNumber());
		}
		parseLengthCodedInt(supportBigNumbers) {
			return this.parseInt(this.readLengthCodedNumber(), supportBigNumbers);
		}
		parseLengthCodedIntString() {
			return this.readLengthCodedString("binary");
		}
		parseLengthCodedFloat() {
			return this.parseFloat(this.readLengthCodedNumber());
		}
		peekByte() {
			return this.buffer[this.offset];
		}
		isAlt() {
			return this.peekByte() === 254;
		}
		isError() {
			return this.peekByte() === 255;
		}
		asError(encoding) {
			this.reset();
			this.readInt8();
			const errorCode = this.readInt16();
			let sqlState = "";
			if (this.buffer[this.offset] === 35) {
				this.skip(1);
				sqlState = this.readBuffer(5).toString();
			}
			const message = this.readString(void 0, encoding);
			const err = new Error(message);
			err.code = ErrorCodeToName[errorCode];
			err.errno = errorCode;
			err.sqlState = sqlState;
			err.sqlMessage = message;
			return err;
		}
		writeInt32(n) {
			this.buffer.writeUInt32LE(n, this.offset);
			this.offset += 4;
		}
		writeInt24(n) {
			this.writeInt8(n & 255);
			this.writeInt16(n >> 8);
		}
		writeInt16(n) {
			this.buffer.writeUInt16LE(n, this.offset);
			this.offset += 2;
		}
		writeInt8(n) {
			this.buffer.writeUInt8(n, this.offset);
			this.offset++;
		}
		writeDouble(n) {
			this.buffer.writeDoubleLE(n, this.offset);
			this.offset += 8;
		}
		writeBuffer(b) {
			b.copy(this.buffer, this.offset);
			this.offset += b.length;
		}
		writeNull() {
			this.buffer[this.offset] = 251;
			this.offset++;
		}
		writeNullTerminatedString(s, encoding) {
			const buf = StringParser$3.encode(s, encoding);
			this.buffer.length && buf.copy(this.buffer, this.offset);
			this.offset += buf.length;
			this.writeInt8(0);
		}
		writeString(s, encoding) {
			if (s === null) {
				this.writeInt8(251);
				return;
			}
			if (s.length === 0) return;
			const buf = StringParser$3.encode(s, encoding);
			this.buffer.length && buf.copy(this.buffer, this.offset);
			this.offset += buf.length;
		}
		writeLengthCodedString(s, encoding) {
			const buf = StringParser$3.encode(s, encoding);
			this.writeLengthCodedNumber(buf.length);
			this.buffer.length && buf.copy(this.buffer, this.offset);
			this.offset += buf.length;
		}
		writeLengthCodedBuffer(b) {
			this.writeLengthCodedNumber(b.length);
			b.copy(this.buffer, this.offset);
			this.offset += b.length;
		}
		writeLengthCodedNumber(n) {
			if (n < 251) return this.writeInt8(n);
			if (n < 65535) {
				this.writeInt8(252);
				return this.writeInt16(n);
			}
			if (n < 16777215) {
				this.writeInt8(253);
				return this.writeInt24(n);
			}
			if (n === null) return this.writeInt8(251);
			this.writeInt8(254);
			this.buffer.writeUInt32LE(n, this.offset);
			this.offset += 4;
			this.buffer.writeUInt32LE(n >> 32, this.offset);
			this.offset += 4;
			return this.offset;
		}
		writeDate(d, timezone) {
			this.buffer.writeUInt8(11, this.offset);
			if (!timezone || timezone === "local") {
				this.buffer.writeUInt16LE(d.getFullYear(), this.offset + 1);
				this.buffer.writeUInt8(d.getMonth() + 1, this.offset + 3);
				this.buffer.writeUInt8(d.getDate(), this.offset + 4);
				this.buffer.writeUInt8(d.getHours(), this.offset + 5);
				this.buffer.writeUInt8(d.getMinutes(), this.offset + 6);
				this.buffer.writeUInt8(d.getSeconds(), this.offset + 7);
				this.buffer.writeUInt32LE(d.getMilliseconds() * 1e3, this.offset + 8);
			} else {
				if (timezone !== "Z") {
					const offset = (timezone[0] === "-" ? -1 : 1) * (parseInt(timezone.substring(1, 3), 10) * 60 + parseInt(timezone.substring(4), 10));
					if (offset !== 0) d = new Date(d.getTime() + 6e4 * offset);
				}
				this.buffer.writeUInt16LE(d.getUTCFullYear(), this.offset + 1);
				this.buffer.writeUInt8(d.getUTCMonth() + 1, this.offset + 3);
				this.buffer.writeUInt8(d.getUTCDate(), this.offset + 4);
				this.buffer.writeUInt8(d.getUTCHours(), this.offset + 5);
				this.buffer.writeUInt8(d.getUTCMinutes(), this.offset + 6);
				this.buffer.writeUInt8(d.getUTCSeconds(), this.offset + 7);
				this.buffer.writeUInt32LE(d.getUTCMilliseconds() * 1e3, this.offset + 8);
			}
			this.offset += 12;
		}
		writeHeader(sequenceId) {
			const offset = this.offset;
			this.offset = 0;
			this.writeInt24(this.buffer.length - 4);
			this.writeInt8(sequenceId);
			this.offset = offset;
		}
		clone() {
			return new Packet$22(this.sequenceId, this.buffer, this.start, this.end);
		}
		type() {
			if (this.isEOF()) return "EOF";
			if (this.isError()) return "Error";
			if (this.buffer[this.offset] === 0) return "maybeOK";
			return "";
		}
		static lengthCodedNumberLength(n) {
			if (n < 251) return 1;
			if (n < 65535) return 3;
			if (n < 16777215) return 5;
			return 9;
		}
		static lengthCodedStringLength(str, encoding) {
			const slen = StringParser$3.encode(str, encoding).length;
			return Packet$22.lengthCodedNumberLength(slen) + slen;
		}
		static MockBuffer() {
			const noop = function() {};
			const res = Buffer.alloc(0);
			for (const op in NativeBuffer.prototype) if (typeof res[op] === "function") res[op] = noop;
			return res;
		}
	};
	module.exports = Packet$22;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packet_parser.js
var require_packet_parser = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packet_parser.js": ((exports, module) => {
	const Packet$21 = require_packet();
	const MAX_PACKET_LENGTH = 16777215;
	function readPacketLength(b, off) {
		const b0 = b[off];
		const b1 = b[off + 1];
		const b2 = b[off + 2];
		if (b1 + b2 === 0) return b0;
		return b0 + (b1 << 8) + (b2 << 16);
	}
	var PacketParser$2 = class PacketParser$2 {
		constructor(onPacket, packetHeaderLength) {
			if (typeof packetHeaderLength === "undefined") packetHeaderLength = 4;
			this.buffer = [];
			this.bufferLength = 0;
			this.packetHeaderLength = packetHeaderLength;
			this.headerLen = 0;
			this.length = 0;
			this.largePacketParts = [];
			this.firstPacketSequenceId = 0;
			this.onPacket = onPacket;
			this.execute = PacketParser$2.prototype.executeStart;
			this._flushLargePacket = packetHeaderLength === 7 ? this._flushLargePacket7 : this._flushLargePacket4;
		}
		_flushLargePacket4() {
			const numPackets = this.largePacketParts.length;
			this.largePacketParts.unshift(Buffer.from([
				0,
				0,
				0,
				0
			]));
			const body = Buffer.concat(this.largePacketParts);
			const packet = new Packet$21(this.firstPacketSequenceId, body, 0, body.length);
			this.largePacketParts.length = 0;
			packet.numPackets = numPackets;
			this.onPacket(packet);
		}
		_flushLargePacket7() {
			const numPackets = this.largePacketParts.length;
			this.largePacketParts.unshift(Buffer.from([
				0,
				0,
				0,
				0,
				0,
				0,
				0
			]));
			const body = Buffer.concat(this.largePacketParts);
			this.largePacketParts.length = 0;
			const packet = new Packet$21(this.firstPacketSequenceId, body, 0, body.length);
			packet.numPackets = numPackets;
			this.onPacket(packet);
		}
		executeStart(chunk) {
			let start = 0;
			const end = chunk.length;
			while (end - start >= 3) {
				this.length = readPacketLength(chunk, start);
				if (end - start >= this.length + this.packetHeaderLength) {
					const sequenceId = chunk[start + 3];
					if (this.length < MAX_PACKET_LENGTH && this.largePacketParts.length === 0) this.onPacket(new Packet$21(sequenceId, chunk, start, start + this.packetHeaderLength + this.length));
					else {
						if (this.largePacketParts.length === 0) this.firstPacketSequenceId = sequenceId;
						this.largePacketParts.push(chunk.slice(start + this.packetHeaderLength, start + this.packetHeaderLength + this.length));
						if (this.length < MAX_PACKET_LENGTH) this._flushLargePacket();
					}
					start += this.packetHeaderLength + this.length;
				} else {
					this.buffer = [chunk.slice(start + 3, end)];
					this.bufferLength = end - start - 3;
					this.execute = PacketParser$2.prototype.executePayload;
					return;
				}
			}
			if (end - start > 0) {
				this.headerLen = end - start;
				this.length = chunk[start];
				if (this.headerLen === 2) {
					this.length = chunk[start] + (chunk[start + 1] << 8);
					this.execute = PacketParser$2.prototype.executeHeader3;
				} else this.execute = PacketParser$2.prototype.executeHeader2;
			}
		}
		executePayload(chunk) {
			let start = 0;
			const end = chunk.length;
			const remainingPayload = this.length - this.bufferLength + this.packetHeaderLength - 3;
			if (end - start >= remainingPayload) {
				const payload = Buffer.allocUnsafe(this.length + this.packetHeaderLength);
				let offset = 3;
				for (let i$4 = 0; i$4 < this.buffer.length; ++i$4) {
					this.buffer[i$4].copy(payload, offset);
					offset += this.buffer[i$4].length;
				}
				chunk.copy(payload, offset, start, start + remainingPayload);
				const sequenceId = payload[3];
				if (this.length < MAX_PACKET_LENGTH && this.largePacketParts.length === 0) this.onPacket(new Packet$21(sequenceId, payload, 0, this.length + this.packetHeaderLength));
				else {
					if (this.largePacketParts.length === 0) this.firstPacketSequenceId = sequenceId;
					this.largePacketParts.push(payload.slice(this.packetHeaderLength, this.packetHeaderLength + this.length));
					if (this.length < MAX_PACKET_LENGTH) this._flushLargePacket();
				}
				this.buffer = [];
				this.bufferLength = 0;
				this.execute = PacketParser$2.prototype.executeStart;
				start += remainingPayload;
				if (end - start > 0) return this.execute(chunk.slice(start, end));
			} else {
				this.buffer.push(chunk);
				this.bufferLength += chunk.length;
			}
			return null;
		}
		executeHeader2(chunk) {
			this.length += chunk[0] << 8;
			if (chunk.length > 1) {
				this.length += chunk[1] << 16;
				this.execute = PacketParser$2.prototype.executePayload;
				return this.executePayload(chunk.slice(2));
			}
			this.execute = PacketParser$2.prototype.executeHeader3;
			return null;
		}
		executeHeader3(chunk) {
			this.length += chunk[0] << 16;
			this.execute = PacketParser$2.prototype.executePayload;
			return this.executePayload(chunk.slice(1));
		}
	};
	module.exports = PacketParser$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_next_factor.js
var require_auth_next_factor = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_next_factor.js": ((exports, module) => {
	const Packet$20 = require_packet();
	var AuthNextFactor = class AuthNextFactor {
		constructor(opts) {
			this.pluginName = opts.pluginName;
			this.pluginData = opts.pluginData;
		}
		toPacket(encoding) {
			const length = 6 + this.pluginName.length + this.pluginData.length;
			const packet = new Packet$20(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(2);
			packet.writeNullTerminatedString(this.pluginName, encoding);
			packet.writeBuffer(this.pluginData);
			return packet;
		}
		static fromPacket(packet, encoding) {
			packet.readInt8();
			return new AuthNextFactor({
				pluginName: packet.readNullTerminatedString(encoding),
				pluginData: packet.readBuffer()
			});
		}
	};
	module.exports = AuthNextFactor;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_request.js
var require_auth_switch_request = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_request.js": ((exports, module) => {
	const Packet$19 = require_packet();
	var AuthSwitchRequest = class AuthSwitchRequest {
		constructor(opts) {
			this.pluginName = opts.pluginName;
			this.pluginData = opts.pluginData;
		}
		toPacket() {
			const length = 6 + this.pluginName.length + this.pluginData.length;
			const packet = new Packet$19(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(254);
			packet.writeNullTerminatedString(this.pluginName, "cesu8");
			packet.writeBuffer(this.pluginData);
			return packet;
		}
		static fromPacket(packet) {
			packet.readInt8();
			return new AuthSwitchRequest({
				pluginName: packet.readNullTerminatedString("cesu8"),
				pluginData: packet.readBuffer()
			});
		}
	};
	module.exports = AuthSwitchRequest;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_request_more_data.js
var require_auth_switch_request_more_data = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_request_more_data.js": ((exports, module) => {
	const Packet$18 = require_packet();
	var AuthSwitchRequestMoreData = class AuthSwitchRequestMoreData {
		constructor(data) {
			this.data = data;
		}
		toPacket() {
			const length = 5 + this.data.length;
			const packet = new Packet$18(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(1);
			packet.writeBuffer(this.data);
			return packet;
		}
		static fromPacket(packet) {
			packet.readInt8();
			return new AuthSwitchRequestMoreData(packet.readBuffer());
		}
		static verifyMarker(packet) {
			return packet.peekByte() === 1;
		}
	};
	module.exports = AuthSwitchRequestMoreData;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_response.js
var require_auth_switch_response = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/auth_switch_response.js": ((exports, module) => {
	const Packet$17 = require_packet();
	var AuthSwitchResponse = class AuthSwitchResponse {
		constructor(data) {
			if (!Buffer.isBuffer(data)) data = Buffer.from(data);
			this.data = data;
		}
		toPacket() {
			const length = 4 + this.data.length;
			const packet = new Packet$17(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeBuffer(this.data);
			return packet;
		}
		static fromPacket(packet) {
			return new AuthSwitchResponse(packet.readBuffer());
		}
	};
	module.exports = AuthSwitchResponse;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binary_row.js
var require_binary_row = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binary_row.js": ((exports, module) => {
	const Types$5 = require_types();
	const Packet$16 = require_packet();
	const binaryReader = new Array(256);
	var BinaryRow = class BinaryRow {
		constructor(columns) {
			this.columns = columns || [];
		}
		static toPacket(columns, encoding) {
			const sequenceId = 0;
			let length = 0;
			columns.forEach((val) => {
				if (val === null || typeof val === "undefined") {
					++length;
					return;
				}
				length += Packet$16.lengthCodedStringLength(val.toString(10), encoding);
			});
			length = length + 2;
			const packet = new Packet$16(sequenceId, Buffer.allocUnsafe(length + 4), 0, length + 4);
			packet.offset = 4;
			packet.writeInt8(0);
			let bitmap = 0;
			let bitValue = 1;
			columns.forEach((parameter) => {
				if (parameter.type === Types$5.NULL) bitmap += bitValue;
				bitValue *= 2;
				if (bitValue === 256) {
					packet.writeInt8(bitmap);
					bitmap = 0;
					bitValue = 1;
				}
			});
			if (bitValue !== 1) packet.writeInt8(bitmap);
			columns.forEach((val) => {
				if (val === null) {
					packet.writeNull();
					return;
				}
				if (typeof val === "undefined") {
					packet.writeInt8(0);
					return;
				}
				packet.writeLengthCodedString(val.toString(10), encoding);
			});
			return packet;
		}
		static fromPacket(fields$1, packet) {
			const columns = new Array(fields$1.length);
			packet.readInt8();
			const nullBitmapLength = Math.floor((fields$1.length + 7 + 2) / 8);
			packet.skip(nullBitmapLength);
			for (let i$4 = 0; i$4 < columns.length; ++i$4) columns[i$4] = binaryReader[fields$1[i$4].columnType].apply(packet);
			return new BinaryRow(columns);
		}
	};
	binaryReader[Types$5.DECIMAL] = Packet$16.prototype.readLengthCodedString;
	binaryReader[1] = Packet$16.prototype.readInt8;
	binaryReader[2] = Packet$16.prototype.readInt16;
	binaryReader[3] = Packet$16.prototype.readInt32;
	binaryReader[4] = Packet$16.prototype.readFloat;
	binaryReader[5] = Packet$16.prototype.readDouble;
	binaryReader[6] = Packet$16.prototype.assertInvalid;
	binaryReader[7] = Packet$16.prototype.readTimestamp;
	binaryReader[8] = Packet$16.prototype.readInt64;
	binaryReader[9] = Packet$16.prototype.readInt32;
	binaryReader[10] = Packet$16.prototype.readTimestamp;
	binaryReader[11] = Packet$16.prototype.readTime;
	binaryReader[12] = Packet$16.prototype.readDateTime;
	binaryReader[13] = Packet$16.prototype.readInt16;
	binaryReader[Types$5.VAR_STRING] = Packet$16.prototype.readLengthCodedString;
	module.exports = BinaryRow;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/commands.js
var require_commands$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/commands.js": ((exports, module) => {
	module.exports = {
		SLEEP: 0,
		QUIT: 1,
		INIT_DB: 2,
		QUERY: 3,
		FIELD_LIST: 4,
		CREATE_DB: 5,
		DROP_DB: 6,
		REFRESH: 7,
		SHUTDOWN: 8,
		STATISTICS: 9,
		PROCESS_INFO: 10,
		CONNECT: 11,
		PROCESS_KILL: 12,
		DEBUG: 13,
		PING: 14,
		TIME: 15,
		DELAYED_INSERT: 16,
		CHANGE_USER: 17,
		BINLOG_DUMP: 18,
		TABLE_DUMP: 19,
		CONNECT_OUT: 20,
		REGISTER_SLAVE: 21,
		STMT_PREPARE: 22,
		STMT_EXECUTE: 23,
		STMT_SEND_LONG_DATA: 24,
		STMT_CLOSE: 25,
		STMT_RESET: 26,
		SET_OPTION: 27,
		STMT_FETCH: 28,
		DAEMON: 29,
		BINLOG_DUMP_GTID: 30,
		UNKNOWN: 255
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binlog_dump.js
var require_binlog_dump$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binlog_dump.js": ((exports, module) => {
	const Packet$15 = require_packet();
	const CommandCodes$4 = require_commands$1();
	var BinlogDump$2 = class {
		constructor(opts) {
			this.binlogPos = opts.binlogPos || 0;
			this.serverId = opts.serverId || 0;
			this.flags = opts.flags || 0;
			this.filename = opts.filename || "";
		}
		toPacket() {
			const length = 15 + Buffer.byteLength(this.filename, "utf8");
			const packet = new Packet$15(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(CommandCodes$4.BINLOG_DUMP);
			packet.writeInt32(this.binlogPos);
			packet.writeInt16(this.flags);
			packet.writeInt32(this.serverId);
			packet.writeString(this.filename);
			return packet;
		}
	};
	module.exports = BinlogDump$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/client.js
var require_client = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/client.js": ((exports) => {
	exports.LONG_PASSWORD = 1;
	exports.FOUND_ROWS = 2;
	exports.LONG_FLAG = 4;
	exports.CONNECT_WITH_DB = 8;
	exports.NO_SCHEMA = 16;
	exports.COMPRESS = 32;
	exports.ODBC = 64;
	exports.LOCAL_FILES = 128;
	exports.IGNORE_SPACE = 256;
	exports.PROTOCOL_41 = 512;
	exports.INTERACTIVE = 1024;
	exports.SSL = 2048;
	exports.IGNORE_SIGPIPE = 4096;
	exports.TRANSACTIONS = 8192;
	exports.RESERVED = 16384;
	exports.SECURE_CONNECTION = 32768;
	exports.MULTI_STATEMENTS = 65536;
	exports.MULTI_RESULTS = 131072;
	exports.PS_MULTI_RESULTS = 262144;
	exports.PLUGIN_AUTH = 524288;
	exports.CONNECT_ATTRS = 1048576;
	exports.PLUGIN_AUTH_LENENC_CLIENT_DATA = 2097152;
	exports.CAN_HANDLE_EXPIRED_PASSWORDS = 4194304;
	exports.SESSION_TRACK = 8388608;
	exports.DEPRECATE_EOF = 16777216;
	exports.SSL_VERIFY_SERVER_CERT = 1073741824;
	exports.REMEMBER_OPTIONS = 2147483648;
	exports.MULTI_FACTOR_AUTHENTICATION = 268435456;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_41.js
var require_auth_41 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_41.js": ((exports) => {
	const crypto$2 = __require("crypto");
	function sha1(msg, msg1, msg2) {
		const hash = crypto$2.createHash("sha1");
		hash.update(msg);
		if (msg1) hash.update(msg1);
		if (msg2) hash.update(msg2);
		return hash.digest();
	}
	function xor$1(a, b) {
		const result = Buffer.allocUnsafe(a.length);
		for (let i$4 = 0; i$4 < a.length; i$4++) result[i$4] = a[i$4] ^ b[i$4];
		return result;
	}
	exports.xor = xor$1;
	function token(password, scramble1, scramble2) {
		if (!password) return Buffer.alloc(0);
		const stage1 = sha1(password);
		return exports.calculateTokenFromPasswordSha(stage1, scramble1, scramble2);
	}
	exports.calculateTokenFromPasswordSha = function(passwordSha, scramble1, scramble2) {
		return xor$1(sha1(scramble1.slice(0, 8), scramble2.slice(0, 12), sha1(passwordSha)), passwordSha);
	};
	exports.calculateToken = token;
	exports.verifyToken = function(publicSeed1, publicSeed2, token$1, doubleSha) {
		return sha1(xor$1(token$1, sha1(publicSeed1, publicSeed2, doubleSha))).compare(doubleSha) === 0;
	};
	exports.doubleSha1 = function(password) {
		return sha1(sha1(password));
	};
	function xorRotating$2(a, seed) {
		const result = Buffer.allocUnsafe(a.length);
		const seedLen = seed.length;
		for (let i$4 = 0; i$4 < a.length; i$4++) result[i$4] = a[i$4] ^ seed[i$4 % seedLen];
		return result;
	}
	exports.xorRotating = xorRotating$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/charset_encodings.js
var require_charset_encodings = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/charset_encodings.js": ((exports, module) => {
	module.exports = [
		"utf8",
		"big5",
		"latin2",
		"dec8",
		"cp850",
		"latin1",
		"hp8",
		"koi8r",
		"latin1",
		"latin2",
		"swe7",
		"ascii",
		"eucjp",
		"sjis",
		"cp1251",
		"latin1",
		"hebrew",
		"utf8",
		"tis620",
		"euckr",
		"latin7",
		"latin2",
		"koi8u",
		"cp1251",
		"gb2312",
		"greek",
		"cp1250",
		"latin2",
		"gbk",
		"cp1257",
		"latin5",
		"latin1",
		"armscii8",
		"cesu8",
		"cp1250",
		"ucs2",
		"cp866",
		"keybcs2",
		"macintosh",
		"macroman",
		"cp852",
		"latin7",
		"latin7",
		"macintosh",
		"cp1250",
		"utf8",
		"utf8",
		"latin1",
		"latin1",
		"latin1",
		"cp1251",
		"cp1251",
		"cp1251",
		"macroman",
		"utf16",
		"utf16",
		"utf16-le",
		"cp1256",
		"cp1257",
		"cp1257",
		"utf32",
		"utf32",
		"utf16-le",
		"binary",
		"armscii8",
		"ascii",
		"cp1250",
		"cp1256",
		"cp866",
		"dec8",
		"greek",
		"hebrew",
		"hp8",
		"keybcs2",
		"koi8r",
		"koi8u",
		"cesu8",
		"latin2",
		"latin5",
		"latin7",
		"cp850",
		"cp852",
		"swe7",
		"cesu8",
		"big5",
		"euckr",
		"gb2312",
		"gbk",
		"sjis",
		"tis620",
		"ucs2",
		"eucjp",
		"geostd8",
		"geostd8",
		"latin1",
		"cp932",
		"cp932",
		"eucjpms",
		"eucjpms",
		"cp1250",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf16",
		"utf8",
		"utf8",
		"utf8",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"ucs2",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"ucs2",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf32",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"cesu8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"cesu8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"gb18030",
		"gb18030",
		"gb18030",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8",
		"utf8"
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/change_user.js
var require_change_user$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/change_user.js": ((exports, module) => {
	const CommandCode$4 = require_commands$1();
	const ClientConstants$7 = require_client();
	const Packet$14 = require_packet();
	const auth41$3 = require_auth_41();
	const CharsetToEncoding$8 = require_charset_encodings();
	var ChangeUser$2 = class {
		constructor(opts) {
			this.flags = opts.flags;
			this.user = opts.user || "";
			this.database = opts.database || "";
			this.password = opts.password || "";
			this.passwordSha1 = opts.passwordSha1;
			this.authPluginData1 = opts.authPluginData1;
			this.authPluginData2 = opts.authPluginData2;
			this.connectAttributes = opts.connectAttrinutes || {};
			let authToken;
			if (this.passwordSha1) authToken = auth41$3.calculateTokenFromPasswordSha(this.passwordSha1, this.authPluginData1, this.authPluginData2);
			else authToken = auth41$3.calculateToken(this.password, this.authPluginData1, this.authPluginData2);
			this.authToken = authToken;
			this.charsetNumber = opts.charsetNumber;
		}
		serializeToBuffer(buffer$1) {
			const isSet = (flag) => this.flags & ClientConstants$7[flag];
			const packet = new Packet$14(0, buffer$1, 0, buffer$1.length);
			packet.offset = 4;
			const encoding = CharsetToEncoding$8[this.charsetNumber];
			packet.writeInt8(CommandCode$4.CHANGE_USER);
			packet.writeNullTerminatedString(this.user, encoding);
			if (isSet("SECURE_CONNECTION")) {
				packet.writeInt8(this.authToken.length);
				packet.writeBuffer(this.authToken);
			} else {
				packet.writeBuffer(this.authToken);
				packet.writeInt8(0);
			}
			packet.writeNullTerminatedString(this.database, encoding);
			packet.writeInt16(this.charsetNumber);
			if (isSet("PLUGIN_AUTH")) packet.writeNullTerminatedString("mysql_native_password", "latin1");
			if (isSet("CONNECT_ATTRS")) {
				const connectAttributes = this.connectAttributes;
				const attrNames = Object.keys(connectAttributes);
				let keysLength = 0;
				for (let k = 0; k < attrNames.length; ++k) {
					keysLength += Packet$14.lengthCodedStringLength(attrNames[k], encoding);
					keysLength += Packet$14.lengthCodedStringLength(connectAttributes[attrNames[k]], encoding);
				}
				packet.writeLengthCodedNumber(keysLength);
				for (let k = 0; k < attrNames.length; ++k) {
					packet.writeLengthCodedString(attrNames[k], encoding);
					packet.writeLengthCodedString(connectAttributes[attrNames[k]], encoding);
				}
			}
			return packet;
		}
		toPacket() {
			if (typeof this.user !== "string") throw new Error("\"user\" connection config property must be a string");
			if (typeof this.database !== "string") throw new Error("\"database\" connection config property must be a string");
			const p = this.serializeToBuffer(Packet$14.MockBuffer());
			return this.serializeToBuffer(Buffer.allocUnsafe(p.offset));
		}
	};
	module.exports = ChangeUser$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/close_statement.js
var require_close_statement$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/close_statement.js": ((exports, module) => {
	const Packet$13 = require_packet();
	const CommandCodes$3 = require_commands$1();
	var CloseStatement$3 = class {
		constructor(id) {
			this.id = id;
		}
		toPacket() {
			const packet = new Packet$13(0, Buffer.allocUnsafe(9), 0, 9);
			packet.offset = 4;
			packet.writeInt8(CommandCodes$3.STMT_CLOSE);
			packet.writeInt32(this.id);
			return packet;
		}
	};
	module.exports = CloseStatement$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/field_flags.js
var require_field_flags = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/field_flags.js": ((exports) => {
	exports.NOT_NULL = 1;
	exports.PRI_KEY = 2;
	exports.UNIQUE_KEY = 4;
	exports.MULTIPLE_KEY = 8;
	exports.BLOB = 16;
	exports.UNSIGNED = 32;
	exports.ZEROFILL = 64;
	exports.BINARY = 128;
	exports.ENUM = 256;
	exports.AUTO_INCREMENT = 512;
	exports.TIMESTAMP = 1024;
	exports.SET = 2048;
	exports.NO_DEFAULT_VALUE = 4096;
	exports.ON_UPDATE_NOW = 8192;
	exports.NUM = 32768;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/column_definition.js
var require_column_definition = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/column_definition.js": ((exports, module) => {
	const Packet$12 = require_packet();
	const StringParser$2 = require_string();
	const CharsetToEncoding$7 = require_charset_encodings();
	const fields = [
		"catalog",
		"schema",
		"table",
		"orgTable",
		"name",
		"orgName"
	];
	var ColumnDefinition = class {
		constructor(packet, clientEncoding) {
			this._buf = packet.buffer;
			this._clientEncoding = clientEncoding;
			this._catalogLength = packet.readLengthCodedNumber();
			this._catalogStart = packet.offset;
			packet.offset += this._catalogLength;
			this._schemaLength = packet.readLengthCodedNumber();
			this._schemaStart = packet.offset;
			packet.offset += this._schemaLength;
			this._tableLength = packet.readLengthCodedNumber();
			this._tableStart = packet.offset;
			packet.offset += this._tableLength;
			this._orgTableLength = packet.readLengthCodedNumber();
			this._orgTableStart = packet.offset;
			packet.offset += this._orgTableLength;
			const _nameLength = packet.readLengthCodedNumber();
			const _nameStart = packet.offset;
			packet.offset += _nameLength;
			this._orgNameLength = packet.readLengthCodedNumber();
			this._orgNameStart = packet.offset;
			packet.offset += this._orgNameLength;
			packet.skip(1);
			this.characterSet = packet.readInt16();
			this.encoding = CharsetToEncoding$7[this.characterSet];
			this.name = StringParser$2.decode(this._buf, this.encoding === "binary" ? this._clientEncoding : this.encoding, _nameStart, _nameStart + _nameLength);
			this.columnLength = packet.readInt32();
			this.columnType = packet.readInt8();
			this.type = this.columnType;
			this.flags = packet.readInt16();
			this.decimals = packet.readInt8();
		}
		inspect() {
			return {
				catalog: this.catalog,
				schema: this.schema,
				name: this.name,
				orgName: this.orgName,
				table: this.table,
				orgTable: this.orgTable,
				characterSet: this.characterSet,
				encoding: this.encoding,
				columnLength: this.columnLength,
				type: this.columnType,
				flags: this.flags,
				decimals: this.decimals
			};
		}
		[Symbol.for("nodejs.util.inspect.custom")](depth, inspectOptions, inspect) {
			const Types$7 = require_types();
			const typeNames$4 = [];
			for (const t in Types$7) typeNames$4[Types$7[t]] = t;
			const fiedFlags = require_field_flags();
			const flagNames$1 = [];
			const inspectFlags = this.flags;
			for (const f in fiedFlags) if (inspectFlags & fiedFlags[f]) if (f === "PRI_KEY") flagNames$1.push("PRIMARY KEY");
			else if (f === "NOT_NULL") flagNames$1.push("NOT NULL");
			else if (f === "BINARY") {} else if (f === "MULTIPLE_KEY") {} else if (f === "NO_DEFAULT_VALUE") {} else if (f === "BLOB") {} else if (f === "UNSIGNED") {} else if (f === "TIMESTAMP") {} else if (f === "ON_UPDATE_NOW") flagNames$1.push("ON UPDATE CURRENT_TIMESTAMP");
			else flagNames$1.push(f);
			if (depth > 1) return inspect({
				...this.inspect(),
				typeName: typeNames$4[this.columnType],
				flags: flagNames$1
			});
			const isUnsigned = this.flags & fiedFlags.UNSIGNED;
			let typeName = typeNames$4[this.columnType];
			if (typeName === "BLOB") if (this.columnLength === 4294967295) typeName = "LONGTEXT";
			else if (this.columnLength === 67108860) typeName = "MEDIUMTEXT";
			else if (this.columnLength === 262140) typeName = "TEXT";
			else if (this.columnLength === 1020) typeName = "TINYTEXT";
			else typeName = `BLOB(${this.columnLength})`;
			else if (typeName === "VAR_STRING") typeName = `VARCHAR(${Math.ceil(this.columnLength / 4)})`;
			else if (typeName === "TINY") if (this.columnLength === 3 && isUnsigned || this.columnLength === 4 && !isUnsigned) typeName = "TINYINT";
			else typeName = `TINYINT(${this.columnLength})`;
			else if (typeName === "LONGLONG") if (this.columnLength === 20) typeName = "BIGINT";
			else typeName = `BIGINT(${this.columnLength})`;
			else if (typeName === "SHORT") if (isUnsigned && this.columnLength === 5) typeName = "SMALLINT";
			else if (!isUnsigned && this.columnLength === 6) typeName = "SMALLINT";
			else typeName = `SMALLINT(${this.columnLength})`;
			else if (typeName === "LONG") if (isUnsigned && this.columnLength === 10) typeName = "INT";
			else if (!isUnsigned && this.columnLength === 11) typeName = "INT";
			else typeName = `INT(${this.columnLength})`;
			else if (typeName === "INT24") if (isUnsigned && this.columnLength === 8) typeName = "MEDIUMINT";
			else if (!isUnsigned && this.columnLength === 9) typeName = "MEDIUMINT";
			else typeName = `MEDIUMINT(${this.columnLength})`;
			else if (typeName === "DOUBLE") if (this.columnLength === 22 && this.decimals === 31) typeName = "DOUBLE";
			else typeName = `DOUBLE(${this.columnLength},${this.decimals})`;
			else if (typeName === "FLOAT") if (this.columnLength === 12 && this.decimals === 31) typeName = "FLOAT";
			else typeName = `FLOAT(${this.columnLength},${this.decimals})`;
			else if (typeName === "NEWDECIMAL") if (this.columnLength === 11 && this.decimals === 0) typeName = "DECIMAL";
			else if (this.decimals === 0) if (isUnsigned) typeName = `DECIMAL(${this.columnLength})`;
			else typeName = `DECIMAL(${this.columnLength - 1})`;
			else typeName = `DECIMAL(${this.columnLength - 2},${this.decimals})`;
			else typeName = `${typeNames$4[this.columnType]}(${this.columnLength})`;
			if (isUnsigned) typeName += " UNSIGNED";
			return `\`${this.name}\` ${[typeName, ...flagNames$1].join(" ")}`;
		}
		static toPacket(column, sequenceId) {
			let length = 17;
			fields.forEach((field) => {
				length += Packet$12.lengthCodedStringLength(column[field], CharsetToEncoding$7[column.characterSet]);
			});
			const packet = new Packet$12(sequenceId, Buffer.allocUnsafe(length), 0, length);
			function writeField(name) {
				packet.writeLengthCodedString(column[name], CharsetToEncoding$7[column.characterSet]);
			}
			packet.offset = 4;
			fields.forEach(writeField);
			packet.writeInt8(12);
			packet.writeInt16(column.characterSet);
			packet.writeInt32(column.columnLength);
			packet.writeInt8(column.columnType);
			packet.writeInt16(column.flags);
			packet.writeInt8(column.decimals);
			packet.writeInt16(0);
			return packet;
		}
		get db() {
			return this.schema;
		}
	};
	const addString = function(name) {
		Object.defineProperty(ColumnDefinition.prototype, name, { get: function() {
			const start = this[`_${name}Start`];
			const end = start + this[`_${name}Length`];
			const val = StringParser$2.decode(this._buf, this.encoding === "binary" ? this._clientEncoding : this.encoding, start, end);
			Object.defineProperty(this, name, {
				value: val,
				writable: false,
				configurable: false,
				enumerable: false
			});
			return val;
		} });
	};
	addString("catalog");
	addString("schema");
	addString("table");
	addString("orgTable");
	addString("orgName");
	module.exports = ColumnDefinition;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/cursor.js
var require_cursor = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/cursor.js": ((exports, module) => {
	module.exports = {
		NO_CURSOR: 0,
		READ_ONLY: 1,
		FOR_UPDATE: 2,
		SCROLLABLE: 3
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/execute.js
var require_execute$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/execute.js": ((exports, module) => {
	const CursorType = require_cursor();
	const CommandCodes$2 = require_commands$1();
	const Types$4 = require_types();
	const Packet$11 = require_packet();
	const CharsetToEncoding$6 = require_charset_encodings();
	function isJSON(value) {
		return Array.isArray(value) || value.constructor === Object || typeof value.toJSON === "function" && !Buffer.isBuffer(value);
	}
	/**
	* Converts a value to an object describing type, String/Buffer representation and length
	* @param {*} value
	*/
	function toParameter(value, encoding, timezone) {
		let type = Types$4.VAR_STRING;
		let length;
		let writer = function(value$1) {
			return Packet$11.prototype.writeLengthCodedString.call(this, value$1, encoding);
		};
		if (value !== null) switch (typeof value) {
			case "undefined": throw new TypeError("Bind parameters must not contain undefined");
			case "number":
				type = Types$4.DOUBLE;
				length = 8;
				writer = Packet$11.prototype.writeDouble;
				break;
			case "boolean":
				value = value | 0;
				type = Types$4.TINY;
				length = 1;
				writer = Packet$11.prototype.writeInt8;
				break;
			case "object":
				if (Object.prototype.toString.call(value) === "[object Date]") {
					type = Types$4.DATETIME;
					length = 12;
					writer = function(value$1) {
						return Packet$11.prototype.writeDate.call(this, value$1, timezone);
					};
				} else if (isJSON(value)) {
					value = JSON.stringify(value);
					type = Types$4.JSON;
				} else if (Buffer.isBuffer(value)) {
					length = Packet$11.lengthCodedNumberLength(value.length) + value.length;
					writer = Packet$11.prototype.writeLengthCodedBuffer;
				}
				break;
			default: value = value.toString();
		}
		else {
			value = "";
			type = Types$4.NULL;
		}
		if (!length) length = Packet$11.lengthCodedStringLength(value, encoding);
		return {
			value,
			type,
			length,
			writer
		};
	}
	var Execute$3 = class {
		constructor(id, parameters, charsetNumber, timezone) {
			this.id = id;
			this.parameters = parameters;
			this.encoding = CharsetToEncoding$6[charsetNumber];
			this.timezone = timezone;
		}
		static fromPacket(packet, encoding) {
			const stmtId = packet.readInt32();
			const flags = packet.readInt8();
			const iterationCount = packet.readInt32();
			let i$4 = packet.offset;
			while (i$4 < packet.end - 1) {
				if ((packet.buffer[i$4 + 1] === Types$4.VAR_STRING || packet.buffer[i$4 + 1] === Types$4.NULL || packet.buffer[i$4 + 1] === Types$4.DOUBLE || packet.buffer[i$4 + 1] === Types$4.TINY || packet.buffer[i$4 + 1] === Types$4.DATETIME || packet.buffer[i$4 + 1] === Types$4.JSON) && packet.buffer[i$4] === 1 && packet.buffer[i$4 + 2] === 0) break;
				else packet.readInt8();
				i$4++;
			}
			const types = [];
			for (let i$5 = packet.offset + 1; i$5 < packet.end - 1; i$5++) if ((packet.buffer[i$5] === Types$4.VAR_STRING || packet.buffer[i$5] === Types$4.NULL || packet.buffer[i$5] === Types$4.DOUBLE || packet.buffer[i$5] === Types$4.TINY || packet.buffer[i$5] === Types$4.DATETIME || packet.buffer[i$5] === Types$4.JSON) && packet.buffer[i$5 + 1] === 0) {
				types.push(packet.buffer[i$5]);
				packet.skip(2);
			}
			packet.skip(1);
			const values = [];
			for (let i$5 = 0; i$5 < types.length; i$5++) {
				if (types[i$5] === Types$4.VAR_STRING) values.push(packet.readLengthCodedString(encoding));
				else if (types[i$5] === Types$4.DOUBLE) values.push(packet.readDouble());
				else if (types[i$5] === Types$4.TINY) values.push(packet.readInt8());
				else if (types[i$5] === Types$4.DATETIME) values.push(packet.readDateTime());
				else if (types[i$5] === Types$4.JSON) values.push(JSON.parse(packet.readLengthCodedString(encoding)));
				if (types[i$5] === Types$4.NULL) values.push(null);
			}
			return {
				stmtId,
				flags,
				iterationCount,
				values
			};
		}
		toPacket() {
			let length = 14;
			let parameters;
			if (this.parameters && this.parameters.length > 0) {
				length += Math.floor((this.parameters.length + 7) / 8);
				length += 1;
				length += 2 * this.parameters.length;
				parameters = this.parameters.map((value) => toParameter(value, this.encoding, this.timezone));
				length += parameters.reduce((accumulator, parameter) => accumulator + parameter.length, 0);
			}
			const packet = new Packet$11(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(CommandCodes$2.STMT_EXECUTE);
			packet.writeInt32(this.id);
			packet.writeInt8(CursorType.NO_CURSOR);
			packet.writeInt32(1);
			if (parameters) {
				let bitmap = 0;
				let bitValue = 1;
				parameters.forEach((parameter) => {
					if (parameter.type === Types$4.NULL) bitmap += bitValue;
					bitValue *= 2;
					if (bitValue === 256) {
						packet.writeInt8(bitmap);
						bitmap = 0;
						bitValue = 1;
					}
				});
				if (bitValue !== 1) packet.writeInt8(bitmap);
				packet.writeInt8(1);
				parameters.forEach((parameter) => {
					packet.writeInt8(parameter.type);
					packet.writeInt8(0);
				});
				parameters.forEach((parameter) => {
					if (parameter.type !== Types$4.NULL) parameter.writer.call(packet, parameter.value);
				});
			}
			return packet;
		}
	};
	module.exports = Execute$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/handshake.js
var require_handshake = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/handshake.js": ((exports, module) => {
	const Packet$10 = require_packet();
	const ClientConstants$6 = require_client();
	var Handshake = class Handshake {
		constructor(args) {
			this.protocolVersion = args.protocolVersion;
			this.serverVersion = args.serverVersion;
			this.capabilityFlags = args.capabilityFlags;
			this.connectionId = args.connectionId;
			this.authPluginData1 = args.authPluginData1;
			this.authPluginData2 = args.authPluginData2;
			this.characterSet = args.characterSet;
			this.statusFlags = args.statusFlags;
			this.authPluginName = args.authPluginName;
		}
		setScrambleData(cb) {
			__require("crypto").randomBytes(20, (err, data) => {
				if (err) {
					cb(err);
					return;
				}
				this.authPluginData1 = data.slice(0, 8);
				this.authPluginData2 = data.slice(8, 20);
				cb();
			});
		}
		toPacket(sequenceId) {
			const length = 68 + Buffer.byteLength(this.serverVersion, "utf8");
			const packet = new Packet$10(sequenceId, Buffer.alloc(length + 4, 0), 0, length + 4);
			packet.offset = 4;
			packet.writeInt8(this.protocolVersion);
			packet.writeString(this.serverVersion, "cesu8");
			packet.writeInt8(0);
			packet.writeInt32(this.connectionId);
			packet.writeBuffer(this.authPluginData1);
			packet.writeInt8(0);
			const capabilityFlagsBuffer = Buffer.allocUnsafe(4);
			capabilityFlagsBuffer.writeUInt32LE(this.capabilityFlags, 0);
			packet.writeBuffer(capabilityFlagsBuffer.slice(0, 2));
			packet.writeInt8(this.characterSet);
			packet.writeInt16(this.statusFlags);
			packet.writeBuffer(capabilityFlagsBuffer.slice(2, 4));
			packet.writeInt8(21);
			packet.skip(10);
			packet.writeBuffer(this.authPluginData2);
			packet.writeInt8(0);
			packet.writeString("mysql_native_password", "latin1");
			packet.writeInt8(0);
			return packet;
		}
		static fromPacket(packet) {
			const args = {};
			args.protocolVersion = packet.readInt8();
			args.serverVersion = packet.readNullTerminatedString("cesu8");
			args.connectionId = packet.readInt32();
			args.authPluginData1 = packet.readBuffer(8);
			packet.skip(1);
			const capabilityFlagsBuffer = Buffer.allocUnsafe(4);
			capabilityFlagsBuffer[0] = packet.readInt8();
			capabilityFlagsBuffer[1] = packet.readInt8();
			if (packet.haveMoreData()) {
				args.characterSet = packet.readInt8();
				args.statusFlags = packet.readInt16();
				capabilityFlagsBuffer[2] = packet.readInt8();
				capabilityFlagsBuffer[3] = packet.readInt8();
				args.capabilityFlags = capabilityFlagsBuffer.readUInt32LE(0);
				if (args.capabilityFlags & ClientConstants$6.PLUGIN_AUTH) args.authPluginDataLength = packet.readInt8();
				else {
					args.authPluginDataLength = 0;
					packet.skip(1);
				}
				packet.skip(10);
			} else args.capabilityFlags = capabilityFlagsBuffer.readUInt16LE(0);
			if (args.capabilityFlags & ClientConstants$6.SECURE_CONNECTION) {
				const authPluginDataLength = args.authPluginDataLength;
				if (authPluginDataLength === 0) {
					args.authPluginDataLength = 20;
					args.authPluginData2 = packet.readBuffer(12);
					packet.skip(1);
				} else {
					const len = Math.max(13, authPluginDataLength - 8);
					args.authPluginData2 = packet.readBuffer(len);
				}
			}
			if (args.capabilityFlags & ClientConstants$6.PLUGIN_AUTH) args.authPluginName = packet.readNullTerminatedString("ascii");
			return new Handshake(args);
		}
	};
	module.exports = Handshake;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/handshake_response.js
var require_handshake_response = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/handshake_response.js": ((exports, module) => {
	const ClientConstants$5 = require_client();
	const CharsetToEncoding$5 = require_charset_encodings();
	const Packet$9 = require_packet();
	const auth41$2 = require_auth_41();
	var HandshakeResponse = class {
		constructor(handshake) {
			this.user = handshake.user || "";
			this.database = handshake.database || "";
			this.password = handshake.password || "";
			this.passwordSha1 = handshake.passwordSha1;
			this.authPluginData1 = handshake.authPluginData1;
			this.authPluginData2 = handshake.authPluginData2;
			this.compress = handshake.compress;
			this.clientFlags = handshake.flags;
			let authToken;
			if (this.passwordSha1) authToken = auth41$2.calculateTokenFromPasswordSha(this.passwordSha1, this.authPluginData1, this.authPluginData2);
			else authToken = auth41$2.calculateToken(this.password, this.authPluginData1, this.authPluginData2);
			this.authToken = authToken;
			this.charsetNumber = handshake.charsetNumber;
			this.encoding = CharsetToEncoding$5[handshake.charsetNumber];
			this.connectAttributes = handshake.connectAttributes;
		}
		serializeResponse(buffer$1) {
			const isSet = (flag) => this.clientFlags & ClientConstants$5[flag];
			const packet = new Packet$9(0, buffer$1, 0, buffer$1.length);
			packet.offset = 4;
			packet.writeInt32(this.clientFlags);
			packet.writeInt32(0);
			packet.writeInt8(this.charsetNumber);
			packet.skip(23);
			const encoding = this.encoding;
			packet.writeNullTerminatedString(this.user, encoding);
			let k;
			if (isSet("PLUGIN_AUTH_LENENC_CLIENT_DATA")) {
				packet.writeLengthCodedNumber(this.authToken.length);
				packet.writeBuffer(this.authToken);
			} else if (isSet("SECURE_CONNECTION")) {
				packet.writeInt8(this.authToken.length);
				packet.writeBuffer(this.authToken);
			} else {
				packet.writeBuffer(this.authToken);
				packet.writeInt8(0);
			}
			if (isSet("CONNECT_WITH_DB")) packet.writeNullTerminatedString(this.database, encoding);
			if (isSet("PLUGIN_AUTH")) packet.writeNullTerminatedString("mysql_native_password", "latin1");
			if (isSet("CONNECT_ATTRS")) {
				const connectAttributes = this.connectAttributes || {};
				const attrNames = Object.keys(connectAttributes);
				let keysLength = 0;
				for (k = 0; k < attrNames.length; ++k) {
					keysLength += Packet$9.lengthCodedStringLength(attrNames[k], encoding);
					keysLength += Packet$9.lengthCodedStringLength(connectAttributes[attrNames[k]], encoding);
				}
				packet.writeLengthCodedNumber(keysLength);
				for (k = 0; k < attrNames.length; ++k) {
					packet.writeLengthCodedString(attrNames[k], encoding);
					packet.writeLengthCodedString(connectAttributes[attrNames[k]], encoding);
				}
			}
			return packet;
		}
		toPacket() {
			if (typeof this.user !== "string") throw new Error("\"user\" connection config property must be a string");
			if (typeof this.database !== "string") throw new Error("\"database\" connection config property must be a string");
			const p = this.serializeResponse(Packet$9.MockBuffer());
			return this.serializeResponse(Buffer.alloc(p.offset));
		}
		static fromPacket(packet) {
			const args = {};
			args.clientFlags = packet.readInt32();
			function isSet(flag) {
				return args.clientFlags & ClientConstants$5[flag];
			}
			args.maxPacketSize = packet.readInt32();
			args.charsetNumber = packet.readInt8();
			const encoding = CharsetToEncoding$5[args.charsetNumber];
			args.encoding = encoding;
			packet.skip(23);
			args.user = packet.readNullTerminatedString(encoding);
			let authTokenLength;
			if (isSet("PLUGIN_AUTH_LENENC_CLIENT_DATA")) {
				authTokenLength = packet.readLengthCodedNumber(encoding);
				args.authToken = packet.readBuffer(authTokenLength);
			} else if (isSet("SECURE_CONNECTION")) {
				authTokenLength = packet.readInt8();
				args.authToken = packet.readBuffer(authTokenLength);
			} else args.authToken = packet.readNullTerminatedString(encoding);
			if (isSet("CONNECT_WITH_DB")) args.database = packet.readNullTerminatedString(encoding);
			if (isSet("PLUGIN_AUTH")) args.authPluginName = packet.readNullTerminatedString(encoding);
			if (isSet("CONNECT_ATTRS")) {
				const keysLength = packet.readLengthCodedNumber(encoding);
				const keysEnd = packet.offset + keysLength;
				const attrs = {};
				while (packet.offset < keysEnd) attrs[packet.readLengthCodedString(encoding)] = packet.readLengthCodedString(encoding);
				args.connectAttributes = attrs;
			}
			return args;
		}
	};
	module.exports = HandshakeResponse;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/prepare_statement.js
var require_prepare_statement = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/prepare_statement.js": ((exports, module) => {
	const Packet$8 = require_packet();
	const CommandCodes$1 = require_commands$1();
	const StringParser$1 = require_string();
	const CharsetToEncoding$4 = require_charset_encodings();
	var PrepareStatement = class {
		constructor(sql, charsetNumber) {
			this.query = sql;
			this.charsetNumber = charsetNumber;
			this.encoding = CharsetToEncoding$4[charsetNumber];
		}
		toPacket() {
			const buf = StringParser$1.encode(this.query, this.encoding);
			const length = 5 + buf.length;
			const packet = new Packet$8(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(CommandCodes$1.STMT_PREPARE);
			packet.writeBuffer(buf);
			return packet;
		}
	};
	module.exports = PrepareStatement;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/prepared_statement_header.js
var require_prepared_statement_header = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/prepared_statement_header.js": ((exports, module) => {
	var PreparedStatementHeader = class {
		constructor(packet) {
			packet.skip(1);
			this.id = packet.readInt32();
			this.fieldCount = packet.readInt16();
			this.parameterCount = packet.readInt16();
			packet.skip(1);
			this.warningCount = packet.readInt16();
		}
	};
	module.exports = PreparedStatementHeader;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/query.js
var require_query$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/query.js": ((exports, module) => {
	const Packet$7 = require_packet();
	const CommandCode$3 = require_commands$1();
	const StringParser = require_string();
	const CharsetToEncoding$3 = require_charset_encodings();
	var Query$3 = class {
		constructor(sql, charsetNumber) {
			this.query = sql;
			this.charsetNumber = charsetNumber;
			this.encoding = CharsetToEncoding$3[charsetNumber];
		}
		toPacket() {
			const buf = StringParser.encode(this.query, this.encoding);
			const length = 5 + buf.length;
			const packet = new Packet$7(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(CommandCode$3.QUERY);
			packet.writeBuffer(buf);
			return packet;
		}
	};
	module.exports = Query$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/register_slave.js
var require_register_slave$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/register_slave.js": ((exports, module) => {
	const Packet$6 = require_packet();
	const CommandCodes = require_commands$1();
	var RegisterSlave$2 = class {
		constructor(opts) {
			this.serverId = opts.serverId || 0;
			this.slaveHostname = opts.slaveHostname || "";
			this.slaveUser = opts.slaveUser || "";
			this.slavePassword = opts.slavePassword || "";
			this.slavePort = opts.slavePort || 0;
			this.replicationRank = opts.replicationRank || 0;
			this.masterId = opts.masterId || 0;
		}
		toPacket() {
			const length = 15 + Buffer.byteLength(this.slaveHostname, "utf8") + Buffer.byteLength(this.slaveUser, "utf8") + Buffer.byteLength(this.slavePassword, "utf8") + 3 + 4;
			const packet = new Packet$6(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(CommandCodes.REGISTER_SLAVE);
			packet.writeInt32(this.serverId);
			packet.writeInt8(Buffer.byteLength(this.slaveHostname, "utf8"));
			packet.writeString(this.slaveHostname);
			packet.writeInt8(Buffer.byteLength(this.slaveUser, "utf8"));
			packet.writeString(this.slaveUser);
			packet.writeInt8(Buffer.byteLength(this.slavePassword, "utf8"));
			packet.writeString(this.slavePassword);
			packet.writeInt16(this.slavePort);
			packet.writeInt32(this.replicationRank);
			packet.writeInt32(this.masterId);
			return packet;
		}
	};
	module.exports = RegisterSlave$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/server_status.js
var require_server_status = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/server_status.js": ((exports) => {
	/**
	Is raised when a multi-statement transaction
	has been started, either explicitly, by means
	of BEGIN or COMMIT AND CHAIN, or
	implicitly, by the first transactional
	statement, when autocommit=off.
	*/
	exports.SERVER_STATUS_IN_TRANS = 1;
	exports.SERVER_STATUS_AUTOCOMMIT = 2;
	exports.SERVER_MORE_RESULTS_EXISTS = 8;
	exports.SERVER_QUERY_NO_GOOD_INDEX_USED = 16;
	exports.SERVER_QUERY_NO_INDEX_USED = 32;
	/**
	The server was able to fulfill the clients request and opened a
	read-only non-scrollable cursor for a query. This flag comes
	in reply to COM_STMT_EXECUTE and COM_STMT_FETCH commands.
	*/
	exports.SERVER_STATUS_CURSOR_EXISTS = 64;
	/**
	This flag is sent when a read-only cursor is exhausted, in reply to
	COM_STMT_FETCH command.
	*/
	exports.SERVER_STATUS_LAST_ROW_SENT = 128;
	exports.SERVER_STATUS_DB_DROPPED = 256;
	exports.SERVER_STATUS_NO_BACKSLASH_ESCAPES = 512;
	/**
	Sent to the client if after a prepared statement reprepare
	we discovered that the new statement returns a different
	number of result set columns.
	*/
	exports.SERVER_STATUS_METADATA_CHANGED = 1024;
	exports.SERVER_QUERY_WAS_SLOW = 2048;
	/**
	To mark ResultSet containing output parameter values.
	*/
	exports.SERVER_PS_OUT_PARAMS = 4096;
	exports.SERVER_STATUS_IN_TRANS_READONLY = 8192;
	exports.SERVER_SESSION_STATE_CHANGED = 16384;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/encoding_charset.js
var require_encoding_charset = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/encoding_charset.js": ((exports, module) => {
	module.exports = {
		big5: 1,
		latin2: 2,
		dec8: 3,
		cp850: 4,
		latin1: 5,
		hp8: 6,
		koi8r: 7,
		swe7: 10,
		ascii: 11,
		eucjp: 12,
		sjis: 13,
		cp1251: 14,
		hebrew: 16,
		tis620: 18,
		euckr: 19,
		latin7: 20,
		koi8u: 22,
		gb2312: 24,
		greek: 25,
		cp1250: 26,
		gbk: 28,
		cp1257: 29,
		latin5: 30,
		armscii8: 32,
		cesu8: 33,
		ucs2: 35,
		cp866: 36,
		keybcs2: 37,
		macintosh: 38,
		macroman: 39,
		cp852: 40,
		utf8: 45,
		utf8mb4: 45,
		utf16: 54,
		utf16le: 56,
		cp1256: 57,
		utf32: 60,
		binary: 63,
		geostd8: 92,
		cp932: 95,
		eucjpms: 97,
		gb18030: 248,
		utf8mb3: 192
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/session_track.js
var require_session_track = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/session_track.js": ((exports) => {
	exports.SYSTEM_VARIABLES = 0;
	exports.SCHEMA = 1;
	exports.STATE_CHANGE = 2;
	exports.STATE_GTIDS = 3;
	exports.TRANSACTION_CHARACTERISTICS = 4;
	exports.TRANSACTION_STATE = 5;
	exports.FIRST_KEY = exports.SYSTEM_VARIABLES;
	exports.LAST_KEY = exports.TRANSACTION_STATE;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/resultset_header.js
var require_resultset_header = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/resultset_header.js": ((exports, module) => {
	const Packet$5 = require_packet();
	const ClientConstants$4 = require_client();
	const ServerSatusFlags = require_server_status();
	const EncodingToCharset = require_encoding_charset();
	const sessionInfoTypes = require_session_track();
	var ResultSetHeader = class {
		constructor(packet, connection) {
			const bigNumberStrings = connection.config.bigNumberStrings;
			const encoding = connection.serverEncoding;
			const flags = connection._handshakePacket.capabilityFlags;
			const isSet = function(flag) {
				return flags & ClientConstants$4[flag];
			};
			if (packet.buffer[packet.offset] !== 0) {
				this.fieldCount = packet.readLengthCodedNumber();
				if (this.fieldCount === null) this.infileName = packet.readString(void 0, encoding);
				return;
			}
			this.fieldCount = packet.readInt8();
			this.affectedRows = packet.readLengthCodedNumber(bigNumberStrings);
			this.insertId = packet.readLengthCodedNumberSigned(bigNumberStrings);
			this.info = "";
			if (isSet("PROTOCOL_41")) {
				this.serverStatus = packet.readInt16();
				this.warningStatus = packet.readInt16();
			} else if (isSet("TRANSACTIONS")) this.serverStatus = packet.readInt16();
			let stateChanges = null;
			if (isSet("SESSION_TRACK") && packet.offset < packet.end) {
				this.info = packet.readLengthCodedString(encoding);
				if (this.serverStatus && ServerSatusFlags.SERVER_SESSION_STATE_CHANGED) {
					let len = packet.offset < packet.end ? packet.readLengthCodedNumber() : 0;
					const end = packet.offset + len;
					let type, key$1, stateEnd;
					if (len > 0) stateChanges = {
						systemVariables: {},
						schema: null,
						gtids: [],
						trackStateChange: null
					};
					while (packet.offset < end) {
						type = packet.readInt8();
						len = packet.readLengthCodedNumber();
						stateEnd = packet.offset + len;
						if (type === sessionInfoTypes.SYSTEM_VARIABLES) {
							key$1 = packet.readLengthCodedString(encoding);
							const val = packet.readLengthCodedString(encoding);
							stateChanges.systemVariables[key$1] = val;
							if (key$1 === "character_set_client") {
								const charsetNumber = EncodingToCharset[val];
								if (typeof charsetNumber !== "undefined") connection.config.charsetNumber = charsetNumber;
							}
						} else if (type === sessionInfoTypes.SCHEMA) {
							key$1 = packet.readLengthCodedString(encoding);
							stateChanges.schema = key$1;
						} else if (type === sessionInfoTypes.STATE_CHANGE) stateChanges.trackStateChange = packet.readLengthCodedString(encoding);
						else if (type === sessionInfoTypes.STATE_GTIDS) {
							packet.readLengthCodedString(encoding);
							stateChanges.gtids = packet.readLengthCodedString(encoding).split(",");
						}
						packet.offset = stateEnd;
					}
				}
			} else this.info = packet.readString(void 0, encoding);
			if (stateChanges) this.stateChanges = stateChanges;
			const m = this.info.match(/\schanged:\s*(\d+)/i);
			if (m !== null) this.changedRows = parseInt(m[1], 10);
			else this.changedRows = 0;
		}
		static toPacket(fieldCount, insertId) {
			let length = 4 + Packet$5.lengthCodedNumberLength(fieldCount);
			if (typeof insertId !== "undefined") length += Packet$5.lengthCodedNumberLength(insertId);
			const packet = new Packet$5(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeLengthCodedNumber(fieldCount);
			if (typeof insertId !== "undefined") packet.writeLengthCodedNumber(insertId);
			return packet;
		}
	};
	module.exports = ResultSetHeader;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/ssl_request.js
var require_ssl_request = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/ssl_request.js": ((exports, module) => {
	const ClientConstants$3 = require_client();
	const Packet$4 = require_packet();
	var SSLRequest = class {
		constructor(flags, charset) {
			this.clientFlags = flags | ClientConstants$3.SSL;
			this.charset = charset;
		}
		toPacket() {
			const length = 36;
			const buffer$1 = Buffer.allocUnsafe(length);
			const packet = new Packet$4(0, buffer$1, 0, length);
			buffer$1.fill(0);
			packet.offset = 4;
			packet.writeInt32(this.clientFlags);
			packet.writeInt32(0);
			packet.writeInt8(this.charset);
			return packet;
		}
	};
	module.exports = SSLRequest;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/text_row.js
var require_text_row = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/text_row.js": ((exports, module) => {
	const Packet$3 = require_packet();
	var TextRow = class TextRow {
		constructor(columns) {
			this.columns = columns || [];
		}
		static fromPacket(packet) {
			const columns = [];
			while (packet.haveMoreData()) columns.push(packet.readLengthCodedString());
			return new TextRow(columns);
		}
		static toPacket(columns, encoding) {
			const sequenceId = 0;
			let length = 0;
			columns.forEach((val) => {
				if (val === null || typeof val === "undefined") {
					++length;
					return;
				}
				length += Packet$3.lengthCodedStringLength(val.toString(10), encoding);
			});
			const packet = new Packet$3(sequenceId, Buffer.allocUnsafe(length + 4), 0, length + 4);
			packet.offset = 4;
			columns.forEach((val) => {
				if (val === null) {
					packet.writeNull();
					return;
				}
				if (typeof val === "undefined") {
					packet.writeInt8(0);
					return;
				}
				packet.writeLengthCodedString(val.toString(10), encoding);
			});
			return packet;
		}
	};
	module.exports = TextRow;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/index.js
var require_packets = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/index.js": ((exports, module) => {
	const process$4 = __require("process");
	const ctorMap = {
		AuthNextFactor: require_auth_next_factor(),
		AuthSwitchRequest: require_auth_switch_request(),
		AuthSwitchRequestMoreData: require_auth_switch_request_more_data(),
		AuthSwitchResponse: require_auth_switch_response(),
		BinaryRow: require_binary_row(),
		BinlogDump: require_binlog_dump$1(),
		ChangeUser: require_change_user$1(),
		CloseStatement: require_close_statement$1(),
		ColumnDefinition: require_column_definition(),
		Execute: require_execute$1(),
		Handshake: require_handshake(),
		HandshakeResponse: require_handshake_response(),
		PrepareStatement: require_prepare_statement(),
		PreparedStatementHeader: require_prepared_statement_header(),
		Query: require_query$1(),
		RegisterSlave: require_register_slave$1(),
		ResultSetHeader: require_resultset_header(),
		SSLRequest: require_ssl_request(),
		TextRow: require_text_row()
	};
	Object.entries(ctorMap).forEach(([name, ctor]) => {
		module.exports[name] = ctor;
		if (process$4.env.NODE_DEBUG) {
			if (ctor.prototype.toPacket) {
				const old = ctor.prototype.toPacket;
				ctor.prototype.toPacket = function() {
					const p = old.call(this);
					p._name = name;
					return p;
				};
			}
		}
	});
	const Packet$2 = require_packet();
	exports.Packet = Packet$2;
	var OK = class {
		static toPacket(args, encoding) {
			args = args || {};
			const affectedRows = args.affectedRows || 0;
			const insertId = args.insertId || 0;
			const serverStatus = args.serverStatus || 0;
			const warningCount = args.warningCount || 0;
			const message = args.message || "";
			let length = 9 + Packet$2.lengthCodedNumberLength(affectedRows);
			length += Packet$2.lengthCodedNumberLength(insertId);
			const packet = new Packet$2(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(0);
			packet.writeLengthCodedNumber(affectedRows);
			packet.writeLengthCodedNumber(insertId);
			packet.writeInt16(serverStatus);
			packet.writeInt16(warningCount);
			packet.writeString(message, encoding);
			packet._name = "OK";
			return packet;
		}
	};
	exports.OK = OK;
	var EOF = class {
		static toPacket(warnings, statusFlags) {
			if (typeof warnings === "undefined") warnings = 0;
			if (typeof statusFlags === "undefined") statusFlags = 0;
			const packet = new Packet$2(0, Buffer.allocUnsafe(9), 0, 9);
			packet.offset = 4;
			packet.writeInt8(254);
			packet.writeInt16(warnings);
			packet.writeInt16(statusFlags);
			packet._name = "EOF";
			return packet;
		}
	};
	exports.EOF = EOF;
	var Error$1 = class Error$1 {
		static toPacket(args, encoding) {
			const length = 13 + Buffer.byteLength(args.message, "utf8");
			const packet = new Packet$2(0, Buffer.allocUnsafe(length), 0, length);
			packet.offset = 4;
			packet.writeInt8(255);
			packet.writeInt16(args.code);
			packet.writeString("#_____", encoding);
			packet.writeString(args.message, encoding);
			packet._name = "Error";
			return packet;
		}
		static fromPacket(packet) {
			packet.readInt8();
			const code = packet.readInt16();
			packet.readString(1, "ascii");
			packet.readString(5, "ascii");
			const message = packet.readNullTerminatedString("utf8");
			const error = new Error$1();
			error.message = message;
			error.code = code;
			return error;
		}
	};
	exports.Error = Error$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/command.js
var require_command = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/command.js": ((exports, module) => {
	const EventEmitter$7 = __require("events").EventEmitter;
	const Timers$2 = __require("timers");
	var Command$11 = class extends EventEmitter$7 {
		constructor() {
			super();
			this.next = null;
		}
		stateName() {
			const state = this.next;
			for (const i$4 in this) if (this[i$4] === state && i$4 !== "next") return i$4;
			return "unknown name";
		}
		execute(packet, connection) {
			if (!this.next) {
				this.next = this.start;
				connection._resetSequenceId();
			}
			if (packet && packet.isError()) {
				const err = packet.asError(connection.clientEncoding);
				err.sql = this.sql || this.query;
				if (this.queryTimeout) {
					Timers$2.clearTimeout(this.queryTimeout);
					this.queryTimeout = null;
				}
				if (this.onResult) {
					this.onResult(err);
					this.emit("end");
				} else {
					this.emit("error", err);
					this.emit("end");
				}
				return true;
			}
			this.next = this.next(packet, connection);
			if (this.next) return false;
			this.emit("end");
			return true;
		}
	};
	module.exports = Command$11;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/sha256_password.js
var require_sha256_password = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/sha256_password.js": ((exports, module) => {
	const PLUGIN_NAME$1 = "sha256_password";
	const crypto$1 = __require("crypto");
	const { xorRotating: xorRotating$1 } = require_auth_41();
	const REQUEST_SERVER_KEY_PACKET$1 = Buffer.from([1]);
	const STATE_INITIAL$1 = 0;
	const STATE_WAIT_SERVER_KEY$1 = 1;
	const STATE_FINAL$1 = -1;
	function encrypt$1(password, scramble, key$1) {
		const stage1 = xorRotating$1(Buffer.from(`${password}\0`, "utf8"), scramble);
		return crypto$1.publicEncrypt(key$1, stage1);
	}
	module.exports = (pluginOptions = {}) => ({ connection }) => {
		let state = 0;
		let scramble = null;
		const password = connection.config.password;
		const authWithKey = (serverKey) => {
			const _password = encrypt$1(password, scramble, serverKey);
			state = STATE_FINAL$1;
			return _password;
		};
		return (data) => {
			switch (state) {
				case STATE_INITIAL$1:
					scramble = data.slice(0, 20);
					if (pluginOptions.serverPublicKey) return authWithKey(pluginOptions.serverPublicKey);
					state = STATE_WAIT_SERVER_KEY$1;
					return REQUEST_SERVER_KEY_PACKET$1;
				case STATE_WAIT_SERVER_KEY$1:
					if (pluginOptions.onServerPublicKey) pluginOptions.onServerPublicKey(data);
					return authWithKey(data);
				case STATE_FINAL$1: throw new Error(`Unexpected data in AuthMoreData packet received by ${PLUGIN_NAME$1} plugin in STATE_FINAL state.`);
			}
			throw new Error(`Unexpected data in AuthMoreData packet received by ${PLUGIN_NAME$1} plugin in state ${state}`);
		};
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/caching_sha2_password.js
var require_caching_sha2_password = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/caching_sha2_password.js": ((exports, module) => {
	const PLUGIN_NAME = "caching_sha2_password";
	const crypto = __require("crypto");
	const { xor, xorRotating } = require_auth_41();
	const REQUEST_SERVER_KEY_PACKET = Buffer.from([2]);
	const FAST_AUTH_SUCCESS_PACKET = Buffer.from([3]);
	const PERFORM_FULL_AUTHENTICATION_PACKET = Buffer.from([4]);
	const STATE_INITIAL = 0;
	const STATE_TOKEN_SENT = 1;
	const STATE_WAIT_SERVER_KEY = 2;
	const STATE_FINAL = -1;
	function sha256(msg) {
		const hash = crypto.createHash("sha256");
		hash.update(msg);
		return hash.digest();
	}
	function calculateToken(password, scramble) {
		if (!password) return Buffer.alloc(0);
		const stage1 = sha256(Buffer.from(password));
		const stage2 = sha256(stage1);
		return xor(stage1, sha256(Buffer.concat([stage2, scramble])));
	}
	function encrypt(password, scramble, key$1) {
		const stage1 = xorRotating(Buffer.from(`${password}\0`, "utf8"), scramble);
		return crypto.publicEncrypt({
			key: key$1,
			padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
		}, stage1);
	}
	module.exports = (pluginOptions = {}) => ({ connection }) => {
		let state = 0;
		let scramble = null;
		const password = connection.config.password;
		const authWithKey = (serverKey) => {
			const _password = encrypt(password, scramble, serverKey);
			state = STATE_FINAL;
			return _password;
		};
		return (data) => {
			switch (state) {
				case STATE_INITIAL:
					scramble = data.slice(0, 20);
					state = STATE_TOKEN_SENT;
					return calculateToken(password, scramble);
				case STATE_TOKEN_SENT:
					if (FAST_AUTH_SUCCESS_PACKET.equals(data)) {
						state = STATE_FINAL;
						return null;
					}
					if (PERFORM_FULL_AUTHENTICATION_PACKET.equals(data)) {
						if (typeof pluginOptions.overrideIsSecure === "undefined" ? connection.config.ssl || connection.config.socketPath : pluginOptions.overrideIsSecure) {
							state = STATE_FINAL;
							return Buffer.from(`${password}\0`, "utf8");
						}
						if (pluginOptions.serverPublicKey) return authWithKey(pluginOptions.serverPublicKey);
						state = STATE_WAIT_SERVER_KEY;
						return REQUEST_SERVER_KEY_PACKET;
					}
					throw new Error(`Invalid AuthMoreData packet received by ${PLUGIN_NAME} plugin in STATE_TOKEN_SENT state.`);
				case STATE_WAIT_SERVER_KEY:
					if (pluginOptions.onServerPublicKey) pluginOptions.onServerPublicKey(data);
					return authWithKey(data);
				case STATE_FINAL: throw new Error(`Unexpected data in AuthMoreData packet received by ${PLUGIN_NAME} plugin in STATE_FINAL state.`);
			}
			throw new Error(`Unexpected data in AuthMoreData packet received by ${PLUGIN_NAME} plugin in state ${state}`);
		};
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/mysql_native_password.js
var require_mysql_native_password = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/mysql_native_password.js": ((exports, module) => {
	const auth41$1 = require_auth_41();
	module.exports = (pluginOptions) => ({ connection, command }) => {
		const password = command.password || pluginOptions.password || connection.config.password;
		const passwordSha1 = command.passwordSha1 || pluginOptions.passwordSha1 || connection.config.passwordSha1;
		return (data) => {
			const authPluginData1 = data.slice(0, 8);
			const authPluginData2 = data.slice(8, 20);
			let authToken;
			if (passwordSha1) authToken = auth41$1.calculateTokenFromPasswordSha(passwordSha1, authPluginData1, authPluginData2);
			else authToken = auth41$1.calculateToken(password, authPluginData1, authPluginData2);
			return authToken;
		};
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/mysql_clear_password.js
var require_mysql_clear_password = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/auth_plugins/mysql_clear_password.js": ((exports, module) => {
	function bufferFromStr(str) {
		return Buffer.from(`${str}\0`);
	}
	const create_mysql_clear_password_plugin = (pluginOptions) => function mysql_clear_password_plugin({ connection, command }) {
		const password = command.password || pluginOptions.password || connection.config.password;
		return function() {
			return bufferFromStr(password);
		};
	};
	module.exports = create_mysql_clear_password_plugin;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/auth_switch.js
var require_auth_switch = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/auth_switch.js": ((exports, module) => {
	const Packets$10 = require_packets();
	const sha256_password = require_sha256_password();
	const caching_sha2_password = require_caching_sha2_password();
	const mysql_native_password = require_mysql_native_password();
	const mysql_clear_password = require_mysql_clear_password();
	const standardAuthPlugins = {
		sha256_password: sha256_password({}),
		caching_sha2_password: caching_sha2_password({}),
		mysql_native_password: mysql_native_password({}),
		mysql_clear_password: mysql_clear_password({})
	};
	function warnLegacyAuthSwitch() {
		console.warn("WARNING! authSwitchHandler api is deprecated, please use new authPlugins api");
	}
	function authSwitchPluginError(error, command) {
		error.code = "AUTH_SWITCH_PLUGIN_ERROR";
		error.fatal = true;
		command.emit("error", error);
	}
	function authSwitchRequest(packet, connection, command) {
		const { pluginName, pluginData } = Packets$10.AuthSwitchRequest.fromPacket(packet);
		let authPlugin = connection.config.authPlugins && connection.config.authPlugins[pluginName];
		if (connection.config.authSwitchHandler && pluginName !== "mysql_native_password") {
			const legacySwitchHandler = connection.config.authSwitchHandler;
			warnLegacyAuthSwitch();
			legacySwitchHandler({
				pluginName,
				pluginData
			}, (err, data) => {
				if (err) return authSwitchPluginError(err, command);
				connection.writePacket(new Packets$10.AuthSwitchResponse(data).toPacket());
			});
			return;
		}
		if (!authPlugin) authPlugin = standardAuthPlugins[pluginName];
		if (!authPlugin) throw new Error(`Server requests authentication using unknown plugin ${pluginName}. See TODO: add plugins doco here on how to configure or author authentication plugins.`);
		connection._authPlugin = authPlugin({
			connection,
			command
		});
		Promise.resolve(connection._authPlugin(pluginData)).then((data) => {
			if (data) connection.writePacket(new Packets$10.AuthSwitchResponse(data).toPacket());
		}).catch((err) => {
			authSwitchPluginError(err, command);
		});
	}
	function authSwitchRequestMoreData(packet, connection, command) {
		const { data } = Packets$10.AuthSwitchRequestMoreData.fromPacket(packet);
		if (connection.config.authSwitchHandler) {
			const legacySwitchHandler = connection.config.authSwitchHandler;
			warnLegacyAuthSwitch();
			legacySwitchHandler({ pluginData: data }, (err, data$1) => {
				if (err) return authSwitchPluginError(err, command);
				connection.writePacket(new Packets$10.AuthSwitchResponse(data$1).toPacket());
			});
			return;
		}
		if (!connection._authPlugin) throw new Error("AuthPluginMoreData received but no auth plugin instance found");
		Promise.resolve(connection._authPlugin(data)).then((data$1) => {
			if (data$1) connection.writePacket(new Packets$10.AuthSwitchResponse(data$1).toPacket());
		}).catch((err) => {
			authSwitchPluginError(err, command);
		});
	}
	module.exports = {
		authSwitchRequest,
		authSwitchRequestMoreData
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/seq-queue@0.0.5/node_modules/seq-queue/lib/seq-queue.js
var require_seq_queue$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/seq-queue@0.0.5/node_modules/seq-queue/lib/seq-queue.js": ((exports, module) => {
	var EventEmitter$6 = __require("events").EventEmitter;
	var util$1 = __require("util");
	var DEFAULT_TIMEOUT = 3e3;
	var INIT_ID = 0;
	var EVENT_CLOSED = "closed";
	var EVENT_DRAINED = "drained";
	/**
	* Instance a new queue
	*
	* @param {Number} timeout a global timeout for new queue
	* @class
	* @constructor
	*/
	var SeqQueue = function(timeout) {
		EventEmitter$6.call(this);
		if (timeout && timeout > 0) this.timeout = timeout;
		else this.timeout = DEFAULT_TIMEOUT;
		this.status = SeqQueueManager.STATUS_IDLE;
		this.curId = INIT_ID;
		this.queue = [];
	};
	util$1.inherits(SeqQueue, EventEmitter$6);
	/**
	* Add a task into queue.
	* 
	* @param fn new request
	* @param ontimeout callback when task timeout
	* @param timeout timeout for current request. take the global timeout if this is invalid
	* @returns true or false
	*/
	SeqQueue.prototype.push = function(fn, ontimeout, timeout) {
		if (this.status !== SeqQueueManager.STATUS_IDLE && this.status !== SeqQueueManager.STATUS_BUSY) return false;
		if (typeof fn !== "function") throw new Error("fn should be a function.");
		this.queue.push({
			fn,
			ontimeout,
			timeout
		});
		if (this.status === SeqQueueManager.STATUS_IDLE) {
			this.status = SeqQueueManager.STATUS_BUSY;
			var self$1 = this;
			process.nextTick(function() {
				self$1._next(self$1.curId);
			});
		}
		return true;
	};
	/**
	* Close queue
	* 
	* @param {Boolean} force if true will close the queue immediately else will execute the rest task in queue
	*/
	SeqQueue.prototype.close = function(force) {
		if (this.status !== SeqQueueManager.STATUS_IDLE && this.status !== SeqQueueManager.STATUS_BUSY) return;
		if (force) {
			this.status = SeqQueueManager.STATUS_DRAINED;
			if (this.timerId) {
				clearTimeout(this.timerId);
				this.timerId = void 0;
			}
			this.emit(EVENT_DRAINED);
		} else {
			this.status = SeqQueueManager.STATUS_CLOSED;
			this.emit(EVENT_CLOSED);
		}
	};
	/**
	* Invoke next task
	* 
	* @param {String|Number} tid last executed task id
	* @api private
	*/
	SeqQueue.prototype._next = function(tid) {
		if (tid !== this.curId || this.status !== SeqQueueManager.STATUS_BUSY && this.status !== SeqQueueManager.STATUS_CLOSED) return;
		if (this.timerId) {
			clearTimeout(this.timerId);
			this.timerId = void 0;
		}
		var task = this.queue.shift();
		if (!task) {
			if (this.status === SeqQueueManager.STATUS_BUSY) {
				this.status = SeqQueueManager.STATUS_IDLE;
				this.curId++;
			} else {
				this.status = SeqQueueManager.STATUS_DRAINED;
				this.emit(EVENT_DRAINED);
			}
			return;
		}
		var self$1 = this;
		task.id = ++this.curId;
		var timeout = task.timeout > 0 ? task.timeout : this.timeout;
		timeout = timeout > 0 ? timeout : DEFAULT_TIMEOUT;
		this.timerId = setTimeout(function() {
			process.nextTick(function() {
				self$1._next(task.id);
			});
			self$1.emit("timeout", task);
			if (task.ontimeout) task.ontimeout();
		}, timeout);
		try {
			task.fn({ done: function() {
				var res = task.id === self$1.curId;
				process.nextTick(function() {
					self$1._next(task.id);
				});
				return res;
			} });
		} catch (err) {
			self$1.emit("error", err, task);
			process.nextTick(function() {
				self$1._next(task.id);
			});
		}
	};
	/**
	* Queue manager.
	* 
	* @module
	*/
	var SeqQueueManager = module.exports;
	/**
	* Queue status: idle, welcome new tasks
	*
	* @const
	* @type {Number}
	* @memberOf SeqQueueManager
	*/
	SeqQueueManager.STATUS_IDLE = 0;
	/**
	* Queue status: busy, queue is working for some tasks now
	*
	* @const
	* @type {Number}
	* @memberOf SeqQueueManager
	*/
	SeqQueueManager.STATUS_BUSY = 1;
	/**
	* Queue status: closed, queue has closed and would not receive task any more 
	* 					and is processing the remaining tasks now.
	*
	* @const
	* @type {Number}
	* @memberOf SeqQueueManager
	*/
	SeqQueueManager.STATUS_CLOSED = 2;
	/**
	* Queue status: drained, queue is ready to be destroy
	*
	* @const
	* @type {Number}
	* @memberOf SeqQueueManager
	*/
	SeqQueueManager.STATUS_DRAINED = 3;
	/**
	* Create Sequence queue
	* 
	* @param  {Number} timeout a global timeout for the new queue instance
	* @return {Object}         new queue instance
	* @memberOf SeqQueueManager
	*/
	SeqQueueManager.createQueue = function(timeout) {
		return new SeqQueue(timeout);
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/seq-queue@0.0.5/node_modules/seq-queue/index.js
var require_seq_queue = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/seq-queue@0.0.5/node_modules/seq-queue/index.js": ((exports, module) => {
	module.exports = require_seq_queue$1();
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/compressed_protocol.js
var require_compressed_protocol = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/compressed_protocol.js": ((exports, module) => {
	const zlib = __require("zlib");
	const PacketParser$1 = require_packet_parser();
	function handleCompressedPacket(packet) {
		const connection = this;
		const deflatedLength = packet.readInt24();
		const body = packet.readBuffer();
		if (deflatedLength !== 0) connection.inflateQueue.push((task) => {
			zlib.inflate(body, (err, data) => {
				if (err) {
					connection._handleNetworkError(err);
					return;
				}
				connection._bumpCompressedSequenceId(packet.numPackets);
				connection._inflatedPacketsParser.execute(data);
				task.done();
			});
		});
		else connection.inflateQueue.push((task) => {
			connection._bumpCompressedSequenceId(packet.numPackets);
			connection._inflatedPacketsParser.execute(body);
			task.done();
		});
	}
	function writeCompressed(buffer$1) {
		const MAX_COMPRESSED_LENGTH = 16777210;
		let start;
		if (buffer$1.length > MAX_COMPRESSED_LENGTH) {
			for (start = 0; start < buffer$1.length; start += MAX_COMPRESSED_LENGTH) writeCompressed.call(this, buffer$1.slice(start, start + MAX_COMPRESSED_LENGTH));
			return;
		}
		const connection = this;
		let packetLen = buffer$1.length;
		const compressHeader = Buffer.allocUnsafe(7);
		(function(seqId) {
			connection.deflateQueue.push((task) => {
				zlib.deflate(buffer$1, (err, compressed) => {
					if (err) {
						connection._handleFatalError(err);
						return;
					}
					let compressedLength = compressed.length;
					if (compressedLength < packetLen) {
						compressHeader.writeUInt8(compressedLength & 255, 0);
						compressHeader.writeUInt16LE(compressedLength >> 8, 1);
						compressHeader.writeUInt8(seqId, 3);
						compressHeader.writeUInt8(packetLen & 255, 4);
						compressHeader.writeUInt16LE(packetLen >> 8, 5);
						connection.writeUncompressed(compressHeader);
						connection.writeUncompressed(compressed);
					} else {
						compressedLength = packetLen;
						packetLen = 0;
						compressHeader.writeUInt8(compressedLength & 255, 0);
						compressHeader.writeUInt16LE(compressedLength >> 8, 1);
						compressHeader.writeUInt8(seqId, 3);
						compressHeader.writeUInt8(packetLen & 255, 4);
						compressHeader.writeUInt16LE(packetLen >> 8, 5);
						connection.writeUncompressed(compressHeader);
						connection.writeUncompressed(buffer$1);
					}
					task.done();
				});
			});
		})(connection.compressedSequenceId);
		connection._bumpCompressedSequenceId(1);
	}
	function enableCompression(connection) {
		connection._lastWrittenPacketId = 0;
		connection._lastReceivedPacketId = 0;
		connection._handleCompressedPacket = handleCompressedPacket;
		connection._inflatedPacketsParser = new PacketParser$1((p) => {
			connection.handlePacket(p);
		}, 4);
		connection._inflatedPacketsParser._lastPacket = 0;
		connection.packetParser = new PacketParser$1((packet) => {
			connection._handleCompressedPacket(packet);
		}, 7);
		connection.writeUncompressed = connection.write;
		connection.write = writeCompressed;
		const seqqueue = require_seq_queue();
		connection.inflateQueue = seqqueue.createQueue();
		connection.deflateQueue = seqqueue.createQueue();
	}
	module.exports = { enableCompression };
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/client_handshake.js
var require_client_handshake = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/client_handshake.js": ((exports, module) => {
	const Command$10 = require_command();
	const Packets$9 = require_packets();
	const ClientConstants$2 = require_client();
	const CharsetToEncoding$2 = require_charset_encodings();
	const auth41 = require_auth_41();
	function flagNames(flags) {
		const res = [];
		for (const c in ClientConstants$2) if (flags & ClientConstants$2[c]) res.push(c.replace(/_/g, " ").toLowerCase());
		return res;
	}
	var ClientHandshake$2 = class ClientHandshake$2 extends Command$10 {
		constructor(clientFlags) {
			super();
			this.handshake = null;
			this.clientFlags = clientFlags;
			this.authenticationFactor = 0;
		}
		start() {
			return ClientHandshake$2.prototype.handshakeInit;
		}
		sendSSLRequest(connection) {
			const sslRequest = new Packets$9.SSLRequest(this.clientFlags, connection.config.charsetNumber);
			connection.writePacket(sslRequest.toPacket());
		}
		sendCredentials(connection) {
			if (connection.config.debug) console.log("Sending handshake packet: flags:%d=(%s)", this.clientFlags, flagNames(this.clientFlags).join(", "));
			this.user = connection.config.user;
			this.password = connection.config.password;
			this.password1 = connection.config.password;
			this.password2 = connection.config.password2;
			this.password3 = connection.config.password3;
			this.passwordSha1 = connection.config.passwordSha1;
			this.database = connection.config.database;
			this.authPluginName = this.handshake.authPluginName;
			const handshakeResponse = new Packets$9.HandshakeResponse({
				flags: this.clientFlags,
				user: this.user,
				database: this.database,
				password: this.password,
				passwordSha1: this.passwordSha1,
				charsetNumber: connection.config.charsetNumber,
				authPluginData1: this.handshake.authPluginData1,
				authPluginData2: this.handshake.authPluginData2,
				compress: connection.config.compress,
				connectAttributes: connection.config.connectAttributes
			});
			connection.writePacket(handshakeResponse.toPacket());
		}
		calculateNativePasswordAuthToken(authPluginData) {
			const authPluginData1 = authPluginData.slice(0, 8);
			const authPluginData2 = authPluginData.slice(8, 20);
			let authToken;
			if (this.passwordSha1) authToken = auth41.calculateTokenFromPasswordSha(this.passwordSha1, authPluginData1, authPluginData2);
			else authToken = auth41.calculateToken(this.password, authPluginData1, authPluginData2);
			return authToken;
		}
		handshakeInit(helloPacket, connection) {
			this.on("error", (e) => {
				connection._fatalError = e;
				connection._protocolError = e;
			});
			this.handshake = Packets$9.Handshake.fromPacket(helloPacket);
			if (connection.config.debug) console.log("Server hello packet: capability flags:%d=(%s)", this.handshake.capabilityFlags, flagNames(this.handshake.capabilityFlags).join(", "));
			connection.serverCapabilityFlags = this.handshake.capabilityFlags;
			connection.serverEncoding = CharsetToEncoding$2[this.handshake.characterSet];
			connection.connectionId = this.handshake.connectionId;
			const serverSSLSupport = this.handshake.capabilityFlags & ClientConstants$2.SSL;
			const multiFactorAuthentication = this.handshake.capabilityFlags & ClientConstants$2.MULTI_FACTOR_AUTHENTICATION;
			this.clientFlags = this.clientFlags | multiFactorAuthentication;
			connection.config.compress = connection.config.compress && this.handshake.capabilityFlags & ClientConstants$2.COMPRESS;
			this.clientFlags = this.clientFlags | connection.config.compress;
			if (connection.config.ssl) {
				if (!serverSSLSupport) {
					const err = /* @__PURE__ */ new Error("Server does not support secure connection");
					err.code = "HANDSHAKE_NO_SSL_SUPPORT";
					err.fatal = true;
					this.emit("error", err);
					return false;
				}
				this.clientFlags |= ClientConstants$2.SSL;
				this.sendSSLRequest(connection);
				connection.startTLS((err) => {
					if (err) {
						err.code = "HANDSHAKE_SSL_ERROR";
						err.fatal = true;
						this.emit("error", err);
						return;
					}
					this.sendCredentials(connection);
				});
			} else this.sendCredentials(connection);
			if (multiFactorAuthentication) this.authenticationFactor = 1;
			return ClientHandshake$2.prototype.handshakeResult;
		}
		handshakeResult(packet, connection) {
			const marker = packet.peekByte();
			if (marker === 254 || marker === 1 || marker === 2) {
				const authSwitch = require_auth_switch();
				try {
					if (marker === 1) authSwitch.authSwitchRequestMoreData(packet, connection, this);
					else {
						if (this.authenticationFactor !== 0) {
							connection.config.password = this[`password${this.authenticationFactor}`];
							this.authenticationFactor += 1;
						}
						authSwitch.authSwitchRequest(packet, connection, this);
					}
					return ClientHandshake$2.prototype.handshakeResult;
				} catch (err) {
					err.code = "AUTH_SWITCH_PLUGIN_ERROR";
					err.fatal = true;
					if (this.onResult) this.onResult(err);
					else this.emit("error", err);
					return null;
				}
			}
			if (marker !== 0) {
				const err = /* @__PURE__ */ new Error("Unexpected packet during handshake phase");
				err.code = "HANDSHAKE_UNKNOWN_ERROR";
				err.fatal = true;
				if (this.onResult) this.onResult(err);
				else this.emit("error", err);
				return null;
			}
			if (!connection.authorized) {
				connection.authorized = true;
				if (connection.config.compress) {
					const enableCompression$1 = require_compressed_protocol().enableCompression;
					enableCompression$1(connection);
				}
			}
			if (this.onResult) this.onResult(null);
			return null;
		}
	};
	module.exports = ClientHandshake$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/server_handshake.js
var require_server_handshake = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/server_handshake.js": ((exports, module) => {
	const CommandCode$2 = require_commands$1();
	const Errors = require_errors();
	const Command$9 = require_command();
	const Packets$8 = require_packets();
	var ServerHandshake$1 = class ServerHandshake$1 extends Command$9 {
		constructor(args) {
			super();
			this.args = args;
		}
		start(packet, connection) {
			const serverHelloPacket = new Packets$8.Handshake(this.args);
			this.serverHello = serverHelloPacket;
			serverHelloPacket.setScrambleData((err) => {
				if (err) {
					connection.emit("error", /* @__PURE__ */ new Error("Error generating random bytes"));
					return;
				}
				connection.writePacket(serverHelloPacket.toPacket(0));
			});
			return ServerHandshake$1.prototype.readClientReply;
		}
		readClientReply(packet, connection) {
			const clientHelloReply = Packets$8.HandshakeResponse.fromPacket(packet);
			connection.clientHelloReply = clientHelloReply;
			if (this.args.authCallback) this.args.authCallback({
				user: clientHelloReply.user,
				database: clientHelloReply.database,
				address: connection.stream.remoteAddress,
				authPluginData1: this.serverHello.authPluginData1,
				authPluginData2: this.serverHello.authPluginData2,
				authToken: clientHelloReply.authToken
			}, (err, mysqlError) => {
				if (!mysqlError) connection.writeOk();
				else {
					connection.writeError({
						message: mysqlError.message || "",
						code: mysqlError.code || 1045
					});
					connection.close();
				}
			});
			else connection.writeOk();
			return ServerHandshake$1.prototype.dispatchCommands;
		}
		_isStatement(query, name) {
			return query.split(" ")[0].toUpperCase() === name;
		}
		dispatchCommands(packet, connection) {
			let knownCommand = true;
			const encoding = connection.clientHelloReply.encoding;
			const commandCode = packet.readInt8();
			switch (commandCode) {
				case CommandCode$2.STMT_PREPARE:
					if (connection.listeners("stmt_prepare").length) {
						const query = packet.readString(void 0, encoding);
						connection.emit("stmt_prepare", query);
					} else connection.writeError({
						code: Errors.HA_ERR_INTERNAL_ERROR,
						message: "No query handler for prepared statements."
					});
					break;
				case CommandCode$2.STMT_EXECUTE:
					if (connection.listeners("stmt_execute").length) {
						const { stmtId, flags, iterationCount, values } = Packets$8.Execute.fromPacket(packet, encoding);
						connection.emit("stmt_execute", stmtId, flags, iterationCount, values);
					} else connection.writeError({
						code: Errors.HA_ERR_INTERNAL_ERROR,
						message: "No query handler for execute statements."
					});
					break;
				case CommandCode$2.QUIT:
					if (connection.listeners("quit").length) connection.emit("quit");
					else connection.stream.end();
					break;
				case CommandCode$2.INIT_DB:
					if (connection.listeners("init_db").length) {
						const schemaName = packet.readString(void 0, encoding);
						connection.emit("init_db", schemaName);
					} else connection.writeOk();
					break;
				case CommandCode$2.QUERY:
					if (connection.listeners("query").length) {
						const query = packet.readString(void 0, encoding);
						if (this._isStatement(query, "PREPARE") || this._isStatement(query, "SET")) connection.emit("stmt_prepare", query);
						else if (this._isStatement(query, "EXECUTE")) connection.emit("stmt_execute", null, null, null, null, query);
						else connection.emit("query", query);
					} else connection.writeError({
						code: Errors.HA_ERR_INTERNAL_ERROR,
						message: "No query handler"
					});
					break;
				case CommandCode$2.FIELD_LIST:
					if (connection.listeners("field_list").length) {
						const table = packet.readNullTerminatedString(encoding);
						const fields$1 = packet.readString(void 0, encoding);
						connection.emit("field_list", table, fields$1);
					} else connection.writeError({
						code: Errors.ER_WARN_DEPRECATED_SYNTAX,
						message: "As of MySQL 5.7.11, COM_FIELD_LIST is deprecated and will be removed in a future version of MySQL."
					});
					break;
				case CommandCode$2.PING:
					if (connection.listeners("ping").length) connection.emit("ping");
					else connection.writeOk();
					break;
				default: knownCommand = false;
			}
			if (connection.listeners("packet").length) connection.emit("packet", packet.clone(), knownCommand, commandCode);
			else if (!knownCommand) console.log("Unknown command:", commandCode);
			return ServerHandshake$1.prototype.dispatchCommands;
		}
	};
	module.exports = ServerHandshake$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/charsets.js
var require_charsets = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/charsets.js": ((exports) => {
	exports.BIG5_CHINESE_CI = 1;
	exports.LATIN2_CZECH_CS = 2;
	exports.DEC8_SWEDISH_CI = 3;
	exports.CP850_GENERAL_CI = 4;
	exports.LATIN1_GERMAN1_CI = 5;
	exports.HP8_ENGLISH_CI = 6;
	exports.KOI8R_GENERAL_CI = 7;
	exports.LATIN1_SWEDISH_CI = 8;
	exports.LATIN2_GENERAL_CI = 9;
	exports.SWE7_SWEDISH_CI = 10;
	exports.ASCII_GENERAL_CI = 11;
	exports.UJIS_JAPANESE_CI = 12;
	exports.SJIS_JAPANESE_CI = 13;
	exports.CP1251_BULGARIAN_CI = 14;
	exports.LATIN1_DANISH_CI = 15;
	exports.HEBREW_GENERAL_CI = 16;
	exports.TIS620_THAI_CI = 18;
	exports.EUCKR_KOREAN_CI = 19;
	exports.LATIN7_ESTONIAN_CS = 20;
	exports.LATIN2_HUNGARIAN_CI = 21;
	exports.KOI8U_GENERAL_CI = 22;
	exports.CP1251_UKRAINIAN_CI = 23;
	exports.GB2312_CHINESE_CI = 24;
	exports.GREEK_GENERAL_CI = 25;
	exports.CP1250_GENERAL_CI = 26;
	exports.LATIN2_CROATIAN_CI = 27;
	exports.GBK_CHINESE_CI = 28;
	exports.CP1257_LITHUANIAN_CI = 29;
	exports.LATIN5_TURKISH_CI = 30;
	exports.LATIN1_GERMAN2_CI = 31;
	exports.ARMSCII8_GENERAL_CI = 32;
	exports.UTF8_GENERAL_CI = 33;
	exports.CP1250_CZECH_CS = 34;
	exports.UCS2_GENERAL_CI = 35;
	exports.CP866_GENERAL_CI = 36;
	exports.KEYBCS2_GENERAL_CI = 37;
	exports.MACCE_GENERAL_CI = 38;
	exports.MACROMAN_GENERAL_CI = 39;
	exports.CP852_GENERAL_CI = 40;
	exports.LATIN7_GENERAL_CI = 41;
	exports.LATIN7_GENERAL_CS = 42;
	exports.MACCE_BIN = 43;
	exports.CP1250_CROATIAN_CI = 44;
	exports.UTF8MB4_GENERAL_CI = 45;
	exports.UTF8MB4_BIN = 46;
	exports.LATIN1_BIN = 47;
	exports.LATIN1_GENERAL_CI = 48;
	exports.LATIN1_GENERAL_CS = 49;
	exports.CP1251_BIN = 50;
	exports.CP1251_GENERAL_CI = 51;
	exports.CP1251_GENERAL_CS = 52;
	exports.MACROMAN_BIN = 53;
	exports.UTF16_GENERAL_CI = 54;
	exports.UTF16_BIN = 55;
	exports.UTF16LE_GENERAL_CI = 56;
	exports.CP1256_GENERAL_CI = 57;
	exports.CP1257_BIN = 58;
	exports.CP1257_GENERAL_CI = 59;
	exports.UTF32_GENERAL_CI = 60;
	exports.UTF32_BIN = 61;
	exports.UTF16LE_BIN = 62;
	exports.BINARY = 63;
	exports.ARMSCII8_BIN = 64;
	exports.ASCII_BIN = 65;
	exports.CP1250_BIN = 66;
	exports.CP1256_BIN = 67;
	exports.CP866_BIN = 68;
	exports.DEC8_BIN = 69;
	exports.GREEK_BIN = 70;
	exports.HEBREW_BIN = 71;
	exports.HP8_BIN = 72;
	exports.KEYBCS2_BIN = 73;
	exports.KOI8R_BIN = 74;
	exports.KOI8U_BIN = 75;
	exports.UTF8_TOLOWER_CI = 76;
	exports.LATIN2_BIN = 77;
	exports.LATIN5_BIN = 78;
	exports.LATIN7_BIN = 79;
	exports.CP850_BIN = 80;
	exports.CP852_BIN = 81;
	exports.SWE7_BIN = 82;
	exports.UTF8_BIN = 83;
	exports.BIG5_BIN = 84;
	exports.EUCKR_BIN = 85;
	exports.GB2312_BIN = 86;
	exports.GBK_BIN = 87;
	exports.SJIS_BIN = 88;
	exports.TIS620_BIN = 89;
	exports.UCS2_BIN = 90;
	exports.UJIS_BIN = 91;
	exports.GEOSTD8_GENERAL_CI = 92;
	exports.GEOSTD8_BIN = 93;
	exports.LATIN1_SPANISH_CI = 94;
	exports.CP932_JAPANESE_CI = 95;
	exports.CP932_BIN = 96;
	exports.EUCJPMS_JAPANESE_CI = 97;
	exports.EUCJPMS_BIN = 98;
	exports.CP1250_POLISH_CI = 99;
	exports.UTF16_UNICODE_CI = 101;
	exports.UTF16_ICELANDIC_CI = 102;
	exports.UTF16_LATVIAN_CI = 103;
	exports.UTF16_ROMANIAN_CI = 104;
	exports.UTF16_SLOVENIAN_CI = 105;
	exports.UTF16_POLISH_CI = 106;
	exports.UTF16_ESTONIAN_CI = 107;
	exports.UTF16_SPANISH_CI = 108;
	exports.UTF16_SWEDISH_CI = 109;
	exports.UTF16_TURKISH_CI = 110;
	exports.UTF16_CZECH_CI = 111;
	exports.UTF16_DANISH_CI = 112;
	exports.UTF16_LITHUANIAN_CI = 113;
	exports.UTF16_SLOVAK_CI = 114;
	exports.UTF16_SPANISH2_CI = 115;
	exports.UTF16_ROMAN_CI = 116;
	exports.UTF16_PERSIAN_CI = 117;
	exports.UTF16_ESPERANTO_CI = 118;
	exports.UTF16_HUNGARIAN_CI = 119;
	exports.UTF16_SINHALA_CI = 120;
	exports.UTF16_GERMAN2_CI = 121;
	exports.UTF16_CROATIAN_CI = 122;
	exports.UTF16_UNICODE_520_CI = 123;
	exports.UTF16_VIETNAMESE_CI = 124;
	exports.UCS2_UNICODE_CI = 128;
	exports.UCS2_ICELANDIC_CI = 129;
	exports.UCS2_LATVIAN_CI = 130;
	exports.UCS2_ROMANIAN_CI = 131;
	exports.UCS2_SLOVENIAN_CI = 132;
	exports.UCS2_POLISH_CI = 133;
	exports.UCS2_ESTONIAN_CI = 134;
	exports.UCS2_SPANISH_CI = 135;
	exports.UCS2_SWEDISH_CI = 136;
	exports.UCS2_TURKISH_CI = 137;
	exports.UCS2_CZECH_CI = 138;
	exports.UCS2_DANISH_CI = 139;
	exports.UCS2_LITHUANIAN_CI = 140;
	exports.UCS2_SLOVAK_CI = 141;
	exports.UCS2_SPANISH2_CI = 142;
	exports.UCS2_ROMAN_CI = 143;
	exports.UCS2_PERSIAN_CI = 144;
	exports.UCS2_ESPERANTO_CI = 145;
	exports.UCS2_HUNGARIAN_CI = 146;
	exports.UCS2_SINHALA_CI = 147;
	exports.UCS2_GERMAN2_CI = 148;
	exports.UCS2_CROATIAN_CI = 149;
	exports.UCS2_UNICODE_520_CI = 150;
	exports.UCS2_VIETNAMESE_CI = 151;
	exports.UCS2_GENERAL_MYSQL500_CI = 159;
	exports.UTF32_UNICODE_CI = 160;
	exports.UTF32_ICELANDIC_CI = 161;
	exports.UTF32_LATVIAN_CI = 162;
	exports.UTF32_ROMANIAN_CI = 163;
	exports.UTF32_SLOVENIAN_CI = 164;
	exports.UTF32_POLISH_CI = 165;
	exports.UTF32_ESTONIAN_CI = 166;
	exports.UTF32_SPANISH_CI = 167;
	exports.UTF32_SWEDISH_CI = 168;
	exports.UTF32_TURKISH_CI = 169;
	exports.UTF32_CZECH_CI = 170;
	exports.UTF32_DANISH_CI = 171;
	exports.UTF32_LITHUANIAN_CI = 172;
	exports.UTF32_SLOVAK_CI = 173;
	exports.UTF32_SPANISH2_CI = 174;
	exports.UTF32_ROMAN_CI = 175;
	exports.UTF32_PERSIAN_CI = 176;
	exports.UTF32_ESPERANTO_CI = 177;
	exports.UTF32_HUNGARIAN_CI = 178;
	exports.UTF32_SINHALA_CI = 179;
	exports.UTF32_GERMAN2_CI = 180;
	exports.UTF32_CROATIAN_CI = 181;
	exports.UTF32_UNICODE_520_CI = 182;
	exports.UTF32_VIETNAMESE_CI = 183;
	exports.UTF8_UNICODE_CI = 192;
	exports.UTF8_ICELANDIC_CI = 193;
	exports.UTF8_LATVIAN_CI = 194;
	exports.UTF8_ROMANIAN_CI = 195;
	exports.UTF8_SLOVENIAN_CI = 196;
	exports.UTF8_POLISH_CI = 197;
	exports.UTF8_ESTONIAN_CI = 198;
	exports.UTF8_SPANISH_CI = 199;
	exports.UTF8_SWEDISH_CI = 200;
	exports.UTF8_TURKISH_CI = 201;
	exports.UTF8_CZECH_CI = 202;
	exports.UTF8_DANISH_CI = 203;
	exports.UTF8_LITHUANIAN_CI = 204;
	exports.UTF8_SLOVAK_CI = 205;
	exports.UTF8_SPANISH2_CI = 206;
	exports.UTF8_ROMAN_CI = 207;
	exports.UTF8_PERSIAN_CI = 208;
	exports.UTF8_ESPERANTO_CI = 209;
	exports.UTF8_HUNGARIAN_CI = 210;
	exports.UTF8_SINHALA_CI = 211;
	exports.UTF8_GERMAN2_CI = 212;
	exports.UTF8_CROATIAN_CI = 213;
	exports.UTF8_UNICODE_520_CI = 214;
	exports.UTF8_VIETNAMESE_CI = 215;
	exports.UTF8_GENERAL_MYSQL500_CI = 223;
	exports.UTF8MB4_UNICODE_CI = 224;
	exports.UTF8MB4_ICELANDIC_CI = 225;
	exports.UTF8MB4_LATVIAN_CI = 226;
	exports.UTF8MB4_ROMANIAN_CI = 227;
	exports.UTF8MB4_SLOVENIAN_CI = 228;
	exports.UTF8MB4_POLISH_CI = 229;
	exports.UTF8MB4_ESTONIAN_CI = 230;
	exports.UTF8MB4_SPANISH_CI = 231;
	exports.UTF8MB4_SWEDISH_CI = 232;
	exports.UTF8MB4_TURKISH_CI = 233;
	exports.UTF8MB4_CZECH_CI = 234;
	exports.UTF8MB4_DANISH_CI = 235;
	exports.UTF8MB4_LITHUANIAN_CI = 236;
	exports.UTF8MB4_SLOVAK_CI = 237;
	exports.UTF8MB4_SPANISH2_CI = 238;
	exports.UTF8MB4_ROMAN_CI = 239;
	exports.UTF8MB4_PERSIAN_CI = 240;
	exports.UTF8MB4_ESPERANTO_CI = 241;
	exports.UTF8MB4_HUNGARIAN_CI = 242;
	exports.UTF8MB4_SINHALA_CI = 243;
	exports.UTF8MB4_GERMAN2_CI = 244;
	exports.UTF8MB4_CROATIAN_CI = 245;
	exports.UTF8MB4_UNICODE_520_CI = 246;
	exports.UTF8MB4_VIETNAMESE_CI = 247;
	exports.GB18030_CHINESE_CI = 248;
	exports.GB18030_BIN = 249;
	exports.GB18030_UNICODE_520_CI = 250;
	exports.UTF8_GENERAL50_CI = 253;
	exports.UTF8MB4_0900_AI_CI = 255;
	exports.UTF8MB4_DE_PB_0900_AI_CI = 256;
	exports.UTF8MB4_IS_0900_AI_CI = 257;
	exports.UTF8MB4_LV_0900_AI_CI = 258;
	exports.UTF8MB4_RO_0900_AI_CI = 259;
	exports.UTF8MB4_SL_0900_AI_CI = 260;
	exports.UTF8MB4_PL_0900_AI_CI = 261;
	exports.UTF8MB4_ET_0900_AI_CI = 262;
	exports.UTF8MB4_ES_0900_AI_CI = 263;
	exports.UTF8MB4_SV_0900_AI_CI = 264;
	exports.UTF8MB4_TR_0900_AI_CI = 265;
	exports.UTF8MB4_CS_0900_AI_CI = 266;
	exports.UTF8MB4_DA_0900_AI_CI = 267;
	exports.UTF8MB4_LT_0900_AI_CI = 268;
	exports.UTF8MB4_SK_0900_AI_CI = 269;
	exports.UTF8MB4_ES_TRAD_0900_AI_CI = 270;
	exports.UTF8MB4_LA_0900_AI_CI = 271;
	exports.UTF8MB4_EO_0900_AI_CI = 273;
	exports.UTF8MB4_HU_0900_AI_CI = 274;
	exports.UTF8MB4_HR_0900_AI_CI = 275;
	exports.UTF8MB4_VI_0900_AI_CI = 277;
	exports.UTF8MB4_0900_AS_CS = 278;
	exports.UTF8MB4_DE_PB_0900_AS_CS = 279;
	exports.UTF8MB4_IS_0900_AS_CS = 280;
	exports.UTF8MB4_LV_0900_AS_CS = 281;
	exports.UTF8MB4_RO_0900_AS_CS = 282;
	exports.UTF8MB4_SL_0900_AS_CS = 283;
	exports.UTF8MB4_PL_0900_AS_CS = 284;
	exports.UTF8MB4_ET_0900_AS_CS = 285;
	exports.UTF8MB4_ES_0900_AS_CS = 286;
	exports.UTF8MB4_SV_0900_AS_CS = 287;
	exports.UTF8MB4_TR_0900_AS_CS = 288;
	exports.UTF8MB4_CS_0900_AS_CS = 289;
	exports.UTF8MB4_DA_0900_AS_CS = 290;
	exports.UTF8MB4_LT_0900_AS_CS = 291;
	exports.UTF8MB4_SK_0900_AS_CS = 292;
	exports.UTF8MB4_ES_TRAD_0900_AS_CS = 293;
	exports.UTF8MB4_LA_0900_AS_CS = 294;
	exports.UTF8MB4_EO_0900_AS_CS = 296;
	exports.UTF8MB4_HU_0900_AS_CS = 297;
	exports.UTF8MB4_HR_0900_AS_CS = 298;
	exports.UTF8MB4_VI_0900_AS_CS = 300;
	exports.UTF8MB4_JA_0900_AS_CS = 303;
	exports.UTF8MB4_JA_0900_AS_CS_KS = 304;
	exports.UTF8MB4_0900_AS_CI = 305;
	exports.UTF8MB4_RU_0900_AI_CI = 306;
	exports.UTF8MB4_RU_0900_AS_CS = 307;
	exports.UTF8MB4_ZH_0900_AS_CS = 308;
	exports.UTF8MB4_0900_BIN = 309;
	exports.BIG5 = exports.BIG5_CHINESE_CI;
	exports.DEC8 = exports.DEC8_SWEDISH_CI;
	exports.CP850 = exports.CP850_GENERAL_CI;
	exports.HP8 = exports.HP8_ENGLISH_CI;
	exports.KOI8R = exports.KOI8R_GENERAL_CI;
	exports.LATIN1 = exports.LATIN1_SWEDISH_CI;
	exports.LATIN2 = exports.LATIN2_GENERAL_CI;
	exports.SWE7 = exports.SWE7_SWEDISH_CI;
	exports.ASCII = exports.ASCII_GENERAL_CI;
	exports.UJIS = exports.UJIS_JAPANESE_CI;
	exports.SJIS = exports.SJIS_JAPANESE_CI;
	exports.HEBREW = exports.HEBREW_GENERAL_CI;
	exports.TIS620 = exports.TIS620_THAI_CI;
	exports.EUCKR = exports.EUCKR_KOREAN_CI;
	exports.KOI8U = exports.KOI8U_GENERAL_CI;
	exports.GB2312 = exports.GB2312_CHINESE_CI;
	exports.GREEK = exports.GREEK_GENERAL_CI;
	exports.CP1250 = exports.CP1250_GENERAL_CI;
	exports.GBK = exports.GBK_CHINESE_CI;
	exports.LATIN5 = exports.LATIN5_TURKISH_CI;
	exports.ARMSCII8 = exports.ARMSCII8_GENERAL_CI;
	exports.UTF8 = exports.UTF8_GENERAL_CI;
	exports.UCS2 = exports.UCS2_GENERAL_CI;
	exports.CP866 = exports.CP866_GENERAL_CI;
	exports.KEYBCS2 = exports.KEYBCS2_GENERAL_CI;
	exports.MACCE = exports.MACCE_GENERAL_CI;
	exports.MACROMAN = exports.MACROMAN_GENERAL_CI;
	exports.CP852 = exports.CP852_GENERAL_CI;
	exports.LATIN7 = exports.LATIN7_GENERAL_CI;
	exports.UTF8MB4 = exports.UTF8MB4_GENERAL_CI;
	exports.CP1251 = exports.CP1251_GENERAL_CI;
	exports.UTF16 = exports.UTF16_GENERAL_CI;
	exports.UTF16LE = exports.UTF16LE_GENERAL_CI;
	exports.CP1256 = exports.CP1256_GENERAL_CI;
	exports.CP1257 = exports.CP1257_GENERAL_CI;
	exports.UTF32 = exports.UTF32_GENERAL_CI;
	exports.CP932 = exports.CP932_JAPANESE_CI;
	exports.EUCJPMS = exports.EUCJPMS_JAPANESE_CI;
	exports.GB18030 = exports.GB18030_CHINESE_CI;
	exports.GEOSTD8 = exports.GEOSTD8_GENERAL_CI;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/helpers.js
var require_helpers = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/helpers.js": ((exports) => {
	function srcEscape(str) {
		return JSON.stringify({ [str]: 1 }).slice(1, -3);
	}
	exports.srcEscape = srcEscape;
	let highlightFn;
	let cardinalRecommended = false;
	try {
		highlightFn = __require("cardinal").highlight;
	} catch (err) {
		highlightFn = (text) => {
			if (!cardinalRecommended) {
				console.log("For nicer debug output consider install cardinal@^2.0.0");
				cardinalRecommended = true;
			}
			return text;
		};
	}
	/**
	* Prints debug message with code frame, will try to use `cardinal` if available.
	*/
	function printDebugWithCode(msg, code) {
		console.log(`\n\n${msg}:\n`);
		console.log(`${highlightFn(code)}\n`);
	}
	exports.printDebugWithCode = printDebugWithCode;
	/**
	* checks whether the `type` is in the `list`
	*/
	function typeMatch(type, list, Types$7) {
		if (Array.isArray(list)) return list.some((t) => type === Types$7[t]);
		return !!list;
	}
	exports.typeMatch = typeMatch;
	const privateObjectProps = new Set([
		"__defineGetter__",
		"__defineSetter__",
		"__lookupGetter__",
		"__lookupSetter__",
		"__proto__"
	]);
	exports.privateObjectProps = privateObjectProps;
	const fieldEscape = (field, isEval = true) => {
		if (privateObjectProps.has(field)) throw new Error(`The field name (${field}) can't be the same as an object's private property.`);
		return isEval ? srcEscape(field) : field;
	};
	exports.fieldEscape = fieldEscape;
}) });

//#endregion
//#region ../../node_modules/.pnpm/is-property@1.0.2/node_modules/is-property/is-property.js
var require_is_property = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/is-property@1.0.2/node_modules/is-property/is-property.js": ((exports, module) => {
	function isProperty$1(str) {
		return /^[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/.test(str);
	}
	module.exports = isProperty$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/generate-function@2.3.1/node_modules/generate-function/index.js
var require_generate_function = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/generate-function@2.3.1/node_modules/generate-function/index.js": ((exports, module) => {
	var util = __require("util");
	var isProperty = require_is_property();
	var INDENT_START = /[\{\[]/;
	var INDENT_END = /[\}\]]/;
	var RESERVED = [
		"do",
		"if",
		"in",
		"for",
		"let",
		"new",
		"try",
		"var",
		"case",
		"else",
		"enum",
		"eval",
		"null",
		"this",
		"true",
		"void",
		"with",
		"await",
		"break",
		"catch",
		"class",
		"const",
		"false",
		"super",
		"throw",
		"while",
		"yield",
		"delete",
		"export",
		"import",
		"public",
		"return",
		"static",
		"switch",
		"typeof",
		"default",
		"extends",
		"finally",
		"package",
		"private",
		"continue",
		"debugger",
		"function",
		"arguments",
		"interface",
		"protected",
		"implements",
		"instanceof",
		"NaN",
		"undefined"
	];
	var RESERVED_MAP = {};
	for (var i = 0; i < RESERVED.length; i++) RESERVED_MAP[RESERVED[i]] = true;
	var isVariable = function(name) {
		return isProperty(name) && !RESERVED_MAP.hasOwnProperty(name);
	};
	var formats = {
		s: function(s) {
			return "" + s;
		},
		d: function(d) {
			return "" + Number(d);
		},
		o: function(o) {
			return JSON.stringify(o);
		}
	};
	var genfun = function() {
		var lines = [];
		var indent = 0;
		var vars = {};
		var push = function(str) {
			var spaces = "";
			while (spaces.length < indent * 2) spaces += "  ";
			lines.push(spaces + str);
		};
		var pushLine = function(line$1) {
			if (INDENT_END.test(line$1.trim()[0]) && INDENT_START.test(line$1[line$1.length - 1])) {
				indent--;
				push(line$1);
				indent++;
				return;
			}
			if (INDENT_START.test(line$1[line$1.length - 1])) {
				push(line$1);
				indent++;
				return;
			}
			if (INDENT_END.test(line$1.trim()[0])) {
				indent--;
				push(line$1);
				return;
			}
			push(line$1);
		};
		var line = function(fmt) {
			if (!fmt) return line;
			if (arguments.length === 1 && fmt.indexOf("\n") > -1) {
				var lines$1 = fmt.trim().split("\n");
				for (var i$4 = 0; i$4 < lines$1.length; i$4++) pushLine(lines$1[i$4].trim());
			} else pushLine(util.format.apply(util, arguments));
			return line;
		};
		line.scope = {};
		line.formats = formats;
		line.sym = function(name) {
			if (!name || !isVariable(name)) name = "tmp";
			if (!vars[name]) vars[name] = 0;
			return name + (vars[name]++ || "");
		};
		line.property = function(obj, name) {
			if (arguments.length === 1) {
				name = obj;
				obj = "";
			}
			name = name + "";
			if (isProperty(name)) return obj ? obj + "." + name : name;
			return obj ? obj + "[" + JSON.stringify(name) + "]" : JSON.stringify(name);
		};
		line.toString = function() {
			return lines.join("\n");
		};
		line.toFunction = function(scope) {
			if (!scope) scope = {};
			var src = "return (" + line.toString() + ")";
			Object.keys(line.scope).forEach(function(key$1) {
				if (!scope[key$1]) scope[key$1] = line.scope[key$1];
			});
			var keys$1 = Object.keys(scope).map(function(key$1) {
				return key$1;
			});
			var vals = keys$1.map(function(key$1) {
				return scope[key$1];
			});
			return Function.apply(null, keys$1.concat(src)).apply(null, vals);
		};
		if (arguments.length) line.apply(null, arguments);
		return line;
	};
	genfun.formats = formats;
	module.exports = genfun;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/text_parser.js
var require_text_parser = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/text_parser.js": ((exports, module) => {
	const Types$3 = require_types();
	const Charsets$4 = require_charsets();
	const helpers$3 = require_helpers();
	const genFunc$1 = require_generate_function();
	const parserCache$2 = require_parser_cache();
	const typeNames$3 = [];
	for (const t in Types$3) typeNames$3[Types$3[t]] = t;
	function readCodeFor$1(type, charset, encodingExpr, config, options) {
		const supportBigNumbers = Boolean(options.supportBigNumbers || config.supportBigNumbers);
		const bigNumberStrings = Boolean(options.bigNumberStrings || config.bigNumberStrings);
		const timezone = options.timezone || config.timezone;
		const dateStrings = options.dateStrings || config.dateStrings;
		switch (type) {
			case Types$3.TINY:
			case Types$3.SHORT:
			case Types$3.LONG:
			case Types$3.INT24:
			case Types$3.YEAR: return "packet.parseLengthCodedIntNoBigCheck()";
			case Types$3.LONGLONG:
				if (supportBigNumbers && bigNumberStrings) return "packet.parseLengthCodedIntString()";
				return `packet.parseLengthCodedInt(${supportBigNumbers})`;
			case Types$3.FLOAT:
			case Types$3.DOUBLE: return "packet.parseLengthCodedFloat()";
			case Types$3.NULL: return "packet.readLengthCodedNumber()";
			case Types$3.DECIMAL:
			case Types$3.NEWDECIMAL:
				if (config.decimalNumbers) return "packet.parseLengthCodedFloat()";
				return "packet.readLengthCodedString(\"ascii\")";
			case Types$3.DATE:
				if (helpers$3.typeMatch(type, dateStrings, Types$3)) return "packet.readLengthCodedString(\"ascii\")";
				return `packet.parseDate(${helpers$3.srcEscape(timezone)})`;
			case Types$3.DATETIME:
			case Types$3.TIMESTAMP:
				if (helpers$3.typeMatch(type, dateStrings, Types$3)) return "packet.readLengthCodedString(\"ascii\")";
				return `packet.parseDateTime(${helpers$3.srcEscape(timezone)})`;
			case Types$3.TIME: return "packet.readLengthCodedString(\"ascii\")";
			case Types$3.GEOMETRY: return "packet.parseGeometryValue()";
			case Types$3.VECTOR: return "packet.parseVector()";
			case Types$3.JSON: return config.jsonStrings ? "packet.readLengthCodedString(\"utf8\")" : "JSON.parse(packet.readLengthCodedString(\"utf8\"))";
			default:
				if (charset === Charsets$4.BINARY) return "packet.readLengthCodedBuffer()";
				return `packet.readLengthCodedString(${encodingExpr})`;
		}
	}
	function compile$1(fields$1, options, config) {
		if (typeof config.typeCast === "function" && typeof options.typeCast !== "function") options.typeCast = config.typeCast;
		function wrap(field, _this) {
			return {
				type: typeNames$3[field.columnType],
				length: field.columnLength,
				db: field.schema,
				table: field.table,
				name: field.name,
				string: function(encoding = field.encoding) {
					if (field.columnType === Types$3.JSON && encoding === field.encoding) console.warn(`typeCast: JSON column "${field.name}" is interpreted as BINARY by default, recommended to manually set utf8 encoding: \`field.string("utf8")\``);
					return _this.packet.readLengthCodedString(encoding);
				},
				buffer: function() {
					return _this.packet.readLengthCodedBuffer();
				},
				geometry: function() {
					return _this.packet.parseGeometryValue();
				}
			};
		}
		const parserFn = genFunc$1();
		parserFn("(function () {")("return class TextRow {");
		parserFn("constructor(fields) {");
		if (typeof options.typeCast === "function") {
			parserFn("const _this = this;");
			parserFn("for(let i=0; i<fields.length; ++i) {");
			parserFn("this[`wrap${i}`] = wrap(fields[i], _this);");
			parserFn("}");
		}
		parserFn("}");
		parserFn("next(packet, fields, options) {");
		parserFn("this.packet = packet;");
		if (options.rowsAsArray) parserFn(`const result = new Array(${fields$1.length});`);
		else parserFn("const result = {};");
		const resultTables = {};
		let resultTablesArray = [];
		if (options.nestTables === true) {
			for (let i$4 = 0; i$4 < fields$1.length; i$4++) resultTables[fields$1[i$4].table] = 1;
			resultTablesArray = Object.keys(resultTables);
			for (let i$4 = 0; i$4 < resultTablesArray.length; i$4++) parserFn(`result[${helpers$3.fieldEscape(resultTablesArray[i$4])}] = {};`);
		}
		let lvalue = "";
		let fieldName = "";
		let tableName = "";
		for (let i$4 = 0; i$4 < fields$1.length; i$4++) {
			fieldName = helpers$3.fieldEscape(fields$1[i$4].name);
			if (typeof options.nestTables === "string") lvalue = `result[${helpers$3.fieldEscape(fields$1[i$4].table + options.nestTables + fields$1[i$4].name)}]`;
			else if (options.nestTables === true) {
				tableName = helpers$3.fieldEscape(fields$1[i$4].table);
				parserFn(`if (!result[${tableName}]) result[${tableName}] = {};`);
				lvalue = `result[${tableName}][${fieldName}]`;
			} else if (options.rowsAsArray) lvalue = `result[${i$4.toString(10)}]`;
			else lvalue = `result[${fieldName}]`;
			if (options.typeCast === false) parserFn(`${lvalue} = packet.readLengthCodedBuffer();`);
			else {
				const encodingExpr = `fields[${i$4}].encoding`;
				const readCode = readCodeFor$1(fields$1[i$4].columnType, fields$1[i$4].characterSet, encodingExpr, config, options);
				if (typeof options.typeCast === "function") parserFn(`${lvalue} = options.typeCast(this.wrap${i$4}, function() { return ${readCode} });`);
				else parserFn(`${lvalue} = ${readCode};`);
			}
		}
		parserFn("return result;");
		parserFn("}");
		parserFn("};")("})()");
		if (config.debug) helpers$3.printDebugWithCode("Compiled text protocol row parser", parserFn.toString());
		if (typeof options.typeCast === "function") return parserFn.toFunction({ wrap });
		return parserFn.toFunction();
	}
	function getTextParser$2(fields$1, options, config) {
		return parserCache$2.getParser("text", fields$1, options, config, compile$1);
	}
	module.exports = getTextParser$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/static_text_parser.js
var require_static_text_parser = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/static_text_parser.js": ((exports, module) => {
	const Types$2 = require_types();
	const Charsets$3 = require_charsets();
	const helpers$2 = require_helpers();
	const typeNames$2 = [];
	for (const t in Types$2) typeNames$2[Types$2[t]] = t;
	function readField({ packet, type, charset, encoding, config, options }) {
		const supportBigNumbers = Boolean(options.supportBigNumbers || config.supportBigNumbers);
		const bigNumberStrings = Boolean(options.bigNumberStrings || config.bigNumberStrings);
		const timezone = options.timezone || config.timezone;
		const dateStrings = options.dateStrings || config.dateStrings;
		switch (type) {
			case Types$2.TINY:
			case Types$2.SHORT:
			case Types$2.LONG:
			case Types$2.INT24:
			case Types$2.YEAR: return packet.parseLengthCodedIntNoBigCheck();
			case Types$2.LONGLONG:
				if (supportBigNumbers && bigNumberStrings) return packet.parseLengthCodedIntString();
				return packet.parseLengthCodedInt(supportBigNumbers);
			case Types$2.FLOAT:
			case Types$2.DOUBLE: return packet.parseLengthCodedFloat();
			case Types$2.NULL:
			case Types$2.DECIMAL:
			case Types$2.NEWDECIMAL:
				if (config.decimalNumbers) return packet.parseLengthCodedFloat();
				return packet.readLengthCodedString("ascii");
			case Types$2.DATE:
				if (helpers$2.typeMatch(type, dateStrings, Types$2)) return packet.readLengthCodedString("ascii");
				return packet.parseDate(timezone);
			case Types$2.DATETIME:
			case Types$2.TIMESTAMP:
				if (helpers$2.typeMatch(type, dateStrings, Types$2)) return packet.readLengthCodedString("ascii");
				return packet.parseDateTime(timezone);
			case Types$2.TIME: return packet.readLengthCodedString("ascii");
			case Types$2.GEOMETRY: return packet.parseGeometryValue();
			case Types$2.VECTOR: return packet.parseVector();
			case Types$2.JSON: return config.jsonStrings ? packet.readLengthCodedString("utf8") : JSON.parse(packet.readLengthCodedString("utf8"));
			default:
				if (charset === Charsets$3.BINARY) return packet.readLengthCodedBuffer();
				return packet.readLengthCodedString(encoding);
		}
	}
	function createTypecastField(field, packet) {
		return {
			type: typeNames$2[field.columnType],
			length: field.columnLength,
			db: field.schema,
			table: field.table,
			name: field.name,
			string: function(encoding = field.encoding) {
				if (field.columnType === Types$2.JSON && encoding === field.encoding) console.warn(`typeCast: JSON column "${field.name}" is interpreted as BINARY by default, recommended to manually set utf8 encoding: \`field.string("utf8")\``);
				return packet.readLengthCodedString(encoding);
			},
			buffer: function() {
				return packet.readLengthCodedBuffer();
			},
			geometry: function() {
				return packet.parseGeometryValue();
			}
		};
	}
	function getTextParser$1(_fields, _options, config) {
		return { next(packet, fields$1, options) {
			const result = options.rowsAsArray ? [] : {};
			for (let i$4 = 0; i$4 < fields$1.length; i$4++) {
				const field = fields$1[i$4];
				const typeCast = options.typeCast ? options.typeCast : config.typeCast;
				const next = () => readField({
					packet,
					type: field.columnType,
					encoding: field.encoding,
					charset: field.characterSet,
					config,
					options
				});
				let value;
				if (options.typeCast === false) value = packet.readLengthCodedBuffer();
				else if (typeof typeCast === "function") value = typeCast(createTypecastField(field, packet), next);
				else value = next();
				if (options.rowsAsArray) result.push(value);
				else if (typeof options.nestTables === "string") result[`${helpers$2.fieldEscape(field.table, false)}${options.nestTables}${helpers$2.fieldEscape(field.name, false)}`] = value;
				else if (options.nestTables) {
					const tableName = helpers$2.fieldEscape(field.table, false);
					if (!result[tableName]) result[tableName] = {};
					result[tableName][helpers$2.fieldEscape(field.name, false)] = value;
				} else result[helpers$2.fieldEscape(field.name, false)] = value;
			}
			return result;
		} };
	}
	module.exports = getTextParser$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/query.js
var require_query = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/query.js": ((exports, module) => {
	const process$3 = __require("process");
	const Timers$1 = __require("timers");
	const Readable$1 = __require("stream").Readable;
	const Command$8 = require_command();
	const Packets$7 = require_packets();
	const getTextParser = require_text_parser();
	const staticParser = require_static_text_parser();
	const ServerStatus = require_server_status();
	const EmptyPacket = new Packets$7.Packet(0, Buffer.allocUnsafe(4), 0, 4);
	var Query$2 = class Query$2 extends Command$8 {
		constructor(options, callback) {
			super();
			this.sql = options.sql;
			this.values = options.values;
			this._queryOptions = options;
			this.namedPlaceholders = options.namedPlaceholders || false;
			this.onResult = callback;
			this.timeout = options.timeout;
			this.queryTimeout = null;
			this._fieldCount = 0;
			this._rowParser = null;
			this._fields = [];
			this._rows = [];
			this._receivedFieldsCount = 0;
			this._resultIndex = 0;
			this._localStream = null;
			this._unpipeStream = function() {};
			this._streamFactory = options.infileStreamFactory;
			this._connection = null;
		}
		then() {
			const err = "You have tried to call .then(), .catch(), or invoked await on the result of query that is not a promise, which is a programming error. Try calling con.promise().query(), or require('mysql2/promise') instead of 'mysql2' for a promise-compatible version of the query interface. To learn how to use async/await or Promises check out documentation at https://sidorares.github.io/node-mysql2/docs#using-promise-wrapper, or the mysql2 documentation at https://sidorares.github.io/node-mysql2/docs/documentation/promise-wrapper";
			console.log(err);
			throw new Error(err);
		}
		start(_packet, connection) {
			if (connection.config.debug) console.log("        Sending query command: %s", this.sql);
			this._connection = connection;
			this.options = Object.assign({}, connection.config, this._queryOptions);
			this._setTimeout();
			const cmdPacket = new Packets$7.Query(this.sql, connection.config.charsetNumber);
			connection.writePacket(cmdPacket.toPacket(1));
			return Query$2.prototype.resultsetHeader;
		}
		done() {
			this._unpipeStream();
			if (this.timeout && !this.queryTimeout) return null;
			if (this.queryTimeout) {
				Timers$1.clearTimeout(this.queryTimeout);
				this.queryTimeout = null;
			}
			if (this.onResult) {
				let rows, fields$1;
				if (this._resultIndex === 0) {
					rows = this._rows[0];
					fields$1 = this._fields[0];
				} else {
					rows = this._rows;
					fields$1 = this._fields;
				}
				if (fields$1) process$3.nextTick(() => {
					this.onResult(null, rows, fields$1);
				});
				else process$3.nextTick(() => {
					this.onResult(null, rows);
				});
			}
			return null;
		}
		doneInsert(rs) {
			if (this._localStreamError) {
				if (this.onResult) this.onResult(this._localStreamError, rs);
				else this.emit("error", this._localStreamError);
				return null;
			}
			this._rows.push(rs);
			this._fields.push(void 0);
			this.emit("fields", void 0);
			this.emit("result", rs);
			if (rs.serverStatus & ServerStatus.SERVER_MORE_RESULTS_EXISTS) {
				this._resultIndex++;
				return this.resultsetHeader;
			}
			return this.done();
		}
		resultsetHeader(packet, connection) {
			const rs = new Packets$7.ResultSetHeader(packet, connection);
			this._fieldCount = rs.fieldCount;
			if (connection.config.debug) console.log(`        Resultset header received, expecting ${rs.fieldCount} column definition packets`);
			if (this._fieldCount === 0) return this.doneInsert(rs);
			if (this._fieldCount === null) return this._streamLocalInfile(connection, rs.infileName);
			this._receivedFieldsCount = 0;
			this._rows.push([]);
			this._fields.push([]);
			return this.readField;
		}
		_streamLocalInfile(connection, path) {
			if (this._streamFactory) this._localStream = this._streamFactory(path);
			else {
				this._localStreamError = /* @__PURE__ */ new Error(`As a result of LOCAL INFILE command server wants to read ${path} file, but as of v2.0 you must provide streamFactory option returning ReadStream.`);
				connection.writePacket(EmptyPacket);
				return this.infileOk;
			}
			const onConnectionError = () => {
				this._unpipeStream();
			};
			const onDrain = () => {
				this._localStream.resume();
			};
			const onPause = () => {
				this._localStream.pause();
			};
			const onData = function(data) {
				const dataWithHeader = Buffer.allocUnsafe(data.length + 4);
				data.copy(dataWithHeader, 4);
				connection.writePacket(new Packets$7.Packet(0, dataWithHeader, 0, dataWithHeader.length));
			};
			const onEnd = () => {
				connection.removeListener("error", onConnectionError);
				connection.writePacket(EmptyPacket);
			};
			const onError = (err) => {
				this._localStreamError = err;
				connection.removeListener("error", onConnectionError);
				connection.writePacket(EmptyPacket);
			};
			this._unpipeStream = () => {
				connection.stream.removeListener("pause", onPause);
				connection.stream.removeListener("drain", onDrain);
				this._localStream.removeListener("data", onData);
				this._localStream.removeListener("end", onEnd);
				this._localStream.removeListener("error", onError);
			};
			connection.stream.on("pause", onPause);
			connection.stream.on("drain", onDrain);
			this._localStream.on("data", onData);
			this._localStream.on("end", onEnd);
			this._localStream.on("error", onError);
			connection.once("error", onConnectionError);
			return this.infileOk;
		}
		readField(packet, connection) {
			this._receivedFieldsCount++;
			if (this._fields[this._resultIndex].length !== this._fieldCount) {
				const field = new Packets$7.ColumnDefinition(packet, connection.clientEncoding);
				this._fields[this._resultIndex].push(field);
				if (connection.config.debug) {
					console.log("        Column definition:");
					console.log(`          name: ${field.name}`);
					console.log(`          type: ${field.columnType}`);
					console.log(`         flags: ${field.flags}`);
				}
			}
			if (this._receivedFieldsCount === this._fieldCount) {
				const fields$1 = this._fields[this._resultIndex];
				this.emit("fields", fields$1);
				if (this.options.disableEval) this._rowParser = staticParser(fields$1, this.options, connection.config);
				else this._rowParser = new (getTextParser(fields$1, this.options, connection.config))(fields$1);
				return Query$2.prototype.fieldsEOF;
			}
			return Query$2.prototype.readField;
		}
		fieldsEOF(packet, connection) {
			if (!packet.isEOF()) return connection.protocolError("Expected EOF packet");
			return this.row;
		}
		row(packet, _connection) {
			if (packet.isEOF()) {
				if (packet.eofStatusFlags() & ServerStatus.SERVER_MORE_RESULTS_EXISTS) {
					this._resultIndex++;
					return Query$2.prototype.resultsetHeader;
				}
				return this.done();
			}
			let row;
			try {
				row = this._rowParser.next(packet, this._fields[this._resultIndex], this.options);
			} catch (err) {
				this._localStreamError = err;
				return this.doneInsert(null);
			}
			if (this.onResult) this._rows[this._resultIndex].push(row);
			else this.emit("result", row, this._resultIndex);
			return Query$2.prototype.row;
		}
		infileOk(packet, connection) {
			const rs = new Packets$7.ResultSetHeader(packet, connection);
			return this.doneInsert(rs);
		}
		stream(options) {
			options = options || Object.create(null);
			options.objectMode = true;
			const stream = new Readable$1({
				...options,
				emitClose: true,
				autoDestroy: true,
				read: () => {
					this._connection && this._connection.resume();
				}
			});
			stream.once("close", () => {
				if (!stream.readableEnded) stream.emit("end");
			});
			const onResult = (row, index) => {
				if (stream.destroyed) return;
				if (!stream.push(row)) this._connection && this._connection.pause();
				stream.emit("result", row, index);
			};
			const onFields = (fields$1) => {
				if (stream.destroyed) return;
				stream.emit("fields", fields$1);
			};
			const onEnd = () => {
				if (stream.destroyed) return;
				stream.push(null);
			};
			const onError = (err) => {
				stream.destroy(err);
			};
			stream._destroy = (err, cb) => {
				this._connection && this._connection.resume();
				this.removeListener("result", onResult);
				this.removeListener("fields", onFields);
				this.removeListener("end", onEnd);
				this.removeListener("error", onError);
				cb(err);
			};
			this.on("result", onResult);
			this.on("fields", onFields);
			this.on("end", onEnd);
			this.on("error", onError);
			return stream;
		}
		_setTimeout() {
			if (this.timeout) {
				const timeoutHandler = this._handleTimeoutError.bind(this);
				this.queryTimeout = Timers$1.setTimeout(timeoutHandler, this.timeout);
			}
		}
		_handleTimeoutError() {
			if (this.queryTimeout) {
				Timers$1.clearTimeout(this.queryTimeout);
				this.queryTimeout = null;
			}
			const err = /* @__PURE__ */ new Error("Query inactivity timeout");
			err.errorno = "PROTOCOL_SEQUENCE_TIMEOUT";
			err.code = "PROTOCOL_SEQUENCE_TIMEOUT";
			err.syscall = "query";
			if (this.onResult) this.onResult(err);
			else this.emit("error", err);
		}
	};
	Query$2.prototype.catch = Query$2.prototype.then;
	module.exports = Query$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/close_statement.js
var require_close_statement = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/close_statement.js": ((exports, module) => {
	const Command$7 = require_command();
	const Packets$6 = require_packets();
	var CloseStatement$2 = class extends Command$7 {
		constructor(id) {
			super();
			this.id = id;
		}
		start(packet, connection) {
			connection.writePacket(new Packets$6.CloseStatement(this.id).toPacket(1));
			return null;
		}
	};
	module.exports = CloseStatement$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/binary_parser.js
var require_binary_parser = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/binary_parser.js": ((exports, module) => {
	const FieldFlags$1 = require_field_flags();
	const Charsets$2 = require_charsets();
	const Types$1 = require_types();
	const helpers$1 = require_helpers();
	const genFunc = require_generate_function();
	const parserCache$1 = require_parser_cache();
	const typeNames$1 = [];
	for (const t in Types$1) typeNames$1[Types$1[t]] = t;
	function readCodeFor(field, config, options, fieldNum) {
		const supportBigNumbers = Boolean(options.supportBigNumbers || config.supportBigNumbers);
		const bigNumberStrings = Boolean(options.bigNumberStrings || config.bigNumberStrings);
		const timezone = options.timezone || config.timezone;
		const dateStrings = options.dateStrings || config.dateStrings;
		const unsigned = field.flags & FieldFlags$1.UNSIGNED;
		switch (field.columnType) {
			case Types$1.TINY: return unsigned ? "packet.readInt8();" : "packet.readSInt8();";
			case Types$1.SHORT: return unsigned ? "packet.readInt16();" : "packet.readSInt16();";
			case Types$1.LONG:
			case Types$1.INT24: return unsigned ? "packet.readInt32();" : "packet.readSInt32();";
			case Types$1.YEAR: return "packet.readInt16()";
			case Types$1.FLOAT: return "packet.readFloat();";
			case Types$1.DOUBLE: return "packet.readDouble();";
			case Types$1.NULL: return "null;";
			case Types$1.DATE:
			case Types$1.DATETIME:
			case Types$1.TIMESTAMP:
			case Types$1.NEWDATE:
				if (helpers$1.typeMatch(field.columnType, dateStrings, Types$1)) return `packet.readDateTimeString(${parseInt(field.decimals, 10)}, null, ${field.columnType});`;
				return `packet.readDateTime(${helpers$1.srcEscape(timezone)});`;
			case Types$1.TIME: return "packet.readTimeString()";
			case Types$1.DECIMAL:
			case Types$1.NEWDECIMAL:
				if (config.decimalNumbers) return "packet.parseLengthCodedFloat();";
				return "packet.readLengthCodedString(\"ascii\");";
			case Types$1.GEOMETRY: return "packet.parseGeometryValue();";
			case Types$1.VECTOR: return "packet.parseVector()";
			case Types$1.JSON: return config.jsonStrings ? "packet.readLengthCodedString(\"utf8\")" : "JSON.parse(packet.readLengthCodedString(\"utf8\"));";
			case Types$1.LONGLONG:
				if (!supportBigNumbers) return unsigned ? "packet.readInt64JSNumber();" : "packet.readSInt64JSNumber();";
				if (bigNumberStrings) return unsigned ? "packet.readInt64String();" : "packet.readSInt64String();";
				return unsigned ? "packet.readInt64();" : "packet.readSInt64();";
			default:
				if (field.characterSet === Charsets$2.BINARY) return "packet.readLengthCodedBuffer();";
				return `packet.readLengthCodedString(fields[${fieldNum}].encoding)`;
		}
	}
	function compile(fields$1, options, config) {
		const parserFn = genFunc();
		const nullBitmapLength = Math.floor((fields$1.length + 7 + 2) / 8);
		function wrap(field, packet) {
			return {
				type: typeNames$1[field.columnType],
				length: field.columnLength,
				db: field.schema,
				table: field.table,
				name: field.name,
				string: function(encoding = field.encoding) {
					if (field.columnType === Types$1.JSON && encoding === field.encoding) console.warn(`typeCast: JSON column "${field.name}" is interpreted as BINARY by default, recommended to manually set utf8 encoding: \`field.string("utf8")\``);
					if ([
						Types$1.DATETIME,
						Types$1.NEWDATE,
						Types$1.TIMESTAMP,
						Types$1.DATE
					].includes(field.columnType)) return packet.readDateTimeString(parseInt(field.decimals, 10), " ", field.columnType);
					if (field.columnType === Types$1.TINY) {
						const unsigned = field.flags & FieldFlags$1.UNSIGNED;
						return String(unsigned ? packet.readInt8() : packet.readSInt8());
					}
					if (field.columnType === Types$1.TIME) return packet.readTimeString();
					return packet.readLengthCodedString(encoding);
				},
				buffer: function() {
					return packet.readLengthCodedBuffer();
				},
				geometry: function() {
					return packet.parseGeometryValue();
				}
			};
		}
		parserFn("(function(){");
		parserFn("return class BinaryRow {");
		parserFn("constructor() {");
		parserFn("}");
		parserFn("next(packet, fields, options) {");
		if (options.rowsAsArray) parserFn(`const result = new Array(${fields$1.length});`);
		else parserFn("const result = {};");
		if (typeof config.typeCast === "function" && typeof options.typeCast !== "function") options.typeCast = config.typeCast;
		parserFn("packet.readInt8();");
		for (let i$4 = 0; i$4 < nullBitmapLength; ++i$4) parserFn(`const nullBitmaskByte${i$4} = packet.readInt8();`);
		let lvalue = "";
		let currentFieldNullBit = 4;
		let nullByteIndex = 0;
		let fieldName = "";
		let tableName = "";
		for (let i$4 = 0; i$4 < fields$1.length; i$4++) {
			fieldName = helpers$1.fieldEscape(fields$1[i$4].name);
			if (typeof options.nestTables === "string") lvalue = `result[${helpers$1.fieldEscape(fields$1[i$4].table + options.nestTables + fields$1[i$4].name)}]`;
			else if (options.nestTables === true) {
				tableName = helpers$1.fieldEscape(fields$1[i$4].table);
				parserFn(`if (!result[${tableName}]) result[${tableName}] = {};`);
				lvalue = `result[${tableName}][${fieldName}]`;
			} else if (options.rowsAsArray) lvalue = `result[${i$4.toString(10)}]`;
			else lvalue = `result[${fieldName}]`;
			parserFn(`if (nullBitmaskByte${nullByteIndex} & ${currentFieldNullBit}) `);
			parserFn(`${lvalue} = null;`);
			parserFn("else {");
			if (options.typeCast === false) parserFn(`${lvalue} = packet.readLengthCodedBuffer();`);
			else {
				const fieldWrapperVar = `fieldWrapper${i$4}`;
				parserFn(`const ${fieldWrapperVar} = wrap(fields[${i$4}], packet);`);
				const readCode = readCodeFor(fields$1[i$4], config, options, i$4);
				if (typeof options.typeCast === "function") parserFn(`${lvalue} = options.typeCast(${fieldWrapperVar}, function() { return ${readCode} });`);
				else parserFn(`${lvalue} = ${readCode};`);
			}
			parserFn("}");
			currentFieldNullBit *= 2;
			if (currentFieldNullBit === 256) {
				currentFieldNullBit = 1;
				nullByteIndex++;
			}
		}
		parserFn("return result;");
		parserFn("}");
		parserFn("};")("})()");
		if (config.debug) helpers$1.printDebugWithCode("Compiled binary protocol row parser", parserFn.toString());
		return parserFn.toFunction({ wrap });
	}
	function getBinaryParser$2(fields$1, options, config) {
		return parserCache$1.getParser("binary", fields$1, options, config, compile);
	}
	module.exports = getBinaryParser$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/static_binary_parser.js
var require_static_binary_parser = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/parsers/static_binary_parser.js": ((exports, module) => {
	const FieldFlags = require_field_flags();
	const Charsets$1 = require_charsets();
	const Types = require_types();
	const helpers = require_helpers();
	const typeNames = [];
	for (const t in Types) typeNames[Types[t]] = t;
	function getBinaryParser$1(fields$1, _options, config) {
		function readCode(field, config$1, options, fieldNum, packet) {
			const supportBigNumbers = Boolean(options.supportBigNumbers || config$1.supportBigNumbers);
			const bigNumberStrings = Boolean(options.bigNumberStrings || config$1.bigNumberStrings);
			const timezone = options.timezone || config$1.timezone;
			const dateStrings = options.dateStrings || config$1.dateStrings;
			const unsigned = field.flags & FieldFlags.UNSIGNED;
			switch (field.columnType) {
				case Types.TINY: return unsigned ? packet.readInt8() : packet.readSInt8();
				case Types.SHORT: return unsigned ? packet.readInt16() : packet.readSInt16();
				case Types.LONG:
				case Types.INT24: return unsigned ? packet.readInt32() : packet.readSInt32();
				case Types.YEAR: return packet.readInt16();
				case Types.FLOAT: return packet.readFloat();
				case Types.DOUBLE: return packet.readDouble();
				case Types.NULL: return null;
				case Types.DATE:
				case Types.DATETIME:
				case Types.TIMESTAMP:
				case Types.NEWDATE: return helpers.typeMatch(field.columnType, dateStrings, Types) ? packet.readDateTimeString(parseInt(field.decimals, 10), null, field.columnType) : packet.readDateTime(timezone);
				case Types.TIME: return packet.readTimeString();
				case Types.DECIMAL:
				case Types.NEWDECIMAL: return config$1.decimalNumbers ? packet.parseLengthCodedFloat() : packet.readLengthCodedString("ascii");
				case Types.GEOMETRY: return packet.parseGeometryValue();
				case Types.VECTOR: return packet.parseVector();
				case Types.JSON: return config$1.jsonStrings ? packet.readLengthCodedString("utf8") : JSON.parse(packet.readLengthCodedString("utf8"));
				case Types.LONGLONG:
					if (!supportBigNumbers) return unsigned ? packet.readInt64JSNumber() : packet.readSInt64JSNumber();
					return bigNumberStrings ? unsigned ? packet.readInt64String() : packet.readSInt64String() : unsigned ? packet.readInt64() : packet.readSInt64();
				default: return field.characterSet === Charsets$1.BINARY ? packet.readLengthCodedBuffer() : packet.readLengthCodedString(fields$1[fieldNum].encoding);
			}
		}
		return class BinaryRow$1 {
			constructor() {}
			next(packet, fields$2, options) {
				packet.readInt8();
				const nullBitmapLength = Math.floor((fields$2.length + 7 + 2) / 8);
				const nullBitmaskBytes = new Array(nullBitmapLength);
				for (let i$4 = 0; i$4 < nullBitmapLength; i$4++) nullBitmaskBytes[i$4] = packet.readInt8();
				const result = options.rowsAsArray ? new Array(fields$2.length) : {};
				let currentFieldNullBit = 4;
				let nullByteIndex = 0;
				for (let i$4 = 0; i$4 < fields$2.length; i$4++) {
					const field = fields$2[i$4];
					const typeCast = options.typeCast !== void 0 ? options.typeCast : config.typeCast;
					let value;
					if (nullBitmaskBytes[nullByteIndex] & currentFieldNullBit) value = null;
					else if (options.typeCast === false) value = packet.readLengthCodedBuffer();
					else {
						const next = () => readCode(field, config, options, i$4, packet);
						value = typeof typeCast === "function" ? typeCast({
							type: typeNames[field.columnType],
							length: field.columnLength,
							db: field.schema,
							table: field.table,
							name: field.name,
							string: function(encoding = field.encoding) {
								if (field.columnType === Types.JSON && encoding === field.encoding) console.warn(`typeCast: JSON column "${field.name}" is interpreted as BINARY by default, recommended to manually set utf8 encoding: \`field.string("utf8")\``);
								if ([
									Types.DATETIME,
									Types.NEWDATE,
									Types.TIMESTAMP,
									Types.DATE
								].includes(field.columnType)) return packet.readDateTimeString(parseInt(field.decimals, 10), " ", field.columnType);
								if (field.columnType === Types.TINY) {
									const unsigned = field.flags & FieldFlags.UNSIGNED;
									return String(unsigned ? packet.readInt8() : packet.readSInt8());
								}
								if (field.columnType === Types.TIME) return packet.readTimeString();
								return packet.readLengthCodedString(encoding);
							},
							buffer: function() {
								return packet.readLengthCodedBuffer();
							},
							geometry: function() {
								return packet.parseGeometryValue();
							}
						}, next) : next();
					}
					if (options.rowsAsArray) result[i$4] = value;
					else if (typeof options.nestTables === "string") {
						const key$1 = helpers.fieldEscape(field.table + options.nestTables + field.name, false);
						result[key$1] = value;
					} else if (options.nestTables === true) {
						const tableName = helpers.fieldEscape(field.table, false);
						if (!result[tableName]) result[tableName] = {};
						const fieldName = helpers.fieldEscape(field.name, false);
						result[tableName][fieldName] = value;
					} else {
						const key$1 = helpers.fieldEscape(field.name, false);
						result[key$1] = value;
					}
					currentFieldNullBit *= 2;
					if (currentFieldNullBit === 256) {
						currentFieldNullBit = 1;
						nullByteIndex++;
					}
				}
				return result;
			}
		};
	}
	module.exports = getBinaryParser$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/execute.js
var require_execute = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/execute.js": ((exports, module) => {
	const Command$6 = require_command();
	const Query$1 = require_query();
	const Packets$5 = require_packets();
	const getBinaryParser = require_binary_parser();
	const getStaticBinaryParser = require_static_binary_parser();
	var Execute$2 = class Execute$2 extends Command$6 {
		constructor(options, callback) {
			super();
			this.statement = options.statement;
			this.sql = options.sql;
			this.values = options.values;
			this.onResult = callback;
			this.parameters = options.values;
			this.insertId = 0;
			this.timeout = options.timeout;
			this.queryTimeout = null;
			this._rows = [];
			this._fields = [];
			this._result = [];
			this._fieldCount = 0;
			this._rowParser = null;
			this._executeOptions = options;
			this._resultIndex = 0;
			this._localStream = null;
			this._unpipeStream = function() {};
			this._streamFactory = options.infileStreamFactory;
			this._connection = null;
		}
		buildParserFromFields(fields$1, connection) {
			if (this.options.disableEval) return getStaticBinaryParser(fields$1, this.options, connection.config);
			return getBinaryParser(fields$1, this.options, connection.config);
		}
		start(packet, connection) {
			this._connection = connection;
			this.options = Object.assign({}, connection.config, this._executeOptions);
			this._setTimeout();
			const executePacket = new Packets$5.Execute(this.statement.id, this.parameters, connection.config.charsetNumber, connection.config.timezone);
			try {
				connection.writePacket(executePacket.toPacket(1));
			} catch (error) {
				this.onResult(error);
			}
			return Execute$2.prototype.resultsetHeader;
		}
		readField(packet, connection) {
			let fields$1;
			const field = new Packets$5.ColumnDefinition(packet, connection.clientEncoding);
			this._receivedFieldsCount++;
			this._fields[this._resultIndex].push(field);
			if (this._receivedFieldsCount === this._fieldCount) {
				fields$1 = this._fields[this._resultIndex];
				this.emit("fields", fields$1, this._resultIndex);
				return Execute$2.prototype.fieldsEOF;
			}
			return Execute$2.prototype.readField;
		}
		fieldsEOF(packet, connection) {
			if (!packet.isEOF()) return connection.protocolError("Expected EOF packet");
			this._rowParser = new (this.buildParserFromFields(this._fields[this._resultIndex], connection))();
			return Execute$2.prototype.row;
		}
	};
	Execute$2.prototype.done = Query$1.prototype.done;
	Execute$2.prototype.doneInsert = Query$1.prototype.doneInsert;
	Execute$2.prototype.resultsetHeader = Query$1.prototype.resultsetHeader;
	Execute$2.prototype._findOrCreateReadStream = Query$1.prototype._findOrCreateReadStream;
	Execute$2.prototype._streamLocalInfile = Query$1.prototype._streamLocalInfile;
	Execute$2.prototype._setTimeout = Query$1.prototype._setTimeout;
	Execute$2.prototype._handleTimeoutError = Query$1.prototype._handleTimeoutError;
	Execute$2.prototype.row = Query$1.prototype.row;
	Execute$2.prototype.stream = Query$1.prototype.stream;
	module.exports = Execute$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/prepare.js
var require_prepare = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/prepare.js": ((exports, module) => {
	const Packets$4 = require_packets();
	const Command$5 = require_command();
	const CloseStatement$1 = require_close_statement();
	const Execute$1 = require_execute();
	var PreparedStatementInfo = class {
		constructor(query, id, columns, parameters, connection) {
			this.query = query;
			this.id = id;
			this.columns = columns;
			this.parameters = parameters;
			this.rowParser = null;
			this._connection = connection;
		}
		close() {
			return this._connection.addCommand(new CloseStatement$1(this.id));
		}
		execute(parameters, callback) {
			if (typeof parameters === "function") {
				callback = parameters;
				parameters = [];
			}
			return this._connection.addCommand(new Execute$1({
				statement: this,
				values: parameters
			}, callback));
		}
	};
	var Prepare$1 = class Prepare$1 extends Command$5 {
		constructor(options, callback) {
			super();
			this.query = options.sql;
			this.onResult = callback;
			this.id = 0;
			this.fieldCount = 0;
			this.parameterCount = 0;
			this.fields = [];
			this.parameterDefinitions = [];
			this.options = options;
		}
		start(packet, connection) {
			this.key = connection.constructor.statementKey(this.options);
			const statement = connection._statements.get(this.key);
			if (statement) {
				if (this.onResult) this.onResult(null, statement);
				return null;
			}
			const cmdPacket = new Packets$4.PrepareStatement(this.query, connection.config.charsetNumber, this.options.values);
			connection.writePacket(cmdPacket.toPacket(1));
			return Prepare$1.prototype.prepareHeader;
		}
		prepareHeader(packet, connection) {
			const header = new Packets$4.PreparedStatementHeader(packet);
			this.id = header.id;
			this.fieldCount = header.fieldCount;
			this.parameterCount = header.parameterCount;
			if (this.parameterCount > 0) return Prepare$1.prototype.readParameter;
			if (this.fieldCount > 0) return Prepare$1.prototype.readField;
			return this.prepareDone(connection);
		}
		readParameter(packet, connection) {
			if (packet.isEOF()) {
				if (this.fieldCount > 0) return Prepare$1.prototype.readField;
				return this.prepareDone(connection);
			}
			const def = new Packets$4.ColumnDefinition(packet, connection.clientEncoding);
			this.parameterDefinitions.push(def);
			if (this.parameterDefinitions.length === this.parameterCount) return Prepare$1.prototype.parametersEOF;
			return this.readParameter;
		}
		readField(packet, connection) {
			if (packet.isEOF()) return this.prepareDone(connection);
			const def = new Packets$4.ColumnDefinition(packet, connection.clientEncoding);
			this.fields.push(def);
			if (this.fields.length === this.fieldCount) return Prepare$1.prototype.fieldsEOF;
			return Prepare$1.prototype.readField;
		}
		parametersEOF(packet, connection) {
			if (!packet.isEOF()) return connection.protocolError("Expected EOF packet after parameters");
			if (this.fieldCount > 0) return Prepare$1.prototype.readField;
			return this.prepareDone(connection);
		}
		fieldsEOF(packet, connection) {
			if (!packet.isEOF()) return connection.protocolError("Expected EOF packet after fields");
			return this.prepareDone(connection);
		}
		prepareDone(connection) {
			const statement = new PreparedStatementInfo(this.query, this.id, this.fields, this.parameterDefinitions, connection);
			connection._statements.set(this.key, statement);
			if (this.onResult) this.onResult(null, statement);
			return null;
		}
	};
	module.exports = Prepare$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/ping.js
var require_ping = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/ping.js": ((exports, module) => {
	const Command$4 = require_command();
	const CommandCode$1 = require_commands$1();
	const Packet$1 = require_packet();
	var Ping$1 = class Ping$1 extends Command$4 {
		constructor(callback) {
			super();
			this.onResult = callback;
		}
		start(packet, connection) {
			const ping = new Packet$1(0, Buffer.from([
				1,
				0,
				0,
				0,
				CommandCode$1.PING
			]), 0, 5);
			connection.writePacket(ping);
			return Ping$1.prototype.pingResponse;
		}
		pingResponse() {
			if (this.onResult) process.nextTick(this.onResult.bind(this));
			return null;
		}
	};
	module.exports = Ping$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/register_slave.js
var require_register_slave = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/register_slave.js": ((exports, module) => {
	const Command$3 = require_command();
	const Packets$3 = require_packets();
	var RegisterSlave$1 = class RegisterSlave$1 extends Command$3 {
		constructor(opts, callback) {
			super();
			this.onResult = callback;
			this.opts = opts;
		}
		start(packet, connection) {
			const newPacket = new Packets$3.RegisterSlave(this.opts);
			connection.writePacket(newPacket.toPacket(1));
			return RegisterSlave$1.prototype.registerResponse;
		}
		registerResponse() {
			if (this.onResult) process.nextTick(this.onResult.bind(this));
			return null;
		}
	};
	module.exports = RegisterSlave$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binlog_query_statusvars.js
var require_binlog_query_statusvars = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/packets/binlog_query_statusvars.js": ((exports, module) => {
	const keys = {
		FLAGS2: 0,
		SQL_MODE: 1,
		CATALOG: 2,
		AUTO_INCREMENT: 3,
		CHARSET: 4,
		TIME_ZONE: 5,
		CATALOG_NZ: 6,
		LC_TIME_NAMES: 7,
		CHARSET_DATABASE: 8,
		TABLE_MAP_FOR_UPDATE: 9,
		MASTER_DATA_WRITTEN: 10,
		INVOKERS: 11,
		UPDATED_DB_NAMES: 12,
		MICROSECONDS: 3
	};
	module.exports = function parseStatusVars(buffer$1) {
		const result = {};
		let offset = 0;
		let key$1, length, prevOffset;
		while (offset < buffer$1.length) {
			key$1 = buffer$1[offset++];
			switch (key$1) {
				case keys.FLAGS2:
					result.flags = buffer$1.readUInt32LE(offset);
					offset += 4;
					break;
				case keys.SQL_MODE:
					result.sqlMode = buffer$1.readUInt32LE(offset);
					offset += 8;
					break;
				case keys.CATALOG:
					length = buffer$1[offset++];
					result.catalog = buffer$1.toString("utf8", offset, offset + length);
					offset += length + 1;
					break;
				case keys.CHARSET:
					result.clientCharset = buffer$1.readUInt16LE(offset);
					result.connectionCollation = buffer$1.readUInt16LE(offset + 2);
					result.serverCharset = buffer$1.readUInt16LE(offset + 4);
					offset += 6;
					break;
				case keys.TIME_ZONE:
					length = buffer$1[offset++];
					result.timeZone = buffer$1.toString("utf8", offset, offset + length);
					offset += length;
					break;
				case keys.CATALOG_NZ:
					length = buffer$1[offset++];
					result.catalogNz = buffer$1.toString("utf8", offset, offset + length);
					offset += length;
					break;
				case keys.LC_TIME_NAMES:
					result.lcTimeNames = buffer$1.readUInt16LE(offset);
					offset += 2;
					break;
				case keys.CHARSET_DATABASE:
					result.schemaCharset = buffer$1.readUInt16LE(offset);
					offset += 2;
					break;
				case keys.TABLE_MAP_FOR_UPDATE:
					result.mapForUpdate1 = buffer$1.readUInt32LE(offset);
					result.mapForUpdate2 = buffer$1.readUInt32LE(offset + 4);
					offset += 8;
					break;
				case keys.MASTER_DATA_WRITTEN:
					result.masterDataWritten = buffer$1.readUInt32LE(offset);
					offset += 4;
					break;
				case keys.INVOKERS:
					length = buffer$1[offset++];
					result.invokerUsername = buffer$1.toString("utf8", offset, offset + length);
					offset += length;
					length = buffer$1[offset++];
					result.invokerHostname = buffer$1.toString("utf8", offset, offset + length);
					offset += length;
					break;
				case keys.UPDATED_DB_NAMES:
					length = buffer$1[offset++];
					result.updatedDBs = [];
					for (; length; --length) {
						prevOffset = offset;
						while (buffer$1[offset++] && offset < buffer$1.length);
						result.updatedDBs.push(buffer$1.toString("utf8", prevOffset, offset - 1));
					}
					break;
				case keys.MICROSECONDS:
					result.microseconds = buffer$1.readInt16LE(offset) + (buffer$1[offset + 2] << 16);
					offset += 3;
			}
		}
		return result;
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/binlog_dump.js
var require_binlog_dump = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/binlog_dump.js": ((exports, module) => {
	const Command$2 = require_command();
	const Packets$2 = require_packets();
	const eventParsers = [];
	var BinlogEventHeader = class {
		constructor(packet) {
			this.timestamp = packet.readInt32();
			this.eventType = packet.readInt8();
			this.serverId = packet.readInt32();
			this.eventSize = packet.readInt32();
			this.logPos = packet.readInt32();
			this.flags = packet.readInt16();
		}
	};
	var BinlogDump$1 = class BinlogDump$1 extends Command$2 {
		constructor(opts) {
			super();
			this.opts = opts;
		}
		start(packet, connection) {
			const newPacket = new Packets$2.BinlogDump(this.opts);
			connection.writePacket(newPacket.toPacket(1));
			return BinlogDump$1.prototype.binlogData;
		}
		binlogData(packet) {
			if (packet.isEOF()) {
				this.emit("eof");
				return null;
			}
			packet.readInt8();
			const header = new BinlogEventHeader(packet);
			const EventParser = eventParsers[header.eventType];
			let event;
			if (EventParser) event = new EventParser(packet);
			else event = { name: "UNKNOWN" };
			event.header = header;
			this.emit("event", event);
			return BinlogDump$1.prototype.binlogData;
		}
	};
	var RotateEvent = class {
		constructor(packet) {
			this.pposition = packet.readInt32();
			packet.readInt32();
			this.nextBinlog = packet.readString();
			this.name = "RotateEvent";
		}
	};
	var FormatDescriptionEvent = class {
		constructor(packet) {
			this.binlogVersion = packet.readInt16();
			this.serverVersion = packet.readString(50).replace(/\u0000.*/, "");
			this.createTimestamp = packet.readInt32();
			this.eventHeaderLength = packet.readInt8();
			this.eventsLength = packet.readBuffer();
			this.name = "FormatDescriptionEvent";
		}
	};
	var QueryEvent = class {
		constructor(packet) {
			const parseStatusVars = require_binlog_query_statusvars();
			this.slaveProxyId = packet.readInt32();
			this.executionTime = packet.readInt32();
			const schemaLength = packet.readInt8();
			this.errorCode = packet.readInt16();
			const statusVarsLength = packet.readInt16();
			const statusVars = packet.readBuffer(statusVarsLength);
			this.schema = packet.readString(schemaLength);
			packet.readInt8();
			this.statusVars = parseStatusVars(statusVars);
			this.query = packet.readString();
			this.name = "QueryEvent";
		}
	};
	var XidEvent = class {
		constructor(packet) {
			this.binlogVersion = packet.readInt16();
			this.xid = packet.readInt64();
			this.name = "XidEvent";
		}
	};
	eventParsers[2] = QueryEvent;
	eventParsers[4] = RotateEvent;
	eventParsers[15] = FormatDescriptionEvent;
	eventParsers[16] = XidEvent;
	module.exports = BinlogDump$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/change_user.js
var require_change_user = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/change_user.js": ((exports, module) => {
	const Command$1 = require_command();
	const Packets$1 = require_packets();
	const ClientConstants$1 = require_client();
	const ClientHandshake$1 = require_client_handshake();
	const CharsetToEncoding$1 = require_charset_encodings();
	var ChangeUser$1 = class ChangeUser$1 extends Command$1 {
		constructor(options, callback) {
			super();
			this.onResult = callback;
			this.user = options.user;
			this.password = options.password;
			this.password1 = options.password;
			this.password2 = options.password2;
			this.password3 = options.password3;
			this.database = options.database;
			this.passwordSha1 = options.passwordSha1;
			this.charsetNumber = options.charsetNumber;
			this.currentConfig = options.currentConfig;
			this.authenticationFactor = 0;
		}
		start(packet, connection) {
			const newPacket = new Packets$1.ChangeUser({
				flags: connection.config.clientFlags,
				user: this.user,
				database: this.database,
				charsetNumber: this.charsetNumber,
				password: this.password,
				passwordSha1: this.passwordSha1,
				authPluginData1: connection._handshakePacket.authPluginData1,
				authPluginData2: connection._handshakePacket.authPluginData2
			});
			this.currentConfig.user = this.user;
			this.currentConfig.password = this.password;
			this.currentConfig.database = this.database;
			this.currentConfig.charsetNumber = this.charsetNumber;
			connection.clientEncoding = CharsetToEncoding$1[this.charsetNumber];
			connection._statements.clear();
			connection.writePacket(newPacket.toPacket());
			if (connection.serverCapabilityFlags & ClientConstants$1.MULTI_FACTOR_AUTHENTICATION) this.authenticationFactor = 1;
			return ChangeUser$1.prototype.handshakeResult;
		}
	};
	ChangeUser$1.prototype.handshakeResult = ClientHandshake$1.prototype.handshakeResult;
	ChangeUser$1.prototype.calculateNativePasswordAuthToken = ClientHandshake$1.prototype.calculateNativePasswordAuthToken;
	module.exports = ChangeUser$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/quit.js
var require_quit = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/quit.js": ((exports, module) => {
	const Command = require_command();
	const CommandCode = require_commands$1();
	const Packet = require_packet();
	var Quit$1 = class extends Command {
		constructor(callback) {
			super();
			this.onResult = callback;
		}
		start(packet, connection) {
			connection._closing = true;
			const quit = new Packet(0, Buffer.from([
				1,
				0,
				0,
				0,
				CommandCode.QUIT
			]), 0, 5);
			if (this.onResult) this.onResult();
			connection.writePacket(quit);
			return null;
		}
	};
	module.exports = Quit$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/index.js
var require_commands = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/commands/index.js": ((exports, module) => {
	const ClientHandshake = require_client_handshake();
	const ServerHandshake = require_server_handshake();
	const Query = require_query();
	const Prepare = require_prepare();
	const CloseStatement = require_close_statement();
	const Execute = require_execute();
	const Ping = require_ping();
	const RegisterSlave = require_register_slave();
	const BinlogDump = require_binlog_dump();
	const ChangeUser = require_change_user();
	const Quit = require_quit();
	module.exports = {
		ClientHandshake,
		ServerHandshake,
		Query,
		Prepare,
		CloseStatement,
		Execute,
		Ping,
		RegisterSlave,
		BinlogDump,
		ChangeUser,
		Quit
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/package.json
var require_package = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/package.json": ((exports, module) => {
	module.exports = {
		"name": "mysql2",
		"version": "3.14.4",
		"description": "fast mysql driver. Implements core protocol, prepared statements, ssl and compression in native JS",
		"main": "index.js",
		"typings": "typings/mysql/index",
		"type": "commonjs",
		"scripts": {
			"lint": "eslint . && prettier --check .",
			"lint:fix": "eslint . --fix && prettier --write .",
			"test": "poku -d -r=verbose --sequential test/esm test/unit test/integration",
			"test:bun": "bun poku -d --sequential test/esm test/unit test/integration",
			"test:deno": "deno run --allow-read --allow-env --allow-run npm:poku -d --sequential --denoAllow=\"read,env,net,sys\" test/esm test/unit test/integration",
			"test:tsc-build": "cd \"test/tsc-build\" && npx tsc -p \"tsconfig.json\"",
			"coverage-test": "c8 npm run test",
			"benchmark": "node ./benchmarks/benchmark.js",
			"wait-port": "wait-on"
		},
		"repository": {
			"type": "git",
			"url": "git+https://github.com/sidorares/node-mysql2.git"
		},
		"homepage": "https://sidorares.github.io/node-mysql2/docs",
		"keywords": [
			"mysql",
			"client",
			"server"
		],
		"files": [
			"lib",
			"typings/mysql",
			"index.js",
			"index.d.ts",
			"promise.js",
			"promise.d.ts"
		],
		"exports": {
			".": "./index.js",
			"./package.json": "./package.json",
			"./promise": "./promise.js",
			"./promise.js": "./promise.js"
		},
		"engines": { "node": ">= 8.0" },
		"author": "Andrey Sidorov <andrey.sidorov@gmail.com>",
		"license": "MIT",
		"dependencies": {
			"aws-ssl-profiles": "^1.1.1",
			"denque": "^2.1.0",
			"generate-function": "^2.3.1",
			"iconv-lite": "^0.7.0",
			"long": "^5.2.1",
			"lru.min": "^1.0.0",
			"named-placeholders": "^1.1.3",
			"seq-queue": "^0.0.5",
			"sqlstring": "^2.3.2"
		},
		"devDependencies": {
			"@eslint/eslintrc": "^3.3.0",
			"@eslint/js": "^9.21.0",
			"@eslint/markdown": "^7.0.0",
			"@types/node": "^24.0.0",
			"@typescript-eslint/eslint-plugin": "^8.26.0",
			"@typescript-eslint/parser": "^8.26.0",
			"assert-diff": "^3.0.2",
			"benchmark": "^2.1.4",
			"c8": "^10.1.1",
			"error-stack-parser": "^2.0.3",
			"eslint-config-prettier": "^10.0.2",
			"eslint-plugin-async-await": "^0.0.0",
			"eslint-plugin-markdown": "^5.1.0",
			"eslint-plugin-prettier": "^5.2.3",
			"globals": "^16.0.0",
			"poku": "^3.0.0",
			"portfinder": "^1.0.28",
			"prettier": "^3.0.0",
			"typescript": "^5.0.2"
		}
	};
}) });

//#endregion
//#region ../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/profiles/ca/defaults.js
var require_defaults = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/profiles/ca/defaults.js": ((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.defaults = void 0;
	/**
	* CA Certificates for **Amazon RDS** (2024)
	*
	* - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html
	* - https://docs.amazonaws.cn/en_us/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.SSL.html
	* - https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html#aurora-serverless.tls
	*/
	exports.defaults = [
		"-----BEGIN CERTIFICATE-----\nMIIEEjCCAvqgAwIBAgIJAM2ZN/+nPi27MA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzEmMCQGA1UEAwwdQW1hem9uIFJEUyBhZi1zb3V0aC0xIFJvb3QgQ0Ew\nHhcNMTkxMDI4MTgwNTU4WhcNMjQxMDI2MTgwNTU4WjCBlTELMAkGA1UEBhMCVVMx\nEDAOBgNVBAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoM\nGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMx\nJjAkBgNVBAMMHUFtYXpvbiBSRFMgYWYtc291dGgtMSBSb290IENBMIIBIjANBgkq\nhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwR2351uPMZaJk2gMGT+1sk8HE9MQh2rc\n/sCnbxGn2p1c7Oi9aBbd/GiFijeJb2BXvHU+TOq3d3Jjqepq8tapXVt4ojbTJNyC\nJ5E7r7KjTktKdLxtBE1MK25aY+IRJjtdU6vG3KiPKUT1naO3xs3yt0F76WVuFivd\n9OHv2a+KHvPkRUWIxpmAHuMY9SIIMmEZtVE7YZGx5ah0iO4JzItHcbVR0y0PBH55\narpFBddpIVHCacp1FUPxSEWkOpI7q0AaU4xfX0fe1BV5HZYRKpBOIp1TtZWvJD+X\njGUtL1BEsT5vN5g9MkqdtYrC+3SNpAk4VtpvJrdjraI/hhvfeXNnAwIDAQABo2Mw\nYTAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUEEi/\nWWMcBJsoGXg+EZwkQ0MscZQwHwYDVR0jBBgwFoAUEEi/WWMcBJsoGXg+EZwkQ0Ms\ncZQwDQYJKoZIhvcNAQELBQADggEBAGDZ5js5Pc/gC58LJrwMPXFhJDBS8QuDm23C\nFFUdlqucskwOS3907ErK1ZkmVJCIqFLArHqskFXMAkRZ2PNR7RjWLqBs+0znG5yH\nhRKb4DXzhUFQ18UBRcvT6V6zN97HTRsEEaNhM/7k8YLe7P8vfNZ28VIoJIGGgv9D\nwQBBvkxQ71oOmAG0AwaGD0ORGUfbYry9Dz4a4IcUsZyRWRMADixgrFv6VuETp26s\n/+z+iqNaGWlELBKh3iQCT6Y/1UnkPLO42bxrCSyOvshdkYN58Q2gMTE1SVTqyo8G\nLw8lLAz9bnvUSgHzB3jRrSx6ggF/WRMRYlR++y6LXP4SAsSAaC0=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEEjCCAvqgAwIBAgIJAJYM4LxvTZA6MA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzEmMCQGA1UEAwwdQW1hem9uIFJEUyBldS1zb3V0aC0xIFJvb3QgQ0Ew\nHhcNMTkxMDMwMjAyMDM2WhcNMjQxMDI4MjAyMDM2WjCBlTELMAkGA1UEBhMCVVMx\nEDAOBgNVBAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoM\nGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMx\nJjAkBgNVBAMMHUFtYXpvbiBSRFMgZXUtc291dGgtMSBSb290IENBMIIBIjANBgkq\nhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqM921jXCXeqpRNCS9CBPOe5N7gMaEt+D\ns5uR3riZbqzRlHGiF1jZihkXfHAIQewDwy+Yz+Oec1aEZCQMhUHxZJPusuX0cJfj\nb+UluFqHIijL2TfXJ3D0PVLLoNTQJZ8+GAPECyojAaNuoHbdVqxhOcznMsXIXVFq\nyVLKDGvyKkJjai/iSPDrQMXufg3kWt0ISjNLvsG5IFXgP4gttsM8i0yvRd4QcHoo\nDjvH7V3cS+CQqW5SnDrGnHToB0RLskE1ET+oNOfeN9PWOxQprMOX/zmJhnJQlTqD\nQP7jcf7SddxrKFjuziFiouskJJyNDsMjt1Lf60+oHZhed2ogTeifGwIDAQABo2Mw\nYTAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUFBAF\ncgJe/BBuZiGeZ8STfpkgRYQwHwYDVR0jBBgwFoAUFBAFcgJe/BBuZiGeZ8STfpkg\nRYQwDQYJKoZIhvcNAQELBQADggEBAKAYUtlvDuX2UpZW9i1QgsjFuy/ErbW0dLHU\ne/IcFtju2z6RLZ+uF+5A8Kme7IKG1hgt8s+w9TRVQS/7ukQzoK3TaN6XKXRosjtc\no9Rm4gYWM8bmglzY1TPNaiI4HC7546hSwJhubjN0bXCuj/0sHD6w2DkiGuwKNAef\nyTu5vZhPkeNyXLykxkzz7bNp2/PtMBnzIp+WpS7uUDmWyScGPohKMq5PqvL59z+L\nZI3CYeMZrJ5VpXUg3fNNIz/83N3G0sk7wr0ohs/kHTP7xPOYB0zD7Ku4HA0Q9Swf\nWX0qr6UQgTPMjfYDLffI7aEId0gxKw1eGYc6Cq5JAZ3ipi/cBFc=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEEjCCAvqgAwIBAgIJANew34ehz5l8MA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzEmMCQGA1UEAwwdQW1hem9uIFJEUyBtZS1zb3V0aC0xIFJvb3QgQ0Ew\nHhcNMTkwNTEwMjE0ODI3WhcNMjQwNTA4MjE0ODI3WjCBlTELMAkGA1UEBhMCVVMx\nEDAOBgNVBAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoM\nGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMx\nJjAkBgNVBAMMHUFtYXpvbiBSRFMgbWUtc291dGgtMSBSb290IENBMIIBIjANBgkq\nhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp7BYV88MukcY+rq0r79+C8UzkT30fEfT\naPXbx1d6M7uheGN4FMaoYmL+JE1NZPaMRIPTHhFtLSdPccInvenRDIatcXX+jgOk\nUA6lnHQ98pwN0pfDUyz/Vph4jBR9LcVkBbe0zdoKKp+HGbMPRU0N2yNrog9gM5O8\ngkU/3O2csJ/OFQNnj4c2NQloGMUpEmedwJMOyQQfcUyt9CvZDfIPNnheUS29jGSw\nERpJe/AENu8Pxyc72jaXQuD+FEi2Ck6lBkSlWYQFhTottAeGvVFNCzKszCntrtqd\nrdYUwurYsLTXDHv9nW2hfDUQa0mhXf9gNDOBIVAZugR9NqNRNyYLHQIDAQABo2Mw\nYTAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU54cf\nDjgwBx4ycBH8+/r8WXdaiqYwHwYDVR0jBBgwFoAU54cfDjgwBx4ycBH8+/r8WXda\niqYwDQYJKoZIhvcNAQELBQADggEBAIIMTSPx/dR7jlcxggr+O6OyY49Rlap2laKA\neC/XI4ySP3vQkIFlP822U9Kh8a9s46eR0uiwV4AGLabcu0iKYfXjPkIprVCqeXV7\nny9oDtrbflyj7NcGdZLvuzSwgl9SYTJp7PVCZtZutsPYlbJrBPHwFABvAkMvRtDB\nhitIg4AESDGPoCl94sYHpfDfjpUDMSrAMDUyO6DyBdZH5ryRMAs3lGtsmkkNUrso\naTW6R05681Z0mvkRdb+cdXtKOSuDZPoe2wJJIaz3IlNQNSrB5TImMYgmt6iAsFhv\n3vfTSTKrZDNTJn4ybG6pq1zWExoXsktZPylJly6R3RBwV6nwqBM=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBjCCAu6gAwIBAgIJAMc0ZzaSUK51MA0GCSqGSIb3DQEBCwUAMIGPMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzEgMB4GA1UEAwwXQW1hem9uIFJEUyBSb290IDIwMTkgQ0EwHhcNMTkw\nODIyMTcwODUwWhcNMjQwODIyMTcwODUwWjCBjzELMAkGA1UEBhMCVVMxEDAOBgNV\nBAcMB1NlYXR0bGUxEzARBgNVBAgMCldhc2hpbmd0b24xIjAgBgNVBAoMGUFtYXpv\nbiBXZWIgU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxIDAeBgNV\nBAMMF0FtYXpvbiBSRFMgUm9vdCAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEArXnF/E6/Qh+ku3hQTSKPMhQQlCpoWvnIthzX6MK3p5a0eXKZ\noWIjYcNNG6UwJjp4fUXl6glp53Jobn+tWNX88dNH2n8DVbppSwScVE2LpuL+94vY\n0EYE/XxN7svKea8YvlrqkUBKyxLxTjh+U/KrGOaHxz9v0l6ZNlDbuaZw3qIWdD/I\n6aNbGeRUVtpM6P+bWIoxVl/caQylQS6CEYUk+CpVyJSkopwJlzXT07tMoDL5WgX9\nO08KVgDNz9qP/IGtAcRduRcNioH3E9v981QO1zt/Gpb2f8NqAjUUCUZzOnij6mx9\nMcZ+9cWX88CRzR0vQODWuZscgI08NvM69Fn2SQIDAQABo2MwYTAOBgNVHQ8BAf8E\nBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUc19g2LzLA5j0Kxc0LjZa\npmD/vB8wHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJKoZIhvcN\nAQELBQADggEBAHAG7WTmyjzPRIM85rVj+fWHsLIvqpw6DObIjMWokpliCeMINZFV\nynfgBKsf1ExwbvJNzYFXW6dihnguDG9VMPpi2up/ctQTN8tm9nDKOy08uNZoofMc\nNUZxKCEkVKZv+IL4oHoeayt8egtv3ujJM6V14AstMQ6SwvwvA93EP/Ug2e4WAXHu\ncbI1NAbUgVDqp+DRdfvZkgYKryjTWd/0+1fS8X1bBZVWzl7eirNVnHbSH2ZDpNuY\n0SBd8dj5F6ld3t58ydZbrTHze7JJOd8ijySAp4/kiu9UfZWuTPABzDa/DSdz9Dk/\nzPW4CXXvhLmE02TA9/HeCw3KEHIwicNuEfw=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEEDCCAvigAwIBAgIJAKFMXyltvuRdMA0GCSqGSIb3DQEBCwUAMIGUMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzElMCMGA1UEAwwcQW1hem9uIFJEUyBCZXRhIFJvb3QgMjAxOSBDQTAe\nFw0xOTA4MTkxNzM4MjZaFw0yNDA4MTkxNzM4MjZaMIGUMQswCQYDVQQGEwJVUzEQ\nMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEiMCAGA1UECgwZ\nQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEl\nMCMGA1UEAwwcQW1hem9uIFJEUyBCZXRhIFJvb3QgMjAxOSBDQTCCASIwDQYJKoZI\nhvcNAQEBBQADggEPADCCAQoCggEBAMkZdnIH9ndatGAcFo+DppGJ1HUt4x+zeO+0\nZZ29m0sfGetVulmTlv2d5b66e+QXZFWpcPQMouSxxYTW08TbrQiZngKr40JNXftA\natvzBqIImD4II0ZX5UEVj2h98qe/ypW5xaDN7fEa5e8FkYB1TEemPaWIbNXqchcL\ntV7IJPr3Cd7Z5gZJlmujIVDPpMuSiNaal9/6nT9oqN+JSM1fx5SzrU5ssg1Vp1vv\n5Xab64uOg7wCJRB9R2GC9XD04odX6VcxUAGrZo6LR64ZSifupo3l+R5sVOc5i8NH\nskdboTzU9H7+oSdqoAyhIU717PcqeDum23DYlPE2nGBWckE+eT8CAwEAAaNjMGEw\nDgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK2hDBWl\nsbHzt/EHd0QYOooqcFPhMB8GA1UdIwQYMBaAFK2hDBWlsbHzt/EHd0QYOooqcFPh\nMA0GCSqGSIb3DQEBCwUAA4IBAQAO/718k8EnOqJDx6wweUscGTGL/QdKXUzTVRAx\nJUsjNUv49mH2HQVEW7oxszfH6cPCaupNAddMhQc4C/af6GHX8HnqfPDk27/yBQI+\nyBBvIanGgxv9c9wBbmcIaCEWJcsLp3HzXSYHmjiqkViXwCpYfkoV3Ns2m8bp+KCO\ny9XmcCKRaXkt237qmoxoh2sGmBHk2UlQtOsMC0aUQ4d7teAJG0q6pbyZEiPyKZY1\nXR/UVxMJL0Q4iVpcRS1kaNCMfqS2smbLJeNdsan8pkw1dvPhcaVTb7CvjhJtjztF\nYfDzAI5794qMlWxwilKMmUvDlPPOTen8NNHkLwWvyFCH7Doh\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEFjCCAv6gAwIBAgIJAMzYZJ+R9NBVMA0GCSqGSIb3DQEBCwUAMIGXMQswCQYD\nVQQGEwJVUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEi\nMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1h\nem9uIFJEUzEoMCYGA1UEAwwfQW1hem9uIFJEUyBQcmV2aWV3IFJvb3QgMjAxOSBD\nQTAeFw0xOTA4MjEyMjI5NDlaFw0yNDA4MjEyMjI5NDlaMIGXMQswCQYDVQQGEwJV\nUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEiMCAGA1UE\nCgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJE\nUzEoMCYGA1UEAwwfQW1hem9uIFJEUyBQcmV2aWV3IFJvb3QgMjAxOSBDQTCCASIw\nDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM7kkS6vjgKKQTPynC2NjdN5aPPV\nO71G0JJS/2ARVBVJd93JLiGovVJilfWYfwZCs4gTRSSjrUD4D4HyqCd6A+eEEtJq\nM0DEC7i0dC+9WNTsPszuB206Jy2IUmxZMIKJAA1NHSbIMjB+b6/JhbSUi7nKdbR/\nbrj83bF+RoSA+ogrgX7mQbxhmFcoZN9OGaJgYKsKWUt5Wqv627KkGodUK8mDepgD\nS3ZfoRQRx3iceETpcmHJvaIge6+vyDX3d9Z22jmvQ4AKv3py2CmU2UwuhOltFDwB\n0ddtb39vgwrJxaGfiMRHpEP1DfNLWHAnA69/pgZPwIggidS+iBPUhgucMp8CAwEA\nAaNjMGEwDgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYE\nFGnTGpQuQ2H/DZlXMQijZEhjs7TdMB8GA1UdIwQYMBaAFGnTGpQuQ2H/DZlXMQij\nZEhjs7TdMA0GCSqGSIb3DQEBCwUAA4IBAQC3xz1vQvcXAfpcZlngiRWeqU8zQAMQ\nLZPCFNv7PVk4pmqX+ZiIRo4f9Zy7TrOVcboCnqmP/b/mNq0gVF4O+88jwXJZD+f8\n/RnABMZcnGU+vK0YmxsAtYU6TIb1uhRFmbF8K80HHbj9vSjBGIQdPCbvmR2zY6VJ\nBYM+w9U9hp6H4DVMLKXPc1bFlKA5OBTgUtgkDibWJKFOEPW3UOYwp9uq6pFoN0AO\nxMTldqWFsOF3bJIlvOY0c/1EFZXu3Ns6/oCP//Ap9vumldYMUZWmbK+gK33FPOXV\n8BQ6jNC29icv7lLDpRPwjibJBXX+peDR5UK4FdYcswWEB1Tix5X8dYu6\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwgZUxCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSYwJAYDVQQDDB1BbWF6b24gUkRTIGFmLXNvdXRoLTEgUm9vdCBDQTAeFw0xOTEw\nMjgxODA2NTNaFw0yNDEwMjgxODA2NTNaMIGQMQswCQYDVQQGEwJVUzETMBEGA1UE\nCAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9u\nIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEhMB8GA1UE\nAwwYQW1hem9uIFJEUyBhZi1zb3V0aC0xIENBMIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAvtV1OqmFa8zCVQSKOvPUJERLVFtd4rZmDpImc5rIoeBk7w/P\n9lcKUJjO8R/w1a2lJXx3oQ81tiY0Piw6TpT62YWVRMWrOw8+Vxq1dNaDSFp9I8d0\nUHillSSbOk6FOrPDp+R6AwbGFqUDebbN5LFFoDKbhNmH1BVS0a6YNKpGigLRqhka\ncClPslWtPqtjbaP3Jbxl26zWzLo7OtZl98dR225pq8aApNBwmtgA7Gh60HK/cX0t\n32W94n8D+GKSg6R4MKredVFqRTi9hCCNUu0sxYPoELuM+mHiqB5NPjtm92EzCWs+\n+vgWhMc6GxG+82QSWx1Vj8sgLqtE/vLrWddf5QIDAQABo2YwZDAOBgNVHQ8BAf8E\nBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUuLB4gYVJrSKJj/Gz\npqc6yeA+RcAwHwYDVR0jBBgwFoAUEEi/WWMcBJsoGXg+EZwkQ0MscZQwDQYJKoZI\nhvcNAQELBQADggEBABauYOZxUhe9/RhzGJ8MsWCz8eKcyDVd4FCnY6Qh+9wcmYNT\nLtnD88LACtJKb/b81qYzcB0Em6+zVJ3Z9jznfr6buItE6es9wAoja22Xgv44BTHL\nrimbgMwpTt3uEMXDffaS0Ww6YWb3pSE0XYI2ISMWz+xRERRf+QqktSaL39zuiaW5\ntfZMre+YhohRa/F0ZQl3RCd6yFcLx4UoSPqQsUl97WhYzwAxZZfwvLJXOc4ATt3u\nVlCUylNDkaZztDJc/yN5XQoK9W5nOt2cLu513MGYKbuarQr8f+gYU8S+qOyuSRSP\nNRITzwCRVnsJE+2JmcRInn/NcanB7uOGqTvJ9+c=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwgZUxCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSYwJAYDVQQDDB1BbWF6b24gUkRTIGV1LXNvdXRoLTEgUm9vdCBDQTAeFw0xOTEw\nMzAyMDIxMzBaFw0yNDEwMzAyMDIxMzBaMIGQMQswCQYDVQQGEwJVUzETMBEGA1UE\nCAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9u\nIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEhMB8GA1UE\nAwwYQW1hem9uIFJEUyBldS1zb3V0aC0xIENBMIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAtEyjYcajx6xImJn8Vz1zjdmL4ANPgQXwF7+tF7xccmNAZETb\nbzb3I9i5fZlmrRaVznX+9biXVaGxYzIUIR3huQ3Q283KsDYnVuGa3mk690vhvJbB\nQIPgKa5mVwJppnuJm78KqaSpi0vxyCPe3h8h6LLFawVyWrYNZ4okli1/U582eef8\nRzJp/Ear3KgHOLIiCdPDF0rjOdCG1MOlDLixVnPn9IYOciqO+VivXBg+jtfc5J+L\nAaPm0/Yx4uELt1tkbWkm4BvTU/gBOODnYziITZM0l6Fgwvbwgq5duAtKW+h031lC\n37rEvrclqcp4wrsUYcLAWX79ZyKIlRxcAdvEhQIDAQABo2YwZDAOBgNVHQ8BAf8E\nBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU7zPyc0azQxnBCe7D\nb9KAadH1QSEwHwYDVR0jBBgwFoAUFBAFcgJe/BBuZiGeZ8STfpkgRYQwDQYJKoZI\nhvcNAQELBQADggEBAFGaNiYxg7yC/xauXPlaqLCtwbm2dKyK9nIFbF/7be8mk7Q3\nMOA0of1vGHPLVQLr6bJJpD9MAbUcm4cPAwWaxwcNpxOjYOFDaq10PCK4eRAxZWwF\nNJRIRmGsl8NEsMNTMCy8X+Kyw5EzH4vWFl5Uf2bGKOeFg0zt43jWQVOX6C+aL3Cd\npRS5MhmYpxMG8irrNOxf4NVFE2zpJOCm3bn0STLhkDcV/ww4zMzObTJhiIb5wSWn\nEXKKWhUXuRt7A2y1KJtXpTbSRHQxE++69Go1tWhXtRiULCJtf7wF2Ksm0RR/AdXT\n1uR1vKyH5KBJPX3ppYkQDukoHTFR0CpB+G84NLo=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwgZUxCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSYwJAYDVQQDDB1BbWF6b24gUkRTIG1lLXNvdXRoLTEgUm9vdCBDQTAeFw0xOTA1\nMTAyMTU4NDNaFw0yNTA2MDExMjAwMDBaMIGQMQswCQYDVQQGEwJVUzETMBEGA1UE\nCAwKV2FzaGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9u\nIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEhMB8GA1UE\nAwwYQW1hem9uIFJEUyBtZS1zb3V0aC0xIENBMIIBIjANBgkqhkiG9w0BAQEFAAOC\nAQ8AMIIBCgKCAQEAudOYPZH+ihJAo6hNYMB5izPVBe3TYhnZm8+X3IoaaYiKtsp1\nJJhkTT0CEejYIQ58Fh4QrMUyWvU8qsdK3diNyQRoYLbctsBPgxBR1u07eUJDv38/\nC1JlqgHmMnMi4y68Iy7ymv50QgAMuaBqgEBRI1R6Lfbyrb2YvH5txjJyTVMwuCfd\nYPAtZVouRz0JxmnfsHyxjE+So56uOKTDuw++Ho4HhZ7Qveej7XB8b+PIPuroknd3\nFQB5RVbXRvt5ZcVD4F2fbEdBniF7FAF4dEiofVCQGQ2nynT7dZdEIPfPdH3n7ZmE\nlAOmwHQ6G83OsiHRBLnbp+QZRgOsjkHJxT20bQIDAQABo2YwZDAOBgNVHQ8BAf8E\nBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUOEVDM7VomRH4HVdA\nQvIMNq2tXOcwHwYDVR0jBBgwFoAU54cfDjgwBx4ycBH8+/r8WXdaiqYwDQYJKoZI\nhvcNAQELBQADggEBAHhvMssj+Th8IpNePU6RH0BiL6o9c437R3Q4IEJeFdYL+nZz\nPW/rELDPvLRUNMfKM+KzduLZ+l29HahxefejYPXtvXBlq/E/9czFDD4fWXg+zVou\nuDXhyrV4kNmP4S0eqsAP/jQHPOZAMFA4yVwO9hlqmePhyDnszCh9c1PfJSBh49+b\n4w7i/L3VBOMt8j3EKYvqz0gVfpeqhJwL4Hey8UbVfJRFJMJzfNHpePqtDRAY7yjV\nPYquRaV2ab/E+/7VFkWMM4tazYz/qsYA2jSH+4xDHvYk8LnsbcrF9iuidQmEc5sb\nFgcWaSKG4DJjcI5k7AJLWcXyTDt21Ci43LE+I9Q=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECDCCAvCgAwIBAgICVIYwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MDQxNzEz\nMDRaFw0yNDA4MjIxNzA4NTBaMIGVMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEmMCQGA1UEAwwdQW1h\nem9uIFJEUyBhcC1zb3V0aC0xIDIwMTkgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQDUYOz1hGL42yUCrcsMSOoU8AeD/3KgZ4q7gP+vAz1WnY9K/kim\neWN/2Qqzlo3+mxSFQFyD4MyV3+CnCPnBl9Sh1G/F6kThNiJ7dEWSWBQGAB6HMDbC\nBaAsmUc1UIz8sLTL3fO+S9wYhA63Wun0Fbm/Rn2yk/4WnJAaMZcEtYf6e0KNa0LM\np/kN/70/8cD3iz3dDR8zOZFpHoCtf0ek80QqTich0A9n3JLxR6g6tpwoYviVg89e\nqCjQ4axxOkWWeusLeTJCcY6CkVyFvDAKvcUl1ytM5AiaUkXblE7zDFXRM4qMMRdt\nlPm8d3pFxh0fRYk8bIKnpmtOpz3RIctDrZZxAgMBAAGjZjBkMA4GA1UdDwEB/wQE\nAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBT99wKJftD3jb4sHoHG\ni3uGlH6W6TAfBgNVHSMEGDAWgBRzX2DYvMsDmPQrFzQuNlqmYP+8HzANBgkqhkiG\n9w0BAQsFAAOCAQEAZ17hhr3dII3hUfuHQ1hPWGrpJOX/G9dLzkprEIcCidkmRYl+\nhu1Pe3caRMh/17+qsoEErmnVq5jNY9X1GZL04IZH8YbHc7iRHw3HcWAdhN8633+K\njYEB2LbJ3vluCGnCejq9djDb6alOugdLMJzxOkHDhMZ6/gYbECOot+ph1tQuZXzD\ntZ7prRsrcuPBChHlPjmGy8M9z8u+kF196iNSUGC4lM8vLkHM7ycc1/ZOwRq9aaTe\niOghbQQyAEe03MWCyDGtSmDfr0qEk+CHN+6hPiaL8qKt4s+V9P7DeK4iW08ny8Ox\nAVS7u0OK/5+jKMAMrKwpYrBydOjTUTHScocyNw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICQ2QwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MDUxODQ2\nMjlaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyBzYS1lYXN0LTEgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBAMMvR+ReRnOzqJzoaPipNTt1Z2VA968jlN1+SYKUrYM3No+Vpz0H\nM6Tn0oYB66ByVsXiGc28ulsqX1HbHsxqDPwvQTKvO7SrmDokoAkjJgLocOLUAeld\n5AwvUjxGRP6yY90NV7X786MpnYb2Il9DIIaV9HjCmPt+rjy2CZjS0UjPjCKNfB8J\nbFjgW6GGscjeyGb/zFwcom5p4j0rLydbNaOr9wOyQrtt3ZQWLYGY9Zees/b8pmcc\nJt+7jstZ2UMV32OO/kIsJ4rMUn2r/uxccPwAc1IDeRSSxOrnFKhW3Cu69iB3bHp7\nJbawY12g7zshE4I14sHjv3QoXASoXjx4xgMCAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFI1Fc/Ql2jx+oJPgBVYq\nccgP0pQ8MB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQB4VVVabVp70myuYuZ3vltQIWqSUMhkaTzehMgGcHjMf9iLoZ/I\n93KiFUSGnek5cRePyS9wcpp0fcBT3FvkjpUdCjVtdttJgZFhBxgTd8y26ImdDDMR\n4+BUuhI5msvjL08f+Vkkpu1GQcGmyFVPFOy/UY8iefu+QyUuiBUnUuEDd49Hw0Fn\n/kIPII6Vj82a2mWV/Q8e+rgN8dIRksRjKI03DEoP8lhPlsOkhdwU6Uz9Vu6NOB2Q\nLs1kbcxAc7cFSyRVJEhh12Sz9d0q/CQSTFsVJKOjSNQBQfVnLz1GwO/IieUEAr4C\njkTntH0r1LX5b/GwN4R887LvjAEdTbg1his7\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECDCCAvCgAwIBAgIDAIkHMA0GCSqGSIb3DQEBCwUAMIGPMQswCQYDVQQGEwJV\nUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEiMCAGA1UE\nCgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJE\nUzEgMB4GA1UEAwwXQW1hem9uIFJEUyBSb290IDIwMTkgQ0EwHhcNMTkwOTA2MTc0\nMDIxWhcNMjQwODIyMTcwODUwWjCBlDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldh\nc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxIjAgBgNVBAoMGUFtYXpvbiBXZWIg\nU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxJTAjBgNVBAMMHEFt\nYXpvbiBSRFMgdXMtd2VzdC0xIDIwMTkgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQDD2yzbbAl77OofTghDMEf624OvU0eS9O+lsdO0QlbfUfWa1Kd6\n0WkgjkLZGfSRxEHMCnrv4UPBSK/Qwn6FTjkDLgemhqBtAnplN4VsoDL+BkRX4Wwq\n/dSQJE2b+0hm9w9UMVGFDEq1TMotGGTD2B71eh9HEKzKhGzqiNeGsiX4VV+LJzdH\nuM23eGisNqmd4iJV0zcAZ+Gbh2zK6fqTOCvXtm7Idccv8vZZnyk1FiWl3NR4WAgK\nAkvWTIoFU3Mt7dIXKKClVmvssG8WHCkd3Xcb4FHy/G756UZcq67gMMTX/9fOFM/v\nl5C0+CHl33Yig1vIDZd+fXV1KZD84dEJfEvHAgMBAAGjZjBkMA4GA1UdDwEB/wQE\nAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBR+ap20kO/6A7pPxo3+\nT3CfqZpQWjAfBgNVHSMEGDAWgBRzX2DYvMsDmPQrFzQuNlqmYP+8HzANBgkqhkiG\n9w0BAQsFAAOCAQEAHCJky2tPjPttlDM/RIqExupBkNrnSYnOK4kr9xJ3sl8UF2DA\nPAnYsjXp3rfcjN/k/FVOhxwzi3cXJF/2Tjj39Bm/OEfYTOJDNYtBwB0VVH4ffa/6\ntZl87jaIkrxJcreeeHqYMnIxeN0b/kliyA+a5L2Yb0VPjt9INq34QDc1v74FNZ17\n4z8nr1nzg4xsOWu0Dbjo966lm4nOYIGBRGOKEkHZRZ4mEiMgr3YLkv8gSmeitx57\nZ6dVemNtUic/LVo5Iqw4n3TBS0iF2C1Q1xT/s3h+0SXZlfOWttzSluDvoMv5PvCd\npFjNn+aXLAALoihL1MJSsxydtsLjOBro5eK0Vw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDDCCAvSgAwIBAgICOFAwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTAxNzQ2\nMjFaFw0yNDA4MjIxNzA4NTBaMIGZMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEqMCgGA1UEAwwhQW1h\nem9uIFJEUyBhcC1ub3J0aGVhc3QtMiAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAzU72e6XbaJbi4HjJoRNjKxzUEuChKQIt7k3CWzNnmjc5\n8I1MjCpa2W1iw1BYVysXSNSsLOtUsfvBZxi/1uyMn5ZCaf9aeoA9UsSkFSZBjOCN\nDpKPCmfV1zcEOvJz26+1m8WDg+8Oa60QV0ou2AU1tYcw98fOQjcAES0JXXB80P2s\n3UfkNcnDz+l4k7j4SllhFPhH6BQ4lD2NiFAP4HwoG6FeJUn45EPjzrydxjq6v5Fc\ncQ8rGuHADVXotDbEhaYhNjIrsPL+puhjWfhJjheEw8c4whRZNp6gJ/b6WEes/ZhZ\nh32DwsDsZw0BfRDUMgUn8TdecNexHUw8vQWeC181hwIDAQABo2YwZDAOBgNVHQ8B\nAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUwW9bWgkWkr0U\nlrOsq2kvIdrECDgwHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJ\nKoZIhvcNAQELBQADggEBAEugF0Gj7HVhX0ehPZoGRYRt3PBuI2YjfrrJRTZ9X5wc\n9T8oHmw07mHmNy1qqWvooNJg09bDGfB0k5goC2emDiIiGfc/kvMLI7u+eQOoMKj6\nmkfCncyRN3ty08Po45vTLBFZGUvtQmjM6yKewc4sXiASSBmQUpsMbiHRCL72M5qV\nobcJOjGcIdDTmV1BHdWT+XcjynsGjUqOvQWWhhLPrn4jWe6Xuxll75qlrpn3IrIx\nCRBv/5r7qbcQJPOgwQsyK4kv9Ly8g7YT1/vYBlR3cRsYQjccw5ceWUj2DrMVWhJ4\nprf+E3Aa4vYmLLOUUvKnDQ1k3RGNu56V0tonsQbfsaM=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECjCCAvKgAwIBAgICEzUwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTAyMDUy\nMjVaFw0yNDA4MjIxNzA4NTBaMIGXMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEoMCYGA1UEAwwfQW1h\nem9uIFJEUyBjYS1jZW50cmFsLTEgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAOxHqdcPSA2uBjsCP4DLSlqSoPuQ/X1kkJLusVRKiQE2zayB\nviuCBt4VB9Qsh2rW3iYGM+usDjltGnI1iUWA5KHcvHszSMkWAOYWLiMNKTlg6LCp\nXnE89tvj5dIH6U8WlDvXLdjB/h30gW9JEX7S8supsBSci2GxEzb5mRdKaDuuF/0O\nqvz4YE04pua3iZ9QwmMFuTAOYzD1M72aOpj+7Ac+YLMM61qOtU+AU6MndnQkKoQi\nqmUN2A9IFaqHFzRlSdXwKCKUA4otzmz+/N3vFwjb5F4DSsbsrMfjeHMo6o/nb6Nh\nYDb0VJxxPee6TxSuN7CQJ2FxMlFUezcoXqwqXD0CAwEAAaNmMGQwDgYDVR0PAQH/\nBAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFDGGpon9WfIpsggE\nCxHq8hZ7E2ESMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqG\nSIb3DQEBCwUAA4IBAQAvpeQYEGZvoTVLgV9rd2+StPYykMsmFjWQcyn3dBTZRXC2\nlKq7QhQczMAOhEaaN29ZprjQzsA2X/UauKzLR2Uyqc2qOeO9/YOl0H3qauo8C/W9\nr8xqPbOCDLEXlOQ19fidXyyEPHEq5WFp8j+fTh+s8WOx2M7IuC0ANEetIZURYhSp\nxl9XOPRCJxOhj7JdelhpweX0BJDNHeUFi0ClnFOws8oKQ7sQEv66d5ddxqqZ3NVv\nRbCvCtEutQMOUMIuaygDlMn1anSM8N7Wndx8G6+Uy67AnhjGx7jw/0YPPxopEj6x\nJXP8j0sJbcT9K/9/fPVLNT25RvQ/93T2+IQL4Ca2\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICYpgwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTExNzMx\nNDhaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyBldS13ZXN0LTEgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBAMk3YdSZ64iAYp6MyyKtYJtNzv7zFSnnNf6vv0FB4VnfITTMmOyZ\nLXqKAT2ahZ00hXi34ewqJElgU6eUZT/QlzdIu359TEZyLVPwURflL6SWgdG01Q5X\nO++7fSGcBRyIeuQWs9FJNIIqK8daF6qw0Rl5TXfu7P9dBc3zkgDXZm2DHmxGDD69\n7liQUiXzoE1q2Z9cA8+jirDioJxN9av8hQt12pskLQumhlArsMIhjhHRgF03HOh5\ntvi+RCfihVOxELyIRTRpTNiIwAqfZxxTWFTgfn+gijTmd0/1DseAe82aYic8JbuS\nEMbrDduAWsqrnJ4GPzxHKLXX0JasCUcWyMECAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFPLtsq1NrwJXO13C9eHt\nsLY11AGwMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQAnWBKj5xV1A1mYd0kIgDdkjCwQkiKF5bjIbGkT3YEFFbXoJlSP\n0lZZ/hDaOHI8wbLT44SzOvPEEmWF9EE7SJzkvSdQrUAWR9FwDLaU427ALI3ngNHy\nlGJ2hse1fvSRNbmg8Sc9GBv8oqNIBPVuw+AJzHTacZ1OkyLZrz1c1QvwvwN2a+Jd\nvH0V0YIhv66llKcYDMUQJAQi4+8nbRxXWv6Gq3pvrFoorzsnkr42V3JpbhnYiK+9\nnRKd4uWl62KRZjGkfMbmsqZpj2fdSWMY1UGyN1k+kDmCSWYdrTRDP0xjtIocwg+A\nJ116n4hV/5mbA0BaPiS2krtv17YAeHABZcvz\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECjCCAvKgAwIBAgICV2YwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTExOTM2\nMjBaFw0yNDA4MjIxNzA4NTBaMIGXMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEoMCYGA1UEAwwfQW1h\nem9uIFJEUyBldS1jZW50cmFsLTEgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBAMEx54X2pHVv86APA0RWqxxRNmdkhAyp2R1cFWumKQRofoFv\nn+SPXdkpIINpMuEIGJANozdiEz7SPsrAf8WHyD93j/ZxrdQftRcIGH41xasetKGl\nI67uans8d+pgJgBKGb/Z+B5m+UsIuEVekpvgpwKtmmaLFC/NCGuSsJoFsRqoa6Gh\nm34W6yJoY87UatddCqLY4IIXaBFsgK9Q/wYzYLbnWM6ZZvhJ52VMtdhcdzeTHNW0\n5LGuXJOF7Ahb4JkEhoo6TS2c0NxB4l4MBfBPgti+O7WjR3FfZHpt18A6Zkq6A2u6\nD/oTSL6c9/3sAaFTFgMyL3wHb2YlW0BPiljZIqECAwEAAaNmMGQwDgYDVR0PAQH/\nBAQDAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFOcAToAc6skWffJa\nTnreaswAfrbcMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqG\nSIb3DQEBCwUAA4IBAQA1d0Whc1QtspK496mFWfFEQNegLh0a9GWYlJm+Htcj5Nxt\nDAIGXb+8xrtOZFHmYP7VLCT5Zd2C+XytqseK/+s07iAr0/EPF+O2qcyQWMN5KhgE\ncXw2SwuP9FPV3i+YAm11PBVeenrmzuk9NrdHQ7TxU4v7VGhcsd2C++0EisrmquWH\nmgIfmVDGxphwoES52cY6t3fbnXmTkvENvR+h3rj+fUiSz0aSo+XZUGHPgvuEKM/W\nCBD9Smc9CBoBgvy7BgHRgRUmwtABZHFUIEjHI5rIr7ZvYn+6A0O6sogRfvVYtWFc\nqpyrW1YX8mD0VlJ8fGKM3G+aCOsiiPKDV/Uafrm+\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECDCCAvCgAwIBAgICGAcwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTIxODE5\nNDRaFw0yNDA4MjIxNzA4NTBaMIGVMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEmMCQGA1UEAwwdQW1h\nem9uIFJEUyBldS1ub3J0aC0xIDIwMTkgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQCiIYnhe4UNBbdBb/nQxl5giM0XoVHWNrYV5nB0YukA98+TPn9v\nAoj1RGYmtryjhrf01Kuv8SWO+Eom95L3zquoTFcE2gmxCfk7bp6qJJ3eHOJB+QUO\nXsNRh76fwDzEF1yTeZWH49oeL2xO13EAx4PbZuZpZBttBM5zAxgZkqu4uWQczFEs\nJXfla7z2fvWmGcTagX10O5C18XaFroV0ubvSyIi75ue9ykg/nlFAeB7O0Wxae88e\nuhiBEFAuLYdqWnsg3459NfV8Yi1GnaitTym6VI3tHKIFiUvkSiy0DAlAGV2iiyJE\nq+DsVEO4/hSINJEtII4TMtysOsYPpINqeEzRAgMBAAGjZjBkMA4GA1UdDwEB/wQE\nAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBRR0UpnbQyjnHChgmOc\nhnlc0PogzTAfBgNVHSMEGDAWgBRzX2DYvMsDmPQrFzQuNlqmYP+8HzANBgkqhkiG\n9w0BAQsFAAOCAQEAKJD4xVzSf4zSGTBJrmamo86jl1NHQxXUApAZuBZEc8tqC6TI\nT5CeoSr9CMuVC8grYyBjXblC4OsM5NMvmsrXl/u5C9dEwtBFjo8mm53rOOIm1fxl\nI1oYB/9mtO9ANWjkykuLzWeBlqDT/i7ckaKwalhLODsRDO73vRhYNjsIUGloNsKe\npxw3dzHwAZx4upSdEVG4RGCZ1D0LJ4Gw40OfD69hfkDfRVVxKGrbEzqxXRvovmDc\ntKLdYZO/6REoca36v4BlgIs1CbUXJGLSXUwtg7YXGLSVBJ/U0+22iGJmBSNcoyUN\ncjPFD9JQEhDDIYYKSGzIYpvslvGc4T5ISXFiuQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICZIEwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTIyMTMy\nMzJaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyBldS13ZXN0LTIgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBALGiwqjiF7xIjT0Sx7zB3764K2T2a1DHnAxEOr+/EIftWKxWzT3u\nPFwS2eEZcnKqSdRQ+vRzonLBeNLO4z8aLjQnNbkizZMBuXGm4BqRm1Kgq3nlLDQn\n7YqdijOq54SpShvR/8zsO4sgMDMmHIYAJJOJqBdaus2smRt0NobIKc0liy7759KB\n6kmQ47Gg+kfIwxrQA5zlvPLeQImxSoPi9LdbRoKvu7Iot7SOa+jGhVBh3VdqndJX\n7tm/saj4NE375csmMETFLAOXjat7zViMRwVorX4V6AzEg1vkzxXpA9N7qywWIT5Y\nfYaq5M8i6vvLg0CzrH9fHORtnkdjdu1y+0MCAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFFOhOx1yt3Z7mvGB9jBv\n2ymdZwiOMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQBehqY36UGDvPVU9+vtaYGr38dBbp+LzkjZzHwKT1XJSSUc2wqM\nhnCIQKilonrTIvP1vmkQi8qHPvDRtBZKqvz/AErW/ZwQdZzqYNFd+BmOXaeZWV0Q\noHtDzXmcwtP8aUQpxN0e1xkWb1E80qoy+0uuRqb/50b/R4Q5qqSfJhkn6z8nwB10\n7RjLtJPrK8igxdpr3tGUzfAOyiPrIDncY7UJaL84GFp7WWAkH0WG3H8Y8DRcRXOU\nmqDxDLUP3rNuow3jnGxiUY+gGX5OqaZg4f4P6QzOSmeQYs6nLpH0PiN00+oS1BbD\nbpWdZEttILPI+vAYkU4QuBKKDjJL6HbSd+cn\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECDCCAvCgAwIBAgIDAIVCMA0GCSqGSIb3DQEBCwUAMIGPMQswCQYDVQQGEwJV\nUzEQMA4GA1UEBwwHU2VhdHRsZTETMBEGA1UECAwKV2FzaGluZ3RvbjEiMCAGA1UE\nCgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJE\nUzEgMB4GA1UEAwwXQW1hem9uIFJEUyBSb290IDIwMTkgQ0EwHhcNMTkwOTEzMTcw\nNjQxWhcNMjQwODIyMTcwODUwWjCBlDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldh\nc2hpbmd0b24xEDAOBgNVBAcMB1NlYXR0bGUxIjAgBgNVBAoMGUFtYXpvbiBXZWIg\nU2VydmljZXMsIEluYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxJTAjBgNVBAMMHEFt\nYXpvbiBSRFMgdXMtZWFzdC0yIDIwMTkgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB\nDwAwggEKAoIBAQDE+T2xYjUbxOp+pv+gRA3FO24+1zCWgXTDF1DHrh1lsPg5k7ht\n2KPYzNc+Vg4E+jgPiW0BQnA6jStX5EqVh8BU60zELlxMNvpg4KumniMCZ3krtMUC\nau1NF9rM7HBh+O+DYMBLK5eSIVt6lZosOb7bCi3V6wMLA8YqWSWqabkxwN4w0vXI\n8lu5uXXFRemHnlNf+yA/4YtN4uaAyd0ami9+klwdkZfkrDOaiy59haOeBGL8EB/c\ndbJJlguHH5CpCscs3RKtOOjEonXnKXldxarFdkMzi+aIIjQ8GyUOSAXHtQHb3gZ4\nnS6Ey0CMlwkB8vUObZU9fnjKJcL5QCQqOfwvAgMBAAGjZjBkMA4GA1UdDwEB/wQE\nAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBQUPuRHohPxx4VjykmH\n6usGrLL1ETAfBgNVHSMEGDAWgBRzX2DYvMsDmPQrFzQuNlqmYP+8HzANBgkqhkiG\n9w0BAQsFAAOCAQEAUdR9Vb3y33Yj6X6KGtuthZ08SwjImVQPtknzpajNE5jOJAh8\nquvQnU9nlnMO85fVDU1Dz3lLHGJ/YG1pt1Cqq2QQ200JcWCvBRgdvH6MjHoDQpqZ\nHvQ3vLgOGqCLNQKFuet9BdpsHzsctKvCVaeBqbGpeCtt3Hh/26tgx0rorPLw90A2\nV8QSkZJjlcKkLa58N5CMM8Xz8KLWg3MZeT4DmlUXVCukqK2RGuP2L+aME8dOxqNv\nOnOz1zrL5mR2iJoDpk8+VE/eBDmJX40IJk6jBjWoxAO/RXq+vBozuF5YHN1ujE92\ntO8HItgTp37XT8bJBAiAnt5mxw+NLSqtxk2QdQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDDCCAvSgAwIBAgICY4kwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTMyMDEx\nNDJaFw0yNDA4MjIxNzA4NTBaMIGZMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEqMCgGA1UEAwwhQW1h\nem9uIFJEUyBhcC1zb3V0aGVhc3QtMSAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAr5u9OuLL/OF/fBNUX2kINJLzFl4DnmrhnLuSeSnBPgbb\nqddjf5EFFJBfv7IYiIWEFPDbDG5hoBwgMup5bZDbas+ZTJTotnnxVJTQ6wlhTmns\neHECcg2pqGIKGrxZfbQhlj08/4nNAPvyYCTS0bEcmQ1emuDPyvJBYDDLDU6AbCB5\n6Z7YKFQPTiCBblvvNzchjLWF9IpkqiTsPHiEt21sAdABxj9ityStV3ja/W9BfgxH\nwzABSTAQT6FbDwmQMo7dcFOPRX+hewQSic2Rn1XYjmNYzgEHisdUsH7eeXREAcTw\n61TRvaLH8AiOWBnTEJXPAe6wYfrcSd1pD0MXpoB62wIDAQABo2YwZDAOBgNVHQ8B\nAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUytwMiomQOgX5\nIchd+2lDWRUhkikwHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJ\nKoZIhvcNAQELBQADggEBACf6lRDpfCD7BFRqiWM45hqIzffIaysmVfr+Jr+fBTjP\nuYe/ba1omSrNGG23bOcT9LJ8hkQJ9d+FxUwYyICQNWOy6ejicm4z0C3VhphbTPqj\nyjpt9nG56IAcV8BcRJh4o/2IfLNzC/dVuYJV8wj7XzwlvjysenwdrJCoLadkTr1h\neIdG6Le07sB9IxrGJL9e04afk37h7c8ESGSE4E+oS4JQEi3ATq8ne1B9DQ9SasXi\nIRmhNAaISDzOPdyLXi9N9V9Lwe/DHcja7hgLGYx3UqfjhLhOKwp8HtoZORixAmOI\nHfILgNmwyugAbuZoCazSKKBhQ0wgO0WZ66ZKTMG8Oho=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICUYkwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTYxODIx\nMTVaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyB1cy13ZXN0LTIgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBANCEZBZyu6yJQFZBJmSUZfSZd3Ui2gitczMKC4FLr0QzkbxY+cLa\nuVONIOrPt4Rwi+3h/UdnUg917xao3S53XDf1TDMFEYp4U8EFPXqCn/GXBIWlU86P\nPvBN+gzw3nS+aco7WXb+woTouvFVkk8FGU7J532llW8o/9ydQyDIMtdIkKTuMfho\nOiNHSaNc+QXQ32TgvM9A/6q7ksUoNXGCP8hDOkSZ/YOLiI5TcdLh/aWj00ziL5bj\npvytiMZkilnc9dLY9QhRNr0vGqL0xjmWdoEXz9/OwjmCihHqJq+20MJPsvFm7D6a\n2NKybR9U+ddrjb8/iyLOjURUZnj5O+2+OPcCAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFEBxMBdv81xuzqcK5TVu\npHj+Aor8MB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQBZkfiVqGoJjBI37aTlLOSjLcjI75L5wBrwO39q+B4cwcmpj58P\n3sivv+jhYfAGEbQnGRzjuFoyPzWnZ1DesRExX+wrmHsLLQbF2kVjLZhEJMHF9eB7\nGZlTPdTzHErcnuXkwA/OqyXMpj9aghcQFuhCNguEfnROY9sAoK2PTfnTz9NJHL+Q\nUpDLEJEUfc0GZMVWYhahc0x38ZnSY2SKacIPECQrTI0KpqZv/P+ijCEcMD9xmYEb\njL4en+XKS1uJpw5fIU5Sj0MxhdGstH6S84iAE5J3GM3XHklGSFwwqPYvuTXvANH6\nuboynxRgSae59jIlAK6Jrr6GWMwQRbgcaAlW\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDDCCAvSgAwIBAgICEkYwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTYxOTUz\nNDdaFw0yNDA4MjIxNzA4NTBaMIGZMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEqMCgGA1UEAwwhQW1h\nem9uIFJEUyBhcC1zb3V0aGVhc3QtMiAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAufodI2Flker8q7PXZG0P0vmFSlhQDw907A6eJuF/WeMo\nGHnll3b4S6nC3oRS3nGeRMHbyU2KKXDwXNb3Mheu+ox+n5eb/BJ17eoj9HbQR1cd\ngEkIciiAltf8gpMMQH4anP7TD+HNFlZnP7ii3geEJB2GGXSxgSWvUzH4etL67Zmn\nTpGDWQMB0T8lK2ziLCMF4XAC/8xDELN/buHCNuhDpxpPebhct0T+f6Arzsiswt2j\n7OeNeLLZwIZvVwAKF7zUFjC6m7/VmTQC8nidVY559D6l0UhhU0Co/txgq3HVsMOH\nPbxmQUwJEKAzQXoIi+4uZzHFZrvov/nDTNJUhC6DqwIDAQABo2YwZDAOBgNVHQ8B\nAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUwaZpaCme+EiV\nM5gcjeHZSTgOn4owHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJ\nKoZIhvcNAQELBQADggEBAAR6a2meCZuXO2TF9bGqKGtZmaah4pH2ETcEVUjkvXVz\nsl+ZKbYjrun+VkcMGGKLUjS812e7eDF726ptoku9/PZZIxlJB0isC/0OyixI8N4M\nNsEyvp52XN9QundTjkl362bomPnHAApeU0mRbMDRR2JdT70u6yAzGLGsUwMkoNnw\n1VR4XKhXHYGWo7KMvFrZ1KcjWhubxLHxZWXRulPVtGmyWg/MvE6KF+2XMLhojhUL\n+9jB3Fpn53s6KMx5tVq1x8PukHmowcZuAF8k+W4gk8Y68wIwynrdZrKRyRv6CVtR\nFZ8DeJgoNZT3y/GT254VqMxxfuy2Ccb/RInd16tEvVk=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDDCCAvSgAwIBAgICOYIwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTcyMDA1\nMjlaFw0yNDA4MjIxNzA4NTBaMIGZMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEqMCgGA1UEAwwhQW1h\nem9uIFJEUyBhcC1ub3J0aGVhc3QtMyAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEA4dMak8W+XW8y/2F6nRiytFiA4XLwePadqWebGtlIgyCS\nkbug8Jv5w7nlMkuxOxoUeD4WhI6A9EkAn3r0REM/2f0aYnd2KPxeqS2MrtdxxHw1\nxoOxk2x0piNSlOz6yog1idsKR5Wurf94fvM9FdTrMYPPrDabbGqiBMsZZmoHLvA3\nZ+57HEV2tU0Ei3vWeGIqnNjIekS+E06KhASxrkNU5vi611UsnYZlSi0VtJsH4UGV\nLhnHl53aZL0YFO5mn/fzuNG/51qgk/6EFMMhaWInXX49Dia9FnnuWXwVwi6uX1Wn\n7kjoHi5VtmC8ZlGEHroxX2DxEr6bhJTEpcLMnoQMqwIDAQABo2YwZDAOBgNVHQ8B\nAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQUsUI5Cb3SWB8+\ngv1YLN/ABPMdxSAwHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJ\nKoZIhvcNAQELBQADggEBAJAF3E9PM1uzVL8YNdzb6fwJrxxqI2shvaMVmC1mXS+w\nG0zh4v2hBZOf91l1EO0rwFD7+fxoI6hzQfMxIczh875T6vUXePKVOCOKI5wCrDad\nzQbVqbFbdhsBjF4aUilOdtw2qjjs9JwPuB0VXN4/jY7m21oKEOcnpe36+7OiSPjN\nxngYewCXKrSRqoj3mw+0w/+exYj3Wsush7uFssX18av78G+ehKPIVDXptOCP/N7W\n8iKVNeQ2QGTnu2fzWsGUSvMGyM7yqT+h1ILaT//yQS8er511aHMLc142bD4D9VSy\nDgactwPDTShK/PXqhvNey9v/sKXm4XatZvwcc8KYlW4=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDDCCAvSgAwIBAgICcEUwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTgxNjU2\nMjBaFw0yNDA4MjIxNzA4NTBaMIGZMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzEqMCgGA1UEAwwhQW1h\nem9uIFJEUyBhcC1ub3J0aGVhc3QtMSAyMDE5IENBMIIBIjANBgkqhkiG9w0BAQEF\nAAOCAQ8AMIIBCgKCAQEAndtkldmHtk4TVQAyqhAvtEHSMb6pLhyKrIFved1WO3S7\n+I+bWwv9b2W/ljJxLq9kdT43bhvzonNtI4a1LAohS6bqyirmk8sFfsWT3akb+4Sx\n1sjc8Ovc9eqIWJCrUiSvv7+cS7ZTA9AgM1PxvHcsqrcUXiK3Jd/Dax9jdZE1e15s\nBEhb2OEPE+tClFZ+soj8h8Pl2Clo5OAppEzYI4LmFKtp1X/BOf62k4jviXuCSst3\nUnRJzE/CXtjmN6oZySVWSe0rQYuyqRl6//9nK40cfGKyxVnimB8XrrcxUN743Vud\nQQVU0Esm8OVTX013mXWQXJHP2c0aKkog8LOga0vobQIDAQABo2YwZDAOBgNVHQ8B\nAf8EBAMCAQYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQULmoOS1mFSjj+\nsnUPx4DgS3SkLFYwHwYDVR0jBBgwFoAUc19g2LzLA5j0Kxc0LjZapmD/vB8wDQYJ\nKoZIhvcNAQELBQADggEBAAkVL2P1M2/G9GM3DANVAqYOwmX0Xk58YBHQu6iiQg4j\nb4Ky/qsZIsgT7YBsZA4AOcPKQFgGTWhe9pvhmXqoN3RYltN8Vn7TbUm/ZVDoMsrM\ngwv0+TKxW1/u7s8cXYfHPiTzVSJuOogHx99kBW6b2f99GbP7O1Sv3sLq4j6lVvBX\nFiacf5LAWC925nvlTzLlBgIc3O9xDtFeAGtZcEtxZJ4fnGXiqEnN4539+nqzIyYq\nnvlgCzyvcfRAxwltrJHuuRu6Maw5AGcd2Y0saMhqOVq9KYKFKuD/927BTrbd2JVf\n2sGWyuPZPCk3gq+5pCjbD0c6DkhcMGI6WwxvM5V/zSM=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICJDQwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTgxNzAz\nMTVaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyBldS13ZXN0LTMgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBAL9bL7KE0n02DLVtlZ2PL+g/BuHpMYFq2JnE2RgompGurDIZdjmh\n1pxfL3nT+QIVMubuAOy8InRfkRxfpxyjKYdfLJTPJG+jDVL+wDcPpACFVqoV7Prg\npVYEV0lc5aoYw4bSeYFhdzgim6F8iyjoPnObjll9mo4XsHzSoqJLCd0QC+VG9Fw2\nq+GDRZrLRmVM2oNGDRbGpGIFg77aRxRapFZa8SnUgs2AqzuzKiprVH5i0S0M6dWr\ni+kk5epmTtkiDHceX+dP/0R1NcnkCPoQ9TglyXyPdUdTPPRfKCq12dftqll+u4mV\nARdN6WFjovxax8EAP2OAUTi1afY+1JFMj+sCAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFLfhrbrO5exkCVgxW0x3\nY2mAi8lNMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQAigQ5VBNGyw+OZFXwxeJEAUYaXVoP/qrhTOJ6mCE2DXUVEoJeV\nSxScy/TlFA9tJXqmit8JH8VQ/xDL4ubBfeMFAIAo4WzNWDVoeVMqphVEcDWBHsI1\nAETWzfsapRS9yQekOMmxg63d/nV8xewIl8aNVTHdHYXMqhhik47VrmaVEok1UQb3\nO971RadLXIEbVd9tjY5bMEHm89JsZDnDEw1hQXBb67Elu64OOxoKaHBgUH8AZn/2\nzFsL1ynNUjOhCSAA15pgd1vjwc0YsBbAEBPcHBWYBEyME6NLNarjOzBl4FMtATSF\nwWCKRGkvqN8oxYhwR2jf2rR5Mu4DWkK5Q8Ep\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBzCCAu+gAwIBAgICJVUwDQYJKoZIhvcNAQELBQAwgY8xCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSAwHgYDVQQDDBdBbWF6b24gUkRTIFJvb3QgMjAxOSBDQTAeFw0xOTA5MTkxODE2\nNTNaFw0yNDA4MjIxNzA4NTBaMIGUMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2Fz\naGluZ3RvbjEQMA4GA1UEBwwHU2VhdHRsZTEiMCAGA1UECgwZQW1hem9uIFdlYiBT\nZXJ2aWNlcywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzElMCMGA1UEAwwcQW1h\nem9uIFJEUyB1cy1lYXN0LTEgMjAxOSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\nADCCAQoCggEBAM3i/k2u6cqbMdcISGRvh+m+L0yaSIoOXjtpNEoIftAipTUYoMhL\nInXGlQBVA4shkekxp1N7HXe1Y/iMaPEyb3n+16pf3vdjKl7kaSkIhjdUz3oVUEYt\ni8Z/XeJJ9H2aEGuiZh3kHixQcZczn8cg3dA9aeeyLSEnTkl/npzLf//669Ammyhs\nXcAo58yvT0D4E0D/EEHf2N7HRX7j/TlyWvw/39SW0usiCrHPKDLxByLojxLdHzso\nQIp/S04m+eWn6rmD+uUiRteN1hI5ncQiA3wo4G37mHnUEKo6TtTUh+sd/ku6a8HK\nglMBcgqudDI90s1OpuIAWmuWpY//8xEG2YECAwEAAaNmMGQwDgYDVR0PAQH/BAQD\nAgEGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0OBBYEFPqhoWZcrVY9mU7tuemR\nRBnQIj1jMB8GA1UdIwQYMBaAFHNfYNi8ywOY9CsXNC42WqZg/7wfMA0GCSqGSIb3\nDQEBCwUAA4IBAQB6zOLZ+YINEs72heHIWlPZ8c6WY8MDU+Be5w1M+BK2kpcVhCUK\nPJO4nMXpgamEX8DIiaO7emsunwJzMSvavSPRnxXXTKIc0i/g1EbiDjnYX9d85DkC\nE1LaAUCmCZBVi9fIe0H2r9whIh4uLWZA41oMnJx/MOmo3XyMfQoWcqaSFlMqfZM4\n0rNoB/tdHLNuV4eIdaw2mlHxdWDtF4oH+HFm+2cVBUVC1jXKrFv/euRVtsTT+A6i\nh2XBHKxQ1Y4HgAn0jACP2QSPEmuoQEIa57bEKEcZsBR8SDY6ZdTd2HLRIApcCOSF\nMRM8CKLeF658I0XgF8D5EsYoKPsA+74Z+jDH\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEETCCAvmgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwgZQxCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSUwIwYDVQQDDBxBbWF6b24gUkRTIEJldGEgUm9vdCAyMDE5IENBMB4XDTE5MDgy\nMDE3MTAwN1oXDTI0MDgxOTE3MzgyNlowgZkxCzAJBgNVBAYTAlVTMRMwEQYDVQQI\nDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMSIwIAYDVQQKDBlBbWF6b24g\nV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMSowKAYDVQQD\nDCFBbWF6b24gUkRTIEJldGEgdXMtZWFzdC0xIDIwMTkgQ0EwggEiMA0GCSqGSIb3\nDQEBAQUAA4IBDwAwggEKAoIBAQDTNCOlotQcLP8TP82U2+nk0bExVuuMVOgFeVMx\nvbUHZQeIj9ikjk+jm6eTDnnkhoZcmJiJgRy+5Jt69QcRbb3y3SAU7VoHgtraVbxF\nQDh7JEHI9tqEEVOA5OvRrDRcyeEYBoTDgh76ROco2lR+/9uCvGtHVrMCtG7BP7ZB\nsSVNAr1IIRZZqKLv2skKT/7mzZR2ivcw9UeBBTUf8xsfiYVBvMGoEsXEycjYdf6w\nWV+7XS7teNOc9UgsFNN+9AhIBc1jvee5E//72/4F8pAttAg/+mmPUyIKtekNJ4gj\nOAR2VAzGx1ybzWPwIgOudZFHXFduxvq4f1hIRPH0KbQ/gkRrAgMBAAGjZjBkMA4G\nA1UdDwEB/wQEAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQWBBTkvpCD\n6C43rar9TtJoXr7q8dkrrjAfBgNVHSMEGDAWgBStoQwVpbGx87fxB3dEGDqKKnBT\n4TANBgkqhkiG9w0BAQsFAAOCAQEAJd9fOSkwB3uVdsS+puj6gCER8jqmhd3g/J5V\nZjk9cKS8H0e8pq/tMxeJ8kpurPAzUk5RkCspGt2l0BSwmf3ahr8aJRviMX6AuW3/\ng8aKplTvq/WMNGKLXONa3Sq8591J+ce8gtOX/1rDKmFI4wQ/gUzOSYiT991m7QKS\nFr6HMgFuz7RNJbb3Fy5cnurh8eYWA7mMv7laiLwTNsaro5qsqErD5uXuot6o9beT\na+GiKinEur35tNxAr47ax4IRubuIzyfCrezjfKc5raVV2NURJDyKP0m0CCaffAxE\nqn2dNfYc3v1D8ypg3XjHlOzRo32RB04o8ALHMD9LSwsYDLpMag==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEFzCCAv+gAwIBAgICFSUwDQYJKoZIhvcNAQELBQAwgZcxCzAJBgNVBAYTAlVT\nMRAwDgYDVQQHDAdTZWF0dGxlMRMwEQYDVQQIDApXYXNoaW5ndG9uMSIwIAYDVQQK\nDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRT\nMSgwJgYDVQQDDB9BbWF6b24gUkRTIFByZXZpZXcgUm9vdCAyMDE5IENBMB4XDTE5\nMDgyMTIyMzk0N1oXDTI0MDgyMTIyMjk0OVowgZwxCzAJBgNVBAYTAlVTMRMwEQYD\nVQQIDApXYXNoaW5ndG9uMRAwDgYDVQQHDAdTZWF0dGxlMSIwIAYDVQQKDBlBbWF6\nb24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMS0wKwYD\nVQQDDCRBbWF6b24gUkRTIFByZXZpZXcgdXMtZWFzdC0yIDIwMTkgQ0EwggEiMA0G\nCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQD0dB/U7qRnSf05wOi7m10Pa2uPMTJv\nr6U/3Y17a5prq5Zr4++CnSUYarG51YuIf355dKs+7Lpzs782PIwCmLpzAHKWzix6\npOaTQ+WZ0+vUMTxyqgqWbsBgSCyP7pVBiyqnmLC/L4az9XnscrbAX4pNaoJxsuQe\nmzBo6yofjQaAzCX69DuqxFkVTRQnVy7LCFkVaZtjNAftnAHJjVgQw7lIhdGZp9q9\nIafRt2gteihYfpn+EAQ/t/E4MnhrYs4CPLfS7BaYXBycEKC5Muj1l4GijNNQ0Efo\nxG8LSZz7SNgUvfVwiNTaqfLP3AtEAWiqxyMyh3VO+1HpCjT7uNBFtmF3AgMBAAGj\nZjBkMA4GA1UdDwEB/wQEAwIBBjASBgNVHRMBAf8ECDAGAQH/AgEAMB0GA1UdDgQW\nBBQtinkdrj+0B2+qdXngV2tgHnPIujAfBgNVHSMEGDAWgBRp0xqULkNh/w2ZVzEI\no2RIY7O03TANBgkqhkiG9w0BAQsFAAOCAQEAtJdqbCxDeMc8VN1/RzCabw9BIL/z\n73Auh8eFTww/sup26yn8NWUkfbckeDYr1BrXa+rPyLfHpg06kwR8rBKyrs5mHwJx\nbvOzXD/5WTdgreB+2Fb7mXNvWhenYuji1MF+q1R2DXV3I05zWHteKX6Dajmx+Uuq\nYq78oaCBSV48hMxWlp8fm40ANCL1+gzQ122xweMFN09FmNYFhwuW+Ao+Vv90ZfQG\nPYwTvN4n/gegw2TYcifGZC2PNX74q3DH03DXe5fvNgRW5plgz/7f+9mS+YHd5qa9\ntYTPUvoRbi169ou6jicsMKUKPORHWhiTpSCWR1FMMIbsAcsyrvtIsuaGCQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/jCCAuagAwIBAgIQdOCSuA9psBpQd8EI368/0DANBgkqhkiG9w0BAQsFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIHNhLWVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTE5MTgwNjI2WhgPMjA2MTA1MTkxOTA2MjZaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgc2EtZWFzdC0xIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAN6ftL6w8v3dB2yW\nLjCxSP1D7ZsOTeLZOSCz1Zv0Gkd0XLhil5MdHOHBvwH/DrXqFU2oGzCRuAy+aZis\nDardJU6ChyIQIciXCO37f0K23edhtpXuruTLLwUwzeEPdcnLPCX+sWEn9Y5FPnVm\npCd6J8edH2IfSGoa9LdErkpuESXdidLym/w0tWG/O2By4TabkNSmpdrCL00cqI+c\nprA8Bx1jX8/9sY0gpAovtuFaRN+Ivg3PAnWuhqiSYyQ5nC2qDparOWuDiOhpY56E\nEgmTvjwqMMjNtExfYx6Rv2Ndu50TriiNKEZBzEtkekwXInTupmYTvc7U83P/959V\nUiQ+WSMCAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU4uYHdH0+\nbUeh81Eq2l5/RJbW+vswDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUAA4IB\nAQBhxcExJ+w74bvDknrPZDRgTeMLYgbVJjx2ExH7/Ac5FZZWcpUpFwWMIJJxtewI\nAnhryzM3tQYYd4CG9O+Iu0+h/VVfW7e4O3joWVkxNMb820kQSEwvZfA78aItGwOY\nWSaFNVRyloVicZRNJSyb1UL9EiJ9ldhxm4LTT0ax+4ontI7zTx6n6h8Sr6r/UOvX\nd9T5aUUENWeo6M9jGupHNn3BobtL7BZm2oS8wX8IVYj4tl0q5T89zDi2x0MxbsIV\n5ZjwqBQ5JWKv7ASGPb+z286RjPA9R2knF4lJVZrYuNV90rHvI/ECyt/JrDqeljGL\nBLl1W/UsvZo6ldLIpoMbbrb5\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBDCCAuygAwIBAgIQUfVbqapkLYpUqcLajpTJWzANBgkqhkiG9w0BAQsFADCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIG1lLWNlbnRyYWwtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNV\nBAcMB1NlYXR0bGUwIBcNMjIwNTA2MjMyMDA5WhgPMjA2MjA1MDcwMDIwMDlaMIGa\nMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5j\nLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMzAxBgNVBAMMKkFt\nYXpvbiBSRFMgbWUtY2VudHJhbC0xIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJIeovu3\newI9FVitXMQzvkh34aQ6WyI4NO3YepfJaePiv3cnyFGYHN2S1cR3UQcLWgypP5va\nj6bfroqwGbCbZZcb+6cyOB4ceKO9Ws1UkcaGHnNDcy5gXR7aCW2OGTUfinUuhd2d\n5bOGgV7JsPbpw0bwJ156+MwfOK40OLCWVbzy8B1kITs4RUPNa/ZJnvIbiMu9rdj4\n8y7GSFJLnKCjlOFUkNI5LcaYvI1+ybuNgphT3nuu5ZirvTswGakGUT/Q0J3dxP0J\npDfg5Sj/2G4gXiaM0LppVOoU5yEwVewhQ250l0eQAqSrwPqAkdTg9ng360zqCFPE\nJPPcgI1tdGUgneECAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU\n/2AJVxWdZxc8eJgdpbwpW7b0f7IwDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEB\nCwUAA4IBAQBYm63jTu2qYKJ94gKnqc+oUgqmb1mTXmgmp/lXDbxonjszJDOXFbri\n3CCO7xB2sg9bd5YWY8sGKHaWmENj3FZpCmoefbUx++8D7Mny95Cz8R32rNcwsPTl\nebpd9A/Oaw5ug6M0x/cNr0qzF8Wk9Dx+nFEimp8RYQdKvLDfNFZHjPa1itnTiD8M\nTorAqj+VwnUGHOYBsT/0NY12tnwXdD+ATWfpEHdOXV+kTMqFFwDyhfgRVNpTc+os\nygr8SwhnSCpJPB/EYl2S7r+tgAbJOkuwUvGT4pTqrzDQEhwE7swgepnHC87zhf6l\nqN6mVpSnQKQLm6Ob5TeCEFgcyElsF5bH\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAOxu0I1QuMAhIeszB3fJIlkwCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyB1cy13ZXN0LTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTI0MjIwNjU5WhgPMjEyMTA1MjQyMzA2NTlaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgdXMtd2VzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEz4bylRcGqqDWdP7gQIIoTHdBK6FNtKH1\n4SkEIXRXkYDmRvL9Bci1MuGrwuvrka5TDj4b7e+csY0llEzHpKfq6nJPFljoYYP9\nuqHFkv77nOpJJ633KOr8IxmeHW5RXgrZo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBQQikVz8wmjd9eDFRXzBIU8OseiGzAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIwf06Mcrpw1O0EBLBBrp84m37NYtOkE/0Z0O+C7D41wnXi\nEQdn6PXUVgdD23Gj82SrAjEAklhKs+liO1PtN15yeZR1Io98nFve+lLptaLakZcH\n+hfFuUtCqMbaI8CdvJlKnPqT\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCTCCA/GgAwIBAgIRALyWMTyCebLZOGcZZQmkmfcwDQYJKoZIhvcNAQEMBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMyBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTI0MjAyODAzWhgPMjEyMTA1MjQyMTI4MDNa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTMgUm9vdCBDQSBSU0E0MDk2IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA\nwGFiyDyCrGqgdn4fXG12cxKAAfVvhMea1mw5h9CVRoavkPqhzQpAitSOuMB9DeiP\nwQyqcsiGl/cTEau4L+AUBG8b9v26RlY48exUYBXj8CieYntOT9iNw5WtdYJa3kF/\nJxgI+HDMzE9cmHDs5DOO3S0uwZVyra/xE1ymfSlpOeUIOTpHRJv97CBUEpaZMUW5\nSr6GruuOwFVpO5FX3A/jQlcS+UN4GjSRgDUJuqg6RRQldEZGCVCCmodbByvI2fGm\nreGpsPJD54KkmAX08nOR8e5hkGoHxq0m2DLD4SrOFmt65vG47qnuwplWJjtk9B3Z\n9wDoopwZLBOtlkPIkUllWm1P8EuHC1IKOA+wSP6XdT7cy8S77wgyHzR0ynxv7q/l\nvlZtH30wnNqFI0y9FeogD0TGMCHcnGqfBSicJXPy9T4fU6f0r1HwqKwPp2GArwe7\ndnqLTj2D7M9MyVtFjEs6gfGWXmu1y5uDrf+CszurE8Cycoma+OfjjuVQgWOCy7Nd\njJswPxAroTzVfpgoxXza4ShUY10woZu0/J+HmNmqK7lh4NS75q1tz75in8uTZDkV\nbe7GK+SEusTrRgcf3tlgPjSTWG3veNzFDF2Vn1GLJXmuZfhdlVQDBNXW4MNREExS\ndG57kJjICpT+r8X+si+5j51gRzkSnMYs7VHulpxfcwECAwEAAaNCMEAwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQU4JWOpDBmUBuWKvGPZelw87ezhL8wDgYDVR0P\nAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQBRNLMql7itvXSEFQRAnyOjivHz\nl5IlWVQjAbOUr6ogZcwvK6YpxNAFW5zQr8F+fdkiypLz1kk5irx9TIpff0BWC9hQ\n/odMPO8Gxn8+COlSvc+dLsF2Dax3Hvz0zLeKMo+cYisJOzpdR/eKd0/AmFdkvQoM\nAOK9n0yYvVJU2IrSgeJBiiCarpKSeAktEVQ4rvyacQGr+QAPkkjRwm+5LHZKK43W\nnNnggRli9N/27qYtc5bgr3AaQEhEXMI4RxPRXCLsod0ehMGWyRRK728a+6PMMJAJ\nWHOU0x7LCEMPP/bvpLj3BdvSGqNor4ZtyXEbwREry1uzsgODeRRns5acPwTM6ff+\nCmxO2NZ0OktIUSYRmf6H/ZFlZrIhV8uWaIwEJDz71qvj7buhQ+RFDZ9CNL64C0X6\nmf0zJGEpddjANHaaVky+F4gYMtEy2K2Lcm4JGTdyIzUoIe+atzCnRp0QeIcuWtF+\ns8AjDYCVFNypcMmqbRmNpITSnOoCHSRuVkY3gutVoYyMLbp8Jm9SJnCIlEWTA6Rm\nwADOMGZJVn5/XRTRuetVOB3KlQDjs9OO01XN5NzGSZO2KT9ngAUfh9Eqhf1iRWSP\nnZlRbQ2NRCuY/oJ5N59mLGxnNJSE7giEKEBRhTQ/XEPIUYAUPD5fca0arKRJwbol\nl9Se1Hsq0ZU5f+OZKQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAK7vlRrGVEePJpW1VHMXdlIwDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBhZi1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MTkxOTI4NDNaGA8yMTIxMDUxOTIwMjg0M1owgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBhZi1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMZiHOQC6x4o\neC7vVOMCGiN5EuLqPYHdceFPm4h5k/ZejXTf7kryk6aoKZKsDIYihkaZwXVS7Y/y\n7Ig1F1ABi2jD+CYprj7WxXbhpysmN+CKG7YC3uE4jSvfvUnpzionkQbjJsRJcrPO\ncZJM4FVaVp3mlHHtvnM+K3T+ni4a38nAd8xrv1na4+B8ZzZwWZXarfg8lJoGskSn\nou+3rbGQ0r+XlUP03zWujHoNlVK85qUIQvDfTB7n3O4s1XNGvkfv3GNBhYRWJYlB\n4p8T+PFN8wG+UOByp1gV7BD64RnpuZ8V3dRAlO6YVAmINyG5UGrPzkIbLtErUNHO\n4iSp4UqYvztDqJWWHR/rA84ef+I9RVwwZ8FQbjKq96OTnPrsr63A5mXTC9dXKtbw\nXNJPQY//FEdyM3K8sqM0IdCzxCA1MXZ8+QapWVjwyTjUwFvL69HYky9H8eAER59K\n5I7u/CWWeCy2R1SYUBINc3xxLr0CGGukcWPEZW2aPo5ibW5kepU1P/pzdMTaTfao\nF42jSFXbc7gplLcSqUgWwzBnn35HLTbiZOFBPKf6vRRu8aRX9atgHw/EjCebi2xP\nxIYr5Ub8u0QVHIqcnF1/hVzO/Xz0chj3E6VF/yTXnsakm+W1aM2QkZbFGpga+LMy\nmFCtdPrELjea2CfxgibaJX1Q4rdEpc8DAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFDSaycEyuspo/NOuzlzblui8KotFMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEAbosemjeTRsL9o4v0KadBUNS3V7gdAH+X4vH2\nEe1Jc91VOGLdd/s1L9UX6bhe37b9WjUD69ur657wDW0RzxMYgQdZ27SUl0tEgGGp\ncCmVs1ky3zEN+Hwnhkz+OTmIg1ufq0W2hJgJiluAx2r1ib1GB+YI3Mo3rXSaBYUk\nbgQuujYPctf0PA153RkeICE5GI3OaJ7u6j0caYEixBS3PDHt2MJWexITvXGwHWwc\nCcrC05RIrTUNOJaetQw8smVKYOfRImEzLLPZ5kf/H3Cbj8BNAFNsa10wgvlPuGOW\nXLXqzNXzrG4V3sjQU5YtisDMagwYaN3a6bBf1wFwFIHQoAPIgt8q5zaQ9WI+SBns\nIl6rd4zfvjq/BPmt0uI7rVg/cgbaEg/JDL2neuM9CJAzmKxYxLQuHSX2i3Fy4Y1B\ncnxnRQETCRZNPGd00ADyxPKVoYBC45/t+yVusArFt+2SVLEGiFBr23eG2CEZu+HS\nnDEgIfQ4V3YOTUNa86wvbAss1gbbnT/v1XCnNGClEWCWNCSRjwV2ZmQ/IVTmNHPo\n7axTTBBJbKJbKzFndCnuxnDXyytdYRgFU7Ly3sa27WS2KFyFEDebLFRHQEfoYqCu\nIupSqBSbXsR3U10OTjc9z6EPo1nuV6bdz+gEDthmxKa1NI+Qb1kvyliXQHL2lfhr\n5zT5+Bs=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/zCCA+egAwIBAgIRAOLV6zZcL4IV2xmEneN1GwswDQYJKoZIhvcNAQEMBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyB1cy13ZXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE5MDg1OFoYDzIxMjEwNTE5MjAwODU4WjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIHVzLXdlc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC7koAKGXXlLixN\nfVjhuqvz0WxDeTQfhthPK60ekRpftkfE5QtnYGzeovaUAiS58MYVzqnnTACDwcJs\nIGTFE6Wd7sB6r8eI/3CwI1pyJfxepubiQNVAQG0zJETOVkoYKe/5KnteKtnEER3X\ntCBRdV/rfbxEDG9ZAsYfMl6zzhEWKF88G6xhs2+VZpDqwJNNALvQuzmTx8BNbl5W\nRUWGq9CQ9GK9GPF570YPCuURW7kl35skofudE9bhURNz51pNoNtk2Z3aEeRx3ouT\nifFJlzh+xGJRHqBG7nt5NhX8xbg+vw4xHCeq1aAe6aVFJ3Uf9E2HzLB4SfIT9bRp\nP7c9c0ySGt+3n+KLSHFf/iQ3E4nft75JdPjeSt0dnyChi1sEKDi0tnWGiXaIg+J+\nr1ZtcHiyYpCB7l29QYMAdD0TjfDwwPayLmq//c20cPmnSzw271VwqjUT0jYdrNAm\ngV+JfW9t4ixtE3xF2jaUh/NzL3bAmN5v8+9k/aqPXlU1BgE3uPwMCjrfn7V0I7I1\nWLpHyd9jF3U/Ysci6H6i8YKgaPiOfySimQiDu1idmPld659qerutUSemQWmPD3bE\ndcjZolmzS9U0Ujq/jDF1YayN3G3xvry1qWkTci0qMRMu2dZu30Herugh9vsdTYkf\n00EqngPbqtIVLDrDjEQLqPcb8QvWFQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBQBqg8Za/L0YMHURGExHfvPyfLbOTAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQEMBQADggIBACAGPMa1QL7P/FIO7jEtMelJ0hQlQepKnGtbKz4r\nXq1bUX1jnLvnAieR9KZmeQVuKi3g3CDU6b0mDgygS+FL1KDDcGRCSPh238Ou8KcG\nHIxtt3CMwMHMa9gmdcMlR5fJF9vhR0C56KM2zvyelUY51B/HJqHwGvWuexryXUKa\nwq1/iK2/d9mNeOcjDvEIj0RCMI8dFQCJv3PRCTC36XS36Tzr6F47TcTw1c3mgKcs\nxpcwt7ezrXMUunzHS4qWAA5OGdzhYlcv+P5GW7iAA7TDNrBF+3W4a/6s9v2nQAnX\nUvXd9ul0ob71377UhZbJ6SOMY56+I9cJOOfF5QvaL83Sz29Ij1EKYw/s8TYdVqAq\n+dCyQZBkMSnDFLVe3J1KH2SUSfm3O98jdPORQrUlORQVYCHPls19l2F6lCmU7ICK\nhRt8EVSpXm4sAIA7zcnR2nU00UH8YmMQLnx5ok9YGhuh3Ehk6QlTQLJux6LYLskd\n9YHOLGW/t6knVtV78DgPqDeEx/Wu/5A8R0q7HunpWxr8LCPBK6hksZnOoUhhb8IP\nvl46Ve5Tv/FlkyYr1RTVjETmg7lb16a8J0At14iLtpZWmwmuv4agss/1iBVMXfFk\n+ZGtx5vytWU5XJmsfKA51KLsMQnhrLxb3X3zC+JRCyJoyc8++F3YEcRi2pkRYE3q\nHing\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRANxgyBbnxgTEOpDul2ZnC0UwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMyBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNjEwMTgxOTA3WhgPMjA2MTA2MTAxOTE5MDda\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTMgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\nxnwSDAChrMkfk5TA4Dk8hKzStDlSlONzmd3fTG0Wqr5+x3EmFT6Ksiu/WIwEl9J2\nK98UI7vYyuZfCxUKb1iMPeBdVGqk0zb92GpURd+Iz/+K1ps9ZLeGBkzR8mBmAi1S\nOfpwKiTBzIv6E8twhEn4IUpHsdcuX/2Y78uESpJyM8O5CpkG0JaV9FNEbDkJeBUQ\nAo2qqNcH4R0Qcr5pyeqA9Zto1RswgL06BQMI9dTpfwSP5VvkvcNUaLl7Zv5WzLQE\nJzORWePvdPzzvWEkY/3FPjxBypuYwssKaERW0fkPDmPtykktP9W/oJolKUFI6pXp\ny+Y6p6/AVdnQD2zZjW5FhQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBT+jEKs96LC+/X4BZkUYUkzPfXdqTAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAIGQqgqcQ6XSGkmNebzR6DhadTbfDmbYeN5N0Vuzv+Tdmufb\ntMGjdjnYMg4B+IVnTKQb+Ox3pL9gbX6KglGK8HupobmIRtwKVth+gYYz3m0SL/Nk\nhaWPYzOm0x3tJm8jSdufJcEob4/ATce9JwseLl76pSWdl5A4lLjnhPPKudUDfH+1\nBLNUi3lxpp6GkC8aWUPtupnhZuXddolTLOuA3GwTZySI44NfaFRm+o83N1jp+EwD\n6e94M4cTRzjUv6J3MZmSbdtQP/Tk1uz2K4bQZGP0PZC3bVpqiesdE/xr+wbu8uHr\ncM1JXH0AmXf1yIkTgyWzmvt0k1/vgcw5ixAqvvE=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEATCCAumgAwIBAgIRAMhw98EQU18mIji+unM2YH8wDQYJKoZIhvcNAQELBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBhcC1zb3V0aC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMjA2MDYyMTQyMjJaGA8yMDYyMDYwNjIyNDIyMlowgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBhcC1zb3V0aC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAIeeRoLfTm+7\nvqm7ZlFSx+1/CGYHyYrOOryM4/Z3dqYVHFMgWTR7V3ziO8RZ6yUanrRcWVX3PZbF\nAfX0KFE8OgLsXEZIX8odSrq86+/Th5eZOchB2fDBsUB7GuN2rvFBbM8lTI9ivVOU\nlbuTnYyb55nOXN7TpmH2bK+z5c1y9RVC5iQsNAl6IJNvSN8VCqXh31eK5MlKB4DT\n+Y3OivCrSGsjM+UR59uZmwuFB1h+icE+U0p9Ct3Mjq3MzSX5tQb6ElTNGlfmyGpW\nKh7GQ5XU1KaKNZXoJ37H53woNSlq56bpVrKI4uv7ATpdpFubOnSLtpsKlpLdR3sy\nWs245200pC8CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUp0ki\n6+eWvsnBjQhMxwMW5pwn7DgwDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUA\nA4IBAQB2V8lv0aqbYQpj/bmVv/83QfE4vOxKCJAHv7DQ35cJsTyBdF+8pBczzi3t\n3VNL5IUgW6WkyuUOWnE0eqAFOUVj0yTS1jSAtfl3vOOzGJZmWBbqm9BKEdu1D8O6\nsB8bnomwiab2tNDHPmUslpdDqdabbkWwNWzLJ97oGFZ7KNODMEPXWKWNxg33iHfS\n/nlmnrTVI3XgaNK9qLZiUrxu9Yz5gxi/1K+sG9/Dajd32ZxjRwDipOLiZbiXQrsd\nqzIMY4GcWf3g1gHL5mCTfk7dG22h/rhPyGV0svaDnsb+hOt6sv1McMN6Y3Ou0mtM\n/UaAXojREmJmTSCNvs2aBny3/2sy\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAMnRxsKLYscJV8Qv5pWbL7swCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyBzYS1lYXN0LTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTE5MTgxNjAxWhgPMjEyMTA1MTkxOTE2MDFaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgc2EtZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEjFOCZgTNVKxLKhUxffiDEvTLFhrmIqdO\ndKqVdgDoELEzIHWDdC+19aDPitbCYtBVHl65ITu/9pn6mMUl5hhUNtfZuc6A+Iw1\nsBe0v0qI3y9Q9HdQYrGgeHDh8M5P7E2ho0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBS5L7/8M0TzoBZk39Ps7BkfTB4yJTAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIwI43O0NtWKTgnVv9z0LO5UMZYgSve7GvGTwqktZYCMObE\nrUI4QerXM9D6JwLy09mqAjEAypfkdLyVWtaElVDUyHFkihAS1I1oUxaaDrynLNQK\nOu/Ay+ns+J+GyvyDUjBpVVW1\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/jCCA+agAwIBAgIQR71Z8lTO5Sj+as2jB7IWXzANBgkqhkiG9w0BAQwFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIHVzLXdlc3QtMiBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTI0MjIwMzIwWhgPMjEyMTA1MjQyMzAzMjBaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgdXMtd2VzdC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAM977bHIs1WJijrS\nXQMfUOhmlJjr2v0K0UjPl52sE1TJ76H8umo1yR4T7Whkd9IwBHNGKXCJtJmMr9zp\nfB38eLTu+5ydUAXdFuZpRMKBWwPVe37AdJRKqn5beS8HQjd3JXAgGKUNNuE92iqF\nqi2fIqFMpnJXWo0FIW6s2Dl2zkORd7tH0DygcRi7lgVxCsw1BJQhFJon3y+IV8/F\nbnbUXSNSDUnDW2EhvWSD8L+t4eiXYsozhDAzhBvojpxhPH9OB7vqFYw5qxFx+G0t\nlSLX5iWi1jzzc3XyGnB6WInZDVbvnvJ4BGZ+dTRpOCvsoMIn9bz4EQTvu243c7aU\nHbS/kvnCASNt+zk7C6lbmaq0AGNztwNj85Opn2enFciWZVnnJ/4OeefUWQxD0EPp\nSjEd9Cn2IHzkBZrHCg+lWZJQBKbUVS0lLIMSsLQQ6WvR38jY7D2nxM1A93xWxwpt\nZtQnYRCVXH6zt2OwDAFePInWwxUjR5t/wu3XxPgpSfrmTi3WYtr1wFypAJ811e/P\nyBtswWUQ6BNJQvy+KnOEeGfOwmtdDFYR+GOCfvCihzrKJrxOtHIieehR5Iw3cbXG\nsm4pDzfMUVvDDz6C2M6PRlJhhClbatHCjik9hxFYEsAlqtVVK9pxaz9i8hOqSFQq\nkJSQsgWw+oM/B2CyjcSqkSQEu8RLAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8w\nHQYDVR0OBBYEFPmrdxpRRgu3IcaB5BTqlprcKdTsMA4GA1UdDwEB/wQEAwIBhjAN\nBgkqhkiG9w0BAQwFAAOCAgEAVdlxWjPvVKky3kn8ZizeM4D+EsLw9dWLau2UD/ls\nzwDCFoT6euagVeCknrn+YEl7g20CRYT9iaonGoMUPuMR/cdtPL1W/Rf40PSrGf9q\nQuxavWiHLEXOQTCtCaVZMokkvjuuLNDXyZnstgECuiZECTwhexUF4oiuhyGk9o01\nQMaiz4HX4lgk0ozALUvEzaNd9gWEwD2qe+rq9cQMTVq3IArUkvTIftZUaVUMzr0O\ned1+zAsNa9nJhURJ/6anJPJjbQgb5qA1asFcp9UaMT1ku36U3gnR1T/BdgG2jX3X\nUm0UcaGNVPrH1ukInWW743pxWQb7/2sumEEMVh+jWbB18SAyLI4WIh4lkurdifzS\nIuTFp8TEx+MouISFhz/vJDWZ84tqoLVjkEcP6oDypq9lFoEzHDJv3V1CYcIgOusT\nk1jm9P7BXdTG7TYzUaTb9USb6bkqkD9EwJAOSs7DI94aE6rsSws2yAHavjAMfuMZ\nsDAZvkqS2Qg2Z2+CI6wUZn7mzkJXbZoqRjDvChDXEB1mIhzVXhiNW/CR5WKVDvlj\n9v1sdGByh2pbxcLQtVaq/5coM4ANgphoNz3pOYUPWHS+JUrIivBZ+JobjXcxr3SN\n9iDzcu5/FVVNbq7+KN/nvPMngT+gduEN5m+EBjm8GukJymFG0m6BENRA0QSDqZ7k\nzDY=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRAK5EYG3iHserxMqgg+0EFjgwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMyBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTI0MjAyMzE2WhgPMjA2MTA1MjQyMTIzMTZa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTMgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\ns1L6TtB84LGraLHVC+rGPhLBW2P0oN/91Rq3AnYwqDOuTom7agANwEjvLq7dSRG/\nsIfZsSV/ABTgArZ5sCmLjHFZAo8Kd45yA9byx20RcYtAG8IZl+q1Cri+s0XefzyO\nU6mlfXZkVe6lzjlfXBkrlE/+5ifVbJK4dqOS1t9cWIpgKqv5fbE6Qbq4LVT+5/WM\nVd2BOljuBMGMzdZubqFKFq4mzTuIYfnBm7SmHlZfTdfBYPP1ScNuhpjuzw4n3NCR\nEdU6dQv04Q6th4r7eiOCwbWI9LkmVbvBe3ylhH63lApC7MiiPYLlB13xBubVHVhV\nq1NHoNTi+zA3MN9HWicRxQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBSuxoqm0/wjNiZLvqv+JlQwsDvTPDAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAFfTK/j5kv90uIbM8VaFdVbr/6weKTwehafT0pAk1bfLVX+7\nuf8oHgYiyKTTl0DFQicXejghXTeyzwoEkWSR8c6XkhD5vYG3oESqmt/RGvvoxz11\nrHHy7yHYu7RIUc3VQG60c4qxXv/1mWySGwVwJrnuyNT9KZXPevu3jVaWOVHEILaK\nHvzQ2YEcWBPmde/zEseO2QeeGF8FL45Q1d66wqIP4nNUd2pCjeTS5SpB0MMx7yi9\nki1OH1pv8tOuIdimtZ7wkdB8+JSZoaJ81b8sRrydRwJyvB88rftuI3YB4WwGuONT\nZezUPsmaoK69B0RChB0ofDpAaviF9V3xOWvVZfo=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGDzCCA/egAwIBAgIRAI0sMNG2XhaBMRN3zD7ZyoEwDQYJKoZIhvcNAQEMBQAw\ngZ8xCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE4MDYGA1UEAwwv\nQW1hem9uIFJEUyBQcmV2aWV3IHVzLWVhc3QtMiBSb290IENBIFJTQTQwOTYgRzEx\nEDAOBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTE4MjA1NzUwWhgPMjEyMTA1MTgyMTU3\nNTBaMIGfMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNl\ncywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExODA2BgNV\nBAMML0FtYXpvbiBSRFMgUHJldmlldyB1cy1lYXN0LTIgUm9vdCBDQSBSU0E0MDk2\nIEcxMRAwDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIIC\nCgKCAgEAh/otSiCu4Uw3hu7OJm0PKgLsLRqBmUS6jihcrkxfN2SHmp2zuRflkweU\nBhMkebzL+xnNvC8okzbgPWtUxSmDnIRhE8J7bvSKFlqs/tmEdiI/LMqe/YIKcdsI\n20UYmvyLIjtDaJIh598SHHlF9P8DB5jD8snJfhxWY+9AZRN+YVTltgQAAgayxkWp\nM1BbvxpOnz4CC00rE0eqkguXIUSuobb1vKqdKIenlYBNxm2AmtgvQfpsBIQ0SB+8\n8Zip8Ef5rtjSw5J3s2Rq0aYvZPfCVIsKYepIboVwXtD7E9J31UkB5onLBQlaHaA6\nXlH4srsMmrew5d2XejQGy/lGZ1nVWNsKO0x/Az2QzY5Kjd6AlXZ8kq6H68hscA5i\nOMbNlXzeEQsZH0YkId3+UsEns35AAjZv4qfFoLOu8vDotWhgVNT5DfdbIWZW3ZL8\nqbmra3JnCHuaTwXMnc25QeKgVq7/rG00YB69tCIDwcf1P+tFJWxvaGtV0g2NthtB\na+Xo09eC0L53gfZZ3hZw1pa3SIF5dIZ6RFRUQ+lFOux3Q/I3u+rYstYw7Zxc4Zeo\nY8JiedpQXEAnbw2ECHix/L6mVWgiWCiDzBnNLLdbmXjJRnafNSndSfFtHCnY1SiP\naCrNpzwZIJejoV1zDlWAMO+gyS28EqzuIq3WJK/TFE7acHkdKIcCAwEAAaNCMEAw\nDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUrmV1YASnuudfmqAZP4sKGTvScaEw\nDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQBGpEKeQoPvE85tN/25\nqHFkys9oHDl93DZ62EnOqAUKLd6v0JpCyEiop4nlrJe+4KrBYVBPyKOJDcIqE2Sp\n3cvgJXLhY4i46VM3Qxe8yuYF1ElqBpg3jJVj/sCQnYz9dwoAMWIJFaDWOvmU2E7M\nMRaKx+sPXFkIjiDA6Bv0m+VHef7aedSYIY7IDltEQHuXoqNacGrYo3I50R+fZs88\n/mB3e/V7967e99D6565yf9Lcjw4oQf2Hy7kl/6P9AuMz0LODnGITwh2TKk/Zo3RU\nVgq25RDrT4xJK6nFHyjUF6+4cOBxVpimmFw/VP1zaXT8DN5r4HyJ9p4YuSK8ha5N\n2pJc/exvU8Nv2+vS/efcDZWyuEdZ7eh1IJWQZlOZKIAONfRDRTpeQHJ3zzv3QVYy\nt78pYp/eWBHyVIfEE8p2lFKD4279WYe+Uvdb8c4Jm4TJwqkSJV8ifID7Ub80Lsir\nlPAU3OCVTBeVRFPXT2zpC4PB4W6KBSuj6OOcEu2y/HgWcoi7Cnjvp0vFTUhDFdus\nWz3ucmJjfVsrkEO6avDKu4SwdbVHsk30TVAwPd6srIdi9U6MOeOQSOSE4EsrrS7l\nSVmu2QIDUVFpm8QAHYplkyWIyGkupyl3ashH9mokQhixIU/Pzir0byePxHLHrwLu\n1axqeKpI0F5SBUPsaVNYY2uNFg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECDCCAvCgAwIBAgIQCREfzzVyDTMcNME+gWnTCTANBgkqhkiG9w0BAQsFADCB\nnDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTUwMwYDVQQDDCxB\nbWF6b24gUkRTIGFwLXNvdXRoZWFzdC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4G\nA1UEBwwHU2VhdHRsZTAgFw0yMTA1MjQyMDQyMzNaGA8yMDYxMDUyNDIxNDIzM1ow\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMiBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDL\n1MT6br3L/4Pq87DPXtcjlXN3cnbNk2YqRAZHJayStTz8VtsFcGPJOpk14geRVeVk\ne9uKFHRbcyr/RM4owrJTj5X4qcEuATYZbo6ou/rW2kYzuWFZpFp7lqm0vasV4Z9F\nfChlhwkNks0UbM3G+psCSMNSoF19ERunj7w2c4E62LwujkeYLvKGNepjnaH10TJL\n2krpERd+ZQ4jIpObtRcMH++bTrvklc+ei8W9lqrVOJL+89v2piN3Ecdd389uphst\nqQdb1BBVXbhUrtuGHgVf7zKqN1SkCoktoWxVuOprVWhSvr7akaWeq0UmlvbEsujU\nvADqxGMcJFyCzxx3CkJjAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0O\nBBYEFFk8UJmlhoxFT3PP12PvhvazHjT4MA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG\n9w0BAQsFAAOCAQEAfFtr2lGoWVXmWAsIo2NYre7kzL8Xb9Tx7desKxCCz5HOOvIr\n8JMB1YK6A7IOvQsLJQ/f1UnKRh3X3mJZjKIywfrMSh0FiDf+rjcEzXxw2dGtUem4\nA+WMvIA3jwxnJ90OQj5rQ8bg3iPtE6eojzo9vWQGw/Vu48Dtw1DJo9210Lq/6hze\nhPhNkFh8fMXNT7Q1Wz/TJqJElyAQGNOXhyGpHKeb0jHMMhsy5UNoW5hLeMS5ffao\nTBFWEJ1gVfxIU9QRxSh+62m46JIg+dwDlWv8Aww14KgepspRbMqDuaM2cinoejv6\nt3dyOyHHrsOyv3ffZUKtQhQbQr+sUcL89lARsg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/zCCAuegAwIBAgIRAIJLTMpzGNxqHZ4t+c1MlCIwDQYJKoZIhvcNAQELBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBhcC1lYXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNTIxMzAzM1oYDzIwNjEwNTI1MjIzMDMzWjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGFwLWVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDtdHut0ZhJ9Nn2\nMpVafFcwHdoEzx06okmmhjJsNy4l9QYVeh0UUoek0SufRNMRF4d5ibzpgZol0Y92\n/qKWNe0jNxhEj6sXyHsHPeYtNBPuDMzThfbvsLK8z7pBP7vVyGPGuppqW/6m4ZBB\nlcc9fsf7xpZ689iSgoyjiT6J5wlVgmCx8hFYc/uvcRtfd8jAHvheug7QJ3zZmIye\nV4htOW+fRVWnBjf40Q+7uTv790UAqs0Zboj4Yil+hER0ibG62y1g71XcCyvcVpto\n2/XW7Y9NCgMNqQ7fGN3wR1gjtSYPd7DO32LTzYhutyvfbpAZjsAHnoObmoljcgXI\nQjfBcCFpAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFJI3aWLg\nCS5xqU5WYVaeT5s8lpO0MA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC\nAQEAUwATpJOcGVOs3hZAgJwznWOoTzOVJKfrqBum7lvkVH1vBwxBl9CahaKj3ZOt\nYYp2qJzhDUWludL164DL4ZjS6eRedLRviyy5cRy0581l1MxPWTThs27z+lCC14RL\nPJZNVYYdl7Jy9Q5NsQ0RBINUKYlRY6OqGDySWyuMPgno2GPbE8aynMdKP+f6G/uE\nYHOf08gFDqTsbyfa70ztgVEJaRooVf5JJq4UQtpDvVswW2reT96qi6tXPKHN5qp3\n3wI0I1Mp4ePmiBKku2dwYzPfrJK/pQlvu0Gu5lKOQ65QdotwLAAoaFqrf9za1yYs\nINUkHLWIxDds+4OHNYcerGp5Dw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCTCCA/GgAwIBAgIRAIO6ldra1KZvNWJ0TA1ihXEwDQYJKoZIhvcNAQEMBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTIxMjE0NTA1WhgPMjEyMTA1MjEyMjQ1MDVa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA\nsDN52Si9pFSyZ1ruh3xAN0nVqEs960o2IK5CPu/ZfshFmzAwnx/MM8EHt/jMeZtj\nSM58LADAsNDL01ELpFZATjgZQ6xNAyXRXE7RiTRUvNkK7O3o2qAGbLnJq/UqF7Sw\nLRnB8V6hYOv+2EjVnohtGCn9SUFGZtYDjWXsLd4ML4Zpxv0a5LK7oEC7AHzbUR7R\njsjkrXqSv7GE7bvhSOhMkmgxgj1F3J0b0jdQdtyyj109aO0ATUmIvf+Bzadg5AI2\nA9UA+TUcGeebhpHu8AP1Hf56XIlzPpaQv3ZJ4vzoLaVNUC7XKzAl1dlvCl7Klg/C\n84qmbD/tjZ6GHtzpLKgg7kQEV7mRoXq8X4wDX2AFPPQl2fv+Kbe+JODqm5ZjGegm\nuskABBi8IFv1hYx9jEulZPxC6uD/09W2+niFm3pirnlWS83BwVDTUBzF+CooUIMT\njhWkIIZGDDgMJTzouBHfoSJtS1KpUZi99m2WyVs21MNKHeWAbs+zmI6TO5iiMC+T\nuB8spaOiHFO1573Fmeer4sy3YA6qVoqVl6jjTQqOdy3frAMbCkwH22/crV8YA+08\nhLeHXrMK+6XUvU+EtHAM3VzcrLbuYJUI2XJbzTj5g0Eb8I8JWsHvWHR5K7Z7gceR\n78AzxQmoGEfV6KABNWKsgoCQnfb1BidDJIe3BsI0A6UCAwEAAaNCMEAwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUABp0MlB14MSHgAcuNSOhs3MOlUcwDgYDVR0P\nAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQCv4CIOBSQi/QR9NxdRgVAG/pAh\ntFJhV7OWb/wqwsNKFDtg6tTxwaahdCfWpGWId15OUe7G9LoPiKiwM9C92n0ZeHRz\n4ewbrQVo7Eu1JI1wf0rnZJISL72hVYKmlvaWaacHhWxvsbKLrB7vt6Cknxa+S993\nKf8i2Psw8j5886gaxhiUtzMTBwoDWak8ZaK7m3Y6C6hXQk08+3pnIornVSFJ9dlS\nPAqt5UPwWmrEfF+0uIDORlT+cvrAwgSp7nUF1q8iasledycZ/BxFgQqzNwnkBDwQ\nZ/aM52ArGsTzfMhkZRz9HIEhz1/0mJw8gZtDVQroD8778h8zsx2SrIz7eWQ6uWsD\nQEeSWXpcheiUtEfzkDImjr2DLbwbA23c9LoexUD10nwohhoiQQg77LmvBVxeu7WU\nE63JqaYUlOLOzEmNJp85zekIgR8UTkO7Gc+5BD7P4noYscI7pPOL5rP7YLg15ZFi\nega+G53NTckRXz4metsd8XFWloDjZJJq4FfD60VuxgXzoMNT9wpFTNSH42PR2s9L\nI1vcl3w8yNccs9se2utM2nLsItZ3J0m/+QSRiw9hbrTYTcM9sXki0DtH2kyIOwYf\nlOrGJDiYOIrXSQK36H0gQ+8omlrUTvUj4msvkXuQjlfgx6sgp2duOAfnGxE7uHnc\nUhnJzzoe6M+LfGHkVQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICuDCCAj2gAwIBAgIQSAG6j2WHtWUUuLGJTPb1nTAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLW5vcnRoZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMDE2MzgyNloYDzIxMjEwNTIwMTczODI2WjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLW5vcnRoZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE2eqwU4FOzW8RV1W381Bd\nolhDOrqoMqzWli21oDUt7y8OnXM/lmAuOS6sr8Nt61BLVbONdbr+jgCYw75KabrK\nZGg3siqvMOgabIKkKuXO14wtrGyGDt7dnKXg5ERGYOZlo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBS1Acp2WYxOcblv5ikZ3ZIbRCCW+zAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaQAwZgIxAJL84J08PBprxmsAKPTotBuVI3MyW1r8\nxQ0i8lgCQUf8GcmYjQ0jI4oZyv+TuYJAcwIxAP9Xpzq0Docxb+4N1qVhpiOfWt1O\nFnemFiy9m1l+wv6p3riQMPV7mBVpklmijkIv3Q==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRALZLcqCVIJ25maDPE3sbPCIwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTIxMjEzOTM5WhgPMjA2MTA1MjEyMjM5Mzla\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\nypKc+6FfGx6Gl6fQ78WYS29QoKgQiur58oxR3zltWeg5fqh9Z85K5S3UbRSTqWWu\nXcfnkz0/FS07qHX+nWAGU27JiQb4YYqhjZNOAq8q0+ptFHJ6V7lyOqXBq5xOzO8f\n+0DlbJSsy7GEtJp7d7QCM3M5KVY9dENVZUKeJwa8PC5StvwPx4jcLeZRJC2rAVDG\nSW7NAInbATvr9ssSh03JqjXb+HDyywiqoQ7EVLtmtXWimX+0b3/2vhqcH5jgcKC9\nIGFydrjPbv4kwMrKnm6XlPZ9L0/3FMzanXPGd64LQVy51SI4d5Xymn0Mw2kMX8s6\nNf05OsWcDzJ1n6/Q1qHSxQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBRmaIc8eNwGP7i6P7AJrNQuK6OpFzAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAIBeHfGwz3S2zwIUIpqEEI5/sMySDeS+3nJR+woWAHeO0C8i\nBJdDh+kzzkP0JkWpr/4NWz84/IdYo1lqASd1Kopz9aT1+iROXaWr43CtbzjXb7/X\nZv7eZZFC8/lS5SROq42pPWl4ekbR0w8XGQElmHYcWS41LBfKeHCUwv83ATF0XQ6I\n4t+9YSqZHzj4vvedrvcRInzmwWJaal9s7Z6GuwTGmnMsN3LkhZ+/GD6oW3pU/Pyh\nEtWqffjsLhfcdCs3gG8x9BbkcJPH5aPAVkPn4wc8wuXg6xxb9YGsQuY930GWTYRf\nschbgjsuqznW4HHakq4WNhs1UdTSTKkRdZz7FUQ=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEDzCCAvegAwIBAgIRAM2zAbhyckaqRim63b+Tib8wDQYJKoZIhvcNAQELBQAw\ngZ8xCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE4MDYGA1UEAwwv\nQW1hem9uIFJEUyBQcmV2aWV3IHVzLWVhc3QtMiBSb290IENBIFJTQTIwNDggRzEx\nEDAOBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTE4MjA0OTQ1WhgPMjA2MTA1MTgyMTQ5\nNDVaMIGfMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNl\ncywgSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExODA2BgNV\nBAMML0FtYXpvbiBSRFMgUHJldmlldyB1cy1lYXN0LTIgUm9vdCBDQSBSU0EyMDQ4\nIEcxMRAwDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEA1ybjQMH1MkbvfKsWJaCTXeCSN1SG5UYid+Twe+TjuSqaXWonyp4WRR5z\ntlkqq+L2MWUeQQAX3S17ivo/t84mpZ3Rla0cx39SJtP3BiA2BwfUKRjhPwOjmk7j\n3zrcJjV5k1vSeLNOfFFSlwyDiVyLAE61lO6onBx+cRjelu0egMGq6WyFVidTdCmT\nQ9Zw3W6LTrnPvPmEyjHy2yCHzH3E50KSd/5k4MliV4QTujnxYexI2eR8F8YQC4m3\nDYjXt/MicbqA366SOoJA50JbgpuVv62+LSBu56FpzY12wubmDZsdn4lsfYKiWxUy\nuc83a2fRXsJZ1d3whxrl20VFtLFHFQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBRC0ytKmDYbfz0Bz0Psd4lRQV3aNTAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQELBQADggEBAGv8qZu4uaeoF6zsbumauz6ea6tdcWt+hGFuwGrb\ntRbI85ucAmVSX06x59DJClsb4MPhL1XmqO3RxVMIVVfRwRHWOsZQPnXm8OYQ2sny\nrYuFln1COOz1U/KflZjgJmxbn8x4lYiTPZRLarG0V/OsCmnLkQLPtEl/spMu8Un7\nr3K8SkbWN80gg17Q8EV5mnFwycUx9xsTAaFItuG0en9bGsMgMmy+ZsDmTRbL+lcX\nFq8r4LT4QjrFz0shrzCwuuM4GmcYtBSxlacl+HxYEtAs5k10tmzRf6OYlY33tGf6\n1tkYvKryxDPF/EDgGp/LiBwx6ixYMBfISoYASt4V/ylAlHA=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtTCCAjqgAwIBAgIRAK9BSZU6nIe6jqfODmuVctYwCgYIKoZIzj0EAwMwgZkx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEyMDAGA1UEAwwpQW1h\nem9uIFJEUyBjYS1jZW50cmFsLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTIxMjIxMzA5WhgPMjEyMTA1MjEyMzEzMDlaMIGZMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMjAwBgNVBAMMKUFtYXpv\nbiBSRFMgY2EtY2VudHJhbC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEUkEERcgxneT5H+P+fERcbGmf\nbVx+M7rNWtgWUr6w+OBENebQA9ozTkeSg4c4M+qdYSObFqjxITdYxT1z/nHz1gyx\nOKAhLjWu+nkbRefqy3RwXaWT680uUaAP6ccnkZOMo0IwQDAPBgNVHRMBAf8EBTAD\nAQH/MB0GA1UdDgQWBBSN6fxlg0s5Wny08uRBYZcQ3TUoyzAOBgNVHQ8BAf8EBAMC\nAYYwCgYIKoZIzj0EAwMDaQAwZgIxAORaz+MBVoFBTmZ93j2G2vYTwA6T5hWzBWrx\nCrI54pKn5g6At56DBrkjrwZF5T1enAIxAJe/LZ9xpDkAdxDgGJFN8gZYLRWc0NRy\nRb4hihy5vj9L+w9uKc9VfEBIFuhT7Z3ljg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQB/57HSuaqUkLaasdjxUdPjANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGFwLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE3NDAzNFoYDzIwNjEwNTE5MTg0MDM0WjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGFwLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtbkaoVsUS76o\nTgLFmcnaB8cswBk1M3Bf4IVRcwWT3a1HeJSnaJUqWHCJ+u3ip/zGVOYl0gN1MgBb\nMuQRIJiB95zGVcIa6HZtx00VezDTr3jgGWRHmRjNVCCHGmxOZWvJjsIE1xavT/1j\nQYV/ph4EZEIZ/qPq7e3rHohJaHDe23Z7QM9kbyqp2hANG2JtU/iUhCxqgqUHNozV\nZd0l5K6KnltZQoBhhekKgyiHqdTrH8fWajYl5seD71bs0Axowb+Oh0rwmrws3Db2\nDh+oc2PwREnjHeca9/1C6J2vhY+V0LGaJmnnIuOANrslx2+bgMlyhf9j0Bv8AwSi\ndSWsobOhNQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBQb7vJT\nVciLN72yJGhaRKLn6Krn2TAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAAxEj8N9GslReAQnNOBpGl8SLgCMTejQ6AW/bapQvzxrZrfVOZOYwp/5oV0f\n9S1jcGysDM+DrmfUJNzWxq2Y586R94WtpH4UpJDGqZp+FuOVJL313te4609kopzO\nlDdmd+8z61+0Au93wB1rMiEfnIMkOEyt7D2eTFJfJRKNmnPrd8RjimRDlFgcLWJA\n3E8wca67Lz/G0eAeLhRHIXv429y8RRXDtKNNz0wA2RwURWIxyPjn1fHjA9SPDkeW\nE1Bq7gZj+tBnrqz+ra3yjZ2blss6Ds3/uRY6NYqseFTZWmQWT7FolZEnT9vMUitW\nI0VynUbShVpGf6946e0vgaaKw20=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/jCCAuagAwIBAgIQGyUVTaVjYJvWhroVEiHPpDANBgkqhkiG9w0BAQsFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIHVzLXdlc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTE5MTkwNDA2WhgPMjA2MTA1MTkyMDA0MDZaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgdXMtd2VzdC0xIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBANhyXpJ0t4nigRDZ\nEwNtFOem1rM1k8k5XmziHKDvDk831p7QsX9ZOxl/BT59Pu/P+6W6SvasIyKls1sW\nFJIjFF+6xRQcpoE5L5evMgN/JXahpKGeQJPOX9UEXVW5B8yi+/dyUitFT7YK5LZA\nMqWBN/LtHVPa8UmE88RCDLiKkqiv229tmwZtWT7nlMTTCqiAHMFcryZHx0pf9VPh\nx/iPV8p2gBJnuPwcz7z1kRKNmJ8/cWaY+9w4q7AYlAMaq/rzEqDaN2XXevdpsYAK\nTMMj2kji4x1oZO50+VPNfBl5ZgJc92qz1ocF95SAwMfOUsP8AIRZkf0CILJYlgzk\n/6u6qZECAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUm5jfcS9o\n+LwL517HpB6hG+PmpBswDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUAA4IB\nAQAcQ6lsqxi63MtpGk9XK8mCxGRLCad51+MF6gcNz6i6PAqhPOoKCoFqdj4cEQTF\nF8dCfa3pvfJhxV6RIh+t5FCk/y6bWT8Ls/fYKVo6FhHj57bcemWsw/Z0XnROdVfK\nYqbc7zvjCPmwPHEqYBhjU34NcY4UF9yPmlLOL8uO1JKXa3CAR0htIoW4Pbmo6sA4\n6P0co/clW+3zzsQ92yUCjYmRNeSbdXbPfz3K/RtFfZ8jMtriRGuO7KNxp8MqrUho\nHK8O0mlSUxGXBZMNicfo7qY8FD21GIPH9w5fp5oiAl7lqFzt3E3sCLD3IiVJmxbf\nfUwpGd1XZBBSdIxysRLM6j48\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrTCCAjOgAwIBAgIQU+PAILXGkpoTcpF200VD/jAKBggqhkjOPQQDAzCBljEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMS8wLQYDVQQDDCZBbWF6\nb24gUkRTIGFwLWVhc3QtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTAgFw0yMTA1MjUyMTQ1MTFaGA8yMTIxMDUyNTIyNDUxMVowgZYxCzAJBgNV\nBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYD\nVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1hem9uIFJE\nUyBhcC1lYXN0LTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1NlYXR0bGUw\ndjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT3tFKE8Kw1sGQAvNLlLhd8OcGhlc7MiW/s\nNXm3pOiCT4vZpawKvHBzD76Kcv+ZZzHRxQEmG1/muDzZGlKR32h8AAj+NNO2Wy3d\nCKTtYMiVF6Z2zjtuSkZQdjuQbe4eQ7qjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYD\nVR0OBBYEFAiSQOp16Vv0Ohpvqcbd2j5RmhYNMA4GA1UdDwEB/wQEAwIBhjAKBggq\nhkjOPQQDAwNoADBlAjBVsi+5Ape0kOhMt/WFkANkslD4qXA5uqhrfAtH29Xzz2NV\ntR7akiA771OaIGB/6xsCMQCZt2egCtbX7J0WkuZ2KivTh66jecJr5DHvAP4X2xtS\nF/5pS+AUhcKTEGjI9jDH3ew=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICuDCCAj2gAwIBAgIQT5mGlavQzFHsB7hV6Mmy6TAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNDIwNTAxNVoYDzIxMjEwNTI0MjE1MDE1WjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEcm4BBBjYK7clwm0HJRWS\nflt3iYwoJbIXiXn9c1y3E+Vb7bmuyKhS4eO8mwO4GefUcXObRfoHY2TZLhMJLVBQ\n7MN2xDc0RtZNj07BbGD3VAIFRTDX0mH9UNYd0JQM3t/Oo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBRrd5ITedfAwrGo4FA9UaDaGFK3rjAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaQAwZgIxAPBNqmVv1IIA3EZyQ6XuVf4gj79/DMO8\nbkicNS1EcBpUqbSuU4Zwt2BYc8c/t7KVOQIxAOHoWkoKZPiKyCxfMtJpCZySUG+n\nsXgB/LOyWE5BJcXUfm+T1ckeNoWeUUMOLmnJjg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRAJcDeinvdNrDQBeJ8+t38WQwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtNCBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjIwNTI1MTY0OTE2WhgPMjA2MjA1MjUxNzQ5MTZa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTQgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\nk8DBNkr9tMoIM0NHoFiO7cQfSX0cOMhEuk/CHt0fFx95IBytx7GHCnNzpM27O5z6\nx6iRhfNnx+B6CrGyCzOjxvPizneY+h+9zfvNz9jj7L1I2uYMuiNyOKR6FkHR46CT\n1CiArfVLLPaTqgD/rQjS0GL2sLHS/0dmYipzynnZcs613XT0rAWdYDYgxDq7r/Yi\nXge5AkWQFkMUq3nOYDLCyGGfQqWKkwv6lZUHLCDKf+Y0Uvsrj8YGCI1O8mF0qPCQ\nlmlfaDvbuBu1AV+aabmkvyFj3b8KRIlNLEtQ4N8KGYR2Jdb82S4YUGIOAt4wuuFt\n1B7AUDLk3V/u+HTWiwfoLQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBSNpcjz6ArWBtAA+Gz6kyyZxrrgdDAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAGJEd7UgOzHYIcQRSF7nSYyjLROyalaIV9AX4WXW/Cqlul1c\nMblP5etDZm7A/thliZIWAuyqv2bNicmS3xKvNy6/QYi1YgxZyy/qwJ3NdFl067W0\nt8nGo29B+EVK94IPjzFHWShuoktIgp+dmpijB7wkTIk8SmIoe9yuY4+hzgqk+bo4\nms2SOXSN1DoQ75Xv+YmztbnZM8MuWhL1T7hA4AMorzTQLJ9Pof8SpSdMHeDsHp0R\n01jogNFkwy25nw7cL62nufSuH2fPYGWXyNDg+y42wKsKWYXLRgUQuDVEJ2OmTFMB\nT0Vf7VuNijfIA9hkN2d3K53m/9z5WjGPSdOjGhg=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/jCCAuagAwIBAgIQRiwspKyrO0xoxDgSkqLZczANBgkqhkiG9w0BAQsFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIHVzLXdlc3QtMiBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTI0MjE1OTAwWhgPMjA2MTA1MjQyMjU5MDBaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgdXMtd2VzdC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL53Jk3GsKiu+4bx\njDfsevWbwPCNJ3H08Zp7GWhvI3Tgi39opfHYv2ku2BKFjK8N2L6RvNPSR8yplv5j\nY0tK0U+XVNl8o0ibhqRDhbTuh6KL8CFINWYzAajuxFS+CF0U6c1Q3tXLBdALxA7l\nFlXJ71QrP06W31kRe7kvgrvO7qWU3/OzUf9qYw4LSiR1/VkvvRCTqcVNw09clw/M\nJbw6FSgweN65M9j7zPbjGAXSHkXyxH1Erin2fa+B9PE4ZDgX9cp2C1DHewYJQL/g\nSepwwcudVNRN1ibKH7kpMrgPnaNIVNx5sXVsTjk6q2ZqYw3SVHegltJpLy/cZReP\nmlivF2kCAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUmTcQd6o1\nCuS65MjBrMwQ9JJjmBwwDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUAA4IB\nAQAKSDSIzl956wVddPThf2VAzI8syw9ngSwsEHZvxVGHBvu5gg618rDyguVCYX9L\n4Kw/xJrk6S3qxOS2ZDyBcOpsrBskgahDFIunzoRP3a18ARQVq55LVgfwSDQiunch\nBd05cnFGLoiLkR5rrkgYaP2ftn3gRBRaf0y0S3JXZ2XB3sMZxGxavYq9mfiEcwB0\nLMTMQ1NYzahIeG6Jm3LqRqR8HkzP/Ztq4dT2AtSLvFebbNMiWqeqT7OcYp94HTYT\nzqrtaVdUg9bwyAUCDgy0GV9RHDIdNAOInU/4LEETovrtuBU7Z1q4tcHXvN6Hd1H8\ngMb0mCG5I393qW5hFsA/diFb\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRAPQAvihfjBg/JDbj6U64K98wDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMiBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTIwMTYyODQxWhgPMjA2MTA1MjAxNzI4NDFa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTIgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\nvJ9lgyksCxkBlY40qOzI1TCj/Q0FVGuPL/Z1Mw2YN0l+41BDv0FHApjTUkIKOeIP\nnwDwpXTa3NjYbk3cOZ/fpH2rYJ++Fte6PNDGPgKppVCUh6x3jiVZ1L7wOgnTdK1Q\nTrw8440IDS5eLykRHvz8OmwvYDl0iIrt832V0QyOlHTGt6ZJ/aTQKl12Fy3QBLv7\nstClPzvHTrgWqVU6uidSYoDtzHbU7Vda7YH0wD9IUoMBf7Tu0rqcE4uH47s2XYkc\nSdLEoOg/Ngs7Y9B1y1GCyj3Ux7hnyvCoRTw014QyNB7dTatFMDvYlrRDGG14KeiU\nUL7Vo/+EejWI31eXNLw84wIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBQkgTWFsNg6wA3HbbihDQ4vpt1E2zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAGz1Asiw7hn5WYUj8RpOCzpE0h/oBZcnxP8wulzZ5Xd0YxWO\n0jYUcUk3tTQy1QvoY+Q5aCjg6vFv+oFBAxkib/SmZzp4xLisZIGlzpJQuAgRkwWA\n6BVMgRS+AaOMQ6wKPgz1x4v6T0cIELZEPq3piGxvvqkcLZKdCaeC3wCS6sxuafzZ\n4qA3zMwWuLOzRftgX2hQto7d/2YkRXga7jSvQl3id/EI+xrYoH6zIWgjdU1AUaNq\nNGT7DIo47vVMfnd9HFZNhREsd4GJE83I+JhTqIxiKPNxrKgESzyADmNPt0gXDnHo\ntbV1pMZz5HpJtjnP/qVZhEK5oB0tqlKPv9yx074=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICuTCCAj6gAwIBAgIRAKp1Rn3aL/g/6oiHVIXtCq8wCgYIKoZIzj0EAwMwgZsx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE0MDIGA1UEAwwrQW1h\nem9uIFJEUyBhcC1ub3J0aGVhc3QtMyBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MjQyMDMyMTdaGA8yMTIxMDUyNDIxMzIxN1owgZsx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE0MDIGA1UEAwwrQW1h\nem9uIFJEUyBhcC1ub3J0aGVhc3QtMyBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABGTYWPILeBJXfcL3Dz4z\nEWMUq78xB1HpjBwHoTURYfcMd5r96BTVG6yaUBWnAVCMeeD6yTG9a1eVGNhG14Hk\nZAEjgLiNB7RRbEG5JZ/XV7W/vODh09WCst2y9SLKsdgeAaNCMEAwDwYDVR0TAQH/\nBAUwAwEB/zAdBgNVHQ4EFgQUoE0qZHmDCDB+Bnm8GUa/evpfPwgwDgYDVR0PAQH/\nBAQDAgGGMAoGCCqGSM49BAMDA2kAMGYCMQCnil5MMwhY3qoXv0xvcKZGxGPaBV15\n0CCssCKn0oVtdJQfJQ3Jrf3RSaEyijXIJsoCMQC35iJi4cWoNX3N/qfgnHohW52O\nB5dg0DYMqy5cNZ40+UcAanRMyqNQ6P7fy3umGco=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtzCCAj2gAwIBAgIQPXnDTPegvJrI98qz8WxrMjAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIEJldGEgdXMtZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxODIxNDAxMloYDzIxMjEwNTE4MjI0MDEyWjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIEJldGEgdXMtZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEI0sR7gwutK5AB46hM761\ngcLTGBIYlURSEoM1jcBwy56CL+3CJKZwLLyJ7qoOKfWbu5GsVLUTWS8MV6Nw33cx\n2KQD2svb694wi+Px2f4n9+XHkEFQw8BbiodDD7RZA70fo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBTQSioOvnVLEMXwNSDg+zgln/vAkjAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIxAMwu1hqm5Bc98uE/E0B5iMYbBQ4kpMxO\ntP8FTfz5UR37HUn26nXE0puj6S/Ffj4oJgIwXI7s2c26tFQeqzq6u3lrNJHp5jC9\nUxlo/hEJOLoDj5jnpxo8dMAtCNoQPaHdfL0P\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjWgAwIBAgIQGKVv+5VuzEZEBzJ+bVfx2zAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGFwLXNvdXRoLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTE5MTc1MDU5WhgPMjEyMTA1MTkxODUwNTlaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgYXAtc291dGgtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABMqdLJ0tZF/DGFZTKZDrGRJZID8ivC2I\nJRCYTWweZKCKSCAzoiuGGHzJhr5RlLHQf/QgmFcgXsdmO2n3CggzhA4tOD9Ip7Lk\nP05eHd2UPInyPCHRgmGjGb0Z+RdQ6zkitKNCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUC1yhRgVqU5bR8cGzOUCIxRpl4EYwDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2cAMGQCMG0c/zLGECRPzGKJvYCkpFTCUvdP4J74YP0v/dPvKojL\nt/BrR1Tg4xlfhaib7hPc7wIwFvgqHes20CubQnZmswbTKLUrgSUW4/lcKFpouFd2\nt2/ewfi/0VhkeUW+IiHhOMdU\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCTCCA/GgAwIBAgIRAOXxJuyXVkbfhZCkS/dOpfEwDQYJKoZIhvcNAQEMBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTI1MjE1OTEwWhgPMjEyMTA1MjUyMjU5MTBa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA\nxiP4RDYm4tIS12hGgn1csfO8onQDmK5SZDswUpl0HIKXOUVVWkHNlINkVxbdqpqH\nFhbyZmNN6F/EWopotMDKe1B+NLrjNQf4zefv2vyKvPHJXhxoKmfyuTd5Wk8k1F7I\nlNwLQzznB+ElhrLIDJl9Ro8t31YBBNFRGAGEnxyACFGcdkjlsa52UwfYrwreEg2l\ngW5AzqHgjFfj9QRLydeU/n4bHm0F1adMsV7P3rVwilcUlqsENDwXnWyPEyv3sw6F\nwNemLEs1129mB77fwvySb+lLNGsnzr8w4wdioZ74co+T9z2ca+eUiP+EQccVw1Is\nD4Fh57IjPa6Wuc4mwiUYKkKY63+38aCfEWb0Qoi+zW+mE9nek6MOQ914cN12u5LX\ndBoYopphRO5YmubSN4xcBy405nIdSdbrAVWwxXnVVyjqjknmNeqQsPZaxAhdoKhV\nAqxNr8AUAdOAO6Sz3MslmcLlDXFihrEEOeUbpg/m1mSUUHGbu966ajTG1FuEHHwS\n7WB52yxoJo/tHvt9nAWnh3uH5BHmS8zn6s6CGweWKbX5yICnZ1QFR1e4pogxX39v\nXD6YcNOO+Vn+HY4nXmjgSYVC7l+eeP8eduMg1xJujzjrbmrXU+d+cBObgdTOAlpa\nJFHaGwYw1osAwPCo9cZ2f04yitBfj9aPFia8ASKldakCAwEAAaNCMEAwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUqKS+ltlior0SyZKYAkJ/efv55towDgYDVR0P\nAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQAdElvp8bW4B+Cv+1WSN87dg6TN\nwGyIjJ14/QYURgyrZiYpUmZpj+/pJmprSWXu4KNyqHftmaidu7cdjL5nCAvAfnY5\n/6eDDbX4j8Gt9fb/6H9y0O0dn3mUPSEKG0crR+JRFAtPhn/2FNvst2P82yguWLv0\npHjHVUVcq+HqDMtUIJsTPYjSh9Iy77Q6TOZKln9dyDOWJpCSkiUWQtMAKbCSlvzd\nzTs/ahqpT+zLfGR1SR+T3snZHgQnbnemmz/XtlKl52NxccARwfcEEKaCRQyGq/pR\n0PVZasyJS9JY4JfQs4YOdeOt4UMZ8BmW1+BQWGSkkb0QIRl8CszoKofucAlqdPcO\nIT/ZaMVhI580LFGWiQIizWFskX6lqbCyHqJB3LDl8gJISB5vNTHOHpvpMOMs5PYt\ncRl5Mrksx5MKMqG7y5R734nMlZxQIHjL5FOoOxTBp9KeWIL/Ib89T2QDaLw1SQ+w\nihqWBJ4ZdrIMWYpP3WqM+MXWk7WAem+xsFJdR+MDgOOuobVQTy5dGBlPks/6gpjm\nrO9TjfQ36ppJ3b7LdKUPeRfnYmlR5RU4oyYJ//uLbClI443RZAgxaCXX/nyc12lr\neVLUMNF2abLX4/VF63m2/Z9ACgMRfqGshPssn1NN33OonrotQoj4S3N9ZrjvzKt8\niHcaqd60QKpfiH2A3A==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICuDCCAj2gAwIBAgIQPaVGRuu86nh/ylZVCLB0MzAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLW5vcnRoZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNTIyMDMxNloYDzIxMjEwNTI1MjMwMzE2WjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLW5vcnRoZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEexNURoB9KE93MEtEAlJG\nobz4LS/pD2hc8Gczix1WhVvpJ8bN5zCDXaKdnDMCebetyRQsmQ2LYlfmCwpZwSDu\n0zowB11Pt3I5Avu2EEcuKTlKIDMBeZ1WWuOd3Tf7MEAMo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBSaYbZPBvFLikSAjpa8mRJvyArMxzAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaQAwZgIxAOEJkuh3Zjb7Ih/zuNRd1RBqmIYcnyw0\nnwUZczKXry+9XebYj3VQxSRNadrarPWVqgIxAMg1dyGoDAYjY/L/9YElyMnvHltO\nPwpJShmqHvCLc/mXMgjjYb/akK7yGthvW6j/uQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCDCCA/CgAwIBAgIQChu3v5W1Doil3v6pgRIcVzANBgkqhkiG9w0BAQwFADCB\nnDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTUwMwYDVQQDDCxB\nbWF6b24gUkRTIEJldGEgdXMtZWFzdC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4G\nA1UEBwwHU2VhdHRsZTAgFw0yMTA1MTgyMTM0MTVaGA8yMTIxMDUxODIyMzQxNVow\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBCZXRhIHVzLWVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC1\nFUGQ5tf3OwpDR6hGBxhUcrkwKZhaXP+1St1lSOQvjG8wXT3RkKzRGMvb7Ee0kzqI\nmzKKe4ASIhtV3UUWdlNmP0EA3XKnif6N79MismTeGkDj75Yzp5A6tSvqByCgxIjK\nJqpJrch3Dszoyn8+XhwDxMZtkUa5nQVdJgPzJ6ltsQ8E4SWLyLtTu0S63jJDkqYY\nS7cQblk7y7fel+Vn+LS5dGTdRRhMvSzEnb6mkVBaVzRyVX90FNUED06e8q+gU8Ob\nhtvQlf9/kRzHwRAdls2YBhH40ZeyhpUC7vdtPwlmIyvW5CZ/QiG0yglixnL6xahL\npbmTuTSA/Oqz4UGQZv2WzHe1lD2gRHhtFX2poQZeNQX8wO9IcUhrH5XurW/G9Xwl\nSat9CMPERQn4KC3HSkat4ir2xaEUrjfg6c4XsGyh2Pk/LZ0gLKum0dyWYpWP4JmM\nRQNjrInXPbMhzQObozCyFT7jYegS/3cppdyy+K1K7434wzQGLU1gYXDKFnXwkX8R\nbRKgx2pHNbH5lUddjnNt75+e8m83ygSq/ZNBUz2Ur6W2s0pl6aBjwaDES4VfWYlI\njokcmrGvJNDfQWygb1k00eF2bzNeNCHwgWsuo3HSxVgc/WGsbcGrTlDKfz+g3ich\nbXUeUidPhRiv5UQIVCLIHpHuin3bj9lQO/0t6p+tAQIDAQABo0IwQDAPBgNVHRMB\nAf8EBTADAQH/MB0GA1UdDgQWBBSFmMBgm5IsRv3hLrvDPIhcPweXYTAOBgNVHQ8B\nAf8EBAMCAYYwDQYJKoZIhvcNAQEMBQADggIBAAa2EuozymOsQDJlEi7TqnyA2OhT\nGXPfYqCyMJVkfrqNgcnsNpCAiNEiZbb+8sIPXnT8Ay8hrwJYEObJ5b7MHXpLuyft\nz0Pu1oFLKnQxKjNxrIsCvaB4CRRdYjm1q7EqGhMGv76se9stOxkOqO9it31w/LoU\nENDk7GLsSqsV1OzYLhaH8t+MaNP6rZTSNuPrHwbV3CtBFl2TAZ7iKgKOhdFz1Hh9\nPez0lG+oKi4mHZ7ajov6PD0W7njn5KqzCAkJR6OYmlNVPjir+c/vUtEs0j+owsMl\ng7KE5g4ZpTRShyh5BjCFRK2tv0tkqafzNtxrKC5XNpEkqqVTCnLcKG+OplIEadtr\nC7UWf4HyhCiR+xIyxFyR05p3uY/QQU/5uza7GlK0J+U1sBUytx7BZ+Fo8KQfPPqV\nCqDCaYUksoJcnJE/KeoksyqNQys7sDGJhkd0NeUGDrFLKHSLhIwAMbEWnqGxvhli\nE7sP2E5rI/I9Y9zTbLIiI8pfeZlFF8DBdoP/Hzg8pqsiE/yiXSFTKByDwKzGwNqz\nF0VoFdIZcIbLdDbzlQitgGpJtvEL7HseB0WH7B2PMMD8KPJlYvPveO3/6OLzCsav\n+CAkvk47NQViKMsUTKOA0JDCW+u981YRozxa3K081snhSiSe83zIPBz1ikldXxO9\n6YYLNPRrj3mi9T/f\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAMkvdFnVDb0mWWFiXqnKH68wCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyB1cy13ZXN0LTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTE5MTkxMzI0WhgPMjEyMTA1MTkyMDEzMjRaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgdXMtd2VzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEy86DB+9th/0A5VcWqMSWDxIUblWTt/R0\nao6Z2l3vf2YDF2wt1A2NIOGpfQ5+WAOJO/IQmnV9LhYo+kacB8sOnXdQa6biZZkR\nIyouUfikVQAKWEJnh1Cuo5YMM4E2sUt5o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBQ8u3OnecANmG8OoT7KLWDuFzZwBTAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIwQ817qkb7mWJFnieRAN+m9W3E0FLVKaV3zC5aYJUk2fcZ\nTaUx3oLp3jPLGvY5+wgeAjEA6wAicAki4ZiDfxvAIuYiIe1OS/7H5RA++R8BH6qG\niRzUBM/FItFpnkus7u/eTkvo\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrzCCAjWgAwIBAgIQS/+Ryfgb/IOVEa1pWoe8oTAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGFwLXNvdXRoLTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjIwNjA2MjE1NDQyWhgPMjEyMjA2MDYyMjU0NDJaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgYXAtc291dGgtMiBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABDsX6fhdUWBQpYTdseBD/P3s96Dtw2Iw\nOrXKNToCnmX5nMkUGdRn9qKNiz1pw3EPzaPxShbYwQ7LYP09ENK/JN4QQjxMihxC\njLFxS85nhBQQQGRCWikDAe38mD8fSvREQKNCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUIh1xZiseQYFjPYKJmGbruAgRH+AwDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2gAMGUCMFudS4zLy+UUGrtgNLtRMcu/DZ9BUzV4NdHxo0bkG44O\nthnjl4+wTKI6VbyAbj2rkgIxAOHps8NMITU5DpyiMnKTxV8ubb/WGHrLl0BjB8Lw\nETVJk5DNuZvsIIcm7ykk6iL4Tw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGBDCCA+ygAwIBAgIQDcEmNIAVrDpUw5cH5ynutDANBgkqhkiG9w0BAQwFADCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIG1lLWNlbnRyYWwtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNV\nBAcMB1NlYXR0bGUwIBcNMjIwNTA3MDA0MDIzWhgPMjEyMjA1MDcwMTQwMjNaMIGa\nMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5j\nLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMzAxBgNVBAMMKkFt\nYXpvbiBSRFMgbWUtY2VudHJhbC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAKvADk8t\nFl9bFlU5sajLPPDSOUpPAkKs6iPlz+27o1GJC88THcOvf3x0nVAcu9WYe9Qaas+4\nj4a0vv51agqyODRD/SNi2HnqW7DbtLPAm6KBHe4twl28ItB/JD5g7u1oPAHFoXMS\ncH1CZEAs5RtlZGzJhcBXLFsHNv/7+SCLyZ7+2XFh9OrtgU4wMzkHoRNndhfwV5bu\n17bPTwuH+VxH37zXf1mQ/KjhuJos0C9dL0FpjYBAuyZTAWhZKs8dpSe4DI544z4w\ngkwUB4bC2nA1TBzsywEAHyNuZ/xRjNpWvx0ToWAA2iFJqC3VO3iKcnBplMvaUuMt\njwzVSNBnKcoabXCZL2XDLt4YTZR8FSwz05IvsmwcPB7uNTBXq3T9sjejW8QQK3vT\ntzyfLq4jKmQE7PoS6cqYm+hEPm2hDaC/WP9bp3FdEJxZlPH26fq1b7BWYWhQ9pBA\nNv9zTnzdR1xohTyOJBUFQ81ybEzabqXqVXUIANqIOaNcTB09/sLJ7+zuMhp3mwBu\nLtjfJv8PLuT1r63bU3seROhKA98b5KfzjvbvPSg3vws78JQyoYGbqNyDfyjVjg3U\nv//AdVuPie6PNtdrW3upZY4Qti5IjP9e3kimaJ+KAtTgMRG56W0WxD3SP7+YGGbG\nKhntDOkKsN39hLpn9UOafTIqFu7kIaueEy/NAgMBAAGjQjBAMA8GA1UdEwEB/wQF\nMAMBAf8wHQYDVR0OBBYEFHAems86dTwdZbLe8AaPy3kfIUVoMA4GA1UdDwEB/wQE\nAwIBhjANBgkqhkiG9w0BAQwFAAOCAgEAOBHpp0ICx81kmeoBcZTrMdJs2gnhcd85\nFoSCjXx9H5XE5rmN/lQcxxOgj8hr3uPuLdLHu+i6THAyzjrl2NA1FWiqpfeECGmy\n0jm7iZsYORgGQYp/VKnDrwnKNSqlZvOuRr0kfUexwFlr34Y4VmupvEOK/RdGsd3S\n+3hiemcHse9ST/sJLHx962AWMkN86UHPscJEe4+eT3f2Wyzg6La8ARwdWZSNS+WH\nZfybrncMmuiXuUdHv9XspPsqhKgtHhcYeXOGUtrwQPLe3+VJZ0LVxhlTWr9951GZ\nGfmWwTV/9VsyKVaCFIXeQ6L+gjcKyEzYF8wpMtQlSc7FFqwgC4bKxvMBSaRy88Nr\nlV2+tJD/fr8zGUeBK44Emon0HKDBWGX+/Hq1ZIv0Da0S+j6LbA4fusWxtGfuGha+\nluhHgVInCpALIOamiBEdGhILkoTtx7JrYppt3/Raqg9gUNCOOYlCvGhqX7DXeEfL\nDGabooiY2FNWot6h04JE9nqGj5QqT8D6t/TL1nzxhRPzbcSDIHUd/b5R+a0bAA+7\nYTU6JqzEVCWKEIEynYmqikgLMGB/OzWsgyEL6822QW6hJAQ78XpbNeCzrICF4+GC\n7KShLnwuWoWpAb26268lvOEvCTFM47VC6jNQl97md+2SA9Ma81C9wflid2M83Wle\ncuLMVcQZceE=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQAhAteLRCvizAElaWORFU2zANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIG1lLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMDE3MDkxNloYDzIwNjEwNTIwMTgwOTE2WjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIG1lLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA+qg7JAcOVKjh\nN83SACnBFZPyB63EusfDr/0V9ZdL8lKcmZX9sv/CqoBo3N0EvBqHQqUUX6JvFb7F\nXrMUZ740kr28gSRALfXTFgNODjXeDsCtEkKRTkac/UM8xXHn+hR7UFRPHS3e0GzI\niLiwQWDkr0Op74W8aM0CfaVKvh2bp4BI1jJbdDnQ9OKXpOxNHGUf0ZGb7TkNPkgI\nb2CBAc8J5o3H9lfw4uiyvl6Fz5JoP+A+zPELAioYBXDrbE7wJeqQDJrETWqR9VEK\nBXURCkVnHeaJy123MpAX2ozf4pqk0V0LOEOZRS29I+USF5DcWr7QIXR/w2I8ws1Q\n7ys+qbE+kQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBQFJ16n\n1EcCMOIhoZs/F9sR+Jy++zAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAOc5nXbT3XTDEZsxX2iD15YrQvmL5m13B3ImZWpx/pqmObsgx3/dg75rF2nQ\nqS+Vl+f/HLh516pj2BPP/yWCq12TRYigGav8UH0qdT3CAClYy2o+zAzUJHm84oiB\nud+6pFVGkbqpsY+QMpJUbZWu52KViBpJMYsUEy+9cnPSFRVuRAHjYynSiLk2ZEjb\nWkdc4x0nOZR5tP0FgrX0Ve2KcjFwVQJVZLgOUqmFYQ/G0TIIGTNh9tcmR7yp+xJR\nA2tbPV2Z6m9Yxx4E8lLEPNuoeouJ/GR4CkMEmF8cLwM310t174o3lKKUXJ4Vs2HO\nWj2uN6R9oI+jGLMSswTzCNV1vgc=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICuDCCAj6gAwIBAgIRAOocLeZWjYkG/EbHmscuy8gwCgYIKoZIzj0EAwMwgZsx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE0MDIGA1UEAwwrQW1h\nem9uIFJEUyBhcC1zb3V0aGVhc3QtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MjEyMTUwMDFaGA8yMTIxMDUyMTIyNTAwMVowgZsx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE0MDIGA1UEAwwrQW1h\nem9uIFJEUyBhcC1zb3V0aGVhc3QtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABCEr3jq1KtRncnZfK5cq\nbtY0nW6ZG3FMbh7XwBIR6Ca0f8llGZ4vJEC1pXgiM/4Dh045B9ZIzNrR54rYOIfa\n2NcYZ7mk06DjIQML64hbAxbQzOAuNzLPx268MrlL2uW2XaNCMEAwDwYDVR0TAQH/\nBAUwAwEB/zAdBgNVHQ4EFgQUln75pChychwN4RfHl+tOinMrfVowDgYDVR0PAQH/\nBAQDAgGGMAoGCCqGSM49BAMDA2gAMGUCMGiyPINRU1mwZ4Crw01vpuPvxZxb2IOr\nyX3RNlOIu4We1H+5dQk5tIvH8KGYFbWEpAIxAO9NZ6/j9osMhLgZ0yj0WVjb+uZx\nYlZR9fyFisY/jNfX7QhSk+nrc3SFLRUNtpXrng==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBTCCAu2gAwIBAgIRAKiaRZatN8eiz9p0s0lu0rQwDQYJKoZIhvcNAQELBQAw\ngZoxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEzMDEGA1UEAwwq\nQW1hem9uIFJEUyBjYS1jZW50cmFsLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYD\nVQQHDAdTZWF0dGxlMCAXDTIxMDUyMTIyMDIzNVoYDzIwNjEwNTIxMjMwMjM1WjCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGNhLWNlbnRyYWwtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNV\nBAcMB1NlYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCygVMf\nqB865IR9qYRBRFHn4eAqGJOCFx+UbraQZmjr/mnRqSkY+nhbM7Pn/DWOrRnxoh+w\nq5F9ZxdZ5D5T1v6kljVwxyfFgHItyyyIL0YS7e2h7cRRscCM+75kMedAP7icb4YN\nLfWBqfKHbHIOqvvQK8T6+Emu/QlG2B5LvuErrop9K0KinhITekpVIO4HCN61cuOe\nCADBKF/5uUJHwS9pWw3uUbpGUwsLBuhJzCY/OpJlDqC8Y9aToi2Ivl5u3/Q/sKjr\n6AZb9lx4q3J2z7tJDrm5MHYwV74elGSXoeoG8nODUqjgklIWAPrt6lQ3WJpO2kug\n8RhCdSbWkcXHfX95AgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYE\nFOIxhqTPkKVqKBZvMWtKewKWDvDBMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0B\nAQsFAAOCAQEAqoItII89lOl4TKvg0I1EinxafZLXIheLcdGCxpjRxlZ9QMQUN3yb\ny/8uFKBL0otbQgJEoGhxm4h0tp54g28M6TN1U0332dwkjYxUNwvzrMaV5Na55I2Z\n1hq4GB3NMXW+PvdtsgVOZbEN+zOyOZ5MvJHEQVkT3YRnf6avsdntltcRzHJ16pJc\nY8rR7yWwPXh1lPaPkxddrCtwayyGxNbNmRybjR48uHRhwu7v2WuAMdChL8H8bp89\nTQLMrMHgSbZfee9hKhO4Zebelf1/cslRSrhkG0ESq6G5MUINj6lMg2g6F0F7Xz2v\nncD/vuRN5P+vT8th/oZ0Q2Gc68Pun0cn/g==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/zCCAuegAwIBAgIRAJYlnmkGRj4ju/2jBQsnXJYwDQYJKoZIhvcNAQELBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyB1cy1lYXN0LTIgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMTIzMDQ0NFoYDzIwNjEwNTIyMDAwNDQ0WjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIHVzLWVhc3QtMiBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC74V3eigv+pCj5\nnqDBqplY0Jp16pTeNB06IKbzb4MOTvNde6QjsZxrE1xUmprT8LxQqN9tI3aDYEYk\nb9v4F99WtQVgCv3Y34tYKX9NwWQgwS1vQwnIR8zOFBYqsAsHEkeJuSqAB12AYUSd\nZv2RVFjiFmYJho2X30IrSLQfS/IE3KV7fCyMMm154+/K1Z2IJlcissydEAwgsUHw\nedrE6CxJVkkJ3EvIgG4ugK/suxd8eEMztaQYJwSdN8TdfT59LFuSPl7zmF3fIBdJ\n//WexcQmGabaJ7Xnx+6o2HTfkP8Zzzzaq8fvjAcvA7gyFH5EP26G2ZqMG+0y4pTx\nSPVTrQEXAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFIWWuNEF\nsUMOC82XlfJeqazzrkPDMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC\nAQEAgClmxcJaQTGpEZmjElL8G2Zc8lGc+ylGjiNlSIw8X25/bcLRptbDA90nuP+q\nzXAMhEf0ccbdpwxG/P5a8JipmHgqQLHfpkvaXx+0CuP++3k+chAJ3Gk5XtY587jX\n+MJfrPgjFt7vmMaKmynndf+NaIJAYczjhJj6xjPWmGrjM3MlTa9XesmelMwP3jep\nbApIWAvCYVjGndbK9byyMq1nyj0TUzB8oJZQooaR3MMjHTmADuVBylWzkRMxbKPl\n4Nlsk4Ef1JvIWBCzsMt+X17nuKfEatRfp3c9tbpGlAE/DSP0W2/Lnayxr4RpE9ds\nICF35uSis/7ZlsftODUe8wtpkQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/zCCA+egAwIBAgIRAPvvd+MCcp8E36lHziv0xhMwDQYJKoZIhvcNAQEMBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyB1cy1lYXN0LTIgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMTIzMTEwNloYDzIxMjEwNTIyMDAxMTA2WjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIHVzLWVhc3QtMiBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDbvwekKIKGcV/s\nlDU96a71ZdN2pTYkev1X2e2/ICb765fw/i1jP9MwCzs8/xHBEQBJSxdfO4hPeNx3\nENi0zbM+TrMKliS1kFVe1trTTEaHYjF8BMK9yTY0VgSpWiGxGwg4tshezIA5lpu8\nsF6XMRxosCEVCxD/44CFqGZTzZaREIvvFPDTXKJ6yOYnuEkhH3OcoOajHN2GEMMQ\nShuyRFDQvYkqOC/Q5icqFbKg7eGwfl4PmimdV7gOVsxSlw2s/0EeeIILXtHx22z3\n8QBhX25Lrq2rMuaGcD3IOMBeBo2d//YuEtd9J+LGXL9AeOXHAwpvInywJKAtXTMq\nWsy3LjhuANFrzMlzjR2YdjkGVzeQVx3dKUzJ2//Qf7IXPSPaEGmcgbxuatxjnvfT\nH85oeKr3udKnXm0Kh7CLXeqJB5ITsvxI+Qq2iXtYCc+goHNR01QJwtGDSzuIMj3K\nf+YMrqBXZgYBwU2J/kCNTH31nfw96WTbOfNGwLwmVRDgguzFa+QzmQsJW4FTDMwc\n7cIjwdElQQVA+Gqa67uWmyDKAnoTkudmgAP+OTBkhnmc6NJuZDcy6f/iWUdl0X0u\n/tsfgXXR6ZovnHonM13ANiN7VmEVqFlEMa0VVmc09m+2FYjjlk8F9sC7Rc4wt214\n7u5YvCiCsFZwx44baP5viyRZgkJVpQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBQgCZCsc34nVTRbWsniXBPjnUTQ2DAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQEMBQADggIBAAQas3x1G6OpsIvQeMS9BbiHG3+kU9P/ba6Rrg+E\nlUz8TmL04Bcd+I+R0IyMBww4NznT+K60cFdk+1iSmT8Q55bpqRekyhcdWda1Qu0r\nJiTi7zz+3w2v66akofOnGevDpo/ilXGvCUJiLOBnHIF0izUqzvfczaMZGJT6xzKq\nPcEVRyAN1IHHf5KnGzUlVFv9SGy47xJ9I1vTk24JU0LWkSLzMMoxiUudVmHSqJtN\nu0h+n/x3Q6XguZi1/C1KOntH56ewRh8n5AF7c+9LJJSRM9wunb0Dzl7BEy21Xe9q\n03xRYjf5wn8eDELB8FZPa1PrNKXIOLYM9egdctbKEcpSsse060+tkyBrl507+SJT\n04lvJ4tcKjZFqxn+bUkDQvXYj0D3WK+iJ7a8kZJPRvz8BDHfIqancY8Tgw+69SUn\nWqIb+HNZqFuRs16WFSzlMksqzXv6wcDSyI7aZOmCGGEcYW9NHk8EuOnOQ+1UMT9C\nQb1GJcipjRzry3M4KN/t5vN3hIetB+/PhmgTO4gKhBETTEyPC3HC1QbdVfRndB6e\nU/NF2U/t8U2GvD26TTFLK4pScW7gyw4FQyXWs8g8FS8f+R2yWajhtS9++VDJQKom\nfAUISoCH+PlPRJpu/nHd1Zrddeiiis53rBaLbXu2J1Q3VqjWOmtj0HjxJJxWnYmz\nPqj2\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAI/U4z6+GF8/znpHM8Dq8G0wDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBhcC1zb3V0aC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMjA2MDYyMTQ4MThaGA8yMTIyMDYwNjIyNDgxOFowgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBhcC1zb3V0aC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK5WqMvyq888\n3uuOtEj1FcP6iZhqO5kJurdJF59Otp2WCg+zv6I+QwaAspEWHQsKD405XfFsTGKV\nSKTCwoMxwBniuChSmyhlagQGKSnRY9+znOWq0v7hgmJRwp6FqclTbubmr+K6lzPy\nhs86mEp68O5TcOTYWUlPZDqfKwfNTbtCl5YDRr8Gxb5buHmkp6gUSgDkRsXiZ5VV\nb3GBmXRqbnwo5ZRNAzQeM6ylXCn4jKs310lQGUrFbrJqlyxUdfxzqdlaIRn2X+HY\nxRSYbHox3LVNPpJxYSBRvpQVFSy9xbX8d1v6OM8+xluB31cbLBtm08KqPFuqx+cO\nI2H5F0CYqYzhyOSKJsiOEJT6/uH4ewryskZzncx9ae62SC+bB5n3aJLmOSTkKLFY\nYS5IsmDT2m3iMgzsJNUKVoCx2zihAzgBanFFBsG+Xmoq0aKseZUI6vd2qpd5tUST\n/wS1sNk0Ph7teWB2ACgbFE6etnJ6stwjHFZOj/iTYhlnR2zDRU8akunFdGb6CB4/\nhMxGJxaqXSJeGtHm7FpadlUTf+2ESbYcVW+ui/F8sdBJseQdKZf3VdZZMgM0bcaX\nNE47cauDTy72WdU9YJX/YXKYMLDE0iFHTnGpfVGsuWGPYhlwZ3dFIO07mWnCRM6X\nu5JXRB1oy5n5HRluMsmpSN/R92MeBxKFAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFNtH0F0xfijSLHEyIkRGD9gW6NazMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEACo+5jFeY3ygxoDDzL3xpfe5M0U1WxdKk+az4\n/OfjZvkoma7WfChi3IIMtwtKLYC2/seKWA4KjlB3rlTsCVNPnK6D+gAnybcfTKk/\nIRSPk92zagwQkSUWtAk80HpVfWJzpkSU16ejiajhedzOBRtg6BwsbSqLCDXb8hXr\neXWC1S9ZceGc+LcKRHewGWPu31JDhHE9bNcl9BFSAS0lYVZqxIRWxivZ+45j5uQv\nwPrC8ggqsdU3K8quV6dblUQzzA8gKbXJpCzXZihkPrYpQHTH0szvXvgebh+CNUAG\nrUxm8+yTS0NFI3U+RLbcLFVzSvjMOnEwCX0SPj5XZRYYXs5ajtQCoZhTUkkwpDV8\nRxXk8qGKiXwUxDO8GRvmvM82IOiXz5w2jy/h7b7soyIgdYiUydMq4Ja4ogB/xPZa\ngf4y0o+bremO15HFf1MkaU2UxPK5FFVUds05pKvpSIaQWbF5lw4LHHj4ZtVup7zF\nCLjPWs4Hs/oUkxLMqQDw0FBwlqa4uot8ItT8uq5BFpz196ZZ+4WXw5PVzfSxZibI\nC/nwcj0AS6qharXOs8yPnPFLPSZ7BbmWzFDgo3tpglRqo3LbSPsiZR+sLeivqydr\n0w4RK1btRda5Ws88uZMmW7+2aufposMKcbAdrApDEAVzHijbB/nolS5nsnFPHZoA\nKDPtFEk=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtzCCAj2gAwIBAgIQVZ5Y/KqjR4XLou8MCD5pOjAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC00IFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIyMDUyNTE2NTgzM1oYDzIxMjIwNTI1MTc1ODMzWjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC00IFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEbo473OmpD5vkckdJajXg\nbrhmNFyoSa0WCY1njuZC2zMFp3zP6rX4I1r3imrYnJd9pFH/aSiV/r6L5ACE5RPx\n4qdg5SQ7JJUaZc3DWsTOiOed7BCZSzM+KTYK/2QzDMApo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBTmogc06+1knsej1ltKUOdWFvwgsjAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIxAIs7TlLMbGTWNXpGiKf9DxaM07d/iDHe\nF/Vv/wyWSTGdobxBL6iArQNVXz0Gr4dvPAIwd0rsoa6R0x5mtvhdRPtM37FYrbHJ\npbV+OMusQqcSLseunLBoCHenvJW0QOCQ8EDY\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICvTCCAkOgAwIBAgIQCIY7E/bFvFN2lK9Kckb0dTAKBggqhkjOPQQDAzCBnjEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTcwNQYDVQQDDC5BbWF6\nb24gUkRTIFByZXZpZXcgdXMtZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYD\nVQQHDAdTZWF0dGxlMCAXDTIxMDUxODIxMDUxMFoYDzIxMjEwNTE4MjIwNTEwWjCB\nnjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTcwNQYDVQQDDC5B\nbWF6b24gUkRTIFByZXZpZXcgdXMtZWFzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEMI0hzf1JCEOI\nEue4+DmcNnSs2i2UaJxHMrNGGfU7b42a7vwP53F7045ffHPBGP4jb9q02/bStZzd\nVHqfcgqkSRI7beBKjD2mfz82hF/wJSITTgCLs+NRpS6zKMFOFHUNo0IwQDAPBgNV\nHRMBAf8EBTADAQH/MB0GA1UdDgQWBBS8uF/6hk5mPLH4qaWv9NVZaMmyTjAOBgNV\nHQ8BAf8EBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIxAO7Pu9wzLyM0X7Q08uLIL+vL\nqaxe3UFuzFTWjM16MLJHbzLf1i9IDFKz+Q4hXCSiJwIwClMBsqT49BPUxVsJnjGr\nEbyEk6aOOVfY1p2yQL649zh3M4h8okLnwf+bYIb1YpeU\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQY+JhwFEQTe36qyRlUlF8ozANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGFmLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE5MjQxNloYDzIwNjEwNTE5MjAyNDE2WjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGFmLXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnIye77j6ev40\n8wRPyN2OdKFSUfI9jB20Or2RLO+RDoL43+USXdrze0Wv4HMRLqaen9BcmCfaKMp0\nE4SFo47bXK/O17r6G8eyq1sqnHE+v288mWtYH9lAlSamNFRF6YwA7zncmE/iKL8J\n0vePHMHP/B6svw8LULZCk+nZk3tgxQn2+r0B4FOz+RmpkoVddfqqUPMbKUxhM2wf\nfO7F6bJaUXDNMBPhCn/3ayKCjYr49ErmnpYV2ZVs1i34S+LFq39J7kyv6zAgbHv9\n+/MtRMoRB1CjpqW0jIOZkHBdYcd1o9p1zFn591Do1wPkmMsWdjIYj+6e7UXcHvOB\n2+ScIRAcnwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBQGtq2W\nYSyMMxpdQ3IZvcGE+nyZqTAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAEgoP3ixJsKSD5FN8dQ01RNHERl/IFbA7TRXfwC+L1yFocKnQh4Mp/msPRSV\n+OeHIvemPW/wtZDJzLTOFJ6eTolGekHK1GRTQ6ZqsWiU2fmiOP8ks4oSpI+tQ9Lw\nVrfZqTiEcS5wEIqyfUAZZfKDo7W1xp+dQWzfczSBuZJZwI5iaha7+ILM0r8Ckden\nTVTapc5pLSoO15v0ziRuQ2bT3V3nwu/U0MRK44z+VWOJdSiKxdnOYDs8hFNnKhfe\nklbTZF7kW7WbiNYB43OaAQBJ6BALZsIskEaqfeZT8FD71uN928TcEQyBDXdZpRN+\niGQZDGhht0r0URGMDSs9waJtTfA=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/jCCA+agAwIBAgIQXY/dmS+72lZPranO2JM9jjANBgkqhkiG9w0BAQwFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIGFwLWVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTI1MjEzNDUxWhgPMjEyMTA1MjUyMjM0NTFaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgYXAtZWFzdC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMyW9kBJjD/hx8e8\nb5E1sF42bp8TXsz1htSYE3Tl3T1Aq379DfEhB+xa/ASDZxt7/vwa81BkNo4M6HYq\nokYIXeE7cu5SnSgjWXqcERhgPevtAwgmhdE3yREe8oz2DyOi2qKKZqah+1gpPaIQ\nfK0uAqoeQlyHosye3KZZKkDHBatjBsQ5kf8lhuf7wVulEZVRHY2bP2X7N98PfbpL\nQdH7mWXzDtJJ0LiwFwds47BrkgK1pkHx2p1mTo+HMkfX0P6Fq1atkVC2RHHtbB/X\niYyH7paaHBzviFrhr679zNqwXIOKlbf74w3mS11P76rFn9rS1BAH2Qm6eY5S/Fxe\nHEKXm4kjPN63Zy0p3yE5EjPt54yPkvumOnT+RqDGJ2HCI9k8Ehcbve0ogfdRKNqQ\nVHWYTy8V33ndQRHZlx/CuU1yN61TH4WSoMly1+q1ihTX9sApmlQ14B2pJi/9DnKW\ncwECrPy1jAowC2UJ45RtC8UC05CbP9yrIy/7Noj8gQDiDOepm+6w1g6aNlWoiuQS\nkyI6nzz1983GcnOHya73ga7otXo0Qfg9jPghlYiMomrgshlSLDHZG0Ib/3hb8cnR\n1OcN9FpzNmVK2Ll1SmTMLrIhuCkyNYX9O/bOknbcf706XeESxGduSkHEjIw/k1+2\nAtteoq5dT6cwjnJ9hyhiueVlVkiDAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8w\nHQYDVR0OBBYEFLUI+DD7RJs+0nRnjcwIVWzzYSsFMA4GA1UdDwEB/wQEAwIBhjAN\nBgkqhkiG9w0BAQwFAAOCAgEAb1mcCHv4qMQetLGTBH9IxsB2YUUhr5dda0D2BcHr\nUtDbfd0VQs4tux6h/6iKwHPx0Ew8fuuYj99WknG0ffgJfNc5/fMspxR/pc1jpdyU\n5zMQ+B9wi0lOZPO9uH7/pr+d2odcNEy8zAwqdv/ihsTwLmGP54is9fVbsgzNW1cm\nHKAVL2t/Ope+3QnRiRilKCN1lzhav4HHdLlN401TcWRWKbEuxF/FgxSO2Hmx86pj\ne726lweCTMmnq/cTsPOVY0WMjs0or3eHDVlyLgVeV5ldyN+ptg3Oit60T05SRa58\nAJPTaVKIcGQ/gKkKZConpu7GDofT67P/ox0YNY57LRbhsx9r5UY4ROgz7WMQ1yoS\nY+19xizm+mBm2PyjMUbfwZUyCxsdKMwVdOq5/UmTmdms+TR8+m1uBHPOTQ2vKR0s\nPd/THSzPuu+d3dbzRyDSLQbHFFneG760CUlD/ZmzFlQjJ89/HmAmz8IyENq+Sjhx\nJgzy+FjVZb8aRUoYLlnffpUpej1n87Ynlr1GrvC4GsRpNpOHlwuf6WD4W0qUTsC/\nC9JO+fBzUj/aWlJzNcLEW6pte1SB+EdkR2sZvWH+F88TxemeDrV0jKJw5R89CDf8\nZQNfkxJYjhns+YeV0moYjqQdc7tq4i04uggEQEtVzEhRLU5PE83nlh/K2NZZm8Kj\ndIA=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/zCCAuegAwIBAgIRAPVSMfFitmM5PhmbaOFoGfUwDQYJKoZIhvcNAQELBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyB1cy1lYXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNTIyMzQ1N1oYDzIwNjEwNTI1MjMzNDU3WjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIHVzLWVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDu9H7TBeGoDzMr\ndxN6H8COntJX4IR6dbyhnj5qMD4xl/IWvp50lt0VpmMd+z2PNZzx8RazeGC5IniV\n5nrLg0AKWRQ2A/lGGXbUrGXCSe09brMQCxWBSIYe1WZZ1iU1IJ/6Bp4D2YEHpXrW\nbPkOq5x3YPcsoitgm1Xh8ygz6vb7PsvJvPbvRMnkDg5IqEThapPjmKb8ZJWyEFEE\nQRrkCIRueB1EqQtJw0fvP4PKDlCJAKBEs/y049FoOqYpT3pRy0WKqPhWve+hScMd\n6obq8kxTFy1IHACjHc51nrGII5Bt76/MpTWhnJIJrCnq1/Uc3Qs8IVeb+sLaFC8K\nDI69Sw6bAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFE7PCopt\nlyOgtXX0Y1lObBUxuKaCMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC\nAQEAFj+bX8gLmMNefr5jRJfHjrL3iuZCjf7YEZgn89pS4z8408mjj9z6Q5D1H7yS\njNETVV8QaJip1qyhh5gRzRaArgGAYvi2/r0zPsy+Tgf7v1KGL5Lh8NT8iCEGGXwF\ng3Ir+Nl3e+9XUp0eyyzBIjHtjLBm6yy8rGk9p6OtFDQnKF5OxwbAgip42CD75r/q\np421maEDDvvRFR4D+99JZxgAYDBGqRRceUoe16qDzbMvlz0A9paCZFclxeftAxv6\nQlR5rItMz/XdzpBJUpYhdzM0gCzAzdQuVO5tjJxmXhkSMcDP+8Q+Uv6FA9k2VpUV\nE/O5jgpqUJJ2Hc/5rs9VkAPXeA==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrzCCAjWgAwIBAgIQW0yuFCle3uj4vWiGU0SaGzAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGFmLXNvdXRoLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTE5MTkzNTE2WhgPMjEyMTA1MTkyMDM1MTZaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgYWYtc291dGgtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABDPiKNZSaXs3Un/J/v+LTsFDANHpi7en\noL2qh0u0DoqNzEBTbBjvO23bLN3k599zh6CY3HKW0r2k1yaIdbWqt4upMCRCcUFi\nI4iedAmubgzh56wJdoMZztjXZRwDthTkJKNCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUWbYkcrvVSnAWPR5PJhIzppcAnZIwDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2gAMGUCMCESGqpat93CjrSEjE7z+Hbvz0psZTHwqaxuiH64GKUm\nmYynIiwpKHyBrzjKBmeDoQIxANGrjIo6/b8Jl6sdIZQI18V0pAyLfLiZjlHVOnhM\nMOTVgr82ZuPoEHTX78MxeMnYlw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRAIbsx8XOl0sgTNiCN4O+18QwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTI1MjE1NDU4WhgPMjA2MTA1MjUyMjU0NTha\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\ntROxwXWCgn5R9gI/2Ivjzaxc0g95ysBjoJsnhPdJEHQb7w3y2kWrVWU3Y9fOitgb\nCEsnEC3PrhRnzNVW0fPsK6kbvOeCmjvY30rdbxbc8h+bjXfGmIOgAkmoULEr6Hc7\nG1Q/+tvv4lEwIs7bEaf+abSZxRJbZ0MBxhbHn7UHHDiMZYvzK+SV1MGCxx7JVhrm\nxWu3GC1zZCsGDhB9YqY9eR6PmjbqA5wy8vqbC57dZZa1QVtWIQn3JaRXn+faIzHx\nnLMN5CEWihsdmHBXhnRboXprE/OS4MFv1UrQF/XM/h5RBeCywpHePpC+Oe1T3LNC\niP8KzRFrjC1MX/WXJnmOVQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBS33XbXAUMs1znyZo4B0+B3D68WFTAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBADuadd2EmlpueY2VlrIIPC30QkoA1EOSoCmZgN6124apkoY1\nHiV4r+QNPljN4WP8gmcARnNkS7ZeR4fvWi8xPh5AxQCpiaBMw4gcbTMCuKDV68Pw\nP2dZCTMspvR3CDfM35oXCufdtFnxyU6PAyINUqF/wyTHguO3owRFPz64+sk3r2pT\nWHmJjG9E7V+KOh0s6REgD17Gqn6C5ijLchSrPUHB0wOIkeLJZndHxN/76h7+zhMt\nfFeNxPWHY2MfpcaLjz4UREzZPSB2U9k+y3pW1omCIcl6MQU9itGx/LpQE+H3ZeX2\nM2bdYd5L+ow+bdbGtsVKOuN+R9Dm17YpswF+vyQ=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAKlQ+3JX9yHXyjP/Ja6kZhkwDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBhcC1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MTkxNzQ1MjBaGA8yMTIxMDUxOTE4NDUyMFowgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBhcC1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAKtahBrpUjQ6\nH2mni05BAKU6Z5USPZeSKmBBJN3YgD17rJ93ikJxSgzJ+CupGy5rvYQ0xznJyiV0\n91QeQN4P+G2MjGQR0RGeUuZcfcZitJro7iAg3UBvw8WIGkcDUg+MGVpRv/B7ry88\n7E4OxKb8CPNoa+a9j6ABjOaaxaI22Bb7j3OJ+JyMICs6CU2bgkJaj3VUV9FCNUOc\nh9PxD4jzT9yyGYm/sK9BAT1WOTPG8XQUkpcFqy/IerZDfiQkf1koiSd4s5VhBkUn\naQHOdri/stldT7a+HJFVyz2AXDGPDj+UBMOuLq0K6GAT6ThpkXCb2RIf4mdTy7ox\nN5BaJ+ih+Ro3ZwPkok60egnt/RN98jgbm+WstgjJWuLqSNInnMUgkuqjyBWwePqX\nKib+wdpyx/LOzhKPEFpeMIvHQ3A0sjlulIjnh+j+itezD+dp0UNxMERlW4Bn/IlS\nsYQVNfYutWkRPRLErXOZXtlxxkI98JWQtLjvGzQr+jywxTiw644FSLWdhKa6DtfU\n2JWBHqQPJicMElfZpmfaHZjtXuCZNdZQXWg7onZYohe281ZrdFPOqC4rUq7gYamL\nT+ZB+2P+YCPOLJ60bj/XSvcB7mesAdg8P0DNddPhHUFWx2dFqOs1HxIVB4FZVA9U\nPpbv4a484yxjTgG7zFZNqXHKTqze6rBBAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFCEAqjighncv/UnWzBjqu1Ka2Yb4MA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEAYyvumblckIXlohzi3QiShkZhqFzZultbFIu9\nGhA5CDar1IFMhJ9vJpO9nUK/camKs1VQRs8ZsBbXa0GFUM2p8y2cgUfLwFULAiC/\nsWETyW5lcX/xc4Pyf6dONhqFJt/ovVBxNZtcmMEWv/1D6Tf0nLeEb0P2i/pnSRR4\nOq99LVFjossXtyvtaq06OSiUUZ1zLPvV6AQINg8dWeBOWRcQYhYcEcC2wQ06KShZ\n0ahuu7ar5Gym3vuLK6nH+eQrkUievVomN/LpASrYhK32joQ5ypIJej3sICIgJUEP\nUoeswJ+Z16f3ECoL1OSnq4A0riiLj1ZGmVHNhM6m/gotKaHNMxsK9zsbqmuU6IT/\nP6cR0S+vdigQG8ZNFf5vEyVNXhl8KcaJn6lMD/gMB2rY0qpaeTg4gPfU5wcg8S4Y\nC9V//tw3hv0f2n+8kGNmqZrylOQDQWSSo8j8M2SRSXiwOHDoTASd1fyBEIqBAwzn\nLvXVg8wQd1WlmM3b0Vrsbzltyh6y4SuKSkmgufYYvC07NknQO5vqvZcNoYbLNea3\n76NkFaMHUekSbwVejZgG5HGwbaYBgNdJEdpbWlA3X4yGRVxknQSUyt4dZRnw/HrX\nk8x6/wvtw7wht0/DOqz1li7baSsMazqxx+jDdSr1h9xML416Q4loFCLgqQhil8Jq\nEm4Hy3A=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGBTCCA+2gAwIBAgIRAJfKe4Zh4aWNt3bv6ZjQwogwDQYJKoZIhvcNAQEMBQAw\ngZoxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEzMDEGA1UEAwwq\nQW1hem9uIFJEUyBjYS1jZW50cmFsLTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYD\nVQQHDAdTZWF0dGxlMCAXDTIxMDUyMTIyMDg1M1oYDzIxMjEwNTIxMjMwODUzWjCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGNhLWNlbnRyYWwtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNV\nBAcMB1NlYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCpgUH6\nCrzd8cOw9prAh2rkQqAOx2vtuI7xX4tmBG4I/um28eBjyVmgwQ1fpq0Zg2nCKS54\nNn0pCmT7f3h6Bvopxn0J45AzXEtajFqXf92NQ3iPth95GVfAJSD7gk2LWMhpmID9\nJGQyoGuDPg+hYyr292X6d0madzEktVVGO4mKTF989qEg+tY8+oN0U2fRTrqa2tZp\niYsmg350ynNopvntsJAfpCO/srwpsqHHLNFZ9jvhTU8uW90wgaKO9i31j/mHggCE\n+CAOaJCM3g+L8DPl/2QKsb6UkBgaaIwKyRgKSj1IlgrK+OdCBCOgM9jjId4Tqo2j\nZIrrPBGl6fbn1+etZX+2/tf6tegz+yV0HHQRAcKCpaH8AXF44bny9andslBoNjGx\nH6R/3ib4FhPrnBMElzZ5i4+eM/cuPC2huZMBXb/jKgRC/QN1Wm3/nah5FWq+yn+N\ntiAF10Ga0BYzVhHDEwZzN7gn38bcY5yi/CjDUNpY0OzEe2+dpaBKPlXTaFfn9Nba\nCBmXPRF0lLGGtPeTAgjcju+NEcVa82Ht1pqxyu2sDtbu3J5bxp4RKtj+ShwN8nut\nTkf5Ea9rSmHEY13fzgibZlQhXaiFSKA2ASUwgJP19Putm0XKlBCNSGCoECemewxL\n+7Y8FszS4Uu4eaIwvXVqUEE2yf+4ex0hqQ1acQIDAQABo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBSeUnXIRxNbYsZLtKomIz4Y1nOZEzAOBgNVHQ8BAf8E\nBAMCAYYwDQYJKoZIhvcNAQEMBQADggIBAIpRvxVS0dzoosBh/qw65ghPUGSbP2D4\ndm6oYCv5g/zJr4fR7NzEbHOXX5aOQnHbQL4M/7veuOCLNPOW1uXwywMg6gY+dbKe\nYtPVA1as8G9sUyadeXyGh2uXGsziMFXyaESwiAXZyiYyKChS3+g26/7jwECFo5vC\nXGhWpIO7Hp35Yglp8AnwnEAo/PnuXgyt2nvyTSrxlEYa0jus6GZEZd77pa82U1JH\nqFhIgmKPWWdvELA3+ra1nKnvpWM/xX0pnMznMej5B3RT3Y+k61+kWghJE81Ix78T\n+tG4jSotgbaL53BhtQWBD1yzbbilqsGE1/DXPXzHVf9yD73fwh2tGWSaVInKYinr\na4tcrB3KDN/PFq0/w5/21lpZjVFyu/eiPj6DmWDuHW73XnRwZpHo/2OFkei5R7cT\nrn/YdDD6c1dYtSw5YNnS6hdCQ3sOiB/xbPRN9VWJa6se79uZ9NLz6RMOr73DNnb2\nbhIR9Gf7XAA5lYKqQk+A+stoKbIT0F65RnkxrXi/6vSiXfCh/bV6B41cf7MY/6YW\nehserSdjhQamv35rTFdM+foJwUKz1QN9n9KZhPxeRmwqPitAV79PloksOnX25ElN\nSlyxdndIoA1wia1HRd26EFm2pqfZ2vtD2EjU3wD42CXX4H8fKVDna30nNFSYF0yn\njGKc3k6UNxpg\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/jCCA+agAwIBAgIQaRHaEqqacXN20e8zZJtmDDANBgkqhkiG9w0BAQwFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIHVzLWVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTI1MjIzODM1WhgPMjEyMTA1MjUyMzM4MzVaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgdXMtZWFzdC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAInfBCaHuvj6Rb5c\nL5Wmn1jv2PHtEGMHm+7Z8dYosdwouG8VG2A+BCYCZfij9lIGszrTXkY4O7vnXgru\nJUNdxh0Q3M83p4X+bg+gODUs3jf+Z3Oeq7nTOk/2UYvQLcxP4FEXILxDInbQFcIx\nyen1ESHggGrjEodgn6nbKQNRfIhjhW+TKYaewfsVWH7EF2pfj+cjbJ6njjgZ0/M9\nVZifJFBgat6XUTOf3jwHwkCBh7T6rDpgy19A61laImJCQhdTnHKvzTpxcxiLRh69\nZObypR7W04OAUmFS88V7IotlPmCL8xf7kwxG+gQfvx31+A9IDMsiTqJ1Cc4fYEKg\nbL+Vo+2Ii4W2esCTGVYmHm73drznfeKwL+kmIC/Bq+DrZ+veTqKFYwSkpHRyJCEe\nU4Zym6POqQ/4LBSKwDUhWLJIlq99bjKX+hNTJykB+Lbcx0ScOP4IAZQoxmDxGWxN\nS+lQj+Cx2pwU3S/7+OxlRndZAX/FKgk7xSMkg88HykUZaZ/ozIiqJqSnGpgXCtED\noQ4OJw5ozAr+/wudOawaMwUWQl5asD8fuy/hl5S1nv9XxIc842QJOtJFxhyeMIXt\nLVECVw/dPekhMjS3Zo3wwRgYbnKG7YXXT5WMxJEnHu8+cYpMiRClzq2BEP6/MtI2\nAZQQUFu2yFjRGL2OZA6IYjxnXYiRAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8w\nHQYDVR0OBBYEFADCcQCPX2HmkqQcmuHfiQ2jjqnrMA4GA1UdDwEB/wQEAwIBhjAN\nBgkqhkiG9w0BAQwFAAOCAgEASXkGQ2eUmudIKPeOIF7RBryCoPmMOsqP0+1qxF8l\npGkwmrgNDGpmd9s0ArfIVBTc1jmpgB3oiRW9c6n2OmwBKL4UPuQ8O3KwSP0iD2sZ\nKMXoMEyphCEzW1I2GRvYDugL3Z9MWrnHkoaoH2l8YyTYvszTvdgxBPpM2x4pSkp+\n76d4/eRpJ5mVuQ93nC+YG0wXCxSq63hX4kyZgPxgCdAA+qgFfKIGyNqUIqWgeyTP\nn5OgKaboYk2141Rf2hGMD3/hsGm0rrJh7g3C0ZirPws3eeJfulvAOIy2IZzqHUSY\njkFzraz6LEH3IlArT3jUPvWKqvh2lJWnnp56aqxBR7qHH5voD49UpJWY1K0BjGnS\nOHcurpp0Yt/BIs4VZeWdCZwI7JaSeDcPMaMDBvND3Ia5Fga0thgYQTG6dE+N5fgF\nz+hRaujXO2nb0LmddVyvE8prYlWRMuYFv+Co8hcMdJ0lEZlfVNu0jbm9/GmwAZ+l\n9umeYO9yz/uC7edC8XJBglMAKUmVK9wNtOckUWAcCfnPWYLbYa/PqtXBYcxrso5j\niaS/A7iEW51uteHBGrViCy1afGG+hiUWwFlesli+Rq4dNstX3h6h2baWABaAxEVJ\ny1RnTQSz6mROT1VmZSgSVO37rgIyY0Hf0872ogcTS+FfvXgBxCxsNWEbiQ/XXva4\n0Ws=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtDCCAjqgAwIBAgIRAMyaTlVLN0ndGp4ffwKAfoMwCgYIKoZIzj0EAwMwgZkx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEyMDAGA1UEAwwpQW1h\nem9uIFJEUyBtZS1jZW50cmFsLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjIwNTA3MDA0NDM3WhgPMjEyMjA1MDcwMTQ0MzdaMIGZMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMjAwBgNVBAMMKUFtYXpv\nbiBSRFMgbWUtY2VudHJhbC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE19nCV1nsI6CohSor13+B25cr\nzg+IHdi9Y3L7ziQnHWI6yjBazvnKD+oC71aRRlR8b5YXsYGUQxWzPLHN7EGPcSGv\nbzA9SLG1KQYCJaQ0m9Eg/iGrwKWOgylbhVw0bCxoo0IwQDAPBgNVHRMBAf8EBTAD\nAQH/MB0GA1UdDgQWBBS4KsknsJXM9+QPEkBdZxUPaLr11zAOBgNVHQ8BAf8EBAMC\nAYYwCgYIKoZIzj0EAwMDaAAwZQIxAJaRgrYIEfXQMZQQDxMTYS0azpyWSseQooXo\nL3nYq4OHGBgYyQ9gVjvRYWU85PXbfgIwdi82DtANQFkCu+j+BU0JBY/uRKPEeYzo\nJG92igKIcXPqCoxIJ7lJbbzmuf73gQu5\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAJwCobx0Os8F7ihbJngxrR8wDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBtZS1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MjAxNzE1MzNaGA8yMTIxMDUyMDE4MTUzM1owgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBtZS1zb3V0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANukKwlm+ZaI\nY5MkWGbEVLApEyLmlrHLEg8PfiiEa9ts7jssQcin3bzEPdTqGr5jo91ONoZ3ccWq\nxJgg1W3bLu5CAO2CqIOXTXHRyCO/u0Ch1FGgWB8xETPSi3UHt/Vn1ltdO6DYdbDU\nmYgwzYrvLBdRCwxsb9o+BuYQHVFzUYonqk/y9ujz3gotzFq7r55UwDTA1ita3vb4\neDKjIb4b1M4Wr81M23WHonpje+9qkkrAkdQcHrkgvSCV046xsq/6NctzwCUUNsgF\n7Q1a8ut5qJEYpz5ta8vI1rqFqAMBqCbFjRYlmAoTTpFPOmzAVxV+YoqTrW5A16su\n/2SXlMYfJ/n/ad/QfBNPPAAQMpyOr2RCL/YiL/PFZPs7NxYjnZHNWxMLSPgFyI+/\nt2klnn5jR76KJK2qimmaXedB90EtFsMRUU1e4NxH9gDuyrihKPJ3aVnZ35mSipvR\n/1KB8t8gtFXp/VQaz2sg8+uxPMKB81O37fL4zz6Mg5K8+aq3ejBiyHucpFGnsnVB\n3kQWeD36ONkybngmgWoyPceuSWm1hQ0Z7VRAQX+KlxxSaHmSaIk1XxZu9h9riQHx\nfMuev6KXjRn/CjCoUTn+7eFrt0dT5GryQEIZP+nA0oq0LKxogigHNZlwAT4flrqb\nJUfZJrqgoce5HjZSXl10APbtPjJi0fW9AgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFEfV+LztI29OVDRm0tqClP3NrmEWMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEAvSNe+0wuk53KhWlRlRf2x/97H2Q76X3anzF0\n5fOSVm022ldALzXMzqOfdnoKIhAu2oVKiHHKs7mMas+T6TL+Mkphx0CYEVxFE3PG\n061q3CqJU+wMm9W9xsB79oB2XG47r1fIEywZZ3GaRsatAbjcNOT8uBaATPQAfJFN\nzjFe4XyN+rA4cFrYNvfHTeu5ftrYmvks7JlRaJgEGWsz+qXux7uvaEEVPqEumd2H\nuYeaRNOZ2V23R009X5lbgBFx9tq5VDTnKhQiTQ2SeT0rc1W3Dz5ik6SbQQNP3nSR\n0Ywy7r/sZ3fcDyfFiqnrVY4Ympfvb4YW2PZ6OsQJbzH6xjdnTG2HtzEU30ngxdp1\nWUEF4zt6rjJCp7QBUqXgdlHvJqYu6949qtWjEPiFN9uSsRV2i1YDjJqN52dLjAPn\nAipJKo8x1PHTwUzuITqnB9BdP+5TlTl8biJfkEf/+08eWDTLlDHr2VrZLOLompTh\nbS5OrhDmqA2Q+O+EWrTIhMflwwlCpR9QYM/Xwvlbad9H0FUHbJsCVNaru3wGOgWo\ntt3dNSK9Lqnv/Ej9K9v6CRr36in4ylJKivhJ5B9E7ABHg7EpBJ1xi7O5eNDkNoJG\n+pFyphJq3AkBR2U4ni2tUaTAtSW2tks7IaiDV+UMtqZyGabT5ISQfWLLtLHSWn2F\nTspdjbg=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIRAJZFh4s9aZGzKaTMLrSb4acwDQYJKoZIhvcNAQELBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBCZXRhIHVzLWVhc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTE4MjEyODQxWhgPMjA2MTA1MTgyMjI4NDFa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgQmV0YSB1cy1lYXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n17i2yoU6diep+WrqxIn2CrDEO2NdJVwWTSckx4WMZlLpkQDoymSmkNHjq9ADIApD\nA31Cx+843apL7wub8QkFZD0Tk7/ThdHWJOzcAM3ov98QBPQfOC1W5zYIIRP2F+vQ\nTRETHQnLcW3rLv0NMk5oQvIKpJoC9ett6aeVrzu+4cU4DZVWYlJUoC/ljWzCluau\n8blfW0Vwin6OB7s0HCG5/wijQWJBU5SrP/KAIPeQi1GqG5efbqAXDr/ple0Ipwyo\nXjjl73LenGUgqpANlC9EAT4i7FkJcllLPeK3NcOHjuUG0AccLv1lGsHAxZLgjk/x\nz9ZcnVV9UFWZiyJTKxeKPwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1Ud\nDgQWBBRWyMuZUo4gxCR3Luf9/bd2AqZ7CjAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZI\nhvcNAQELBQADggEBAIqN2DlIKlvDFPO0QUZQVFbsi/tLdYM98/vvzBpttlTGVMyD\ngJuQeHVz+MnhGIwoCGOlGU3OOUoIlLAut0+WG74qYczn43oA2gbMd7HoD7oL/IGg\nnjorBwJVcuuLv2G//SqM3nxGcLRtkRnQ+lvqPxMz9+0fKFUn6QcIDuF0QSfthLs2\nWSiGEPKO9c9RSXdRQ4pXA7c3hXng8P4A2ZmdciPne5Nu4I4qLDGZYRrRLRkNTrOi\nTyS6r2HNGUfgF7eOSeKt3NWL+mNChcYj71/Vycf5edeczpUgfnWy9WbPrK1svKyl\naAs2xg+X6O8qB+Mnj2dNBzm+lZIS3sIlm+nO9sg=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAPAlEk8VJPmEzVRRaWvTh2AwCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyB1cy1lYXN0LTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTI1MjI0MTU1WhgPMjEyMTA1MjUyMzQxNTVaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgdXMtZWFzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEx5xjrup8II4HOJw15NTnS3H5yMrQGlbj\nEDA5MMGnE9DmHp5dACIxmPXPMe/99nO7wNdl7G71OYPCgEvWm0FhdvVUeTb3LVnV\nBnaXt32Ek7/oxGk1T+Df03C+W0vmuJ+wo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBTGXmqBWN/1tkSea4pNw0oHrjk2UDAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIxAIqqZWCSrIkZ7zsv/FygtAusW6yvlL935YAWYPVXU30m\njkMFLM+/RJ9GMvnO8jHfCgIwB+whlkcItzE9CRQ6CsMo/d5cEHDUu/QW6jSIh9BR\nOGh9pTYPVkUbBiKPA7lVVhre\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/zCCA+egAwIBAgIRAJGY9kZITwfSRaAS/bSBOw8wDQYJKoZIhvcNAQEMBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBzYS1lYXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE4MTEyMFoYDzIxMjEwNTE5MTkxMTIwWjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIHNhLWVhc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDe2vlDp6Eo4WQi\nWi32YJOgdXHhxTFrLjB9SRy22DYoMaWfginJIwJcSR8yse8ZDQuoNhERB9LRggAE\neng23mhrfvtL1yQkMlZfBu4vG1nOb22XiPFzk7X2wqz/WigdYNBCqa1kK3jrLqPx\nYUy7jk2oZle4GLVRTNGuMfcid6S2hs3UCdXfkJuM2z2wc3WUlvHoVNk37v2/jzR/\nhSCHZv5YHAtzL/kLb/e64QkqxKll5QmKhyI6d7vt6Lr1C0zb+DmwxUoJhseAS0hI\ndRk5DklMb4Aqpj6KN0ss0HAYqYERGRIQM7KKA4+hxDMUkJmt8KqWKZkAlCZgflzl\nm8NZ31o2cvBzf6g+VFHx+6iVrSkohVQydkCxx7NJ743iPKsh8BytSM4qU7xx4OnD\nH2yNXcypu+D5bZnVZr4Pywq0w0WqbTM2bpYthG9IC4JeVUvZ2mDc01lqOlbMeyfT\nog5BRPLDXdZK8lapo7se2teh64cIfXtCmM2lDSwm1wnH2iSK+AWZVIM3iE45WSGc\nvZ+drHfVgjJJ5u1YrMCWNL5C2utFbyF9Obw9ZAwm61MSbPQL9JwznhNlCh7F2ANW\nZHWQPNcOAJqzE4uVcJB1ZeVl28ORYY1668lx+s9yYeMXk3QQdj4xmdnvoBFggqRB\nZR6Z0D7ZohADXe024RzEo1TukrQgKQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBT7Vs4Y5uG/9aXnYGNMEs6ycPUT3jAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQEMBQADggIBACN4Htp2PvGcQA0/sAS+qUVWWJoAXSsu8Pgc6Gar\n7tKVlNJ/4W/a6pUV2Xo/Tz3msg4yiE8sMESp2k+USosD5n9Alai5s5qpWDQjrqrh\n76AGyF2nzve4kIN19GArYhm4Mz/EKEG1QHYvBDGgXi3kNvL/a2Zbybp+3LevG+q7\nxtx4Sz9yIyMzuT/6Y7ijtiMZ9XbuxGf5wab8UtwT3Xq1UradJy0KCkzRJAz/Wy/X\nHbTkEvKSaYKExH6sLo0jqdIjV/d2Io31gt4e0Ly1ER2wPyFa+pc/swu7HCzrN+iz\nA2ZM4+KX9nBvFyfkHLix4rALg+WTYJa/dIsObXkdZ3z8qPf5A9PXlULiaa1mcP4+\nrokw74IyLEYooQ8iSOjxumXhnkTS69MAdGzXYE5gnHokABtGD+BB5qLhtLt4fqAp\n8AyHpQWMyV42M9SJLzQ+iOz7kAgJOBOaVtJI3FV/iAg/eqWVm3yLuUTWDxSHrKuL\nN19+pSjF6TNvUSFXwEa2LJkfDqIOCE32iOuy85QY//3NsgrSQF6UkSPa95eJrSGI\n3hTRYYh3Up2GhBGl1KUy7/o0k3KRZTk4s38fylY8bZ3TakUOH5iIGoHyFVVcp361\nPyy25SzFSmNalWoQd9wZVc/Cps2ldxhcttM+WLkFNzprd0VJa8qTz8vYtHP0ouDN\nnWS0\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCTCCA/GgAwIBAgIRAOY7gfcBZgR2tqfBzMbFQCUwDQYJKoZIhvcNAQEMBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtNCBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjIwNTI1MTY1NDU5WhgPMjEyMjA1MjUxNzU0NTla\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtc291dGhlYXN0LTQgUm9vdCBDQSBSU0E0MDk2IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA\nlfxER43FuLRdL08bddF0YhbCP+XXKj1A/TFMXmd2My8XDei8rPXFYyyjMig9+xZw\nuAsIxLwz8uiA26CKA8bCZKg5VG2kTeOJAfvBJaLv1CZefs3Z4Uf1Sjvm6MF2yqEj\nGoORfyfL9HiZFTDuF/hcjWoKYCfMuG6M/wO8IbdICrX3n+BiYQJu/pFO660Mg3h/\n8YBBWYDbHoCiH/vkqqJugQ5BM3OI5nsElW51P1icEEqti4AZ7JmtSv9t7fIFBVyR\noaEyOgpp0sm193F/cDJQdssvjoOnaubsSYm1ep3awZAUyGN/X8MBrPY95d0hLhfH\nEhc5Icyg+hsosBljlAyksmt4hFQ9iBnWIz/ZTfGMck+6p3HVL9RDgvluez+rWv59\n8q7omUGsiPApy5PDdwI/Wt/KtC34/2sjslIJfvgifdAtkRPkhff1WEwER00ADrN9\neGGInaCpJfb1Rq8cV2n00jxg7DcEd65VR3dmIRb0bL+jWK62ni/WdEyomAOMfmGj\naWf78S/4rasHllWJ+QwnaUYY3u6N8Cgio0/ep4i34FxMXqMV3V0/qXdfhyabi/LM\nwCxNo1Dwt+s6OtPJbwO92JL+829QAxydfmaMTeHBsgMPkG7RwAekeuatKGHNsc2Z\nx2Q4C2wVvOGAhcHwxfM8JfZs3nDSZJndtVVnFlUY0UECAwEAAaNCMEAwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUpnG7mWazy6k97/tb5iduRB3RXgQwDgYDVR0P\nAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQCDLqq1Wwa9Tkuv7vxBnIeVvvFF\necTn+P+wJxl9Qa2ortzqTHZsBDyJO62d04AgBwiDXkJ9a+bthgG0H1J7Xee8xqv1\nxyX2yKj24ygHjspLotKP4eDMdDi5TYq+gdkbPmm9Q69B1+W6e049JVGXvWG8/7kU\nigxeuCYwtCCdUPRLf6D8y+1XMGgVv3/DSOHWvTg3MJ1wJ3n3+eve3rjGdRYWZeJu\nk21HLSZYzVrCtUsh2YAeLnUbSxVuT2Xr4JehYe9zW5HEQ8Je/OUfnCy9vzoN/ITw\nosAH+EBJQey7RxEDqMwCaRefH0yeHFcnOll0OXg/urnQmwbEYzQ1uutJaBPsjU0J\nQf06sMxI7GiB5nPE+CnI2sM6A9AW9kvwexGXpNJiLxF8dvPQthpOKGcYu6BFvRmt\n6ctfXd9b7JJoVqMWuf5cCY6ihpk1e9JTlAqu4Eb/7JNyGiGCR40iSLvV28un9wiE\nplrdYxwcNYq851BEu3r3AyYWw/UW1AKJ5tM+/Gtok+AphMC9ywT66o/Kfu44mOWm\nL3nSLSWEcgfUVgrikpnyGbUnGtgCmHiMlUtNVexcE7OtCIZoVAlCGKNu7tyuJf10\nQlk8oIIzfSIlcbHpOYoN79FkLoDNc2er4Gd+7w1oPQmdAB0jBJnA6t0OUBPKdDdE\nUfff2jrbfbzECn1ELg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCDCCA/CgAwIBAgIQIuO1A8LOnmc7zZ/vMm3TrDANBgkqhkiG9w0BAQwFADCB\nnDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTUwMwYDVQQDDCxB\nbWF6b24gUkRTIGFwLXNvdXRoZWFzdC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4G\nA1UEBwwHU2VhdHRsZTAgFw0yMTA1MjQyMDQ2MThaGA8yMTIxMDUyNDIxNDYxOFow\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMiBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDq\nqRHKbG8ZK6/GkGm2cenznEF06yHwI1gD5sdsHjTgekDZ2Dl9RwtDmUH2zFuIQwGj\nSeC7E2iKwrJRA5wYzL9/Vk8NOILEKQOP8OIKUHbc7q8rEtjs401KcU6pFBBEdO9G\nCTiRhogq+8mhC13AM/UriZJbKhwgM2UaDOzAneGMhQAGjH8z83NsNcPxpYVE7tqM\nsch5yLtIJLkJRusrmQQTeHUev16YNqyUa+LuFclFL0FzFCimkcxUhXlbfEKXbssS\nyPzjiv8wokGyo7+gA0SueceMO2UjfGfute3HlXZDcNvBbkSY+ver41jPydyRD6Qq\noEkh0tyIbPoa3oU74kwipJtz6KBEA3u3iq61OUR0ENhR2NeP7CSKrC24SnQJZ/92\nqxusrbyV/0w+U4m62ug/o4hWNK1lUcc2AqiBOvCSJ7qpdteTFxcEIzDwYfERDx6a\nd9+3IPvzMb0ZCxBIIUFMxLTF7yAxI9s6KZBBXSZ6tDcCCYIgEysEPRWMRAcG+ye/\nfZVn9Vnzsj4/2wchC2eQrYpb1QvG4eMXA4M5tFHKi+/8cOPiUzJRgwS222J8YuDj\nyEBval874OzXk8H8Mj0JXJ/jH66WuxcBbh5K7Rp5oJn7yju9yqX6qubY8gVeMZ1i\nu4oXCopefDqa35JplQNUXbWwSebi0qJ4EK0V8F9Q+QIDAQABo0IwQDAPBgNVHRMB\nAf8EBTADAQH/MB0GA1UdDgQWBBT4ysqCxaPe7y+g1KUIAenqu8PAgzAOBgNVHQ8B\nAf8EBAMCAYYwDQYJKoZIhvcNAQEMBQADggIBALU8WN35KAjPZEX65tobtCDQFkIO\nuJjv0alD7qLB0i9eY80C+kD87HKqdMDJv50a5fZdqOta8BrHutgFtDm+xo5F/1M3\nu5/Vva5lV4xy5DqPajcF4Mw52czYBmeiLRTnyPJsU93EQIC2Bp4Egvb6LI4cMOgm\n4pY2hL8DojOC5PXt4B1/7c1DNcJX3CMzHDm4SMwiv2MAxSuC/cbHXcWMk+qXdrVx\n+ayLUSh8acaAOy3KLs1MVExJ6j9iFIGsDVsO4vr4ZNsYQiyHjp+L8ops6YVBO5AT\nk/pI+axHIVsO5qiD4cFWvkGqmZ0gsVtgGUchZaacboyFsVmo6QPrl28l6LwxkIEv\nGGJYvIBW8sfqtGRspjfX5TlNy5IgW/VOwGBdHHsvg/xpRo31PR3HOFw7uPBi7cAr\nFiZRLJut7af98EB2UvovZnOh7uIEGPeecQWeOTQfJeWet2FqTzFYd0NUMgqPuJx1\nvLKferP+ajAZLJvVnW1J7Vccx/pm0rMiUJEf0LRb/6XFxx7T2RGjJTi0EzXODTYI\ngnLfBBjnolQqw+emf4pJ4pAtly0Gq1KoxTG2QN+wTd4lsCMjnelklFDjejwnl7Uy\nvtxzRBAu/hi/AqDkDFf94m6j+edIrjbi9/JDFtQ9EDlyeqPgw0qwi2fwtJyMD45V\nfejbXelUSJSzDIdY\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCTCCA/GgAwIBAgIRAN7Y9G9i4I+ZaslPobE7VL4wDQYJKoZIhvcNAQEMBQAw\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1ub3J0aGVhc3QtMiBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwIBcNMjEwNTIwMTYzMzIzWhgPMjEyMTA1MjAxNzMzMjNa\nMIGcMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywg\nSW5jLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExNTAzBgNVBAMM\nLEFtYXpvbiBSRFMgYXAtbm9ydGhlYXN0LTIgUm9vdCBDQSBSU0E0MDk2IEcxMRAw\nDgYDVQQHDAdTZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA\n4BEPCiIfiK66Q/qa8k+eqf1Q3qsa6Xuu/fPkpuStXVBShhtXd3eqrM0iT4Xxs420\nVa0vSB3oZ7l86P9zYfa60n6PzRxdYFckYX330aI7L/oFIdaodB/C9szvROI0oLG+\n6RwmIF2zcprH0cTby8MiM7G3v9ykpq27g4WhDC1if2j8giOQL3oHpUaByekZNIHF\ndIllsI3RkXmR3xmmxoOxJM1B9MZi7e1CvuVtTGOnSGpNCQiqofehTGwxCN2wFSK8\nxysaWlw48G0VzZs7cbxoXMH9QbMpb4tpk0d+T8JfAPu6uWO9UwCLWWydf0CkmA/+\nD50/xd1t33X9P4FEaPSg5lYbHXzSLWn7oLbrN2UqMLaQrkoEBg/VGvzmfN0mbflw\n+T87bJ/VEOVNlG+gepyCTf89qIQVWOjuYMox4sK0PjzZGsYEuYiq1+OUT3vk/e5K\nag1fCcq2Isy4/iwB2xcXrsQ6ljwdk1fc+EmOnjGKrhuOHJY3S+RFv4ToQBsVyYhC\nXGaC3EkqIX0xaCpDimxYhFjWhpDXAjG/zJ+hRLDAMCMhl/LPGRk/D1kzSbPmdjpl\nlEMK5695PeBvEBTQdBQdOiYgOU3vWU6tzwwHfiM2/wgvess/q0FDAHfJhppbgbb9\n3vgsIUcsvoC5o29JvMsUxsDRvsAfEmMSDGkJoA/X6GECAwEAAaNCMEAwDwYDVR0T\nAQH/BAUwAwEB/zAdBgNVHQ4EFgQUgEWm1mZCbGD6ytbwk2UU1aLaOUUwDgYDVR0P\nAQH/BAQDAgGGMA0GCSqGSIb3DQEBDAUAA4ICAQBb4+ABTGBGwxK1U/q4g8JDqTQM\n1Wh8Oz8yAk4XtPJMAmCctxbd81cRnSnePWw/hxViLVtkZ/GsemvXfqAQyOn1coN7\nQeYSw+ZOlu0j2jEJVynmgsR7nIRqE7QkCyZAU+d2FTJUfmee+IiBiGyFGgxz9n7A\nJhBZ/eahBbiuoOik/APW2JWLh0xp0W0GznfJ8lAlaQTyDa8iDXmVtbJg9P9qzkvl\nFgPXQttzEOyooF8Pb2LCZO4kUz+1sbU7tHdr2YE+SXxt6D3SBv+Yf0FlvyWLiqVk\nGDEOlPPTDSjAWgKnqST8UJ0RDcZK/v1ixs7ayqQJU0GUQm1I7LGTErWXHMnCuHKe\nUKYuiSZwmTcJ06NgdhcCnGZgPq13ryMDqxPeltQc3n5eO7f1cL9ERYLDLOzm6A9P\noQ3MfcVOsbHgGHZWaPSeNrQRN9xefqBXH0ZPasgcH9WJdsLlEjVUXoultaHOKx3b\nUCCb+d3EfqF6pRT488ippOL6bk7zNubwhRa/+y4wjZtwe3kAX78ACJVcjPobH9jZ\nErySads5zdQeaoee5wRKdp3TOfvuCe4bwLRdhOLCHWzEcXzY3g/6+ppLvNom8o+h\nBh5X26G6KSfr9tqhQ3O9IcbARjnuPbvtJnoPY0gz3EHHGPhy0RNW8i2gl3nUp0ah\nPtjwbKW0hYAhIttT0Q==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtzCCAj2gAwIBAgIQQRBQTs6Y3H1DDbpHGta3lzAKBggqhkjOPQQDAzCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC0zIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDYxMTAwMTI0M1oYDzIxMjEwNjExMDExMjQzWjCBmzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTQwMgYDVQQDDCtBbWF6\nb24gUkRTIGFwLXNvdXRoZWFzdC0zIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEs0942Xj4m/gKA+WA6F5h\nAHYuek9eGpzTRoLJddM4rEV1T3eSueytMVKOSlS3Ub9IhyQrH2D8EHsLYk9ktnGR\npATk0kCYTqFbB7onNo070lmMJmGT/Q7NgwC8cySChFxbo0IwQDAPBgNVHRMBAf8E\nBTADAQH/MB0GA1UdDgQWBBQ20iKBKiNkcbIZRu0y1uoF1yJTEzAOBgNVHQ8BAf8E\nBAMCAYYwCgYIKoZIzj0EAwMDaAAwZQIwYv0wTSrpQTaPaarfLN8Xcqrqu3hzl07n\nFrESIoRw6Cx77ZscFi2/MV6AFyjCV/TlAjEAhpwJ3tpzPXpThRML8DMJYZ3YgMh3\nCMuLqhPpla3cL0PhybrD27hJWl29C4el6aMO\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrDCCAjOgAwIBAgIQGcztRyV40pyMKbNeSN+vXTAKBggqhkjOPQQDAzCBljEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMS8wLQYDVQQDDCZBbWF6\nb24gUkRTIHVzLWVhc3QtMiBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTAgFw0yMTA1MjEyMzE1NTZaGA8yMTIxMDUyMjAwMTU1NlowgZYxCzAJBgNV\nBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYD\nVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1hem9uIFJE\nUyB1cy1lYXN0LTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1NlYXR0bGUw\ndjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQfDcv+GGRESD9wT+I5YIPRsD3L+/jsiIis\nTr7t9RSbFl+gYpO7ZbDXvNbV5UGOC5lMJo/SnqFRTC6vL06NF7qOHfig3XO8QnQz\n6T5uhhrhnX2RSY3/10d2kTyHq3ZZg3+jQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYD\nVR0OBBYEFLDyD3PRyNXpvKHPYYxjHXWOgfPnMA4GA1UdDwEB/wQEAwIBhjAKBggq\nhkjOPQQDAwNnADBkAjB20HQp6YL7CqYD82KaLGzgw305aUKw2aMrdkBR29J183jY\n6Ocj9+Wcif9xnRMS+7oCMAvrt03rbh4SU9BohpRUcQ2Pjkh7RoY0jDR4Xq4qzjNr\n5UFr3BXpFvACxXF51BksGQ==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjWgAwIBAgIQeKbS5zvtqDvRtwr5H48cAjAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIG1lLXNvdXRoLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTIwMTcxOTU1WhgPMjEyMTA1MjAxODE5NTVaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgbWUtc291dGgtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABEKjgUaAPmUlRMEQdBC7BScAGosJ1zRV\nLDd38qTBjzgmwBfQJ5ZfGIvyEK5unB09MB4e/3qqK5I/L6Qn5Px/n5g4dq0c7MQZ\nu7G9GBYm90U3WRJBf7lQrPStXaRnS4A/O6NCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUNKcAbGEIn03/vkwd8g6jNyiRdD4wDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2cAMGQCMHIeTrjenCSYuGC6txuBt/0ZwnM/ciO9kHGWVCoK8QLs\njGghb5/YSFGZbmQ6qpGlSAIwVOQgdFfTpEfe5i+Vs9frLJ4QKAfc27cTNYzRIM0I\nE+AJgK4C4+DiyyMzOpiCfmvq\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGCDCCA/CgAwIBAgIQSFkEUzu9FYgC5dW+5lnTgjANBgkqhkiG9w0BAQwFADCB\nnDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTUwMwYDVQQDDCxB\nbWF6b24gUkRTIGFwLXNvdXRoZWFzdC0zIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4G\nA1UEBwwHU2VhdHRsZTAgFw0yMTA2MTEwMDA4MzZaGA8yMTIxMDYxMTAxMDgzNlow\ngZwxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTE1MDMGA1UEAwws\nQW1hem9uIFJEUyBhcC1zb3V0aGVhc3QtMyBSb290IENBIFJTQTQwOTYgRzExEDAO\nBgNVBAcMB1NlYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDx\nmy5Qmd8zdwaI/KOKV9Xar9oNbhJP5ED0JCiigkuvCkg5qM36klszE8JhsUj40xpp\nvQw9wkYW4y+C8twBpzKGBvakqMnoaVUV7lOCKx0RofrnNwkZCboTBB4X/GCZ3fIl\nYTybS7Ehi1UuiaZspIT5A2jidoA8HiBPk+mTg1UUkoWS9h+MEAPa8L4DY6fGf4pO\nJ1Gk2cdePuNzzIrpm2yPto+I8MRROwZ3ha7ooyymOXKtz2c7jEHHJ314boCXAv9G\ncdo27WiebewZkHHH7Zx9iTIVuuk2abyVSzvLVeGv7Nuy4lmSqa5clWYqWsGXxvZ2\n0fZC5Gd+BDUMW1eSpW7QDTk3top6x/coNoWuLSfXiC5ZrJkIKimSp9iguULgpK7G\nabMMN4PR+O+vhcB8E879hcwmS2yd3IwcPTl3QXxufqeSV58/h2ibkqb/W4Bvggf6\n5JMHQPlPHOqMCVFIHP1IffIo+Of7clb30g9FD2j3F4qgV3OLwEDNg/zuO1DiAvH1\nL+OnmGHkfbtYz+AVApkAZrxMWwoYrwpauyBusvSzwRE24vLTd2i80ZDH422QBLXG\nrN7Zas8rwIiBKacJLYtBYETw8mfsNt8gb72aIQX6cZOsphqp6hUtKaiMTVgGazl7\ntBXqbB+sIv3S9X6bM4cZJKkMJOXbnyCCLZFYv8TurwIDAQABo0IwQDAPBgNVHRMB\nAf8EBTADAQH/MB0GA1UdDgQWBBTOVtaS1b/lz6yJDvNk65vEastbQTAOBgNVHQ8B\nAf8EBAMCAYYwDQYJKoZIhvcNAQEMBQADggIBABEONg+TmMZM/PrYGNAfB4S41zp1\n3CVjslZswh/pC4kgXSf8cPJiUOzMwUevuFQj7tCqxQtJEygJM2IFg4ViInIah2kh\nxlRakEGGw2dEVlxZAmmLWxlL1s1lN1565t5kgVwM0GVfwYM2xEvUaby6KDVJIkD3\naM6sFDBshvVA70qOggM6kU6mwTbivOROzfoIQDnVaT+LQjHqY/T+ok6IN0YXXCWl\nFavai8RDjzLDFwXSRvgIK+1c49vlFFY4W9Efp7Z9tPSZU1TvWUcKdAtV8P2fPHAS\nvAZ+g9JuNfeawhEibjXkwg6Z/yFUueQCQOs9TRXYogzp5CMMkfdNJF8byKYqHscs\nUosIcETnHwqwban99u35sWcoDZPr6aBIrz7LGKTJrL8Nis8qHqnqQBXu/fsQEN8u\nzJ2LBi8sievnzd0qI0kaWmg8GzZmYH1JCt1GXSqOFkI8FMy2bahP7TUQR1LBUKQ3\nhrOSqldkhN+cSAOnvbQcFzLr+iEYEk34+NhcMIFVE+51KJ1n6+zISOinr6mI3ckX\n6p2tmiCD4Shk2Xx/VTY/KGvQWKFcQApWezBSvDNlGe0yV71LtLf3dr1pr4ofo7cE\nrYucCJ40bfxEU/fmzYdBF32xP7AOD9U0FbOR3Mcthc6Z6w20WFC+zru8FGY08gPf\nWT1QcNdw7ntUJP/w\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrzCCAjWgAwIBAgIQARky6+5PNFRkFVOp3Ob1CTAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LXNvdXRoLTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjIwNTIzMTg0MTI4WhgPMjEyMjA1MjMxOTQxMjdaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgZXUtc291dGgtMiBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABNVGL5oF7cfIBxKyWd2PVK/S5yQfaJY3\nQFHWvEdt6951n9JhiiPrHzfVHsxZp1CBjILRMzjgRbYWmc8qRoLkgGE7htGdwudJ\nFa/WuKzO574Prv4iZXUnVGTboC7JdvKbh6NCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUgDeIIEKynwUbNXApdIPnmRWieZwwDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2gAMGUCMEOOJfucrST+FxuqJkMZyCM3gWGZaB+/w6+XUAJC6hFM\nuSTY0F44/bERkA4XhH+YGAIxAIpJQBakCA1/mXjsTnQ+0El9ty+LODp8ibkn031c\n8DKDS7pR9UK7ZYdR6zFg3ZCjQw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjOgAwIBAgIQJvkWUcYLbnxtuwnyjMmntDAKBggqhkjOPQQDAzCBljEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMS8wLQYDVQQDDCZBbWF6\nb24gUkRTIGV1LXdlc3QtMyBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTAgFw0yMTA1MjUyMjI2MTJaGA8yMTIxMDUyNTIzMjYxMlowgZYxCzAJBgNV\nBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMwEQYD\nVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1hem9uIFJE\nUyBldS13ZXN0LTMgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1NlYXR0bGUw\ndjAQBgcqhkjOPQIBBgUrgQQAIgNiAARENn8uHCyjn1dFax4OeXxvbV861qsXFD9G\nDshumTmFzWWHN/69WN/AOsxy9XN5S7Cgad4gQgeYYYgZ5taw+tFo/jQvCLY//uR5\nuihcLuLJ78opvRPvD9kbWZ6oXfBtFkWjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYD\nVR0OBBYEFKiK3LpoF+gDnqPldGSwChBPCYciMA4GA1UdDwEB/wQEAwIBhjAKBggq\nhkjOPQQDAwNpADBmAjEA+7qfvRlnvF1Aosyp9HzxxCbN7VKu+QXXPhLEBWa5oeWW\nUOcifunf/IVLC4/FGCsLAjEAte1AYp+iJyOHDB8UYkhBE/1sxnFaTiEPbvQBU0wZ\nSuwWVLhu2wWDuSW+K7tTuL8p\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/zCCAuegAwIBAgIRAKeDpqX5WFCGNo94M4v69sUwDQYJKoZIhvcNAQELBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBldS13ZXN0LTMgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNTIyMTgzM1oYDzIwNjEwNTI1MjMxODMzWjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LXdlc3QtMyBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCcKOTEMTfzvs4H\nWtJR8gI7GXN6xesulWtZPv21oT+fLGwJ+9Bv8ADCGDDrDxfeH/HxJmzG9hgVAzVn\n4g97Bn7q07tGZM5pVi96/aNp11velZT7spOJKfJDZTlGns6DPdHmx48whpdO+dOb\n6+eR0VwCIv+Vl1fWXgoACXYCoKjhxJs+R+fwY//0JJ1YG8yjZ+ghLCJmvlkOJmE1\nTCPUyIENaEONd6T+FHGLVYRRxC2cPO65Jc4yQjsXvvQypoGgx7FwD5voNJnFMdyY\n754JGPOOe/SZdepN7Tz7UEq8kn7NQSbhmCsgA/Hkjkchz96qN/YJ+H/okiQUTNB0\neG9ogiVFAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFFjayw9Y\nMjbxfF14XAhMM2VPl0PfMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC\nAQEAAtmx6d9+9CWlMoU0JCirtp4dSS41bBfb9Oor6GQ8WIr2LdfZLL6uES/ubJPE\n1Sh5Vu/Zon5/MbqLMVrfniv3UpQIof37jKXsjZJFE1JVD/qQfRzG8AlBkYgHNEiS\nVtD4lFxERmaCkY1tjKB4Dbd5hfhdrDy29618ZjbSP7NwAfnwb96jobCmMKgxVGiH\nUqsLSiEBZ33b2hI7PJ6iTJnYBWGuiDnsWzKRmheA4nxwbmcQSfjbrNwa93w3caL2\nv/4u54Kcasvcu3yFsUwJygt8z43jsGAemNZsS7GWESxVVlW93MJRn6M+MMakkl9L\ntWaXdHZ+KUV7LhfYLb0ajvb40w==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBDCCAuygAwIBAgIQJ5oxPEjefCsaESSwrxk68DANBgkqhkiG9w0BAQsFADCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGV1LWNlbnRyYWwtMiBSb290IENBIFJTQTIwNDggRzExEDAOBgNV\nBAcMB1NlYXR0bGUwIBcNMjIwNjA2MjExNzA1WhgPMjA2MjA2MDYyMjE3MDVaMIGa\nMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5j\nLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMzAxBgNVBAMMKkFt\nYXpvbiBSRFMgZXUtY2VudHJhbC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALTQt5eX\ng+VP3BjO9VBkWJhE0GfLrU/QIk32I6WvrnejayTrlup9H1z4QWlXF7GNJrqScRMY\nKhJHlcP05aPsx1lYco6pdFOf42ybXyWHHJdShj4A5glU81GTT+VrXGzHSarLmtua\neozkQgPpDsSlPt0RefyTyel7r3Cq+5K/4vyjCTcIqbfgaGwTU36ffjM1LaPCuE4O\nnINMeD6YuImt2hU/mFl20FZ+IZQUIFZZU7pxGLqTRz/PWcH8tDDxnkYg7tNuXOeN\nJbTpXrw7St50/E9ZQ0llGS+MxJD8jGRAa/oL4G/cwnV8P2OEPVVkgN9xDDQeieo0\n3xkzolkDkmeKOnUCAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU\nbwu8635iQGQMRanekesORM8Hkm4wDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEB\nCwUAA4IBAQAgN6LE9mUgjsj6xGCX1afYE69fnmCjjb0rC6eEe1mb/QZNcyw4XBIW\n6+zTXo4mjZ4ffoxb//R0/+vdTE7IvaLgfAZgFsLKJCtYDDstXZj8ujQnGR9Pig3R\nW+LpNacvOOSJSawNQq0Xrlcu55AU4buyD5VjcICnfF1dqBMnGTnh27m/scd/ZMx/\nkapHZ/fMoK2mAgSX/NvUKF3UkhT85vSSM2BTtET33DzCPDQTZQYxFBa4rFRmFi4c\nBLlmIReiCGyh3eJhuUUuYAbK6wLaRyPsyEcIOLMQmZe1+gAFm1+1/q5Ke9ugBmjf\nPbTWjsi/lfZ5CdVAhc5lmZj/l5aKqwaS\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAKKPTYKln9L4NTx9dpZGUjowCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyBldS13ZXN0LTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTIxMjI1NTIxWhgPMjEyMTA1MjEyMzU1MjFaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgZXUtd2VzdC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE/owTReDvaRqdmbtTzXbyRmEpKCETNj6O\nhZMKH0F8oU9Tmn8RU7kQQj6xUKEyjLPrFBN7c+26TvrVO1KmJAvbc8bVliiJZMbc\nC0yV5PtJTalvlMZA1NnciZuhxaxrzlK1o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBT4i5HaoHtrs7Mi8auLhMbKM1XevDAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIxAK9A+8/lFdX4XJKgfP+ZLy5ySXC2E0Spoy12Gv2GdUEZ\np1G7c1KbWVlyb1d6subzkQIwKyH0Naf/3usWfftkmq8SzagicKz5cGcEUaULq4tO\nGzA/AMpr63IDBAqkZbMDTCmH\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrzCCAjWgAwIBAgIQTgIvwTDuNWQo0Oe1sOPQEzAKBggqhkjOPQQDAzCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LW5vcnRoLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTI0MjEwNjM4WhgPMjEyMTA1MjQyMjA2MzhaMIGXMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpvbiBS\nRFMgZXUtbm9ydGgtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwHU2VhdHRs\nZTB2MBAGByqGSM49AgEGBSuBBAAiA2IABJuzXLU8q6WwSKXBvx8BbdIi3mPhb7Xo\nrNJBfuMW1XRj5BcKH1ZoGaDGw+BIIwyBJg8qNmCK8kqIb4cH8/Hbo3Y+xBJyoXq/\ncuk8aPrxiNoRsKWwiDHCsVxaK9L7GhHHAqNCMEAwDwYDVR0TAQH/BAUwAwEB/zAd\nBgNVHQ4EFgQUYgcsdU4fm5xtuqLNppkfTHM2QMYwDgYDVR0PAQH/BAQDAgGGMAoG\nCCqGSM49BAMDA2gAMGUCMQDz/Rm89+QJOWJecYAmYcBWCcETASyoK1kbr4vw7Hsg\n7Ew3LpLeq4IRmTyuiTMl0gMCMAa0QSjfAnxBKGhAnYxcNJSntUyyMpaXzur43ec0\n3D8npJghwC4DuICtKEkQiI5cSg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAORIGqQXLTcbbYT2upIsSnQwDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBldS1zb3V0aC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMjA1MjMxODM0MjJaGA8yMTIyMDUyMzE5MzQyMlowgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBldS1zb3V0aC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAPKukwsW2s/h\n1k+Hf65pOP0knVBnOnMQyT1mopp2XHGdXznj9xS49S30jYoUnWccyXgD983A1bzu\nw4fuJRHg4MFdz/NWTgXvy+zy0Roe83OPIJjUmXnnzwUHQcBa9vl6XUO65iQ3pbSi\nfQfNDFXD8cvuXbkezeADoy+iFAlzhXTzV9MD44GTuo9Z3qAXNGHQCrgRSCL7uRYt\nt1nfwboCbsVRnElopn2cTigyVXE62HzBUmAw1GTbAZeFAqCn5giBWYAfHwTUldRL\n6eEa6atfsS2oPNus4ZENa1iQxXq7ft+pMdNt0qKXTCZiiCZjmLkY0V9kWwHTRRF8\nr+75oSL//3di43QnuSCgjwMRIeWNtMud5jf3eQzSBci+9njb6DrrSUbx7blP0srg\n94/C/fYOp/0/EHH34w99Th14VVuGWgDgKahT9/COychLOubXUT6vD1As47S9KxTv\nyYleVKwJnF9cVjepODN72fNlEf74BwzgSIhUmhksmZSeJBabrjSUj3pdyo/iRZN/\nCiYz9YPQ29eXHPQjBZVIUqWbOVfdwsx0/Xu5T1e7yyXByQ3/oDulahtcoKPAFQ3J\nee6NJK655MdS7pM9hJnU2Rzu3qZ/GkM6YK7xTlMXVouPUZov/VbiaCKbqYDs8Dg+\nUKdeNXAT6+BMleGQzly1X7vjhgeA8ugVAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFJdaPwpCf78UolFTEn6GO85/QwUIMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEAWkxHIT3mers5YnZRSVjmpxCLivGj1jMB9VYC\niKqTAeIvD0940L0YaZgivQll5pue8UUcQ6M2uCdVVAsNJdmQ5XHIYiGOknYPtxzO\naO+bnZp7VIZw/vJ49hvH6RreA2bbxYMZO/ossYdcWsWbOKHFrRmAw0AhtK/my51g\nobV7eQg+WmlE5Iqc75ycUsoZdc3NimkjBi7LQoNP1HMvlLHlF71UZhQDdq+/WdV7\n0zmg+epkki1LjgMmuPyb+xWuYkFKT1/faX+Xs62hIm5BY+aI4if4RuQ+J//0pOSs\nUajrjTo+jLGB8A96jAe8HaFQenbwMjlaHRDAF0wvbkYrMr5a6EbneAB37V05QD0Y\nRh4L4RrSs9DX2hbSmS6iLDuPEjanHKzglF5ePEvnItbRvGGkynqDVlwF+Bqfnw8l\n0i8Hr1f1/LP1c075UjkvsHlUnGgPbLqA0rDdcxF8Fdlv1BunUjX0pVlz10Ha5M6P\nAdyWUOneOfaA5G7jjv7i9qg3r99JNs1/Lmyg/tV++gnWTAsSPFSSEte81kmPhlK3\n2UtAO47nOdTtk+q4VIRAwY1MaOR7wTFZPfer1mWs4RhKNu/odp8urEY87iIzbMWT\nQYO/4I6BGj9rEWNGncvR5XTowwIthMCj2KWKM3Z/JxvjVFylSf+s+FFfO1bNIm6h\nu3UBpZI=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtDCCAjmgAwIBAgIQenQbcP/Zbj9JxvZ+jXbRnTAKBggqhkjOPQQDAzCBmTEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTIwMAYDVQQDDClBbWF6\nb24gUkRTIGV1LWNlbnRyYWwtMSBSb290IENBIEVDQzM4NCBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTAgFw0yMTA1MjEyMjMzMjRaGA8yMTIxMDUyMTIzMzMyNFowgZkxCzAJ\nBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMuMRMw\nEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEyMDAGA1UEAwwpQW1hem9u\nIFJEUyBldS1jZW50cmFsLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAATlBHiEM9LoEb1Hdnd5j2VpCDOU\n5nGuFoBD8ROUCkFLFh5mHrHfPXwBc63heW9WrP3qnDEm+UZEUvW7ROvtWCTPZdLz\nZ4XaqgAlSqeE2VfUyZOZzBSgUUJk7OlznXfkCMOjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFDT/ThjQZl42Nv/4Z/7JYaPNMly2MA4GA1UdDwEB/wQEAwIB\nhjAKBggqhkjOPQQDAwNpADBmAjEAnZWmSgpEbmq+oiCa13l5aGmxSlfp9h12Orvw\nDq/W5cENJz891QD0ufOsic5oGq1JAjEAp5kSJj0MxJBTHQze1Aa9gG4sjHBxXn98\n4MP1VGsQuhfndNHQb4V0Au7OWnOeiobq\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/zCCAuegAwIBAgIRAMgnyikWz46xY6yRgiYwZ3swDQYJKoZIhvcNAQELBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBldS13ZXN0LTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMDE2NDkxMloYDzIwNjEwNTIwMTc0OTEyWjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LXdlc3QtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCi8JYOc9cYSgZH\ngYPxLk6Xcc7HqzamvsnjYU98Dcb98y6iDqS46Ra2Ne02MITtU5MDL+qjxb8WGDZV\nRUA9ZS69tkTO3gldW8QdiSh3J6hVNJQW81F0M7ZWgV0gB3n76WCmfT4IWos0AXHM\n5v7M/M4tqVmCPViQnZb2kdVlM3/Xc9GInfSMCgNfwHPTXl+PXX+xCdNBePaP/A5C\n5S0oK3HiXaKGQAy3K7VnaQaYdiv32XUatlM4K2WS4AMKt+2cw3hTCjlmqKRHvYFQ\nveWCXAuc+U5PQDJ9SuxB1buFJZhT4VP3JagOuZbh5NWpIbOTxlAJOb5pGEDuJTKi\n1gQQQVEFAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFNXm+N87\nOFxK9Af/bjSxDCiulGUzMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsFAAOC\nAQEAkqIbkgZ45spvrgRQ6n9VKzDLvNg+WciLtmVrqyohwwJbj4pYvWwnKQCkVc7c\nhUOSBmlSBa5REAPbH5o8bdt00FPRrD6BdXLXhaECKgjsHe1WW08nsequRKD8xVmc\n8bEX6sw/utBeBV3mB+3Zv7ejYAbDFM4vnRsWtO+XqgReOgrl+cwdA6SNQT9oW3e5\nrSQ+VaXgJtl9NhkiIysq9BeYigxqS/A13pHQp0COMwS8nz+kBPHhJTsajHCDc8F4\nHfLi6cgs9G0gaRhT8FCH66OdGSqn196sE7Y3bPFFFs/3U+vxvmQgoZC6jegQXAg5\nPrxd+VNXtNI/azitTysQPumH7A==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEBTCCAu2gAwIBAgIRAO8bekN7rUReuNPG8pSTKtEwDQYJKoZIhvcNAQELBQAw\ngZoxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEzMDEGA1UEAwwq\nQW1hem9uIFJEUyBldS1jZW50cmFsLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYD\nVQQHDAdTZWF0dGxlMCAXDTIxMDUyMTIyMjM0N1oYDzIwNjEwNTIxMjMyMzQ3WjCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGV1LWNlbnRyYWwtMSBSb290IENBIFJTQTIwNDggRzExEDAOBgNV\nBAcMB1NlYXR0bGUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCTTYds\nTray+Q9VA5j5jTh5TunHKFQzn68ZbOzdqaoi/Rq4ohfC0xdLrxCpfqn2TGDHN6Zi\n2qGK1tWJZEd1H0trhzd9d1CtGK+3cjabUmz/TjSW/qBar7e9MA67/iJ74Gc+Ww43\nA0xPNIWcL4aLrHaLm7sHgAO2UCKsrBUpxErOAACERScVYwPAfu79xeFcX7DmcX+e\nlIqY16pQAvK2RIzrekSYfLFxwFq2hnlgKHaVgZ3keKP+nmXcXmRSHQYUUr72oYNZ\nHcNYl2+gxCc9ccPEHM7xncVEKmb5cWEWvVoaysgQ+osi5f5aQdzgC2X2g2daKbyA\nXL/z5FM9GHpS5BJjAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYE\nFBDAiJ7Py9/A9etNa/ebOnx5l5MGMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0B\nAQsFAAOCAQEALMh/+81fFPdJV/RrJUeoUvFCGMp8iaANu97NpeJyKitNOv7RoeVP\nWjivS0KcCqZaDBs+p6IZ0sLI5ZH098LDzzytcfZg0PsGqUAb8a0MiU/LfgDCI9Ee\njsOiwaFB8k0tfUJK32NPcIoQYApTMT2e26lPzYORSkfuntme2PTHUnuC7ikiQrZk\nP+SZjWgRuMcp09JfRXyAYWIuix4Gy0eZ4rpRuaTK6mjAb1/LYoNK/iZ/gTeIqrNt\nl70OWRsWW8jEmSyNTIubGK/gGGyfuZGSyqoRX6OKHESkP6SSulbIZHyJ5VZkgtXo\n2XvyRyJ7w5pFyoofrL3Wv0UF8yt/GDszmg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/zCCA+egAwIBAgIRAMDk/F+rrhdn42SfE+ghPC8wDQYJKoZIhvcNAQEMBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBldS13ZXN0LTIgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMTIyNTEyMloYDzIxMjEwNTIxMjM1MTIyWjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LXdlc3QtMiBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC2twMALVg9vRVu\nVNqsr6N8thmp3Dy8jEGTsm3GCQ+C5P2YcGlD/T/5icfWW84uF7Sx3ezcGlvsqFMf\nUkj9sQyqtz7qfFFugyy7pa/eH9f48kWFHLbQYm9GEgbYBIrWMp1cy3vyxuMCwQN4\nDCncqU+yNpy0CprQJEha3PzY+3yJOjDQtc3zr99lyECCFJTDUucxHzyQvX89eL74\nuh8la0lKH3v9wPpnEoftbrwmm5jHNFdzj7uXUHUJ41N7af7z7QUfghIRhlBDiKtx\n5lYZemPCXajTc3ryDKUZC/b+B6ViXZmAeMdmQoPE0jwyEp/uaUcdp+FlUQwCfsBk\nayPFEApTWgPiku2isjdeTVmEgL8bJTDUZ6FYFR7ZHcYAsDzcwHgIu3GGEMVRS3Uf\nILmioiyly9vcK4Sa01ondARmsi/I0s7pWpKflaekyv5boJKD/xqwz9lGejmJHelf\n8Od2TyqJScMpB7Q8c2ROxBwqwB72jMCEvYigB+Wnbb8RipliqNflIGx938FRCzKL\nUQUBmNAznR/yRRL0wHf9UAE/8v9a09uZABeiznzOFAl/frHpgdAbC00LkFlnwwgX\ng8YfEFlkp4fLx5B7LtoO6uVNFVimLxtwirpyKoj3G4M/kvSTux8bTw0heBCmWmKR\n57MS6k7ODzbv+Kpeht2hqVZCNFMxoQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBRuMnDhJjoj7DcKALj+HbxEqj3r6jAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQEMBQADggIBALSnXfx72C3ldhBP5kY4Mo2DDaGQ8FGpTOOiD95d\n0rf7I9LrsBGVqu/Nir+kqqP80PB70+Jy9fHFFigXwcPBX3MpKGxK8Cel7kVf8t1B\n4YD6A6bqlzP+OUL0uGWfZpdpDxwMDI2Flt4NEldHgXWPjvN1VblEKs0+kPnKowyg\njhRMgBbD/y+8yg0fIcjXUDTAw/+INcp21gWaMukKQr/8HswqC1yoqW9in2ijQkpK\n2RB9vcQ0/gXR0oJUbZQx0jn0OH8Agt7yfMAnJAdnHO4M3gjvlJLzIC5/4aGrRXZl\nJoZKfJ2fZRnrFMi0nhAYDeInoS+Rwx+QzaBk6fX5VPyCj8foZ0nmqvuYoydzD8W5\nmMlycgxFqS+DUmO+liWllQC4/MnVBlHGB1Cu3wTj5kgOvNs/k+FW3GXGzD3+rpv0\nQTLuwSbMr+MbEThxrSZRSXTCQzKfehyC+WZejgLb+8ylLJUA10e62o7H9PvCrwj+\nZDVmN7qj6amzvndCP98sZfX7CFZPLfcBd4wVIjHsFjSNEwWHOiFyLPPG7cdolGKA\nlOFvonvo4A1uRc13/zFeP0Xi5n5OZ2go8aOOeGYdI2vB2sgH9R2IASH/jHmr0gvY\n0dfBCcfXNgrS0toq0LX/y+5KkKOxh52vEYsJLdhqrveuZhQnsFEm/mFwjRXkyO7c\n2jpC\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGADCCA+igAwIBAgIQYe0HgSuFFP9ivYM2vONTrTANBgkqhkiG9w0BAQwFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGV1LXNvdXRoLTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE4MzMyMVoYDzIxMjEwNTE5MTkzMzIxWjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGV1LXNvdXRoLTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAuO7QPKfPMTo2\nPOQWvzDLwi5f++X98hGjORI1zkN9kotCYH5pAzSBwBPoMNaIfedgmsIxGHj2fq5G\n4oXagNhNuGP79Zl6uKW5H7S74W7aWM8C0s8zuxMOI4GZy5h2IfQk3m/3AzZEX5w8\nUtNPkzo2feDVOkerHT+j+vjXgAxZ4wHnuMDcRT+K4r9EXlAH6X9b/RO0JlfEwmNz\nxlqqGxocq9qRC66N6W0HF2fNEAKP84n8H80xcZBOBthQORRi8HSmKcPdmrvwCuPz\nM+L+j18q6RAVaA0ABbD0jMWcTf0UvjUfBStn5mvu/wGlLjmmRkZsppUTRukfwqXK\nyltUsTq0tOIgCIpne5zA4v+MebbR5JBnsvd4gdh5BI01QH470yB7BkUefZ9bobOm\nOseAAVXcYFJKe4DAA6uLDrqOfFSxV+CzVvEp3IhLRaik4G5MwI/h2c/jEYDqkg2J\nHMflxc2gcSMdk7E5ByLz5f6QrFfSDFk02ZJTs4ssbbUEYohht9znPMQEaWVqATWE\n3n0VspqZyoBNkH/agE5GiGZ/k/QyeqzMNj+c9kr43Upu8DpLrz8v2uAp5xNj3YVg\nihaeD6GW8+PQoEjZ3mrCmH7uGLmHxh7Am59LfEyNrDn+8Rq95WvkmbyHSVxZnBmo\nh/6O3Jk+0/QhIXZ2hryMflPcYWeRGH0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB\n/zAdBgNVHQ4EFgQU2eFK7+R3x/me8roIBNxBrplkM6EwDgYDVR0PAQH/BAQDAgGG\nMA0GCSqGSIb3DQEBDAUAA4ICAQB5gWFe5s7ObQFj1fTO9L6gYgtFhnwdmxU0q8Ke\nHWCrdFmyXdC39qdAFOwM5/7fa9zKmiMrZvy9HNvCXEp4Z7z9mHhBmuqPZQx0qPgU\nuLdP8wGRuWryzp3g2oqkX9t31Z0JnkbIdp7kfRT6ME4I4VQsaY5Y3mh+hIHOUvcy\np+98i3UuEIcwJnVAV9wTTzrWusZl9iaQ1nSYbmkX9bBssJ2GmtW+T+VS/1hJ/Q4f\nAlE3dOQkLFoPPb3YRWBHr2n1LPIqMVwDNAuWavRA2dSfaLl+kzbn/dua7HTQU5D4\nb2Fu2vLhGirwRJe+V7zdef+tI7sngXqjgObyOeG5O2BY3s+um6D4fS0Th3QchMO7\n0+GwcIgSgcjIjlrt6/xJwJLE8cRkUUieYKq1C4McpZWTF30WnzOPUzRzLHkcNzNA\n0A7sKMK6QoYWo5Rmo8zewUxUqzc9oQSrYADP7PEwGncLtFe+dlRFx+PA1a+lcIgo\n1ZGfXigYtQ3VKkcknyYlJ+hN4eCMBHtD81xDy9iP2MLE41JhLnoB2rVEtewO5diF\n7o95Mwl84VMkLhhHPeGKSKzEbBtYYBifHNct+Bst8dru8UumTltgfX6urH3DN+/8\nJF+5h3U8oR2LL5y76cyeb+GWDXXy9zoQe2QvTyTy88LwZq1JzujYi2k8QiLLhFIf\nFEv9Bg==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICsDCCAjagAwIBAgIRAMgApnfGYPpK/fD0dbN2U4YwCgYIKoZIzj0EAwMwgZcx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwnQW1h\nem9uIFJEUyBldS1zb3V0aC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMCAXDTIxMDUxOTE4MzgxMVoYDzIxMjEwNTE5MTkzODExWjCBlzELMAkG\nA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4xEzAR\nBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6b24g\nUkRTIGV1LXNvdXRoLTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1NlYXR0\nbGUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAQfEWl6d4qSuIoECdZPp+39LaKsfsX7\nTHs3/RrtT0+h/jl3bjZ7Qc68k16x+HGcHbaayHfqD0LPdzH/kKtNSfQKqemdxDQh\nZ4pwkixJu8T1VpXZ5zzCvBXCl75UqgEFS92jQjBAMA8GA1UdEwEB/wQFMAMBAf8w\nHQYDVR0OBBYEFFPrSNtWS5JU+Tvi6ABV231XbjbEMA4GA1UdDwEB/wQEAwIBhjAK\nBggqhkjOPQQDAwNoADBlAjEA+a7hF1IrNkBd2N/l7IQYAQw8chnRZDzh4wiGsZsC\n6A83maaKFWUKIb3qZYXFSi02AjAbp3wxH3myAmF8WekDHhKcC2zDvyOiKLkg9Y6v\nZVmyMR043dscQbcsVoacOYv198c=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICtDCCAjqgAwIBAgIRAPhVkIsQ51JFhD2kjFK5uAkwCgYIKoZIzj0EAwMwgZkx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEyMDAGA1UEAwwpQW1h\nem9uIFJEUyBldS1jZW50cmFsLTIgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjIwNjA2MjEyOTE3WhgPMjEyMjA2MDYyMjI5MTdaMIGZMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMjAwBgNVBAMMKUFtYXpv\nbiBSRFMgZXUtY2VudHJhbC0yIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEA5xnIEBtG5b2nmbj49UEwQza\nyX0844fXjccYzZ8xCDUe9dS2XOUi0aZlGblgSe/3lwjg8fMcKXLObGGQfgIx1+5h\nAIBjORis/dlyN5q/yH4U5sjS8tcR0GDGVHrsRUZCo0IwQDAPBgNVHRMBAf8EBTAD\nAQH/MB0GA1UdDgQWBBRK+lSGutXf4DkTjR3WNfv4+KeNFTAOBgNVHQ8BAf8EBAMC\nAYYwCgYIKoZIzj0EAwMDaAAwZQIxAJ4NxQ1Gerqr70ZrnUqc62Vl8NNqTzInamCG\nKce3FTsMWbS9qkgrjZkO9QqOcGIw/gIwSLrwUT+PKr9+H9eHyGvpq9/3AIYSnFkb\nCf3dyWPiLKoAtLFwjzB/CkJlsAS1c8dS\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/jCCA+agAwIBAgIQGZH12Q7x41qIh9vDu9ikTjANBgkqhkiG9w0BAQwFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIGV1LXdlc3QtMyBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTI1MjIyMjMzWhgPMjEyMTA1MjUyMzIyMzNaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgZXUtd2VzdC0zIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMqE47sHXWzdpuqj\nJHb+6jM9tDbQLDFnYjDWpq4VpLPZhb7xPNh9gnYYTPKG4avG421EblAHqzy9D2pN\n1z90yKbIfUb/Sy2MhQbmZomsObhONEra06fJ0Dydyjswf1iYRp2kwpx5AgkVoNo7\n3dlws73zFjD7ImKvUx2C7B75bhnw2pJWkFnGcswl8fZt9B5Yt95sFOKEz2MSJE91\nkZlHtya19OUxZ/cSGci4MlOySzqzbGwUqGxEIDlY8I39VMwXaYQ8uXUN4G780VcL\nu46FeyRGxZGz2n3hMc805WAA1V5uir87vuirTvoSVREET97HVRGVVNJJ/FM6GXr1\nVKtptybbo81nefYJg9KBysxAa2Ao2x2ry/2ZxwhS6VZ6v1+90bpZA1BIYFEDXXn/\ndW07HSCFnYSlgPtSc+Muh15mdr94LspYeDqNIierK9i4tB6ep7llJAnq0BU91fM2\nJPeqyoTtc3m06QhLf68ccSxO4l8Hmq9kLSHO7UXgtdjfRVaffngopTNk8qK7bIb7\nLrgkqhiQw/PRCZjUdyXL153/fUcsj9nFNe25gM4vcFYwH6c5trd2tUl31NTi1MfG\nMgp3d2dqxQBIYANkEjtBDMy3SqQLIo9EymqmVP8xx2A/gCBgaxvMAsI6FSWRoC7+\nhqJ8XH4mFnXSHKtYMe6WPY+/XZgtAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMBAf8w\nHQYDVR0OBBYEFIkXqTnllT/VJnI2NqipA4XV8rh1MA4GA1UdDwEB/wQEAwIBhjAN\nBgkqhkiG9w0BAQwFAAOCAgEAKjSle8eenGeHgT8pltWCw/HzWyQruVKhfYIBfKJd\nMhV4EnH5BK7LxBIvpXGsFUrb0ThzSw0fn0zoA9jBs3i/Sj6KyeZ9qUF6b8ycDXd+\nwHonmJiQ7nk7UuMefaYAfs06vosgl1rI7eBHC0itexIQmKh0aX+821l4GEgEoSMf\nloMFTLXv2w36fPHHCsZ67ODldgcZbKNnpCTX0YrCwEYO3Pz/L398btiRcWGrewrK\njdxAAyietra8DRno1Zl87685tfqc6HsL9v8rVw58clAo9XAQvT+fmSOFw/PogRZ7\nOMHUat3gu/uQ1M5S64nkLLFsKu7jzudBuoNmcJysPlzIbqJ7vYc82OUGe9ucF3wi\n3tbKQ983hdJiTExVRBLX/fYjPsGbG3JtPTv89eg2tjWHlPhCDMMxyRKl6isu2RTq\n6VT489Z2zQrC33MYF8ZqO1NKjtyMAMIZwxVu4cGLkVsqFmEV2ScDHa5RadDyD3Ok\nm+mqybhvEVm5tPgY6p0ILPMN3yvJsMSPSvuBXhO/X5ppNnpw9gnxpwbjQKNhkFaG\nM5pkADZ14uRguOLM4VthSwUSEAr5VQYCFZhEwK+UOyJAGiB/nJz6IxL5XBNUXmRM\nHl8Xvz4riq48LMQbjcVQj0XvH941yPh+P8xOi00SGaQRaWp55Vyr4YKGbV0mEDz1\nr1o=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIF/zCCA+egAwIBAgIRAKwYju1QWxUZpn6D1gOtwgQwDQYJKoZIhvcNAQEMBQAw\ngZcxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEwMC4GA1UEAwwn\nQW1hem9uIFJEUyBldS13ZXN0LTEgUm9vdCBDQSBSU0E0MDk2IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyMDE2NTM1NFoYDzIxMjEwNTIwMTc1MzU0WjCBlzEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdBbWF6\nb24gUkRTIGV1LXdlc3QtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCKdBP1U4lqWWkc\nCb25/BKRTsvNVnISiKocva8GAzJyKfcGRa85gmgu41U+Hz6+39K+XkRfM0YS4BvQ\nF1XxWT0bNyypuvwCvmYShSTjN1TY0ltncDddahTajE/4MdSOZb/c98u0yt03cH+G\nhVwRyT50h0v/UEol50VfwcVAEZEgcQQYhf1IFUFlIvKpmDOqLuFakOnc7c9akK+i\nivST+JO1tgowbnNkn2iLlSSgUWgb1gjaOsNfysagv1RXdlyPw3EyfwkFifAQvF2P\nQ0ayYZfYS640cccv7efM1MSVyFHR9PrrDsF/zr2S2sGPbeHr7R/HwLl+S5J/l9N9\ny0rk6IHAWV4dEkOvgpnuJKURwA48iu1Hhi9e4moNS6eqoK2KmY3VFpuiyWcA73nH\nGSmyaH+YuMrF7Fnuu7GEHZL/o6+F5cL3mj2SJJhL7sz0ryf5Cs5R4yN9BIEj/f49\nwh84pM6nexoI0Q4wiSFCxWiBpjSmOK6h7z6+2utaB5p20XDZHhxAlmlx4vMuWtjh\nXckgRFxc+ZpVMU3cAHUpVEoO49e/+qKEpPzp8Xg4cToKw2+AfTk3cmyyXQfGwXMQ\nZUHNZ3w9ILMWihGCM2aGUsLcGDRennvNmnmin/SENsOQ8Ku0/a3teEzwV9cmmdYz\n5iYs1YtgPvKFobY6+T2RXXh+A5kprwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/\nMB0GA1UdDgQWBBSyUrsQVnKmA8z6/2Ech0rCvqpNmTAOBgNVHQ8BAf8EBAMCAYYw\nDQYJKoZIhvcNAQEMBQADggIBAFlj3IFmgiFz5lvTzFTRizhVofhTJsGr14Yfkuc7\nUrXPuXOwJomd4uot2d/VIeGJpfnuS84qGdmQyGewGTJ9inatHsGZgHl9NHNWRwKZ\nlTKTbBiq7aqgtUSFa06v202wpzU+1kadxJJePrbABxiXVfOmIW/a1a4hPNcT3syH\nFIEg1+CGsp71UNjBuwg3JTKWna0sLSKcxLOSOvX1fzxK5djzVpEsvQMB4PSAzXca\nvENgg2ErTwgTA+4s6rRtiBF9pAusN1QVuBahYP3ftrY6f3ycS4K65GnqscyfvKt5\nYgjtEKO3ZeeX8NpubMbzC+0Z6tVKfPFk/9TXuJtwvVeqow0YMrLLyRiYvK7EzJ97\nrrkxoKnHYQSZ+rH2tZ5SE392/rfk1PJL0cdHnkpDkUDO+8cKsFjjYKAQSNC52sKX\n74AVh6wMwxYwVZZJf2/2XxkjMWWhKNejsZhUkTISSmiLs+qPe3L67IM7GyKm9/m6\nR3r8x6NGjhTsKH64iYJg7AeKeax4b2e4hBb6GXFftyOs7unpEOIVkJJgM6gh3mwn\nR7v4gwFbLKADKt1vHuerSZMiTuNTGhSfCeDM53XI/mjZl2HeuCKP1mCDLlaO+gZR\nQ/G+E0sBKgEX4xTkAc3kgkuQGfExdGtnN2U2ehF80lBHB8+2y2E+xWWXih/ZyIcW\nwOx+\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGBDCCA+ygAwIBAgIQM4C8g5iFRucSWdC8EdqHeDANBgkqhkiG9w0BAQwFADCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGV1LWNlbnRyYWwtMSBSb290IENBIFJTQTQwOTYgRzExEDAOBgNV\nBAcMB1NlYXR0bGUwIBcNMjEwNTIxMjIyODI2WhgPMjEyMTA1MjEyMzI4MjZaMIGa\nMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5j\nLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMzAxBgNVBAMMKkFt\nYXpvbiBSRFMgZXUtY2VudHJhbC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANeTsD/u\n6saPiY4Sg0GlJlMXMBltnrcGAEkwq34OKQ0bCXqcoNJ2rcAMmuFC5x9Ho1Y3YzB7\nNO2GpIh6bZaO76GzSv4cnimcv9n/sQSYXsGbPD+bAtnN/RvNW1avt4C0q0/ghgF1\nVFS8JihIrgPYIArAmDtGNEdl5PUrdi9y6QGggbRfidMDdxlRdZBe1C18ZdgERSEv\nUgSTPRlVczONG5qcQkUGCH83MMqL5MKQiby/Br5ZyPq6rxQMwRnQ7tROuElzyYzL\n7d6kke+PNzG1mYy4cbYdjebwANCtZ2qYRSUHAQsOgybRcSoarv2xqcjO9cEsDiRU\nl97ToadGYa4VVERuTaNZxQwrld4mvzpyKuirqZltOqg0eoy8VUsaRPL3dc5aChR0\ndSrBgRYmSAClcR2/2ZCWpXemikwgt031Dsc0A/+TmVurrsqszwbr0e5xqMow9LzO\nMI/JtLd0VFtoOkL/7GG2tN8a+7gnLFxpv+AQ0DH5n4k/BY/IyS+H1erqSJhOTQ11\nvDOFTM5YplB9hWV9fp5PRs54ILlHTlZLpWGs3I2BrJwzRtg/rOlvsosqcge9ryai\nAKm2j+JBg5wJ19R8oxRy8cfrNTftZePpISaLTyV2B16w/GsSjqixjTQe9LRN2DHk\ncC+HPqYyzW2a3pUVyTGHhW6a7YsPBs9yzt6hAgMBAAGjQjBAMA8GA1UdEwEB/wQF\nMAMBAf8wHQYDVR0OBBYEFIqA8QkOs2cSirOpCuKuOh9VDfJfMA4GA1UdDwEB/wQE\nAwIBhjANBgkqhkiG9w0BAQwFAAOCAgEAOUI90mEIsa+vNJku0iUwdBMnHiO4gm7E\n5JloP7JG0xUr7d0hypDorMM3zVDAL+aZRHsq8n934Cywj7qEp1304UF6538ByGdz\ntkfacJsUSYfdlNJE9KbA4T+U+7SNhj9jvePpVjdQbhgzxITE9f8CxY/eM40yluJJ\nPhbaWvOiRagzo74wttlcDerzLT6Y/JrVpWhnB7IY8HvzK+BwAdaCsBUPC3HF+kth\nCIqLq7J3YArTToejWZAp5OOI6DLPM1MEudyoejL02w0jq0CChmZ5i55ElEMnapRX\n7GQTARHmjgAOqa95FjbHEZzRPqZ72AtZAWKFcYFNk+grXSeWiDgPFOsq6mDg8DDB\n0kfbYwKLFFCC9YFmYzR2YrWw2NxAScccUc2chOWAoSNHiqBbHR8ofrlJSWrtmKqd\nYRCXzn8wqXnTS3NNHNccqJ6dN+iMr9NGnytw8zwwSchiev53Fpc1mGrJ7BKTWH0t\nZrA6m32wzpMymtKozlOPYoE5mtZEzrzHEXfa44Rns7XIHxVQSXVWyBHLtIsZOrvW\nU5F41rQaFEpEeUQ7sQvqUoISfTUVRNDn6GK6YaccEhCji14APLFIvhRQUDyYMIiM\n4vll0F/xgVRHTgDVQ8b8sxdhSYlqB4Wc2Ym41YRz+X2yPqk3typEZBpc4P5Tt1/N\n89cEIGdbjsA=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQYjbPSg4+RNRD3zNxO1fuKDANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGV1LW5vcnRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUyNDIwNTkyMVoYDzIwNjEwNTI0MjE1OTIxWjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGV1LW5vcnRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA179eQHxcV0YL\nXMkqEmhSBazHhnRVd8yICbMq82PitE3BZcnv1Z5Zs/oOgNmMkOKae4tCXO/41JCX\nwAgbs/eWWi+nnCfpQ/FqbLPg0h3dqzAgeszQyNl9IzTzX4Nd7JFRBVJXPIIKzlRf\n+GmFsAhi3rYgDgO27pz3ciahVSN+CuACIRYnA0K0s9lhYdddmrW/SYeWyoB7jPa2\nLmWpAs7bDOgS4LlP2H3eFepBPgNufRytSQUVA8f58lsE5w25vNiUSnrdlvDrIU5n\nQwzc7NIZCx4qJpRbSKWrUtbyJriWfAkGU7i0IoainHLn0eHp9bWkwb9D+C/tMk1X\nERZw2PDGkwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSFmR7s\ndAblusFN+xhf1ae0KUqhWTAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAHsXOpjPMyH9lDhPM61zYdja1ebcMVgfUvsDvt+w0xKMKPhBzYDMs/cFOi1N\nQ8LV79VNNfI2NuvFmGygcvTIR+4h0pqqZ+wjWl3Kk5jVxCrbHg3RBX02QLumKd/i\nkwGcEtTUvTssn3SM8bgM0/1BDXgImZPC567ciLvWDo0s/Fe9dJJC3E0G7d/4s09n\nOMdextcxFuWBZrBm/KK3QF0ByA8MG3//VXaGO9OIeeOJCpWn1G1PjT1UklYhkg61\nEbsTiZVA2DLd1BGzfU4o4M5mo68l0msse/ndR1nEY6IywwpgIFue7+rEleDh6b9d\nPYkG1rHVw2I0XDG4o17aOn5E94I=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQC6W4HFghUkkgyQw14a6JljANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGV1LXNvdXRoLTIgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIyMDUyMzE4MTYzMloYDzIwNjIwNTIzMTkxNjMyWjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGV1LXNvdXRoLTIgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiM/t4FV2R9Nx\nUQG203UY83jInTa/6TMq0SPyg617FqYZxvz2kkx09x3dmxepUg9ttGMlPgjsRZM5\nLCFEi1FWk+hxHzt7vAdhHES5tdjwds3aIkgNEillmRDVrUsbrDwufLaa+MMDO2E1\nwQ/JYFXw16WBCCi2g1EtyQ2Xp+tZDX5IWOTnvhZpW8vVDptZ2AcJ5rMhfOYO3OsK\n5EF0GGA5ldzuezP+BkrBYGJ4wVKGxeaq9+5AT8iVZrypjwRkD7Y5CurywK3+aBwm\ns9Q5Nd8t45JCOUzYp92rFKsCriD86n/JnEvgDfdP6Hvtm0/DkwXK40Wz2q0Zrd0k\nmjP054NRPwIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRR7yqd\nSfKcX2Q8GzhcVucReIpewTAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAEszBRDwXcZyNm07VcFwI1Im94oKwKccuKYeJEsizTBsVon8VpEiMwDs+yGu\n3p8kBhvkLwWybkD/vv6McH7T5b9jDX2DoOudqYnnaYeypsPH/00Vh3LvKagqzQza\norWLx+0tLo8xW4BtU+Wrn3JId8LvAhxyYXTn9bm+EwPcStp8xGLwu53OPD1RXYuy\nuu+3ps/2piP7GVfou7H6PRaqbFHNfiGg6Y+WA0HGHiJzn8uLmrRJ5YRdIOOG9/xi\nqTmAZloUNM7VNuurcMM2hWF494tQpsQ6ysg2qPjbBqzlGoOt3GfBTOZmqmwmqtam\nK7juWM/mdMQAJ3SMlE5wI8nVdx4=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIICrjCCAjSgAwIBAgIRAL9SdzVPcpq7GOpvdGoM80IwCgYIKoZIzj0EAwMwgZYx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTEvMC0GA1UEAwwmQW1h\nem9uIFJEUyBldS13ZXN0LTEgUm9vdCBDQSBFQ0MzODQgRzExEDAOBgNVBAcMB1Nl\nYXR0bGUwIBcNMjEwNTIwMTY1ODA3WhgPMjEyMTA1MjAxNzU4MDdaMIGWMQswCQYD\nVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjETMBEG\nA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExLzAtBgNVBAMMJkFtYXpvbiBS\nRFMgZXUtd2VzdC0xIFJvb3QgQ0EgRUNDMzg0IEcxMRAwDgYDVQQHDAdTZWF0dGxl\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEJWDgXebvwjR+Ce+hxKOLbnsfN5W5dOlP\nZn8kwWnD+SLkU81Eac/BDJsXGrMk6jFD1vg16PEkoSevsuYWlC8xR6FmT6F6pmeh\nfsMGOyJpfK4fyoEPhKeQoT23lFIc5Orjo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0G\nA1UdDgQWBBSVNAN1CHAz0eZ77qz2adeqjm31TzAOBgNVHQ8BAf8EBAMCAYYwCgYI\nKoZIzj0EAwMDaAAwZQIxAMlQeHbcjor49jqmcJ9gRLWdEWpXG8thIf6zfYQ/OEAg\nd7GDh4fR/OUk0VfjsBUN/gIwZB0bGdXvK38s6AAE/9IT051cz/wMe9GIrX1MnL1T\n1F5OqnXJdiwfZRRTHsRQ/L00\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGBDCCA+ygAwIBAgIQalr16vDfX4Rsr+gfQ4iVFDANBgkqhkiG9w0BAQwFADCB\nmjELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTMwMQYDVQQDDCpB\nbWF6b24gUkRTIGV1LWNlbnRyYWwtMiBSb290IENBIFJTQTQwOTYgRzExEDAOBgNV\nBAcMB1NlYXR0bGUwIBcNMjIwNjA2MjEyNTIzWhgPMjEyMjA2MDYyMjI1MjNaMIGa\nMQswCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5j\nLjETMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMzAxBgNVBAMMKkFt\nYXpvbiBSRFMgZXUtY2VudHJhbC0yIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANbHbFg7\n2VhZor1YNtez0VlNFaobS3PwOMcEn45BE3y7HONnElIIWXGQa0811M8V2FnyqnE8\nZ5aO1EuvijvWf/3D8DPZkdmAkIfh5hlZYY6Aatr65kEOckwIAm7ZZzrwFogYuaFC\nz/q0CW+8gxNK+98H/zeFx+IxiVoPPPX6UlrLvn+R6XYNERyHMLNgoZbbS5gGHk43\nKhENVv3AWCCcCc85O4rVd+DGb2vMVt6IzXdTQt6Kih28+RGph+WDwYmf+3txTYr8\nxMcCBt1+whyCPlMbC+Yn/ivtCO4LRf0MPZDRQrqTTrFf0h/V0BGEUmMGwuKgmzf5\nKl9ILdWv6S956ioZin2WgAxhcn7+z//sN++zkqLreSf90Vgv+A7xPRqIpTdJ/nWG\nJaAOUofBfsDsk4X4SUFE7xJa1FZAiu2lqB/E+y7jnWOvFRalzxVJ2Y+D/ZfUfrnK\n4pfKtyD1C6ni1celrZrAwLrJ3PoXPSg4aJKh8+CHex477SRsGj8KP19FG8r0P5AG\n8lS1V+enFCNvT5KqEBpDZ/Y5SQAhAYFUX+zH4/n4ql0l/emS+x23kSRrF+yMkB9q\nlhC/fMk6Pi3tICBjrDQ8XAxv56hfud9w6+/ljYB2uQ1iUYtlE3JdIiuE+3ws26O8\ni7PLMD9zQmo+sVi12pLHfBHQ6RRHtdVRXbXRAgMBAAGjQjBAMA8GA1UdEwEB/wQF\nMAMBAf8wHQYDVR0OBBYEFBFot08ipEL9ZUXCG4lagmF53C0/MA4GA1UdDwEB/wQE\nAwIBhjANBgkqhkiG9w0BAQwFAAOCAgEAi2mcZi6cpaeqJ10xzMY0F3L2eOKYnlEQ\nh6QyhmNKCUF05q5u+cok5KtznzqMwy7TFOZtbVHl8uUX+xvgq/MQCxqFAnuStBXm\ngr2dg1h509ZwvTdk7TDxGdftvPCfnPNJBFbMSq4CZtNcOFBg9Rj8c3Yj+Qvwd56V\nzWs65BUkDNJrXmxdvhJZjUkMa9vi/oFN+M84xXeZTaC5YDYNZZeW9706QqDbAVES\n5ulvKLavB8waLI/lhRBK5/k0YykCMl0A8Togt8D1QsQ0eWWbIM8/HYJMPVFhJ8Wj\nvT1p/YVeDA3Bo1iKDOttgC5vILf5Rw1ZEeDxjf/r8A7VS13D3OLjBmc31zxRTs3n\nXvHKP9MieQHn9GE44tEYPjK3/yC6BDFzCBlvccYHmqGb+jvDEXEBXKzimdC9mcDl\nf4BBQWGJBH5jkbU9p6iti19L/zHhz7qU6UJWbxY40w92L9jS9Utljh4A0LCTjlnR\nNQUgjnGC6K+jkw8hj0LTC5Ip87oqoT9w7Av5EJ3VJ4hcnmNMXJJ1DkWYdnytcGpO\nDMVITQzzDZRwhbitCVPHagTN2wdi9TEuYE33J0VmFeTc6FSI50wP2aOAZ0Q1/8Aj\nbxeM5jS25eaHc2CQAuhrc/7GLnxOcPwdWQb2XWT8eHudhMnoRikVv/KSK3mf6om4\n1YfpdH2jp30=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID/jCCAuagAwIBAgIQTDc+UgTRtYO7ZGTQ8UWKDDANBgkqhkiG9w0BAQsFADCB\nlzELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTAwLgYDVQQDDCdB\nbWF6b24gUkRTIGV1LXdlc3QtMiBSb290IENBIFJTQTIwNDggRzExEDAOBgNVBAcM\nB1NlYXR0bGUwIBcNMjEwNTIxMjI0NjI0WhgPMjA2MTA1MjEyMzQ2MjRaMIGXMQsw\nCQYDVQQGEwJVUzEiMCAGA1UECgwZQW1hem9uIFdlYiBTZXJ2aWNlcywgSW5jLjET\nMBEGA1UECwwKQW1hem9uIFJEUzELMAkGA1UECAwCV0ExMDAuBgNVBAMMJ0FtYXpv\nbiBSRFMgZXUtd2VzdC0yIFJvb3QgQ0EgUlNBMjA0OCBHMTEQMA4GA1UEBwwHU2Vh\ndHRsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM1oGtthQ1YiVIC2\ni4u4swMAGxAjc/BZp0yq0eP5ZQFaxnxs7zFAPabEWsrjeDzrRhdVO0h7zskrertP\ngblGhfD20JfjvCHdP1RUhy/nzG+T+hn6Takan/GIgs8grlBMRHMgBYHW7tklhjaH\n3F7LujhceAHhhgp6IOrpb6YTaTTaJbF3GTmkqxSJ3l1LtEoWz8Al/nL/Ftzxrtez\nVs6ebpvd7sw37sxmXBWX2OlvUrPCTmladw9OrllGXtCFw4YyLe3zozBlZ3cHzQ0q\nlINhpRcajTMfZrsiGCkQtoJT+AqVJPS2sHjqsEH8yiySW9Jbq4zyMbM1yqQ2vnnx\nMJgoYMcCAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUaQG88UnV\nJPTI+Pcti1P+q3H7pGYwDgYDVR0PAQH/BAQDAgGGMA0GCSqGSIb3DQEBCwUAA4IB\nAQBAkgr75V0sEJimC6QRiTVWEuj2Khy7unjSfudbM6zumhXEU2/sUaVLiYy6cA/x\n3v0laDle6T07x9g64j5YastE/4jbzrGgIINFlY0JnaYmR3KZEjgi1s1fkRRf3llL\nPJm9u4Q1mbwAMQK/ZjLuuRcL3uRIHJek18nRqT5h43GB26qXyvJqeYYpYfIjL9+/\nYiZAbSRRZG+Li23cmPWrbA1CJY121SB+WybCbysbOXzhD3Sl2KSZRwSw4p2HrFtV\n1Prk0dOBtZxCG9luf87ultuDZpfS0w6oNBAMXocgswk24ylcADkkFxBWW+7BETn1\nEpK+t1Lm37mU4sxtuha00XAi\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIEADCCAuigAwIBAgIQcY44/8NUvBwr6LlHfRy7KjANBgkqhkiG9w0BAQsFADCB\nmDELMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIElu\nYy4xEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChB\nbWF6b24gUkRTIGV1LXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQH\nDAdTZWF0dGxlMCAXDTIxMDUxOTE4MjcxOFoYDzIwNjEwNTE5MTkyNzE4WjCBmDEL\nMAkGA1UEBhMCVVMxIjAgBgNVBAoMGUFtYXpvbiBXZWIgU2VydmljZXMsIEluYy4x\nEzARBgNVBAsMCkFtYXpvbiBSRFMxCzAJBgNVBAgMAldBMTEwLwYDVQQDDChBbWF6\nb24gUkRTIGV1LXNvdXRoLTEgUm9vdCBDQSBSU0EyMDQ4IEcxMRAwDgYDVQQHDAdT\nZWF0dGxlMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0UaBeC+Usalu\nEtXnV7+PnH+gi7/71tI/jkKVGKuhD2JDVvqLVoqbMHRh3+wGMvqKCjbHPcC2XMWv\n566fpAj4UZ9CLB5fVzss+QVNTl+FH2XhEzigopp+872ajsNzcZxrMkifxGb4i0U+\nt0Zi+UrbL5tsfP2JonKR1crOrbS6/DlzHBjIiJazGOQcMsJjNuTOItLbMohLpraA\n/nApa3kOvI7Ufool1/34MG0+wL3UUA4YkZ6oBJVxjZvvs6tI7Lzz/SnhK2widGdc\nsnbLqBpHNIZQSorVoiwcFaRBGYX/uzYkiw44Yfa4cK2V/B5zgu1Fbr0gbI2am4eh\nyVYyg4jPawIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBS9gM1m\nIIjyh9O5H/7Vj0R/akI7UzAOBgNVHQ8BAf8EBAMCAYYwDQYJKoZIhvcNAQELBQAD\nggEBAF0Sm9HC2AUyedBVnwgkVXMibnYChOzz7T+0Y+fOLXYAEXex2s8oqGeZdGYX\nJHkjBn7JXu7LM+TpTbPbFFDoc1sgMguD/ls+8XsqAl1CssW+amryIL+jfcfbgQ+P\nICwEUD9hGdjBgJ5WcuS+qqxHsEIlFNci3HxcxfBa9VsWs5TjI7Vsl4meL5lf7ZyL\nwDV7dHRuU+cImqG1MIvPRIlvPnT7EghrCYi2VCPhP2pM/UvShuwVnkz4MJ29ebIk\nWR9kpblFxFdE92D5UUvMCjC2kmtgzNiErvTcwIvOO9YCbBHzRB1fFiWrXUHhJWq9\nIkaxR5icb/IpAV0A1lYZEWMVsfQ=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIGATCCA+mgAwIBAgIRAMa0TPL+QgbWfUPpYXQkf8wwDQYJKoZIhvcNAQEMBQAw\ngZgxCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJ\nbmMuMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwo\nQW1hem9uIFJEUyBldS1ub3J0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UE\nBwwHU2VhdHRsZTAgFw0yMTA1MjQyMTAzMjBaGA8yMTIxMDUyNDIyMDMyMFowgZgx\nCzAJBgNVBAYTAlVTMSIwIAYDVQQKDBlBbWF6b24gV2ViIFNlcnZpY2VzLCBJbmMu\nMRMwEQYDVQQLDApBbWF6b24gUkRTMQswCQYDVQQIDAJXQTExMC8GA1UEAwwoQW1h\nem9uIFJEUyBldS1ub3J0aC0xIFJvb3QgQ0EgUlNBNDA5NiBHMTEQMA4GA1UEBwwH\nU2VhdHRsZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANhS9LJVJyWp\n6Rudy9t47y6kzvgnFYDrvJVtgEK0vFn5ifdlHE7xqMz4LZqWBFTnS+3oidwVRqo7\ntqsuuElsouStO8m315/YUzKZEPmkw8h5ufWt/lg3NTCoUZNkB4p4skr7TspyMUwE\nVdlKQuWTCOLtofwmWT+BnFF3To6xTh3XPlT3ssancw27Gob8kJegD7E0TSMVsecP\nB8je65+3b8CGwcD3QB3kCTGLy87tXuS2+07pncHvjMRMBdDQQQqhXWsRSeUNg0IP\nxdHTWcuwMldYPWK5zus9M4dCNBDlmZjKdcZZVUOKeBBAm7Uo7CbJCk8r/Fvfr6mw\nnXXDtuWhqn/WhJiI/y0QU27M+Hy5CQMxBwFsfAjJkByBpdXmyYxUgTmMpLf43p7H\noWfH1xN0cT0OQEVmAQjMakauow4AQLNkilV+X6uAAu3STQVFRSrpvMen9Xx3EPC3\nG9flHueTa71bU65Xe8ZmEmFhGeFYHY0GrNPAFhq9RThPRY0IPyCZe0Th8uGejkek\njQjm0FHPOqs5jc8CD8eJs4jSEFt9lasFLVDcAhx0FkacLKQjGHvKAnnbRwhN/dF3\nxt4oL8Z4JGPCLau056gKnYaEyviN7PgO+IFIVOVIdKEBu2ASGE8/+QJB5bcHefNj\n04hEkDW0UYJbSfPpVbGAR0gFI/QpycKnAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wHQYDVR0OBBYEFFMXvvjoaGGUcul8GA3FT05DLbZcMA4GA1UdDwEB/wQEAwIB\nhjANBgkqhkiG9w0BAQwFAAOCAgEAQLwFhd2JKn4K/6salLyIA4mP58qbA/9BTB/r\nD9l0bEwDlVPSdY7R3gZCe6v7SWLfA9RjE5tdWDrQMi5IU6W2OVrVsZS/yGJfwnwe\na/9iUAYprA5QYKDg37h12XhVsDKlYCekHdC+qa5WwB1SL3YUprDLPWeaIQdg+Uh2\n+LxvpZGoxoEbca0fc7flwq9ke/3sXt/3V4wJDyY6AL2YNdjFzC+FtYjHHx8rYxHs\naesP7yunuN17KcfOZBBnSFRrx96k+Xm95VReTEEpwiBqAECqEpMbd+R0mFAayMb1\ncE77GaK5yeC2f67NLYGpkpIoPbO9p9rzoXLE5GpSizMjimnz6QCbXPFAFBDfSzim\nu6azp40kEUO6kWd7rBhqRwLc43D3TtNWQYxMve5mTRG4Od+eMKwYZmQz89BQCeqm\naZiJP9y9uwJw4p/A5V3lYHTDQqzmbOyhGUk6OdpdE8HXs/1ep1xTT20QDYOx3Ekt\nr4mmNYfH/8v9nHNRlYJOqFhmoh1i85IUl5IHhg6OT5ZTTwsGTSxvgQQXrmmHVrgZ\nrZIqyBKllCgVeB9sMEsntn4bGLig7CS/N1y2mYdW/745yCLZv2gj0NXhPqgEIdVV\nf9DhFD4ohE1C63XP0kOQee+LYg/MY5vH8swpCSWxQgX5icv5jVDz8YTdCKgUc5u8\nrM2p0kk=\n-----END CERTIFICATE-----\n"
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/profiles/ca/proxies.js
var require_proxies = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/profiles/ca/proxies.js": ((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.proxies = void 0;
	/**
	* CA Certificates for **Amazon RDS Proxy** (2024)
	*
	* - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.howitworks.html#rds-proxy-security.tls
	* - https://www.amazontrust.com/repository/
	*/
	exports.proxies = [
		"-----BEGIN CERTIFICATE-----\nMIIDQTCCAimgAwIBAgITBmyfz5m/jAo54vB4ikPmljZbyjANBgkqhkiG9w0BAQsF\nADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6\nb24gUm9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTEL\nMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv\nb3QgQ0EgMTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALJ4gHHKeNXj\nca9HgFB0fW7Y14h29Jlo91ghYPl0hAEvrAIthtOgQ3pOsqTQNroBvo3bSMgHFzZM\n9O6II8c+6zf1tRn4SWiw3te5djgdYZ6k/oI2peVKVuRF4fn9tBb6dNqcmzU5L/qw\nIFAGbHrQgLKm+a/sRxmPUDgH3KKHOVj4utWp+UhnMJbulHheb4mjUcAwhmahRWa6\nVOujw5H5SNz/0egwLX0tdHA114gk957EWW67c4cX8jJGKLhD+rcdqsq08p8kDi1L\n93FcXmn/6pUCyziKrlA4b9v7LWIbxcceVOF34GfID5yHI9Y/QCB/IIDEgEw+OyQm\njgSubJrIqg0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMC\nAYYwHQYDVR0OBBYEFIQYzIU07LwMlJQuCFmcx7IQTgoIMA0GCSqGSIb3DQEBCwUA\nA4IBAQCY8jdaQZChGsV2USggNiMOruYou6r4lK5IpDB/G/wkjUu0yKGX9rbxenDI\nU5PMCCjjmCXPI6T53iHTfIUJrU6adTrCC2qJeHZERxhlbI1Bjjt/msv0tadQ1wUs\nN+gDS63pYaACbvXy8MWy7Vu33PqUXHeeE6V/Uq2V8viTO96LXFvKWlJbYK8U90vv\no/ufQJVtMVT8QtPHRh8jrdkPSHCa2XV4cdFyQzR1bldZwgJcJmApzyMZFo6IQ6XU\n5MsI+yMRQ+hDKXJioaldXgjUkK642M4UwtBV8ob2xJNDd2ZhwLnoQdeXeGADbkpy\nrqXRfboQnoZsG4q5WTP468SQvvG5\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIFQTCCAymgAwIBAgITBmyf0pY1hp8KD+WGePhbJruKNzANBgkqhkiG9w0BAQwF\nADA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6\nb24gUm9vdCBDQSAyMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTEL\nMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJv\nb3QgQ0EgMjCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK2Wny2cSkxK\ngXlRmeyKy2tgURO8TW0G/LAIjd0ZEGrHJgw12MBvIITplLGbhQPDW9tK6Mj4kHbZ\nW0/jTOgGNk3Mmqw9DJArktQGGWCsN0R5hYGCrVo34A3MnaZMUnbqQ523BNFQ9lXg\n1dKmSYXpN+nKfq5clU1Imj+uIFptiJXZNLhSGkOQsL9sBbm2eLfq0OQ6PBJTYv9K\n8nu+NQWpEjTj82R0Yiw9AElaKP4yRLuH3WUnAnE72kr3H9rN9yFVkE8P7K6C4Z9r\n2UXTu/Bfh+08LDmG2j/e7HJV63mjrdvdfLC6HM783k81ds8P+HgfajZRRidhW+me\nz/CiVX18JYpvL7TFz4QuK/0NURBs+18bvBt+xa47mAExkv8LV/SasrlX6avvDXbR\n8O70zoan4G7ptGmh32n2M8ZpLpcTnqWHsFcQgTfJU7O7f/aS0ZzQGPSSbtqDT6Zj\nmUyl+17vIWR6IF9sZIUVyzfpYgwLKhbcAS4y2j5L9Z469hdAlO+ekQiG+r5jqFoz\n7Mt0Q5X5bGlSNscpb/xVA1wf+5+9R+vnSUeVC06JIglJ4PVhHvG/LopyboBZ/1c6\n+XUyo05f7O0oYtlNc/LMgRdg7c3r3NunysV+Ar3yVAhU/bQtCSwXVEqY0VThUWcI\n0u1ufm8/0i2BWSlmy5A5lREedCf+3euvAgMBAAGjQjBAMA8GA1UdEwEB/wQFMAMB\nAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSwDPBMMPQFWAJI/TPlUq9LhONm\nUjANBgkqhkiG9w0BAQwFAAOCAgEAqqiAjw54o+Ci1M3m9Zh6O+oAA7CXDpO8Wqj2\nLIxyh6mx/H9z/WNxeKWHWc8w4Q0QshNabYL1auaAn6AFC2jkR2vHat+2/XcycuUY\n+gn0oJMsXdKMdYV2ZZAMA3m3MSNjrXiDCYZohMr/+c8mmpJ5581LxedhpxfL86kS\nk5Nrp+gvU5LEYFiwzAJRGFuFjWJZY7attN6a+yb3ACfAXVU3dJnJUH/jWS5E4ywl\n7uxMMne0nxrpS10gxdr9HIcWxkPo1LsmmkVwXqkLN1PiRnsn/eBG8om3zEK2yygm\nbtmlyTrIQRNg91CMFa6ybRoVGld45pIq2WWQgj9sAq+uEjonljYE1x2igGOpm/Hl\nurR8FLBOybEfdF849lHqm/osohHUqS0nGkWxr7JOcQ3AWEbWaQbLU8uz/mtBzUF+\nfUwPfHJ5elnNXkoOrJupmHN5fLT0zLm4BwyydFy4x2+IoZCn9Kr5v2c69BoVYh63\nn749sSmvZ6ES8lgQGVMDMBu4Gon2nL2XA46jCfMdiyHxtN/kHNGfZQIG6lzWE7OE\n76KlXIx3KadowGuuQNKotOrN8I1LOJwZmhsoVLiJkO/KdYE+HvJkJMcYr07/R54H\n9jVlpNMKVv/1F2Rs76giJUmTtt8AF9pYfl3uxRuw0dFfIRDH+fO6AgonB8Xx1sfT\n4PsJYGw=\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5\nMQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24g\nUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkG\nA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3Qg\nQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKl\nui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6j\nQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSr\nttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkr\nBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteM\nYyRIHN8wfdVoOw==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIIB8jCCAXigAwIBAgITBmyf18G7EEwpQ+Vxe3ssyBrBDjAKBggqhkjOPQQDAzA5\nMQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24g\nUm9vdCBDQSA0MB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkG\nA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3Qg\nQ0EgNDB2MBAGByqGSM49AgEGBSuBBAAiA2IABNKrijdPo1MN/sGKe0uoe0ZLY7Bi\n9i0b2whxIdIA6GO9mif78DluXeo9pcmBqqNbIJhFXRbb/egQbeOc4OO9X4Ri83Bk\nM6DLJC9wuoihKqB1+IGuYgbEgds5bimwHvouXKNCMEAwDwYDVR0TAQH/BAUwAwEB\n/zAOBgNVHQ8BAf8EBAMCAYYwHQYDVR0OBBYEFNPsxzplbszh2naaVvuc84ZtV+WB\nMAoGCCqGSM49BAMDA2gAMGUCMDqLIfG9fhGt0O9Yli/W651+kI0rz2ZVwyzjKKlw\nCkcO8DdZEv8tmZQoTipPNU0zWgIxAOp1AE47xDqUEpHJWEadIRNyp4iciuRMStuW\n1KyLa2tJElMzrdfkviT8tQp21KW8EA==\n-----END CERTIFICATE-----\n",
		"-----BEGIN CERTIFICATE-----\nMIID7zCCAtegAwIBAgIBADANBgkqhkiG9w0BAQsFADCBmDELMAkGA1UEBhMCVVMx\nEDAOBgNVBAgTB0FyaXpvbmExEzARBgNVBAcTClNjb3R0c2RhbGUxJTAjBgNVBAoT\nHFN0YXJmaWVsZCBUZWNobm9sb2dpZXMsIEluYy4xOzA5BgNVBAMTMlN0YXJmaWVs\nZCBTZXJ2aWNlcyBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAtIEcyMB4XDTA5\nMDkwMTAwMDAwMFoXDTM3MTIzMTIzNTk1OVowgZgxCzAJBgNVBAYTAlVTMRAwDgYD\nVQQIEwdBcml6b25hMRMwEQYDVQQHEwpTY290dHNkYWxlMSUwIwYDVQQKExxTdGFy\nZmllbGQgVGVjaG5vbG9naWVzLCBJbmMuMTswOQYDVQQDEzJTdGFyZmllbGQgU2Vy\ndmljZXMgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgLSBHMjCCASIwDQYJKoZI\nhvcNAQEBBQADggEPADCCAQoCggEBANUMOsQq+U7i9b4Zl1+OiFOxHz/Lz58gE20p\nOsgPfTz3a3Y4Y9k2YKibXlwAgLIvWX/2h/klQ4bnaRtSmpDhcePYLQ1Ob/bISdm2\n8xpWriu2dBTrz/sm4xq6HZYuajtYlIlHVv8loJNwU4PahHQUw2eeBGg6345AWh1K\nTs9DkTvnVtYAcMtS7nt9rjrnvDH5RfbCYM8TWQIrgMw0R9+53pBlbQLPLJGmpufe\nhRhJfGZOozptqbXuNC66DQO4M99H67FrjSXZm86B0UVGMpZwh94CDklDhbZsc7tk\n6mFBrMnUVN+HL8cisibMn1lUaJ/8viovxFUcdUBgF4UCVTmLfwUCAwEAAaNCMEAw\nDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFJxfAN+q\nAdcwKziIorhtSpzyEZGDMA0GCSqGSIb3DQEBCwUAA4IBAQBLNqaEd2ndOxmfZyMI\nbw5hyf2E3F/YNoHN2BtBLZ9g3ccaaNnRbobhiCPPE95Dz+I0swSdHynVv/heyNXB\nve6SbzJ08pGCL72CQnqtKrcgfU28elUSwhXqvfdqlS5sdJ/PHLTyxQGjhdByPq1z\nqwubdQxtRbeOlKyWN7Wg0I8VRw7j6IPdj/3vQQF3zCepYoUz8jcI73HPdwbeyBkd\niEDPfUYd/x7H4c7/I9vG+o1VTqkC50cRRj70/b17KSa7qWFiNyi2LSr2EIZkyXCn\n0q23KXB56jzaYyWf/Wi3MOxw+3WKt21gZ7IeyLnp2KhvAotnDU0mV3HaIPzBSlCN\nsSi6\n-----END CERTIFICATE-----\n"
	];
}) });

//#endregion
//#region ../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/index.js
var require_lib = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/aws-ssl-profiles@1.1.2/node_modules/aws-ssl-profiles/lib/index.js": ((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	const defaults_js_1 = require_defaults();
	const proxies_js_1 = require_proxies();
	const proxyBundle = { ca: proxies_js_1.proxies };
	const profiles = { ca: [...defaults_js_1.defaults, ...proxies_js_1.proxies] };
	module.exports = profiles;
	module.exports.proxyBundle = proxyBundle;
	module.exports.default = profiles;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/ssl_profiles.js
var require_ssl_profiles = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/constants/ssl_profiles.js": ((exports) => {
	const awsCaBundle = require_lib();
	/**
	* @deprecated
	* Please, use [**aws-ssl-profiles**](https://github.com/mysqljs/aws-ssl-profiles).
	*/
	exports["Amazon RDS"] = { ca: awsCaBundle.ca };
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/connection_config.js
var require_connection_config = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/connection_config.js": ((exports, module) => {
	const { URL } = __require("url");
	const ClientConstants = require_client();
	const Charsets = require_charsets();
	const { version } = require_package();
	let SSLProfiles = null;
	const validOptions = {
		authPlugins: 1,
		authSwitchHandler: 1,
		bigNumberStrings: 1,
		charset: 1,
		charsetNumber: 1,
		compress: 1,
		connectAttributes: 1,
		connectTimeout: 1,
		database: 1,
		dateStrings: 1,
		debug: 1,
		decimalNumbers: 1,
		enableKeepAlive: 1,
		flags: 1,
		host: 1,
		insecureAuth: 1,
		infileStreamFactory: 1,
		isServer: 1,
		keepAliveInitialDelay: 1,
		localAddress: 1,
		maxPreparedStatements: 1,
		multipleStatements: 1,
		namedPlaceholders: 1,
		nestTables: 1,
		password: 1,
		password1: 1,
		password2: 1,
		password3: 1,
		passwordSha1: 1,
		pool: 1,
		port: 1,
		queryFormat: 1,
		rowsAsArray: 1,
		socketPath: 1,
		ssl: 1,
		stream: 1,
		stringifyObjects: 1,
		supportBigNumbers: 1,
		timezone: 1,
		trace: 1,
		typeCast: 1,
		uri: 1,
		user: 1,
		disableEval: 1,
		connectionLimit: 1,
		maxIdle: 1,
		idleTimeout: 1,
		Promise: 1,
		queueLimit: 1,
		waitForConnections: 1,
		jsonStrings: 1
	};
	var ConnectionConfig$3 = class ConnectionConfig$3 {
		constructor(options) {
			if (typeof options === "string") options = ConnectionConfig$3.parseUrl(options);
			else if (options && options.uri) {
				const uriOptions = ConnectionConfig$3.parseUrl(options.uri);
				for (const key$1 in uriOptions) {
					if (!Object.prototype.hasOwnProperty.call(uriOptions, key$1)) continue;
					if (options[key$1]) continue;
					options[key$1] = uriOptions[key$1];
				}
			}
			for (const key$1 in options) {
				if (!Object.prototype.hasOwnProperty.call(options, key$1)) continue;
				if (validOptions[key$1] !== 1) console.error(`Ignoring invalid configuration option passed to Connection: ${key$1}. This is currently a warning, but in future versions of MySQL2, an error will be thrown if you pass an invalid configuration option to a Connection`);
			}
			this.isServer = options.isServer;
			this.stream = options.stream;
			this.host = options.host || "localhost";
			this.port = (typeof options.port === "string" ? parseInt(options.port, 10) : options.port) || 3306;
			this.localAddress = options.localAddress;
			this.socketPath = options.socketPath;
			this.user = options.user || void 0;
			this.password = options.password || options.password1 || void 0;
			this.password2 = options.password2 || void 0;
			this.password3 = options.password3 || void 0;
			this.passwordSha1 = options.passwordSha1 || void 0;
			this.database = options.database;
			this.connectTimeout = isNaN(options.connectTimeout) ? 10 * 1e3 : options.connectTimeout;
			this.insecureAuth = options.insecureAuth || false;
			this.infileStreamFactory = options.infileStreamFactory || void 0;
			this.supportBigNumbers = options.supportBigNumbers || false;
			this.bigNumberStrings = options.bigNumberStrings || false;
			this.decimalNumbers = options.decimalNumbers || false;
			this.dateStrings = options.dateStrings || false;
			this.debug = options.debug;
			this.trace = options.trace !== false;
			this.stringifyObjects = options.stringifyObjects || false;
			this.enableKeepAlive = options.enableKeepAlive !== false;
			this.keepAliveInitialDelay = options.keepAliveInitialDelay;
			if (options.timezone && !/^(?:local|Z|[ +-]\d\d:\d\d)$/.test(options.timezone)) {
				console.error(`Ignoring invalid timezone passed to Connection: ${options.timezone}. This is currently a warning, but in future versions of MySQL2, an error will be thrown if you pass an invalid configuration option to a Connection`);
				this.timezone = "Z";
			} else this.timezone = options.timezone || "local";
			this.queryFormat = options.queryFormat;
			this.pool = options.pool || void 0;
			this.ssl = typeof options.ssl === "string" ? ConnectionConfig$3.getSSLProfile(options.ssl) : options.ssl || false;
			this.multipleStatements = options.multipleStatements || false;
			this.rowsAsArray = options.rowsAsArray || false;
			this.namedPlaceholders = options.namedPlaceholders || false;
			this.nestTables = options.nestTables === void 0 ? void 0 : options.nestTables;
			this.typeCast = options.typeCast === void 0 ? true : options.typeCast;
			this.disableEval = Boolean(options.disableEval);
			if (this.timezone[0] === " ") this.timezone = `+${this.timezone.slice(1)}`;
			if (this.ssl) {
				if (typeof this.ssl !== "object") throw new TypeError(`SSL profile must be an object, instead it's a ${typeof this.ssl}`);
				this.ssl.rejectUnauthorized = this.ssl.rejectUnauthorized !== false;
			}
			this.maxPacketSize = 0;
			this.charsetNumber = options.charset ? ConnectionConfig$3.getCharsetNumber(options.charset) : options.charsetNumber || Charsets.UTF8MB4_UNICODE_CI;
			this.compress = options.compress || false;
			this.authPlugins = options.authPlugins;
			this.authSwitchHandler = options.authSwitchHandler;
			this.clientFlags = ConnectionConfig$3.mergeFlags(ConnectionConfig$3.getDefaultFlags(options), options.flags || "");
			this.connectAttributes = {
				_client_name: "Node-MySQL-2",
				_client_version: version,
				...options.connectAttributes || {}
			};
			this.maxPreparedStatements = options.maxPreparedStatements || 16e3;
			this.jsonStrings = options.jsonStrings || false;
		}
		static mergeFlags(default_flags, user_flags) {
			let flags = 0, i$4;
			if (!Array.isArray(user_flags)) user_flags = String(user_flags || "").toUpperCase().split(/\s*,+\s*/);
			for (i$4 in default_flags) {
				if (user_flags.indexOf(`-${default_flags[i$4]}`) >= 0) continue;
				flags |= ClientConstants[default_flags[i$4]] || 0;
			}
			for (i$4 in user_flags) {
				if (user_flags[i$4][0] === "-") continue;
				if (default_flags.indexOf(user_flags[i$4]) >= 0) continue;
				flags |= ClientConstants[user_flags[i$4]] || 0;
			}
			return flags;
		}
		static getDefaultFlags(options) {
			const defaultFlags = [
				"LONG_PASSWORD",
				"FOUND_ROWS",
				"LONG_FLAG",
				"CONNECT_WITH_DB",
				"ODBC",
				"LOCAL_FILES",
				"IGNORE_SPACE",
				"PROTOCOL_41",
				"IGNORE_SIGPIPE",
				"TRANSACTIONS",
				"RESERVED",
				"SECURE_CONNECTION",
				"MULTI_RESULTS",
				"TRANSACTIONS",
				"SESSION_TRACK",
				"CONNECT_ATTRS"
			];
			if (options && options.multipleStatements) defaultFlags.push("MULTI_STATEMENTS");
			defaultFlags.push("PLUGIN_AUTH");
			defaultFlags.push("PLUGIN_AUTH_LENENC_CLIENT_DATA");
			return defaultFlags;
		}
		static getCharsetNumber(charset) {
			const num = Charsets[charset.toUpperCase()];
			if (num === void 0) throw new TypeError(`Unknown charset '${charset}'`);
			return num;
		}
		static getSSLProfile(name) {
			if (!SSLProfiles) SSLProfiles = require_ssl_profiles();
			const ssl = SSLProfiles[name];
			if (ssl === void 0) throw new TypeError(`Unknown SSL profile '${name}'`);
			return ssl;
		}
		static parseUrl(url) {
			const parsedUrl = new URL(url);
			const options = {
				host: decodeURIComponent(parsedUrl.hostname),
				port: parseInt(parsedUrl.port, 10),
				database: decodeURIComponent(parsedUrl.pathname.slice(1)),
				user: decodeURIComponent(parsedUrl.username),
				password: decodeURIComponent(parsedUrl.password)
			};
			parsedUrl.searchParams.forEach((value, key$1) => {
				try {
					options[key$1] = JSON.parse(value);
				} catch (err) {
					options[key$1] = value;
				}
			});
			return options;
		}
	};
	module.exports = ConnectionConfig$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/lru-cache@7.18.3/node_modules/lru-cache/index.js
var require_lru_cache = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/lru-cache@7.18.3/node_modules/lru-cache/index.js": ((exports, module) => {
	const perf = typeof performance === "object" && performance && typeof performance.now === "function" ? performance : Date;
	const AC = typeof AbortController === "function" ? AbortController : class AbortController$1 {
		constructor() {
			this.signal = new AS();
		}
		abort(reason = /* @__PURE__ */ new Error("This operation was aborted")) {
			this.signal.reason = this.signal.reason || reason;
			this.signal.aborted = true;
			this.signal.dispatchEvent({
				type: "abort",
				target: this.signal
			});
		}
	};
	const hasAbortSignal = typeof AbortSignal === "function";
	const hasACAbortSignal = typeof AC.AbortSignal === "function";
	const AS = hasAbortSignal ? AbortSignal : hasACAbortSignal ? AC.AbortController : class AbortSignal$1 {
		constructor() {
			this.reason = void 0;
			this.aborted = false;
			this._listeners = [];
		}
		dispatchEvent(e) {
			if (e.type === "abort") {
				this.aborted = true;
				this.onabort(e);
				this._listeners.forEach((f) => f(e), this);
			}
		}
		onabort() {}
		addEventListener(ev, fn) {
			if (ev === "abort") this._listeners.push(fn);
		}
		removeEventListener(ev, fn) {
			if (ev === "abort") this._listeners = this._listeners.filter((f) => f !== fn);
		}
	};
	const warned = /* @__PURE__ */ new Set();
	const deprecatedOption = (opt, instead) => {
		const code = `LRU_CACHE_OPTION_${opt}`;
		if (shouldWarn(code)) warn(code, `${opt} option`, `options.${instead}`, LRUCache);
	};
	const deprecatedMethod = (method, instead) => {
		const code = `LRU_CACHE_METHOD_${method}`;
		if (shouldWarn(code)) {
			const { prototype } = LRUCache;
			const { get } = Object.getOwnPropertyDescriptor(prototype, method);
			warn(code, `${method} method`, `cache.${instead}()`, get);
		}
	};
	const deprecatedProperty = (field, instead) => {
		const code = `LRU_CACHE_PROPERTY_${field}`;
		if (shouldWarn(code)) {
			const { prototype } = LRUCache;
			const { get } = Object.getOwnPropertyDescriptor(prototype, field);
			warn(code, `${field} property`, `cache.${instead}`, get);
		}
	};
	const emitWarning = (...a) => {
		typeof process === "object" && process && typeof process.emitWarning === "function" ? process.emitWarning(...a) : console.error(...a);
	};
	const shouldWarn = (code) => !warned.has(code);
	const warn = (code, what, instead, fn) => {
		warned.add(code);
		emitWarning(`The ${what} is deprecated. Please use ${instead} instead.`, "DeprecationWarning", code, fn);
	};
	const isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
	/* istanbul ignore next - This is a little bit ridiculous, tbh.
	* The maximum array length is 2^32-1 or thereabouts on most JS impls.
	* And well before that point, you're caching the entire world, I mean,
	* that's ~32GB of just integers for the next/prev links, plus whatever
	* else to hold that many keys and values.  Just filling the memory with
	* zeroes at init time is brutal when you get that big.
	* But why not be complete?
	* Maybe in the future, these limits will have expanded. */
	const getUintArray = (max) => !isPosInt(max) ? null : max <= Math.pow(2, 8) ? Uint8Array : max <= Math.pow(2, 16) ? Uint16Array : max <= Math.pow(2, 32) ? Uint32Array : max <= Number.MAX_SAFE_INTEGER ? ZeroArray : null;
	var ZeroArray = class extends Array {
		constructor(size) {
			super(size);
			this.fill(0);
		}
	};
	var Stack = class {
		constructor(max) {
			if (max === 0) return [];
			this.heap = new (getUintArray(max))(max);
			this.length = 0;
		}
		push(n) {
			this.heap[this.length++] = n;
		}
		pop() {
			return this.heap[--this.length];
		}
	};
	var LRUCache = class LRUCache {
		constructor(options = {}) {
			const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, fetchContext, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort } = options;
			const { length, maxAge, stale } = options instanceof LRUCache ? {} : options;
			if (max !== 0 && !isPosInt(max)) throw new TypeError("max option must be a nonnegative integer");
			const UintArray = max ? getUintArray(max) : Array;
			if (!UintArray) throw new Error("invalid max value: " + max);
			this.max = max;
			this.maxSize = maxSize;
			this.maxEntrySize = maxEntrySize || this.maxSize;
			this.sizeCalculation = sizeCalculation || length;
			if (this.sizeCalculation) {
				if (!this.maxSize && !this.maxEntrySize) throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
				if (typeof this.sizeCalculation !== "function") throw new TypeError("sizeCalculation set to non-function");
			}
			this.fetchMethod = fetchMethod || null;
			if (this.fetchMethod && typeof this.fetchMethod !== "function") throw new TypeError("fetchMethod must be a function if specified");
			this.fetchContext = fetchContext;
			if (!this.fetchMethod && fetchContext !== void 0) throw new TypeError("cannot set fetchContext without fetchMethod");
			this.keyMap = /* @__PURE__ */ new Map();
			this.keyList = new Array(max).fill(null);
			this.valList = new Array(max).fill(null);
			this.next = new UintArray(max);
			this.prev = new UintArray(max);
			this.head = 0;
			this.tail = 0;
			this.free = new Stack(max);
			this.initialFill = 1;
			this.size = 0;
			if (typeof dispose === "function") this.dispose = dispose;
			if (typeof disposeAfter === "function") {
				this.disposeAfter = disposeAfter;
				this.disposed = [];
			} else {
				this.disposeAfter = null;
				this.disposed = null;
			}
			this.noDisposeOnSet = !!noDisposeOnSet;
			this.noUpdateTTL = !!noUpdateTTL;
			this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
			this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
			this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
			this.ignoreFetchAbort = !!ignoreFetchAbort;
			if (this.maxEntrySize !== 0) {
				if (this.maxSize !== 0) {
					if (!isPosInt(this.maxSize)) throw new TypeError("maxSize must be a positive integer if specified");
				}
				if (!isPosInt(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified");
				this.initializeSizeTracking();
			}
			this.allowStale = !!allowStale || !!stale;
			this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
			this.updateAgeOnGet = !!updateAgeOnGet;
			this.updateAgeOnHas = !!updateAgeOnHas;
			this.ttlResolution = isPosInt(ttlResolution) || ttlResolution === 0 ? ttlResolution : 1;
			this.ttlAutopurge = !!ttlAutopurge;
			this.ttl = ttl || maxAge || 0;
			if (this.ttl) {
				if (!isPosInt(this.ttl)) throw new TypeError("ttl must be a positive integer if specified");
				this.initializeTTLTracking();
			}
			if (this.max === 0 && this.ttl === 0 && this.maxSize === 0) throw new TypeError("At least one of max, maxSize, or ttl is required");
			if (!this.ttlAutopurge && !this.max && !this.maxSize) {
				const code = "LRU_CACHE_UNBOUNDED";
				if (shouldWarn(code)) {
					warned.add(code);
					emitWarning("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", code, LRUCache);
				}
			}
			if (stale) deprecatedOption("stale", "allowStale");
			if (maxAge) deprecatedOption("maxAge", "ttl");
			if (length) deprecatedOption("length", "sizeCalculation");
		}
		getRemainingTTL(key$1) {
			return this.has(key$1, { updateAgeOnHas: false }) ? Infinity : 0;
		}
		initializeTTLTracking() {
			this.ttls = new ZeroArray(this.max);
			this.starts = new ZeroArray(this.max);
			this.setItemTTL = (index, ttl, start = perf.now()) => {
				this.starts[index] = ttl !== 0 ? start : 0;
				this.ttls[index] = ttl;
				if (ttl !== 0 && this.ttlAutopurge) {
					const t = setTimeout(() => {
						if (this.isStale(index)) this.delete(this.keyList[index]);
					}, ttl + 1);
					/* istanbul ignore else - unref() not supported on all platforms */
					if (t.unref) t.unref();
				}
			};
			this.updateItemAge = (index) => {
				this.starts[index] = this.ttls[index] !== 0 ? perf.now() : 0;
			};
			this.statusTTL = (status, index) => {
				if (status) {
					status.ttl = this.ttls[index];
					status.start = this.starts[index];
					status.now = cachedNow || getNow();
					status.remainingTTL = status.now + status.ttl - status.start;
				}
			};
			let cachedNow = 0;
			const getNow = () => {
				const n = perf.now();
				if (this.ttlResolution > 0) {
					cachedNow = n;
					const t = setTimeout(() => cachedNow = 0, this.ttlResolution);
					/* istanbul ignore else - not available on all platforms */
					if (t.unref) t.unref();
				}
				return n;
			};
			this.getRemainingTTL = (key$1) => {
				const index = this.keyMap.get(key$1);
				if (index === void 0) return 0;
				return this.ttls[index] === 0 || this.starts[index] === 0 ? Infinity : this.starts[index] + this.ttls[index] - (cachedNow || getNow());
			};
			this.isStale = (index) => {
				return this.ttls[index] !== 0 && this.starts[index] !== 0 && (cachedNow || getNow()) - this.starts[index] > this.ttls[index];
			};
		}
		updateItemAge(_index) {}
		statusTTL(_status, _index) {}
		setItemTTL(_index, _ttl, _start) {}
		isStale(_index) {
			return false;
		}
		initializeSizeTracking() {
			this.calculatedSize = 0;
			this.sizes = new ZeroArray(this.max);
			this.removeItemSize = (index) => {
				this.calculatedSize -= this.sizes[index];
				this.sizes[index] = 0;
			};
			this.requireSize = (k, v, size, sizeCalculation) => {
				if (this.isBackgroundFetch(v)) return 0;
				if (!isPosInt(size)) if (sizeCalculation) {
					if (typeof sizeCalculation !== "function") throw new TypeError("sizeCalculation must be a function");
					size = sizeCalculation(v, k);
					if (!isPosInt(size)) throw new TypeError("sizeCalculation return invalid (expect positive integer)");
				} else throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
				return size;
			};
			this.addItemSize = (index, size, status) => {
				this.sizes[index] = size;
				if (this.maxSize) {
					const maxSize = this.maxSize - this.sizes[index];
					while (this.calculatedSize > maxSize) this.evict(true);
				}
				this.calculatedSize += this.sizes[index];
				if (status) {
					status.entrySize = size;
					status.totalCalculatedSize = this.calculatedSize;
				}
			};
		}
		removeItemSize(_index) {}
		addItemSize(_index, _size) {}
		requireSize(_k, _v, size, sizeCalculation) {
			if (size || sizeCalculation) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
		}
		*indexes({ allowStale = this.allowStale } = {}) {
			if (this.size) for (let i$4 = this.tail;;) {
				if (!this.isValidIndex(i$4)) break;
				if (allowStale || !this.isStale(i$4)) yield i$4;
				if (i$4 === this.head) break;
				else i$4 = this.prev[i$4];
			}
		}
		*rindexes({ allowStale = this.allowStale } = {}) {
			if (this.size) for (let i$4 = this.head;;) {
				if (!this.isValidIndex(i$4)) break;
				if (allowStale || !this.isStale(i$4)) yield i$4;
				if (i$4 === this.tail) break;
				else i$4 = this.next[i$4];
			}
		}
		isValidIndex(index) {
			return index !== void 0 && this.keyMap.get(this.keyList[index]) === index;
		}
		*entries() {
			for (const i$4 of this.indexes()) if (this.valList[i$4] !== void 0 && this.keyList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield [this.keyList[i$4], this.valList[i$4]];
		}
		*rentries() {
			for (const i$4 of this.rindexes()) if (this.valList[i$4] !== void 0 && this.keyList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield [this.keyList[i$4], this.valList[i$4]];
		}
		*keys() {
			for (const i$4 of this.indexes()) if (this.keyList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield this.keyList[i$4];
		}
		*rkeys() {
			for (const i$4 of this.rindexes()) if (this.keyList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield this.keyList[i$4];
		}
		*values() {
			for (const i$4 of this.indexes()) if (this.valList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield this.valList[i$4];
		}
		*rvalues() {
			for (const i$4 of this.rindexes()) if (this.valList[i$4] !== void 0 && !this.isBackgroundFetch(this.valList[i$4])) yield this.valList[i$4];
		}
		[Symbol.iterator]() {
			return this.entries();
		}
		find(fn, getOptions) {
			for (const i$4 of this.indexes()) {
				const v = this.valList[i$4];
				const value = this.isBackgroundFetch(v) ? v.__staleWhileFetching : v;
				if (value === void 0) continue;
				if (fn(value, this.keyList[i$4], this)) return this.get(this.keyList[i$4], getOptions);
			}
		}
		forEach(fn, thisp = this) {
			for (const i$4 of this.indexes()) {
				const v = this.valList[i$4];
				const value = this.isBackgroundFetch(v) ? v.__staleWhileFetching : v;
				if (value === void 0) continue;
				fn.call(thisp, value, this.keyList[i$4], this);
			}
		}
		rforEach(fn, thisp = this) {
			for (const i$4 of this.rindexes()) {
				const v = this.valList[i$4];
				const value = this.isBackgroundFetch(v) ? v.__staleWhileFetching : v;
				if (value === void 0) continue;
				fn.call(thisp, value, this.keyList[i$4], this);
			}
		}
		get prune() {
			deprecatedMethod("prune", "purgeStale");
			return this.purgeStale;
		}
		purgeStale() {
			let deleted = false;
			for (const i$4 of this.rindexes({ allowStale: true })) if (this.isStale(i$4)) {
				this.delete(this.keyList[i$4]);
				deleted = true;
			}
			return deleted;
		}
		dump() {
			const arr = [];
			for (const i$4 of this.indexes({ allowStale: true })) {
				const key$1 = this.keyList[i$4];
				const v = this.valList[i$4];
				const value = this.isBackgroundFetch(v) ? v.__staleWhileFetching : v;
				if (value === void 0) continue;
				const entry = { value };
				if (this.ttls) {
					entry.ttl = this.ttls[i$4];
					const age = perf.now() - this.starts[i$4];
					entry.start = Math.floor(Date.now() - age);
				}
				if (this.sizes) entry.size = this.sizes[i$4];
				arr.unshift([key$1, entry]);
			}
			return arr;
		}
		load(arr) {
			this.clear();
			for (const [key$1, entry] of arr) {
				if (entry.start) {
					const age = Date.now() - entry.start;
					entry.start = perf.now() - age;
				}
				this.set(key$1, entry.value, entry);
			}
		}
		dispose(_v, _k, _reason) {}
		set(k, v, { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, size = 0, sizeCalculation = this.sizeCalculation, noUpdateTTL = this.noUpdateTTL, status } = {}) {
			size = this.requireSize(k, v, size, sizeCalculation);
			if (this.maxEntrySize && size > this.maxEntrySize) {
				if (status) {
					status.set = "miss";
					status.maxEntrySizeExceeded = true;
				}
				this.delete(k);
				return this;
			}
			let index = this.size === 0 ? void 0 : this.keyMap.get(k);
			if (index === void 0) {
				index = this.newIndex();
				this.keyList[index] = k;
				this.valList[index] = v;
				this.keyMap.set(k, index);
				this.next[this.tail] = index;
				this.prev[index] = this.tail;
				this.tail = index;
				this.size++;
				this.addItemSize(index, size, status);
				if (status) status.set = "add";
				noUpdateTTL = false;
			} else {
				this.moveToTail(index);
				const oldVal = this.valList[index];
				if (v !== oldVal) {
					if (this.isBackgroundFetch(oldVal)) oldVal.__abortController.abort(/* @__PURE__ */ new Error("replaced"));
					else if (!noDisposeOnSet) {
						this.dispose(oldVal, k, "set");
						if (this.disposeAfter) this.disposed.push([
							oldVal,
							k,
							"set"
						]);
					}
					this.removeItemSize(index);
					this.valList[index] = v;
					this.addItemSize(index, size, status);
					if (status) {
						status.set = "replace";
						const oldValue = oldVal && this.isBackgroundFetch(oldVal) ? oldVal.__staleWhileFetching : oldVal;
						if (oldValue !== void 0) status.oldValue = oldValue;
					}
				} else if (status) status.set = "update";
			}
			if (ttl !== 0 && this.ttl === 0 && !this.ttls) this.initializeTTLTracking();
			if (!noUpdateTTL) this.setItemTTL(index, ttl, start);
			this.statusTTL(status, index);
			if (this.disposeAfter) while (this.disposed.length) this.disposeAfter(...this.disposed.shift());
			return this;
		}
		newIndex() {
			if (this.size === 0) return this.tail;
			if (this.size === this.max && this.max !== 0) return this.evict(false);
			if (this.free.length !== 0) return this.free.pop();
			return this.initialFill++;
		}
		pop() {
			if (this.size) {
				const val = this.valList[this.head];
				this.evict(true);
				return val;
			}
		}
		evict(free) {
			const head = this.head;
			const k = this.keyList[head];
			const v = this.valList[head];
			if (this.isBackgroundFetch(v)) v.__abortController.abort(/* @__PURE__ */ new Error("evicted"));
			else {
				this.dispose(v, k, "evict");
				if (this.disposeAfter) this.disposed.push([
					v,
					k,
					"evict"
				]);
			}
			this.removeItemSize(head);
			if (free) {
				this.keyList[head] = null;
				this.valList[head] = null;
				this.free.push(head);
			}
			this.head = this.next[head];
			this.keyMap.delete(k);
			this.size--;
			return head;
		}
		has(k, { updateAgeOnHas = this.updateAgeOnHas, status } = {}) {
			const index = this.keyMap.get(k);
			if (index !== void 0) {
				if (!this.isStale(index)) {
					if (updateAgeOnHas) this.updateItemAge(index);
					if (status) status.has = "hit";
					this.statusTTL(status, index);
					return true;
				} else if (status) {
					status.has = "stale";
					this.statusTTL(status, index);
				}
			} else if (status) status.has = "miss";
			return false;
		}
		peek(k, { allowStale = this.allowStale } = {}) {
			const index = this.keyMap.get(k);
			if (index !== void 0 && (allowStale || !this.isStale(index))) {
				const v = this.valList[index];
				return this.isBackgroundFetch(v) ? v.__staleWhileFetching : v;
			}
		}
		backgroundFetch(k, index, options, context) {
			const v = index === void 0 ? void 0 : this.valList[index];
			if (this.isBackgroundFetch(v)) return v;
			const ac = new AC();
			if (options.signal) options.signal.addEventListener("abort", () => ac.abort(options.signal.reason));
			const fetchOpts = {
				signal: ac.signal,
				options,
				context
			};
			const cb = (v$1, updateCache = false) => {
				const { aborted } = ac.signal;
				const ignoreAbort = options.ignoreFetchAbort && v$1 !== void 0;
				if (options.status) if (aborted && !updateCache) {
					options.status.fetchAborted = true;
					options.status.fetchError = ac.signal.reason;
					if (ignoreAbort) options.status.fetchAbortIgnored = true;
				} else options.status.fetchResolved = true;
				if (aborted && !ignoreAbort && !updateCache) return fetchFail(ac.signal.reason);
				if (this.valList[index] === p) if (v$1 === void 0) if (p.__staleWhileFetching) this.valList[index] = p.__staleWhileFetching;
				else this.delete(k);
				else {
					if (options.status) options.status.fetchUpdated = true;
					this.set(k, v$1, fetchOpts.options);
				}
				return v$1;
			};
			const eb = (er) => {
				if (options.status) {
					options.status.fetchRejected = true;
					options.status.fetchError = er;
				}
				return fetchFail(er);
			};
			const fetchFail = (er) => {
				const { aborted } = ac.signal;
				const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
				const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
				const noDelete = allowStale || options.noDeleteOnFetchRejection;
				if (this.valList[index] === p) {
					if (!noDelete || p.__staleWhileFetching === void 0) this.delete(k);
					else if (!allowStaleAborted) this.valList[index] = p.__staleWhileFetching;
				}
				if (allowStale) {
					if (options.status && p.__staleWhileFetching !== void 0) options.status.returnedStale = true;
					return p.__staleWhileFetching;
				} else if (p.__returned === p) throw er;
			};
			const pcall = (res, rej) => {
				this.fetchMethod(k, v, fetchOpts).then((v$1) => res(v$1), rej);
				ac.signal.addEventListener("abort", () => {
					if (!options.ignoreFetchAbort || options.allowStaleOnFetchAbort) {
						res();
						if (options.allowStaleOnFetchAbort) res = (v$1) => cb(v$1, true);
					}
				});
			};
			if (options.status) options.status.fetchDispatched = true;
			const p = new Promise(pcall).then(cb, eb);
			p.__abortController = ac;
			p.__staleWhileFetching = v;
			p.__returned = null;
			if (index === void 0) {
				this.set(k, p, {
					...fetchOpts.options,
					status: void 0
				});
				index = this.keyMap.get(k);
			} else this.valList[index] = p;
			return p;
		}
		isBackgroundFetch(p) {
			return p && typeof p === "object" && typeof p.then === "function" && Object.prototype.hasOwnProperty.call(p, "__staleWhileFetching") && Object.prototype.hasOwnProperty.call(p, "__returned") && (p.__returned === p || p.__returned === null);
		}
		async fetch(k, { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, ttl = this.ttl, noDisposeOnSet = this.noDisposeOnSet, size = 0, sizeCalculation = this.sizeCalculation, noUpdateTTL = this.noUpdateTTL, noDeleteOnFetchRejection = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection = this.allowStaleOnFetchRejection, ignoreFetchAbort = this.ignoreFetchAbort, allowStaleOnFetchAbort = this.allowStaleOnFetchAbort, fetchContext = this.fetchContext, forceRefresh = false, status, signal } = {}) {
			if (!this.fetchMethod) {
				if (status) status.fetch = "get";
				return this.get(k, {
					allowStale,
					updateAgeOnGet,
					noDeleteOnStaleGet,
					status
				});
			}
			const options = {
				allowStale,
				updateAgeOnGet,
				noDeleteOnStaleGet,
				ttl,
				noDisposeOnSet,
				size,
				sizeCalculation,
				noUpdateTTL,
				noDeleteOnFetchRejection,
				allowStaleOnFetchRejection,
				allowStaleOnFetchAbort,
				ignoreFetchAbort,
				status,
				signal
			};
			let index = this.keyMap.get(k);
			if (index === void 0) {
				if (status) status.fetch = "miss";
				const p = this.backgroundFetch(k, index, options, fetchContext);
				return p.__returned = p;
			} else {
				const v = this.valList[index];
				if (this.isBackgroundFetch(v)) {
					const stale = allowStale && v.__staleWhileFetching !== void 0;
					if (status) {
						status.fetch = "inflight";
						if (stale) status.returnedStale = true;
					}
					return stale ? v.__staleWhileFetching : v.__returned = v;
				}
				const isStale = this.isStale(index);
				if (!forceRefresh && !isStale) {
					if (status) status.fetch = "hit";
					this.moveToTail(index);
					if (updateAgeOnGet) this.updateItemAge(index);
					this.statusTTL(status, index);
					return v;
				}
				const p = this.backgroundFetch(k, index, options, fetchContext);
				const hasStale = p.__staleWhileFetching !== void 0;
				const staleVal = hasStale && allowStale;
				if (status) {
					status.fetch = hasStale && isStale ? "stale" : "refresh";
					if (staleVal && isStale) status.returnedStale = true;
				}
				return staleVal ? p.__staleWhileFetching : p.__returned = p;
			}
		}
		get(k, { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status } = {}) {
			const index = this.keyMap.get(k);
			if (index !== void 0) {
				const value = this.valList[index];
				const fetching = this.isBackgroundFetch(value);
				this.statusTTL(status, index);
				if (this.isStale(index)) {
					if (status) status.get = "stale";
					if (!fetching) {
						if (!noDeleteOnStaleGet) this.delete(k);
						if (status) status.returnedStale = allowStale;
						return allowStale ? value : void 0;
					} else {
						if (status) status.returnedStale = allowStale && value.__staleWhileFetching !== void 0;
						return allowStale ? value.__staleWhileFetching : void 0;
					}
				} else {
					if (status) status.get = "hit";
					if (fetching) return value.__staleWhileFetching;
					this.moveToTail(index);
					if (updateAgeOnGet) this.updateItemAge(index);
					return value;
				}
			} else if (status) status.get = "miss";
		}
		connect(p, n) {
			this.prev[n] = p;
			this.next[p] = n;
		}
		moveToTail(index) {
			if (index !== this.tail) {
				if (index === this.head) this.head = this.next[index];
				else this.connect(this.prev[index], this.next[index]);
				this.connect(this.tail, index);
				this.tail = index;
			}
		}
		get del() {
			deprecatedMethod("del", "delete");
			return this.delete;
		}
		delete(k) {
			let deleted = false;
			if (this.size !== 0) {
				const index = this.keyMap.get(k);
				if (index !== void 0) {
					deleted = true;
					if (this.size === 1) this.clear();
					else {
						this.removeItemSize(index);
						const v = this.valList[index];
						if (this.isBackgroundFetch(v)) v.__abortController.abort(/* @__PURE__ */ new Error("deleted"));
						else {
							this.dispose(v, k, "delete");
							if (this.disposeAfter) this.disposed.push([
								v,
								k,
								"delete"
							]);
						}
						this.keyMap.delete(k);
						this.keyList[index] = null;
						this.valList[index] = null;
						if (index === this.tail) this.tail = this.prev[index];
						else if (index === this.head) this.head = this.next[index];
						else {
							this.next[this.prev[index]] = this.next[index];
							this.prev[this.next[index]] = this.prev[index];
						}
						this.size--;
						this.free.push(index);
					}
				}
			}
			if (this.disposed) while (this.disposed.length) this.disposeAfter(...this.disposed.shift());
			return deleted;
		}
		clear() {
			for (const index of this.rindexes({ allowStale: true })) {
				const v = this.valList[index];
				if (this.isBackgroundFetch(v)) v.__abortController.abort(/* @__PURE__ */ new Error("deleted"));
				else {
					const k = this.keyList[index];
					this.dispose(v, k, "delete");
					if (this.disposeAfter) this.disposed.push([
						v,
						k,
						"delete"
					]);
				}
			}
			this.keyMap.clear();
			this.valList.fill(null);
			this.keyList.fill(null);
			if (this.ttls) {
				this.ttls.fill(0);
				this.starts.fill(0);
			}
			if (this.sizes) this.sizes.fill(0);
			this.head = 0;
			this.tail = 0;
			this.initialFill = 1;
			this.free.length = 0;
			this.calculatedSize = 0;
			this.size = 0;
			if (this.disposed) while (this.disposed.length) this.disposeAfter(...this.disposed.shift());
		}
		get reset() {
			deprecatedMethod("reset", "clear");
			return this.clear;
		}
		get length() {
			deprecatedProperty("length", "size");
			return this.size;
		}
		static get AbortController() {
			return AC;
		}
		static get AbortSignal() {
			return AS;
		}
	};
	module.exports = LRUCache;
}) });

//#endregion
//#region ../../node_modules/.pnpm/named-placeholders@1.1.3/node_modules/named-placeholders/index.js
var require_named_placeholders = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/named-placeholders@1.1.3/node_modules/named-placeholders/index.js": ((exports, module) => {
	const RE_PARAM = /(?:\?)|(?::(\d+|(?:[a-zA-Z][a-zA-Z0-9_]*)))/g, DQUOTE = 34, SQUOTE = 39, BSLASH = 92;
	function parse(query) {
		let ppos = RE_PARAM.exec(query);
		let curpos = 0;
		let start = 0;
		let end;
		const parts = [];
		let inQuote = false;
		let escape = false;
		let qchr;
		const tokens = [];
		let qcnt = 0;
		let lastTokenEndPos = 0;
		let i$4;
		if (ppos) {
			do {
				for (i$4 = curpos, end = ppos.index; i$4 < end; ++i$4) {
					let chr = query.charCodeAt(i$4);
					if (chr === BSLASH) escape = !escape;
					else {
						if (escape) {
							escape = false;
							continue;
						}
						if (inQuote && chr === qchr) {
							if (query.charCodeAt(i$4 + 1) === qchr) {
								++i$4;
								continue;
							}
							inQuote = false;
						} else if (chr === DQUOTE || chr === SQUOTE) {
							inQuote = true;
							qchr = chr;
						}
					}
				}
				if (!inQuote) {
					parts.push(query.substring(start, end));
					tokens.push(ppos[0].length === 1 ? qcnt++ : ppos[1]);
					start = end + ppos[0].length;
					lastTokenEndPos = start;
				}
				curpos = end + ppos[0].length;
			} while (ppos = RE_PARAM.exec(query));
			if (tokens.length) {
				if (curpos < query.length) parts.push(query.substring(lastTokenEndPos));
				return [parts, tokens];
			}
		}
		return [query];
	}
	function createCompiler(config) {
		if (!config) config = {};
		if (!config.placeholder) config.placeholder = "?";
		let ncache = 100;
		let cache;
		if (typeof config.cache === "number") ncache = config.cache;
		if (typeof config.cache === "object") cache = config.cache;
		if (config.cache !== false && !cache) cache = new (require_lru_cache())({ max: ncache });
		function toArrayParams(tree, params) {
			const arr = [];
			if (tree.length == 1) return [tree[0], []];
			if (typeof params == "undefined") throw new Error("Named query contains placeholders, but parameters object is undefined");
			const tokens = tree[1];
			for (let i$4 = 0; i$4 < tokens.length; ++i$4) arr.push(params[tokens[i$4]]);
			return [tree[0], arr];
		}
		function noTailingSemicolon(s) {
			if (s.slice(-1) == ":") return s.slice(0, -1);
			return s;
		}
		function join(tree) {
			if (tree.length == 1) return tree;
			let unnamed = noTailingSemicolon(tree[0][0]);
			for (let i$4 = 1; i$4 < tree[0].length; ++i$4) {
				if (tree[0][i$4 - 1].slice(-1) == ":") unnamed += config.placeholder;
				unnamed += config.placeholder;
				unnamed += noTailingSemicolon(tree[0][i$4]);
			}
			const last = tree[0][tree[0].length - 1];
			if (tree[0].length == tree[1].length) {
				if (last.slice(-1) == ":") unnamed += config.placeholder;
				unnamed += config.placeholder;
			}
			return [unnamed, tree[1]];
		}
		function compile$2(query, paramsObj) {
			let tree;
			if (cache && (tree = cache.get(query))) return toArrayParams(tree, paramsObj);
			tree = join(parse(query));
			if (cache) cache.set(query, tree);
			return toArrayParams(tree, paramsObj);
		}
		compile$2.parse = parse;
		return compile$2;
	}
	function toNumbered(q, params) {
		const tree = parse(q);
		const paramsArr = [];
		if (tree.length == 1) return [tree[0], paramsArr];
		const pIndexes = {};
		let pLastIndex = 0;
		let qs = "";
		let varIndex;
		const varNames = [];
		for (let i$4 = 0; i$4 < tree[0].length; ++i$4) {
			varIndex = pIndexes[tree[1][i$4]];
			if (!varIndex) {
				varIndex = ++pLastIndex;
				pIndexes[tree[1][i$4]] = varIndex;
			}
			if (tree[1][i$4]) {
				varNames[varIndex - 1] = tree[1][i$4];
				qs += tree[0][i$4] + "$" + varIndex;
			} else qs += tree[0][i$4];
		}
		return [qs, varNames.map((n) => params[n])];
	}
	module.exports = createCompiler;
	module.exports.toNumbered = toNumbered;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/connection.js
var require_connection$2 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/connection.js": ((exports, module) => {
	const Net = __require("net");
	const Tls = __require("tls");
	const Timers = __require("timers");
	const EventEmitter$5 = __require("events").EventEmitter;
	const Readable = __require("stream").Readable;
	const Queue$1 = require_denque();
	const SqlString$2 = require_sqlstring();
	const { createLRU } = require_lib$2();
	const PacketParser = require_packet_parser();
	const Packets = require_packets();
	const Commands = require_commands();
	const ConnectionConfig$2 = require_connection_config();
	const CharsetToEncoding = require_charset_encodings();
	let _connectionId = 0;
	let convertNamedPlaceholders = null;
	var BaseConnection$4 = class BaseConnection$4 extends EventEmitter$5 {
		constructor(opts) {
			super();
			this.config = opts.config;
			if (!opts.config.stream) if (opts.config.socketPath) this.stream = Net.connect(opts.config.socketPath);
			else {
				this.stream = Net.connect(opts.config.port, opts.config.host);
				if (this.config.enableKeepAlive) this.stream.on("connect", () => {
					this.stream.setKeepAlive(true, this.config.keepAliveInitialDelay);
				});
				this.stream.setNoDelay(true);
			}
			else if (typeof opts.config.stream === "function") this.stream = opts.config.stream(opts);
			else this.stream = opts.config.stream;
			this._internalId = _connectionId++;
			this._commands = new Queue$1();
			this._command = null;
			this._paused = false;
			this._paused_packets = new Queue$1();
			this._statements = createLRU({
				max: this.config.maxPreparedStatements,
				onEviction: function(_, statement) {
					statement.close();
				}
			});
			this.serverCapabilityFlags = 0;
			this.authorized = false;
			this.sequenceId = 0;
			this.compressedSequenceId = 0;
			this.threadId = null;
			this._handshakePacket = null;
			this._fatalError = null;
			this._protocolError = null;
			this._outOfOrderPackets = [];
			this.clientEncoding = CharsetToEncoding[this.config.charsetNumber];
			this.stream.on("error", this._handleNetworkError.bind(this));
			this.packetParser = new PacketParser((p) => {
				this.handlePacket(p);
			});
			this.stream.on("data", (data) => {
				if (this.connectTimeout) {
					Timers.clearTimeout(this.connectTimeout);
					this.connectTimeout = null;
				}
				this.packetParser.execute(data);
			});
			this.stream.on("end", () => {
				this.emit("end");
			});
			this.stream.on("close", () => {
				if (this._closing) return;
				if (!this._protocolError) {
					this._protocolError = /* @__PURE__ */ new Error("Connection lost: The server closed the connection.");
					this._protocolError.fatal = true;
					this._protocolError.code = "PROTOCOL_CONNECTION_LOST";
				}
				this._notifyError(this._protocolError);
			});
			let handshakeCommand;
			if (!this.config.isServer) {
				handshakeCommand = new Commands.ClientHandshake(this.config.clientFlags);
				handshakeCommand.on("end", () => {
					if (!handshakeCommand.handshake || this._fatalError || this._protocolError) return;
					this._handshakePacket = handshakeCommand.handshake;
					this.threadId = handshakeCommand.handshake.connectionId;
					this.emit("connect", handshakeCommand.handshake);
				});
				handshakeCommand.on("error", (err) => {
					this._closing = true;
					this._notifyError(err);
				});
				this.addCommand(handshakeCommand);
			}
			this.serverEncoding = "utf8";
			if (this.config.connectTimeout) {
				const timeoutHandler = this._handleTimeoutError.bind(this);
				this.connectTimeout = Timers.setTimeout(timeoutHandler, this.config.connectTimeout);
			}
		}
		_addCommandClosedState(cmd) {
			const err = /* @__PURE__ */ new Error("Can't add new command when connection is in closed state");
			err.fatal = true;
			if (cmd.onResult) cmd.onResult(err);
			else this.emit("error", err);
		}
		_handleFatalError(err) {
			err.fatal = true;
			this.stream.removeAllListeners("data");
			this.addCommand = this._addCommandClosedState;
			this.write = () => {
				this.emit("error", /* @__PURE__ */ new Error("Can't write in closed state"));
			};
			this._notifyError(err);
			this._fatalError = err;
		}
		_handleNetworkError(err) {
			if (this.connectTimeout) {
				Timers.clearTimeout(this.connectTimeout);
				this.connectTimeout = null;
			}
			if (err.code === "ECONNRESET" && this._closing) return;
			this._handleFatalError(err);
		}
		_handleTimeoutError() {
			if (this.connectTimeout) {
				Timers.clearTimeout(this.connectTimeout);
				this.connectTimeout = null;
			}
			this.stream.destroy && this.stream.destroy();
			const err = /* @__PURE__ */ new Error("connect ETIMEDOUT");
			err.errorno = "ETIMEDOUT";
			err.code = "ETIMEDOUT";
			err.syscall = "connect";
			this._handleNetworkError(err);
		}
		_notifyError(err) {
			if (this.connectTimeout) {
				Timers.clearTimeout(this.connectTimeout);
				this.connectTimeout = null;
			}
			if (this._fatalError) return;
			let command;
			let bubbleErrorToConnection = !this._command;
			if (this._command && this._command.onResult) {
				this._command.onResult(err);
				this._command = null;
			} else if (!(this._command && this._command.constructor === Commands.ClientHandshake && this._commands.length > 0)) bubbleErrorToConnection = true;
			while (command = this._commands.shift()) if (command.onResult) command.onResult(err);
			else bubbleErrorToConnection = true;
			if (bubbleErrorToConnection || this._pool) this.emit("error", err);
			if (err.fatal) this.close();
		}
		write(buffer$1) {
			if (!this.stream.write(buffer$1, (err) => {
				if (err) this._handleNetworkError(err);
			})) this.stream.emit("pause");
		}
		_resetSequenceId() {
			this.sequenceId = 0;
			this.compressedSequenceId = 0;
		}
		_bumpCompressedSequenceId(numPackets) {
			this.compressedSequenceId += numPackets;
			this.compressedSequenceId %= 256;
		}
		_bumpSequenceId(numPackets) {
			this.sequenceId += numPackets;
			this.sequenceId %= 256;
		}
		writePacket(packet) {
			const MAX_PACKET_LENGTH$1 = 16777215;
			const length = packet.length();
			let chunk, offset, header;
			if (length < MAX_PACKET_LENGTH$1) {
				packet.writeHeader(this.sequenceId);
				if (this.config.debug) {
					console.log(`${this._internalId} ${this.connectionId} <== ${this._command._commandName}#${this._command.stateName()}(${[
						this.sequenceId,
						packet._name,
						packet.length()
					].join(",")})`);
					console.log(`${this._internalId} ${this.connectionId} <== ${packet.buffer.toString("hex")}`);
				}
				this._bumpSequenceId(1);
				this.write(packet.buffer);
			} else {
				if (this.config.debug) {
					console.log(`${this._internalId} ${this.connectionId} <== Writing large packet, raw content not written:`);
					console.log(`${this._internalId} ${this.connectionId} <== ${this._command._commandName}#${this._command.stateName()}(${[
						this.sequenceId,
						packet._name,
						packet.length()
					].join(",")})`);
				}
				for (offset = 4; offset < 4 + length; offset += MAX_PACKET_LENGTH$1) {
					chunk = packet.buffer.slice(offset, offset + MAX_PACKET_LENGTH$1);
					if (chunk.length === MAX_PACKET_LENGTH$1) header = Buffer.from([
						255,
						255,
						255,
						this.sequenceId
					]);
					else header = Buffer.from([
						chunk.length & 255,
						chunk.length >> 8 & 255,
						chunk.length >> 16 & 255,
						this.sequenceId
					]);
					this._bumpSequenceId(1);
					this.write(header);
					this.write(chunk);
				}
			}
		}
		startTLS(onSecure) {
			if (this.config.debug) console.log("Upgrading connection to TLS");
			const secureContext = Tls.createSecureContext({
				ca: this.config.ssl.ca,
				cert: this.config.ssl.cert,
				ciphers: this.config.ssl.ciphers,
				key: this.config.ssl.key,
				passphrase: this.config.ssl.passphrase,
				minVersion: this.config.ssl.minVersion,
				maxVersion: this.config.ssl.maxVersion
			});
			const rejectUnauthorized = this.config.ssl.rejectUnauthorized;
			const verifyIdentity = this.config.ssl.verifyIdentity;
			const servername = this.config.host;
			let secureEstablished = false;
			this.stream.removeAllListeners("data");
			const secureSocket = Tls.connect({
				rejectUnauthorized,
				requestCert: rejectUnauthorized,
				checkServerIdentity: verifyIdentity ? Tls.checkServerIdentity : function() {},
				secureContext,
				isServer: false,
				socket: this.stream,
				servername
			}, () => {
				secureEstablished = true;
				if (rejectUnauthorized) {
					if (typeof servername === "string" && verifyIdentity) {
						const cert = secureSocket.getPeerCertificate(true);
						const serverIdentityCheckError = Tls.checkServerIdentity(servername, cert);
						if (serverIdentityCheckError) {
							onSecure(serverIdentityCheckError);
							return;
						}
					}
				}
				onSecure();
			});
			secureSocket.on("error", (err) => {
				if (secureEstablished) this._handleNetworkError(err);
				else onSecure(err);
			});
			secureSocket.on("data", (data) => {
				this.packetParser.execute(data);
			});
			this.stream = secureSocket;
		}
		protocolError(message, code) {
			if (this._closing) return;
			const err = new Error(message);
			err.fatal = true;
			err.code = code || "PROTOCOL_ERROR";
			this.emit("error", err);
		}
		get fatalError() {
			return this._fatalError;
		}
		handlePacket(packet) {
			if (this._paused) {
				this._paused_packets.push(packet);
				return;
			}
			if (this.config.debug) {
				if (packet) {
					console.log(` raw: ${packet.buffer.slice(packet.offset, packet.offset + packet.length()).toString("hex")}`);
					console.trace();
					const commandName = this._command ? this._command._commandName : "(no command)";
					const stateName = this._command ? this._command.stateName() : "(no command)";
					console.log(`${this._internalId} ${this.connectionId} ==> ${commandName}#${stateName}(${[
						packet.sequenceId,
						packet.type(),
						packet.length()
					].join(",")})`);
				}
			}
			if (!this._command) {
				if (packet.peekByte() === 255) {
					const error = Packets.Error.fromPacket(packet);
					this.protocolError(error.message, error.code);
				} else this.protocolError("Unexpected packet while no commands in the queue", "PROTOCOL_UNEXPECTED_PACKET");
				this.close();
				return;
			}
			if (packet) {
				if (this.sequenceId !== packet.sequenceId) {
					const err = /* @__PURE__ */ new Error(`Warning: got packets out of order. Expected ${this.sequenceId} but received ${packet.sequenceId}`);
					err.expected = this.sequenceId;
					err.received = packet.sequenceId;
					this.emit("warn", err);
					console.error(err.message);
				}
				this._bumpSequenceId(packet.numPackets);
			}
			try {
				if (this._fatalError) return;
				if (this._command.execute(packet, this)) {
					this._command = this._commands.shift();
					if (this._command) {
						this.sequenceId = 0;
						this.compressedSequenceId = 0;
						this.handlePacket();
					}
				}
			} catch (err) {
				this._handleFatalError(err);
				this.stream.destroy();
			}
		}
		addCommand(cmd) {
			if (this.config.debug) {
				const commandName = cmd.constructor.name;
				console.log(`Add command: ${commandName}`);
				cmd._commandName = commandName;
			}
			if (!this._command) {
				this._command = cmd;
				this.handlePacket();
			} else this._commands.push(cmd);
			return cmd;
		}
		format(sql, values) {
			if (typeof this.config.queryFormat === "function") return this.config.queryFormat.call(this, sql, values, this.config.timezone);
			const opts = {
				sql,
				values
			};
			this._resolveNamedPlaceholders(opts);
			return SqlString$2.format(opts.sql, opts.values, this.config.stringifyObjects, this.config.timezone);
		}
		escape(value) {
			return SqlString$2.escape(value, false, this.config.timezone);
		}
		escapeId(value) {
			return SqlString$2.escapeId(value, false);
		}
		raw(sql) {
			return SqlString$2.raw(sql);
		}
		_resolveNamedPlaceholders(options) {
			let unnamed;
			if (this.config.namedPlaceholders || options.namedPlaceholders) {
				if (Array.isArray(options.values)) return;
				if (convertNamedPlaceholders === null) convertNamedPlaceholders = require_named_placeholders()();
				unnamed = convertNamedPlaceholders(options.sql, options.values);
				options.sql = unnamed[0];
				options.values = unnamed[1];
			}
		}
		query(sql, values, cb) {
			let cmdQuery;
			if (sql.constructor === Commands.Query) cmdQuery = sql;
			else cmdQuery = BaseConnection$4.createQuery(sql, values, cb, this.config);
			this._resolveNamedPlaceholders(cmdQuery);
			cmdQuery.sql = this.format(cmdQuery.sql, cmdQuery.values !== void 0 ? cmdQuery.values : []);
			return this.addCommand(cmdQuery);
		}
		pause() {
			this._paused = true;
			this.stream.pause();
		}
		resume() {
			let packet;
			this._paused = false;
			while (packet = this._paused_packets.shift()) {
				this.handlePacket(packet);
				if (this._paused) return;
			}
			this.stream.resume();
		}
		prepare(options, cb) {
			if (typeof options === "string") options = { sql: options };
			return this.addCommand(new Commands.Prepare(options, cb));
		}
		unprepare(sql) {
			let options = {};
			if (typeof sql === "object") options = sql;
			else options.sql = sql;
			const key$1 = BaseConnection$4.statementKey(options);
			const stmt = this._statements.get(key$1);
			if (stmt) {
				this._statements.delete(key$1);
				stmt.close();
			}
			return stmt;
		}
		execute(sql, values, cb) {
			let options = { infileStreamFactory: this.config.infileStreamFactory };
			if (typeof sql === "object") {
				options = {
					...options,
					...sql,
					sql: sql.sql,
					values: sql.values
				};
				if (typeof values === "function") cb = values;
				else options.values = options.values || values;
			} else if (typeof values === "function") {
				cb = values;
				options.sql = sql;
				options.values = void 0;
			} else {
				options.sql = sql;
				options.values = values;
			}
			this._resolveNamedPlaceholders(options);
			if (options.values) {
				if (!Array.isArray(options.values)) throw new TypeError("Bind parameters must be array if namedPlaceholders parameter is not enabled");
				options.values.forEach((val) => {
					if (!Array.isArray(options.values)) throw new TypeError("Bind parameters must be array if namedPlaceholders parameter is not enabled");
					if (val === void 0) throw new TypeError("Bind parameters must not contain undefined. To pass SQL NULL specify JS null");
					if (typeof val === "function") throw new TypeError("Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first");
				});
			}
			const executeCommand = new Commands.Execute(options, cb);
			const prepareCommand = new Commands.Prepare(options, (err, stmt) => {
				if (err) {
					executeCommand.start = function() {
						return null;
					};
					if (cb) cb(err);
					else executeCommand.emit("error", err);
					executeCommand.emit("end");
					return;
				}
				executeCommand.statement = stmt;
			});
			this.addCommand(prepareCommand);
			this.addCommand(executeCommand);
			return executeCommand;
		}
		changeUser(options, callback) {
			if (!callback && typeof options === "function") {
				callback = options;
				options = {};
			}
			const charsetNumber = options.charset ? ConnectionConfig$2.getCharsetNumber(options.charset) : this.config.charsetNumber;
			return this.addCommand(new Commands.ChangeUser({
				user: options.user || this.config.user,
				password: options.password || options.password1 || this.config.password || this.config.password1,
				password2: options.password2 || this.config.password2,
				password3: options.password3 || this.config.password3,
				passwordSha1: options.passwordSha1 || this.config.passwordSha1,
				database: options.database || this.config.database,
				timeout: options.timeout,
				charsetNumber,
				currentConfig: this.config
			}, (err) => {
				if (err) err.fatal = true;
				if (callback) callback(err);
			}));
		}
		beginTransaction(cb) {
			return this.query("START TRANSACTION", cb);
		}
		commit(cb) {
			return this.query("COMMIT", cb);
		}
		rollback(cb) {
			return this.query("ROLLBACK", cb);
		}
		ping(cb) {
			return this.addCommand(new Commands.Ping(cb));
		}
		_registerSlave(opts, cb) {
			return this.addCommand(new Commands.RegisterSlave(opts, cb));
		}
		_binlogDump(opts, cb) {
			return this.addCommand(new Commands.BinlogDump(opts, cb));
		}
		destroy() {
			this.close();
		}
		close() {
			if (this.connectTimeout) {
				Timers.clearTimeout(this.connectTimeout);
				this.connectTimeout = null;
			}
			this._closing = true;
			this.stream.end();
			this.addCommand = this._addCommandClosedState;
		}
		createBinlogStream(opts) {
			let test = 1;
			const stream = new Readable({ objectMode: true });
			stream._read = function() {
				return { data: test++ };
			};
			this._registerSlave(opts, () => {
				const dumpCmd = this._binlogDump(opts);
				dumpCmd.on("event", (ev) => {
					stream.push(ev);
				});
				dumpCmd.on("eof", () => {
					stream.push(null);
					if (opts.flags && opts.flags & 1) this.close();
				});
			});
			return stream;
		}
		connect(cb) {
			if (!cb) return;
			if (this._fatalError || this._protocolError) return cb(this._fatalError || this._protocolError);
			if (this._handshakePacket) return cb(null, this);
			let connectCalled = 0;
			function callbackOnce(isErrorHandler) {
				return function(param) {
					if (!connectCalled) if (isErrorHandler) cb(param);
					else cb(null, param);
					connectCalled = 1;
				};
			}
			this.once("error", callbackOnce(true));
			this.once("connect", callbackOnce(false));
		}
		writeColumns(columns) {
			this.writePacket(Packets.ResultSetHeader.toPacket(columns.length));
			columns.forEach((column) => {
				this.writePacket(Packets.ColumnDefinition.toPacket(column, this.serverConfig.encoding));
			});
			this.writeEof();
		}
		writeTextRow(column) {
			this.writePacket(Packets.TextRow.toPacket(column, this.serverConfig.encoding));
		}
		writeBinaryRow(column) {
			this.writePacket(Packets.BinaryRow.toPacket(column, this.serverConfig.encoding));
		}
		writeTextResult(rows, columns, binary = false) {
			this.writeColumns(columns);
			rows.forEach((row) => {
				const arrayRow = new Array(columns.length);
				columns.forEach((column) => {
					arrayRow.push(row[column.name]);
				});
				if (binary) this.writeBinaryRow(arrayRow);
				else this.writeTextRow(arrayRow);
			});
			this.writeEof();
		}
		writeEof(warnings, statusFlags) {
			this.writePacket(Packets.EOF.toPacket(warnings, statusFlags));
		}
		writeOk(args) {
			if (!args) args = { affectedRows: 0 };
			this.writePacket(Packets.OK.toPacket(args, this.serverConfig.encoding));
		}
		writeError(args) {
			const encoding = this.serverConfig ? this.serverConfig.encoding : "cesu8";
			this.writePacket(Packets.Error.toPacket(args, encoding));
		}
		serverHandshake(args) {
			this.serverConfig = args;
			this.serverConfig.encoding = CharsetToEncoding[this.serverConfig.characterSet];
			return this.addCommand(new Commands.ServerHandshake(args));
		}
		end(callback) {
			if (this.config.isServer) {
				this._closing = true;
				const quitCmd$1 = new EventEmitter$5();
				setImmediate(() => {
					this.stream.end();
					quitCmd$1.emit("end");
				});
				return quitCmd$1;
			}
			const quitCmd = this.addCommand(new Commands.Quit(callback));
			this.addCommand = this._addCommandClosedState;
			return quitCmd;
		}
		static createQuery(sql, values, cb, config) {
			let options = {
				rowsAsArray: config.rowsAsArray,
				infileStreamFactory: config.infileStreamFactory
			};
			if (typeof sql === "object") {
				options = {
					...options,
					...sql,
					sql: sql.sql,
					values: sql.values
				};
				if (typeof values === "function") cb = values;
				else if (values !== void 0) options.values = values;
			} else if (typeof values === "function") {
				cb = values;
				options.sql = sql;
				options.values = void 0;
			} else {
				options.sql = sql;
				options.values = values;
			}
			return new Commands.Query(options, cb);
		}
		static statementKey(options) {
			return `${typeof options.nestTables}/${options.nestTables}/${options.rowsAsArray}${options.sql}`;
		}
	};
	module.exports = BaseConnection$4;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/pool_connection.js
var require_pool_connection$2 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/pool_connection.js": ((exports, module) => {
	const BaseConnection$3 = require_connection$2();
	var BasePoolConnection$2 = class extends BaseConnection$3 {
		constructor(pool, options) {
			super(options);
			this._pool = pool;
			this.lastActiveTime = Date.now();
			this.once("end", () => {
				this._removeFromPool();
			});
			this.once("error", () => {
				this._removeFromPool();
			});
		}
		release() {
			if (!this._pool || this._pool._closed) return;
			this.lastActiveTime = Date.now();
			this._pool.releaseConnection(this);
		}
		end() {
			const err = /* @__PURE__ */ new Error("Calling conn.end() to release a pooled connection is deprecated. In next version calling conn.end() will be restored to default conn.end() behavior. Use conn.release() instead.");
			this.emit("warn", err);
			console.warn(err.message);
			this.release();
		}
		destroy() {
			this._removeFromPool();
			super.destroy();
		}
		_removeFromPool() {
			if (!this._pool || this._pool._closed) return;
			const pool = this._pool;
			this._pool = null;
			pool._removeConnection(this);
		}
	};
	BasePoolConnection$2.statementKey = BaseConnection$3.statementKey;
	module.exports = BasePoolConnection$2;
	BasePoolConnection$2.prototype._realEnd = BaseConnection$3.prototype.end;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/make_done_cb.js
var require_make_done_cb = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/make_done_cb.js": ((exports, module) => {
	function makeDoneCb$5(resolve, reject, localErr) {
		return function(err, rows, fields$1) {
			if (err) {
				localErr.message = err.message;
				localErr.code = err.code;
				localErr.errno = err.errno;
				localErr.sql = err.sql;
				localErr.sqlState = err.sqlState;
				localErr.sqlMessage = err.sqlMessage;
				reject(localErr);
			} else resolve([rows, fields$1]);
		};
	}
	module.exports = makeDoneCb$5;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/prepared_statement_info.js
var require_prepared_statement_info = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/prepared_statement_info.js": ((exports, module) => {
	const makeDoneCb$4 = require_make_done_cb();
	var PromisePreparedStatementInfo$1 = class {
		constructor(statement, promiseImpl) {
			this.statement = statement;
			this.Promise = promiseImpl;
		}
		execute(parameters) {
			const s = this.statement;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$4(resolve, reject, localErr);
				if (parameters) s.execute(parameters, done);
				else s.execute(done);
			});
		}
		close() {
			return new this.Promise((resolve) => {
				this.statement.close();
				resolve();
			});
		}
	};
	module.exports = PromisePreparedStatementInfo$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/inherit_events.js
var require_inherit_events = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/inherit_events.js": ((exports, module) => {
	function inheritEvents$3(source, target, events) {
		const listeners = {};
		target.on("newListener", (eventName) => {
			if (events.indexOf(eventName) >= 0 && !target.listenerCount(eventName)) source.on(eventName, listeners[eventName] = function() {
				const args = [].slice.call(arguments);
				args.unshift(eventName);
				target.emit.apply(target, args);
			});
		}).on("removeListener", (eventName) => {
			if (events.indexOf(eventName) >= 0 && !target.listenerCount(eventName)) {
				source.removeListener(eventName, listeners[eventName]);
				delete listeners[eventName];
			}
		});
	}
	module.exports = inheritEvents$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/connection.js
var require_connection$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/connection.js": ((exports, module) => {
	const EventEmitter$4 = __require("events").EventEmitter;
	const PromisePreparedStatementInfo = require_prepared_statement_info();
	const makeDoneCb$3 = require_make_done_cb();
	const inheritEvents$2 = require_inherit_events();
	const BaseConnection$2 = require_connection$2();
	var PromiseConnection$2 = class extends EventEmitter$4 {
		constructor(connection, promiseImpl) {
			super();
			this.connection = connection;
			this.Promise = promiseImpl || Promise;
			inheritEvents$2(connection, this, [
				"error",
				"drain",
				"connect",
				"end",
				"enqueue"
			]);
		}
		release() {
			this.connection.release();
		}
		query(query, params) {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof params === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$3(resolve, reject, localErr);
				if (params !== void 0) c.query(query, params, done);
				else c.query(query, done);
			});
		}
		execute(query, params) {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof params === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$3(resolve, reject, localErr);
				if (params !== void 0) c.execute(query, params, done);
				else c.execute(query, done);
			});
		}
		end() {
			return new this.Promise((resolve) => {
				this.connection.end(resolve);
			});
		}
		beginTransaction() {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$3(resolve, reject, localErr);
				c.beginTransaction(done);
			});
		}
		commit() {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$3(resolve, reject, localErr);
				c.commit(done);
			});
		}
		rollback() {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$3(resolve, reject, localErr);
				c.rollback(done);
			});
		}
		ping() {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				c.ping((err) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve(true);
				});
			});
		}
		connect() {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				c.connect((err, param) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve(param);
				});
			});
		}
		prepare(options) {
			const c = this.connection;
			const promiseImpl = this.Promise;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				c.prepare(options, (err, statement) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve(new PromisePreparedStatementInfo(statement, promiseImpl));
				});
			});
		}
		changeUser(options) {
			const c = this.connection;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				c.changeUser(options, (err) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve();
				});
			});
		}
		get config() {
			return this.connection.config;
		}
		get threadId() {
			return this.connection.threadId;
		}
	};
	(function(functionsToWrap) {
		for (let i$4 = 0; functionsToWrap && i$4 < functionsToWrap.length; i$4++) {
			const func = functionsToWrap[i$4];
			if (typeof BaseConnection$2.prototype[func] === "function" && PromiseConnection$2.prototype[func] === void 0) PromiseConnection$2.prototype[func] = (function factory(funcName) {
				return function() {
					return BaseConnection$2.prototype[funcName].apply(this.connection, arguments);
				};
			})(func);
		}
	})([
		"close",
		"createBinlogStream",
		"destroy",
		"escape",
		"escapeId",
		"format",
		"pause",
		"pipe",
		"resume",
		"unprepare"
	]);
	module.exports = PromiseConnection$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool_connection.js
var require_pool_connection$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool_connection.js": ((exports, module) => {
	const PromiseConnection$1 = require_connection$1();
	const BasePoolConnection$1 = require_pool_connection$2();
	var PromisePoolConnection$3 = class extends PromiseConnection$1 {
		constructor(connection, promiseImpl) {
			super(connection, promiseImpl);
		}
		destroy() {
			return BasePoolConnection$1.prototype.destroy.apply(this.connection, arguments);
		}
	};
	module.exports = PromisePoolConnection$3;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_connection.js
var require_pool_connection = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_connection.js": ((exports, module) => {
	const BasePoolConnection = require_pool_connection$2();
	var PoolConnection$1 = class extends BasePoolConnection {
		promise(promiseImpl) {
			return new (require_pool_connection$1())(this, promiseImpl);
		}
	};
	module.exports = PoolConnection$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/pool.js
var require_pool$2 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/base/pool.js": ((exports, module) => {
	const process$2 = __require("process");
	const SqlString$1 = require_sqlstring();
	const EventEmitter$3 = __require("events").EventEmitter;
	const PoolConnection = require_pool_connection();
	const Queue = require_denque();
	const BaseConnection$1 = require_connection$2();
	function spliceConnection(queue, connection) {
		const len = queue.length;
		for (let i$4 = 0; i$4 < len; i$4++) if (queue.get(i$4) === connection) {
			queue.removeOne(i$4);
			break;
		}
	}
	var BasePool$2 = class extends EventEmitter$3 {
		constructor(options) {
			super();
			this.config = options.config;
			this.config.connectionConfig.pool = this;
			this._allConnections = new Queue();
			this._freeConnections = new Queue();
			this._connectionQueue = new Queue();
			this._closed = false;
			if (this.config.maxIdle < this.config.connectionLimit) this._removeIdleTimeoutConnections();
		}
		getConnection(cb) {
			if (this._closed) return process$2.nextTick(() => cb(/* @__PURE__ */ new Error("Pool is closed.")));
			let connection;
			if (this._freeConnections.length > 0) {
				connection = this._freeConnections.pop();
				this.emit("acquire", connection);
				return process$2.nextTick(() => cb(null, connection));
			}
			if (this.config.connectionLimit === 0 || this._allConnections.length < this.config.connectionLimit) {
				connection = new PoolConnection(this, { config: this.config.connectionConfig });
				this._allConnections.push(connection);
				return connection.connect((err) => {
					if (this._closed) return cb(/* @__PURE__ */ new Error("Pool is closed."));
					if (err) return cb(err);
					this.emit("connection", connection);
					this.emit("acquire", connection);
					return cb(null, connection);
				});
			}
			if (!this.config.waitForConnections) return process$2.nextTick(() => cb(/* @__PURE__ */ new Error("No connections available.")));
			if (this.config.queueLimit && this._connectionQueue.length >= this.config.queueLimit) return cb(/* @__PURE__ */ new Error("Queue limit reached."));
			this.emit("enqueue");
			return this._connectionQueue.push(cb);
		}
		releaseConnection(connection) {
			let cb;
			if (!connection._pool) {
				if (this._connectionQueue.length) {
					cb = this._connectionQueue.shift();
					process$2.nextTick(this.getConnection.bind(this, cb));
				}
			} else if (this._connectionQueue.length) {
				cb = this._connectionQueue.shift();
				process$2.nextTick(cb.bind(null, null, connection));
			} else {
				this._freeConnections.push(connection);
				this.emit("release", connection);
			}
		}
		end(cb) {
			this._closed = true;
			clearTimeout(this._removeIdleTimeoutConnectionsTimer);
			if (typeof cb !== "function") cb = function(err) {
				if (err) throw err;
			};
			let calledBack = false;
			let closedConnections = 0;
			let connection;
			const endCB = function(err) {
				if (calledBack) return;
				if (err || ++closedConnections >= this._allConnections.length) {
					calledBack = true;
					cb(err);
					return;
				}
			}.bind(this);
			if (this._allConnections.length === 0) {
				endCB();
				return;
			}
			for (let i$4 = 0; i$4 < this._allConnections.length; i$4++) {
				connection = this._allConnections.get(i$4);
				connection._realEnd(endCB);
			}
		}
		query(sql, values, cb) {
			const cmdQuery = BaseConnection$1.createQuery(sql, values, cb, this.config.connectionConfig);
			if (typeof cmdQuery.namedPlaceholders === "undefined") cmdQuery.namedPlaceholders = this.config.connectionConfig.namedPlaceholders;
			this.getConnection((err, conn) => {
				if (err) {
					if (typeof cmdQuery.onResult === "function") cmdQuery.onResult(err);
					else cmdQuery.emit("error", err);
					return;
				}
				try {
					conn.query(cmdQuery).once("end", () => {
						conn.release();
					});
				} catch (e) {
					conn.release();
					throw e;
				}
			});
			return cmdQuery;
		}
		execute(sql, values, cb) {
			if (typeof values === "function") {
				cb = values;
				values = [];
			}
			this.getConnection((err, conn) => {
				if (err) return cb(err);
				try {
					conn.execute(sql, values, cb).once("end", () => {
						conn.release();
					});
				} catch (e) {
					conn.release();
					return cb(e);
				}
			});
		}
		_removeConnection(connection) {
			spliceConnection(this._allConnections, connection);
			spliceConnection(this._freeConnections, connection);
			this.releaseConnection(connection);
		}
		_removeIdleTimeoutConnections() {
			if (this._removeIdleTimeoutConnectionsTimer) clearTimeout(this._removeIdleTimeoutConnectionsTimer);
			this._removeIdleTimeoutConnectionsTimer = setTimeout(() => {
				try {
					while (this._freeConnections.length > this.config.maxIdle || this._freeConnections.length > 0 && Date.now() - this._freeConnections.get(0).lastActiveTime > this.config.idleTimeout) this._freeConnections.get(0).destroy();
				} finally {
					this._removeIdleTimeoutConnections();
				}
			}, 1e3);
		}
		format(sql, values) {
			return SqlString$1.format(sql, values, this.config.connectionConfig.stringifyObjects, this.config.connectionConfig.timezone);
		}
		escape(value) {
			return SqlString$1.escape(value, this.config.connectionConfig.stringifyObjects, this.config.connectionConfig.timezone);
		}
		escapeId(value) {
			return SqlString$1.escapeId(value, false);
		}
	};
	module.exports = BasePool$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool.js
var require_pool$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool.js": ((exports, module) => {
	const EventEmitter$2 = __require("events").EventEmitter;
	const makeDoneCb$2 = require_make_done_cb();
	const PromisePoolConnection$2 = require_pool_connection$1();
	const inheritEvents$1 = require_inherit_events();
	const BasePool$1 = require_pool$2();
	var PromisePool$1 = class extends EventEmitter$2 {
		constructor(pool, thePromise) {
			super();
			this.pool = pool;
			this.Promise = thePromise || Promise;
			inheritEvents$1(pool, this, [
				"acquire",
				"connection",
				"enqueue",
				"release"
			]);
		}
		getConnection() {
			const corePool = this.pool;
			return new this.Promise((resolve, reject) => {
				corePool.getConnection((err, coreConnection) => {
					if (err) reject(err);
					else resolve(new PromisePoolConnection$2(coreConnection, this.Promise));
				});
			});
		}
		releaseConnection(connection) {
			if (connection instanceof PromisePoolConnection$2) connection.release();
		}
		query(sql, args) {
			const corePool = this.pool;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof args === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$2(resolve, reject, localErr);
				if (args !== void 0) corePool.query(sql, args, done);
				else corePool.query(sql, done);
			});
		}
		execute(sql, args) {
			const corePool = this.pool;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof args === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$2(resolve, reject, localErr);
				if (args) corePool.execute(sql, args, done);
				else corePool.execute(sql, done);
			});
		}
		end() {
			const corePool = this.pool;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				corePool.end((err) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve();
				});
			});
		}
	};
	(function(functionsToWrap) {
		for (let i$4 = 0; functionsToWrap && i$4 < functionsToWrap.length; i$4++) {
			const func = functionsToWrap[i$4];
			if (typeof BasePool$1.prototype[func] === "function" && PromisePool$1.prototype[func] === void 0) PromisePool$1.prototype[func] = (function factory(funcName) {
				return function() {
					return BasePool$1.prototype[funcName].apply(this.pool, arguments);
				};
			})(func);
		}
	})([
		"escape",
		"escapeId",
		"format"
	]);
	module.exports = PromisePool$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool.js
var require_pool = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool.js": ((exports, module) => {
	const BasePool = require_pool$2();
	var Pool$2 = class extends BasePool {
		promise(promiseImpl) {
			return new (require_pool$1())(this, promiseImpl);
		}
	};
	module.exports = Pool$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_config.js
var require_pool_config = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_config.js": ((exports, module) => {
	const ConnectionConfig$1 = require_connection_config();
	var PoolConfig$2 = class {
		constructor(options) {
			if (typeof options === "string") options = ConnectionConfig$1.parseUrl(options);
			this.connectionConfig = new ConnectionConfig$1(options);
			this.waitForConnections = options.waitForConnections === void 0 ? true : Boolean(options.waitForConnections);
			this.connectionLimit = isNaN(options.connectionLimit) ? 10 : Number(options.connectionLimit);
			this.maxIdle = isNaN(options.maxIdle) ? this.connectionLimit : Number(options.maxIdle);
			this.idleTimeout = isNaN(options.idleTimeout) ? 6e4 : Number(options.idleTimeout);
			this.queueLimit = isNaN(options.queueLimit) ? 0 : Number(options.queueLimit);
		}
	};
	module.exports = PoolConfig$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/connection.js
var require_connection = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/connection.js": ((exports, module) => {
	const BaseConnection = require_connection$2();
	var Connection$2 = class extends BaseConnection {
		promise(promiseImpl) {
			return new (require_connection$1())(this, promiseImpl);
		}
	};
	module.exports = Connection$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_cluster.js
var require_pool_cluster$1 = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/pool_cluster.js": ((exports, module) => {
	const process$1 = __require("process");
	const Pool$1 = require_pool();
	const PoolConfig$1 = require_pool_config();
	const Connection$1 = require_connection();
	const EventEmitter$1 = __require("events").EventEmitter;
	/**
	* Selector
	*/
	const makeSelector = {
		RR() {
			let index = 0;
			return (clusterIds) => clusterIds[index++ % clusterIds.length];
		},
		RANDOM() {
			return (clusterIds) => clusterIds[Math.floor(Math.random() * clusterIds.length)];
		},
		ORDER() {
			return (clusterIds) => clusterIds[0];
		}
	};
	const getMonotonicMilliseconds = function() {
		let ms;
		if (typeof process$1.hrtime === "function") {
			ms = process$1.hrtime();
			ms = ms[0] * 1e3 + ms[1] * 1e-6;
		} else ms = process$1.uptime() * 1e3;
		return Math.floor(ms);
	};
	const patternRegExp = function(pattern) {
		if (pattern instanceof RegExp) return pattern;
		const source = pattern.replace(/([.+?^=!:${}()|[\]/\\])/g, "\\$1").replace(/\*/g, ".*");
		return /* @__PURE__ */ new RegExp(`^${source}$`);
	};
	var PoolNamespace = class {
		constructor(cluster, pattern, selector) {
			this._cluster = cluster;
			this._pattern = pattern;
			this._selector = makeSelector[selector]();
		}
		getConnection(cb) {
			const clusterNode = this._getClusterNode();
			if (clusterNode === null) {
				let err = /* @__PURE__ */ new Error("Pool does Not exist.");
				err.code = "POOL_NOEXIST";
				if (this._cluster._findNodeIds(this._pattern, true).length !== 0) {
					err = /* @__PURE__ */ new Error("Pool does Not have online node.");
					err.code = "POOL_NONEONLINE";
				}
				return cb(err);
			}
			return this._cluster._getConnection(clusterNode, (err, connection) => {
				if (err) {
					if (this._cluster._canRetry && this._cluster._findNodeIds(this._pattern).length !== 0) {
						this._cluster.emit("warn", err);
						return this.getConnection(cb);
					}
					return cb(err);
				}
				return cb(null, connection);
			});
		}
		/**
		* pool cluster query
		* @param {*} sql
		* @param {*} values
		* @param {*} cb
		* @returns query
		*/
		query(sql, values, cb) {
			const query = Connection$1.createQuery(sql, values, cb, {});
			this.getConnection((err, conn) => {
				if (err) {
					if (typeof query.onResult === "function") query.onResult(err);
					else query.emit("error", err);
					return;
				}
				try {
					conn.query(query).once("end", () => {
						conn.release();
					});
				} catch (e) {
					conn.release();
					throw e;
				}
			});
			return query;
		}
		/**
		* pool cluster execute
		* @param {*} sql
		* @param {*} values
		* @param {*} cb
		*/
		execute(sql, values, cb) {
			if (typeof values === "function") {
				cb = values;
				values = [];
			}
			this.getConnection((err, conn) => {
				if (err) return cb(err);
				try {
					conn.execute(sql, values, cb).once("end", () => {
						conn.release();
					});
				} catch (e) {
					conn.release();
					throw e;
				}
			});
		}
		_getClusterNode() {
			const foundNodeIds = this._cluster._findNodeIds(this._pattern);
			if (foundNodeIds.length === 0) return null;
			const nodeId = foundNodeIds.length === 1 ? foundNodeIds[0] : this._selector(foundNodeIds);
			return this._cluster._getNode(nodeId);
		}
	};
	var PoolCluster$2 = class extends EventEmitter$1 {
		constructor(config) {
			super();
			config = config || {};
			this._canRetry = typeof config.canRetry === "undefined" ? true : config.canRetry;
			this._removeNodeErrorCount = config.removeNodeErrorCount || 5;
			this._restoreNodeTimeout = config.restoreNodeTimeout || 0;
			this._defaultSelector = config.defaultSelector || "RR";
			this._closed = false;
			this._lastId = 0;
			this._nodes = {};
			this._serviceableNodeIds = [];
			this._namespaces = {};
			this._findCaches = {};
		}
		of(pattern, selector) {
			pattern = pattern || "*";
			selector = selector || this._defaultSelector;
			selector = selector.toUpperCase();
			if (!makeSelector[selector] === "undefined") selector = this._defaultSelector;
			const key$1 = pattern + selector;
			if (typeof this._namespaces[key$1] === "undefined") this._namespaces[key$1] = new PoolNamespace(this, pattern, selector);
			return this._namespaces[key$1];
		}
		add(id, config) {
			if (typeof id === "object") {
				config = id;
				id = `CLUSTER::${++this._lastId}`;
			}
			if (typeof this._nodes[id] === "undefined") {
				this._nodes[id] = {
					id,
					errorCount: 0,
					pool: new Pool$1({ config: new PoolConfig$1(config) }),
					_offlineUntil: 0
				};
				this._serviceableNodeIds.push(id);
				this._clearFindCaches();
			}
		}
		remove(pattern) {
			const foundNodeIds = this._findNodeIds(pattern, true);
			for (let i$4 = 0; i$4 < foundNodeIds.length; i$4++) {
				const node = this._getNode(foundNodeIds[i$4]);
				if (node) this._removeNode(node);
			}
		}
		getConnection(pattern, selector, cb) {
			let namespace;
			if (typeof pattern === "function") {
				cb = pattern;
				namespace = this.of();
			} else {
				if (typeof selector === "function") {
					cb = selector;
					selector = this._defaultSelector;
				}
				namespace = this.of(pattern, selector);
			}
			namespace.getConnection(cb);
		}
		end(callback) {
			const cb = callback !== void 0 ? callback : (err) => {
				if (err) throw err;
			};
			if (this._closed) {
				process$1.nextTick(cb);
				return;
			}
			this._closed = true;
			let calledBack = false;
			let waitingClose = 0;
			const onEnd = (err) => {
				if (!calledBack && (err || --waitingClose <= 0)) {
					calledBack = true;
					return cb(err);
				}
			};
			for (const id in this._nodes) {
				waitingClose++;
				this._nodes[id].pool.end(onEnd);
			}
			if (waitingClose === 0) process$1.nextTick(onEnd);
		}
		_findNodeIds(pattern, includeOffline) {
			let currentTime = 0;
			let foundNodeIds = this._findCaches[pattern];
			if (foundNodeIds === void 0) {
				const expression = patternRegExp(pattern);
				foundNodeIds = this._serviceableNodeIds.filter((id) => id.match(expression));
			}
			this._findCaches[pattern] = foundNodeIds;
			if (includeOffline) return foundNodeIds;
			return foundNodeIds.filter((nodeId) => {
				const node = this._getNode(nodeId);
				if (!node._offlineUntil) return true;
				if (!currentTime) currentTime = getMonotonicMilliseconds();
				return node._offlineUntil <= currentTime;
			});
		}
		_getNode(id) {
			return this._nodes[id] || null;
		}
		_increaseErrorCount(node) {
			const errorCount = ++node.errorCount;
			if (this._removeNodeErrorCount > errorCount) return;
			if (this._restoreNodeTimeout > 0) {
				node._offlineUntil = getMonotonicMilliseconds() + this._restoreNodeTimeout;
				this.emit("offline", node.id);
				return;
			}
			this._removeNode(node);
			this.emit("remove", node.id);
		}
		_decreaseErrorCount(node) {
			let errorCount = node.errorCount;
			if (errorCount > this._removeNodeErrorCount) errorCount = this._removeNodeErrorCount;
			if (errorCount < 1) errorCount = 1;
			node.errorCount = errorCount - 1;
			if (node._offlineUntil) {
				node._offlineUntil = 0;
				this.emit("online", node.id);
			}
		}
		_getConnection(node, cb) {
			node.pool.getConnection((err, connection) => {
				if (err) {
					this._increaseErrorCount(node);
					return cb(err);
				}
				this._decreaseErrorCount(node);
				connection._clusterId = node.id;
				return cb(null, connection);
			});
		}
		_removeNode(node) {
			const index = this._serviceableNodeIds.indexOf(node.id);
			if (index !== -1) {
				this._serviceableNodeIds.splice(index, 1);
				delete this._nodes[node.id];
				this._clearFindCaches();
				node.pool.end();
			}
		}
		_clearFindCaches() {
			this._findCaches = {};
		}
	};
	module.exports = PoolCluster$2;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_connection.js
var require_create_connection = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_connection.js": ((exports, module) => {
	const Connection = require_connection();
	const ConnectionConfig = require_connection_config();
	function createConnection$1(opts) {
		return new Connection({ config: new ConnectionConfig(opts) });
	}
	module.exports = createConnection$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_pool.js
var require_create_pool = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_pool.js": ((exports, module) => {
	const Pool = require_pool();
	const PoolConfig = require_pool_config();
	function createPool$1(config) {
		return new Pool({ config: new PoolConfig(config) });
	}
	module.exports = createPool$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_pool_cluster.js
var require_create_pool_cluster = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/create_pool_cluster.js": ((exports, module) => {
	const PoolCluster$1 = require_pool_cluster$1();
	function createPoolCluster$1(config) {
		return new PoolCluster$1(config);
	}
	module.exports = createPoolCluster$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool_cluster.js
var require_pool_cluster = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/lib/promise/pool_cluster.js": ((exports, module) => {
	const PromisePoolConnection$1 = require_pool_connection$1();
	const makeDoneCb$1 = require_make_done_cb();
	var PromisePoolNamespace$1 = class {
		constructor(poolNamespace, thePromise) {
			this.poolNamespace = poolNamespace;
			this.Promise = thePromise || Promise;
		}
		getConnection() {
			const corePoolNamespace = this.poolNamespace;
			return new this.Promise((resolve, reject) => {
				corePoolNamespace.getConnection((err, coreConnection) => {
					if (err) reject(err);
					else resolve(new PromisePoolConnection$1(coreConnection, this.Promise));
				});
			});
		}
		query(sql, values) {
			const corePoolNamespace = this.poolNamespace;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof values === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$1(resolve, reject, localErr);
				corePoolNamespace.query(sql, values, done);
			});
		}
		execute(sql, values) {
			const corePoolNamespace = this.poolNamespace;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof values === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb$1(resolve, reject, localErr);
				corePoolNamespace.execute(sql, values, done);
			});
		}
	};
	module.exports = PromisePoolNamespace$1;
}) });

//#endregion
//#region ../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/promise.js
var require_promise = /* @__PURE__ */ __commonJS({ "../../node_modules/.pnpm/mysql2@3.14.4/node_modules/mysql2/promise.js": ((exports) => {
	const SqlString = require_sqlstring();
	const EventEmitter = __require("events").EventEmitter;
	const parserCache = require_parser_cache();
	const PoolCluster = require_pool_cluster$1();
	const createConnection = require_create_connection();
	const createPool = require_create_pool();
	const createPoolCluster = require_create_pool_cluster();
	const PromiseConnection = require_connection$1();
	const PromisePool = require_pool$1();
	const makeDoneCb = require_make_done_cb();
	const PromisePoolConnection = require_pool_connection$1();
	const inheritEvents = require_inherit_events();
	const PromisePoolNamespace = require_pool_cluster();
	function createConnectionPromise(opts) {
		const coreConnection = createConnection(opts);
		const createConnectionErr = /* @__PURE__ */ new Error();
		const thePromise = opts.Promise || Promise;
		if (!thePromise) throw new Error("no Promise implementation available.Use promise-enabled node version or pass userland Promise implementation as parameter, for example: { Promise: require('bluebird') }");
		return new thePromise((resolve, reject) => {
			coreConnection.once("connect", () => {
				resolve(new PromiseConnection(coreConnection, thePromise));
			});
			coreConnection.once("error", (err) => {
				createConnectionErr.message = err.message;
				createConnectionErr.code = err.code;
				createConnectionErr.errno = err.errno;
				createConnectionErr.sqlState = err.sqlState;
				reject(createConnectionErr);
			});
		});
	}
	function createPromisePool(opts) {
		const corePool = createPool(opts);
		const thePromise = opts.Promise || Promise;
		if (!thePromise) throw new Error("no Promise implementation available.Use promise-enabled node version or pass userland Promise implementation as parameter, for example: { Promise: require('bluebird') }");
		return new PromisePool(corePool, thePromise);
	}
	var PromisePoolCluster = class extends EventEmitter {
		constructor(poolCluster, thePromise) {
			super();
			this.poolCluster = poolCluster;
			this.Promise = thePromise || Promise;
			inheritEvents(poolCluster, this, [
				"warn",
				"remove",
				"online",
				"offline"
			]);
		}
		getConnection(pattern, selector) {
			const corePoolCluster = this.poolCluster;
			return new this.Promise((resolve, reject) => {
				corePoolCluster.getConnection(pattern, selector, (err, coreConnection) => {
					if (err) reject(err);
					else resolve(new PromisePoolConnection(coreConnection, this.Promise));
				});
			});
		}
		query(sql, args) {
			const corePoolCluster = this.poolCluster;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof args === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb(resolve, reject, localErr);
				corePoolCluster.query(sql, args, done);
			});
		}
		execute(sql, args) {
			const corePoolCluster = this.poolCluster;
			const localErr = /* @__PURE__ */ new Error();
			if (typeof args === "function") throw new Error("Callback function is not available with promise clients.");
			return new this.Promise((resolve, reject) => {
				const done = makeDoneCb(resolve, reject, localErr);
				corePoolCluster.execute(sql, args, done);
			});
		}
		of(pattern, selector) {
			return new PromisePoolNamespace(this.poolCluster.of(pattern, selector), this.Promise);
		}
		end() {
			const corePoolCluster = this.poolCluster;
			const localErr = /* @__PURE__ */ new Error();
			return new this.Promise((resolve, reject) => {
				corePoolCluster.end((err) => {
					if (err) {
						localErr.message = err.message;
						localErr.code = err.code;
						localErr.errno = err.errno;
						localErr.sqlState = err.sqlState;
						localErr.sqlMessage = err.sqlMessage;
						reject(localErr);
					} else resolve();
				});
			});
		}
	};
	/**
	* proxy poolCluster synchronous functions
	*/
	(function(functionsToWrap) {
		for (let i$4 = 0; functionsToWrap && i$4 < functionsToWrap.length; i$4++) {
			const func = functionsToWrap[i$4];
			if (typeof PoolCluster.prototype[func] === "function" && PromisePoolCluster.prototype[func] === void 0) PromisePoolCluster.prototype[func] = (function factory(funcName) {
				return function() {
					return PoolCluster.prototype[funcName].apply(this.poolCluster, arguments);
				};
			})(func);
		}
	})(["add", "remove"]);
	function createPromisePoolCluster(opts) {
		const corePoolCluster = createPoolCluster(opts);
		const thePromise = opts && opts.Promise || Promise;
		if (!thePromise) throw new Error("no Promise implementation available.Use promise-enabled node version or pass userland Promise implementation as parameter, for example: { Promise: require('bluebird') }");
		return new PromisePoolCluster(corePoolCluster, thePromise);
	}
	exports.createConnection = createConnectionPromise;
	exports.createPool = createPromisePool;
	exports.createPoolCluster = createPromisePoolCluster;
	exports.escape = SqlString.escape;
	exports.escapeId = SqlString.escapeId;
	exports.format = SqlString.format;
	exports.raw = SqlString.raw;
	exports.PromisePool = PromisePool;
	exports.PromiseConnection = PromiseConnection;
	exports.PromisePoolConnection = PromisePoolConnection;
	exports.__defineGetter__("Types", () => require_types());
	exports.__defineGetter__("Charsets", () => require_charsets());
	exports.__defineGetter__("CharsetToEncoding", () => require_charset_encodings());
	exports.setMaxParserCache = function(max) {
		parserCache.setMaxCache(max);
	};
	exports.clearParserCache = function() {
		parserCache.clearCache();
	};
}) });

//#endregion
export default require_promise();

export {  };