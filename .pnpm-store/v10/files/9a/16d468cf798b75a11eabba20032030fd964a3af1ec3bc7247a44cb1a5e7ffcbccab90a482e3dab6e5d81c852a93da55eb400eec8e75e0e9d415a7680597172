'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$2 = require('util');
var require$$0 = require('buffer');
var require$$1 = require('events');
var require$$0$1 = require('stream');
var require$$1$1 = require('crypto');
var require$$2$1 = require('url');
var require$$1$2 = require('net');
var require$$2$2 = require('tls');
var require$$2$3 = require('@firebase/util');
var require$$1$3 = require('@firebase/logger');
var require$$0$2 = require('@firebase/component');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
var require$$1__default = /*#__PURE__*/_interopDefaultLegacy(require$$1);
var require$$0__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$0$1);
var require$$1__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$1$1);
var require$$2__default$1 = /*#__PURE__*/_interopDefaultLegacy(require$$2$1);
var require$$1__default$2 = /*#__PURE__*/_interopDefaultLegacy(require$$1$2);
var require$$2__default$2 = /*#__PURE__*/_interopDefaultLegacy(require$$2$2);
var require$$2__default$3 = /*#__PURE__*/_interopDefaultLegacy(require$$2$3);
var require$$1__default$3 = /*#__PURE__*/_interopDefaultLegacy(require$$1$3);
var require$$0__default$2 = /*#__PURE__*/_interopDefaultLegacy(require$$0$2);

function getAugmentedNamespace(n) {
	if (n.__esModule) return n;
	var a = Object.defineProperty({}, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var index_standalone = {};

var safeBuffer = {exports: {}};

/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

(function (module, exports) {
/* eslint-disable node/no-deprecated-api */
var buffer = require$$0__default["default"];
var Buffer = buffer.Buffer;

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key];
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer;
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports);
  exports.Buffer = SafeBuffer;
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.prototype = Object.create(Buffer.prototype);

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer);

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
};

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size);
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding);
    } else {
      buf.fill(fill);
    }
  } else {
    buf.fill(0);
  }
  return buf
};

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
};

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
};
}(safeBuffer, safeBuffer.exports));

var streams$1 = {};

/**

Streams in a WebSocket connection
---------------------------------

We model a WebSocket as two duplex streams: one stream is for the wire protocol
over an I/O socket, and the other is for incoming/outgoing messages.


                        +----------+      +---------+      +----------+
    [1] write(chunk) -->| ~~~~~~~~ +----->| parse() +----->| ~~~~~~~~ +--> emit('data') [2]
                        |          |      +----+----+      |          |
                        |          |           |           |          |
                        |    IO    |           | [5]       | Messages |
                        |          |           V           |          |
                        |          |      +---------+      |          |
    [4] emit('data') <--+ ~~~~~~~~ |<-----+ frame() |<-----+ ~~~~~~~~ |<-- write(chunk) [3]
                        +----------+      +---------+      +----------+


Message transfer in each direction is simple: IO receives a byte stream [1] and
sends this stream for parsing. The parser will periodically emit a complete
message text on the Messages stream [2]. Similarly, when messages are written
to the Messages stream [3], they are framed using the WebSocket wire format and
emitted via IO [4].

There is a feedback loop via [5] since some input from [1] will be things like
ping, pong and close frames. In these cases the protocol responds by emitting
responses directly back to [4] rather than emitting messages via [2].

For the purposes of flow control, we consider the sources of each Readable
stream to be as follows:

* [2] receives input from [1]
* [4] receives input from [1] and [3]

The classes below express the relationships described above without prescribing
anything about how parse() and frame() work, other than assuming they emit
'data' events to the IO and Messages streams. They will work with any protocol
driver having these two methods.
**/


var Stream$3 = require$$0__default$1["default"].Stream,
    util$c   = require$$2__default["default"];


var IO = function(driver) {
  this.readable = this.writable = true;
  this._paused  = false;
  this._driver  = driver;
};
util$c.inherits(IO, Stream$3);

// The IO pause() and resume() methods will be called when the socket we are
// piping to gets backed up and drains. Since IO output [4] comes from IO input
// [1] and Messages input [3], we need to tell both of those to return false
// from write() when this stream is paused.

IO.prototype.pause = function() {
  this._paused = true;
  this._driver.messages._paused = true;
};

IO.prototype.resume = function() {
  this._paused = false;
  this.emit('drain');

  var messages = this._driver.messages;
  messages._paused = false;
  messages.emit('drain');
};

// When we receive input from a socket, send it to the parser and tell the
// source whether to back off.
IO.prototype.write = function(chunk) {
  if (!this.writable) return false;
  this._driver.parse(chunk);
  return !this._paused;
};

// The IO end() method will be called when the socket piping into it emits
// 'close' or 'end', i.e. the socket is closed. In this situation the Messages
// stream will not emit any more data so we emit 'end'.
IO.prototype.end = function(chunk) {
  if (!this.writable) return;
  if (chunk !== undefined) this.write(chunk);
  this.writable = false;

  var messages = this._driver.messages;
  if (messages.readable) {
    messages.readable = messages.writable = false;
    messages.emit('end');
  }
};

IO.prototype.destroy = function() {
  this.end();
};


var Messages = function(driver) {
  this.readable = this.writable = true;
  this._paused  = false;
  this._driver  = driver;
};
util$c.inherits(Messages, Stream$3);

// The Messages pause() and resume() methods will be called when the app that's
// processing the messages gets backed up and drains. If we're emitting
// messages too fast we should tell the source to slow down. Message output [2]
// comes from IO input [1].

Messages.prototype.pause = function() {
  this._driver.io._paused = true;
};

Messages.prototype.resume = function() {
  this._driver.io._paused = false;
  this._driver.io.emit('drain');
};

// When we receive messages from the user, send them to the formatter and tell
// the source whether to back off.
Messages.prototype.write = function(message) {
  if (!this.writable) return false;
  if (typeof message === 'string') this._driver.text(message);
  else this._driver.binary(message);
  return !this._paused;
};

// The Messages end() method will be called when a stream piping into it emits
// 'end'. Many streams may be piped into the WebSocket and one of them ending
// does not mean the whole socket is done, so just process the input and move
// on leaving the socket open.
Messages.prototype.end = function(message) {
  if (message !== undefined) this.write(message);
};

Messages.prototype.destroy = function() {};


streams$1.IO = IO;
streams$1.Messages = Messages;

var Headers$3 = function() {
  this.clear();
};

Headers$3.prototype.ALLOWED_DUPLICATES = ['set-cookie', 'set-cookie2', 'warning', 'www-authenticate'];

Headers$3.prototype.clear = function() {
  this._sent  = {};
  this._lines = [];
};

Headers$3.prototype.set = function(name, value) {
  if (value === undefined) return;

  name = this._strip(name);
  value = this._strip(value);

  var key = name.toLowerCase();
  if (!this._sent.hasOwnProperty(key) || this.ALLOWED_DUPLICATES.indexOf(key) >= 0) {
    this._sent[key] = true;
    this._lines.push(name + ': ' + value + '\r\n');
  }
};

Headers$3.prototype.toString = function() {
  return this._lines.join('');
};

Headers$3.prototype._strip = function(string) {
  return string.toString().replace(/^ */, '').replace(/ *$/, '');
};

var headers = Headers$3;

var Buffer$9 = safeBuffer.exports.Buffer;

var StreamReader = function() {
  this._queue     = [];
  this._queueSize = 0;
  this._offset    = 0;
};

StreamReader.prototype.put = function(buffer) {
  if (!buffer || buffer.length === 0) return;
  if (!Buffer$9.isBuffer(buffer)) buffer = Buffer$9.from(buffer);
  this._queue.push(buffer);
  this._queueSize += buffer.length;
};

StreamReader.prototype.read = function(length) {
  if (length > this._queueSize) return null;
  if (length === 0) return Buffer$9.alloc(0);

  this._queueSize -= length;

  var queue  = this._queue,
      remain = length,
      first  = queue[0],
      buffers, buffer;

  if (first.length >= length) {
    if (first.length === length) {
      return queue.shift();
    } else {
      buffer = first.slice(0, length);
      queue[0] = first.slice(length);
      return buffer;
    }
  }

  for (var i = 0, n = queue.length; i < n; i++) {
    if (remain < queue[i].length) break;
    remain -= queue[i].length;
  }
  buffers = queue.splice(0, i);

  if (remain > 0 && queue.length > 0) {
    buffers.push(queue[0].slice(0, remain));
    queue[0] = queue[0].slice(remain);
  }
  return Buffer$9.concat(buffers, length);
};

StreamReader.prototype.eachByte = function(callback, context) {
  var buffer, n, index;

  while (this._queue.length > 0) {
    buffer = this._queue[0];
    n = buffer.length;

    while (this._offset < n) {
      index = this._offset;
      this._offset += 1;
      callback.call(context, buffer[index]);
    }
    this._offset = 0;
    this._queue.shift();
  }
};

var stream_reader = StreamReader;

var Buffer$8  = safeBuffer.exports.Buffer,
    Emitter = require$$1__default["default"].EventEmitter,
    util$b    = require$$2__default["default"],
    streams = streams$1,
    Headers$2 = headers,
    Reader  = stream_reader;

var Base$7 = function(request, url, options) {
  Emitter.call(this);
  Base$7.validateOptions(options || {}, ['maxLength', 'masking', 'requireMasking', 'protocols']);

  this._request   = request;
  this._reader    = new Reader();
  this._options   = options || {};
  this._maxLength = this._options.maxLength || this.MAX_LENGTH;
  this._headers   = new Headers$2();
  this.__queue    = [];
  this.readyState = 0;
  this.url        = url;

  this.io = new streams.IO(this);
  this.messages = new streams.Messages(this);
  this._bindEventListeners();
};
util$b.inherits(Base$7, Emitter);

Base$7.isWebSocket = function(request) {
  var connection = request.headers.connection || '',
      upgrade    = request.headers.upgrade || '';

  return request.method === 'GET' &&
         connection.toLowerCase().split(/ *, */).indexOf('upgrade') >= 0 &&
         upgrade.toLowerCase() === 'websocket';
};

Base$7.validateOptions = function(options, validKeys) {
  for (var key in options) {
    if (validKeys.indexOf(key) < 0)
      throw new Error('Unrecognized option: ' + key);
  }
};

var instance$b = {
  // This is 64MB, small enough for an average VPS to handle without
  // crashing from process out of memory
  MAX_LENGTH: 0x3ffffff,

  STATES: ['connecting', 'open', 'closing', 'closed'],

  _bindEventListeners: function() {
    var self = this;

    // Protocol errors are informational and do not have to be handled
    this.messages.on('error', function() {});

    this.on('message', function(event) {
      var messages = self.messages;
      if (messages.readable) messages.emit('data', event.data);
    });

    this.on('error', function(error) {
      var messages = self.messages;
      if (messages.readable) messages.emit('error', error);
    });

    this.on('close', function() {
      var messages = self.messages;
      if (!messages.readable) return;
      messages.readable = messages.writable = false;
      messages.emit('end');
    });
  },

  getState: function() {
    return this.STATES[this.readyState] || null;
  },

  addExtension: function(extension) {
    return false;
  },

  setHeader: function(name, value) {
    if (this.readyState > 0) return false;
    this._headers.set(name, value);
    return true;
  },

  start: function() {
    if (this.readyState !== 0) return false;

    if (!Base$7.isWebSocket(this._request))
      return this._failHandshake(new Error('Not a WebSocket request'));

    var response;

    try {
      response = this._handshakeResponse();
    } catch (error) {
      return this._failHandshake(error);
    }

    this._write(response);
    if (this._stage !== -1) this._open();
    return true;
  },

  _failHandshake: function(error) {
    var headers = new Headers$2();
    headers.set('Content-Type', 'text/plain');
    headers.set('Content-Length', Buffer$8.byteLength(error.message, 'utf8'));

    headers = ['HTTP/1.1 400 Bad Request', headers.toString(), error.message];
    this._write(Buffer$8.from(headers.join('\r\n'), 'utf8'));
    this._fail('protocol_error', error.message);

    return false;
  },

  text: function(message) {
    return this.frame(message);
  },

  binary: function(message) {
    return false;
  },

  ping: function() {
    return false;
  },

  pong: function() {
      return false;
  },

  close: function(reason, code) {
    if (this.readyState !== 1) return false;
    this.readyState = 3;
    this.emit('close', new Base$7.CloseEvent(null, null));
    return true;
  },

  _open: function() {
    this.readyState = 1;
    this.__queue.forEach(function(args) { this.frame.apply(this, args); }, this);
    this.__queue = [];
    this.emit('open', new Base$7.OpenEvent());
  },

  _queue: function(message) {
    this.__queue.push(message);
    return true;
  },

  _write: function(chunk) {
    var io = this.io;
    if (io.readable) io.emit('data', chunk);
  },

  _fail: function(type, message) {
    this.readyState = 2;
    this.emit('error', new Error(message));
    this.close();
  }
};

for (var key$b in instance$b)
  Base$7.prototype[key$b] = instance$b[key$b];


Base$7.ConnectEvent = function() {};

Base$7.OpenEvent = function() {};

Base$7.CloseEvent = function(code, reason) {
  this.code   = code;
  this.reason = reason;
};

Base$7.MessageEvent = function(data) {
  this.data = data;
};

Base$7.PingEvent = function(data) {
  this.data = data;
};

Base$7.PongEvent = function(data) {
  this.data = data;
};

var base = Base$7;

var httpParser = {};

/*jshint node:true */
httpParser.HTTPParser = HTTPParser;
function HTTPParser(type) {
  if (type !== undefined && type !== HTTPParser.REQUEST && type !== HTTPParser.RESPONSE) {
    throw new Error('type must be REQUEST or RESPONSE');
  }
  if (type === undefined) ; else {
    this.initialize(type);
  }
  this.maxHeaderSize=HTTPParser.maxHeaderSize;
}
HTTPParser.prototype.initialize = function (type, async_resource) {
  if (type !== HTTPParser.REQUEST && type !== HTTPParser.RESPONSE) {
    throw new Error('type must be REQUEST or RESPONSE');
  }
  this.type = type;
  this.state = type + '_LINE';
  this.info = {
    headers: [],
    upgrade: false
  };
  this.trailers = [];
  this.line = '';
  this.isChunked = false;
  this.connection = '';
  this.headerSize = 0; // for preventing too big headers
  this.body_bytes = null;
  this.isUserCall = false;
  this.hadError = false;
};

HTTPParser.encoding = 'ascii';
HTTPParser.maxHeaderSize = 80 * 1024; // maxHeaderSize (in bytes) is configurable, but 80kb by default;
HTTPParser.REQUEST = 'REQUEST';
HTTPParser.RESPONSE = 'RESPONSE';

// Note: *not* starting with kOnHeaders=0 line the Node parser, because any
//   newly added constants (kOnTimeout in Node v12.19.0) will overwrite 0!
var kOnHeaders = HTTPParser.kOnHeaders = 1;
var kOnHeadersComplete = HTTPParser.kOnHeadersComplete = 2;
var kOnBody = HTTPParser.kOnBody = 3;
var kOnMessageComplete = HTTPParser.kOnMessageComplete = 4;

// Some handler stubs, needed for compatibility
HTTPParser.prototype[kOnHeaders] =
HTTPParser.prototype[kOnHeadersComplete] =
HTTPParser.prototype[kOnBody] =
HTTPParser.prototype[kOnMessageComplete] = function () {};

var compatMode0_12 = true;
Object.defineProperty(HTTPParser, 'kOnExecute', {
    get: function () {
      // hack for backward compatibility
      compatMode0_12 = false;
      return 99;
    }
  });

var methods = httpParser.methods = HTTPParser.methods = [
  'DELETE',
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'COPY',
  'LOCK',
  'MKCOL',
  'MOVE',
  'PROPFIND',
  'PROPPATCH',
  'SEARCH',
  'UNLOCK',
  'BIND',
  'REBIND',
  'UNBIND',
  'ACL',
  'REPORT',
  'MKACTIVITY',
  'CHECKOUT',
  'MERGE',
  'M-SEARCH',
  'NOTIFY',
  'SUBSCRIBE',
  'UNSUBSCRIBE',
  'PATCH',
  'PURGE',
  'MKCALENDAR',
  'LINK',
  'UNLINK',
  'SOURCE',
];
var method_connect = methods.indexOf('CONNECT');
HTTPParser.prototype.reinitialize = HTTPParser;
HTTPParser.prototype.close =
HTTPParser.prototype.pause =
HTTPParser.prototype.resume =
HTTPParser.prototype.remove =
HTTPParser.prototype.free = function () {};
HTTPParser.prototype._compatMode0_11 = false;
HTTPParser.prototype.getAsyncId = function() { return 0; };

var headerState = {
  REQUEST_LINE: true,
  RESPONSE_LINE: true,
  HEADER: true
};
HTTPParser.prototype.execute = function (chunk, start, length) {
  if (!(this instanceof HTTPParser)) {
    throw new TypeError('not a HTTPParser');
  }

  // backward compat to node < 0.11.4
  // Note: the start and length params were removed in newer version
  start = start || 0;
  length = typeof length === 'number' ? length : chunk.length;

  this.chunk = chunk;
  this.offset = start;
  var end = this.end = start + length;
  try {
    while (this.offset < end) {
      if (this[this.state]()) {
        break;
      }
    }
  } catch (err) {
    if (this.isUserCall) {
      throw err;
    }
    this.hadError = true;
    return err;
  }
  this.chunk = null;
  length = this.offset - start;
  if (headerState[this.state]) {
    this.headerSize += length;
    if (this.headerSize > (this.maxHeaderSize||HTTPParser.maxHeaderSize)) {
      return new Error('max header size exceeded');
    }
  }
  return length;
};

var stateFinishAllowed = {
  REQUEST_LINE: true,
  RESPONSE_LINE: true,
  BODY_RAW: true
};
HTTPParser.prototype.finish = function () {
  if (this.hadError) {
    return;
  }
  if (!stateFinishAllowed[this.state]) {
    return new Error('invalid state for EOF');
  }
  if (this.state === 'BODY_RAW') {
    this.userCall()(this[kOnMessageComplete]());
  }
};

// These three methods are used for an internal speed optimization, and it also
// works if theses are noops. Basically consume() asks us to read the bytes
// ourselves, but if we don't do it we get them through execute().
HTTPParser.prototype.consume =
HTTPParser.prototype.unconsume =
HTTPParser.prototype.getCurrentBuffer = function () {};

//For correct error handling - see HTTPParser#execute
//Usage: this.userCall()(userFunction('arg'));
HTTPParser.prototype.userCall = function () {
  this.isUserCall = true;
  var self = this;
  return function (ret) {
    self.isUserCall = false;
    return ret;
  };
};

HTTPParser.prototype.nextRequest = function () {
  this.userCall()(this[kOnMessageComplete]());
  this.reinitialize(this.type);
};

HTTPParser.prototype.consumeLine = function () {
  var end = this.end,
      chunk = this.chunk;
  for (var i = this.offset; i < end; i++) {
    if (chunk[i] === 0x0a) { // \n
      var line = this.line + chunk.toString(HTTPParser.encoding, this.offset, i);
      if (line.charAt(line.length - 1) === '\r') {
        line = line.substr(0, line.length - 1);
      }
      this.line = '';
      this.offset = i + 1;
      return line;
    }
  }
  //line split over multiple chunks
  this.line += chunk.toString(HTTPParser.encoding, this.offset, this.end);
  this.offset = this.end;
};

var headerExp = /^([^: \t]+):[ \t]*((?:.*[^ \t])|)/;
var headerContinueExp = /^[ \t]+(.*[^ \t])/;
HTTPParser.prototype.parseHeader = function (line, headers) {
  if (line.indexOf('\r') !== -1) {
    throw parseErrorCode('HPE_LF_EXPECTED');
  }

  var match = headerExp.exec(line);
  var k = match && match[1];
  if (k) { // skip empty string (malformed header)
    headers.push(k);
    headers.push(match[2]);
  } else {
    var matchContinue = headerContinueExp.exec(line);
    if (matchContinue && headers.length) {
      if (headers[headers.length - 1]) {
        headers[headers.length - 1] += ' ';
      }
      headers[headers.length - 1] += matchContinue[1];
    }
  }
};

var requestExp = /^([A-Z-]+) ([^ ]+) HTTP\/(\d)\.(\d)$/;
HTTPParser.prototype.REQUEST_LINE = function () {
  var line = this.consumeLine();
  if (!line) {
    return;
  }
  var match = requestExp.exec(line);
  if (match === null) {
    throw parseErrorCode('HPE_INVALID_CONSTANT');
  }
  this.info.method = this._compatMode0_11 ? match[1] : methods.indexOf(match[1]);
  if (this.info.method === -1) {
    throw new Error('invalid request method');
  }
  this.info.url = match[2];
  this.info.versionMajor = +match[3];
  this.info.versionMinor = +match[4];
  this.body_bytes = 0;
  this.state = 'HEADER';
};

var responseExp = /^HTTP\/(\d)\.(\d) (\d{3}) ?(.*)$/;
HTTPParser.prototype.RESPONSE_LINE = function () {
  var line = this.consumeLine();
  if (!line) {
    return;
  }
  var match = responseExp.exec(line);
  if (match === null) {
    throw parseErrorCode('HPE_INVALID_CONSTANT');
  }
  this.info.versionMajor = +match[1];
  this.info.versionMinor = +match[2];
  var statusCode = this.info.statusCode = +match[3];
  this.info.statusMessage = match[4];
  // Implied zero length.
  if ((statusCode / 100 | 0) === 1 || statusCode === 204 || statusCode === 304) {
    this.body_bytes = 0;
  }
  this.state = 'HEADER';
};

HTTPParser.prototype.shouldKeepAlive = function () {
  if (this.info.versionMajor > 0 && this.info.versionMinor > 0) {
    if (this.connection.indexOf('close') !== -1) {
      return false;
    }
  } else if (this.connection.indexOf('keep-alive') === -1) {
    return false;
  }
  if (this.body_bytes !== null || this.isChunked) { // || skipBody
    return true;
  }
  return false;
};

HTTPParser.prototype.HEADER = function () {
  var line = this.consumeLine();
  if (line === undefined) {
    return;
  }
  var info = this.info;
  if (line) {
    this.parseHeader(line, info.headers);
  } else {
    var headers = info.headers;
    var hasContentLength = false;
    var currentContentLengthValue;
    var hasUpgradeHeader = false;
    for (var i = 0; i < headers.length; i += 2) {
      switch (headers[i].toLowerCase()) {
        case 'transfer-encoding':
          this.isChunked = headers[i + 1].toLowerCase() === 'chunked';
          break;
        case 'content-length':
          currentContentLengthValue = +headers[i + 1];
          if (hasContentLength) {
            // Fix duplicate Content-Length header with same values.
            // Throw error only if values are different.
            // Known issues:
            // https://github.com/request/request/issues/2091#issuecomment-328715113
            // https://github.com/nodejs/node/issues/6517#issuecomment-216263771
            if (currentContentLengthValue !== this.body_bytes) {
              throw parseErrorCode('HPE_UNEXPECTED_CONTENT_LENGTH');
            }
          } else {
            hasContentLength = true;
            this.body_bytes = currentContentLengthValue;
          }
          break;
        case 'connection':
          this.connection += headers[i + 1].toLowerCase();
          break;
        case 'upgrade':
          hasUpgradeHeader = true;
          break;
      }
    }

    // if both isChunked and hasContentLength, isChunked wins
    // This is required so the body is parsed using the chunked method, and matches
    // Chrome's behavior.  We could, maybe, ignore them both (would get chunked
    // encoding into the body), and/or disable shouldKeepAlive to be more
    // resilient.
    if (this.isChunked && hasContentLength) {
      hasContentLength = false;
      this.body_bytes = null;
    }

    // Logic from https://github.com/nodejs/http-parser/blob/921d5585515a153fa00e411cf144280c59b41f90/http_parser.c#L1727-L1737
    // "For responses, "Upgrade: foo" and "Connection: upgrade" are
    //   mandatory only when it is a 101 Switching Protocols response,
    //   otherwise it is purely informational, to announce support.
    if (hasUpgradeHeader && this.connection.indexOf('upgrade') != -1) {
      info.upgrade = this.type === HTTPParser.REQUEST || info.statusCode === 101;
    } else {
      info.upgrade = info.method === method_connect;
    }

    if (this.isChunked && info.upgrade) {
      this.isChunked = false;
    }

    info.shouldKeepAlive = this.shouldKeepAlive();
    //problem which also exists in original node: we should know skipBody before calling onHeadersComplete
    var skipBody;
    if (compatMode0_12) {
      skipBody = this.userCall()(this[kOnHeadersComplete](info));
    } else {
      skipBody = this.userCall()(this[kOnHeadersComplete](info.versionMajor,
          info.versionMinor, info.headers, info.method, info.url, info.statusCode,
          info.statusMessage, info.upgrade, info.shouldKeepAlive));
    }
    if (skipBody === 2) {
      this.nextRequest();
      return true;
    } else if (this.isChunked && !skipBody) {
      this.state = 'BODY_CHUNKHEAD';
    } else if (skipBody || this.body_bytes === 0) {
      this.nextRequest();
      // For older versions of node (v6.x and older?), that return skipBody=1 or skipBody=true,
      //   need this "return true;" if it's an upgrade request.
      return info.upgrade;
    } else if (this.body_bytes === null) {
      this.state = 'BODY_RAW';
    } else {
      this.state = 'BODY_SIZED';
    }
  }
};

HTTPParser.prototype.BODY_CHUNKHEAD = function () {
  var line = this.consumeLine();
  if (line === undefined) {
    return;
  }
  this.body_bytes = parseInt(line, 16);
  if (!this.body_bytes) {
    this.state = 'BODY_CHUNKTRAILERS';
  } else {
    this.state = 'BODY_CHUNK';
  }
};

HTTPParser.prototype.BODY_CHUNK = function () {
  var length = Math.min(this.end - this.offset, this.body_bytes);
  // 0, length are for backwards compatibility. See: https://github.com/creationix/http-parser-js/pull/98
  this.userCall()(this[kOnBody](this.chunk.slice(this.offset, this.offset + length), 0, length));
  this.offset += length;
  this.body_bytes -= length;
  if (!this.body_bytes) {
    this.state = 'BODY_CHUNKEMPTYLINE';
  }
};

HTTPParser.prototype.BODY_CHUNKEMPTYLINE = function () {
  var line = this.consumeLine();
  if (line === undefined) {
    return;
  }
  if (line !== '') {
    throw new Error('Expected empty line');
  }
  this.state = 'BODY_CHUNKHEAD';
};

HTTPParser.prototype.BODY_CHUNKTRAILERS = function () {
  var line = this.consumeLine();
  if (line === undefined) {
    return;
  }
  if (line) {
    this.parseHeader(line, this.trailers);
  } else {
    if (this.trailers.length) {
      this.userCall()(this[kOnHeaders](this.trailers, ''));
    }
    this.nextRequest();
  }
};

HTTPParser.prototype.BODY_RAW = function () {
  // 0, length are for backwards compatibility. See: https://github.com/creationix/http-parser-js/pull/98
  this.userCall()(this[kOnBody](this.chunk.slice(this.offset, this.end), 0, this.end - this.offset));
  this.offset = this.end;
};

HTTPParser.prototype.BODY_SIZED = function () {
  var length = Math.min(this.end - this.offset, this.body_bytes);
  // 0, length are for backwards compatibility. See: https://github.com/creationix/http-parser-js/pull/98
  this.userCall()(this[kOnBody](this.chunk.slice(this.offset, this.offset + length), 0, length));
  this.offset += length;
  this.body_bytes -= length;
  if (!this.body_bytes) {
    this.nextRequest();
  }
};

// backward compat to node < 0.11.6
['Headers', 'HeadersComplete', 'Body', 'MessageComplete'].forEach(function (name) {
  var k = HTTPParser['kOn' + name];
  Object.defineProperty(HTTPParser.prototype, 'on' + name, {
    get: function () {
      return this[k];
    },
    set: function (to) {
      // hack for backward compatibility
      this._compatMode0_11 = true;
      method_connect = 'CONNECT';
      return (this[k] = to);
    }
  });
});

function parseErrorCode(code) {
  var err = new Error('Parse Error');
  err.code = code;
  return err;
}

var NodeHTTPParser = httpParser.HTTPParser,
    Buffer$7         = safeBuffer.exports.Buffer;

var TYPES = {
  request:  NodeHTTPParser.REQUEST  || 'request',
  response: NodeHTTPParser.RESPONSE || 'response'
};

var HttpParser$3 = function(type) {
  this._type     = type;
  this._parser   = new NodeHTTPParser(TYPES[type]);
  this._complete = false;
  this.headers   = {};

  var current = null,
      self    = this;

  this._parser.onHeaderField = function(b, start, length) {
    current = b.toString('utf8', start, start + length).toLowerCase();
  };

  this._parser.onHeaderValue = function(b, start, length) {
    var value = b.toString('utf8', start, start + length);

    if (self.headers.hasOwnProperty(current))
      self.headers[current] += ', ' + value;
    else
      self.headers[current] = value;
  };

  this._parser.onHeadersComplete = this._parser[NodeHTTPParser.kOnHeadersComplete] =
  function(majorVersion, minorVersion, headers, method, pathname, statusCode) {
    var info = arguments[0];

    if (typeof info === 'object') {
      method     = info.method;
      pathname   = info.url;
      statusCode = info.statusCode;
      headers    = info.headers;
    }

    self.method     = (typeof method === 'number') ? HttpParser$3.METHODS[method] : method;
    self.statusCode = statusCode;
    self.url        = pathname;

    if (!headers) return;

    for (var i = 0, n = headers.length, key, value; i < n; i += 2) {
      key   = headers[i].toLowerCase();
      value = headers[i+1];
      if (self.headers.hasOwnProperty(key))
        self.headers[key] += ', ' + value;
      else
        self.headers[key] = value;
    }

    self._complete = true;
  };
};

HttpParser$3.METHODS = {
  0:  'DELETE',
  1:  'GET',
  2:  'HEAD',
  3:  'POST',
  4:  'PUT',
  5:  'CONNECT',
  6:  'OPTIONS',
  7:  'TRACE',
  8:  'COPY',
  9:  'LOCK',
  10: 'MKCOL',
  11: 'MOVE',
  12: 'PROPFIND',
  13: 'PROPPATCH',
  14: 'SEARCH',
  15: 'UNLOCK',
  16: 'BIND',
  17: 'REBIND',
  18: 'UNBIND',
  19: 'ACL',
  20: 'REPORT',
  21: 'MKACTIVITY',
  22: 'CHECKOUT',
  23: 'MERGE',
  24: 'M-SEARCH',
  25: 'NOTIFY',
  26: 'SUBSCRIBE',
  27: 'UNSUBSCRIBE',
  28: 'PATCH',
  29: 'PURGE',
  30: 'MKCALENDAR',
  31: 'LINK',
  32: 'UNLINK'
};

var VERSION = process.version
  ? process.version.match(/[0-9]+/g).map(function(n) { return parseInt(n, 10) })
  : [];

if (VERSION[0] === 0 && VERSION[1] === 12) {
  HttpParser$3.METHODS[16] = 'REPORT';
  HttpParser$3.METHODS[17] = 'MKACTIVITY';
  HttpParser$3.METHODS[18] = 'CHECKOUT';
  HttpParser$3.METHODS[19] = 'MERGE';
  HttpParser$3.METHODS[20] = 'M-SEARCH';
  HttpParser$3.METHODS[21] = 'NOTIFY';
  HttpParser$3.METHODS[22] = 'SUBSCRIBE';
  HttpParser$3.METHODS[23] = 'UNSUBSCRIBE';
  HttpParser$3.METHODS[24] = 'PATCH';
  HttpParser$3.METHODS[25] = 'PURGE';
}

HttpParser$3.prototype.isComplete = function() {
  return this._complete;
};

HttpParser$3.prototype.parse = function(chunk) {
  var consumed = this._parser.execute(chunk, 0, chunk.length);

  if (typeof consumed !== 'number') {
    this.error     = consumed;
    this._complete = true;
    return;
  }

  if (this._complete)
    this.body = (consumed < chunk.length)
              ? chunk.slice(consumed)
              : Buffer$7.alloc(0);
};

var http_parser = HttpParser$3;

var TOKEN    = /([!#\$%&'\*\+\-\.\^_`\|~0-9A-Za-z]+)/,
    NOTOKEN  = /([^!#\$%&'\*\+\-\.\^_`\|~0-9A-Za-z])/g,
    QUOTED   = /"((?:\\[\x00-\x7f]|[^\x00-\x08\x0a-\x1f\x7f"\\])*)"/,
    PARAM    = new RegExp(TOKEN.source + '(?:=(?:' + TOKEN.source + '|' + QUOTED.source + '))?'),
    EXT      = new RegExp(TOKEN.source + '(?: *; *' + PARAM.source + ')*', 'g'),
    EXT_LIST = new RegExp('^' + EXT.source + '(?: *, *' + EXT.source + ')*$'),
    NUMBER   = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;

var hasOwnProperty = Object.prototype.hasOwnProperty;

var Parser$1 = {
  parseHeader: function(header) {
    var offers = new Offers();
    if (header === '' || header === undefined) return offers;

    if (!EXT_LIST.test(header))
      throw new SyntaxError('Invalid Sec-WebSocket-Extensions header: ' + header);

    var values = header.match(EXT);

    values.forEach(function(value) {
      var params = value.match(new RegExp(PARAM.source, 'g')),
          name   = params.shift(),
          offer  = {};

      params.forEach(function(param) {
        var args = param.match(PARAM), key = args[1], data;

        if (args[2] !== undefined) {
          data = args[2];
        } else if (args[3] !== undefined) {
          data = args[3].replace(/\\/g, '');
        } else {
          data = true;
        }
        if (NUMBER.test(data)) data = parseFloat(data);

        if (hasOwnProperty.call(offer, key)) {
          offer[key] = [].concat(offer[key]);
          offer[key].push(data);
        } else {
          offer[key] = data;
        }
      }, this);
      offers.push(name, offer);
    }, this);

    return offers;
  },

  serializeParams: function(name, params) {
    var values = [];

    var print = function(key, value) {
      if (value instanceof Array) {
        value.forEach(function(v) { print(key, v); });
      } else if (value === true) {
        values.push(key);
      } else if (typeof value === 'number') {
        values.push(key + '=' + value);
      } else if (NOTOKEN.test(value)) {
        values.push(key + '="' + value.replace(/"/g, '\\"') + '"');
      } else {
        values.push(key + '=' + value);
      }
    };

    for (var key in params) print(key, params[key]);

    return [name].concat(values).join('; ');
  }
};

var Offers = function() {
  this._byName  = {};
  this._inOrder = [];
};

Offers.prototype.push = function(name, params) {
  if (!hasOwnProperty.call(this._byName, name))
    this._byName[name] = [];

  this._byName[name].push(params);
  this._inOrder.push({ name: name, params: params });
};

Offers.prototype.eachOffer = function(callback, context) {
  var list = this._inOrder;
  for (var i = 0, n = list.length; i < n; i++)
    callback.call(context, list[i].name, list[i].params);
};

Offers.prototype.byName = function(name) {
  return this._byName[name] || [];
};

Offers.prototype.toArray = function() {
  return this._inOrder.slice();
};

var parser = Parser$1;

var RingBuffer$2 = function(bufferSize) {
  this._bufferSize = bufferSize;
  this.clear();
};

RingBuffer$2.prototype.clear = function() {
  this._buffer     = new Array(this._bufferSize);
  this._ringOffset = 0;
  this._ringSize   = this._bufferSize;
  this._head       = 0;
  this._tail       = 0;
  this.length      = 0;
};

RingBuffer$2.prototype.push = function(value) {
  var expandBuffer = false,
      expandRing   = false;

  if (this._ringSize < this._bufferSize) {
    expandBuffer = (this._tail === 0);
  } else if (this._ringOffset === this._ringSize) {
    expandBuffer = true;
    expandRing   = (this._tail === 0);
  }

  if (expandBuffer) {
    this._tail       = this._bufferSize;
    this._buffer     = this._buffer.concat(new Array(this._bufferSize));
    this._bufferSize = this._buffer.length;

    if (expandRing)
      this._ringSize = this._bufferSize;
  }

  this._buffer[this._tail] = value;
  this.length += 1;
  if (this._tail < this._ringSize) this._ringOffset += 1;
  this._tail = (this._tail + 1) % this._bufferSize;
};

RingBuffer$2.prototype.peek = function() {
  if (this.length === 0) return void 0;
  return this._buffer[this._head];
};

RingBuffer$2.prototype.shift = function() {
  if (this.length === 0) return void 0;

  var value = this._buffer[this._head];
  this._buffer[this._head] = void 0;
  this.length -= 1;
  this._ringOffset -= 1;

  if (this._ringOffset === 0 && this.length > 0) {
    this._head       = this._ringSize;
    this._ringOffset = this.length;
    this._ringSize   = this._bufferSize;
  } else {
    this._head = (this._head + 1) % this._ringSize;
  }
  return value;
};

var ring_buffer = RingBuffer$2;

var RingBuffer$1 = ring_buffer;

var Functor$1 = function(session, method) {
  this._session = session;
  this._method  = method;
  this._queue   = new RingBuffer$1(Functor$1.QUEUE_SIZE);
  this._stopped = false;
  this.pending  = 0;
};

Functor$1.QUEUE_SIZE = 8;

Functor$1.prototype.call = function(error, message, callback, context) {
  if (this._stopped) return;

  var record = { error: error, message: message, callback: callback, context: context, done: false },
      called = false,
      self   = this;

  this._queue.push(record);

  if (record.error) {
    record.done = true;
    this._stop();
    return this._flushQueue();
  }

  var handler = function(err, msg) {
    if (!(called ^ (called = true))) return;

    if (err) {
      self._stop();
      record.error   = err;
      record.message = null;
    } else {
      record.message = msg;
    }

    record.done = true;
    self._flushQueue();
  };

  try {
    this._session[this._method](message, handler);
  } catch (err) {
    handler(err);
  }
};

Functor$1.prototype._stop = function() {
  this.pending  = this._queue.length;
  this._stopped = true;
};

Functor$1.prototype._flushQueue = function() {
  var queue = this._queue, record;

  while (queue.length > 0 && queue.peek().done) {
    record = queue.shift();
    if (record.error) {
      this.pending = 0;
      queue.clear();
    } else {
      this.pending -= 1;
    }
    record.callback.call(record.context, record.error, record.message);
  }
};

var functor = Functor$1;

var RingBuffer = ring_buffer;

var Pledge$2 = function() {
  this._complete  = false;
  this._callbacks = new RingBuffer(Pledge$2.QUEUE_SIZE);
};

Pledge$2.QUEUE_SIZE = 4;

Pledge$2.all = function(list) {
  var pledge  = new Pledge$2(),
      pending = list.length,
      n       = pending;

  if (pending === 0) pledge.done();

  while (n--) list[n].then(function() {
    pending -= 1;
    if (pending === 0) pledge.done();
  });
  return pledge;
};

Pledge$2.prototype.then = function(callback) {
  if (this._complete) callback();
  else this._callbacks.push(callback);
};

Pledge$2.prototype.done = function() {
  this._complete = true;
  var callbacks = this._callbacks, callback;
  while (callback = callbacks.shift()) callback();
};

var pledge = Pledge$2;

var Functor = functor,
    Pledge$1  = pledge;

var Cell$1 = function(tuple) {
  this._ext     = tuple[0];
  this._session = tuple[1];

  this._functors = {
    incoming: new Functor(this._session, 'processIncomingMessage'),
    outgoing: new Functor(this._session, 'processOutgoingMessage')
  };
};

Cell$1.prototype.pending = function(direction) {
  var functor = this._functors[direction];
  if (!functor._stopped) functor.pending += 1;
};

Cell$1.prototype.incoming = function(error, message, callback, context) {
  this._exec('incoming', error, message, callback, context);
};

Cell$1.prototype.outgoing = function(error, message, callback, context) {
  this._exec('outgoing', error, message, callback, context);
};

Cell$1.prototype.close = function() {
  this._closed = this._closed || new Pledge$1();
  this._doClose();
  return this._closed;
};

Cell$1.prototype._exec = function(direction, error, message, callback, context) {
  this._functors[direction].call(error, message, function(err, msg) {
    if (err) err.message = this._ext.name + ': ' + err.message;
    callback.call(context, err, msg);
    this._doClose();
  }, this);
};

Cell$1.prototype._doClose = function() {
  var fin  = this._functors.incoming,
      fout = this._functors.outgoing;

  if (!this._closed || fin.pending + fout.pending !== 0) return;
  if (this._session) this._session.close();
  this._session = null;
  this._closed.done();
};

var cell = Cell$1;

var Cell   = cell,
    Pledge = pledge;

var Pipeline$1 = function(sessions) {
  this._cells   = sessions.map(function(session) { return new Cell(session) });
  this._stopped = { incoming: false, outgoing: false };
};

Pipeline$1.prototype.processIncomingMessage = function(message, callback, context) {
  if (this._stopped.incoming) return;
  this._loop('incoming', this._cells.length - 1, -1, -1, message, callback, context);
};

Pipeline$1.prototype.processOutgoingMessage = function(message, callback, context) {
  if (this._stopped.outgoing) return;
  this._loop('outgoing', 0, this._cells.length, 1, message, callback, context);
};

Pipeline$1.prototype.close = function(callback, context) {
  this._stopped = { incoming: true, outgoing: true };

  var closed = this._cells.map(function(a) { return a.close() });
  if (callback)
    Pledge.all(closed).then(function() { callback.call(context); });
};

Pipeline$1.prototype._loop = function(direction, start, end, step, message, callback, context) {
  var cells = this._cells,
      n     = cells.length,
      self  = this;

  while (n--) cells[n].pending(direction);

  var pipe = function(index, error, msg) {
    if (index === end) return callback.call(context, error, msg);

    cells[index][direction](error, msg, function(err, m) {
      if (err) self._stopped[direction] = true;
      pipe(index + step, err, m);
    });
  };
  pipe(start, null, message);
};

var pipeline = Pipeline$1;

var Parser   = parser,
    Pipeline = pipeline;

var Extensions$1 = function() {
  this._rsv1 = this._rsv2 = this._rsv3 = null;

  this._byName   = {};
  this._inOrder  = [];
  this._sessions = [];
  this._index    = {};
};

Extensions$1.MESSAGE_OPCODES = [1, 2];

var instance$a = {
  add: function(ext) {
    if (typeof ext.name !== 'string') throw new TypeError('extension.name must be a string');
    if (ext.type !== 'permessage') throw new TypeError('extension.type must be "permessage"');

    if (typeof ext.rsv1 !== 'boolean') throw new TypeError('extension.rsv1 must be true or false');
    if (typeof ext.rsv2 !== 'boolean') throw new TypeError('extension.rsv2 must be true or false');
    if (typeof ext.rsv3 !== 'boolean') throw new TypeError('extension.rsv3 must be true or false');

    if (this._byName.hasOwnProperty(ext.name))
      throw new TypeError('An extension with name "' + ext.name + '" is already registered');

    this._byName[ext.name] = ext;
    this._inOrder.push(ext);
  },

  generateOffer: function() {
    var sessions = [],
        offer    = [],
        index    = {};

    this._inOrder.forEach(function(ext) {
      var session = ext.createClientSession();
      if (!session) return;

      var record = [ext, session];
      sessions.push(record);
      index[ext.name] = record;

      var offers = session.generateOffer();
      offers = offers ? [].concat(offers) : [];

      offers.forEach(function(off) {
        offer.push(Parser.serializeParams(ext.name, off));
      }, this);
    }, this);

    this._sessions = sessions;
    this._index    = index;

    return offer.length > 0 ? offer.join(', ') : null;
  },

  activate: function(header) {
    var responses = Parser.parseHeader(header),
        sessions  = [];

    responses.eachOffer(function(name, params) {
      var record = this._index[name];

      if (!record)
        throw new Error('Server sent an extension response for unknown extension "' + name + '"');

      var ext      = record[0],
          session  = record[1],
          reserved = this._reserved(ext);

      if (reserved)
        throw new Error('Server sent two extension responses that use the RSV' +
                        reserved[0] + ' bit: "' +
                        reserved[1] + '" and "' + ext.name + '"');

      if (session.activate(params) !== true)
        throw new Error('Server sent unacceptable extension parameters: ' +
                        Parser.serializeParams(name, params));

      this._reserve(ext);
      sessions.push(record);
    }, this);

    this._sessions = sessions;
    this._pipeline = new Pipeline(sessions);
  },

  generateResponse: function(header) {
    var sessions = [],
        response = [],
        offers   = Parser.parseHeader(header);

    this._inOrder.forEach(function(ext) {
      var offer = offers.byName(ext.name);
      if (offer.length === 0 || this._reserved(ext)) return;

      var session = ext.createServerSession(offer);
      if (!session) return;

      this._reserve(ext);
      sessions.push([ext, session]);
      response.push(Parser.serializeParams(ext.name, session.generateResponse()));
    }, this);

    this._sessions = sessions;
    this._pipeline = new Pipeline(sessions);

    return response.length > 0 ? response.join(', ') : null;
  },

  validFrameRsv: function(frame) {
    var allowed = { rsv1: false, rsv2: false, rsv3: false },
        ext;

    if (Extensions$1.MESSAGE_OPCODES.indexOf(frame.opcode) >= 0) {
      for (var i = 0, n = this._sessions.length; i < n; i++) {
        ext = this._sessions[i][0];
        allowed.rsv1 = allowed.rsv1 || ext.rsv1;
        allowed.rsv2 = allowed.rsv2 || ext.rsv2;
        allowed.rsv3 = allowed.rsv3 || ext.rsv3;
      }
    }

    return (allowed.rsv1 || !frame.rsv1) &&
           (allowed.rsv2 || !frame.rsv2) &&
           (allowed.rsv3 || !frame.rsv3);
  },

  processIncomingMessage: function(message, callback, context) {
    this._pipeline.processIncomingMessage(message, callback, context);
  },

  processOutgoingMessage: function(message, callback, context) {
    this._pipeline.processOutgoingMessage(message, callback, context);
  },

  close: function(callback, context) {
    if (!this._pipeline) return callback.call(context);
    this._pipeline.close(callback, context);
  },

  _reserve: function(ext) {
    this._rsv1 = this._rsv1 || (ext.rsv1 && ext.name);
    this._rsv2 = this._rsv2 || (ext.rsv2 && ext.name);
    this._rsv3 = this._rsv3 || (ext.rsv3 && ext.name);
  },

  _reserved: function(ext) {
    if (this._rsv1 && ext.rsv1) return [1, this._rsv1];
    if (this._rsv2 && ext.rsv2) return [2, this._rsv2];
    if (this._rsv3 && ext.rsv3) return [3, this._rsv3];
    return false;
  }
};

for (var key$a in instance$a)
  Extensions$1.prototype[key$a] = instance$a[key$a];

var websocket_extensions = Extensions$1;

var Frame$1 = function() {};

var instance$9 = {
  final:        false,
  rsv1:         false,
  rsv2:         false,
  rsv3:         false,
  opcode:       null,
  masked:       false,
  maskingKey:   null,
  lengthBytes:  1,
  length:       0,
  payload:      null
};

for (var key$9 in instance$9)
  Frame$1.prototype[key$9] = instance$9[key$9];

var frame = Frame$1;

var Buffer$6 = safeBuffer.exports.Buffer;

var Message$1 = function() {
  this.rsv1    = false;
  this.rsv2    = false;
  this.rsv3    = false;
  this.opcode  = null;
  this.length  = 0;
  this._chunks = [];
};

var instance$8 = {
  read: function() {
    return this.data = this.data || Buffer$6.concat(this._chunks, this.length);
  },

  pushFrame: function(frame) {
    this.rsv1 = this.rsv1 || frame.rsv1;
    this.rsv2 = this.rsv2 || frame.rsv2;
    this.rsv3 = this.rsv3 || frame.rsv3;

    if (this.opcode === null) this.opcode = frame.opcode;

    this._chunks.push(frame.payload);
    this.length += frame.length;
  }
};

for (var key$8 in instance$8)
  Message$1.prototype[key$8] = instance$8[key$8];

var message = Message$1;

var Buffer$5     = safeBuffer.exports.Buffer,
    crypto$2     = require$$1__default$1["default"],
    util$a       = require$$2__default["default"],
    Extensions = websocket_extensions,
    Base$6       = base,
    Frame      = frame,
    Message    = message;

var Hybi$2 = function(request, url, options) {
  Base$6.apply(this, arguments);

  this._extensions     = new Extensions();
  this._stage          = 0;
  this._masking        = this._options.masking;
  this._protocols      = this._options.protocols || [];
  this._requireMasking = this._options.requireMasking;
  this._pingCallbacks  = {};

  if (typeof this._protocols === 'string')
    this._protocols = this._protocols.split(/ *, */);

  if (!this._request) return;

  var protos    = this._request.headers['sec-websocket-protocol'],
      supported = this._protocols;

  if (protos !== undefined) {
    if (typeof protos === 'string') protos = protos.split(/ *, */);
    this.protocol = protos.filter(function(p) { return supported.indexOf(p) >= 0 })[0];
  }

  this.version = 'hybi-' + Hybi$2.VERSION;
};
util$a.inherits(Hybi$2, Base$6);

Hybi$2.VERSION = '13';

Hybi$2.mask = function(payload, mask, offset) {
  if (!mask || mask.length === 0) return payload;
  offset = offset || 0;

  for (var i = 0, n = payload.length - offset; i < n; i++) {
    payload[offset + i] = payload[offset + i] ^ mask[i % 4];
  }
  return payload;
};

Hybi$2.generateAccept = function(key) {
  var sha1 = crypto$2.createHash('sha1');
  sha1.update(key + Hybi$2.GUID);
  return sha1.digest('base64');
};

Hybi$2.GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

var instance$7 = {
  FIN:    0x80,
  MASK:   0x80,
  RSV1:   0x40,
  RSV2:   0x20,
  RSV3:   0x10,
  OPCODE: 0x0F,
  LENGTH: 0x7F,

  OPCODES: {
    continuation: 0,
    text:         1,
    binary:       2,
    close:        8,
    ping:         9,
    pong:         10
  },

  OPCODE_CODES:    [0, 1, 2, 8, 9, 10],
  MESSAGE_OPCODES: [0, 1, 2],
  OPENING_OPCODES: [1, 2],

  ERRORS: {
    normal_closure:       1000,
    going_away:           1001,
    protocol_error:       1002,
    unacceptable:         1003,
    encoding_error:       1007,
    policy_violation:     1008,
    too_large:            1009,
    extension_error:      1010,
    unexpected_condition: 1011
  },

  ERROR_CODES:        [1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011],
  DEFAULT_ERROR_CODE: 1000,
  MIN_RESERVED_ERROR: 3000,
  MAX_RESERVED_ERROR: 4999,

  // http://www.w3.org/International/questions/qa-forms-utf-8.en.php
  UTF8_MATCH: /^([\x00-\x7F]|[\xC2-\xDF][\x80-\xBF]|\xE0[\xA0-\xBF][\x80-\xBF]|[\xE1-\xEC\xEE\xEF][\x80-\xBF]{2}|\xED[\x80-\x9F][\x80-\xBF]|\xF0[\x90-\xBF][\x80-\xBF]{2}|[\xF1-\xF3][\x80-\xBF]{3}|\xF4[\x80-\x8F][\x80-\xBF]{2})*$/,

  addExtension: function(extension) {
    this._extensions.add(extension);
    return true;
  },

  parse: function(chunk) {
    this._reader.put(chunk);
    var buffer = true;
    while (buffer) {
      switch (this._stage) {
        case 0:
          buffer = this._reader.read(1);
          if (buffer) this._parseOpcode(buffer[0]);
          break;

        case 1:
          buffer = this._reader.read(1);
          if (buffer) this._parseLength(buffer[0]);
          break;

        case 2:
          buffer = this._reader.read(this._frame.lengthBytes);
          if (buffer) this._parseExtendedLength(buffer);
          break;

        case 3:
          buffer = this._reader.read(4);
          if (buffer) {
            this._stage = 4;
            this._frame.maskingKey = buffer;
          }
          break;

        case 4:
          buffer = this._reader.read(this._frame.length);
          if (buffer) {
            this._stage = 0;
            this._emitFrame(buffer);
          }
          break;

        default:
          buffer = null;
      }
    }
  },

  text: function(message) {
    if (this.readyState > 1) return false;
    return this.frame(message, 'text');
  },

  binary: function(message) {
    if (this.readyState > 1) return false;
    return this.frame(message, 'binary');
  },

  ping: function(message, callback) {
    if (this.readyState > 1) return false;
    message = message || '';
    if (callback) this._pingCallbacks[message] = callback;
    return this.frame(message, 'ping');
  },

  pong: function(message) {
      if (this.readyState > 1) return false;
      message = message ||'';
      return this.frame(message, 'pong');
  },

  close: function(reason, code) {
    reason = reason || '';
    code   = code   || this.ERRORS.normal_closure;

    if (this.readyState <= 0) {
      this.readyState = 3;
      this.emit('close', new Base$6.CloseEvent(code, reason));
      return true;
    } else if (this.readyState === 1) {
      this.readyState = 2;
      this._extensions.close(function() { this.frame(reason, 'close', code); }, this);
      return true;
    } else {
      return false;
    }
  },

  frame: function(buffer, type, code) {
    if (this.readyState <= 0) return this._queue([buffer, type, code]);
    if (this.readyState > 2) return false;

    if (buffer instanceof Array)    buffer = Buffer$5.from(buffer);
    if (typeof buffer === 'number') buffer = buffer.toString();

    var message = new Message(),
        isText  = (typeof buffer === 'string'),
        payload, copy;

    message.rsv1   = message.rsv2 = message.rsv3 = false;
    message.opcode = this.OPCODES[type || (isText ? 'text' : 'binary')];

    payload = isText ? Buffer$5.from(buffer, 'utf8') : buffer;

    if (code) {
      copy = payload;
      payload = Buffer$5.allocUnsafe(2 + copy.length);
      payload.writeUInt16BE(code, 0);
      copy.copy(payload, 2);
    }
    message.data = payload;

    var onMessageReady = function(message) {
      var frame = new Frame();

      frame.final   = true;
      frame.rsv1    = message.rsv1;
      frame.rsv2    = message.rsv2;
      frame.rsv3    = message.rsv3;
      frame.opcode  = message.opcode;
      frame.masked  = !!this._masking;
      frame.length  = message.data.length;
      frame.payload = message.data;

      if (frame.masked) frame.maskingKey = crypto$2.randomBytes(4);

      this._sendFrame(frame);
    };

    if (this.MESSAGE_OPCODES.indexOf(message.opcode) >= 0)
      this._extensions.processOutgoingMessage(message, function(error, message) {
        if (error) return this._fail('extension_error', error.message);
        onMessageReady.call(this, message);
      }, this);
    else
      onMessageReady.call(this, message);

    return true;
  },

  _sendFrame: function(frame) {
    var length = frame.length,
        header = (length <= 125) ? 2 : (length <= 65535 ? 4 : 10),
        offset = header + (frame.masked ? 4 : 0),
        buffer = Buffer$5.allocUnsafe(offset + length),
        masked = frame.masked ? this.MASK : 0;

    buffer[0] = (frame.final ? this.FIN : 0) |
                (frame.rsv1 ? this.RSV1 : 0) |
                (frame.rsv2 ? this.RSV2 : 0) |
                (frame.rsv3 ? this.RSV3 : 0) |
                frame.opcode;

    if (length <= 125) {
      buffer[1] = masked | length;
    } else if (length <= 65535) {
      buffer[1] = masked | 126;
      buffer.writeUInt16BE(length, 2);
    } else {
      buffer[1] = masked | 127;
      buffer.writeUInt32BE(Math.floor(length / 0x100000000), 2);
      buffer.writeUInt32BE(length % 0x100000000, 6);
    }

    frame.payload.copy(buffer, offset);

    if (frame.masked) {
      frame.maskingKey.copy(buffer, header);
      Hybi$2.mask(buffer, frame.maskingKey, offset);
    }

    this._write(buffer);
  },

  _handshakeResponse: function() {
    var secKey  = this._request.headers['sec-websocket-key'],
        version = this._request.headers['sec-websocket-version'];

    if (version !== Hybi$2.VERSION)
      throw new Error('Unsupported WebSocket version: ' + version);

    if (typeof secKey !== 'string')
      throw new Error('Missing handshake request header: Sec-WebSocket-Key');

    this._headers.set('Upgrade', 'websocket');
    this._headers.set('Connection', 'Upgrade');
    this._headers.set('Sec-WebSocket-Accept', Hybi$2.generateAccept(secKey));

    if (this.protocol) this._headers.set('Sec-WebSocket-Protocol', this.protocol);

    var extensions = this._extensions.generateResponse(this._request.headers['sec-websocket-extensions']);
    if (extensions) this._headers.set('Sec-WebSocket-Extensions', extensions);

    var start   = 'HTTP/1.1 101 Switching Protocols',
        headers = [start, this._headers.toString(), ''];

    return Buffer$5.from(headers.join('\r\n'), 'utf8');
  },

  _shutdown: function(code, reason, error) {
    delete this._frame;
    delete this._message;
    this._stage = 5;

    var sendCloseFrame = (this.readyState === 1);
    this.readyState = 2;

    this._extensions.close(function() {
      if (sendCloseFrame) this.frame(reason, 'close', code);
      this.readyState = 3;
      if (error) this.emit('error', new Error(reason));
      this.emit('close', new Base$6.CloseEvent(code, reason));
    }, this);
  },

  _fail: function(type, message) {
    if (this.readyState > 1) return;
    this._shutdown(this.ERRORS[type], message, true);
  },

  _parseOpcode: function(octet) {
    var rsvs = [this.RSV1, this.RSV2, this.RSV3].map(function(rsv) {
      return (octet & rsv) === rsv;
    });

    var frame = this._frame = new Frame();

    frame.final  = (octet & this.FIN) === this.FIN;
    frame.rsv1   = rsvs[0];
    frame.rsv2   = rsvs[1];
    frame.rsv3   = rsvs[2];
    frame.opcode = (octet & this.OPCODE);

    this._stage = 1;

    if (!this._extensions.validFrameRsv(frame))
      return this._fail('protocol_error',
          'One or more reserved bits are on: reserved1 = ' + (frame.rsv1 ? 1 : 0) +
          ', reserved2 = ' + (frame.rsv2 ? 1 : 0) +
          ', reserved3 = ' + (frame.rsv3 ? 1 : 0));

    if (this.OPCODE_CODES.indexOf(frame.opcode) < 0)
      return this._fail('protocol_error', 'Unrecognized frame opcode: ' + frame.opcode);

    if (this.MESSAGE_OPCODES.indexOf(frame.opcode) < 0 && !frame.final)
      return this._fail('protocol_error', 'Received fragmented control frame: opcode = ' + frame.opcode);

    if (this._message && this.OPENING_OPCODES.indexOf(frame.opcode) >= 0)
      return this._fail('protocol_error', 'Received new data frame but previous continuous frame is unfinished');
  },

  _parseLength: function(octet) {
    var frame = this._frame;
    frame.masked = (octet & this.MASK) === this.MASK;
    frame.length = (octet & this.LENGTH);

    if (frame.length >= 0 && frame.length <= 125) {
      this._stage = frame.masked ? 3 : 4;
      if (!this._checkFrameLength()) return;
    } else {
      this._stage = 2;
      frame.lengthBytes = (frame.length === 126 ? 2 : 8);
    }

    if (this._requireMasking && !frame.masked)
      return this._fail('unacceptable', 'Received unmasked frame but masking is required');
  },

  _parseExtendedLength: function(buffer) {
    var frame = this._frame;
    frame.length = this._readUInt(buffer);

    this._stage = frame.masked ? 3 : 4;

    if (this.MESSAGE_OPCODES.indexOf(frame.opcode) < 0 && frame.length > 125)
      return this._fail('protocol_error', 'Received control frame having too long payload: ' + frame.length);

    if (!this._checkFrameLength()) return;
  },

  _checkFrameLength: function() {
    var length = this._message ? this._message.length : 0;

    if (length + this._frame.length > this._maxLength) {
      this._fail('too_large', 'WebSocket frame length too large');
      return false;
    } else {
      return true;
    }
  },

  _emitFrame: function(buffer) {
    var frame   = this._frame,
        payload = frame.payload = Hybi$2.mask(buffer, frame.maskingKey),
        opcode  = frame.opcode,
        message,
        code, reason,
        callbacks, callback;

    delete this._frame;

    if (opcode === this.OPCODES.continuation) {
      if (!this._message) return this._fail('protocol_error', 'Received unexpected continuation frame');
      this._message.pushFrame(frame);
    }

    if (opcode === this.OPCODES.text || opcode === this.OPCODES.binary) {
      this._message = new Message();
      this._message.pushFrame(frame);
    }

    if (frame.final && this.MESSAGE_OPCODES.indexOf(opcode) >= 0)
      return this._emitMessage(this._message);

    if (opcode === this.OPCODES.close) {
      code   = (payload.length >= 2) ? payload.readUInt16BE(0) : null;
      reason = (payload.length > 2) ? this._encode(payload.slice(2)) : null;

      if (!(payload.length === 0) &&
          !(code !== null && code >= this.MIN_RESERVED_ERROR && code <= this.MAX_RESERVED_ERROR) &&
          this.ERROR_CODES.indexOf(code) < 0)
        code = this.ERRORS.protocol_error;

      if (payload.length > 125 || (payload.length > 2 && !reason))
        code = this.ERRORS.protocol_error;

      this._shutdown(code || this.DEFAULT_ERROR_CODE, reason || '');
    }

    if (opcode === this.OPCODES.ping) {
      this.frame(payload, 'pong');
      this.emit('ping', new Base$6.PingEvent(payload.toString()));
    }

    if (opcode === this.OPCODES.pong) {
      callbacks = this._pingCallbacks;
      message   = this._encode(payload);
      callback  = callbacks[message];

      delete callbacks[message];
      if (callback) callback();

      this.emit('pong', new Base$6.PongEvent(payload.toString()));
    }
  },

  _emitMessage: function(message) {
    var message = this._message;
    message.read();

    delete this._message;

    this._extensions.processIncomingMessage(message, function(error, message) {
      if (error) return this._fail('extension_error', error.message);

      var payload = message.data;
      if (message.opcode === this.OPCODES.text) payload = this._encode(payload);

      if (payload === null)
        return this._fail('encoding_error', 'Could not decode a text frame as UTF-8');
      else
        this.emit('message', new Base$6.MessageEvent(payload));
    }, this);
  },

  _encode: function(buffer) {
    try {
      var string = buffer.toString('binary', 0, buffer.length);
      if (!this.UTF8_MATCH.test(string)) return null;
    } catch (e) {}
    return buffer.toString('utf8', 0, buffer.length);
  },

  _readUInt: function(buffer) {
    if (buffer.length === 2) return buffer.readUInt16BE(0);

    return buffer.readUInt32BE(0) * 0x100000000 +
           buffer.readUInt32BE(4);
  }
};

for (var key$7 in instance$7)
  Hybi$2.prototype[key$7] = instance$7[key$7];

var hybi = Hybi$2;

var Buffer$4     = safeBuffer.exports.Buffer,
    Stream$2     = require$$0__default$1["default"].Stream,
    url$2        = require$$2__default$1["default"],
    util$9       = require$$2__default["default"],
    Base$5       = base,
    Headers$1    = headers,
    HttpParser$2 = http_parser;

var PORTS = { 'ws:': 80, 'wss:': 443 };

var Proxy$2 = function(client, origin, options) {
  this._client  = client;
  this._http    = new HttpParser$2('response');
  this._origin  = (typeof client.url === 'object') ? client.url : url$2.parse(client.url);
  this._url     = (typeof origin === 'object') ? origin : url$2.parse(origin);
  this._options = options || {};
  this._state   = 0;

  this.readable = this.writable = true;
  this._paused  = false;

  this._headers = new Headers$1();
  this._headers.set('Host', this._origin.host);
  this._headers.set('Connection', 'keep-alive');
  this._headers.set('Proxy-Connection', 'keep-alive');

  var auth = this._url.auth && Buffer$4.from(this._url.auth, 'utf8').toString('base64');
  if (auth) this._headers.set('Proxy-Authorization', 'Basic ' + auth);
};
util$9.inherits(Proxy$2, Stream$2);

var instance$6 = {
  setHeader: function(name, value) {
    if (this._state !== 0) return false;
    this._headers.set(name, value);
    return true;
  },

  start: function() {
    if (this._state !== 0) return false;
    this._state = 1;

    var origin = this._origin,
        port   = origin.port || PORTS[origin.protocol],
        start  = 'CONNECT ' + origin.hostname + ':' + port + ' HTTP/1.1';

    var headers = [start, this._headers.toString(), ''];

    this.emit('data', Buffer$4.from(headers.join('\r\n'), 'utf8'));
    return true;
  },

  pause: function() {
    this._paused = true;
  },

  resume: function() {
    this._paused = false;
    this.emit('drain');
  },

  write: function(chunk) {
    if (!this.writable) return false;

    this._http.parse(chunk);
    if (!this._http.isComplete()) return !this._paused;

    this.statusCode = this._http.statusCode;
    this.headers    = this._http.headers;

    if (this.statusCode === 200) {
      this.emit('connect', new Base$5.ConnectEvent());
    } else {
      var message = "Can't establish a connection to the server at " + this._origin.href;
      this.emit('error', new Error(message));
    }
    this.end();
    return !this._paused;
  },

  end: function(chunk) {
    if (!this.writable) return;
    if (chunk !== undefined) this.write(chunk);
    this.readable = this.writable = false;
    this.emit('close');
    this.emit('end');
  },

  destroy: function() {
    this.end();
  }
};

for (var key$6 in instance$6)
  Proxy$2.prototype[key$6] = instance$6[key$6];

var proxy = Proxy$2;

var Buffer$3     = safeBuffer.exports.Buffer,
    crypto$1     = require$$1__default$1["default"],
    url$1        = require$$2__default$1["default"],
    util$8       = require$$2__default["default"],
    HttpParser$1 = http_parser,
    Base$4       = base,
    Hybi$1       = hybi,
    Proxy$1      = proxy;

var Client$2 = function(_url, options) {
  this.version = 'hybi-' + Hybi$1.VERSION;
  Hybi$1.call(this, null, _url, options);

  this.readyState = -1;
  this._key       = Client$2.generateKey();
  this._accept    = Hybi$1.generateAccept(this._key);
  this._http      = new HttpParser$1('response');

  var uri  = url$1.parse(this.url),
      auth = uri.auth && Buffer$3.from(uri.auth, 'utf8').toString('base64');

  if (this.VALID_PROTOCOLS.indexOf(uri.protocol) < 0)
    throw new Error(this.url + ' is not a valid WebSocket URL');

  this._pathname = (uri.pathname || '/') + (uri.search || '');

  this._headers.set('Host', uri.host);
  this._headers.set('Upgrade', 'websocket');
  this._headers.set('Connection', 'Upgrade');
  this._headers.set('Sec-WebSocket-Key', this._key);
  this._headers.set('Sec-WebSocket-Version', Hybi$1.VERSION);

  if (this._protocols.length > 0)
    this._headers.set('Sec-WebSocket-Protocol', this._protocols.join(', '));

  if (auth)
    this._headers.set('Authorization', 'Basic ' + auth);
};
util$8.inherits(Client$2, Hybi$1);

Client$2.generateKey = function() {
  return crypto$1.randomBytes(16).toString('base64');
};

var instance$5 = {
  VALID_PROTOCOLS: ['ws:', 'wss:'],

  proxy: function(origin, options) {
    return new Proxy$1(this, origin, options);
  },

  start: function() {
    if (this.readyState !== -1) return false;
    this._write(this._handshakeRequest());
    this.readyState = 0;
    return true;
  },

  parse: function(chunk) {
    if (this.readyState === 3) return;
    if (this.readyState > 0) return Hybi$1.prototype.parse.call(this, chunk);

    this._http.parse(chunk);
    if (!this._http.isComplete()) return;

    this._validateHandshake();
    if (this.readyState === 3) return;

    this._open();
    this.parse(this._http.body);
  },

  _handshakeRequest: function() {
    var extensions = this._extensions.generateOffer();
    if (extensions)
      this._headers.set('Sec-WebSocket-Extensions', extensions);

    var start   = 'GET ' + this._pathname + ' HTTP/1.1',
        headers = [start, this._headers.toString(), ''];

    return Buffer$3.from(headers.join('\r\n'), 'utf8');
  },

  _failHandshake: function(message) {
    message = 'Error during WebSocket handshake: ' + message;
    this.readyState = 3;
    this.emit('error', new Error(message));
    this.emit('close', new Base$4.CloseEvent(this.ERRORS.protocol_error, message));
  },

  _validateHandshake: function() {
    this.statusCode = this._http.statusCode;
    this.headers    = this._http.headers;

    if (this._http.error)
      return this._failHandshake(this._http.error.message);

    if (this._http.statusCode !== 101)
      return this._failHandshake('Unexpected response code: ' + this._http.statusCode);

    var headers    = this._http.headers,
        upgrade    = headers['upgrade'] || '',
        connection = headers['connection'] || '',
        accept     = headers['sec-websocket-accept'] || '',
        protocol   = headers['sec-websocket-protocol'] || '';

    if (upgrade === '')
      return this._failHandshake("'Upgrade' header is missing");
    if (upgrade.toLowerCase() !== 'websocket')
      return this._failHandshake("'Upgrade' header value is not 'WebSocket'");

    if (connection === '')
      return this._failHandshake("'Connection' header is missing");
    if (connection.toLowerCase() !== 'upgrade')
      return this._failHandshake("'Connection' header value is not 'Upgrade'");

    if (accept !== this._accept)
      return this._failHandshake('Sec-WebSocket-Accept mismatch');

    this.protocol = null;

    if (protocol !== '') {
      if (this._protocols.indexOf(protocol) < 0)
        return this._failHandshake('Sec-WebSocket-Protocol mismatch');
      else
        this.protocol = protocol;
    }

    try {
      this._extensions.activate(this.headers['sec-websocket-extensions']);
    } catch (e) {
      return this._failHandshake(e.message);
    }
  }
};

for (var key$5 in instance$5)
  Client$2.prototype[key$5] = instance$5[key$5];

var client$1 = Client$2;

var Buffer$2 = safeBuffer.exports.Buffer,
    Base$3   = base,
    util$7   = require$$2__default["default"];

var Draft75$2 = function(request, url, options) {
  Base$3.apply(this, arguments);
  this._stage  = 0;
  this.version = 'hixie-75';

  this._headers.set('Upgrade', 'WebSocket');
  this._headers.set('Connection', 'Upgrade');
  this._headers.set('WebSocket-Origin', this._request.headers.origin);
  this._headers.set('WebSocket-Location', this.url);
};
util$7.inherits(Draft75$2, Base$3);

var instance$4 = {
  close: function() {
    if (this.readyState === 3) return false;
    this.readyState = 3;
    this.emit('close', new Base$3.CloseEvent(null, null));
    return true;
  },

  parse: function(chunk) {
    if (this.readyState > 1) return;

    this._reader.put(chunk);

    this._reader.eachByte(function(octet) {
      var message;

      switch (this._stage) {
        case -1:
          this._body.push(octet);
          this._sendHandshakeBody();
          break;

        case 0:
          this._parseLeadingByte(octet);
          break;

        case 1:
          this._length = (octet & 0x7F) + 128 * this._length;

          if (this._closing && this._length === 0) {
            return this.close();
          }
          else if ((octet & 0x80) !== 0x80) {
            if (this._length === 0) {
              this._stage = 0;
            }
            else {
              this._skipped = 0;
              this._stage   = 2;
            }
          }
          break;

        case 2:
          if (octet === 0xFF) {
            this._stage = 0;
            message = Buffer$2.from(this._buffer).toString('utf8', 0, this._buffer.length);
            this.emit('message', new Base$3.MessageEvent(message));
          }
          else {
            if (this._length) {
              this._skipped += 1;
              if (this._skipped === this._length)
                this._stage = 0;
            } else {
              this._buffer.push(octet);
              if (this._buffer.length > this._maxLength) return this.close();
            }
          }
          break;
      }
    }, this);
  },

  frame: function(buffer) {
    if (this.readyState === 0) return this._queue([buffer]);
    if (this.readyState > 1) return false;

    if (typeof buffer !== 'string') buffer = buffer.toString();

    var length = Buffer$2.byteLength(buffer),
        frame  = Buffer$2.allocUnsafe(length + 2);

    frame[0] = 0x00;
    frame.write(buffer, 1);
    frame[frame.length - 1] = 0xFF;

    this._write(frame);
    return true;
  },

  _handshakeResponse: function() {
    var start   = 'HTTP/1.1 101 Web Socket Protocol Handshake',
        headers = [start, this._headers.toString(), ''];

    return Buffer$2.from(headers.join('\r\n'), 'utf8');
  },

  _parseLeadingByte: function(octet) {
    if ((octet & 0x80) === 0x80) {
      this._length = 0;
      this._stage  = 1;
    } else {
      delete this._length;
      delete this._skipped;
      this._buffer = [];
      this._stage  = 2;
    }
  }
};

for (var key$4 in instance$4)
  Draft75$2.prototype[key$4] = instance$4[key$4];

var draft75 = Draft75$2;

var Buffer$1  = safeBuffer.exports.Buffer,
    Base$2    = base,
    Draft75$1 = draft75,
    crypto  = require$$1__default$1["default"],
    util$6    = require$$2__default["default"];


var numberFromKey = function(key) {
  return parseInt((key.match(/[0-9]/g) || []).join(''), 10);
};

var spacesInKey = function(key) {
  return (key.match(/ /g) || []).length;
};


var Draft76$1 = function(request, url, options) {
  Draft75$1.apply(this, arguments);
  this._stage  = -1;
  this._body   = [];
  this.version = 'hixie-76';

  this._headers.clear();

  this._headers.set('Upgrade', 'WebSocket');
  this._headers.set('Connection', 'Upgrade');
  this._headers.set('Sec-WebSocket-Origin', this._request.headers.origin);
  this._headers.set('Sec-WebSocket-Location', this.url);
};
util$6.inherits(Draft76$1, Draft75$1);

var instance$3 = {
  BODY_SIZE: 8,

  start: function() {
    if (!Draft75$1.prototype.start.call(this)) return false;
    this._started = true;
    this._sendHandshakeBody();
    return true;
  },

  close: function() {
    if (this.readyState === 3) return false;
    if (this.readyState === 1) this._write(Buffer$1.from([0xFF, 0x00]));
    this.readyState = 3;
    this.emit('close', new Base$2.CloseEvent(null, null));
    return true;
  },

  _handshakeResponse: function() {
    var headers = this._request.headers,
        key1    = headers['sec-websocket-key1'],
        key2    = headers['sec-websocket-key2'];

    if (!key1) throw new Error('Missing required header: Sec-WebSocket-Key1');
    if (!key2) throw new Error('Missing required header: Sec-WebSocket-Key2');

    var number1 = numberFromKey(key1),
        spaces1 = spacesInKey(key1),

        number2 = numberFromKey(key2),
        spaces2 = spacesInKey(key2);

    if (number1 % spaces1 !== 0 || number2 % spaces2 !== 0)
      throw new Error('Client sent invalid Sec-WebSocket-Key headers');

    this._keyValues = [number1 / spaces1, number2 / spaces2];

    var start   = 'HTTP/1.1 101 WebSocket Protocol Handshake',
        headers = [start, this._headers.toString(), ''];

    return Buffer$1.from(headers.join('\r\n'), 'binary');
  },

  _handshakeSignature: function() {
    if (this._body.length < this.BODY_SIZE) return null;

    var md5    = crypto.createHash('md5'),
        buffer = Buffer$1.allocUnsafe(8 + this.BODY_SIZE);

    buffer.writeUInt32BE(this._keyValues[0], 0);
    buffer.writeUInt32BE(this._keyValues[1], 4);
    Buffer$1.from(this._body).copy(buffer, 8, 0, this.BODY_SIZE);

    md5.update(buffer);
    return Buffer$1.from(md5.digest('binary'), 'binary');
  },

  _sendHandshakeBody: function() {
    if (!this._started) return;
    var signature = this._handshakeSignature();
    if (!signature) return;

    this._write(signature);
    this._stage = 0;
    this._open();

    if (this._body.length > this.BODY_SIZE)
      this.parse(this._body.slice(this.BODY_SIZE));
  },

  _parseLeadingByte: function(octet) {
    if (octet !== 0xFF)
      return Draft75$1.prototype._parseLeadingByte.call(this, octet);

    this._closing = true;
    this._length  = 0;
    this._stage   = 1;
  }
};

for (var key$3 in instance$3)
  Draft76$1.prototype[key$3] = instance$3[key$3];

var draft76 = Draft76$1;

var util$5       = require$$2__default["default"],
    HttpParser = http_parser,
    Base$1       = base,
    Draft75    = draft75,
    Draft76    = draft76,
    Hybi       = hybi;

var Server$1 = function(options) {
  Base$1.call(this, null, null, options);
  this._http = new HttpParser('request');
};
util$5.inherits(Server$1, Base$1);

var instance$2 = {
  EVENTS: ['open', 'message', 'error', 'close', 'ping', 'pong'],

  _bindEventListeners: function() {
    this.messages.on('error', function() {});
    this.on('error', function() {});
  },

  parse: function(chunk) {
    if (this._delegate) return this._delegate.parse(chunk);

    this._http.parse(chunk);
    if (!this._http.isComplete()) return;

    this.method  = this._http.method;
    this.url     = this._http.url;
    this.headers = this._http.headers;
    this.body    = this._http.body;

    var self = this;
    this._delegate = Server$1.http(this, this._options);
    this._delegate.messages = this.messages;
    this._delegate.io = this.io;
    this._open();

    this.EVENTS.forEach(function(event) {
      this._delegate.on(event, function(e) { self.emit(event, e); });
    }, this);

    this.protocol = this._delegate.protocol;
    this.version  = this._delegate.version;

    this.parse(this._http.body);
    this.emit('connect', new Base$1.ConnectEvent());
  },

  _open: function() {
    this.__queue.forEach(function(msg) {
      this._delegate[msg[0]].apply(this._delegate, msg[1]);
    }, this);
    this.__queue = [];
  }
};

['addExtension', 'setHeader', 'start', 'frame', 'text', 'binary', 'ping', 'close'].forEach(function(method) {
  instance$2[method] = function() {
    if (this._delegate) {
      return this._delegate[method].apply(this._delegate, arguments);
    } else {
      this.__queue.push([method, arguments]);
      return true;
    }
  };
});

for (var key$2 in instance$2)
  Server$1.prototype[key$2] = instance$2[key$2];

Server$1.isSecureRequest = function(request) {
  if (request.connection && request.connection.authorized !== undefined) return true;
  if (request.socket && request.socket.secure) return true;

  var headers = request.headers;
  if (!headers) return false;
  if (headers['https'] === 'on') return true;
  if (headers['x-forwarded-ssl'] === 'on') return true;
  if (headers['x-forwarded-scheme'] === 'https') return true;
  if (headers['x-forwarded-proto'] === 'https') return true;

  return false;
};

Server$1.determineUrl = function(request) {
  var scheme = this.isSecureRequest(request) ? 'wss:' : 'ws:';
  return scheme + '//' + request.headers.host + request.url;
};

Server$1.http = function(request, options) {
  options = options || {};
  if (options.requireMasking === undefined) options.requireMasking = true;

  var headers = request.headers,
      version = headers['sec-websocket-version'],
      key     = headers['sec-websocket-key'],
      key1    = headers['sec-websocket-key1'],
      key2    = headers['sec-websocket-key2'],
      url     = this.determineUrl(request);

  if (version || key)
    return new Hybi(request, url, options);
  else if (key1 || key2)
    return new Draft76(request, url, options);
  else
    return new Draft75(request, url, options);
};

var server = Server$1;

// Protocol references:
//
// * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75
// * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
// * http://tools.ietf.org/html/draft-ietf-hybi-thewebsocketprotocol-17

var Base   = base,
    Client$1 = client$1,
    Server = server;

var Driver = {
  client: function(url, options) {
    options = options || {};
    if (options.masking === undefined) options.masking = true;
    return new Client$1(url, options);
  },

  server: function(options) {
    options = options || {};
    if (options.requireMasking === undefined) options.requireMasking = true;
    return new Server(options);
  },

  http: function() {
    return Server.http.apply(Server, arguments);
  },

  isSecureRequest: function(request) {
    return Server.isSecureRequest(request);
  },

  isWebSocket: function(request) {
    return Base.isWebSocket(request);
  },

  validateOptions: function(options, validKeys) {
    Base.validateOptions(options, validKeys);
  }
};

var driver$4 = Driver;

var Event$3 = function(eventType, options) {
  this.type = eventType;
  for (var key in options)
    this[key] = options[key];
};

Event$3.prototype.initEvent = function(eventType, canBubble, cancelable) {
  this.type       = eventType;
  this.bubbles    = canBubble;
  this.cancelable = cancelable;
};

Event$3.prototype.stopPropagation = function() {};
Event$3.prototype.preventDefault  = function() {};

Event$3.CAPTURING_PHASE = 1;
Event$3.AT_TARGET       = 2;
Event$3.BUBBLING_PHASE  = 3;

var event = Event$3;

var Event$2 = event;

var EventTarget$2 = {
  onopen:     null,
  onmessage:  null,
  onerror:    null,
  onclose:    null,

  addEventListener: function(eventType, listener, useCapture) {
    this.on(eventType, listener);
  },

  removeEventListener: function(eventType, listener, useCapture) {
    this.removeListener(eventType, listener);
  },

  dispatchEvent: function(event) {
    event.target = event.currentTarget = this;
    event.eventPhase = Event$2.AT_TARGET;

    if (this['on' + event.type])
      this['on' + event.type](event);

    this.emit(event.type, event);
  }
};

var event_target = EventTarget$2;

var Stream$1      = require$$0__default$1["default"].Stream,
    util$4        = require$$2__default["default"],
    driver$3      = driver$4,
    EventTarget$1 = event_target,
    Event$1       = event;

var API$3 = function(options) {
  options = options || {};
  driver$3.validateOptions(options, ['headers', 'extensions', 'maxLength', 'ping', 'proxy', 'tls', 'ca']);

  this.readable = this.writable = true;

  var headers = options.headers;
  if (headers) {
    for (var name in headers) this._driver.setHeader(name, headers[name]);
  }

  var extensions = options.extensions;
  if (extensions) {
    [].concat(extensions).forEach(this._driver.addExtension, this._driver);
  }

  this._ping          = options.ping;
  this._pingId        = 0;
  this.readyState     = API$3.CONNECTING;
  this.bufferedAmount = 0;
  this.protocol       = '';
  this.url            = this._driver.url;
  this.version        = this._driver.version;

  var self = this;

  this._driver.on('open',    function(e) { self._open(); });
  this._driver.on('message', function(e) { self._receiveMessage(e.data); });
  this._driver.on('close',   function(e) { self._beginClose(e.reason, e.code); });

  this._driver.on('error', function(error) {
    self._emitError(error.message);
  });
  this.on('error', function() {});

  this._driver.messages.on('drain', function() {
    self.emit('drain');
  });

  if (this._ping)
    this._pingTimer = setInterval(function() {
      self._pingId += 1;
      self.ping(self._pingId.toString());
    }, this._ping * 1000);

  this._configureStream();

  if (!this._proxy) {
    this._stream.pipe(this._driver.io);
    this._driver.io.pipe(this._stream);
  }
};
util$4.inherits(API$3, Stream$1);

API$3.CONNECTING = 0;
API$3.OPEN       = 1;
API$3.CLOSING    = 2;
API$3.CLOSED     = 3;

API$3.CLOSE_TIMEOUT = 30000;

var instance$1 = {
  write: function(data) {
    return this.send(data);
  },

  end: function(data) {
    if (data !== undefined) this.send(data);
    this.close();
  },

  pause: function() {
    return this._driver.messages.pause();
  },

  resume: function() {
    return this._driver.messages.resume();
  },

  send: function(data) {
    if (this.readyState > API$3.OPEN) return false;
    if (!(data instanceof Buffer)) data = String(data);
    return this._driver.messages.write(data);
  },

  ping: function(message, callback) {
    if (this.readyState > API$3.OPEN) return false;
    return this._driver.ping(message, callback);
  },

  close: function(code, reason) {
    if (code === undefined) code = 1000;
    if (reason === undefined) reason = '';

    if (code !== 1000 && (code < 3000 || code > 4999))
      throw new Error("Failed to execute 'close' on WebSocket: " +
                      "The code must be either 1000, or between 3000 and 4999. " +
                      code + " is neither.");

    if (this.readyState < API$3.CLOSING) {
      var self = this;
      this._closeTimer = setTimeout(function() {
        self._beginClose('', 1006);
      }, API$3.CLOSE_TIMEOUT);
    }

    if (this.readyState !== API$3.CLOSED) this.readyState = API$3.CLOSING;

    this._driver.close(reason, code);
  },

  _configureStream: function() {
    var self = this;

    this._stream.setTimeout(0);
    this._stream.setNoDelay(true);

    ['close', 'end'].forEach(function(event) {
      this._stream.on(event, function() { self._finalizeClose(); });
    }, this);

    this._stream.on('error', function(error) {
      self._emitError('Network error: ' + self.url + ': ' + error.message);
      self._finalizeClose();
    });
  },

  _open: function() {
    if (this.readyState !== API$3.CONNECTING) return;

    this.readyState = API$3.OPEN;
    this.protocol = this._driver.protocol || '';

    var event = new Event$1('open');
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
  },

  _receiveMessage: function(data) {
    if (this.readyState > API$3.OPEN) return false;

    if (this.readable) this.emit('data', data);

    var event = new Event$1('message', { data: data });
    event.initEvent('message', false, false);
    this.dispatchEvent(event);
  },

  _emitError: function(message) {
    if (this.readyState >= API$3.CLOSING) return;

    var event = new Event$1('error', { message: message });
    event.initEvent('error', false, false);
    this.dispatchEvent(event);
  },

  _beginClose: function(reason, code) {
    if (this.readyState === API$3.CLOSED) return;
    this.readyState = API$3.CLOSING;
    this._closeParams = [reason, code];

    if (this._stream) {
      this._stream.destroy();
      if (!this._stream.readable) this._finalizeClose();
    }
  },

  _finalizeClose: function() {
    if (this.readyState === API$3.CLOSED) return;
    this.readyState = API$3.CLOSED;

    if (this._closeTimer) clearTimeout(this._closeTimer);
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this._stream) this._stream.end();

    if (this.readable) this.emit('end');
    this.readable = this.writable = false;

    var reason = this._closeParams ? this._closeParams[0] : '',
        code   = this._closeParams ? this._closeParams[1] : 1006;

    var event = new Event$1('close', { code: code, reason: reason });
    event.initEvent('close', false, false);
    this.dispatchEvent(event);
  }
};

for (var method$1 in instance$1) API$3.prototype[method$1] = instance$1[method$1];
for (var key$1 in EventTarget$1) API$3.prototype[key$1] = EventTarget$1[key$1];

var api = API$3;

var util$3   = require$$2__default["default"],
    net    = require$$1__default$2["default"],
    tls    = require$$2__default$2["default"],
    url    = require$$2__default$1["default"],
    driver$2 = driver$4,
    API$2    = api;

var DEFAULT_PORTS    = { 'http:': 80, 'https:': 443, 'ws:':80, 'wss:': 443 },
    SECURE_PROTOCOLS = ['https:', 'wss:'];

var Client = function(_url, protocols, options) {
  options = options || {};

  this.url     = _url;
  this._driver = driver$2.client(this.url, { maxLength: options.maxLength, protocols: protocols });

  ['open', 'error'].forEach(function(event) {
    this._driver.on(event, function() {
      self.headers    = self._driver.headers;
      self.statusCode = self._driver.statusCode;
    });
  }, this);

  var proxy      = options.proxy || {},
      endpoint   = url.parse(proxy.origin || this.url),
      port       = endpoint.port || DEFAULT_PORTS[endpoint.protocol],
      secure     = SECURE_PROTOCOLS.indexOf(endpoint.protocol) >= 0,
      onConnect  = function() { self._onConnect(); },
      netOptions = options.net || {},
      originTLS  = options.tls || {},
      socketTLS  = proxy.origin ? (proxy.tls || {}) : originTLS,
      self       = this;

  netOptions.host = socketTLS.host = endpoint.hostname;
  netOptions.port = socketTLS.port = port;

  originTLS.ca = originTLS.ca || options.ca;
  socketTLS.servername = socketTLS.servername || endpoint.hostname;

  this._stream = secure
               ? tls.connect(socketTLS, onConnect)
               : net.connect(netOptions, onConnect);

  if (proxy.origin) this._configureProxy(proxy, originTLS);

  API$2.call(this, options);
};
util$3.inherits(Client, API$2);

Client.prototype._onConnect = function() {
  var worker = this._proxy || this._driver;
  worker.start();
};

Client.prototype._configureProxy = function(proxy, originTLS) {
  var uri    = url.parse(this.url),
      secure = SECURE_PROTOCOLS.indexOf(uri.protocol) >= 0,
      self   = this,
      name;

  this._proxy = this._driver.proxy(proxy.origin);

  if (proxy.headers) {
    for (name in proxy.headers) this._proxy.setHeader(name, proxy.headers[name]);
  }

  this._proxy.pipe(this._stream, { end: false });
  this._stream.pipe(this._proxy);

  this._proxy.on('connect', function() {
    if (secure) {
      var options = { socket: self._stream, servername: uri.hostname };
      for (name in originTLS) options[name] = originTLS[name];
      self._stream = tls.connect(options);
      self._configureStream();
    }
    self._driver.io.pipe(self._stream);
    self._stream.pipe(self._driver.io);
    self._driver.start();
  });

  this._proxy.on('error', function(error) {
    self._driver.emit('error', error);
  });
};

var client = Client;

var Stream      = require$$0__default$1["default"].Stream,
    util$2        = require$$2__default["default"],
    driver$1      = driver$4,
    Headers     = headers,
    API$1         = api,
    EventTarget = event_target,
    Event       = event;

var EventSource = function(request, response, options) {
  this.writable = true;
  options = options || {};

  this._stream = response.socket;
  this._ping   = options.ping  || this.DEFAULT_PING;
  this._retry  = options.retry || this.DEFAULT_RETRY;

  var scheme       = driver$1.isSecureRequest(request) ? 'https:' : 'http:';
  this.url         = scheme + '//' + request.headers.host + request.url;
  this.lastEventId = request.headers['last-event-id'] || '';
  this.readyState  = API$1.CONNECTING;

  var headers = new Headers(),
      self    = this;

  if (options.headers) {
    for (var key in options.headers) headers.set(key, options.headers[key]);
  }

  if (!this._stream || !this._stream.writable) return;
  process.nextTick(function() { self._open(); });

  this._stream.setTimeout(0);
  this._stream.setNoDelay(true);

  var handshake = 'HTTP/1.1 200 OK\r\n' +
                  'Content-Type: text/event-stream\r\n' +
                  'Cache-Control: no-cache, no-store\r\n' +
                  'Connection: close\r\n' +
                  headers.toString() +
                  '\r\n' +
                  'retry: ' + Math.floor(this._retry * 1000) + '\r\n\r\n';

  this._write(handshake);

  this._stream.on('drain', function() { self.emit('drain'); });

  if (this._ping)
    this._pingTimer = setInterval(function() { self.ping(); }, this._ping * 1000);

  ['error', 'end'].forEach(function(event) {
    self._stream.on(event, function() { self.close(); });
  });
};
util$2.inherits(EventSource, Stream);

EventSource.isEventSource = function(request) {
  if (request.method !== 'GET') return false;
  var accept = (request.headers.accept || '').split(/\s*,\s*/);
  return accept.indexOf('text/event-stream') >= 0;
};

var instance = {
  DEFAULT_PING:   10,
  DEFAULT_RETRY:  5,

  _write: function(chunk) {
    if (!this.writable) return false;
    try {
      return this._stream.write(chunk, 'utf8');
    } catch (e) {
      return false;
    }
  },

  _open: function() {
    if (this.readyState !== API$1.CONNECTING) return;

    this.readyState = API$1.OPEN;

    var event = new Event('open');
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
  },

  write: function(message) {
    return this.send(message);
  },

  end: function(message) {
    if (message !== undefined) this.write(message);
    this.close();
  },

  send: function(message, options) {
    if (this.readyState > API$1.OPEN) return false;

    message = String(message).replace(/(\r\n|\r|\n)/g, '$1data: ');
    options = options || {};

    var frame = '';
    if (options.event) frame += 'event: ' + options.event + '\r\n';
    if (options.id)    frame += 'id: '    + options.id    + '\r\n';
    frame += 'data: ' + message + '\r\n\r\n';

    return this._write(frame);
  },

  ping: function() {
    return this._write(':\r\n\r\n');
  },

  close: function() {
    if (this.readyState > API$1.OPEN) return false;

    this.readyState = API$1.CLOSED;
    this.writable = false;
    if (this._pingTimer) clearInterval(this._pingTimer);
    if (this._stream) this._stream.end();

    var event = new Event('close');
    event.initEvent('close', false, false);
    this.dispatchEvent(event);

    return true;
  }
};

for (var method in instance) EventSource.prototype[method] = instance[method];
for (var key in EventTarget) EventSource.prototype[key] = EventTarget[key];

var eventsource = EventSource;

var util$1   = require$$2__default["default"],
    driver = driver$4,
    API    = api;

var WebSocket$1 = function(request, socket, body, protocols, options) {
  options = options || {};

  this._stream = socket;
  this._driver = driver.http(request, { maxLength: options.maxLength, protocols: protocols });

  var self = this;
  if (!this._stream || !this._stream.writable) return;
  if (!this._stream.readable) return this._stream.end();

  var catchup = function() { self._stream.removeListener('data', catchup); };
  this._stream.on('data', catchup);

  API.call(this, options);

  process.nextTick(function() {
    self._driver.start();
    self._driver.io.write(body);
  });
};
util$1.inherits(WebSocket$1, API);

WebSocket$1.isWebSocket = function(request) {
  return driver.isWebSocket(request);
};

WebSocket$1.validateOptions = function(options, validKeys) {
  driver.validateOptions(options, validKeys);
};

WebSocket$1.WebSocket   = WebSocket$1;
WebSocket$1.Client      = client;
WebSocket$1.EventSource = eventsource;

var websocket        = WebSocket$1;

var index_cjs = {};

const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

let idbProxyableTypes;
let cursorAdvanceMethods;
// This is a function to prevent it throwing up in node environments.
function getIdbProxyableTypes() {
    return (idbProxyableTypes ||
        (idbProxyableTypes = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
        ]));
}
// This is a function to prevent it throwing up in node environments.
function getCursorAdvanceMethods() {
    return (cursorAdvanceMethods ||
        (cursorAdvanceMethods = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
        ]));
}
const cursorRequestMap = new WeakMap();
const transactionDoneMap = new WeakMap();
const transactionStoreNamesMap = new WeakMap();
const transformCache = new WeakMap();
const reverseTransformCache = new WeakMap();
function promisifyRequest(request) {
    const promise = new Promise((resolve, reject) => {
        const unlisten = () => {
            request.removeEventListener('success', success);
            request.removeEventListener('error', error);
        };
        const success = () => {
            resolve(wrap(request.result));
            unlisten();
        };
        const error = () => {
            reject(request.error);
            unlisten();
        };
        request.addEventListener('success', success);
        request.addEventListener('error', error);
    });
    promise
        .then((value) => {
        // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
        // (see wrapFunction).
        if (value instanceof IDBCursor) {
            cursorRequestMap.set(value, request);
        }
        // Catching to avoid "Uncaught Promise exceptions"
    })
        .catch(() => { });
    // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
    // is because we create many promises from a single IDBRequest.
    reverseTransformCache.set(promise, request);
    return promise;
}
function cacheDonePromiseForTransaction(tx) {
    // Early bail if we've already created a done promise for this transaction.
    if (transactionDoneMap.has(tx))
        return;
    const done = new Promise((resolve, reject) => {
        const unlisten = () => {
            tx.removeEventListener('complete', complete);
            tx.removeEventListener('error', error);
            tx.removeEventListener('abort', error);
        };
        const complete = () => {
            resolve();
            unlisten();
        };
        const error = () => {
            reject(tx.error || new DOMException('AbortError', 'AbortError'));
            unlisten();
        };
        tx.addEventListener('complete', complete);
        tx.addEventListener('error', error);
        tx.addEventListener('abort', error);
    });
    // Cache it for later retrieval.
    transactionDoneMap.set(tx, done);
}
let idbProxyTraps = {
    get(target, prop, receiver) {
        if (target instanceof IDBTransaction) {
            // Special handling for transaction.done.
            if (prop === 'done')
                return transactionDoneMap.get(target);
            // Polyfill for objectStoreNames because of Edge.
            if (prop === 'objectStoreNames') {
                return target.objectStoreNames || transactionStoreNamesMap.get(target);
            }
            // Make tx.store return the only store in the transaction, or undefined if there are many.
            if (prop === 'store') {
                return receiver.objectStoreNames[1]
                    ? undefined
                    : receiver.objectStore(receiver.objectStoreNames[0]);
            }
        }
        // Else transform whatever we get back.
        return wrap(target[prop]);
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    },
    has(target, prop) {
        if (target instanceof IDBTransaction &&
            (prop === 'done' || prop === 'store')) {
            return true;
        }
        return prop in target;
    },
};
function replaceTraps(callback) {
    idbProxyTraps = callback(idbProxyTraps);
}
function wrapFunction(func) {
    // Due to expected object equality (which is enforced by the caching in `wrap`), we
    // only create one new func per func.
    // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
    if (func === IDBDatabase.prototype.transaction &&
        !('objectStoreNames' in IDBTransaction.prototype)) {
        return function (storeNames, ...args) {
            const tx = func.call(unwrap(this), storeNames, ...args);
            transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
            return wrap(tx);
        };
    }
    // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
    // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
    // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
    // with real promises, so each advance methods returns a new promise for the cursor object, or
    // undefined if the end of the cursor has been reached.
    if (getCursorAdvanceMethods().includes(func)) {
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            func.apply(unwrap(this), args);
            return wrap(cursorRequestMap.get(this));
        };
    }
    return function (...args) {
        // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
        // the original object.
        return wrap(func.apply(unwrap(this), args));
    };
}
function transformCachableValue(value) {
    if (typeof value === 'function')
        return wrapFunction(value);
    // This doesn't return, it just creates a 'done' promise for the transaction,
    // which is later returned for transaction.done (see idbObjectHandler).
    if (value instanceof IDBTransaction)
        cacheDonePromiseForTransaction(value);
    if (instanceOfAny(value, getIdbProxyableTypes()))
        return new Proxy(value, idbProxyTraps);
    // Return the same value back if we're not going to transform it.
    return value;
}
function wrap(value) {
    // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
    // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
    if (value instanceof IDBRequest)
        return promisifyRequest(value);
    // If we've already transformed this value before, reuse the transformed value.
    // This is faster, but it also provides object equality.
    if (transformCache.has(value))
        return transformCache.get(value);
    const newValue = transformCachableValue(value);
    // Not all types are transformed.
    // These may be primitive types, so they can't be WeakMap keys.
    if (newValue !== value) {
        transformCache.set(value, newValue);
        reverseTransformCache.set(newValue, value);
    }
    return newValue;
}
const unwrap = (value) => reverseTransformCache.get(value);

/**
 * Open a database.
 *
 * @param name Name of the database.
 * @param version Schema version.
 * @param callbacks Additional callbacks.
 */
function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
    const request = indexedDB.open(name, version);
    const openPromise = wrap(request);
    if (upgrade) {
        request.addEventListener('upgradeneeded', (event) => {
            upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction), event);
        });
    }
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event.newVersion, event));
    }
    openPromise
        .then((db) => {
        if (terminated)
            db.addEventListener('close', () => terminated());
        if (blocking) {
            db.addEventListener('versionchange', (event) => blocking(event.oldVersion, event.newVersion, event));
        }
    })
        .catch(() => { });
    return openPromise;
}
/**
 * Delete a database.
 *
 * @param name Name of the database.
 */
function deleteDB(name, { blocked } = {}) {
    const request = indexedDB.deleteDatabase(name);
    if (blocked) {
        request.addEventListener('blocked', (event) => blocked(
        // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
        event.oldVersion, event));
    }
    return wrap(request).then(() => undefined);
}

const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
const writeMethods = ['put', 'add', 'delete', 'clear'];
const cachedMethods = new Map();
function getMethod(target, prop) {
    if (!(target instanceof IDBDatabase &&
        !(prop in target) &&
        typeof prop === 'string')) {
        return;
    }
    if (cachedMethods.get(prop))
        return cachedMethods.get(prop);
    const targetFuncName = prop.replace(/FromIndex$/, '');
    const useIndex = prop !== targetFuncName;
    const isWrite = writeMethods.includes(targetFuncName);
    if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
        !(isWrite || readMethods.includes(targetFuncName))) {
        return;
    }
    const method = async function (storeName, ...args) {
        // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
        const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
        let target = tx.store;
        if (useIndex)
            target = target.index(args.shift());
        // Must reject if op rejects.
        // If it's a write operation, must reject if tx.done rejects.
        // Must reject with op rejection first.
        // Must resolve with op value.
        // Must handle both promises (no unhandled rejections)
        return (await Promise.all([
            target[targetFuncName](...args),
            isWrite && tx.done,
        ]))[0];
    };
    cachedMethods.set(prop, method);
    return method;
}
replaceTraps((oldTraps) => ({
    ...oldTraps,
    get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
    has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
}));

var build = /*#__PURE__*/Object.freeze({
	__proto__: null,
	deleteDB: deleteDB,
	openDB: openDB,
	unwrap: unwrap,
	wrap: wrap
});

var require$$3 = /*@__PURE__*/getAugmentedNamespace(build);

(function (exports) {

Object.defineProperty(exports, '__esModule', { value: true });

var component = require$$0__default$2["default"];
var logger$1 = require$$1__default$3["default"];
var util = require$$2__default$3["default"];
var idb = require$$3;

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class PlatformLoggerServiceImpl {
    constructor(container) {
        this.container = container;
    }
    // In initial implementation, this will be called by installations on
    // auth token refresh, and installations will send this string.
    getPlatformInfoString() {
        const providers = this.container.getProviders();
        // Loop through providers and get library/version pairs from any that are
        // version components.
        return providers
            .map(provider => {
            if (isVersionServiceProvider(provider)) {
                const service = provider.getImmediate();
                return `${service.library}/${service.version}`;
            }
            else {
                return null;
            }
        })
            .filter(logString => logString)
            .join(' ');
    }
}
/**
 *
 * @param provider check if this provider provides a VersionService
 *
 * NOTE: Using Provider<'app-version'> is a hack to indicate that the provider
 * provides VersionService. The provider is not necessarily a 'app-version'
 * provider.
 */
function isVersionServiceProvider(provider) {
    const component = provider.getComponent();
    return component?.type === "VERSION" /* ComponentType.VERSION */;
}

const name$q = "@firebase/app";
const version$1 = "0.14.0";

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const logger = new logger$1.Logger('@firebase/app');

const name$p = "@firebase/app-compat";

const name$o = "@firebase/analytics-compat";

const name$n = "@firebase/analytics";

const name$m = "@firebase/app-check-compat";

const name$l = "@firebase/app-check";

const name$k = "@firebase/auth";

const name$j = "@firebase/auth-compat";

const name$i = "@firebase/database";

const name$h = "@firebase/data-connect";

const name$g = "@firebase/database-compat";

const name$f = "@firebase/functions";

const name$e = "@firebase/functions-compat";

const name$d = "@firebase/installations";

const name$c = "@firebase/installations-compat";

const name$b = "@firebase/messaging";

const name$a = "@firebase/messaging-compat";

const name$9 = "@firebase/performance";

const name$8 = "@firebase/performance-compat";

const name$7 = "@firebase/remote-config";

const name$6 = "@firebase/remote-config-compat";

const name$5 = "@firebase/storage";

const name$4 = "@firebase/storage-compat";

const name$3 = "@firebase/firestore";

const name$2 = "@firebase/ai";

const name$1 = "@firebase/firestore-compat";

const name = "firebase";
const version = "12.0.0";

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * The default app name
 *
 * @internal
 */
const DEFAULT_ENTRY_NAME = '[DEFAULT]';
const PLATFORM_LOG_STRING = {
    [name$q]: 'fire-core',
    [name$p]: 'fire-core-compat',
    [name$n]: 'fire-analytics',
    [name$o]: 'fire-analytics-compat',
    [name$l]: 'fire-app-check',
    [name$m]: 'fire-app-check-compat',
    [name$k]: 'fire-auth',
    [name$j]: 'fire-auth-compat',
    [name$i]: 'fire-rtdb',
    [name$h]: 'fire-data-connect',
    [name$g]: 'fire-rtdb-compat',
    [name$f]: 'fire-fn',
    [name$e]: 'fire-fn-compat',
    [name$d]: 'fire-iid',
    [name$c]: 'fire-iid-compat',
    [name$b]: 'fire-fcm',
    [name$a]: 'fire-fcm-compat',
    [name$9]: 'fire-perf',
    [name$8]: 'fire-perf-compat',
    [name$7]: 'fire-rc',
    [name$6]: 'fire-rc-compat',
    [name$5]: 'fire-gcs',
    [name$4]: 'fire-gcs-compat',
    [name$3]: 'fire-fst',
    [name$1]: 'fire-fst-compat',
    [name$2]: 'fire-vertex',
    'fire-js': 'fire-js', // Platform identifier for JS SDK.
    [name]: 'fire-js-all'
};

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @internal
 */
const _apps = new Map();
/**
 * @internal
 */
const _serverApps = new Map();
/**
 * Registered components.
 *
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _components = new Map();
/**
 * @param component - the component being added to this app's container
 *
 * @internal
 */
function _addComponent(app, component) {
    try {
        app.container.addComponent(component);
    }
    catch (e) {
        logger.debug(`Component ${component.name} failed to register with FirebaseApp ${app.name}`, e);
    }
}
/**
 *
 * @internal
 */
function _addOrOverwriteComponent(app, component) {
    app.container.addOrOverwriteComponent(component);
}
/**
 *
 * @param component - the component to register
 * @returns whether or not the component is registered successfully
 *
 * @internal
 */
function _registerComponent(component) {
    const componentName = component.name;
    if (_components.has(componentName)) {
        logger.debug(`There were multiple attempts to register component ${componentName}.`);
        return false;
    }
    _components.set(componentName, component);
    // add the component to existing app instances
    for (const app of _apps.values()) {
        _addComponent(app, component);
    }
    for (const serverApp of _serverApps.values()) {
        _addComponent(serverApp, component);
    }
    return true;
}
/**
 *
 * @param app - FirebaseApp instance
 * @param name - service name
 *
 * @returns the provider for the service with the matching name
 *
 * @internal
 */
function _getProvider(app, name) {
    const heartbeatController = app.container
        .getProvider('heartbeat')
        .getImmediate({ optional: true });
    if (heartbeatController) {
        void heartbeatController.triggerHeartbeat();
    }
    return app.container.getProvider(name);
}
/**
 *
 * @param app - FirebaseApp instance
 * @param name - service name
 * @param instanceIdentifier - service instance identifier in case the service supports multiple instances
 *
 * @internal
 */
function _removeServiceInstance(app, name, instanceIdentifier = DEFAULT_ENTRY_NAME) {
    _getProvider(app, name).clearInstance(instanceIdentifier);
}
/**
 *
 * @param obj - an object of type FirebaseApp, FirebaseOptions or FirebaseAppSettings.
 *
 * @returns true if the provide object is of type FirebaseApp.
 *
 * @internal
 */
function _isFirebaseApp(obj) {
    return obj.options !== undefined;
}
/**
 *
 * @param obj - an object of type FirebaseApp, FirebaseOptions or FirebaseAppSettings.
 *
 * @returns true if the provided object is of type FirebaseServerAppImpl.
 *
 * @internal
 */
function _isFirebaseServerAppSettings(obj) {
    if (_isFirebaseApp(obj)) {
        return false;
    }
    return ('authIdToken' in obj ||
        'appCheckToken' in obj ||
        'releaseOnDeref' in obj ||
        'automaticDataCollectionEnabled' in obj);
}
/**
 *
 * @param obj - an object of type FirebaseApp.
 *
 * @returns true if the provided object is of type FirebaseServerAppImpl.
 *
 * @internal
 */
function _isFirebaseServerApp(obj) {
    if (obj === null || obj === undefined) {
        return false;
    }
    return obj.settings !== undefined;
}
/**
 * Test only
 *
 * @internal
 */
function _clearComponents() {
    _components.clear();
}

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ERRORS = {
    ["no-app" /* AppError.NO_APP */]: "No Firebase App '{$appName}' has been created - " +
        'call initializeApp() first',
    ["bad-app-name" /* AppError.BAD_APP_NAME */]: "Illegal App name: '{$appName}'",
    ["duplicate-app" /* AppError.DUPLICATE_APP */]: "Firebase App named '{$appName}' already exists with different options or config",
    ["app-deleted" /* AppError.APP_DELETED */]: "Firebase App named '{$appName}' already deleted",
    ["server-app-deleted" /* AppError.SERVER_APP_DELETED */]: 'Firebase Server App has been deleted',
    ["no-options" /* AppError.NO_OPTIONS */]: 'Need to provide options, when not being deployed to hosting via source.',
    ["invalid-app-argument" /* AppError.INVALID_APP_ARGUMENT */]: 'firebase.{$appName}() takes either no argument or a ' +
        'Firebase App instance.',
    ["invalid-log-argument" /* AppError.INVALID_LOG_ARGUMENT */]: 'First argument to `onLog` must be null or a function.',
    ["idb-open" /* AppError.IDB_OPEN */]: 'Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.',
    ["idb-get" /* AppError.IDB_GET */]: 'Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.',
    ["idb-set" /* AppError.IDB_WRITE */]: 'Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.',
    ["idb-delete" /* AppError.IDB_DELETE */]: 'Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.',
    ["finalization-registry-not-supported" /* AppError.FINALIZATION_REGISTRY_NOT_SUPPORTED */]: 'FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.',
    ["invalid-server-app-environment" /* AppError.INVALID_SERVER_APP_ENVIRONMENT */]: 'FirebaseServerApp is not for use in browser environments.'
};
const ERROR_FACTORY = new util.ErrorFactory('app', 'Firebase', ERRORS);

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class FirebaseAppImpl {
    constructor(options, config, container) {
        this._isDeleted = false;
        this._options = { ...options };
        this._config = { ...config };
        this._name = config.name;
        this._automaticDataCollectionEnabled =
            config.automaticDataCollectionEnabled;
        this._container = container;
        this.container.addComponent(new component.Component('app', () => this, "PUBLIC" /* ComponentType.PUBLIC */));
    }
    get automaticDataCollectionEnabled() {
        this.checkDestroyed();
        return this._automaticDataCollectionEnabled;
    }
    set automaticDataCollectionEnabled(val) {
        this.checkDestroyed();
        this._automaticDataCollectionEnabled = val;
    }
    get name() {
        this.checkDestroyed();
        return this._name;
    }
    get options() {
        this.checkDestroyed();
        return this._options;
    }
    get config() {
        this.checkDestroyed();
        return this._config;
    }
    get container() {
        return this._container;
    }
    get isDeleted() {
        return this._isDeleted;
    }
    set isDeleted(val) {
        this._isDeleted = val;
    }
    /**
     * This function will throw an Error if the App has already been deleted -
     * use before performing API actions on the App.
     */
    checkDestroyed() {
        if (this.isDeleted) {
            throw ERROR_FACTORY.create("app-deleted" /* AppError.APP_DELETED */, { appName: this._name });
        }
    }
}

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Parse the token and check to see if the `exp` claim is in the future.
// Reports an error to the console if the token or claim could not be parsed, or if `exp` is in
// the past.
function validateTokenTTL(base64Token, tokenName) {
    const secondPart = util.base64Decode(base64Token.split('.')[1]);
    if (secondPart === null) {
        console.error(`FirebaseServerApp ${tokenName} is invalid: second part could not be parsed.`);
        return;
    }
    const expClaim = JSON.parse(secondPart).exp;
    if (expClaim === undefined) {
        console.error(`FirebaseServerApp ${tokenName} is invalid: expiration claim could not be parsed`);
        return;
    }
    const exp = JSON.parse(secondPart).exp * 1000;
    const now = new Date().getTime();
    const diff = exp - now;
    if (diff <= 0) {
        console.error(`FirebaseServerApp ${tokenName} is invalid: the token has expired.`);
    }
}
class FirebaseServerAppImpl extends FirebaseAppImpl {
    constructor(options, serverConfig, name, container) {
        // Build configuration parameters for the FirebaseAppImpl base class.
        const automaticDataCollectionEnabled = serverConfig.automaticDataCollectionEnabled !== undefined
            ? serverConfig.automaticDataCollectionEnabled
            : true;
        // Create the FirebaseAppSettings object for the FirebaseAppImp constructor.
        const config = {
            name,
            automaticDataCollectionEnabled
        };
        if (options.apiKey !== undefined) {
            // Construct the parent FirebaseAppImp object.
            super(options, config, container);
        }
        else {
            const appImpl = options;
            super(appImpl.options, config, container);
        }
        // Now construct the data for the FirebaseServerAppImpl.
        this._serverConfig = {
            automaticDataCollectionEnabled,
            ...serverConfig
        };
        // Ensure that the current time is within the `authIdtoken` window of validity.
        if (this._serverConfig.authIdToken) {
            validateTokenTTL(this._serverConfig.authIdToken, 'authIdToken');
        }
        // Ensure that the current time is within the `appCheckToken` window of validity.
        if (this._serverConfig.appCheckToken) {
            validateTokenTTL(this._serverConfig.appCheckToken, 'appCheckToken');
        }
        this._finalizationRegistry = null;
        if (typeof FinalizationRegistry !== 'undefined') {
            this._finalizationRegistry = new FinalizationRegistry(() => {
                this.automaticCleanup();
            });
        }
        this._refCount = 0;
        this.incRefCount(this._serverConfig.releaseOnDeref);
        // Do not retain a hard reference to the dref object, otherwise the FinalizationRegistry
        // will never trigger.
        this._serverConfig.releaseOnDeref = undefined;
        serverConfig.releaseOnDeref = undefined;
        registerVersion(name$q, version$1, 'serverapp');
    }
    toJSON() {
        return undefined;
    }
    get refCount() {
        return this._refCount;
    }
    // Increment the reference count of this server app. If an object is provided, register it
    // with the finalization registry.
    incRefCount(obj) {
        if (this.isDeleted) {
            return;
        }
        this._refCount++;
        if (obj !== undefined && this._finalizationRegistry !== null) {
            this._finalizationRegistry.register(obj, this);
        }
    }
    // Decrement the reference count.
    decRefCount() {
        if (this.isDeleted) {
            return 0;
        }
        return --this._refCount;
    }
    // Invoked by the FinalizationRegistry callback to note that this app should go through its
    // reference counts and delete itself if no reference count remain. The coordinating logic that
    // handles this is in deleteApp(...).
    automaticCleanup() {
        void deleteApp(this);
    }
    get settings() {
        this.checkDestroyed();
        return this._serverConfig;
    }
    /**
     * This function will throw an Error if the App has already been deleted -
     * use before performing API actions on the App.
     */
    checkDestroyed() {
        if (this.isDeleted) {
            throw ERROR_FACTORY.create("server-app-deleted" /* AppError.SERVER_APP_DELETED */);
        }
    }
}

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * The current SDK version.
 *
 * @public
 */
const SDK_VERSION = version;
function initializeApp(_options, rawConfig = {}) {
    let options = _options;
    if (typeof rawConfig !== 'object') {
        const name = rawConfig;
        rawConfig = { name };
    }
    const config = {
        name: DEFAULT_ENTRY_NAME,
        automaticDataCollectionEnabled: true,
        ...rawConfig
    };
    const name = config.name;
    if (typeof name !== 'string' || !name) {
        throw ERROR_FACTORY.create("bad-app-name" /* AppError.BAD_APP_NAME */, {
            appName: String(name)
        });
    }
    options || (options = util.getDefaultAppConfig());
    if (!options) {
        throw ERROR_FACTORY.create("no-options" /* AppError.NO_OPTIONS */);
    }
    const existingApp = _apps.get(name);
    if (existingApp) {
        // return the existing app if options and config deep equal the ones in the existing app.
        if (util.deepEqual(options, existingApp.options) &&
            util.deepEqual(config, existingApp.config)) {
            return existingApp;
        }
        else {
            throw ERROR_FACTORY.create("duplicate-app" /* AppError.DUPLICATE_APP */, { appName: name });
        }
    }
    const container = new component.ComponentContainer(name);
    for (const component of _components.values()) {
        container.addComponent(component);
    }
    const newApp = new FirebaseAppImpl(options, config, container);
    _apps.set(name, newApp);
    return newApp;
}
function initializeServerApp(_options, _serverAppConfig = {}) {
    if (util.isBrowser() && !util.isWebWorker()) {
        // FirebaseServerApp isn't designed to be run in browsers.
        throw ERROR_FACTORY.create("invalid-server-app-environment" /* AppError.INVALID_SERVER_APP_ENVIRONMENT */);
    }
    let firebaseOptions;
    let serverAppSettings = _serverAppConfig || {};
    if (_options) {
        if (_isFirebaseApp(_options)) {
            firebaseOptions = _options.options;
        }
        else if (_isFirebaseServerAppSettings(_options)) {
            serverAppSettings = _options;
        }
        else {
            firebaseOptions = _options;
        }
    }
    if (serverAppSettings.automaticDataCollectionEnabled === undefined) {
        serverAppSettings.automaticDataCollectionEnabled = true;
    }
    firebaseOptions || (firebaseOptions = util.getDefaultAppConfig());
    if (!firebaseOptions) {
        throw ERROR_FACTORY.create("no-options" /* AppError.NO_OPTIONS */);
    }
    // Build an app name based on a hash of the configuration options.
    const nameObj = {
        ...serverAppSettings,
        ...firebaseOptions
    };
    // However, Do not mangle the name based on releaseOnDeref, since it will vary between the
    // construction of FirebaseServerApp instances. For example, if the object is the request headers.
    if (nameObj.releaseOnDeref !== undefined) {
        delete nameObj.releaseOnDeref;
    }
    const hashCode = (s) => {
        return [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
    };
    if (serverAppSettings.releaseOnDeref !== undefined) {
        if (typeof FinalizationRegistry === 'undefined') {
            throw ERROR_FACTORY.create("finalization-registry-not-supported" /* AppError.FINALIZATION_REGISTRY_NOT_SUPPORTED */, {});
        }
    }
    const nameString = '' + hashCode(JSON.stringify(nameObj));
    const existingApp = _serverApps.get(nameString);
    if (existingApp) {
        existingApp.incRefCount(serverAppSettings.releaseOnDeref);
        return existingApp;
    }
    const container = new component.ComponentContainer(nameString);
    for (const component of _components.values()) {
        container.addComponent(component);
    }
    const newApp = new FirebaseServerAppImpl(firebaseOptions, serverAppSettings, nameString, container);
    _serverApps.set(nameString, newApp);
    return newApp;
}
/**
 * Retrieves a {@link @firebase/app#FirebaseApp} instance.
 *
 * When called with no arguments, the default app is returned. When an app name
 * is provided, the app corresponding to that name is returned.
 *
 * An exception is thrown if the app being retrieved has not yet been
 * initialized.
 *
 * @example
 * ```javascript
 * // Return the default app
 * const app = getApp();
 * ```
 *
 * @example
 * ```javascript
 * // Return a named app
 * const otherApp = getApp("otherApp");
 * ```
 *
 * @param name - Optional name of the app to return. If no name is
 *   provided, the default is `"[DEFAULT]"`.
 *
 * @returns The app corresponding to the provided app name.
 *   If no app name is provided, the default app is returned.
 *
 * @public
 */
function getApp(name = DEFAULT_ENTRY_NAME) {
    const app = _apps.get(name);
    if (!app && name === DEFAULT_ENTRY_NAME && util.getDefaultAppConfig()) {
        return initializeApp();
    }
    if (!app) {
        throw ERROR_FACTORY.create("no-app" /* AppError.NO_APP */, { appName: name });
    }
    return app;
}
/**
 * A (read-only) array of all initialized apps.
 * @public
 */
function getApps() {
    return Array.from(_apps.values());
}
/**
 * Renders this app unusable and frees the resources of all associated
 * services.
 *
 * @example
 * ```javascript
 * deleteApp(app)
 *   .then(function() {
 *     console.log("App deleted successfully");
 *   })
 *   .catch(function(error) {
 *     console.log("Error deleting app:", error);
 *   });
 * ```
 *
 * @public
 */
async function deleteApp(app) {
    let cleanupProviders = false;
    const name = app.name;
    if (_apps.has(name)) {
        cleanupProviders = true;
        _apps.delete(name);
    }
    else if (_serverApps.has(name)) {
        const firebaseServerApp = app;
        if (firebaseServerApp.decRefCount() <= 0) {
            _serverApps.delete(name);
            cleanupProviders = true;
        }
    }
    if (cleanupProviders) {
        await Promise.all(app.container
            .getProviders()
            .map(provider => provider.delete()));
        app.isDeleted = true;
    }
}
/**
 * Registers a library's name and version for platform logging purposes.
 * @param library - Name of 1p or 3p library (e.g. firestore, angularfire)
 * @param version - Current version of that library.
 * @param variant - Bundle variant, e.g., node, rn, etc.
 *
 * @public
 */
function registerVersion(libraryKeyOrName, version, variant) {
    // TODO: We can use this check to whitelist strings when/if we set up
    // a good whitelist system.
    let library = PLATFORM_LOG_STRING[libraryKeyOrName] ?? libraryKeyOrName;
    if (variant) {
        library += `-${variant}`;
    }
    const libraryMismatch = library.match(/\s|\//);
    const versionMismatch = version.match(/\s|\//);
    if (libraryMismatch || versionMismatch) {
        const warning = [
            `Unable to register library "${library}" with version "${version}":`
        ];
        if (libraryMismatch) {
            warning.push(`library name "${library}" contains illegal characters (whitespace or "/")`);
        }
        if (libraryMismatch && versionMismatch) {
            warning.push('and');
        }
        if (versionMismatch) {
            warning.push(`version name "${version}" contains illegal characters (whitespace or "/")`);
        }
        logger.warn(warning.join(' '));
        return;
    }
    _registerComponent(new component.Component(`${library}-version`, () => ({ library, version }), "VERSION" /* ComponentType.VERSION */));
}
/**
 * Sets log handler for all Firebase SDKs.
 * @param logCallback - An optional custom log handler that executes user code whenever
 * the Firebase SDK makes a logging call.
 *
 * @public
 */
function onLog(logCallback, options) {
    if (logCallback !== null && typeof logCallback !== 'function') {
        throw ERROR_FACTORY.create("invalid-log-argument" /* AppError.INVALID_LOG_ARGUMENT */);
    }
    logger$1.setUserLogHandler(logCallback, options);
}
/**
 * Sets log level for all Firebase SDKs.
 *
 * All of the log types above the current log level are captured (i.e. if
 * you set the log level to `info`, errors are logged, but `debug` and
 * `verbose` logs are not).
 *
 * @public
 */
function setLogLevel(logLevel) {
    logger$1.setLogLevel(logLevel);
}

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const DB_NAME = 'firebase-heartbeat-database';
const DB_VERSION = 1;
const STORE_NAME = 'firebase-heartbeat-store';
let dbPromise = null;
function getDbPromise() {
    if (!dbPromise) {
        dbPromise = idb.openDB(DB_NAME, DB_VERSION, {
            upgrade: (db, oldVersion) => {
                // We don't use 'break' in this switch statement, the fall-through
                // behavior is what we want, because if there are multiple versions between
                // the old version and the current version, we want ALL the migrations
                // that correspond to those versions to run, not only the last one.
                // eslint-disable-next-line default-case
                switch (oldVersion) {
                    case 0:
                        try {
                            db.createObjectStore(STORE_NAME);
                        }
                        catch (e) {
                            // Safari/iOS browsers throw occasional exceptions on
                            // db.createObjectStore() that may be a bug. Avoid blocking
                            // the rest of the app functionality.
                            console.warn(e);
                        }
                }
            }
        }).catch(e => {
            throw ERROR_FACTORY.create("idb-open" /* AppError.IDB_OPEN */, {
                originalErrorMessage: e.message
            });
        });
    }
    return dbPromise;
}
async function readHeartbeatsFromIndexedDB(app) {
    try {
        const db = await getDbPromise();
        const tx = db.transaction(STORE_NAME);
        const result = await tx.objectStore(STORE_NAME).get(computeKey(app));
        // We already have the value but tx.done can throw,
        // so we need to await it here to catch errors
        await tx.done;
        return result;
    }
    catch (e) {
        if (e instanceof util.FirebaseError) {
            logger.warn(e.message);
        }
        else {
            const idbGetError = ERROR_FACTORY.create("idb-get" /* AppError.IDB_GET */, {
                originalErrorMessage: e?.message
            });
            logger.warn(idbGetError.message);
        }
    }
}
async function writeHeartbeatsToIndexedDB(app, heartbeatObject) {
    try {
        const db = await getDbPromise();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const objectStore = tx.objectStore(STORE_NAME);
        await objectStore.put(heartbeatObject, computeKey(app));
        await tx.done;
    }
    catch (e) {
        if (e instanceof util.FirebaseError) {
            logger.warn(e.message);
        }
        else {
            const idbGetError = ERROR_FACTORY.create("idb-set" /* AppError.IDB_WRITE */, {
                originalErrorMessage: e?.message
            });
            logger.warn(idbGetError.message);
        }
    }
}
function computeKey(app) {
    return `${app.name}!${app.options.appId}`;
}

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const MAX_HEADER_BYTES = 1024;
const MAX_NUM_STORED_HEARTBEATS = 30;
class HeartbeatServiceImpl {
    constructor(container) {
        this.container = container;
        /**
         * In-memory cache for heartbeats, used by getHeartbeatsHeader() to generate
         * the header string.
         * Stores one record per date. This will be consolidated into the standard
         * format of one record per user agent string before being sent as a header.
         * Populated from indexedDB when the controller is instantiated and should
         * be kept in sync with indexedDB.
         * Leave public for easier testing.
         */
        this._heartbeatsCache = null;
        const app = this.container.getProvider('app').getImmediate();
        this._storage = new HeartbeatStorageImpl(app);
        this._heartbeatsCachePromise = this._storage.read().then(result => {
            this._heartbeatsCache = result;
            return result;
        });
    }
    /**
     * Called to report a heartbeat. The function will generate
     * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
     * to IndexedDB.
     * Note that we only store one heartbeat per day. So if a heartbeat for today is
     * already logged, subsequent calls to this function in the same day will be ignored.
     */
    async triggerHeartbeat() {
        try {
            const platformLogger = this.container
                .getProvider('platform-logger')
                .getImmediate();
            // This is the "Firebase user agent" string from the platform logger
            // service, not the browser user agent.
            const agent = platformLogger.getPlatformInfoString();
            const date = getUTCDateString();
            if (this._heartbeatsCache?.heartbeats == null) {
                this._heartbeatsCache = await this._heartbeatsCachePromise;
                // If we failed to construct a heartbeats cache, then return immediately.
                if (this._heartbeatsCache?.heartbeats == null) {
                    return;
                }
            }
            // Do not store a heartbeat if one is already stored for this day
            // or if a header has already been sent today.
            if (this._heartbeatsCache.lastSentHeartbeatDate === date ||
                this._heartbeatsCache.heartbeats.some(singleDateHeartbeat => singleDateHeartbeat.date === date)) {
                return;
            }
            else {
                // There is no entry for this date. Create one.
                this._heartbeatsCache.heartbeats.push({ date, agent });
                // If the number of stored heartbeats exceeds the maximum number of stored heartbeats, remove the heartbeat with the earliest date.
                // Since this is executed each time a heartbeat is pushed, the limit can only be exceeded by one, so only one needs to be removed.
                if (this._heartbeatsCache.heartbeats.length > MAX_NUM_STORED_HEARTBEATS) {
                    const earliestHeartbeatIdx = getEarliestHeartbeatIdx(this._heartbeatsCache.heartbeats);
                    this._heartbeatsCache.heartbeats.splice(earliestHeartbeatIdx, 1);
                }
            }
            return this._storage.overwrite(this._heartbeatsCache);
        }
        catch (e) {
            logger.warn(e);
        }
    }
    /**
     * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
     * It also clears all heartbeats from memory as well as in IndexedDB.
     *
     * NOTE: Consuming product SDKs should not send the header if this method
     * returns an empty string.
     */
    async getHeartbeatsHeader() {
        try {
            if (this._heartbeatsCache === null) {
                await this._heartbeatsCachePromise;
            }
            // If it's still null or the array is empty, there is no data to send.
            if (this._heartbeatsCache?.heartbeats == null ||
                this._heartbeatsCache.heartbeats.length === 0) {
                return '';
            }
            const date = getUTCDateString();
            // Extract as many heartbeats from the cache as will fit under the size limit.
            const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats);
            const headerString = util.base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: heartbeatsToSend }));
            // Store last sent date to prevent another being logged/sent for the same day.
            this._heartbeatsCache.lastSentHeartbeatDate = date;
            if (unsentEntries.length > 0) {
                // Store any unsent entries if they exist.
                this._heartbeatsCache.heartbeats = unsentEntries;
                // This seems more likely than emptying the array (below) to lead to some odd state
                // since the cache isn't empty and this will be called again on the next request,
                // and is probably safest if we await it.
                await this._storage.overwrite(this._heartbeatsCache);
            }
            else {
                this._heartbeatsCache.heartbeats = [];
                // Do not wait for this, to reduce latency.
                void this._storage.overwrite(this._heartbeatsCache);
            }
            return headerString;
        }
        catch (e) {
            logger.warn(e);
            return '';
        }
    }
}
function getUTCDateString() {
    const today = new Date();
    // Returns date format 'YYYY-MM-DD'
    return today.toISOString().substring(0, 10);
}
function extractHeartbeatsForHeader(heartbeatsCache, maxSize = MAX_HEADER_BYTES) {
    // Heartbeats grouped by user agent in the standard format to be sent in
    // the header.
    const heartbeatsToSend = [];
    // Single date format heartbeats that are not sent.
    let unsentEntries = heartbeatsCache.slice();
    for (const singleDateHeartbeat of heartbeatsCache) {
        // Look for an existing entry with the same user agent.
        const heartbeatEntry = heartbeatsToSend.find(hb => hb.agent === singleDateHeartbeat.agent);
        if (!heartbeatEntry) {
            // If no entry for this user agent exists, create one.
            heartbeatsToSend.push({
                agent: singleDateHeartbeat.agent,
                dates: [singleDateHeartbeat.date]
            });
            if (countBytes(heartbeatsToSend) > maxSize) {
                // If the header would exceed max size, remove the added heartbeat
                // entry and stop adding to the header.
                heartbeatsToSend.pop();
                break;
            }
        }
        else {
            heartbeatEntry.dates.push(singleDateHeartbeat.date);
            // If the header would exceed max size, remove the added date
            // and stop adding to the header.
            if (countBytes(heartbeatsToSend) > maxSize) {
                heartbeatEntry.dates.pop();
                break;
            }
        }
        // Pop unsent entry from queue. (Skipped if adding the entry exceeded
        // quota and the loop breaks early.)
        unsentEntries = unsentEntries.slice(1);
    }
    return {
        heartbeatsToSend,
        unsentEntries
    };
}
class HeartbeatStorageImpl {
    constructor(app) {
        this.app = app;
        this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
    }
    async runIndexedDBEnvironmentCheck() {
        if (!util.isIndexedDBAvailable()) {
            return false;
        }
        else {
            return util.validateIndexedDBOpenable()
                .then(() => true)
                .catch(() => false);
        }
    }
    /**
     * Read all heartbeats.
     */
    async read() {
        const canUseIndexedDB = await this._canUseIndexedDBPromise;
        if (!canUseIndexedDB) {
            return { heartbeats: [] };
        }
        else {
            const idbHeartbeatObject = await readHeartbeatsFromIndexedDB(this.app);
            if (idbHeartbeatObject?.heartbeats) {
                return idbHeartbeatObject;
            }
            else {
                return { heartbeats: [] };
            }
        }
    }
    // overwrite the storage with the provided heartbeats
    async overwrite(heartbeatsObject) {
        const canUseIndexedDB = await this._canUseIndexedDBPromise;
        if (!canUseIndexedDB) {
            return;
        }
        else {
            const existingHeartbeatsObject = await this.read();
            return writeHeartbeatsToIndexedDB(this.app, {
                lastSentHeartbeatDate: heartbeatsObject.lastSentHeartbeatDate ??
                    existingHeartbeatsObject.lastSentHeartbeatDate,
                heartbeats: heartbeatsObject.heartbeats
            });
        }
    }
    // add heartbeats
    async add(heartbeatsObject) {
        const canUseIndexedDB = await this._canUseIndexedDBPromise;
        if (!canUseIndexedDB) {
            return;
        }
        else {
            const existingHeartbeatsObject = await this.read();
            return writeHeartbeatsToIndexedDB(this.app, {
                lastSentHeartbeatDate: heartbeatsObject.lastSentHeartbeatDate ??
                    existingHeartbeatsObject.lastSentHeartbeatDate,
                heartbeats: [
                    ...existingHeartbeatsObject.heartbeats,
                    ...heartbeatsObject.heartbeats
                ]
            });
        }
    }
}
/**
 * Calculate bytes of a HeartbeatsByUserAgent array after being wrapped
 * in a platform logging header JSON object, stringified, and converted
 * to base 64.
 */
function countBytes(heartbeatsCache) {
    // base64 has a restricted set of characters, all of which should be 1 byte.
    return util.base64urlEncodeWithoutPadding(
    // heartbeatsCache wrapper properties
    JSON.stringify({ version: 2, heartbeats: heartbeatsCache })).length;
}
/**
 * Returns the index of the heartbeat with the earliest date.
 * If the heartbeats array is empty, -1 is returned.
 */
function getEarliestHeartbeatIdx(heartbeats) {
    if (heartbeats.length === 0) {
        return -1;
    }
    let earliestHeartbeatIdx = 0;
    let earliestHeartbeatDate = heartbeats[0].date;
    for (let i = 1; i < heartbeats.length; i++) {
        if (heartbeats[i].date < earliestHeartbeatDate) {
            earliestHeartbeatDate = heartbeats[i].date;
            earliestHeartbeatIdx = i;
        }
    }
    return earliestHeartbeatIdx;
}

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function registerCoreComponents(variant) {
    _registerComponent(new component.Component('platform-logger', container => new PlatformLoggerServiceImpl(container), "PRIVATE" /* ComponentType.PRIVATE */));
    _registerComponent(new component.Component('heartbeat', container => new HeartbeatServiceImpl(container), "PRIVATE" /* ComponentType.PRIVATE */));
    // Register `app` package.
    registerVersion(name$q, version$1, variant);
    // BUILD_TARGET will be replaced by values like esm, cjs, etc during the compilation
    registerVersion(name$q, version$1, 'cjs2020');
    // Register platform SDK identifier (no version).
    registerVersion('fire-js', '');
}

/**
 * Firebase App
 *
 * @remarks This package coordinates the communication between the different Firebase components
 * @packageDocumentation
 */
registerCoreComponents('node');

Object.defineProperty(exports, 'FirebaseError', {
  enumerable: true,
  get: function () { return util.FirebaseError; }
});
exports.SDK_VERSION = SDK_VERSION;
exports._DEFAULT_ENTRY_NAME = DEFAULT_ENTRY_NAME;
exports._addComponent = _addComponent;
exports._addOrOverwriteComponent = _addOrOverwriteComponent;
exports._apps = _apps;
exports._clearComponents = _clearComponents;
exports._components = _components;
exports._getProvider = _getProvider;
exports._isFirebaseApp = _isFirebaseApp;
exports._isFirebaseServerApp = _isFirebaseServerApp;
exports._isFirebaseServerAppSettings = _isFirebaseServerAppSettings;
exports._registerComponent = _registerComponent;
exports._removeServiceInstance = _removeServiceInstance;
exports._serverApps = _serverApps;
exports.deleteApp = deleteApp;
exports.getApp = getApp;
exports.getApps = getApps;
exports.initializeApp = initializeApp;
exports.initializeServerApp = initializeServerApp;
exports.onLog = onLog;
exports.registerVersion = registerVersion;
exports.setLogLevel = setLogLevel;

}(index_cjs));

Object.defineProperty(index_standalone, '__esModule', { value: true });

var Websocket = websocket;
var util = require$$2__default$3["default"];
var logger$1 = require$$1__default$3["default"];
var app = index_cjs;
var component = require$$0__default$2["default"];

function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Websocket__default = /*#__PURE__*/_interopDefaultLegacy$1(Websocket);

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const PROTOCOL_VERSION = '5';
const VERSION_PARAM = 'v';
const TRANSPORT_SESSION_PARAM = 's';
const REFERER_PARAM = 'r';
const FORGE_REF = 'f';
// Matches console.firebase.google.com, firebase-console-*.corp.google.com and
// firebase.corp.google.com
const FORGE_DOMAIN_RE = /(console\.firebase|firebase-console-\w+\.corp|firebase\.corp)\.google\.com/;
const LAST_SESSION_PARAM = 'ls';
const APPLICATION_ID_PARAM = 'p';
const APP_CHECK_TOKEN_PARAM = 'ac';
const WEBSOCKET = 'websocket';
const LONG_POLLING = 'long_polling';

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Wraps a DOM Storage object and:
 * - automatically encode objects as JSON strings before storing them to allow us to store arbitrary types.
 * - prefixes names with "firebase:" to avoid collisions with app data.
 *
 * We automatically (see storage.js) create two such wrappers, one for sessionStorage,
 * and one for localStorage.
 *
 */
class DOMStorageWrapper {
    /**
     * @param domStorage_ - The underlying storage object (e.g. localStorage or sessionStorage)
     */
    constructor(domStorage_) {
        this.domStorage_ = domStorage_;
        // Use a prefix to avoid collisions with other stuff saved by the app.
        this.prefix_ = 'firebase:';
    }
    /**
     * @param key - The key to save the value under
     * @param value - The value being stored, or null to remove the key.
     */
    set(key, value) {
        if (value == null) {
            this.domStorage_.removeItem(this.prefixedName_(key));
        }
        else {
            this.domStorage_.setItem(this.prefixedName_(key), util.stringify(value));
        }
    }
    /**
     * @returns The value that was stored under this key, or null
     */
    get(key) {
        const storedVal = this.domStorage_.getItem(this.prefixedName_(key));
        if (storedVal == null) {
            return null;
        }
        else {
            return util.jsonEval(storedVal);
        }
    }
    remove(key) {
        this.domStorage_.removeItem(this.prefixedName_(key));
    }
    prefixedName_(name) {
        return this.prefix_ + name;
    }
    toString() {
        return this.domStorage_.toString();
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An in-memory storage implementation that matches the API of DOMStorageWrapper
 * (TODO: create interface for both to implement).
 */
class MemoryStorage {
    constructor() {
        this.cache_ = {};
        this.isInMemoryStorage = true;
    }
    set(key, value) {
        if (value == null) {
            delete this.cache_[key];
        }
        else {
            this.cache_[key] = value;
        }
    }
    get(key) {
        if (util.contains(this.cache_, key)) {
            return this.cache_[key];
        }
        return null;
    }
    remove(key) {
        delete this.cache_[key];
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Helper to create a DOMStorageWrapper or else fall back to MemoryStorage.
 * TODO: Once MemoryStorage and DOMStorageWrapper have a shared interface this method annotation should change
 * to reflect this type
 *
 * @param domStorageName - Name of the underlying storage object
 *   (e.g. 'localStorage' or 'sessionStorage').
 * @returns Turning off type information until a common interface is defined.
 */
const createStoragefor = function (domStorageName) {
    try {
        // NOTE: just accessing "localStorage" or "window['localStorage']" may throw a security exception,
        // so it must be inside the try/catch.
        if (typeof window !== 'undefined' &&
            typeof window[domStorageName] !== 'undefined') {
            // Need to test cache. Just because it's here doesn't mean it works
            const domStorage = window[domStorageName];
            domStorage.setItem('firebase:sentinel', 'cache');
            domStorage.removeItem('firebase:sentinel');
            return new DOMStorageWrapper(domStorage);
        }
    }
    catch (e) { }
    // Failed to create wrapper.  Just return in-memory storage.
    // TODO: log?
    return new MemoryStorage();
};
/** A storage object that lasts across sessions */
const PersistentStorage = createStoragefor('localStorage');
/** A storage object that only lasts one session */
const SessionStorage = createStoragefor('sessionStorage');

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const logClient$1 = new logger$1.Logger('@firebase/database');
/**
 * Returns a locally-unique ID (generated by just incrementing up from 0 each time its called).
 */
const LUIDGenerator = (function () {
    let id = 1;
    return function () {
        return id++;
    };
})();
/**
 * Sha1 hash of the input string
 * @param str - The string to hash
 * @returns {!string} The resulting hash
 */
const sha1 = function (str) {
    const utf8Bytes = util.stringToByteArray(str);
    const sha1 = new util.Sha1();
    sha1.update(utf8Bytes);
    const sha1Bytes = sha1.digest();
    return util.base64.encodeByteArray(sha1Bytes);
};
const buildLogMessage_ = function (...varArgs) {
    let message = '';
    for (let i = 0; i < varArgs.length; i++) {
        const arg = varArgs[i];
        if (Array.isArray(arg) ||
            (arg &&
                typeof arg === 'object' &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                typeof arg.length === 'number')) {
            message += buildLogMessage_.apply(null, arg);
        }
        else if (typeof arg === 'object') {
            message += util.stringify(arg);
        }
        else {
            message += arg;
        }
        message += ' ';
    }
    return message;
};
/**
 * Use this for all debug messages in Firebase.
 */
let logger = null;
/**
 * Flag to check for log availability on first log message
 */
let firstLog_ = true;
/**
 * The implementation of Firebase.enableLogging (defined here to break dependencies)
 * @param logger_ - A flag to turn on logging, or a custom logger
 * @param persistent - Whether or not to persist logging settings across refreshes
 */
const enableLogging$1 = function (logger_, persistent) {
    util.assert(!persistent || logger_ === true || logger_ === false, "Can't turn on custom loggers persistently.");
    if (logger_ === true) {
        logClient$1.logLevel = logger$1.LogLevel.VERBOSE;
        logger = logClient$1.log.bind(logClient$1);
        if (persistent) {
            SessionStorage.set('logging_enabled', true);
        }
    }
    else if (typeof logger_ === 'function') {
        logger = logger_;
    }
    else {
        logger = null;
        SessionStorage.remove('logging_enabled');
    }
};
const log = function (...varArgs) {
    if (firstLog_ === true) {
        firstLog_ = false;
        if (logger === null && SessionStorage.get('logging_enabled') === true) {
            enableLogging$1(true);
        }
    }
    if (logger) {
        const message = buildLogMessage_.apply(null, varArgs);
        logger(message);
    }
};
const logWrapper = function (prefix) {
    return function (...varArgs) {
        log(prefix, ...varArgs);
    };
};
const error = function (...varArgs) {
    const message = 'FIREBASE INTERNAL ERROR: ' + buildLogMessage_(...varArgs);
    logClient$1.error(message);
};
const fatal = function (...varArgs) {
    const message = `FIREBASE FATAL ERROR: ${buildLogMessage_(...varArgs)}`;
    logClient$1.error(message);
    throw new Error(message);
};
const warn$1 = function (...varArgs) {
    const message = 'FIREBASE WARNING: ' + buildLogMessage_(...varArgs);
    logClient$1.warn(message);
};
/**
 * Logs a warning if the containing page uses https. Called when a call to new Firebase
 * does not use https.
 */
const warnIfPageIsSecure = function () {
    // Be very careful accessing browser globals. Who knows what may or may not exist.
    if (typeof window !== 'undefined' &&
        window.location &&
        window.location.protocol &&
        window.location.protocol.indexOf('https:') !== -1) {
        warn$1('Insecure Firebase access from a secure page. ' +
            'Please use https in calls to new Firebase().');
    }
};
/**
 * Returns true if data is NaN, or +/- Infinity.
 */
const isInvalidJSONNumber = function (data) {
    return (typeof data === 'number' &&
        (data !== data || // NaN
            data === Number.POSITIVE_INFINITY ||
            data === Number.NEGATIVE_INFINITY));
};
const executeWhenDOMReady = function (fn) {
    if (util.isNodeSdk() || document.readyState === 'complete') {
        fn();
    }
    else {
        // Modeled after jQuery. Try DOMContentLoaded and onreadystatechange (which
        // fire before onload), but fall back to onload.
        let called = false;
        const wrappedFn = function () {
            if (!document.body) {
                setTimeout(wrappedFn, Math.floor(10));
                return;
            }
            if (!called) {
                called = true;
                fn();
            }
        };
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', wrappedFn, false);
            // fallback to onload.
            window.addEventListener('load', wrappedFn, false);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        else if (document.attachEvent) {
            // IE.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            document.attachEvent('onreadystatechange', () => {
                if (document.readyState === 'complete') {
                    wrappedFn();
                }
            });
            // fallback to onload.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            window.attachEvent('onload', wrappedFn);
            // jQuery has an extra hack for IE that we could employ (based on
            // http://javascript.nwbox.com/IEContentLoaded/) But it looks really old.
            // I'm hoping we don't need it.
        }
    }
};
/**
 * Minimum key name. Invalid for actual data, used as a marker to sort before any valid names
 */
const MIN_NAME = '[MIN_NAME]';
/**
 * Maximum key name. Invalid for actual data, used as a marker to sort above any valid names
 */
const MAX_NAME = '[MAX_NAME]';
/**
 * Compares valid Firebase key names, plus min and max name
 */
const nameCompare = function (a, b) {
    if (a === b) {
        return 0;
    }
    else if (a === MIN_NAME || b === MAX_NAME) {
        return -1;
    }
    else if (b === MIN_NAME || a === MAX_NAME) {
        return 1;
    }
    else {
        const aAsInt = tryParseInt(a), bAsInt = tryParseInt(b);
        if (aAsInt !== null) {
            if (bAsInt !== null) {
                return aAsInt - bAsInt === 0 ? a.length - b.length : aAsInt - bAsInt;
            }
            else {
                return -1;
            }
        }
        else if (bAsInt !== null) {
            return 1;
        }
        else {
            return a < b ? -1 : 1;
        }
    }
};
/**
 * @returns {!number} comparison result.
 */
const stringCompare = function (a, b) {
    if (a === b) {
        return 0;
    }
    else if (a < b) {
        return -1;
    }
    else {
        return 1;
    }
};
const requireKey = function (key, obj) {
    if (obj && key in obj) {
        return obj[key];
    }
    else {
        throw new Error('Missing required key (' + key + ') in object: ' + util.stringify(obj));
    }
};
const ObjectToUniqueKey = function (obj) {
    if (typeof obj !== 'object' || obj === null) {
        return util.stringify(obj);
    }
    const keys = [];
    // eslint-disable-next-line guard-for-in
    for (const k in obj) {
        keys.push(k);
    }
    // Export as json, but with the keys sorted.
    keys.sort();
    let key = '{';
    for (let i = 0; i < keys.length; i++) {
        if (i !== 0) {
            key += ',';
        }
        key += util.stringify(keys[i]);
        key += ':';
        key += ObjectToUniqueKey(obj[keys[i]]);
    }
    key += '}';
    return key;
};
/**
 * Splits a string into a number of smaller segments of maximum size
 * @param str - The string
 * @param segsize - The maximum number of chars in the string.
 * @returns The string, split into appropriately-sized chunks
 */
const splitStringBySize = function (str, segsize) {
    const len = str.length;
    if (len <= segsize) {
        return [str];
    }
    const dataSegs = [];
    for (let c = 0; c < len; c += segsize) {
        if (c + segsize > len) {
            dataSegs.push(str.substring(c, len));
        }
        else {
            dataSegs.push(str.substring(c, c + segsize));
        }
    }
    return dataSegs;
};
/**
 * Apply a function to each (key, value) pair in an object or
 * apply a function to each (index, value) pair in an array
 * @param obj - The object or array to iterate over
 * @param fn - The function to apply
 */
function each(obj, fn) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            fn(key, obj[key]);
        }
    }
}
/**
 * Borrowed from http://hg.secondlife.com/llsd/src/tip/js/typedarray.js (MIT License)
 * I made one modification at the end and removed the NaN / Infinity
 * handling (since it seemed broken [caused an overflow] and we don't need it).  See MJL comments.
 * @param v - A double
 *
 */
const doubleToIEEE754String = function (v) {
    util.assert(!isInvalidJSONNumber(v), 'Invalid JSON number'); // MJL
    const ebits = 11, fbits = 52;
    const bias = (1 << (ebits - 1)) - 1;
    let s, e, f, ln, i;
    // Compute sign, exponent, fraction
    // Skip NaN / Infinity handling --MJL.
    if (v === 0) {
        e = 0;
        f = 0;
        s = 1 / v === -Infinity ? 1 : 0;
    }
    else {
        s = v < 0;
        v = Math.abs(v);
        if (v >= Math.pow(2, 1 - bias)) {
            // Normalized
            ln = Math.min(Math.floor(Math.log(v) / Math.LN2), bias);
            e = ln + bias;
            f = Math.round(v * Math.pow(2, fbits - ln) - Math.pow(2, fbits));
        }
        else {
            // Denormalized
            e = 0;
            f = Math.round(v / Math.pow(2, 1 - bias - fbits));
        }
    }
    // Pack sign, exponent, fraction
    const bits = [];
    for (i = fbits; i; i -= 1) {
        bits.push(f % 2 ? 1 : 0);
        f = Math.floor(f / 2);
    }
    for (i = ebits; i; i -= 1) {
        bits.push(e % 2 ? 1 : 0);
        e = Math.floor(e / 2);
    }
    bits.push(s ? 1 : 0);
    bits.reverse();
    const str = bits.join('');
    // Return the data as a hex string. --MJL
    let hexByteString = '';
    for (i = 0; i < 64; i += 8) {
        let hexByte = parseInt(str.substr(i, 8), 2).toString(16);
        if (hexByte.length === 1) {
            hexByte = '0' + hexByte;
        }
        hexByteString = hexByteString + hexByte;
    }
    return hexByteString.toLowerCase();
};
/**
 * Used to detect if we're in a Chrome content script (which executes in an
 * isolated environment where long-polling doesn't work).
 */
const isChromeExtensionContentScript = function () {
    return !!(typeof window === 'object' &&
        window['chrome'] &&
        window['chrome']['extension'] &&
        !/^chrome/.test(window.location.href));
};
/**
 * Used to detect if we're in a Windows 8 Store app.
 */
const isWindowsStoreApp = function () {
    // Check for the presence of a couple WinRT globals
    return typeof Windows === 'object' && typeof Windows.UI === 'object';
};
/**
 * Converts a server error code to a JavaScript Error
 */
function errorForServerCode(code, query) {
    let reason = 'Unknown Error';
    if (code === 'too_big') {
        reason =
            'The data requested exceeds the maximum size ' +
                'that can be accessed with a single request.';
    }
    else if (code === 'permission_denied') {
        reason = "Client doesn't have permission to access the desired data.";
    }
    else if (code === 'unavailable') {
        reason = 'The service is unavailable';
    }
    const error = new Error(code + ' at ' + query._path.toString() + ': ' + reason);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error.code = code.toUpperCase();
    return error;
}
/**
 * Used to test for integer-looking strings
 */
const INTEGER_REGEXP_ = new RegExp('^-?(0*)\\d{1,10}$');
/**
 * For use in keys, the minimum possible 32-bit integer.
 */
const INTEGER_32_MIN = -2147483648;
/**
 * For use in keys, the maximum possible 32-bit integer.
 */
const INTEGER_32_MAX = 2147483647;
/**
 * If the string contains a 32-bit integer, return it.  Else return null.
 */
const tryParseInt = function (str) {
    if (INTEGER_REGEXP_.test(str)) {
        const intVal = Number(str);
        if (intVal >= INTEGER_32_MIN && intVal <= INTEGER_32_MAX) {
            return intVal;
        }
    }
    return null;
};
/**
 * Helper to run some code but catch any exceptions and re-throw them later.
 * Useful for preventing user callbacks from breaking internal code.
 *
 * Re-throwing the exception from a setTimeout is a little evil, but it's very
 * convenient (we don't have to try to figure out when is a safe point to
 * re-throw it), and the behavior seems reasonable:
 *
 * * If you aren't pausing on exceptions, you get an error in the console with
 *   the correct stack trace.
 * * If you're pausing on all exceptions, the debugger will pause on your
 *   exception and then again when we rethrow it.
 * * If you're only pausing on uncaught exceptions, the debugger will only pause
 *   on us re-throwing it.
 *
 * @param fn - The code to guard.
 */
const exceptionGuard = function (fn) {
    try {
        fn();
    }
    catch (e) {
        // Re-throw exception when it's safe.
        setTimeout(() => {
            // It used to be that "throw e" would result in a good console error with
            // relevant context, but as of Chrome 39, you just get the firebase.js
            // file/line number where we re-throw it, which is useless. So we log
            // e.stack explicitly.
            const stack = e.stack || '';
            warn$1('Exception was thrown by user callback.', stack);
            throw e;
        }, Math.floor(0));
    }
};
/**
 * @returns {boolean} true if we think we're currently being crawled.
 */
const beingCrawled = function () {
    const userAgent = (typeof window === 'object' &&
        window['navigator'] &&
        window['navigator']['userAgent']) ||
        '';
    // For now we whitelist the most popular crawlers.  We should refine this to be the set of crawlers we
    // believe to support JavaScript/AJAX rendering.
    // NOTE: Google Webmaster Tools doesn't really belong, but their "This is how a visitor to your website
    // would have seen the page" is flaky if we don't treat it as a crawler.
    return (userAgent.search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i) >= 0);
};
/**
 * Same as setTimeout() except on Node.JS it will /not/ prevent the process from exiting.
 *
 * It is removed with clearTimeout() as normal.
 *
 * @param fn - Function to run.
 * @param time - Milliseconds to wait before running.
 * @returns The setTimeout() return value.
 */
const setTimeoutNonBlocking = function (fn, time) {
    const timeout = setTimeout(fn, time);
    // Note: at the time of this comment, unrefTimer is under the unstable set of APIs. Run with --unstable to enable the API.
    if (typeof timeout === 'number' &&
        // @ts-ignore Is only defined in Deno environments.
        typeof Deno !== 'undefined' &&
        // @ts-ignore Deno and unrefTimer are only defined in Deno environments.
        Deno['unrefTimer']) {
        // @ts-ignore Deno and unrefTimer are only defined in Deno environments.
        Deno.unrefTimer(timeout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }
    else if (typeof timeout === 'object' && timeout['unref']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        timeout['unref']();
    }
    return timeout;
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A class that holds metadata about a Repo object
 */
class RepoInfo {
    /**
     * @param host - Hostname portion of the url for the repo
     * @param secure - Whether or not this repo is accessed over ssl
     * @param namespace - The namespace represented by the repo
     * @param webSocketOnly - Whether to prefer websockets over all other transports (used by Nest).
     * @param nodeAdmin - Whether this instance uses Admin SDK credentials
     * @param persistenceKey - Override the default session persistence storage key
     */
    constructor(host, secure, namespace, webSocketOnly, nodeAdmin = false, persistenceKey = '', includeNamespaceInQueryParams = false, isUsingEmulator = false, emulatorOptions = null) {
        this.secure = secure;
        this.namespace = namespace;
        this.webSocketOnly = webSocketOnly;
        this.nodeAdmin = nodeAdmin;
        this.persistenceKey = persistenceKey;
        this.includeNamespaceInQueryParams = includeNamespaceInQueryParams;
        this.isUsingEmulator = isUsingEmulator;
        this.emulatorOptions = emulatorOptions;
        this._host = host.toLowerCase();
        this._domain = this._host.substr(this._host.indexOf('.') + 1);
        this.internalHost =
            PersistentStorage.get('host:' + host) || this._host;
    }
    isCacheableHost() {
        return this.internalHost.substr(0, 2) === 's-';
    }
    isCustomHost() {
        return (this._domain !== 'firebaseio.com' &&
            this._domain !== 'firebaseio-demo.com');
    }
    get host() {
        return this._host;
    }
    set host(newHost) {
        if (newHost !== this.internalHost) {
            this.internalHost = newHost;
            if (this.isCacheableHost()) {
                PersistentStorage.set('host:' + this._host, this.internalHost);
            }
        }
    }
    toString() {
        let str = this.toURLString();
        if (this.persistenceKey) {
            str += '<' + this.persistenceKey + '>';
        }
        return str;
    }
    toURLString() {
        const protocol = this.secure ? 'https://' : 'http://';
        const query = this.includeNamespaceInQueryParams
            ? `?ns=${this.namespace}`
            : '';
        return `${protocol}${this.host}/${query}`;
    }
}
function repoInfoNeedsQueryParam(repoInfo) {
    return (repoInfo.host !== repoInfo.internalHost ||
        repoInfo.isCustomHost() ||
        repoInfo.includeNamespaceInQueryParams);
}
/**
 * Returns the websocket URL for this repo
 * @param repoInfo - RepoInfo object
 * @param type - of connection
 * @param params - list
 * @returns The URL for this repo
 */
function repoInfoConnectionURL(repoInfo, type, params) {
    util.assert(typeof type === 'string', 'typeof type must == string');
    util.assert(typeof params === 'object', 'typeof params must == object');
    let connURL;
    if (type === WEBSOCKET) {
        connURL =
            (repoInfo.secure ? 'wss://' : 'ws://') + repoInfo.internalHost + '/.ws?';
    }
    else if (type === LONG_POLLING) {
        connURL =
            (repoInfo.secure ? 'https://' : 'http://') +
                repoInfo.internalHost +
                '/.lp?';
    }
    else {
        throw new Error('Unknown connection type: ' + type);
    }
    if (repoInfoNeedsQueryParam(repoInfo)) {
        params['ns'] = repoInfo.namespace;
    }
    const pairs = [];
    each(params, (key, value) => {
        pairs.push(key + '=' + value);
    });
    return connURL + pairs.join('&');
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Tracks a collection of stats.
 */
class StatsCollection {
    constructor() {
        this.counters_ = {};
    }
    incrementCounter(name, amount = 1) {
        if (!util.contains(this.counters_, name)) {
            this.counters_[name] = 0;
        }
        this.counters_[name] += amount;
    }
    get() {
        return util.deepCopy(this.counters_);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const collections = {};
const reporters = {};
function statsManagerGetCollection(repoInfo) {
    const hashString = repoInfo.toString();
    if (!collections[hashString]) {
        collections[hashString] = new StatsCollection();
    }
    return collections[hashString];
}
function statsManagerGetOrCreateReporter(repoInfo, creatorFunction) {
    const hashString = repoInfo.toString();
    if (!reporters[hashString]) {
        reporters[hashString] = creatorFunction();
    }
    return reporters[hashString];
}

/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** The semver (www.semver.org) version of the SDK. */
let SDK_VERSION = '';
/**
 * SDK_VERSION should be set before any database instance is created
 * @internal
 */
function setSDKVersion(version) {
    SDK_VERSION = version;
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const WEBSOCKET_MAX_FRAME_SIZE = 16384;
const WEBSOCKET_KEEPALIVE_INTERVAL = 45000;
let WebSocketImpl = null;
if (typeof MozWebSocket !== 'undefined') {
    WebSocketImpl = MozWebSocket;
}
else if (typeof WebSocket !== 'undefined') {
    WebSocketImpl = WebSocket;
}
function setWebSocketImpl(impl) {
    WebSocketImpl = impl;
}
/**
 * Create a new websocket connection with the given callbacks.
 */
class WebSocketConnection {
    /**
     * @param connId identifier for this transport
     * @param repoInfo The info for the websocket endpoint.
     * @param applicationId The Firebase App ID for this project.
     * @param appCheckToken The App Check Token for this client.
     * @param authToken The Auth Token for this client.
     * @param transportSessionId Optional transportSessionId if this is connecting
     * to an existing transport session
     * @param lastSessionId Optional lastSessionId if there was a previous
     * connection
     */
    constructor(connId, repoInfo, applicationId, appCheckToken, authToken, transportSessionId, lastSessionId) {
        this.connId = connId;
        this.applicationId = applicationId;
        this.appCheckToken = appCheckToken;
        this.authToken = authToken;
        this.keepaliveTimer = null;
        this.frames = null;
        this.totalFrames = 0;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.log_ = logWrapper(this.connId);
        this.stats_ = statsManagerGetCollection(repoInfo);
        this.connURL = WebSocketConnection.connectionURL_(repoInfo, transportSessionId, lastSessionId, appCheckToken, applicationId);
        this.nodeAdmin = repoInfo.nodeAdmin;
    }
    /**
     * @param repoInfo - The info for the websocket endpoint.
     * @param transportSessionId - Optional transportSessionId if this is connecting to an existing transport
     *                                         session
     * @param lastSessionId - Optional lastSessionId if there was a previous connection
     * @returns connection url
     */
    static connectionURL_(repoInfo, transportSessionId, lastSessionId, appCheckToken, applicationId) {
        const urlParams = {};
        urlParams[VERSION_PARAM] = PROTOCOL_VERSION;
        if (!util.isNodeSdk() &&
            typeof location !== 'undefined' &&
            location.hostname &&
            FORGE_DOMAIN_RE.test(location.hostname)) {
            urlParams[REFERER_PARAM] = FORGE_REF;
        }
        if (transportSessionId) {
            urlParams[TRANSPORT_SESSION_PARAM] = transportSessionId;
        }
        if (lastSessionId) {
            urlParams[LAST_SESSION_PARAM] = lastSessionId;
        }
        if (appCheckToken) {
            urlParams[APP_CHECK_TOKEN_PARAM] = appCheckToken;
        }
        if (applicationId) {
            urlParams[APPLICATION_ID_PARAM] = applicationId;
        }
        return repoInfoConnectionURL(repoInfo, WEBSOCKET, urlParams);
    }
    /**
     * @param onMessage - Callback when messages arrive
     * @param onDisconnect - Callback with connection lost.
     */
    open(onMessage, onDisconnect) {
        this.onDisconnect = onDisconnect;
        this.onMessage = onMessage;
        this.log_('Websocket connecting to ' + this.connURL);
        this.everConnected_ = false;
        // Assume failure until proven otherwise.
        PersistentStorage.set('previous_websocket_failure', true);
        try {
            let options;
            if (util.isNodeSdk()) {
                const device = this.nodeAdmin ? 'AdminNode' : 'Node';
                // UA Format: Firebase/<wire_protocol>/<sdk_version>/<platform>/<device>
                options = {
                    headers: {
                        'User-Agent': `Firebase/${PROTOCOL_VERSION}/${SDK_VERSION}/${process.platform}/${device}`,
                        'X-Firebase-GMPID': this.applicationId || ''
                    }
                };
                // If using Node with admin creds, AppCheck-related checks are unnecessary.
                // Note that we send the credentials here even if they aren't admin credentials, which is
                // not a problem.
                // Note that this header is just used to bypass appcheck, and the token should still be sent
                // through the websocket connection once it is established.
                if (this.authToken) {
                    options.headers['Authorization'] = `Bearer ${this.authToken}`;
                }
                if (this.appCheckToken) {
                    options.headers['X-Firebase-AppCheck'] = this.appCheckToken;
                }
                // Plumb appropriate http_proxy environment variable into faye-websocket if it exists.
                const env = process['env'];
                const proxy = this.connURL.indexOf('wss://') === 0
                    ? env['HTTPS_PROXY'] || env['https_proxy']
                    : env['HTTP_PROXY'] || env['http_proxy'];
                if (proxy) {
                    options['proxy'] = { origin: proxy };
                }
            }
            this.mySock = new WebSocketImpl(this.connURL, [], options);
        }
        catch (e) {
            this.log_('Error instantiating WebSocket.');
            const error = e.message || e.data;
            if (error) {
                this.log_(error);
            }
            this.onClosed_();
            return;
        }
        this.mySock.onopen = () => {
            this.log_('Websocket connected.');
            this.everConnected_ = true;
        };
        this.mySock.onclose = () => {
            this.log_('Websocket connection was disconnected.');
            this.mySock = null;
            this.onClosed_();
        };
        this.mySock.onmessage = m => {
            this.handleIncomingFrame(m);
        };
        this.mySock.onerror = e => {
            this.log_('WebSocket error.  Closing connection.');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = e.message || e.data;
            if (error) {
                this.log_(error);
            }
            this.onClosed_();
        };
    }
    /**
     * No-op for websockets, we don't need to do anything once the connection is confirmed as open
     */
    start() { }
    static forceDisallow() {
        WebSocketConnection.forceDisallow_ = true;
    }
    static isAvailable() {
        let isOldAndroid = false;
        if (typeof navigator !== 'undefined' && navigator.userAgent) {
            const oldAndroidRegex = /Android ([0-9]{0,}\.[0-9]{0,})/;
            const oldAndroidMatch = navigator.userAgent.match(oldAndroidRegex);
            if (oldAndroidMatch && oldAndroidMatch.length > 1) {
                if (parseFloat(oldAndroidMatch[1]) < 4.4) {
                    isOldAndroid = true;
                }
            }
        }
        return (!isOldAndroid &&
            WebSocketImpl !== null &&
            !WebSocketConnection.forceDisallow_);
    }
    /**
     * Returns true if we previously failed to connect with this transport.
     */
    static previouslyFailed() {
        // If our persistent storage is actually only in-memory storage,
        // we default to assuming that it previously failed to be safe.
        return (PersistentStorage.isInMemoryStorage ||
            PersistentStorage.get('previous_websocket_failure') === true);
    }
    markConnectionHealthy() {
        PersistentStorage.remove('previous_websocket_failure');
    }
    appendFrame_(data) {
        this.frames.push(data);
        if (this.frames.length === this.totalFrames) {
            const fullMess = this.frames.join('');
            this.frames = null;
            const jsonMess = util.jsonEval(fullMess);
            //handle the message
            this.onMessage(jsonMess);
        }
    }
    /**
     * @param frameCount - The number of frames we are expecting from the server
     */
    handleNewFrameCount_(frameCount) {
        this.totalFrames = frameCount;
        this.frames = [];
    }
    /**
     * Attempts to parse a frame count out of some text. If it can't, assumes a value of 1
     * @returns Any remaining data to be process, or null if there is none
     */
    extractFrameCount_(data) {
        util.assert(this.frames === null, 'We already have a frame buffer');
        // TODO: The server is only supposed to send up to 9999 frames (i.e. length <= 4), but that isn't being enforced
        // currently.  So allowing larger frame counts (length <= 6).  See https://app.asana.com/0/search/8688598998380/8237608042508
        if (data.length <= 6) {
            const frameCount = Number(data);
            if (!isNaN(frameCount)) {
                this.handleNewFrameCount_(frameCount);
                return null;
            }
        }
        this.handleNewFrameCount_(1);
        return data;
    }
    /**
     * Process a websocket frame that has arrived from the server.
     * @param mess - The frame data
     */
    handleIncomingFrame(mess) {
        if (this.mySock === null) {
            return; // Chrome apparently delivers incoming packets even after we .close() the connection sometimes.
        }
        const data = mess['data'];
        this.bytesReceived += data.length;
        this.stats_.incrementCounter('bytes_received', data.length);
        this.resetKeepAlive();
        if (this.frames !== null) {
            // we're buffering
            this.appendFrame_(data);
        }
        else {
            // try to parse out a frame count, otherwise, assume 1 and process it
            const remainingData = this.extractFrameCount_(data);
            if (remainingData !== null) {
                this.appendFrame_(remainingData);
            }
        }
    }
    /**
     * Send a message to the server
     * @param data - The JSON object to transmit
     */
    send(data) {
        this.resetKeepAlive();
        const dataStr = util.stringify(data);
        this.bytesSent += dataStr.length;
        this.stats_.incrementCounter('bytes_sent', dataStr.length);
        //We can only fit a certain amount in each websocket frame, so we need to split this request
        //up into multiple pieces if it doesn't fit in one request.
        const dataSegs = splitStringBySize(dataStr, WEBSOCKET_MAX_FRAME_SIZE);
        //Send the length header
        if (dataSegs.length > 1) {
            this.sendString_(String(dataSegs.length));
        }
        //Send the actual data in segments.
        for (let i = 0; i < dataSegs.length; i++) {
            this.sendString_(dataSegs[i]);
        }
    }
    shutdown_() {
        this.isClosed_ = true;
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
        if (this.mySock) {
            this.mySock.close();
            this.mySock = null;
        }
    }
    onClosed_() {
        if (!this.isClosed_) {
            this.log_('WebSocket is closing itself');
            this.shutdown_();
            // since this is an internal close, trigger the close listener
            if (this.onDisconnect) {
                this.onDisconnect(this.everConnected_);
                this.onDisconnect = null;
            }
        }
    }
    /**
     * External-facing close handler.
     * Close the websocket and kill the connection.
     */
    close() {
        if (!this.isClosed_) {
            this.log_('WebSocket is being closed');
            this.shutdown_();
        }
    }
    /**
     * Kill the current keepalive timer and start a new one, to ensure that it always fires N seconds after
     * the last activity.
     */
    resetKeepAlive() {
        clearInterval(this.keepaliveTimer);
        this.keepaliveTimer = setInterval(() => {
            //If there has been no websocket activity for a while, send a no-op
            if (this.mySock) {
                this.sendString_('0');
            }
            this.resetKeepAlive();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, Math.floor(WEBSOCKET_KEEPALIVE_INTERVAL));
    }
    /**
     * Send a string over the websocket.
     *
     * @param str - String to send.
     */
    sendString_(str) {
        // Firefox seems to sometimes throw exceptions (NS_ERROR_UNEXPECTED) from websocket .send()
        // calls for some unknown reason.  We treat these as an error and disconnect.
        // See https://app.asana.com/0/58926111402292/68021340250410
        try {
            this.mySock.send(str);
        }
        catch (e) {
            this.log_('Exception thrown from WebSocket.send():', e.message || e.data, 'Closing connection.');
            setTimeout(this.onClosed_.bind(this), 0);
        }
    }
}
/**
 * Number of response before we consider the connection "healthy."
 */
WebSocketConnection.responsesRequiredToBeHealthy = 2;
/**
 * Time to wait for the connection te become healthy before giving up.
 */
WebSocketConnection.healthyTimeout = 30000;

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Abstraction around AppCheck's token fetching capabilities.
 */
class AppCheckTokenProvider {
    constructor(app$1, appCheckProvider) {
        this.appCheckProvider = appCheckProvider;
        this.appName = app$1.name;
        if (app._isFirebaseServerApp(app$1) && app$1.settings.appCheckToken) {
            this.serverAppAppCheckToken = app$1.settings.appCheckToken;
        }
        this.appCheck = appCheckProvider?.getImmediate({ optional: true });
        if (!this.appCheck) {
            appCheckProvider?.get().then(appCheck => (this.appCheck = appCheck));
        }
    }
    getToken(forceRefresh) {
        if (this.serverAppAppCheckToken) {
            if (forceRefresh) {
                throw new Error('Attempted reuse of `FirebaseServerApp.appCheckToken` after previous usage failed.');
            }
            return Promise.resolve({ token: this.serverAppAppCheckToken });
        }
        if (!this.appCheck) {
            return new Promise((resolve, reject) => {
                // Support delayed initialization of FirebaseAppCheck. This allows our
                // customers to initialize the RTDB SDK before initializing Firebase
                // AppCheck and ensures that all requests are authenticated if a token
                // becomes available before the timeout below expires.
                setTimeout(() => {
                    if (this.appCheck) {
                        this.getToken(forceRefresh).then(resolve, reject);
                    }
                    else {
                        resolve(null);
                    }
                }, 0);
            });
        }
        return this.appCheck.getToken(forceRefresh);
    }
    addTokenChangeListener(listener) {
        this.appCheckProvider
            ?.get()
            .then(appCheck => appCheck.addTokenListener(listener));
    }
    notifyForInvalidToken() {
        warn$1(`Provided AppCheck credentials for the app named "${this.appName}" ` +
            'are invalid. This usually indicates your app was not initialized correctly.');
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Abstraction around FirebaseApp's token fetching capabilities.
 */
class FirebaseAuthTokenProvider {
    constructor(appName_, firebaseOptions_, authProvider_) {
        this.appName_ = appName_;
        this.firebaseOptions_ = firebaseOptions_;
        this.authProvider_ = authProvider_;
        this.auth_ = null;
        this.auth_ = authProvider_.getImmediate({ optional: true });
        if (!this.auth_) {
            authProvider_.onInit(auth => (this.auth_ = auth));
        }
    }
    getToken(forceRefresh) {
        if (!this.auth_) {
            return new Promise((resolve, reject) => {
                // Support delayed initialization of FirebaseAuth. This allows our
                // customers to initialize the RTDB SDK before initializing Firebase
                // Auth and ensures that all requests are authenticated if a token
                // becomes available before the timeout below expires.
                setTimeout(() => {
                    if (this.auth_) {
                        this.getToken(forceRefresh).then(resolve, reject);
                    }
                    else {
                        resolve(null);
                    }
                }, 0);
            });
        }
        return this.auth_.getToken(forceRefresh).catch(error => {
            // TODO: Need to figure out all the cases this is raised and whether
            // this makes sense.
            if (error && error.code === 'auth/token-not-initialized') {
                log('Got auth/token-not-initialized error.  Treating as null token.');
                return null;
            }
            else {
                return Promise.reject(error);
            }
        });
    }
    addTokenChangeListener(listener) {
        // TODO: We might want to wrap the listener and call it with no args to
        // avoid a leaky abstraction, but that makes removing the listener harder.
        if (this.auth_) {
            this.auth_.addAuthTokenListener(listener);
        }
        else {
            this.authProvider_
                .get()
                .then(auth => auth.addAuthTokenListener(listener));
        }
    }
    removeTokenChangeListener(listener) {
        this.authProvider_
            .get()
            .then(auth => auth.removeAuthTokenListener(listener));
    }
    notifyForInvalidToken() {
        let errorMessage = 'Provided authentication credentials for the app named "' +
            this.appName_ +
            '" are invalid. This usually indicates your app was not ' +
            'initialized correctly. ';
        if ('credential' in this.firebaseOptions_) {
            errorMessage +=
                'Make sure the "credential" property provided to initializeApp() ' +
                    'is authorized to access the specified "databaseURL" and is from the correct ' +
                    'project.';
        }
        else if ('serviceAccount' in this.firebaseOptions_) {
            errorMessage +=
                'Make sure the "serviceAccount" property provided to initializeApp() ' +
                    'is authorized to access the specified "databaseURL" and is from the correct ' +
                    'project.';
        }
        else {
            errorMessage +=
                'Make sure the "apiKey" and "databaseURL" properties provided to ' +
                    'initializeApp() match the values provided for your app at ' +
                    'https://console.firebase.google.com/.';
        }
        warn$1(errorMessage);
    }
}
/* AuthTokenProvider that supplies a constant token. Used by Admin SDK or mockUserToken with emulators. */
class EmulatorTokenProvider {
    constructor(accessToken) {
        this.accessToken = accessToken;
    }
    getToken(forceRefresh) {
        return Promise.resolve({
            accessToken: this.accessToken
        });
    }
    addTokenChangeListener(listener) {
        // Invoke the listener immediately to match the behavior in Firebase Auth
        // (see packages/auth/src/auth.js#L1807)
        listener(this.accessToken);
    }
    removeTokenChangeListener(listener) { }
    notifyForInvalidToken() { }
}
/** A string that is treated as an admin access token by the RTDB emulator. Used by Admin SDK. */
EmulatorTokenProvider.OWNER = 'owner';

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * This class ensures the packets from the server arrive in order
 * This class takes data from the server and ensures it gets passed into the callbacks in order.
 */
class PacketReceiver {
    /**
     * @param onMessage_
     */
    constructor(onMessage_) {
        this.onMessage_ = onMessage_;
        this.pendingResponses = [];
        this.currentResponseNum = 0;
        this.closeAfterResponse = -1;
        this.onClose = null;
    }
    closeAfter(responseNum, callback) {
        this.closeAfterResponse = responseNum;
        this.onClose = callback;
        if (this.closeAfterResponse < this.currentResponseNum) {
            this.onClose();
            this.onClose = null;
        }
    }
    /**
     * Each message from the server comes with a response number, and an array of data. The responseNumber
     * allows us to ensure that we process them in the right order, since we can't be guaranteed that all
     * browsers will respond in the same order as the requests we sent
     */
    handleResponse(requestNum, data) {
        this.pendingResponses[requestNum] = data;
        while (this.pendingResponses[this.currentResponseNum]) {
            const toProcess = this.pendingResponses[this.currentResponseNum];
            delete this.pendingResponses[this.currentResponseNum];
            for (let i = 0; i < toProcess.length; ++i) {
                if (toProcess[i]) {
                    exceptionGuard(() => {
                        this.onMessage_(toProcess[i]);
                    });
                }
            }
            if (this.currentResponseNum === this.closeAfterResponse) {
                if (this.onClose) {
                    this.onClose();
                    this.onClose = null;
                }
                break;
            }
            this.currentResponseNum++;
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// URL query parameters associated with longpolling
const FIREBASE_LONGPOLL_START_PARAM = 'start';
const FIREBASE_LONGPOLL_CLOSE_COMMAND = 'close';
const FIREBASE_LONGPOLL_COMMAND_CB_NAME = 'pLPCommand';
const FIREBASE_LONGPOLL_DATA_CB_NAME = 'pRTLPCB';
const FIREBASE_LONGPOLL_ID_PARAM = 'id';
const FIREBASE_LONGPOLL_PW_PARAM = 'pw';
const FIREBASE_LONGPOLL_SERIAL_PARAM = 'ser';
const FIREBASE_LONGPOLL_CALLBACK_ID_PARAM = 'cb';
const FIREBASE_LONGPOLL_SEGMENT_NUM_PARAM = 'seg';
const FIREBASE_LONGPOLL_SEGMENTS_IN_PACKET = 'ts';
const FIREBASE_LONGPOLL_DATA_PARAM = 'd';
const FIREBASE_LONGPOLL_DISCONN_FRAME_REQUEST_PARAM = 'dframe';
//Data size constants.
//TODO: Perf: the maximum length actually differs from browser to browser.
// We should check what browser we're on and set accordingly.
const MAX_URL_DATA_SIZE = 1870;
const SEG_HEADER_SIZE = 30; //ie: &seg=8299234&ts=982389123&d=
const MAX_PAYLOAD_SIZE = MAX_URL_DATA_SIZE - SEG_HEADER_SIZE;
/**
 * Keepalive period
 * send a fresh request at minimum every 25 seconds. Opera has a maximum request
 * length of 30 seconds that we can't exceed.
 */
const KEEPALIVE_REQUEST_INTERVAL = 25000;
/**
 * How long to wait before aborting a long-polling connection attempt.
 */
const LP_CONNECT_TIMEOUT = 30000;
/**
 * This class manages a single long-polling connection.
 */
class BrowserPollConnection {
    /**
     * @param connId An identifier for this connection, used for logging
     * @param repoInfo The info for the endpoint to send data to.
     * @param applicationId The Firebase App ID for this project.
     * @param appCheckToken The AppCheck token for this client.
     * @param authToken The AuthToken to use for this connection.
     * @param transportSessionId Optional transportSessionid if we are
     * reconnecting for an existing transport session
     * @param lastSessionId Optional lastSessionId if the PersistentConnection has
     * already created a connection previously
     */
    constructor(connId, repoInfo, applicationId, appCheckToken, authToken, transportSessionId, lastSessionId) {
        this.connId = connId;
        this.repoInfo = repoInfo;
        this.applicationId = applicationId;
        this.appCheckToken = appCheckToken;
        this.authToken = authToken;
        this.transportSessionId = transportSessionId;
        this.lastSessionId = lastSessionId;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.everConnected_ = false;
        this.log_ = logWrapper(connId);
        this.stats_ = statsManagerGetCollection(repoInfo);
        this.urlFn = (params) => {
            // Always add the token if we have one.
            if (this.appCheckToken) {
                params[APP_CHECK_TOKEN_PARAM] = this.appCheckToken;
            }
            return repoInfoConnectionURL(repoInfo, LONG_POLLING, params);
        };
    }
    /**
     * @param onMessage - Callback when messages arrive
     * @param onDisconnect - Callback with connection lost.
     */
    open(onMessage, onDisconnect) {
        this.curSegmentNum = 0;
        this.onDisconnect_ = onDisconnect;
        this.myPacketOrderer = new PacketReceiver(onMessage);
        this.isClosed_ = false;
        this.connectTimeoutTimer_ = setTimeout(() => {
            this.log_('Timed out trying to connect.');
            // Make sure we clear the host cache
            this.onClosed_();
            this.connectTimeoutTimer_ = null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, Math.floor(LP_CONNECT_TIMEOUT));
        // Ensure we delay the creation of the iframe until the DOM is loaded.
        executeWhenDOMReady(() => {
            if (this.isClosed_) {
                return;
            }
            //Set up a callback that gets triggered once a connection is set up.
            this.scriptTagHolder = new FirebaseIFrameScriptHolder((...args) => {
                const [command, arg1, arg2, arg3, arg4] = args;
                this.incrementIncomingBytes_(args);
                if (!this.scriptTagHolder) {
                    return; // we closed the connection.
                }
                if (this.connectTimeoutTimer_) {
                    clearTimeout(this.connectTimeoutTimer_);
                    this.connectTimeoutTimer_ = null;
                }
                this.everConnected_ = true;
                if (command === FIREBASE_LONGPOLL_START_PARAM) {
                    this.id = arg1;
                    this.password = arg2;
                }
                else if (command === FIREBASE_LONGPOLL_CLOSE_COMMAND) {
                    // Don't clear the host cache. We got a response from the server, so we know it's reachable
                    if (arg1) {
                        // We aren't expecting any more data (other than what the server's already in the process of sending us
                        // through our already open polls), so don't send any more.
                        this.scriptTagHolder.sendNewPolls = false;
                        // arg1 in this case is the last response number sent by the server. We should try to receive
                        // all of the responses up to this one before closing
                        this.myPacketOrderer.closeAfter(arg1, () => {
                            this.onClosed_();
                        });
                    }
                    else {
                        this.onClosed_();
                    }
                }
                else {
                    throw new Error('Unrecognized command received: ' + command);
                }
            }, (...args) => {
                const [pN, data] = args;
                this.incrementIncomingBytes_(args);
                this.myPacketOrderer.handleResponse(pN, data);
            }, () => {
                this.onClosed_();
            }, this.urlFn);
            //Send the initial request to connect. The serial number is simply to keep the browser from pulling previous results
            //from cache.
            const urlParams = {};
            urlParams[FIREBASE_LONGPOLL_START_PARAM] = 't';
            urlParams[FIREBASE_LONGPOLL_SERIAL_PARAM] = Math.floor(Math.random() * 100000000);
            if (this.scriptTagHolder.uniqueCallbackIdentifier) {
                urlParams[FIREBASE_LONGPOLL_CALLBACK_ID_PARAM] =
                    this.scriptTagHolder.uniqueCallbackIdentifier;
            }
            urlParams[VERSION_PARAM] = PROTOCOL_VERSION;
            if (this.transportSessionId) {
                urlParams[TRANSPORT_SESSION_PARAM] = this.transportSessionId;
            }
            if (this.lastSessionId) {
                urlParams[LAST_SESSION_PARAM] = this.lastSessionId;
            }
            if (this.applicationId) {
                urlParams[APPLICATION_ID_PARAM] = this.applicationId;
            }
            if (this.appCheckToken) {
                urlParams[APP_CHECK_TOKEN_PARAM] = this.appCheckToken;
            }
            if (typeof location !== 'undefined' &&
                location.hostname &&
                FORGE_DOMAIN_RE.test(location.hostname)) {
                urlParams[REFERER_PARAM] = FORGE_REF;
            }
            const connectURL = this.urlFn(urlParams);
            this.log_('Connecting via long-poll to ' + connectURL);
            this.scriptTagHolder.addTag(connectURL, () => {
                /* do nothing */
            });
        });
    }
    /**
     * Call this when a handshake has completed successfully and we want to consider the connection established
     */
    start() {
        this.scriptTagHolder.startLongPoll(this.id, this.password);
        this.addDisconnectPingFrame(this.id, this.password);
    }
    /**
     * Forces long polling to be considered as a potential transport
     */
    static forceAllow() {
        BrowserPollConnection.forceAllow_ = true;
    }
    /**
     * Forces longpolling to not be considered as a potential transport
     */
    static forceDisallow() {
        BrowserPollConnection.forceDisallow_ = true;
    }
    // Static method, use string literal so it can be accessed in a generic way
    static isAvailable() {
        if (util.isNodeSdk()) {
            return false;
        }
        else if (BrowserPollConnection.forceAllow_) {
            return true;
        }
        else {
            // NOTE: In React-Native there's normally no 'document', but if you debug a React-Native app in
            // the Chrome debugger, 'document' is defined, but document.createElement is null (2015/06/08).
            return (!BrowserPollConnection.forceDisallow_ &&
                typeof document !== 'undefined' &&
                document.createElement != null &&
                !isChromeExtensionContentScript() &&
                !isWindowsStoreApp());
        }
    }
    /**
     * No-op for polling
     */
    markConnectionHealthy() { }
    /**
     * Stops polling and cleans up the iframe
     */
    shutdown_() {
        this.isClosed_ = true;
        if (this.scriptTagHolder) {
            this.scriptTagHolder.close();
            this.scriptTagHolder = null;
        }
        //remove the disconnect frame, which will trigger an XHR call to the server to tell it we're leaving.
        if (this.myDisconnFrame) {
            document.body.removeChild(this.myDisconnFrame);
            this.myDisconnFrame = null;
        }
        if (this.connectTimeoutTimer_) {
            clearTimeout(this.connectTimeoutTimer_);
            this.connectTimeoutTimer_ = null;
        }
    }
    /**
     * Triggered when this transport is closed
     */
    onClosed_() {
        if (!this.isClosed_) {
            this.log_('Longpoll is closing itself');
            this.shutdown_();
            if (this.onDisconnect_) {
                this.onDisconnect_(this.everConnected_);
                this.onDisconnect_ = null;
            }
        }
    }
    /**
     * External-facing close handler. RealTime has requested we shut down. Kill our connection and tell the server
     * that we've left.
     */
    close() {
        if (!this.isClosed_) {
            this.log_('Longpoll is being closed.');
            this.shutdown_();
        }
    }
    /**
     * Send the JSON object down to the server. It will need to be stringified, base64 encoded, and then
     * broken into chunks (since URLs have a small maximum length).
     * @param data - The JSON data to transmit.
     */
    send(data) {
        const dataStr = util.stringify(data);
        this.bytesSent += dataStr.length;
        this.stats_.incrementCounter('bytes_sent', dataStr.length);
        //first, lets get the base64-encoded data
        const base64data = util.base64Encode(dataStr);
        //We can only fit a certain amount in each URL, so we need to split this request
        //up into multiple pieces if it doesn't fit in one request.
        const dataSegs = splitStringBySize(base64data, MAX_PAYLOAD_SIZE);
        //Enqueue each segment for transmission. We assign each chunk a sequential ID and a total number
        //of segments so that we can reassemble the packet on the server.
        for (let i = 0; i < dataSegs.length; i++) {
            this.scriptTagHolder.enqueueSegment(this.curSegmentNum, dataSegs.length, dataSegs[i]);
            this.curSegmentNum++;
        }
    }
    /**
     * This is how we notify the server that we're leaving.
     * We aren't able to send requests with DHTML on a window close event, but we can
     * trigger XHR requests in some browsers (everything but Opera basically).
     */
    addDisconnectPingFrame(id, pw) {
        if (util.isNodeSdk()) {
            return;
        }
        this.myDisconnFrame = document.createElement('iframe');
        const urlParams = {};
        urlParams[FIREBASE_LONGPOLL_DISCONN_FRAME_REQUEST_PARAM] = 't';
        urlParams[FIREBASE_LONGPOLL_ID_PARAM] = id;
        urlParams[FIREBASE_LONGPOLL_PW_PARAM] = pw;
        this.myDisconnFrame.src = this.urlFn(urlParams);
        this.myDisconnFrame.style.display = 'none';
        document.body.appendChild(this.myDisconnFrame);
    }
    /**
     * Used to track the bytes received by this client
     */
    incrementIncomingBytes_(args) {
        // TODO: This is an annoying perf hit just to track the number of incoming bytes.  Maybe it should be opt-in.
        const bytesReceived = util.stringify(args).length;
        this.bytesReceived += bytesReceived;
        this.stats_.incrementCounter('bytes_received', bytesReceived);
    }
}
/*********************************************************************************************
 * A wrapper around an iframe that is used as a long-polling script holder.
 *********************************************************************************************/
class FirebaseIFrameScriptHolder {
    /**
     * @param commandCB - The callback to be called when control commands are received from the server.
     * @param onMessageCB - The callback to be triggered when responses arrive from the server.
     * @param onDisconnect - The callback to be triggered when this tag holder is closed
     * @param urlFn - A function that provides the URL of the endpoint to send data to.
     */
    constructor(commandCB, onMessageCB, onDisconnect, urlFn) {
        this.onDisconnect = onDisconnect;
        this.urlFn = urlFn;
        //We maintain a count of all of the outstanding requests, because if we have too many active at once it can cause
        //problems in some browsers.
        this.outstandingRequests = new Set();
        //A queue of the pending segments waiting for transmission to the server.
        this.pendingSegs = [];
        //A serial number. We use this for two things:
        // 1) A way to ensure the browser doesn't cache responses to polls
        // 2) A way to make the server aware when long-polls arrive in a different order than we started them. The
        //    server needs to release both polls in this case or it will cause problems in Opera since Opera can only execute
        //    JSONP code in the order it was added to the iframe.
        this.currentSerial = Math.floor(Math.random() * 100000000);
        // This gets set to false when we're "closing down" the connection (e.g. we're switching transports but there's still
        // incoming data from the server that we're waiting for).
        this.sendNewPolls = true;
        if (!util.isNodeSdk()) {
            //Each script holder registers a couple of uniquely named callbacks with the window. These are called from the
            //iframes where we put the long-polling script tags. We have two callbacks:
            //   1) Command Callback - Triggered for control issues, like starting a connection.
            //   2) Message Callback - Triggered when new data arrives.
            this.uniqueCallbackIdentifier = LUIDGenerator();
            window[FIREBASE_LONGPOLL_COMMAND_CB_NAME + this.uniqueCallbackIdentifier] = commandCB;
            window[FIREBASE_LONGPOLL_DATA_CB_NAME + this.uniqueCallbackIdentifier] =
                onMessageCB;
            //Create an iframe for us to add script tags to.
            this.myIFrame = FirebaseIFrameScriptHolder.createIFrame_();
            // Set the iframe's contents.
            let script = '';
            // if we set a javascript url, it's IE and we need to set the document domain. The javascript url is sufficient
            // for ie9, but ie8 needs to do it again in the document itself.
            if (this.myIFrame.src &&
                this.myIFrame.src.substr(0, 'javascript:'.length) === 'javascript:') {
                const currentDomain = document.domain;
                script = '<script>document.domain="' + currentDomain + '";</script>';
            }
            const iframeContents = '<html><body>' + script + '</body></html>';
            try {
                this.myIFrame.doc.open();
                this.myIFrame.doc.write(iframeContents);
                this.myIFrame.doc.close();
            }
            catch (e) {
                log('frame writing exception');
                if (e.stack) {
                    log(e.stack);
                }
                log(e);
            }
        }
        else {
            this.commandCB = commandCB;
            this.onMessageCB = onMessageCB;
        }
    }
    /**
     * Each browser has its own funny way to handle iframes. Here we mush them all together into one object that I can
     * actually use.
     */
    static createIFrame_() {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        // This is necessary in order to initialize the document inside the iframe
        if (document.body) {
            document.body.appendChild(iframe);
            try {
                // If document.domain has been modified in IE, this will throw an error, and we need to set the
                // domain of the iframe's document manually. We can do this via a javascript: url as the src attribute
                // Also note that we must do this *after* the iframe has been appended to the page. Otherwise it doesn't work.
                const a = iframe.contentWindow.document;
                if (!a) {
                    // Apologies for the log-spam, I need to do something to keep closure from optimizing out the assignment above.
                    log('No IE domain setting required');
                }
            }
            catch (e) {
                const domain = document.domain;
                iframe.src =
                    "javascript:void((function(){document.open();document.domain='" +
                        domain +
                        "';document.close();})())";
            }
        }
        else {
            // LongPollConnection attempts to delay initialization until the document is ready, so hopefully this
            // never gets hit.
            throw 'Document body has not initialized. Wait to initialize Firebase until after the document is ready.';
        }
        // Get the document of the iframe in a browser-specific way.
        if (iframe.contentDocument) {
            iframe.doc = iframe.contentDocument; // Firefox, Opera, Safari
        }
        else if (iframe.contentWindow) {
            iframe.doc = iframe.contentWindow.document; // Internet Explorer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        else if (iframe.document) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            iframe.doc = iframe.document; //others?
        }
        return iframe;
    }
    /**
     * Cancel all outstanding queries and remove the frame.
     */
    close() {
        //Mark this iframe as dead, so no new requests are sent.
        this.alive = false;
        if (this.myIFrame) {
            //We have to actually remove all of the html inside this iframe before removing it from the
            //window, or IE will continue loading and executing the script tags we've already added, which
            //can lead to some errors being thrown. Setting textContent seems to be the safest way to do this.
            this.myIFrame.doc.body.textContent = '';
            setTimeout(() => {
                if (this.myIFrame !== null) {
                    document.body.removeChild(this.myIFrame);
                    this.myIFrame = null;
                }
            }, Math.floor(0));
        }
        // Protect from being called recursively.
        const onDisconnect = this.onDisconnect;
        if (onDisconnect) {
            this.onDisconnect = null;
            onDisconnect();
        }
    }
    /**
     * Actually start the long-polling session by adding the first script tag(s) to the iframe.
     * @param id - The ID of this connection
     * @param pw - The password for this connection
     */
    startLongPoll(id, pw) {
        this.myID = id;
        this.myPW = pw;
        this.alive = true;
        //send the initial request. If there are requests queued, make sure that we transmit as many as we are currently able to.
        while (this.newRequest_()) { }
    }
    /**
     * This is called any time someone might want a script tag to be added. It adds a script tag when there aren't
     * too many outstanding requests and we are still alive.
     *
     * If there are outstanding packet segments to send, it sends one. If there aren't, it sends a long-poll anyways if
     * needed.
     */
    newRequest_() {
        // We keep one outstanding request open all the time to receive data, but if we need to send data
        // (pendingSegs.length > 0) then we create a new request to send the data.  The server will automatically
        // close the old request.
        if (this.alive &&
            this.sendNewPolls &&
            this.outstandingRequests.size < (this.pendingSegs.length > 0 ? 2 : 1)) {
            //construct our url
            this.currentSerial++;
            const urlParams = {};
            urlParams[FIREBASE_LONGPOLL_ID_PARAM] = this.myID;
            urlParams[FIREBASE_LONGPOLL_PW_PARAM] = this.myPW;
            urlParams[FIREBASE_LONGPOLL_SERIAL_PARAM] = this.currentSerial;
            let theURL = this.urlFn(urlParams);
            //Now add as much data as we can.
            let curDataString = '';
            let i = 0;
            while (this.pendingSegs.length > 0) {
                //first, lets see if the next segment will fit.
                const nextSeg = this.pendingSegs[0];
                if (nextSeg.d.length +
                    SEG_HEADER_SIZE +
                    curDataString.length <=
                    MAX_URL_DATA_SIZE) {
                    //great, the segment will fit. Lets append it.
                    const theSeg = this.pendingSegs.shift();
                    curDataString =
                        curDataString +
                            '&' +
                            FIREBASE_LONGPOLL_SEGMENT_NUM_PARAM +
                            i +
                            '=' +
                            theSeg.seg +
                            '&' +
                            FIREBASE_LONGPOLL_SEGMENTS_IN_PACKET +
                            i +
                            '=' +
                            theSeg.ts +
                            '&' +
                            FIREBASE_LONGPOLL_DATA_PARAM +
                            i +
                            '=' +
                            theSeg.d;
                    i++;
                }
                else {
                    break;
                }
            }
            theURL = theURL + curDataString;
            this.addLongPollTag_(theURL, this.currentSerial);
            return true;
        }
        else {
            return false;
        }
    }
    /**
     * Queue a packet for transmission to the server.
     * @param segnum - A sequential id for this packet segment used for reassembly
     * @param totalsegs - The total number of segments in this packet
     * @param data - The data for this segment.
     */
    enqueueSegment(segnum, totalsegs, data) {
        //add this to the queue of segments to send.
        this.pendingSegs.push({ seg: segnum, ts: totalsegs, d: data });
        //send the data immediately if there isn't already data being transmitted, unless
        //startLongPoll hasn't been called yet.
        if (this.alive) {
            this.newRequest_();
        }
    }
    /**
     * Add a script tag for a regular long-poll request.
     * @param url - The URL of the script tag.
     * @param serial - The serial number of the request.
     */
    addLongPollTag_(url, serial) {
        //remember that we sent this request.
        this.outstandingRequests.add(serial);
        const doNewRequest = () => {
            this.outstandingRequests.delete(serial);
            this.newRequest_();
        };
        // If this request doesn't return on its own accord (by the server sending us some data), we'll
        // create a new one after the KEEPALIVE interval to make sure we always keep a fresh request open.
        const keepaliveTimeout = setTimeout(doNewRequest, Math.floor(KEEPALIVE_REQUEST_INTERVAL));
        const readyStateCB = () => {
            // Request completed.  Cancel the keepalive.
            clearTimeout(keepaliveTimeout);
            // Trigger a new request so we can continue receiving data.
            doNewRequest();
        };
        this.addTag(url, readyStateCB);
    }
    /**
     * Add an arbitrary script tag to the iframe.
     * @param url - The URL for the script tag source.
     * @param loadCB - A callback to be triggered once the script has loaded.
     */
    addTag(url, loadCB) {
        if (util.isNodeSdk()) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.doNodeLongPoll(url, loadCB);
        }
        else {
            setTimeout(() => {
                try {
                    // if we're already closed, don't add this poll
                    if (!this.sendNewPolls) {
                        return;
                    }
                    const newScript = this.myIFrame.doc.createElement('script');
                    newScript.type = 'text/javascript';
                    newScript.async = true;
                    newScript.src = url;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    newScript.onload = newScript.onreadystatechange =
                        function () {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const rstate = newScript.readyState;
                            if (!rstate || rstate === 'loaded' || rstate === 'complete') {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                newScript.onload = newScript.onreadystatechange = null;
                                if (newScript.parentNode) {
                                    newScript.parentNode.removeChild(newScript);
                                }
                                loadCB();
                            }
                        };
                    newScript.onerror = () => {
                        log('Long-poll script failed to load: ' + url);
                        this.sendNewPolls = false;
                        this.close();
                    };
                    this.myIFrame.doc.body.appendChild(newScript);
                }
                catch (e) {
                    // TODO: we should make this error visible somehow
                }
            }, Math.floor(1));
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Currently simplistic, this class manages what transport a Connection should use at various stages of its
 * lifecycle.
 *
 * It starts with longpolling in a browser, and httppolling on node. It then upgrades to websockets if
 * they are available.
 */
class TransportManager {
    static get ALL_TRANSPORTS() {
        return [BrowserPollConnection, WebSocketConnection];
    }
    /**
     * Returns whether transport has been selected to ensure WebSocketConnection or BrowserPollConnection are not called after
     * TransportManager has already set up transports_
     */
    static get IS_TRANSPORT_INITIALIZED() {
        return this.globalTransportInitialized_;
    }
    /**
     * @param repoInfo - Metadata around the namespace we're connecting to
     */
    constructor(repoInfo) {
        this.initTransports_(repoInfo);
    }
    initTransports_(repoInfo) {
        const isWebSocketsAvailable = WebSocketConnection && WebSocketConnection['isAvailable']();
        let isSkipPollConnection = isWebSocketsAvailable && !WebSocketConnection.previouslyFailed();
        if (repoInfo.webSocketOnly) {
            if (!isWebSocketsAvailable) {
                warn$1("wss:// URL used, but browser isn't known to support websockets.  Trying anyway.");
            }
            isSkipPollConnection = true;
        }
        if (isSkipPollConnection) {
            this.transports_ = [WebSocketConnection];
        }
        else {
            const transports = (this.transports_ = []);
            for (const transport of TransportManager.ALL_TRANSPORTS) {
                if (transport && transport['isAvailable']()) {
                    transports.push(transport);
                }
            }
            TransportManager.globalTransportInitialized_ = true;
        }
    }
    /**
     * @returns The constructor for the initial transport to use
     */
    initialTransport() {
        if (this.transports_.length > 0) {
            return this.transports_[0];
        }
        else {
            throw new Error('No transports available');
        }
    }
    /**
     * @returns The constructor for the next transport, or null
     */
    upgradeTransport() {
        if (this.transports_.length > 1) {
            return this.transports_[1];
        }
        else {
            return null;
        }
    }
}
// Keeps track of whether the TransportManager has already chosen a transport to use
TransportManager.globalTransportInitialized_ = false;

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Abort upgrade attempt if it takes longer than 60s.
const UPGRADE_TIMEOUT = 60000;
// For some transports (WebSockets), we need to "validate" the transport by exchanging a few requests and responses.
// If we haven't sent enough requests within 5s, we'll start sending noop ping requests.
const DELAY_BEFORE_SENDING_EXTRA_REQUESTS = 5000;
// If the initial data sent triggers a lot of bandwidth (i.e. it's a large put or a listen for a large amount of data)
// then we may not be able to exchange our ping/pong requests within the healthy timeout.  So if we reach the timeout
// but we've sent/received enough bytes, we don't cancel the connection.
const BYTES_SENT_HEALTHY_OVERRIDE = 10 * 1024;
const BYTES_RECEIVED_HEALTHY_OVERRIDE = 100 * 1024;
const MESSAGE_TYPE = 't';
const MESSAGE_DATA = 'd';
const CONTROL_SHUTDOWN = 's';
const CONTROL_RESET = 'r';
const CONTROL_ERROR = 'e';
const CONTROL_PONG = 'o';
const SWITCH_ACK = 'a';
const END_TRANSMISSION = 'n';
const PING = 'p';
const SERVER_HELLO = 'h';
/**
 * Creates a new real-time connection to the server using whichever method works
 * best in the current browser.
 */
class Connection {
    /**
     * @param id - an id for this connection
     * @param repoInfo_ - the info for the endpoint to connect to
     * @param applicationId_ - the Firebase App ID for this project
     * @param appCheckToken_ - The App Check Token for this device.
     * @param authToken_ - The auth token for this session.
     * @param onMessage_ - the callback to be triggered when a server-push message arrives
     * @param onReady_ - the callback to be triggered when this connection is ready to send messages.
     * @param onDisconnect_ - the callback to be triggered when a connection was lost
     * @param onKill_ - the callback to be triggered when this connection has permanently shut down.
     * @param lastSessionId - last session id in persistent connection. is used to clean up old session in real-time server
     */
    constructor(id, repoInfo_, applicationId_, appCheckToken_, authToken_, onMessage_, onReady_, onDisconnect_, onKill_, lastSessionId) {
        this.id = id;
        this.repoInfo_ = repoInfo_;
        this.applicationId_ = applicationId_;
        this.appCheckToken_ = appCheckToken_;
        this.authToken_ = authToken_;
        this.onMessage_ = onMessage_;
        this.onReady_ = onReady_;
        this.onDisconnect_ = onDisconnect_;
        this.onKill_ = onKill_;
        this.lastSessionId = lastSessionId;
        this.connectionCount = 0;
        this.pendingDataMessages = [];
        this.state_ = 0 /* RealtimeState.CONNECTING */;
        this.log_ = logWrapper('c:' + this.id + ':');
        this.transportManager_ = new TransportManager(repoInfo_);
        this.log_('Connection created');
        this.start_();
    }
    /**
     * Starts a connection attempt
     */
    start_() {
        const conn = this.transportManager_.initialTransport();
        this.conn_ = new conn(this.nextTransportId_(), this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, null, this.lastSessionId);
        // For certain transports (WebSockets), we need to send and receive several messages back and forth before we
        // can consider the transport healthy.
        this.primaryResponsesRequired_ = conn['responsesRequiredToBeHealthy'] || 0;
        const onMessageReceived = this.connReceiver_(this.conn_);
        const onConnectionLost = this.disconnReceiver_(this.conn_);
        this.tx_ = this.conn_;
        this.rx_ = this.conn_;
        this.secondaryConn_ = null;
        this.isHealthy_ = false;
        /*
         * Firefox doesn't like when code from one iframe tries to create another iframe by way of the parent frame.
         * This can occur in the case of a redirect, i.e. we guessed wrong on what server to connect to and received a reset.
         * Somehow, setTimeout seems to make this ok. That doesn't make sense from a security perspective, since you should
         * still have the context of your originating frame.
         */
        setTimeout(() => {
            // this.conn_ gets set to null in some of the tests. Check to make sure it still exists before using it
            this.conn_ && this.conn_.open(onMessageReceived, onConnectionLost);
        }, Math.floor(0));
        const healthyTimeoutMS = conn['healthyTimeout'] || 0;
        if (healthyTimeoutMS > 0) {
            this.healthyTimeout_ = setTimeoutNonBlocking(() => {
                this.healthyTimeout_ = null;
                if (!this.isHealthy_) {
                    if (this.conn_ &&
                        this.conn_.bytesReceived > BYTES_RECEIVED_HEALTHY_OVERRIDE) {
                        this.log_('Connection exceeded healthy timeout but has received ' +
                            this.conn_.bytesReceived +
                            ' bytes.  Marking connection healthy.');
                        this.isHealthy_ = true;
                        this.conn_.markConnectionHealthy();
                    }
                    else if (this.conn_ &&
                        this.conn_.bytesSent > BYTES_SENT_HEALTHY_OVERRIDE) {
                        this.log_('Connection exceeded healthy timeout but has sent ' +
                            this.conn_.bytesSent +
                            ' bytes.  Leaving connection alive.');
                        // NOTE: We don't want to mark it healthy, since we have no guarantee that the bytes have made it to
                        // the server.
                    }
                    else {
                        this.log_('Closing unhealthy connection after timeout.');
                        this.close();
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }, Math.floor(healthyTimeoutMS));
        }
    }
    nextTransportId_() {
        return 'c:' + this.id + ':' + this.connectionCount++;
    }
    disconnReceiver_(conn) {
        return everConnected => {
            if (conn === this.conn_) {
                this.onConnectionLost_(everConnected);
            }
            else if (conn === this.secondaryConn_) {
                this.log_('Secondary connection lost.');
                this.onSecondaryConnectionLost_();
            }
            else {
                this.log_('closing an old connection');
            }
        };
    }
    connReceiver_(conn) {
        return (message) => {
            if (this.state_ !== 2 /* RealtimeState.DISCONNECTED */) {
                if (conn === this.rx_) {
                    this.onPrimaryMessageReceived_(message);
                }
                else if (conn === this.secondaryConn_) {
                    this.onSecondaryMessageReceived_(message);
                }
                else {
                    this.log_('message on old connection');
                }
            }
        };
    }
    /**
     * @param dataMsg - An arbitrary data message to be sent to the server
     */
    sendRequest(dataMsg) {
        // wrap in a data message envelope and send it on
        const msg = { t: 'd', d: dataMsg };
        this.sendData_(msg);
    }
    tryCleanupConnection() {
        if (this.tx_ === this.secondaryConn_ && this.rx_ === this.secondaryConn_) {
            this.log_('cleaning up and promoting a connection: ' + this.secondaryConn_.connId);
            this.conn_ = this.secondaryConn_;
            this.secondaryConn_ = null;
            // the server will shutdown the old connection
        }
    }
    onSecondaryControl_(controlData) {
        if (MESSAGE_TYPE in controlData) {
            const cmd = controlData[MESSAGE_TYPE];
            if (cmd === SWITCH_ACK) {
                this.upgradeIfSecondaryHealthy_();
            }
            else if (cmd === CONTROL_RESET) {
                // Most likely the session wasn't valid. Abandon the switch attempt
                this.log_('Got a reset on secondary, closing it');
                this.secondaryConn_.close();
                // If we were already using this connection for something, than we need to fully close
                if (this.tx_ === this.secondaryConn_ ||
                    this.rx_ === this.secondaryConn_) {
                    this.close();
                }
            }
            else if (cmd === CONTROL_PONG) {
                this.log_('got pong on secondary.');
                this.secondaryResponsesRequired_--;
                this.upgradeIfSecondaryHealthy_();
            }
        }
    }
    onSecondaryMessageReceived_(parsedData) {
        const layer = requireKey('t', parsedData);
        const data = requireKey('d', parsedData);
        if (layer === 'c') {
            this.onSecondaryControl_(data);
        }
        else if (layer === 'd') {
            // got a data message, but we're still second connection. Need to buffer it up
            this.pendingDataMessages.push(data);
        }
        else {
            throw new Error('Unknown protocol layer: ' + layer);
        }
    }
    upgradeIfSecondaryHealthy_() {
        if (this.secondaryResponsesRequired_ <= 0) {
            this.log_('Secondary connection is healthy.');
            this.isHealthy_ = true;
            this.secondaryConn_.markConnectionHealthy();
            this.proceedWithUpgrade_();
        }
        else {
            // Send a ping to make sure the connection is healthy.
            this.log_('sending ping on secondary.');
            this.secondaryConn_.send({ t: 'c', d: { t: PING, d: {} } });
        }
    }
    proceedWithUpgrade_() {
        // tell this connection to consider itself open
        this.secondaryConn_.start();
        // send ack
        this.log_('sending client ack on secondary');
        this.secondaryConn_.send({ t: 'c', d: { t: SWITCH_ACK, d: {} } });
        // send end packet on primary transport, switch to sending on this one
        // can receive on this one, buffer responses until end received on primary transport
        this.log_('Ending transmission on primary');
        this.conn_.send({ t: 'c', d: { t: END_TRANSMISSION, d: {} } });
        this.tx_ = this.secondaryConn_;
        this.tryCleanupConnection();
    }
    onPrimaryMessageReceived_(parsedData) {
        // Must refer to parsedData properties in quotes, so closure doesn't touch them.
        const layer = requireKey('t', parsedData);
        const data = requireKey('d', parsedData);
        if (layer === 'c') {
            this.onControl_(data);
        }
        else if (layer === 'd') {
            this.onDataMessage_(data);
        }
    }
    onDataMessage_(message) {
        this.onPrimaryResponse_();
        // We don't do anything with data messages, just kick them up a level
        this.onMessage_(message);
    }
    onPrimaryResponse_() {
        if (!this.isHealthy_) {
            this.primaryResponsesRequired_--;
            if (this.primaryResponsesRequired_ <= 0) {
                this.log_('Primary connection is healthy.');
                this.isHealthy_ = true;
                this.conn_.markConnectionHealthy();
            }
        }
    }
    onControl_(controlData) {
        const cmd = requireKey(MESSAGE_TYPE, controlData);
        if (MESSAGE_DATA in controlData) {
            const payload = controlData[MESSAGE_DATA];
            if (cmd === SERVER_HELLO) {
                const handshakePayload = {
                    ...payload
                };
                if (this.repoInfo_.isUsingEmulator) {
                    // Upon connecting, the emulator will pass the hostname that it's aware of, but we prefer the user's set hostname via `connectDatabaseEmulator` over what the emulator passes.
                    handshakePayload.h = this.repoInfo_.host;
                }
                this.onHandshake_(handshakePayload);
            }
            else if (cmd === END_TRANSMISSION) {
                this.log_('recvd end transmission on primary');
                this.rx_ = this.secondaryConn_;
                for (let i = 0; i < this.pendingDataMessages.length; ++i) {
                    this.onDataMessage_(this.pendingDataMessages[i]);
                }
                this.pendingDataMessages = [];
                this.tryCleanupConnection();
            }
            else if (cmd === CONTROL_SHUTDOWN) {
                // This was previously the 'onKill' callback passed to the lower-level connection
                // payload in this case is the reason for the shutdown. Generally a human-readable error
                this.onConnectionShutdown_(payload);
            }
            else if (cmd === CONTROL_RESET) {
                // payload in this case is the host we should contact
                this.onReset_(payload);
            }
            else if (cmd === CONTROL_ERROR) {
                error('Server Error: ' + payload);
            }
            else if (cmd === CONTROL_PONG) {
                this.log_('got pong on primary.');
                this.onPrimaryResponse_();
                this.sendPingOnPrimaryIfNecessary_();
            }
            else {
                error('Unknown control packet command: ' + cmd);
            }
        }
    }
    /**
     * @param handshake - The handshake data returned from the server
     */
    onHandshake_(handshake) {
        const timestamp = handshake.ts;
        const version = handshake.v;
        const host = handshake.h;
        this.sessionId = handshake.s;
        this.repoInfo_.host = host;
        // if we've already closed the connection, then don't bother trying to progress further
        if (this.state_ === 0 /* RealtimeState.CONNECTING */) {
            this.conn_.start();
            this.onConnectionEstablished_(this.conn_, timestamp);
            if (PROTOCOL_VERSION !== version) {
                warn$1('Protocol version mismatch detected');
            }
            // TODO: do we want to upgrade? when? maybe a delay?
            this.tryStartUpgrade_();
        }
    }
    tryStartUpgrade_() {
        const conn = this.transportManager_.upgradeTransport();
        if (conn) {
            this.startUpgrade_(conn);
        }
    }
    startUpgrade_(conn) {
        this.secondaryConn_ = new conn(this.nextTransportId_(), this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, this.sessionId);
        // For certain transports (WebSockets), we need to send and receive several messages back and forth before we
        // can consider the transport healthy.
        this.secondaryResponsesRequired_ =
            conn['responsesRequiredToBeHealthy'] || 0;
        const onMessage = this.connReceiver_(this.secondaryConn_);
        const onDisconnect = this.disconnReceiver_(this.secondaryConn_);
        this.secondaryConn_.open(onMessage, onDisconnect);
        // If we haven't successfully upgraded after UPGRADE_TIMEOUT, give up and kill the secondary.
        setTimeoutNonBlocking(() => {
            if (this.secondaryConn_) {
                this.log_('Timed out trying to upgrade.');
                this.secondaryConn_.close();
            }
        }, Math.floor(UPGRADE_TIMEOUT));
    }
    onReset_(host) {
        this.log_('Reset packet received.  New host: ' + host);
        this.repoInfo_.host = host;
        // TODO: if we're already "connected", we need to trigger a disconnect at the next layer up.
        // We don't currently support resets after the connection has already been established
        if (this.state_ === 1 /* RealtimeState.CONNECTED */) {
            this.close();
        }
        else {
            // Close whatever connections we have open and start again.
            this.closeConnections_();
            this.start_();
        }
    }
    onConnectionEstablished_(conn, timestamp) {
        this.log_('Realtime connection established.');
        this.conn_ = conn;
        this.state_ = 1 /* RealtimeState.CONNECTED */;
        if (this.onReady_) {
            this.onReady_(timestamp, this.sessionId);
            this.onReady_ = null;
        }
        // If after 5 seconds we haven't sent enough requests to the server to get the connection healthy,
        // send some pings.
        if (this.primaryResponsesRequired_ === 0) {
            this.log_('Primary connection is healthy.');
            this.isHealthy_ = true;
        }
        else {
            setTimeoutNonBlocking(() => {
                this.sendPingOnPrimaryIfNecessary_();
            }, Math.floor(DELAY_BEFORE_SENDING_EXTRA_REQUESTS));
        }
    }
    sendPingOnPrimaryIfNecessary_() {
        // If the connection isn't considered healthy yet, we'll send a noop ping packet request.
        if (!this.isHealthy_ && this.state_ === 1 /* RealtimeState.CONNECTED */) {
            this.log_('sending ping on primary.');
            this.sendData_({ t: 'c', d: { t: PING, d: {} } });
        }
    }
    onSecondaryConnectionLost_() {
        const conn = this.secondaryConn_;
        this.secondaryConn_ = null;
        if (this.tx_ === conn || this.rx_ === conn) {
            // we are relying on this connection already in some capacity. Therefore, a failure is real
            this.close();
        }
    }
    /**
     * @param everConnected - Whether or not the connection ever reached a server. Used to determine if
     * we should flush the host cache
     */
    onConnectionLost_(everConnected) {
        this.conn_ = null;
        // NOTE: IF you're seeing a Firefox error for this line, I think it might be because it's getting
        // called on window close and RealtimeState.CONNECTING is no longer defined.  Just a guess.
        if (!everConnected && this.state_ === 0 /* RealtimeState.CONNECTING */) {
            this.log_('Realtime connection failed.');
            // Since we failed to connect at all, clear any cached entry for this namespace in case the machine went away
            if (this.repoInfo_.isCacheableHost()) {
                PersistentStorage.remove('host:' + this.repoInfo_.host);
                // reset the internal host to what we would show the user, i.e. <ns>.firebaseio.com
                this.repoInfo_.internalHost = this.repoInfo_.host;
            }
        }
        else if (this.state_ === 1 /* RealtimeState.CONNECTED */) {
            this.log_('Realtime connection lost.');
        }
        this.close();
    }
    onConnectionShutdown_(reason) {
        this.log_('Connection shutdown command received. Shutting down...');
        if (this.onKill_) {
            this.onKill_(reason);
            this.onKill_ = null;
        }
        // We intentionally don't want to fire onDisconnect (kill is a different case),
        // so clear the callback.
        this.onDisconnect_ = null;
        this.close();
    }
    sendData_(data) {
        if (this.state_ !== 1 /* RealtimeState.CONNECTED */) {
            throw 'Connection is not connected';
        }
        else {
            this.tx_.send(data);
        }
    }
    /**
     * Cleans up this connection, calling the appropriate callbacks
     */
    close() {
        if (this.state_ !== 2 /* RealtimeState.DISCONNECTED */) {
            this.log_('Closing realtime connection.');
            this.state_ = 2 /* RealtimeState.DISCONNECTED */;
            this.closeConnections_();
            if (this.onDisconnect_) {
                this.onDisconnect_();
                this.onDisconnect_ = null;
            }
        }
    }
    closeConnections_() {
        this.log_('Shutting down all connections');
        if (this.conn_) {
            this.conn_.close();
            this.conn_ = null;
        }
        if (this.secondaryConn_) {
            this.secondaryConn_.close();
            this.secondaryConn_ = null;
        }
        if (this.healthyTimeout_) {
            clearTimeout(this.healthyTimeout_);
            this.healthyTimeout_ = null;
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Interface defining the set of actions that can be performed against the Firebase server
 * (basically corresponds to our wire protocol).
 *
 * @interface
 */
class ServerActions {
    put(pathString, data, onComplete, hash) { }
    merge(pathString, data, onComplete, hash) { }
    /**
     * Refreshes the auth token for the current connection.
     * @param token - The authentication token
     */
    refreshAuthToken(token) { }
    /**
     * Refreshes the app check token for the current connection.
     * @param token The app check token
     */
    refreshAppCheckToken(token) { }
    onDisconnectPut(pathString, data, onComplete) { }
    onDisconnectMerge(pathString, data, onComplete) { }
    onDisconnectCancel(pathString, onComplete) { }
    reportStats(stats) { }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Base class to be used if you want to emit events. Call the constructor with
 * the set of allowed event names.
 */
class EventEmitter {
    constructor(allowedEvents_) {
        this.allowedEvents_ = allowedEvents_;
        this.listeners_ = {};
        util.assert(Array.isArray(allowedEvents_) && allowedEvents_.length > 0, 'Requires a non-empty array');
    }
    /**
     * To be called by derived classes to trigger events.
     */
    trigger(eventType, ...varArgs) {
        if (Array.isArray(this.listeners_[eventType])) {
            // Clone the list, since callbacks could add/remove listeners.
            const listeners = [...this.listeners_[eventType]];
            for (let i = 0; i < listeners.length; i++) {
                listeners[i].callback.apply(listeners[i].context, varArgs);
            }
        }
    }
    on(eventType, callback, context) {
        this.validateEventType_(eventType);
        this.listeners_[eventType] = this.listeners_[eventType] || [];
        this.listeners_[eventType].push({ callback, context });
        const eventData = this.getInitialEvent(eventType);
        if (eventData) {
            callback.apply(context, eventData);
        }
    }
    off(eventType, callback, context) {
        this.validateEventType_(eventType);
        const listeners = this.listeners_[eventType] || [];
        for (let i = 0; i < listeners.length; i++) {
            if (listeners[i].callback === callback &&
                (!context || context === listeners[i].context)) {
                listeners.splice(i, 1);
                return;
            }
        }
    }
    validateEventType_(eventType) {
        util.assert(this.allowedEvents_.find(et => {
            return et === eventType;
        }), 'Unknown event: ' + eventType);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Monitors online state (as reported by window.online/offline events).
 *
 * The expectation is that this could have many false positives (thinks we are online
 * when we're not), but no false negatives.  So we can safely use it to determine when
 * we definitely cannot reach the internet.
 */
class OnlineMonitor extends EventEmitter {
    static getInstance() {
        return new OnlineMonitor();
    }
    constructor() {
        super(['online']);
        this.online_ = true;
        // We've had repeated complaints that Cordova apps can get stuck "offline", e.g.
        // https://forum.ionicframework.com/t/firebase-connection-is-lost-and-never-come-back/43810
        // It would seem that the 'online' event does not always fire consistently. So we disable it
        // for Cordova.
        if (typeof window !== 'undefined' &&
            typeof window.addEventListener !== 'undefined' &&
            !util.isMobileCordova()) {
            window.addEventListener('online', () => {
                if (!this.online_) {
                    this.online_ = true;
                    this.trigger('online', true);
                }
            }, false);
            window.addEventListener('offline', () => {
                if (this.online_) {
                    this.online_ = false;
                    this.trigger('online', false);
                }
            }, false);
        }
    }
    getInitialEvent(eventType) {
        util.assert(eventType === 'online', 'Unknown event type: ' + eventType);
        return [this.online_];
    }
    currentlyOnline() {
        return this.online_;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** Maximum key depth. */
const MAX_PATH_DEPTH = 32;
/** Maximum number of (UTF8) bytes in a Firebase path. */
const MAX_PATH_LENGTH_BYTES = 768;
/**
 * An immutable object representing a parsed path.  It's immutable so that you
 * can pass them around to other functions without worrying about them changing
 * it.
 */
class Path {
    /**
     * @param pathOrString - Path string to parse, or another path, or the raw
     * tokens array
     */
    constructor(pathOrString, pieceNum) {
        if (pieceNum === void 0) {
            this.pieces_ = pathOrString.split('/');
            // Remove empty pieces.
            let copyTo = 0;
            for (let i = 0; i < this.pieces_.length; i++) {
                if (this.pieces_[i].length > 0) {
                    this.pieces_[copyTo] = this.pieces_[i];
                    copyTo++;
                }
            }
            this.pieces_.length = copyTo;
            this.pieceNum_ = 0;
        }
        else {
            this.pieces_ = pathOrString;
            this.pieceNum_ = pieceNum;
        }
    }
    toString() {
        let pathString = '';
        for (let i = this.pieceNum_; i < this.pieces_.length; i++) {
            if (this.pieces_[i] !== '') {
                pathString += '/' + this.pieces_[i];
            }
        }
        return pathString || '/';
    }
}
function newEmptyPath() {
    return new Path('');
}
function pathGetFront(path) {
    if (path.pieceNum_ >= path.pieces_.length) {
        return null;
    }
    return path.pieces_[path.pieceNum_];
}
/**
 * @returns The number of segments in this path
 */
function pathGetLength(path) {
    return path.pieces_.length - path.pieceNum_;
}
function pathPopFront(path) {
    let pieceNum = path.pieceNum_;
    if (pieceNum < path.pieces_.length) {
        pieceNum++;
    }
    return new Path(path.pieces_, pieceNum);
}
function pathGetBack(path) {
    if (path.pieceNum_ < path.pieces_.length) {
        return path.pieces_[path.pieces_.length - 1];
    }
    return null;
}
function pathToUrlEncodedString(path) {
    let pathString = '';
    for (let i = path.pieceNum_; i < path.pieces_.length; i++) {
        if (path.pieces_[i] !== '') {
            pathString += '/' + encodeURIComponent(String(path.pieces_[i]));
        }
    }
    return pathString || '/';
}
/**
 * Shallow copy of the parts of the path.
 *
 */
function pathSlice(path, begin = 0) {
    return path.pieces_.slice(path.pieceNum_ + begin);
}
function pathParent(path) {
    if (path.pieceNum_ >= path.pieces_.length) {
        return null;
    }
    const pieces = [];
    for (let i = path.pieceNum_; i < path.pieces_.length - 1; i++) {
        pieces.push(path.pieces_[i]);
    }
    return new Path(pieces, 0);
}
function pathChild(path, childPathObj) {
    const pieces = [];
    for (let i = path.pieceNum_; i < path.pieces_.length; i++) {
        pieces.push(path.pieces_[i]);
    }
    if (childPathObj instanceof Path) {
        for (let i = childPathObj.pieceNum_; i < childPathObj.pieces_.length; i++) {
            pieces.push(childPathObj.pieces_[i]);
        }
    }
    else {
        const childPieces = childPathObj.split('/');
        for (let i = 0; i < childPieces.length; i++) {
            if (childPieces[i].length > 0) {
                pieces.push(childPieces[i]);
            }
        }
    }
    return new Path(pieces, 0);
}
/**
 * @returns True if there are no segments in this path
 */
function pathIsEmpty(path) {
    return path.pieceNum_ >= path.pieces_.length;
}
/**
 * @returns The path from outerPath to innerPath
 */
function newRelativePath(outerPath, innerPath) {
    const outer = pathGetFront(outerPath), inner = pathGetFront(innerPath);
    if (outer === null) {
        return innerPath;
    }
    else if (outer === inner) {
        return newRelativePath(pathPopFront(outerPath), pathPopFront(innerPath));
    }
    else {
        throw new Error('INTERNAL ERROR: innerPath (' +
            innerPath +
            ') is not within ' +
            'outerPath (' +
            outerPath +
            ')');
    }
}
/**
 * @returns -1, 0, 1 if left is less, equal, or greater than the right.
 */
function pathCompare(left, right) {
    const leftKeys = pathSlice(left, 0);
    const rightKeys = pathSlice(right, 0);
    for (let i = 0; i < leftKeys.length && i < rightKeys.length; i++) {
        const cmp = nameCompare(leftKeys[i], rightKeys[i]);
        if (cmp !== 0) {
            return cmp;
        }
    }
    if (leftKeys.length === rightKeys.length) {
        return 0;
    }
    return leftKeys.length < rightKeys.length ? -1 : 1;
}
/**
 * @returns true if paths are the same.
 */
function pathEquals(path, other) {
    if (pathGetLength(path) !== pathGetLength(other)) {
        return false;
    }
    for (let i = path.pieceNum_, j = other.pieceNum_; i <= path.pieces_.length; i++, j++) {
        if (path.pieces_[i] !== other.pieces_[j]) {
            return false;
        }
    }
    return true;
}
/**
 * @returns True if this path is a parent of (or the same as) other
 */
function pathContains(path, other) {
    let i = path.pieceNum_;
    let j = other.pieceNum_;
    if (pathGetLength(path) > pathGetLength(other)) {
        return false;
    }
    while (i < path.pieces_.length) {
        if (path.pieces_[i] !== other.pieces_[j]) {
            return false;
        }
        ++i;
        ++j;
    }
    return true;
}
/**
 * Dynamic (mutable) path used to count path lengths.
 *
 * This class is used to efficiently check paths for valid
 * length (in UTF8 bytes) and depth (used in path validation).
 *
 * Throws Error exception if path is ever invalid.
 *
 * The definition of a path always begins with '/'.
 */
class ValidationPath {
    /**
     * @param path - Initial Path.
     * @param errorPrefix_ - Prefix for any error messages.
     */
    constructor(path, errorPrefix_) {
        this.errorPrefix_ = errorPrefix_;
        this.parts_ = pathSlice(path, 0);
        /** Initialize to number of '/' chars needed in path. */
        this.byteLength_ = Math.max(1, this.parts_.length);
        for (let i = 0; i < this.parts_.length; i++) {
            this.byteLength_ += util.stringLength(this.parts_[i]);
        }
        validationPathCheckValid(this);
    }
}
function validationPathPush(validationPath, child) {
    // Count the needed '/'
    if (validationPath.parts_.length > 0) {
        validationPath.byteLength_ += 1;
    }
    validationPath.parts_.push(child);
    validationPath.byteLength_ += util.stringLength(child);
    validationPathCheckValid(validationPath);
}
function validationPathPop(validationPath) {
    const last = validationPath.parts_.pop();
    validationPath.byteLength_ -= util.stringLength(last);
    // Un-count the previous '/'
    if (validationPath.parts_.length > 0) {
        validationPath.byteLength_ -= 1;
    }
}
function validationPathCheckValid(validationPath) {
    if (validationPath.byteLength_ > MAX_PATH_LENGTH_BYTES) {
        throw new Error(validationPath.errorPrefix_ +
            'has a key path longer than ' +
            MAX_PATH_LENGTH_BYTES +
            ' bytes (' +
            validationPath.byteLength_ +
            ').');
    }
    if (validationPath.parts_.length > MAX_PATH_DEPTH) {
        throw new Error(validationPath.errorPrefix_ +
            'path specified exceeds the maximum depth that can be written (' +
            MAX_PATH_DEPTH +
            ') or object contains a cycle ' +
            validationPathToErrorString(validationPath));
    }
}
/**
 * String for use in error messages - uses '.' notation for path.
 */
function validationPathToErrorString(validationPath) {
    if (validationPath.parts_.length === 0) {
        return '';
    }
    return "in property '" + validationPath.parts_.join('.') + "'";
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class VisibilityMonitor extends EventEmitter {
    static getInstance() {
        return new VisibilityMonitor();
    }
    constructor() {
        super(['visible']);
        let hidden;
        let visibilityChange;
        if (typeof document !== 'undefined' &&
            typeof document.addEventListener !== 'undefined') {
            if (typeof document['hidden'] !== 'undefined') {
                // Opera 12.10 and Firefox 18 and later support
                visibilityChange = 'visibilitychange';
                hidden = 'hidden';
            }
            else if (typeof document['mozHidden'] !== 'undefined') {
                visibilityChange = 'mozvisibilitychange';
                hidden = 'mozHidden';
            }
            else if (typeof document['msHidden'] !== 'undefined') {
                visibilityChange = 'msvisibilitychange';
                hidden = 'msHidden';
            }
            else if (typeof document['webkitHidden'] !== 'undefined') {
                visibilityChange = 'webkitvisibilitychange';
                hidden = 'webkitHidden';
            }
        }
        // Initially, we always assume we are visible. This ensures that in browsers
        // without page visibility support or in cases where we are never visible
        // (e.g. chrome extension), we act as if we are visible, i.e. don't delay
        // reconnects
        this.visible_ = true;
        if (visibilityChange) {
            document.addEventListener(visibilityChange, () => {
                const visible = !document[hidden];
                if (visible !== this.visible_) {
                    this.visible_ = visible;
                    this.trigger('visible', visible);
                }
            }, false);
        }
    }
    getInitialEvent(eventType) {
        util.assert(eventType === 'visible', 'Unknown event type: ' + eventType);
        return [this.visible_];
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const RECONNECT_MIN_DELAY = 1000;
const RECONNECT_MAX_DELAY_DEFAULT = 60 * 5 * 1000; // 5 minutes in milliseconds (Case: 1858)
const RECONNECT_MAX_DELAY_FOR_ADMINS = 30 * 1000; // 30 seconds for admin clients (likely to be a backend server)
const RECONNECT_DELAY_MULTIPLIER = 1.3;
const RECONNECT_DELAY_RESET_TIMEOUT = 30000; // Reset delay back to MIN_DELAY after being connected for 30sec.
const SERVER_KILL_INTERRUPT_REASON = 'server_kill';
// If auth fails repeatedly, we'll assume something is wrong and log a warning / back off.
const INVALID_TOKEN_THRESHOLD = 3;
/**
 * Firebase connection.  Abstracts wire protocol and handles reconnecting.
 *
 * NOTE: All JSON objects sent to the realtime connection must have property names enclosed
 * in quotes to make sure the closure compiler does not minify them.
 */
class PersistentConnection extends ServerActions {
    /**
     * @param repoInfo_ - Data about the namespace we are connecting to
     * @param applicationId_ - The Firebase App ID for this project
     * @param onDataUpdate_ - A callback for new data from the server
     */
    constructor(repoInfo_, applicationId_, onDataUpdate_, onConnectStatus_, onServerInfoUpdate_, authTokenProvider_, appCheckTokenProvider_, authOverride_) {
        super();
        this.repoInfo_ = repoInfo_;
        this.applicationId_ = applicationId_;
        this.onDataUpdate_ = onDataUpdate_;
        this.onConnectStatus_ = onConnectStatus_;
        this.onServerInfoUpdate_ = onServerInfoUpdate_;
        this.authTokenProvider_ = authTokenProvider_;
        this.appCheckTokenProvider_ = appCheckTokenProvider_;
        this.authOverride_ = authOverride_;
        // Used for diagnostic logging.
        this.id = PersistentConnection.nextPersistentConnectionId_++;
        this.log_ = logWrapper('p:' + this.id + ':');
        this.interruptReasons_ = {};
        this.listens = new Map();
        this.outstandingPuts_ = [];
        this.outstandingGets_ = [];
        this.outstandingPutCount_ = 0;
        this.outstandingGetCount_ = 0;
        this.onDisconnectRequestQueue_ = [];
        this.connected_ = false;
        this.reconnectDelay_ = RECONNECT_MIN_DELAY;
        this.maxReconnectDelay_ = RECONNECT_MAX_DELAY_DEFAULT;
        this.securityDebugCallback_ = null;
        this.lastSessionId = null;
        this.establishConnectionTimer_ = null;
        this.visible_ = false;
        // Before we get connected, we keep a queue of pending messages to send.
        this.requestCBHash_ = {};
        this.requestNumber_ = 0;
        this.realtime_ = null;
        this.authToken_ = null;
        this.appCheckToken_ = null;
        this.forceTokenRefresh_ = false;
        this.invalidAuthTokenCount_ = 0;
        this.invalidAppCheckTokenCount_ = 0;
        this.firstConnection_ = true;
        this.lastConnectionAttemptTime_ = null;
        this.lastConnectionEstablishedTime_ = null;
        if (authOverride_ && !util.isNodeSdk()) {
            throw new Error('Auth override specified in options, but not supported on non Node.js platforms');
        }
        VisibilityMonitor.getInstance().on('visible', this.onVisible_, this);
        if (repoInfo_.host.indexOf('fblocal') === -1) {
            OnlineMonitor.getInstance().on('online', this.onOnline_, this);
        }
    }
    sendRequest(action, body, onResponse) {
        const curReqNum = ++this.requestNumber_;
        const msg = { r: curReqNum, a: action, b: body };
        this.log_(util.stringify(msg));
        util.assert(this.connected_, "sendRequest call when we're not connected not allowed.");
        this.realtime_.sendRequest(msg);
        if (onResponse) {
            this.requestCBHash_[curReqNum] = onResponse;
        }
    }
    get(query) {
        this.initConnection_();
        const deferred = new util.Deferred();
        const request = {
            p: query._path.toString(),
            q: query._queryObject
        };
        const outstandingGet = {
            action: 'g',
            request,
            onComplete: (message) => {
                const payload = message['d'];
                if (message['s'] === 'ok') {
                    deferred.resolve(payload);
                }
                else {
                    deferred.reject(payload);
                }
            }
        };
        this.outstandingGets_.push(outstandingGet);
        this.outstandingGetCount_++;
        const index = this.outstandingGets_.length - 1;
        if (this.connected_) {
            this.sendGet_(index);
        }
        return deferred.promise;
    }
    listen(query, currentHashFn, tag, onComplete) {
        this.initConnection_();
        const queryId = query._queryIdentifier;
        const pathString = query._path.toString();
        this.log_('Listen called for ' + pathString + ' ' + queryId);
        if (!this.listens.has(pathString)) {
            this.listens.set(pathString, new Map());
        }
        util.assert(query._queryParams.isDefault() || !query._queryParams.loadsAllData(), 'listen() called for non-default but complete query');
        util.assert(!this.listens.get(pathString).has(queryId), `listen() called twice for same path/queryId.`);
        const listenSpec = {
            onComplete,
            hashFn: currentHashFn,
            query,
            tag
        };
        this.listens.get(pathString).set(queryId, listenSpec);
        if (this.connected_) {
            this.sendListen_(listenSpec);
        }
    }
    sendGet_(index) {
        const get = this.outstandingGets_[index];
        this.sendRequest('g', get.request, (message) => {
            delete this.outstandingGets_[index];
            this.outstandingGetCount_--;
            if (this.outstandingGetCount_ === 0) {
                this.outstandingGets_ = [];
            }
            if (get.onComplete) {
                get.onComplete(message);
            }
        });
    }
    sendListen_(listenSpec) {
        const query = listenSpec.query;
        const pathString = query._path.toString();
        const queryId = query._queryIdentifier;
        this.log_('Listen on ' + pathString + ' for ' + queryId);
        const req = { /*path*/ p: pathString };
        const action = 'q';
        // Only bother to send query if it's non-default.
        if (listenSpec.tag) {
            req['q'] = query._queryObject;
            req['t'] = listenSpec.tag;
        }
        req[ /*hash*/'h'] = listenSpec.hashFn();
        this.sendRequest(action, req, (message) => {
            const payload = message[ /*data*/'d'];
            const status = message[ /*status*/'s'];
            // print warnings in any case...
            PersistentConnection.warnOnListenWarnings_(payload, query);
            const currentListenSpec = this.listens.get(pathString) &&
                this.listens.get(pathString).get(queryId);
            // only trigger actions if the listen hasn't been removed and readded
            if (currentListenSpec === listenSpec) {
                this.log_('listen response', message);
                if (status !== 'ok') {
                    this.removeListen_(pathString, queryId);
                }
                if (listenSpec.onComplete) {
                    listenSpec.onComplete(status, payload);
                }
            }
        });
    }
    static warnOnListenWarnings_(payload, query) {
        if (payload && typeof payload === 'object' && util.contains(payload, 'w')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const warnings = util.safeGet(payload, 'w');
            if (Array.isArray(warnings) && ~warnings.indexOf('no_index')) {
                const indexSpec = '".indexOn": "' + query._queryParams.getIndex().toString() + '"';
                const indexPath = query._path.toString();
                warn$1(`Using an unspecified index. Your data will be downloaded and ` +
                    `filtered on the client. Consider adding ${indexSpec} at ` +
                    `${indexPath} to your security rules for better performance.`);
            }
        }
    }
    refreshAuthToken(token) {
        this.authToken_ = token;
        this.log_('Auth token refreshed');
        if (this.authToken_) {
            this.tryAuth();
        }
        else {
            //If we're connected we want to let the server know to unauthenticate us. If we're not connected, simply delete
            //the credential so we dont become authenticated next time we connect.
            if (this.connected_) {
                this.sendRequest('unauth', {}, () => { });
            }
        }
        this.reduceReconnectDelayIfAdminCredential_(token);
    }
    reduceReconnectDelayIfAdminCredential_(credential) {
        // NOTE: This isn't intended to be bulletproof (a malicious developer can always just modify the client).
        // Additionally, we don't bother resetting the max delay back to the default if auth fails / expires.
        const isFirebaseSecret = credential && credential.length === 40;
        if (isFirebaseSecret || util.isAdmin(credential)) {
            this.log_('Admin auth credential detected.  Reducing max reconnect time.');
            this.maxReconnectDelay_ = RECONNECT_MAX_DELAY_FOR_ADMINS;
        }
    }
    refreshAppCheckToken(token) {
        this.appCheckToken_ = token;
        this.log_('App check token refreshed');
        if (this.appCheckToken_) {
            this.tryAppCheck();
        }
        else {
            //If we're connected we want to let the server know to unauthenticate us.
            //If we're not connected, simply delete the credential so we dont become
            // authenticated next time we connect.
            if (this.connected_) {
                this.sendRequest('unappeck', {}, () => { });
            }
        }
    }
    /**
     * Attempts to authenticate with the given credentials. If the authentication attempt fails, it's triggered like
     * a auth revoked (the connection is closed).
     */
    tryAuth() {
        if (this.connected_ && this.authToken_) {
            const token = this.authToken_;
            const authMethod = util.isValidFormat(token) ? 'auth' : 'gauth';
            const requestData = { cred: token };
            if (this.authOverride_ === null) {
                requestData['noauth'] = true;
            }
            else if (typeof this.authOverride_ === 'object') {
                requestData['authvar'] = this.authOverride_;
            }
            this.sendRequest(authMethod, requestData, (res) => {
                const status = res[ /*status*/'s'];
                const data = res[ /*data*/'d'] || 'error';
                if (this.authToken_ === token) {
                    if (status === 'ok') {
                        this.invalidAuthTokenCount_ = 0;
                    }
                    else {
                        // Triggers reconnect and force refresh for auth token
                        this.onAuthRevoked_(status, data);
                    }
                }
            });
        }
    }
    /**
     * Attempts to authenticate with the given token. If the authentication
     * attempt fails, it's triggered like the token was revoked (the connection is
     * closed).
     */
    tryAppCheck() {
        if (this.connected_ && this.appCheckToken_) {
            this.sendRequest('appcheck', { 'token': this.appCheckToken_ }, (res) => {
                const status = res[ /*status*/'s'];
                const data = res[ /*data*/'d'] || 'error';
                if (status === 'ok') {
                    this.invalidAppCheckTokenCount_ = 0;
                }
                else {
                    this.onAppCheckRevoked_(status, data);
                }
            });
        }
    }
    /**
     * @inheritDoc
     */
    unlisten(query, tag) {
        const pathString = query._path.toString();
        const queryId = query._queryIdentifier;
        this.log_('Unlisten called for ' + pathString + ' ' + queryId);
        util.assert(query._queryParams.isDefault() || !query._queryParams.loadsAllData(), 'unlisten() called for non-default but complete query');
        const listen = this.removeListen_(pathString, queryId);
        if (listen && this.connected_) {
            this.sendUnlisten_(pathString, queryId, query._queryObject, tag);
        }
    }
    sendUnlisten_(pathString, queryId, queryObj, tag) {
        this.log_('Unlisten on ' + pathString + ' for ' + queryId);
        const req = { /*path*/ p: pathString };
        const action = 'n';
        // Only bother sending queryId if it's non-default.
        if (tag) {
            req['q'] = queryObj;
            req['t'] = tag;
        }
        this.sendRequest(action, req);
    }
    onDisconnectPut(pathString, data, onComplete) {
        this.initConnection_();
        if (this.connected_) {
            this.sendOnDisconnect_('o', pathString, data, onComplete);
        }
        else {
            this.onDisconnectRequestQueue_.push({
                pathString,
                action: 'o',
                data,
                onComplete
            });
        }
    }
    onDisconnectMerge(pathString, data, onComplete) {
        this.initConnection_();
        if (this.connected_) {
            this.sendOnDisconnect_('om', pathString, data, onComplete);
        }
        else {
            this.onDisconnectRequestQueue_.push({
                pathString,
                action: 'om',
                data,
                onComplete
            });
        }
    }
    onDisconnectCancel(pathString, onComplete) {
        this.initConnection_();
        if (this.connected_) {
            this.sendOnDisconnect_('oc', pathString, null, onComplete);
        }
        else {
            this.onDisconnectRequestQueue_.push({
                pathString,
                action: 'oc',
                data: null,
                onComplete
            });
        }
    }
    sendOnDisconnect_(action, pathString, data, onComplete) {
        const request = { /*path*/ p: pathString, /*data*/ d: data };
        this.log_('onDisconnect ' + action, request);
        this.sendRequest(action, request, (response) => {
            if (onComplete) {
                setTimeout(() => {
                    onComplete(response[ /*status*/'s'], response[ /* data */'d']);
                }, Math.floor(0));
            }
        });
    }
    put(pathString, data, onComplete, hash) {
        this.putInternal('p', pathString, data, onComplete, hash);
    }
    merge(pathString, data, onComplete, hash) {
        this.putInternal('m', pathString, data, onComplete, hash);
    }
    putInternal(action, pathString, data, onComplete, hash) {
        this.initConnection_();
        const request = {
            /*path*/ p: pathString,
            /*data*/ d: data
        };
        if (hash !== undefined) {
            request[ /*hash*/'h'] = hash;
        }
        // TODO: Only keep track of the most recent put for a given path?
        this.outstandingPuts_.push({
            action,
            request,
            onComplete
        });
        this.outstandingPutCount_++;
        const index = this.outstandingPuts_.length - 1;
        if (this.connected_) {
            this.sendPut_(index);
        }
        else {
            this.log_('Buffering put: ' + pathString);
        }
    }
    sendPut_(index) {
        const action = this.outstandingPuts_[index].action;
        const request = this.outstandingPuts_[index].request;
        const onComplete = this.outstandingPuts_[index].onComplete;
        this.outstandingPuts_[index].queued = this.connected_;
        this.sendRequest(action, request, (message) => {
            this.log_(action + ' response', message);
            delete this.outstandingPuts_[index];
            this.outstandingPutCount_--;
            // Clean up array occasionally.
            if (this.outstandingPutCount_ === 0) {
                this.outstandingPuts_ = [];
            }
            if (onComplete) {
                onComplete(message[ /*status*/'s'], message[ /* data */'d']);
            }
        });
    }
    reportStats(stats) {
        // If we're not connected, we just drop the stats.
        if (this.connected_) {
            const request = { /*counters*/ c: stats };
            this.log_('reportStats', request);
            this.sendRequest(/*stats*/ 's', request, result => {
                const status = result[ /*status*/'s'];
                if (status !== 'ok') {
                    const errorReason = result[ /* data */'d'];
                    this.log_('reportStats', 'Error sending stats: ' + errorReason);
                }
            });
        }
    }
    onDataMessage_(message) {
        if ('r' in message) {
            // this is a response
            this.log_('from server: ' + util.stringify(message));
            const reqNum = message['r'];
            const onResponse = this.requestCBHash_[reqNum];
            if (onResponse) {
                delete this.requestCBHash_[reqNum];
                onResponse(message[ /*body*/'b']);
            }
        }
        else if ('error' in message) {
            throw 'A server-side error has occurred: ' + message['error'];
        }
        else if ('a' in message) {
            // a and b are action and body, respectively
            this.onDataPush_(message['a'], message['b']);
        }
    }
    onDataPush_(action, body) {
        this.log_('handleServerMessage', action, body);
        if (action === 'd') {
            this.onDataUpdate_(body[ /*path*/'p'], body[ /*data*/'d'], 
            /*isMerge*/ false, body['t']);
        }
        else if (action === 'm') {
            this.onDataUpdate_(body[ /*path*/'p'], body[ /*data*/'d'], 
            /*isMerge=*/ true, body['t']);
        }
        else if (action === 'c') {
            this.onListenRevoked_(body[ /*path*/'p'], body[ /*query*/'q']);
        }
        else if (action === 'ac') {
            this.onAuthRevoked_(body[ /*status code*/'s'], body[ /* explanation */'d']);
        }
        else if (action === 'apc') {
            this.onAppCheckRevoked_(body[ /*status code*/'s'], body[ /* explanation */'d']);
        }
        else if (action === 'sd') {
            this.onSecurityDebugPacket_(body);
        }
        else {
            error('Unrecognized action received from server: ' +
                util.stringify(action) +
                '\nAre you using the latest client?');
        }
    }
    onReady_(timestamp, sessionId) {
        this.log_('connection ready');
        this.connected_ = true;
        this.lastConnectionEstablishedTime_ = new Date().getTime();
        this.handleTimestamp_(timestamp);
        this.lastSessionId = sessionId;
        if (this.firstConnection_) {
            this.sendConnectStats_();
        }
        this.restoreState_();
        this.firstConnection_ = false;
        this.onConnectStatus_(true);
    }
    scheduleConnect_(timeout) {
        util.assert(!this.realtime_, "Scheduling a connect when we're already connected/ing?");
        if (this.establishConnectionTimer_) {
            clearTimeout(this.establishConnectionTimer_);
        }
        // NOTE: Even when timeout is 0, it's important to do a setTimeout to work around an infuriating "Security Error" in
        // Firefox when trying to write to our long-polling iframe in some scenarios (e.g. Forge or our unit tests).
        this.establishConnectionTimer_ = setTimeout(() => {
            this.establishConnectionTimer_ = null;
            this.establishConnection_();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }, Math.floor(timeout));
    }
    initConnection_() {
        if (!this.realtime_ && this.firstConnection_) {
            this.scheduleConnect_(0);
        }
    }
    onVisible_(visible) {
        // NOTE: Tabbing away and back to a window will defeat our reconnect backoff, but I think that's fine.
        if (visible &&
            !this.visible_ &&
            this.reconnectDelay_ === this.maxReconnectDelay_) {
            this.log_('Window became visible.  Reducing delay.');
            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
            if (!this.realtime_) {
                this.scheduleConnect_(0);
            }
        }
        this.visible_ = visible;
    }
    onOnline_(online) {
        if (online) {
            this.log_('Browser went online.');
            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
            if (!this.realtime_) {
                this.scheduleConnect_(0);
            }
        }
        else {
            this.log_('Browser went offline.  Killing connection.');
            if (this.realtime_) {
                this.realtime_.close();
            }
        }
    }
    onRealtimeDisconnect_() {
        this.log_('data client disconnected');
        this.connected_ = false;
        this.realtime_ = null;
        // Since we don't know if our sent transactions succeeded or not, we need to cancel them.
        this.cancelSentTransactions_();
        // Clear out the pending requests.
        this.requestCBHash_ = {};
        if (this.shouldReconnect_()) {
            if (!this.visible_) {
                this.log_("Window isn't visible.  Delaying reconnect.");
                this.reconnectDelay_ = this.maxReconnectDelay_;
                this.lastConnectionAttemptTime_ = new Date().getTime();
            }
            else if (this.lastConnectionEstablishedTime_) {
                // If we've been connected long enough, reset reconnect delay to minimum.
                const timeSinceLastConnectSucceeded = new Date().getTime() - this.lastConnectionEstablishedTime_;
                if (timeSinceLastConnectSucceeded > RECONNECT_DELAY_RESET_TIMEOUT) {
                    this.reconnectDelay_ = RECONNECT_MIN_DELAY;
                }
                this.lastConnectionEstablishedTime_ = null;
            }
            const timeSinceLastConnectAttempt = Math.max(0, new Date().getTime() - this.lastConnectionAttemptTime_);
            let reconnectDelay = Math.max(0, this.reconnectDelay_ - timeSinceLastConnectAttempt);
            reconnectDelay = Math.random() * reconnectDelay;
            this.log_('Trying to reconnect in ' + reconnectDelay + 'ms');
            this.scheduleConnect_(reconnectDelay);
            // Adjust reconnect delay for next time.
            this.reconnectDelay_ = Math.min(this.maxReconnectDelay_, this.reconnectDelay_ * RECONNECT_DELAY_MULTIPLIER);
        }
        this.onConnectStatus_(false);
    }
    async establishConnection_() {
        if (this.shouldReconnect_()) {
            this.log_('Making a connection attempt');
            this.lastConnectionAttemptTime_ = new Date().getTime();
            this.lastConnectionEstablishedTime_ = null;
            const onDataMessage = this.onDataMessage_.bind(this);
            const onReady = this.onReady_.bind(this);
            const onDisconnect = this.onRealtimeDisconnect_.bind(this);
            const connId = this.id + ':' + PersistentConnection.nextConnectionId_++;
            const lastSessionId = this.lastSessionId;
            let canceled = false;
            let connection = null;
            const closeFn = function () {
                if (connection) {
                    connection.close();
                }
                else {
                    canceled = true;
                    onDisconnect();
                }
            };
            const sendRequestFn = function (msg) {
                util.assert(connection, "sendRequest call when we're not connected not allowed.");
                connection.sendRequest(msg);
            };
            this.realtime_ = {
                close: closeFn,
                sendRequest: sendRequestFn
            };
            const forceRefresh = this.forceTokenRefresh_;
            this.forceTokenRefresh_ = false;
            try {
                // First fetch auth and app check token, and establish connection after
                // fetching the token was successful
                const [authToken, appCheckToken] = await Promise.all([
                    this.authTokenProvider_.getToken(forceRefresh),
                    this.appCheckTokenProvider_.getToken(forceRefresh)
                ]);
                if (!canceled) {
                    log('getToken() completed. Creating connection.');
                    this.authToken_ = authToken && authToken.accessToken;
                    this.appCheckToken_ = appCheckToken && appCheckToken.token;
                    connection = new Connection(connId, this.repoInfo_, this.applicationId_, this.appCheckToken_, this.authToken_, onDataMessage, onReady, onDisconnect, 
                    /* onKill= */ reason => {
                        warn$1(reason + ' (' + this.repoInfo_.toString() + ')');
                        this.interrupt(SERVER_KILL_INTERRUPT_REASON);
                    }, lastSessionId);
                }
                else {
                    log('getToken() completed but was canceled');
                }
            }
            catch (error) {
                this.log_('Failed to get token: ' + error);
                if (!canceled) {
                    if (this.repoInfo_.nodeAdmin) {
                        // This may be a critical error for the Admin Node.js SDK, so log a warning.
                        // But getToken() may also just have temporarily failed, so we still want to
                        // continue retrying.
                        warn$1(error);
                    }
                    closeFn();
                }
            }
        }
    }
    interrupt(reason) {
        log('Interrupting connection for reason: ' + reason);
        this.interruptReasons_[reason] = true;
        if (this.realtime_) {
            this.realtime_.close();
        }
        else {
            if (this.establishConnectionTimer_) {
                clearTimeout(this.establishConnectionTimer_);
                this.establishConnectionTimer_ = null;
            }
            if (this.connected_) {
                this.onRealtimeDisconnect_();
            }
        }
    }
    resume(reason) {
        log('Resuming connection for reason: ' + reason);
        delete this.interruptReasons_[reason];
        if (util.isEmpty(this.interruptReasons_)) {
            this.reconnectDelay_ = RECONNECT_MIN_DELAY;
            if (!this.realtime_) {
                this.scheduleConnect_(0);
            }
        }
    }
    handleTimestamp_(timestamp) {
        const delta = timestamp - new Date().getTime();
        this.onServerInfoUpdate_({ serverTimeOffset: delta });
    }
    cancelSentTransactions_() {
        for (let i = 0; i < this.outstandingPuts_.length; i++) {
            const put = this.outstandingPuts_[i];
            if (put && /*hash*/ 'h' in put.request && put.queued) {
                if (put.onComplete) {
                    put.onComplete('disconnect');
                }
                delete this.outstandingPuts_[i];
                this.outstandingPutCount_--;
            }
        }
        // Clean up array occasionally.
        if (this.outstandingPutCount_ === 0) {
            this.outstandingPuts_ = [];
        }
    }
    onListenRevoked_(pathString, query) {
        // Remove the listen and manufacture a "permission_denied" error for the failed listen.
        let queryId;
        if (!query) {
            queryId = 'default';
        }
        else {
            queryId = query.map(q => ObjectToUniqueKey(q)).join('$');
        }
        const listen = this.removeListen_(pathString, queryId);
        if (listen && listen.onComplete) {
            listen.onComplete('permission_denied');
        }
    }
    removeListen_(pathString, queryId) {
        const normalizedPathString = new Path(pathString).toString(); // normalize path.
        let listen;
        if (this.listens.has(normalizedPathString)) {
            const map = this.listens.get(normalizedPathString);
            listen = map.get(queryId);
            map.delete(queryId);
            if (map.size === 0) {
                this.listens.delete(normalizedPathString);
            }
        }
        else {
            // all listens for this path has already been removed
            listen = undefined;
        }
        return listen;
    }
    onAuthRevoked_(statusCode, explanation) {
        log('Auth token revoked: ' + statusCode + '/' + explanation);
        this.authToken_ = null;
        this.forceTokenRefresh_ = true;
        this.realtime_.close();
        if (statusCode === 'invalid_token' || statusCode === 'permission_denied') {
            // We'll wait a couple times before logging the warning / increasing the
            // retry period since oauth tokens will report as "invalid" if they're
            // just expired. Plus there may be transient issues that resolve themselves.
            this.invalidAuthTokenCount_++;
            if (this.invalidAuthTokenCount_ >= INVALID_TOKEN_THRESHOLD) {
                // Set a long reconnect delay because recovery is unlikely
                this.reconnectDelay_ = RECONNECT_MAX_DELAY_FOR_ADMINS;
                // Notify the auth token provider that the token is invalid, which will log
                // a warning
                this.authTokenProvider_.notifyForInvalidToken();
            }
        }
    }
    onAppCheckRevoked_(statusCode, explanation) {
        log('App check token revoked: ' + statusCode + '/' + explanation);
        this.appCheckToken_ = null;
        this.forceTokenRefresh_ = true;
        // Note: We don't close the connection as the developer may not have
        // enforcement enabled. The backend closes connections with enforcements.
        if (statusCode === 'invalid_token' || statusCode === 'permission_denied') {
            // We'll wait a couple times before logging the warning / increasing the
            // retry period since oauth tokens will report as "invalid" if they're
            // just expired. Plus there may be transient issues that resolve themselves.
            this.invalidAppCheckTokenCount_++;
            if (this.invalidAppCheckTokenCount_ >= INVALID_TOKEN_THRESHOLD) {
                this.appCheckTokenProvider_.notifyForInvalidToken();
            }
        }
    }
    onSecurityDebugPacket_(body) {
        if (this.securityDebugCallback_) {
            this.securityDebugCallback_(body);
        }
        else {
            if ('msg' in body) {
                console.log('FIREBASE: ' + body['msg'].replace('\n', '\nFIREBASE: '));
            }
        }
    }
    restoreState_() {
        //Re-authenticate ourselves if we have a credential stored.
        this.tryAuth();
        this.tryAppCheck();
        // Puts depend on having received the corresponding data update from the server before they complete, so we must
        // make sure to send listens before puts.
        for (const queries of this.listens.values()) {
            for (const listenSpec of queries.values()) {
                this.sendListen_(listenSpec);
            }
        }
        for (let i = 0; i < this.outstandingPuts_.length; i++) {
            if (this.outstandingPuts_[i]) {
                this.sendPut_(i);
            }
        }
        while (this.onDisconnectRequestQueue_.length) {
            const request = this.onDisconnectRequestQueue_.shift();
            this.sendOnDisconnect_(request.action, request.pathString, request.data, request.onComplete);
        }
        for (let i = 0; i < this.outstandingGets_.length; i++) {
            if (this.outstandingGets_[i]) {
                this.sendGet_(i);
            }
        }
    }
    /**
     * Sends client stats for first connection
     */
    sendConnectStats_() {
        const stats = {};
        let clientName = 'js';
        if (util.isNodeSdk()) {
            if (this.repoInfo_.nodeAdmin) {
                clientName = 'admin_node';
            }
            else {
                clientName = 'node';
            }
        }
        stats['sdk.' + clientName + '.' + SDK_VERSION.replace(/\./g, '-')] = 1;
        if (util.isMobileCordova()) {
            stats['framework.cordova'] = 1;
        }
        else if (util.isReactNative()) {
            stats['framework.reactnative'] = 1;
        }
        this.reportStats(stats);
    }
    shouldReconnect_() {
        const online = OnlineMonitor.getInstance().currentlyOnline();
        return util.isEmpty(this.interruptReasons_) && online;
    }
}
PersistentConnection.nextPersistentConnectionId_ = 0;
/**
 * Counter for number of connections created. Mainly used for tagging in the logs
 */
PersistentConnection.nextConnectionId_ = 0;

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class NamedNode {
    constructor(name, node) {
        this.name = name;
        this.node = node;
    }
    static Wrap(name, node) {
        return new NamedNode(name, node);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Index {
    /**
     * @returns A standalone comparison function for
     * this index
     */
    getCompare() {
        return this.compare.bind(this);
    }
    /**
     * Given a before and after value for a node, determine if the indexed value has changed. Even if they are different,
     * it's possible that the changes are isolated to parts of the snapshot that are not indexed.
     *
     *
     * @returns True if the portion of the snapshot being indexed changed between oldNode and newNode
     */
    indexedValueChanged(oldNode, newNode) {
        const oldWrapped = new NamedNode(MIN_NAME, oldNode);
        const newWrapped = new NamedNode(MIN_NAME, newNode);
        return this.compare(oldWrapped, newWrapped) !== 0;
    }
    /**
     * @returns a node wrapper that will sort equal to or less than
     * any other node wrapper, using this index
     */
    minPost() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NamedNode.MIN;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let __EMPTY_NODE;
class KeyIndex extends Index {
    static get __EMPTY_NODE() {
        return __EMPTY_NODE;
    }
    static set __EMPTY_NODE(val) {
        __EMPTY_NODE = val;
    }
    compare(a, b) {
        return nameCompare(a.name, b.name);
    }
    isDefinedOn(node) {
        // We could probably return true here (since every node has a key), but it's never called
        // so just leaving unimplemented for now.
        throw util.assertionError('KeyIndex.isDefinedOn not expected to be called.');
    }
    indexedValueChanged(oldNode, newNode) {
        return false; // The key for a node never changes.
    }
    minPost() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NamedNode.MIN;
    }
    maxPost() {
        // TODO: This should really be created once and cached in a static property, but
        // NamedNode isn't defined yet, so I can't use it in a static.  Bleh.
        return new NamedNode(MAX_NAME, __EMPTY_NODE);
    }
    makePost(indexValue, name) {
        util.assert(typeof indexValue === 'string', 'KeyIndex indexValue must always be a string.');
        // We just use empty node, but it'll never be compared, since our comparator only looks at name.
        return new NamedNode(indexValue, __EMPTY_NODE);
    }
    /**
     * @returns String representation for inclusion in a query spec
     */
    toString() {
        return '.key';
    }
}
const KEY_INDEX = new KeyIndex();

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An iterator over an LLRBNode.
 */
class SortedMapIterator {
    /**
     * @param node - Node to iterate.
     * @param isReverse_ - Whether or not to iterate in reverse
     */
    constructor(node, startKey, comparator, isReverse_, resultGenerator_ = null) {
        this.isReverse_ = isReverse_;
        this.resultGenerator_ = resultGenerator_;
        this.nodeStack_ = [];
        let cmp = 1;
        while (!node.isEmpty()) {
            node = node;
            cmp = startKey ? comparator(node.key, startKey) : 1;
            // flip the comparison if we're going in reverse
            if (isReverse_) {
                cmp *= -1;
            }
            if (cmp < 0) {
                // This node is less than our start key. ignore it
                if (this.isReverse_) {
                    node = node.left;
                }
                else {
                    node = node.right;
                }
            }
            else if (cmp === 0) {
                // This node is exactly equal to our start key. Push it on the stack, but stop iterating;
                this.nodeStack_.push(node);
                break;
            }
            else {
                // This node is greater than our start key, add it to the stack and move to the next one
                this.nodeStack_.push(node);
                if (this.isReverse_) {
                    node = node.right;
                }
                else {
                    node = node.left;
                }
            }
        }
    }
    getNext() {
        if (this.nodeStack_.length === 0) {
            return null;
        }
        let node = this.nodeStack_.pop();
        let result;
        if (this.resultGenerator_) {
            result = this.resultGenerator_(node.key, node.value);
        }
        else {
            result = { key: node.key, value: node.value };
        }
        if (this.isReverse_) {
            node = node.left;
            while (!node.isEmpty()) {
                this.nodeStack_.push(node);
                node = node.right;
            }
        }
        else {
            node = node.right;
            while (!node.isEmpty()) {
                this.nodeStack_.push(node);
                node = node.left;
            }
        }
        return result;
    }
    hasNext() {
        return this.nodeStack_.length > 0;
    }
    peek() {
        if (this.nodeStack_.length === 0) {
            return null;
        }
        const node = this.nodeStack_[this.nodeStack_.length - 1];
        if (this.resultGenerator_) {
            return this.resultGenerator_(node.key, node.value);
        }
        else {
            return { key: node.key, value: node.value };
        }
    }
}
/**
 * Represents a node in a Left-leaning Red-Black tree.
 */
class LLRBNode {
    /**
     * @param key - Key associated with this node.
     * @param value - Value associated with this node.
     * @param color - Whether this node is red.
     * @param left - Left child.
     * @param right - Right child.
     */
    constructor(key, value, color, left, right) {
        this.key = key;
        this.value = value;
        this.color = color != null ? color : LLRBNode.RED;
        this.left =
            left != null ? left : SortedMap.EMPTY_NODE;
        this.right =
            right != null ? right : SortedMap.EMPTY_NODE;
    }
    /**
     * Returns a copy of the current node, optionally replacing pieces of it.
     *
     * @param key - New key for the node, or null.
     * @param value - New value for the node, or null.
     * @param color - New color for the node, or null.
     * @param left - New left child for the node, or null.
     * @param right - New right child for the node, or null.
     * @returns The node copy.
     */
    copy(key, value, color, left, right) {
        return new LLRBNode(key != null ? key : this.key, value != null ? value : this.value, color != null ? color : this.color, left != null ? left : this.left, right != null ? right : this.right);
    }
    /**
     * @returns The total number of nodes in the tree.
     */
    count() {
        return this.left.count() + 1 + this.right.count();
    }
    /**
     * @returns True if the tree is empty.
     */
    isEmpty() {
        return false;
    }
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     *   node.  If it returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action) {
        return (this.left.inorderTraversal(action) ||
            !!action(this.key, this.value) ||
            this.right.inorderTraversal(action));
    }
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action) {
        return (this.right.reverseTraversal(action) ||
            action(this.key, this.value) ||
            this.left.reverseTraversal(action));
    }
    /**
     * @returns The minimum node in the tree.
     */
    min_() {
        if (this.left.isEmpty()) {
            return this;
        }
        else {
            return this.left.min_();
        }
    }
    /**
     * @returns The maximum key in the tree.
     */
    minKey() {
        return this.min_().key;
    }
    /**
     * @returns The maximum key in the tree.
     */
    maxKey() {
        if (this.right.isEmpty()) {
            return this.key;
        }
        else {
            return this.right.maxKey();
        }
    }
    /**
     * @param key - Key to insert.
     * @param value - Value to insert.
     * @param comparator - Comparator.
     * @returns New tree, with the key/value added.
     */
    insert(key, value, comparator) {
        let n = this;
        const cmp = comparator(key, n.key);
        if (cmp < 0) {
            n = n.copy(null, null, null, n.left.insert(key, value, comparator), null);
        }
        else if (cmp === 0) {
            n = n.copy(null, value, null, null, null);
        }
        else {
            n = n.copy(null, null, null, null, n.right.insert(key, value, comparator));
        }
        return n.fixUp_();
    }
    /**
     * @returns New tree, with the minimum key removed.
     */
    removeMin_() {
        if (this.left.isEmpty()) {
            return SortedMap.EMPTY_NODE;
        }
        let n = this;
        if (!n.left.isRed_() && !n.left.left.isRed_()) {
            n = n.moveRedLeft_();
        }
        n = n.copy(null, null, null, n.left.removeMin_(), null);
        return n.fixUp_();
    }
    /**
     * @param key - The key of the item to remove.
     * @param comparator - Comparator.
     * @returns New tree, with the specified item removed.
     */
    remove(key, comparator) {
        let n, smallest;
        n = this;
        if (comparator(key, n.key) < 0) {
            if (!n.left.isEmpty() && !n.left.isRed_() && !n.left.left.isRed_()) {
                n = n.moveRedLeft_();
            }
            n = n.copy(null, null, null, n.left.remove(key, comparator), null);
        }
        else {
            if (n.left.isRed_()) {
                n = n.rotateRight_();
            }
            if (!n.right.isEmpty() && !n.right.isRed_() && !n.right.left.isRed_()) {
                n = n.moveRedRight_();
            }
            if (comparator(key, n.key) === 0) {
                if (n.right.isEmpty()) {
                    return SortedMap.EMPTY_NODE;
                }
                else {
                    smallest = n.right.min_();
                    n = n.copy(smallest.key, smallest.value, null, null, n.right.removeMin_());
                }
            }
            n = n.copy(null, null, null, null, n.right.remove(key, comparator));
        }
        return n.fixUp_();
    }
    /**
     * @returns Whether this is a RED node.
     */
    isRed_() {
        return this.color;
    }
    /**
     * @returns New tree after performing any needed rotations.
     */
    fixUp_() {
        let n = this;
        if (n.right.isRed_() && !n.left.isRed_()) {
            n = n.rotateLeft_();
        }
        if (n.left.isRed_() && n.left.left.isRed_()) {
            n = n.rotateRight_();
        }
        if (n.left.isRed_() && n.right.isRed_()) {
            n = n.colorFlip_();
        }
        return n;
    }
    /**
     * @returns New tree, after moveRedLeft.
     */
    moveRedLeft_() {
        let n = this.colorFlip_();
        if (n.right.left.isRed_()) {
            n = n.copy(null, null, null, null, n.right.rotateRight_());
            n = n.rotateLeft_();
            n = n.colorFlip_();
        }
        return n;
    }
    /**
     * @returns New tree, after moveRedRight.
     */
    moveRedRight_() {
        let n = this.colorFlip_();
        if (n.left.left.isRed_()) {
            n = n.rotateRight_();
            n = n.colorFlip_();
        }
        return n;
    }
    /**
     * @returns New tree, after rotateLeft.
     */
    rotateLeft_() {
        const nl = this.copy(null, null, LLRBNode.RED, null, this.right.left);
        return this.right.copy(null, null, this.color, nl, null);
    }
    /**
     * @returns New tree, after rotateRight.
     */
    rotateRight_() {
        const nr = this.copy(null, null, LLRBNode.RED, this.left.right, null);
        return this.left.copy(null, null, this.color, null, nr);
    }
    /**
     * @returns Newt ree, after colorFlip.
     */
    colorFlip_() {
        const left = this.left.copy(null, null, !this.left.color, null, null);
        const right = this.right.copy(null, null, !this.right.color, null, null);
        return this.copy(null, null, !this.color, left, right);
    }
    /**
     * For testing.
     *
     * @returns True if all is well.
     */
    checkMaxDepth_() {
        const blackDepth = this.check_();
        return Math.pow(2.0, blackDepth) <= this.count() + 1;
    }
    check_() {
        if (this.isRed_() && this.left.isRed_()) {
            throw new Error('Red node has red child(' + this.key + ',' + this.value + ')');
        }
        if (this.right.isRed_()) {
            throw new Error('Right child of (' + this.key + ',' + this.value + ') is red');
        }
        const blackDepth = this.left.check_();
        if (blackDepth !== this.right.check_()) {
            throw new Error('Black depths differ');
        }
        else {
            return blackDepth + (this.isRed_() ? 0 : 1);
        }
    }
}
LLRBNode.RED = true;
LLRBNode.BLACK = false;
/**
 * Represents an empty node (a leaf node in the Red-Black Tree).
 */
class LLRBEmptyNode {
    /**
     * Returns a copy of the current node.
     *
     * @returns The node copy.
     */
    copy(key, value, color, left, right) {
        return this;
    }
    /**
     * Returns a copy of the tree, with the specified key/value added.
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @param comparator - Comparator.
     * @returns New tree, with item added.
     */
    insert(key, value, comparator) {
        return new LLRBNode(key, value, null);
    }
    /**
     * Returns a copy of the tree, with the specified key removed.
     *
     * @param key - The key to remove.
     * @param comparator - Comparator.
     * @returns New tree, with item removed.
     */
    remove(key, comparator) {
        return this;
    }
    /**
     * @returns The total number of nodes in the tree.
     */
    count() {
        return 0;
    }
    /**
     * @returns True if the tree is empty.
     */
    isEmpty() {
        return true;
    }
    /**
     * Traverses the tree in key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    inorderTraversal(action) {
        return false;
    }
    /**
     * Traverses the tree in reverse key order and calls the specified action function
     * for each node.
     *
     * @param action - Callback function to be called for each
     * node.  If it returns true, traversal is aborted.
     * @returns True if traversal was aborted.
     */
    reverseTraversal(action) {
        return false;
    }
    minKey() {
        return null;
    }
    maxKey() {
        return null;
    }
    check_() {
        return 0;
    }
    /**
     * @returns Whether this node is red.
     */
    isRed_() {
        return false;
    }
}
/**
 * An immutable sorted map implementation, based on a Left-leaning Red-Black
 * tree.
 */
class SortedMap {
    /**
     * @param comparator_ - Key comparator.
     * @param root_ - Optional root node for the map.
     */
    constructor(comparator_, root_ = SortedMap.EMPTY_NODE) {
        this.comparator_ = comparator_;
        this.root_ = root_;
    }
    /**
     * Returns a copy of the map, with the specified key/value added or replaced.
     * (TODO: We should perhaps rename this method to 'put')
     *
     * @param key - Key to be added.
     * @param value - Value to be added.
     * @returns New map, with item added.
     */
    insert(key, value) {
        return new SortedMap(this.comparator_, this.root_
            .insert(key, value, this.comparator_)
            .copy(null, null, LLRBNode.BLACK, null, null));
    }
    /**
     * Returns a copy of the map, with the specified key removed.
     *
     * @param key - The key to remove.
     * @returns New map, with item removed.
     */
    remove(key) {
        return new SortedMap(this.comparator_, this.root_
            .remove(key, this.comparator_)
            .copy(null, null, LLRBNode.BLACK, null, null));
    }
    /**
     * Returns the value of the node with the given key, or null.
     *
     * @param key - The key to look up.
     * @returns The value of the node with the given key, or null if the
     * key doesn't exist.
     */
    get(key) {
        let cmp;
        let node = this.root_;
        while (!node.isEmpty()) {
            cmp = this.comparator_(key, node.key);
            if (cmp === 0) {
                return node.value;
            }
            else if (cmp < 0) {
                node = node.left;
            }
            else if (cmp > 0) {
                node = node.right;
            }
        }
        return null;
    }
    /**
     * Returns the key of the item *before* the specified key, or null if key is the first item.
     * @param key - The key to find the predecessor of
     * @returns The predecessor key.
     */
    getPredecessorKey(key) {
        let cmp, node = this.root_, rightParent = null;
        while (!node.isEmpty()) {
            cmp = this.comparator_(key, node.key);
            if (cmp === 0) {
                if (!node.left.isEmpty()) {
                    node = node.left;
                    while (!node.right.isEmpty()) {
                        node = node.right;
                    }
                    return node.key;
                }
                else if (rightParent) {
                    return rightParent.key;
                }
                else {
                    return null; // first item.
                }
            }
            else if (cmp < 0) {
                node = node.left;
            }
            else if (cmp > 0) {
                rightParent = node;
                node = node.right;
            }
        }
        throw new Error('Attempted to find predecessor key for a nonexistent key.  What gives?');
    }
    /**
     * @returns True if the map is empty.
     */
    isEmpty() {
        return this.root_.isEmpty();
    }
    /**
     * @returns The total number of nodes in the map.
     */
    count() {
        return this.root_.count();
    }
    /**
     * @returns The minimum key in the map.
     */
    minKey() {
        return this.root_.minKey();
    }
    /**
     * @returns The maximum key in the map.
     */
    maxKey() {
        return this.root_.maxKey();
    }
    /**
     * Traverses the map in key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns The first truthy value returned by action, or the last falsey
     *   value returned by action
     */
    inorderTraversal(action) {
        return this.root_.inorderTraversal(action);
    }
    /**
     * Traverses the map in reverse key order and calls the specified action function
     * for each key/value pair.
     *
     * @param action - Callback function to be called
     * for each key/value pair.  If action returns true, traversal is aborted.
     * @returns True if the traversal was aborted.
     */
    reverseTraversal(action) {
        return this.root_.reverseTraversal(action);
    }
    /**
     * Returns an iterator over the SortedMap.
     * @returns The iterator.
     */
    getIterator(resultGenerator) {
        return new SortedMapIterator(this.root_, null, this.comparator_, false, resultGenerator);
    }
    getIteratorFrom(key, resultGenerator) {
        return new SortedMapIterator(this.root_, key, this.comparator_, false, resultGenerator);
    }
    getReverseIteratorFrom(key, resultGenerator) {
        return new SortedMapIterator(this.root_, key, this.comparator_, true, resultGenerator);
    }
    getReverseIterator(resultGenerator) {
        return new SortedMapIterator(this.root_, null, this.comparator_, true, resultGenerator);
    }
}
/**
 * Always use the same empty node, to reduce memory.
 */
SortedMap.EMPTY_NODE = new LLRBEmptyNode();

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function NAME_ONLY_COMPARATOR(left, right) {
    return nameCompare(left.name, right.name);
}
function NAME_COMPARATOR(left, right) {
    return nameCompare(left, right);
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let MAX_NODE$2;
function setMaxNode$1(val) {
    MAX_NODE$2 = val;
}
const priorityHashText = function (priority) {
    if (typeof priority === 'number') {
        return 'number:' + doubleToIEEE754String(priority);
    }
    else {
        return 'string:' + priority;
    }
};
/**
 * Validates that a priority snapshot Node is valid.
 */
const validatePriorityNode = function (priorityNode) {
    if (priorityNode.isLeafNode()) {
        const val = priorityNode.val();
        util.assert(typeof val === 'string' ||
            typeof val === 'number' ||
            (typeof val === 'object' && util.contains(val, '.sv')), 'Priority must be a string or number.');
    }
    else {
        util.assert(priorityNode === MAX_NODE$2 || priorityNode.isEmpty(), 'priority of unexpected type.');
    }
    // Don't call getPriority() on MAX_NODE to avoid hitting assertion.
    util.assert(priorityNode === MAX_NODE$2 || priorityNode.getPriority().isEmpty(), "Priority nodes can't have a priority of their own.");
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let __childrenNodeConstructor;
/**
 * LeafNode is a class for storing leaf nodes in a DataSnapshot.  It
 * implements Node and stores the value of the node (a string,
 * number, or boolean) accessible via getValue().
 */
class LeafNode {
    static set __childrenNodeConstructor(val) {
        __childrenNodeConstructor = val;
    }
    static get __childrenNodeConstructor() {
        return __childrenNodeConstructor;
    }
    /**
     * @param value_ - The value to store in this leaf node. The object type is
     * possible in the event of a deferred value
     * @param priorityNode_ - The priority of this node.
     */
    constructor(value_, priorityNode_ = LeafNode.__childrenNodeConstructor.EMPTY_NODE) {
        this.value_ = value_;
        this.priorityNode_ = priorityNode_;
        this.lazyHash_ = null;
        util.assert(this.value_ !== undefined && this.value_ !== null, "LeafNode shouldn't be created with null/undefined value.");
        validatePriorityNode(this.priorityNode_);
    }
    /** @inheritDoc */
    isLeafNode() {
        return true;
    }
    /** @inheritDoc */
    getPriority() {
        return this.priorityNode_;
    }
    /** @inheritDoc */
    updatePriority(newPriorityNode) {
        return new LeafNode(this.value_, newPriorityNode);
    }
    /** @inheritDoc */
    getImmediateChild(childName) {
        // Hack to treat priority as a regular child
        if (childName === '.priority') {
            return this.priorityNode_;
        }
        else {
            return LeafNode.__childrenNodeConstructor.EMPTY_NODE;
        }
    }
    /** @inheritDoc */
    getChild(path) {
        if (pathIsEmpty(path)) {
            return this;
        }
        else if (pathGetFront(path) === '.priority') {
            return this.priorityNode_;
        }
        else {
            return LeafNode.__childrenNodeConstructor.EMPTY_NODE;
        }
    }
    hasChild() {
        return false;
    }
    /** @inheritDoc */
    getPredecessorChildName(childName, childNode) {
        return null;
    }
    /** @inheritDoc */
    updateImmediateChild(childName, newChildNode) {
        if (childName === '.priority') {
            return this.updatePriority(newChildNode);
        }
        else if (newChildNode.isEmpty() && childName !== '.priority') {
            return this;
        }
        else {
            return LeafNode.__childrenNodeConstructor.EMPTY_NODE.updateImmediateChild(childName, newChildNode).updatePriority(this.priorityNode_);
        }
    }
    /** @inheritDoc */
    updateChild(path, newChildNode) {
        const front = pathGetFront(path);
        if (front === null) {
            return newChildNode;
        }
        else if (newChildNode.isEmpty() && front !== '.priority') {
            return this;
        }
        else {
            util.assert(front !== '.priority' || pathGetLength(path) === 1, '.priority must be the last token in a path');
            return this.updateImmediateChild(front, LeafNode.__childrenNodeConstructor.EMPTY_NODE.updateChild(pathPopFront(path), newChildNode));
        }
    }
    /** @inheritDoc */
    isEmpty() {
        return false;
    }
    /** @inheritDoc */
    numChildren() {
        return 0;
    }
    /** @inheritDoc */
    forEachChild(index, action) {
        return false;
    }
    val(exportFormat) {
        if (exportFormat && !this.getPriority().isEmpty()) {
            return {
                '.value': this.getValue(),
                '.priority': this.getPriority().val()
            };
        }
        else {
            return this.getValue();
        }
    }
    /** @inheritDoc */
    hash() {
        if (this.lazyHash_ === null) {
            let toHash = '';
            if (!this.priorityNode_.isEmpty()) {
                toHash +=
                    'priority:' +
                        priorityHashText(this.priorityNode_.val()) +
                        ':';
            }
            const type = typeof this.value_;
            toHash += type + ':';
            if (type === 'number') {
                toHash += doubleToIEEE754String(this.value_);
            }
            else {
                toHash += this.value_;
            }
            this.lazyHash_ = sha1(toHash);
        }
        return this.lazyHash_;
    }
    /**
     * Returns the value of the leaf node.
     * @returns The value of the node.
     */
    getValue() {
        return this.value_;
    }
    compareTo(other) {
        if (other === LeafNode.__childrenNodeConstructor.EMPTY_NODE) {
            return 1;
        }
        else if (other instanceof LeafNode.__childrenNodeConstructor) {
            return -1;
        }
        else {
            util.assert(other.isLeafNode(), 'Unknown node type');
            return this.compareToLeafNode_(other);
        }
    }
    /**
     * Comparison specifically for two leaf nodes
     */
    compareToLeafNode_(otherLeaf) {
        const otherLeafType = typeof otherLeaf.value_;
        const thisLeafType = typeof this.value_;
        const otherIndex = LeafNode.VALUE_TYPE_ORDER.indexOf(otherLeafType);
        const thisIndex = LeafNode.VALUE_TYPE_ORDER.indexOf(thisLeafType);
        util.assert(otherIndex >= 0, 'Unknown leaf type: ' + otherLeafType);
        util.assert(thisIndex >= 0, 'Unknown leaf type: ' + thisLeafType);
        if (otherIndex === thisIndex) {
            // Same type, compare values
            if (thisLeafType === 'object') {
                // Deferred value nodes are all equal, but we should also never get to this point...
                return 0;
            }
            else {
                // Note that this works because true > false, all others are number or string comparisons
                if (this.value_ < otherLeaf.value_) {
                    return -1;
                }
                else if (this.value_ === otherLeaf.value_) {
                    return 0;
                }
                else {
                    return 1;
                }
            }
        }
        else {
            return thisIndex - otherIndex;
        }
    }
    withIndex() {
        return this;
    }
    isIndexed() {
        return true;
    }
    equals(other) {
        if (other === this) {
            return true;
        }
        else if (other.isLeafNode()) {
            const otherLeaf = other;
            return (this.value_ === otherLeaf.value_ &&
                this.priorityNode_.equals(otherLeaf.priorityNode_));
        }
        else {
            return false;
        }
    }
}
/**
 * The sort order for comparing leaf nodes of different types. If two leaf nodes have
 * the same type, the comparison falls back to their value
 */
LeafNode.VALUE_TYPE_ORDER = ['object', 'boolean', 'number', 'string'];

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let nodeFromJSON$1;
let MAX_NODE$1;
function setNodeFromJSON(val) {
    nodeFromJSON$1 = val;
}
function setMaxNode(val) {
    MAX_NODE$1 = val;
}
class PriorityIndex extends Index {
    compare(a, b) {
        const aPriority = a.node.getPriority();
        const bPriority = b.node.getPriority();
        const indexCmp = aPriority.compareTo(bPriority);
        if (indexCmp === 0) {
            return nameCompare(a.name, b.name);
        }
        else {
            return indexCmp;
        }
    }
    isDefinedOn(node) {
        return !node.getPriority().isEmpty();
    }
    indexedValueChanged(oldNode, newNode) {
        return !oldNode.getPriority().equals(newNode.getPriority());
    }
    minPost() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NamedNode.MIN;
    }
    maxPost() {
        return new NamedNode(MAX_NAME, new LeafNode('[PRIORITY-POST]', MAX_NODE$1));
    }
    makePost(indexValue, name) {
        const priorityNode = nodeFromJSON$1(indexValue);
        return new NamedNode(name, new LeafNode('[PRIORITY-POST]', priorityNode));
    }
    /**
     * @returns String representation for inclusion in a query spec
     */
    toString() {
        return '.priority';
    }
}
const PRIORITY_INDEX = new PriorityIndex();

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const LOG_2 = Math.log(2);
class Base12Num {
    constructor(length) {
        const logBase2 = (num) => 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parseInt((Math.log(num) / LOG_2), 10);
        const bitMask = (bits) => parseInt(Array(bits + 1).join('1'), 2);
        this.count = logBase2(length + 1);
        this.current_ = this.count - 1;
        const mask = bitMask(this.count);
        this.bits_ = (length + 1) & mask;
    }
    nextBitIsOne() {
        //noinspection JSBitwiseOperatorUsage
        const result = !(this.bits_ & (0x1 << this.current_));
        this.current_--;
        return result;
    }
}
/**
 * Takes a list of child nodes and constructs a SortedSet using the given comparison
 * function
 *
 * Uses the algorithm described in the paper linked here:
 * http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.46.1458
 *
 * @param childList - Unsorted list of children
 * @param cmp - The comparison method to be used
 * @param keyFn - An optional function to extract K from a node wrapper, if K's
 * type is not NamedNode
 * @param mapSortFn - An optional override for comparator used by the generated sorted map
 */
const buildChildSet = function (childList, cmp, keyFn, mapSortFn) {
    childList.sort(cmp);
    const buildBalancedTree = function (low, high) {
        const length = high - low;
        let namedNode;
        let key;
        if (length === 0) {
            return null;
        }
        else if (length === 1) {
            namedNode = childList[low];
            key = keyFn ? keyFn(namedNode) : namedNode;
            return new LLRBNode(key, namedNode.node, LLRBNode.BLACK, null, null);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const middle = parseInt((length / 2), 10) + low;
            const left = buildBalancedTree(low, middle);
            const right = buildBalancedTree(middle + 1, high);
            namedNode = childList[middle];
            key = keyFn ? keyFn(namedNode) : namedNode;
            return new LLRBNode(key, namedNode.node, LLRBNode.BLACK, left, right);
        }
    };
    const buildFrom12Array = function (base12) {
        let node = null;
        let root = null;
        let index = childList.length;
        const buildPennant = function (chunkSize, color) {
            const low = index - chunkSize;
            const high = index;
            index -= chunkSize;
            const childTree = buildBalancedTree(low + 1, high);
            const namedNode = childList[low];
            const key = keyFn ? keyFn(namedNode) : namedNode;
            attachPennant(new LLRBNode(key, namedNode.node, color, null, childTree));
        };
        const attachPennant = function (pennant) {
            if (node) {
                node.left = pennant;
                node = pennant;
            }
            else {
                root = pennant;
                node = pennant;
            }
        };
        for (let i = 0; i < base12.count; ++i) {
            const isOne = base12.nextBitIsOne();
            // The number of nodes taken in each slice is 2^(arr.length - (i + 1))
            const chunkSize = Math.pow(2, base12.count - (i + 1));
            if (isOne) {
                buildPennant(chunkSize, LLRBNode.BLACK);
            }
            else {
                // current == 2
                buildPennant(chunkSize, LLRBNode.BLACK);
                buildPennant(chunkSize, LLRBNode.RED);
            }
        }
        return root;
    };
    const base12 = new Base12Num(childList.length);
    const root = buildFrom12Array(base12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new SortedMap(mapSortFn || cmp, root);
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let _defaultIndexMap;
const fallbackObject = {};
class IndexMap {
    /**
     * The default IndexMap for nodes without a priority
     */
    static get Default() {
        util.assert(fallbackObject && PRIORITY_INDEX, 'ChildrenNode.ts has not been loaded');
        _defaultIndexMap =
            _defaultIndexMap ||
                new IndexMap({ '.priority': fallbackObject }, { '.priority': PRIORITY_INDEX });
        return _defaultIndexMap;
    }
    constructor(indexes_, indexSet_) {
        this.indexes_ = indexes_;
        this.indexSet_ = indexSet_;
    }
    get(indexKey) {
        const sortedMap = util.safeGet(this.indexes_, indexKey);
        if (!sortedMap) {
            throw new Error('No index defined for ' + indexKey);
        }
        if (sortedMap instanceof SortedMap) {
            return sortedMap;
        }
        else {
            // The index exists, but it falls back to just name comparison. Return null so that the calling code uses the
            // regular child map
            return null;
        }
    }
    hasIndex(indexDefinition) {
        return util.contains(this.indexSet_, indexDefinition.toString());
    }
    addIndex(indexDefinition, existingChildren) {
        util.assert(indexDefinition !== KEY_INDEX, "KeyIndex always exists and isn't meant to be added to the IndexMap.");
        const childList = [];
        let sawIndexedValue = false;
        const iter = existingChildren.getIterator(NamedNode.Wrap);
        let next = iter.getNext();
        while (next) {
            sawIndexedValue =
                sawIndexedValue || indexDefinition.isDefinedOn(next.node);
            childList.push(next);
            next = iter.getNext();
        }
        let newIndex;
        if (sawIndexedValue) {
            newIndex = buildChildSet(childList, indexDefinition.getCompare());
        }
        else {
            newIndex = fallbackObject;
        }
        const indexName = indexDefinition.toString();
        const newIndexSet = { ...this.indexSet_ };
        newIndexSet[indexName] = indexDefinition;
        const newIndexes = { ...this.indexes_ };
        newIndexes[indexName] = newIndex;
        return new IndexMap(newIndexes, newIndexSet);
    }
    /**
     * Ensure that this node is properly tracked in any indexes that we're maintaining
     */
    addToIndexes(namedNode, existingChildren) {
        const newIndexes = util.map(this.indexes_, (indexedChildren, indexName) => {
            const index = util.safeGet(this.indexSet_, indexName);
            util.assert(index, 'Missing index implementation for ' + indexName);
            if (indexedChildren === fallbackObject) {
                // Check to see if we need to index everything
                if (index.isDefinedOn(namedNode.node)) {
                    // We need to build this index
                    const childList = [];
                    const iter = existingChildren.getIterator(NamedNode.Wrap);
                    let next = iter.getNext();
                    while (next) {
                        if (next.name !== namedNode.name) {
                            childList.push(next);
                        }
                        next = iter.getNext();
                    }
                    childList.push(namedNode);
                    return buildChildSet(childList, index.getCompare());
                }
                else {
                    // No change, this remains a fallback
                    return fallbackObject;
                }
            }
            else {
                const existingSnap = existingChildren.get(namedNode.name);
                let newChildren = indexedChildren;
                if (existingSnap) {
                    newChildren = newChildren.remove(new NamedNode(namedNode.name, existingSnap));
                }
                return newChildren.insert(namedNode, namedNode.node);
            }
        });
        return new IndexMap(newIndexes, this.indexSet_);
    }
    /**
     * Create a new IndexMap instance with the given value removed
     */
    removeFromIndexes(namedNode, existingChildren) {
        const newIndexes = util.map(this.indexes_, (indexedChildren) => {
            if (indexedChildren === fallbackObject) {
                // This is the fallback. Just return it, nothing to do in this case
                return indexedChildren;
            }
            else {
                const existingSnap = existingChildren.get(namedNode.name);
                if (existingSnap) {
                    return indexedChildren.remove(new NamedNode(namedNode.name, existingSnap));
                }
                else {
                    // No record of this child
                    return indexedChildren;
                }
            }
        });
        return new IndexMap(newIndexes, this.indexSet_);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// TODO: For memory savings, don't store priorityNode_ if it's empty.
let EMPTY_NODE;
/**
 * ChildrenNode is a class for storing internal nodes in a DataSnapshot
 * (i.e. nodes with children).  It implements Node and stores the
 * list of children in the children property, sorted by child name.
 */
class ChildrenNode {
    static get EMPTY_NODE() {
        return (EMPTY_NODE ||
            (EMPTY_NODE = new ChildrenNode(new SortedMap(NAME_COMPARATOR), null, IndexMap.Default)));
    }
    /**
     * @param children_ - List of children of this node..
     * @param priorityNode_ - The priority of this node (as a snapshot node).
     */
    constructor(children_, priorityNode_, indexMap_) {
        this.children_ = children_;
        this.priorityNode_ = priorityNode_;
        this.indexMap_ = indexMap_;
        this.lazyHash_ = null;
        /**
         * Note: The only reason we allow null priority is for EMPTY_NODE, since we can't use
         * EMPTY_NODE as the priority of EMPTY_NODE.  We might want to consider making EMPTY_NODE its own
         * class instead of an empty ChildrenNode.
         */
        if (this.priorityNode_) {
            validatePriorityNode(this.priorityNode_);
        }
        if (this.children_.isEmpty()) {
            util.assert(!this.priorityNode_ || this.priorityNode_.isEmpty(), 'An empty node cannot have a priority');
        }
    }
    /** @inheritDoc */
    isLeafNode() {
        return false;
    }
    /** @inheritDoc */
    getPriority() {
        return this.priorityNode_ || EMPTY_NODE;
    }
    /** @inheritDoc */
    updatePriority(newPriorityNode) {
        if (this.children_.isEmpty()) {
            // Don't allow priorities on empty nodes
            return this;
        }
        else {
            return new ChildrenNode(this.children_, newPriorityNode, this.indexMap_);
        }
    }
    /** @inheritDoc */
    getImmediateChild(childName) {
        // Hack to treat priority as a regular child
        if (childName === '.priority') {
            return this.getPriority();
        }
        else {
            const child = this.children_.get(childName);
            return child === null ? EMPTY_NODE : child;
        }
    }
    /** @inheritDoc */
    getChild(path) {
        const front = pathGetFront(path);
        if (front === null) {
            return this;
        }
        return this.getImmediateChild(front).getChild(pathPopFront(path));
    }
    /** @inheritDoc */
    hasChild(childName) {
        return this.children_.get(childName) !== null;
    }
    /** @inheritDoc */
    updateImmediateChild(childName, newChildNode) {
        util.assert(newChildNode, 'We should always be passing snapshot nodes');
        if (childName === '.priority') {
            return this.updatePriority(newChildNode);
        }
        else {
            const namedNode = new NamedNode(childName, newChildNode);
            let newChildren, newIndexMap;
            if (newChildNode.isEmpty()) {
                newChildren = this.children_.remove(childName);
                newIndexMap = this.indexMap_.removeFromIndexes(namedNode, this.children_);
            }
            else {
                newChildren = this.children_.insert(childName, newChildNode);
                newIndexMap = this.indexMap_.addToIndexes(namedNode, this.children_);
            }
            const newPriority = newChildren.isEmpty()
                ? EMPTY_NODE
                : this.priorityNode_;
            return new ChildrenNode(newChildren, newPriority, newIndexMap);
        }
    }
    /** @inheritDoc */
    updateChild(path, newChildNode) {
        const front = pathGetFront(path);
        if (front === null) {
            return newChildNode;
        }
        else {
            util.assert(pathGetFront(path) !== '.priority' || pathGetLength(path) === 1, '.priority must be the last token in a path');
            const newImmediateChild = this.getImmediateChild(front).updateChild(pathPopFront(path), newChildNode);
            return this.updateImmediateChild(front, newImmediateChild);
        }
    }
    /** @inheritDoc */
    isEmpty() {
        return this.children_.isEmpty();
    }
    /** @inheritDoc */
    numChildren() {
        return this.children_.count();
    }
    /** @inheritDoc */
    val(exportFormat) {
        if (this.isEmpty()) {
            return null;
        }
        const obj = {};
        let numKeys = 0, maxKey = 0, allIntegerKeys = true;
        this.forEachChild(PRIORITY_INDEX, (key, childNode) => {
            obj[key] = childNode.val(exportFormat);
            numKeys++;
            if (allIntegerKeys && ChildrenNode.INTEGER_REGEXP_.test(key)) {
                maxKey = Math.max(maxKey, Number(key));
            }
            else {
                allIntegerKeys = false;
            }
        });
        if (!exportFormat && allIntegerKeys && maxKey < 2 * numKeys) {
            // convert to array.
            const array = [];
            // eslint-disable-next-line guard-for-in
            for (const key in obj) {
                array[key] = obj[key];
            }
            return array;
        }
        else {
            if (exportFormat && !this.getPriority().isEmpty()) {
                obj['.priority'] = this.getPriority().val();
            }
            return obj;
        }
    }
    /** @inheritDoc */
    hash() {
        if (this.lazyHash_ === null) {
            let toHash = '';
            if (!this.getPriority().isEmpty()) {
                toHash +=
                    'priority:' +
                        priorityHashText(this.getPriority().val()) +
                        ':';
            }
            this.forEachChild(PRIORITY_INDEX, (key, childNode) => {
                const childHash = childNode.hash();
                if (childHash !== '') {
                    toHash += ':' + key + ':' + childHash;
                }
            });
            this.lazyHash_ = toHash === '' ? '' : sha1(toHash);
        }
        return this.lazyHash_;
    }
    /** @inheritDoc */
    getPredecessorChildName(childName, childNode, index) {
        const idx = this.resolveIndex_(index);
        if (idx) {
            const predecessor = idx.getPredecessorKey(new NamedNode(childName, childNode));
            return predecessor ? predecessor.name : null;
        }
        else {
            return this.children_.getPredecessorKey(childName);
        }
    }
    getFirstChildName(indexDefinition) {
        const idx = this.resolveIndex_(indexDefinition);
        if (idx) {
            const minKey = idx.minKey();
            return minKey && minKey.name;
        }
        else {
            return this.children_.minKey();
        }
    }
    getFirstChild(indexDefinition) {
        const minKey = this.getFirstChildName(indexDefinition);
        if (minKey) {
            return new NamedNode(minKey, this.children_.get(minKey));
        }
        else {
            return null;
        }
    }
    /**
     * Given an index, return the key name of the largest value we have, according to that index
     */
    getLastChildName(indexDefinition) {
        const idx = this.resolveIndex_(indexDefinition);
        if (idx) {
            const maxKey = idx.maxKey();
            return maxKey && maxKey.name;
        }
        else {
            return this.children_.maxKey();
        }
    }
    getLastChild(indexDefinition) {
        const maxKey = this.getLastChildName(indexDefinition);
        if (maxKey) {
            return new NamedNode(maxKey, this.children_.get(maxKey));
        }
        else {
            return null;
        }
    }
    forEachChild(index, action) {
        const idx = this.resolveIndex_(index);
        if (idx) {
            return idx.inorderTraversal(wrappedNode => {
                return action(wrappedNode.name, wrappedNode.node);
            });
        }
        else {
            return this.children_.inorderTraversal(action);
        }
    }
    getIterator(indexDefinition) {
        return this.getIteratorFrom(indexDefinition.minPost(), indexDefinition);
    }
    getIteratorFrom(startPost, indexDefinition) {
        const idx = this.resolveIndex_(indexDefinition);
        if (idx) {
            return idx.getIteratorFrom(startPost, key => key);
        }
        else {
            const iterator = this.children_.getIteratorFrom(startPost.name, NamedNode.Wrap);
            let next = iterator.peek();
            while (next != null && indexDefinition.compare(next, startPost) < 0) {
                iterator.getNext();
                next = iterator.peek();
            }
            return iterator;
        }
    }
    getReverseIterator(indexDefinition) {
        return this.getReverseIteratorFrom(indexDefinition.maxPost(), indexDefinition);
    }
    getReverseIteratorFrom(endPost, indexDefinition) {
        const idx = this.resolveIndex_(indexDefinition);
        if (idx) {
            return idx.getReverseIteratorFrom(endPost, key => {
                return key;
            });
        }
        else {
            const iterator = this.children_.getReverseIteratorFrom(endPost.name, NamedNode.Wrap);
            let next = iterator.peek();
            while (next != null && indexDefinition.compare(next, endPost) > 0) {
                iterator.getNext();
                next = iterator.peek();
            }
            return iterator;
        }
    }
    compareTo(other) {
        if (this.isEmpty()) {
            if (other.isEmpty()) {
                return 0;
            }
            else {
                return -1;
            }
        }
        else if (other.isLeafNode() || other.isEmpty()) {
            return 1;
        }
        else if (other === MAX_NODE) {
            return -1;
        }
        else {
            // Must be another node with children.
            return 0;
        }
    }
    withIndex(indexDefinition) {
        if (indexDefinition === KEY_INDEX ||
            this.indexMap_.hasIndex(indexDefinition)) {
            return this;
        }
        else {
            const newIndexMap = this.indexMap_.addIndex(indexDefinition, this.children_);
            return new ChildrenNode(this.children_, this.priorityNode_, newIndexMap);
        }
    }
    isIndexed(index) {
        return index === KEY_INDEX || this.indexMap_.hasIndex(index);
    }
    equals(other) {
        if (other === this) {
            return true;
        }
        else if (other.isLeafNode()) {
            return false;
        }
        else {
            const otherChildrenNode = other;
            if (!this.getPriority().equals(otherChildrenNode.getPriority())) {
                return false;
            }
            else if (this.children_.count() === otherChildrenNode.children_.count()) {
                const thisIter = this.getIterator(PRIORITY_INDEX);
                const otherIter = otherChildrenNode.getIterator(PRIORITY_INDEX);
                let thisCurrent = thisIter.getNext();
                let otherCurrent = otherIter.getNext();
                while (thisCurrent && otherCurrent) {
                    if (thisCurrent.name !== otherCurrent.name ||
                        !thisCurrent.node.equals(otherCurrent.node)) {
                        return false;
                    }
                    thisCurrent = thisIter.getNext();
                    otherCurrent = otherIter.getNext();
                }
                return thisCurrent === null && otherCurrent === null;
            }
            else {
                return false;
            }
        }
    }
    /**
     * Returns a SortedMap ordered by index, or null if the default (by-key) ordering can be used
     * instead.
     *
     */
    resolveIndex_(indexDefinition) {
        if (indexDefinition === KEY_INDEX) {
            return null;
        }
        else {
            return this.indexMap_.get(indexDefinition.toString());
        }
    }
}
ChildrenNode.INTEGER_REGEXP_ = /^(0|[1-9]\d*)$/;
class MaxNode extends ChildrenNode {
    constructor() {
        super(new SortedMap(NAME_COMPARATOR), ChildrenNode.EMPTY_NODE, IndexMap.Default);
    }
    compareTo(other) {
        if (other === this) {
            return 0;
        }
        else {
            return 1;
        }
    }
    equals(other) {
        // Not that we every compare it, but MAX_NODE is only ever equal to itself
        return other === this;
    }
    getPriority() {
        return this;
    }
    getImmediateChild(childName) {
        return ChildrenNode.EMPTY_NODE;
    }
    isEmpty() {
        return false;
    }
}
/**
 * Marker that will sort higher than any other snapshot.
 */
const MAX_NODE = new MaxNode();
Object.defineProperties(NamedNode, {
    MIN: {
        value: new NamedNode(MIN_NAME, ChildrenNode.EMPTY_NODE)
    },
    MAX: {
        value: new NamedNode(MAX_NAME, MAX_NODE)
    }
});
/**
 * Reference Extensions
 */
KeyIndex.__EMPTY_NODE = ChildrenNode.EMPTY_NODE;
LeafNode.__childrenNodeConstructor = ChildrenNode;
setMaxNode$1(MAX_NODE);
setMaxNode(MAX_NODE);

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const USE_HINZE = true;
/**
 * Constructs a snapshot node representing the passed JSON and returns it.
 * @param json - JSON to create a node for.
 * @param priority - Optional priority to use.  This will be ignored if the
 * passed JSON contains a .priority property.
 */
function nodeFromJSON(json, priority = null) {
    if (json === null) {
        return ChildrenNode.EMPTY_NODE;
    }
    if (typeof json === 'object' && '.priority' in json) {
        priority = json['.priority'];
    }
    util.assert(priority === null ||
        typeof priority === 'string' ||
        typeof priority === 'number' ||
        (typeof priority === 'object' && '.sv' in priority), 'Invalid priority type found: ' + typeof priority);
    if (typeof json === 'object' && '.value' in json && json['.value'] !== null) {
        json = json['.value'];
    }
    // Valid leaf nodes include non-objects or server-value wrapper objects
    if (typeof json !== 'object' || '.sv' in json) {
        const jsonLeaf = json;
        return new LeafNode(jsonLeaf, nodeFromJSON(priority));
    }
    if (!(json instanceof Array) && USE_HINZE) {
        const children = [];
        let childrenHavePriority = false;
        const hinzeJsonObj = json;
        each(hinzeJsonObj, (key, child) => {
            if (key.substring(0, 1) !== '.') {
                // Ignore metadata nodes
                const childNode = nodeFromJSON(child);
                if (!childNode.isEmpty()) {
                    childrenHavePriority =
                        childrenHavePriority || !childNode.getPriority().isEmpty();
                    children.push(new NamedNode(key, childNode));
                }
            }
        });
        if (children.length === 0) {
            return ChildrenNode.EMPTY_NODE;
        }
        const childSet = buildChildSet(children, NAME_ONLY_COMPARATOR, namedNode => namedNode.name, NAME_COMPARATOR);
        if (childrenHavePriority) {
            const sortedChildSet = buildChildSet(children, PRIORITY_INDEX.getCompare());
            return new ChildrenNode(childSet, nodeFromJSON(priority), new IndexMap({ '.priority': sortedChildSet }, { '.priority': PRIORITY_INDEX }));
        }
        else {
            return new ChildrenNode(childSet, nodeFromJSON(priority), IndexMap.Default);
        }
    }
    else {
        let node = ChildrenNode.EMPTY_NODE;
        each(json, (key, childData) => {
            if (util.contains(json, key)) {
                if (key.substring(0, 1) !== '.') {
                    // ignore metadata nodes.
                    const childNode = nodeFromJSON(childData);
                    if (childNode.isLeafNode() || !childNode.isEmpty()) {
                        node = node.updateImmediateChild(key, childNode);
                    }
                }
            }
        });
        return node.updatePriority(nodeFromJSON(priority));
    }
}
setNodeFromJSON(nodeFromJSON);

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class PathIndex extends Index {
    constructor(indexPath_) {
        super();
        this.indexPath_ = indexPath_;
        util.assert(!pathIsEmpty(indexPath_) && pathGetFront(indexPath_) !== '.priority', "Can't create PathIndex with empty path or .priority key");
    }
    extractChild(snap) {
        return snap.getChild(this.indexPath_);
    }
    isDefinedOn(node) {
        return !node.getChild(this.indexPath_).isEmpty();
    }
    compare(a, b) {
        const aChild = this.extractChild(a.node);
        const bChild = this.extractChild(b.node);
        const indexCmp = aChild.compareTo(bChild);
        if (indexCmp === 0) {
            return nameCompare(a.name, b.name);
        }
        else {
            return indexCmp;
        }
    }
    makePost(indexValue, name) {
        const valueNode = nodeFromJSON(indexValue);
        const node = ChildrenNode.EMPTY_NODE.updateChild(this.indexPath_, valueNode);
        return new NamedNode(name, node);
    }
    maxPost() {
        const node = ChildrenNode.EMPTY_NODE.updateChild(this.indexPath_, MAX_NODE);
        return new NamedNode(MAX_NAME, node);
    }
    toString() {
        return pathSlice(this.indexPath_, 0).join('/');
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class ValueIndex extends Index {
    compare(a, b) {
        const indexCmp = a.node.compareTo(b.node);
        if (indexCmp === 0) {
            return nameCompare(a.name, b.name);
        }
        else {
            return indexCmp;
        }
    }
    isDefinedOn(node) {
        return true;
    }
    indexedValueChanged(oldNode, newNode) {
        return !oldNode.equals(newNode);
    }
    minPost() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NamedNode.MIN;
    }
    maxPost() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return NamedNode.MAX;
    }
    makePost(indexValue, name) {
        const valueNode = nodeFromJSON(indexValue);
        return new NamedNode(name, valueNode);
    }
    /**
     * @returns String representation for inclusion in a query spec
     */
    toString() {
        return '.value';
    }
}
const VALUE_INDEX = new ValueIndex();

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function changeValue(snapshotNode) {
    return { type: "value" /* ChangeType.VALUE */, snapshotNode };
}
function changeChildAdded(childName, snapshotNode) {
    return { type: "child_added" /* ChangeType.CHILD_ADDED */, snapshotNode, childName };
}
function changeChildRemoved(childName, snapshotNode) {
    return { type: "child_removed" /* ChangeType.CHILD_REMOVED */, snapshotNode, childName };
}
function changeChildChanged(childName, snapshotNode, oldSnap) {
    return {
        type: "child_changed" /* ChangeType.CHILD_CHANGED */,
        snapshotNode,
        childName,
        oldSnap
    };
}
function changeChildMoved(childName, snapshotNode) {
    return { type: "child_moved" /* ChangeType.CHILD_MOVED */, snapshotNode, childName };
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Doesn't really filter nodes but applies an index to the node and keeps track of any changes
 */
class IndexedFilter {
    constructor(index_) {
        this.index_ = index_;
    }
    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
        util.assert(snap.isIndexed(this.index_), 'A node must be indexed if only a child is updated');
        const oldChild = snap.getImmediateChild(key);
        // Check if anything actually changed.
        if (oldChild.getChild(affectedPath).equals(newChild.getChild(affectedPath))) {
            // There's an edge case where a child can enter or leave the view because affectedPath was set to null.
            // In this case, affectedPath will appear null in both the old and new snapshots.  So we need
            // to avoid treating these cases as "nothing changed."
            if (oldChild.isEmpty() === newChild.isEmpty()) {
                // Nothing changed.
                // This assert should be valid, but it's expensive (can dominate perf testing) so don't actually do it.
                //assert(oldChild.equals(newChild), 'Old and new snapshots should be equal.');
                return snap;
            }
        }
        if (optChangeAccumulator != null) {
            if (newChild.isEmpty()) {
                if (snap.hasChild(key)) {
                    optChangeAccumulator.trackChildChange(changeChildRemoved(key, oldChild));
                }
                else {
                    util.assert(snap.isLeafNode(), 'A child remove without an old child only makes sense on a leaf node');
                }
            }
            else if (oldChild.isEmpty()) {
                optChangeAccumulator.trackChildChange(changeChildAdded(key, newChild));
            }
            else {
                optChangeAccumulator.trackChildChange(changeChildChanged(key, newChild, oldChild));
            }
        }
        if (snap.isLeafNode() && newChild.isEmpty()) {
            return snap;
        }
        else {
            // Make sure the node is indexed
            return snap.updateImmediateChild(key, newChild).withIndex(this.index_);
        }
    }
    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
        if (optChangeAccumulator != null) {
            if (!oldSnap.isLeafNode()) {
                oldSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
                    if (!newSnap.hasChild(key)) {
                        optChangeAccumulator.trackChildChange(changeChildRemoved(key, childNode));
                    }
                });
            }
            if (!newSnap.isLeafNode()) {
                newSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
                    if (oldSnap.hasChild(key)) {
                        const oldChild = oldSnap.getImmediateChild(key);
                        if (!oldChild.equals(childNode)) {
                            optChangeAccumulator.trackChildChange(changeChildChanged(key, childNode, oldChild));
                        }
                    }
                    else {
                        optChangeAccumulator.trackChildChange(changeChildAdded(key, childNode));
                    }
                });
            }
        }
        return newSnap.withIndex(this.index_);
    }
    updatePriority(oldSnap, newPriority) {
        if (oldSnap.isEmpty()) {
            return ChildrenNode.EMPTY_NODE;
        }
        else {
            return oldSnap.updatePriority(newPriority);
        }
    }
    filtersNodes() {
        return false;
    }
    getIndexedFilter() {
        return this;
    }
    getIndex() {
        return this.index_;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Filters nodes by range and uses an IndexFilter to track any changes after filtering the node
 */
class RangedFilter {
    constructor(params) {
        this.indexedFilter_ = new IndexedFilter(params.getIndex());
        this.index_ = params.getIndex();
        this.startPost_ = RangedFilter.getStartPost_(params);
        this.endPost_ = RangedFilter.getEndPost_(params);
        this.startIsInclusive_ = !params.startAfterSet_;
        this.endIsInclusive_ = !params.endBeforeSet_;
    }
    getStartPost() {
        return this.startPost_;
    }
    getEndPost() {
        return this.endPost_;
    }
    matches(node) {
        const isWithinStart = this.startIsInclusive_
            ? this.index_.compare(this.getStartPost(), node) <= 0
            : this.index_.compare(this.getStartPost(), node) < 0;
        const isWithinEnd = this.endIsInclusive_
            ? this.index_.compare(node, this.getEndPost()) <= 0
            : this.index_.compare(node, this.getEndPost()) < 0;
        return isWithinStart && isWithinEnd;
    }
    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
        if (!this.matches(new NamedNode(key, newChild))) {
            newChild = ChildrenNode.EMPTY_NODE;
        }
        return this.indexedFilter_.updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator);
    }
    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
        if (newSnap.isLeafNode()) {
            // Make sure we have a children node with the correct index, not a leaf node;
            newSnap = ChildrenNode.EMPTY_NODE;
        }
        let filtered = newSnap.withIndex(this.index_);
        // Don't support priorities on queries
        filtered = filtered.updatePriority(ChildrenNode.EMPTY_NODE);
        const self = this;
        newSnap.forEachChild(PRIORITY_INDEX, (key, childNode) => {
            if (!self.matches(new NamedNode(key, childNode))) {
                filtered = filtered.updateImmediateChild(key, ChildrenNode.EMPTY_NODE);
            }
        });
        return this.indexedFilter_.updateFullNode(oldSnap, filtered, optChangeAccumulator);
    }
    updatePriority(oldSnap, newPriority) {
        // Don't support priorities on queries
        return oldSnap;
    }
    filtersNodes() {
        return true;
    }
    getIndexedFilter() {
        return this.indexedFilter_;
    }
    getIndex() {
        return this.index_;
    }
    static getStartPost_(params) {
        if (params.hasStart()) {
            const startName = params.getIndexStartName();
            return params.getIndex().makePost(params.getIndexStartValue(), startName);
        }
        else {
            return params.getIndex().minPost();
        }
    }
    static getEndPost_(params) {
        if (params.hasEnd()) {
            const endName = params.getIndexEndName();
            return params.getIndex().makePost(params.getIndexEndValue(), endName);
        }
        else {
            return params.getIndex().maxPost();
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Applies a limit and a range to a node and uses RangedFilter to do the heavy lifting where possible
 */
class LimitedFilter {
    constructor(params) {
        this.withinDirectionalStart = (node) => this.reverse_ ? this.withinEndPost(node) : this.withinStartPost(node);
        this.withinDirectionalEnd = (node) => this.reverse_ ? this.withinStartPost(node) : this.withinEndPost(node);
        this.withinStartPost = (node) => {
            const compareRes = this.index_.compare(this.rangedFilter_.getStartPost(), node);
            return this.startIsInclusive_ ? compareRes <= 0 : compareRes < 0;
        };
        this.withinEndPost = (node) => {
            const compareRes = this.index_.compare(node, this.rangedFilter_.getEndPost());
            return this.endIsInclusive_ ? compareRes <= 0 : compareRes < 0;
        };
        this.rangedFilter_ = new RangedFilter(params);
        this.index_ = params.getIndex();
        this.limit_ = params.getLimit();
        this.reverse_ = !params.isViewFromLeft();
        this.startIsInclusive_ = !params.startAfterSet_;
        this.endIsInclusive_ = !params.endBeforeSet_;
    }
    updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator) {
        if (!this.rangedFilter_.matches(new NamedNode(key, newChild))) {
            newChild = ChildrenNode.EMPTY_NODE;
        }
        if (snap.getImmediateChild(key).equals(newChild)) {
            // No change
            return snap;
        }
        else if (snap.numChildren() < this.limit_) {
            return this.rangedFilter_
                .getIndexedFilter()
                .updateChild(snap, key, newChild, affectedPath, source, optChangeAccumulator);
        }
        else {
            return this.fullLimitUpdateChild_(snap, key, newChild, source, optChangeAccumulator);
        }
    }
    updateFullNode(oldSnap, newSnap, optChangeAccumulator) {
        let filtered;
        if (newSnap.isLeafNode() || newSnap.isEmpty()) {
            // Make sure we have a children node with the correct index, not a leaf node;
            filtered = ChildrenNode.EMPTY_NODE.withIndex(this.index_);
        }
        else {
            if (this.limit_ * 2 < newSnap.numChildren() &&
                newSnap.isIndexed(this.index_)) {
                // Easier to build up a snapshot, since what we're given has more than twice the elements we want
                filtered = ChildrenNode.EMPTY_NODE.withIndex(this.index_);
                // anchor to the startPost, endPost, or last element as appropriate
                let iterator;
                if (this.reverse_) {
                    iterator = newSnap.getReverseIteratorFrom(this.rangedFilter_.getEndPost(), this.index_);
                }
                else {
                    iterator = newSnap.getIteratorFrom(this.rangedFilter_.getStartPost(), this.index_);
                }
                let count = 0;
                while (iterator.hasNext() && count < this.limit_) {
                    const next = iterator.getNext();
                    if (!this.withinDirectionalStart(next)) {
                        // if we have not reached the start, skip to the next element
                        continue;
                    }
                    else if (!this.withinDirectionalEnd(next)) {
                        // if we have reached the end, stop adding elements
                        break;
                    }
                    else {
                        filtered = filtered.updateImmediateChild(next.name, next.node);
                        count++;
                    }
                }
            }
            else {
                // The snap contains less than twice the limit. Faster to delete from the snap than build up a new one
                filtered = newSnap.withIndex(this.index_);
                // Don't support priorities on queries
                filtered = filtered.updatePriority(ChildrenNode.EMPTY_NODE);
                let iterator;
                if (this.reverse_) {
                    iterator = filtered.getReverseIterator(this.index_);
                }
                else {
                    iterator = filtered.getIterator(this.index_);
                }
                let count = 0;
                while (iterator.hasNext()) {
                    const next = iterator.getNext();
                    const inRange = count < this.limit_ &&
                        this.withinDirectionalStart(next) &&
                        this.withinDirectionalEnd(next);
                    if (inRange) {
                        count++;
                    }
                    else {
                        filtered = filtered.updateImmediateChild(next.name, ChildrenNode.EMPTY_NODE);
                    }
                }
            }
        }
        return this.rangedFilter_
            .getIndexedFilter()
            .updateFullNode(oldSnap, filtered, optChangeAccumulator);
    }
    updatePriority(oldSnap, newPriority) {
        // Don't support priorities on queries
        return oldSnap;
    }
    filtersNodes() {
        return true;
    }
    getIndexedFilter() {
        return this.rangedFilter_.getIndexedFilter();
    }
    getIndex() {
        return this.index_;
    }
    fullLimitUpdateChild_(snap, childKey, childSnap, source, changeAccumulator) {
        // TODO: rename all cache stuff etc to general snap terminology
        let cmp;
        if (this.reverse_) {
            const indexCmp = this.index_.getCompare();
            cmp = (a, b) => indexCmp(b, a);
        }
        else {
            cmp = this.index_.getCompare();
        }
        const oldEventCache = snap;
        util.assert(oldEventCache.numChildren() === this.limit_, '');
        const newChildNamedNode = new NamedNode(childKey, childSnap);
        const windowBoundary = this.reverse_
            ? oldEventCache.getFirstChild(this.index_)
            : oldEventCache.getLastChild(this.index_);
        const inRange = this.rangedFilter_.matches(newChildNamedNode);
        if (oldEventCache.hasChild(childKey)) {
            const oldChildSnap = oldEventCache.getImmediateChild(childKey);
            let nextChild = source.getChildAfterChild(this.index_, windowBoundary, this.reverse_);
            while (nextChild != null &&
                (nextChild.name === childKey || oldEventCache.hasChild(nextChild.name))) {
                // There is a weird edge case where a node is updated as part of a merge in the write tree, but hasn't
                // been applied to the limited filter yet. Ignore this next child which will be updated later in
                // the limited filter...
                nextChild = source.getChildAfterChild(this.index_, nextChild, this.reverse_);
            }
            const compareNext = nextChild == null ? 1 : cmp(nextChild, newChildNamedNode);
            const remainsInWindow = inRange && !childSnap.isEmpty() && compareNext >= 0;
            if (remainsInWindow) {
                if (changeAccumulator != null) {
                    changeAccumulator.trackChildChange(changeChildChanged(childKey, childSnap, oldChildSnap));
                }
                return oldEventCache.updateImmediateChild(childKey, childSnap);
            }
            else {
                if (changeAccumulator != null) {
                    changeAccumulator.trackChildChange(changeChildRemoved(childKey, oldChildSnap));
                }
                const newEventCache = oldEventCache.updateImmediateChild(childKey, ChildrenNode.EMPTY_NODE);
                const nextChildInRange = nextChild != null && this.rangedFilter_.matches(nextChild);
                if (nextChildInRange) {
                    if (changeAccumulator != null) {
                        changeAccumulator.trackChildChange(changeChildAdded(nextChild.name, nextChild.node));
                    }
                    return newEventCache.updateImmediateChild(nextChild.name, nextChild.node);
                }
                else {
                    return newEventCache;
                }
            }
        }
        else if (childSnap.isEmpty()) {
            // we're deleting a node, but it was not in the window, so ignore it
            return snap;
        }
        else if (inRange) {
            if (cmp(windowBoundary, newChildNamedNode) >= 0) {
                if (changeAccumulator != null) {
                    changeAccumulator.trackChildChange(changeChildRemoved(windowBoundary.name, windowBoundary.node));
                    changeAccumulator.trackChildChange(changeChildAdded(childKey, childSnap));
                }
                return oldEventCache
                    .updateImmediateChild(childKey, childSnap)
                    .updateImmediateChild(windowBoundary.name, ChildrenNode.EMPTY_NODE);
            }
            else {
                return snap;
            }
        }
        else {
            return snap;
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * This class is an immutable-from-the-public-api struct containing a set of query parameters defining a
 * range to be returned for a particular location. It is assumed that validation of parameters is done at the
 * user-facing API level, so it is not done here.
 *
 * @internal
 */
class QueryParams {
    constructor() {
        this.limitSet_ = false;
        this.startSet_ = false;
        this.startNameSet_ = false;
        this.startAfterSet_ = false; // can only be true if startSet_ is true
        this.endSet_ = false;
        this.endNameSet_ = false;
        this.endBeforeSet_ = false; // can only be true if endSet_ is true
        this.limit_ = 0;
        this.viewFrom_ = '';
        this.indexStartValue_ = null;
        this.indexStartName_ = '';
        this.indexEndValue_ = null;
        this.indexEndName_ = '';
        this.index_ = PRIORITY_INDEX;
    }
    hasStart() {
        return this.startSet_;
    }
    /**
     * @returns True if it would return from left.
     */
    isViewFromLeft() {
        if (this.viewFrom_ === '') {
            // limit(), rather than limitToFirst or limitToLast was called.
            // This means that only one of startSet_ and endSet_ is true. Use them
            // to calculate which side of the view to anchor to. If neither is set,
            // anchor to the end.
            return this.startSet_;
        }
        else {
            return this.viewFrom_ === "l" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_LEFT */;
        }
    }
    /**
     * Only valid to call if hasStart() returns true
     */
    getIndexStartValue() {
        util.assert(this.startSet_, 'Only valid if start has been set');
        return this.indexStartValue_;
    }
    /**
     * Only valid to call if hasStart() returns true.
     * Returns the starting key name for the range defined by these query parameters
     */
    getIndexStartName() {
        util.assert(this.startSet_, 'Only valid if start has been set');
        if (this.startNameSet_) {
            return this.indexStartName_;
        }
        else {
            return MIN_NAME;
        }
    }
    hasEnd() {
        return this.endSet_;
    }
    /**
     * Only valid to call if hasEnd() returns true.
     */
    getIndexEndValue() {
        util.assert(this.endSet_, 'Only valid if end has been set');
        return this.indexEndValue_;
    }
    /**
     * Only valid to call if hasEnd() returns true.
     * Returns the end key name for the range defined by these query parameters
     */
    getIndexEndName() {
        util.assert(this.endSet_, 'Only valid if end has been set');
        if (this.endNameSet_) {
            return this.indexEndName_;
        }
        else {
            return MAX_NAME;
        }
    }
    hasLimit() {
        return this.limitSet_;
    }
    /**
     * @returns True if a limit has been set and it has been explicitly anchored
     */
    hasAnchoredLimit() {
        return this.limitSet_ && this.viewFrom_ !== '';
    }
    /**
     * Only valid to call if hasLimit() returns true
     */
    getLimit() {
        util.assert(this.limitSet_, 'Only valid if limit has been set');
        return this.limit_;
    }
    getIndex() {
        return this.index_;
    }
    loadsAllData() {
        return !(this.startSet_ || this.endSet_ || this.limitSet_);
    }
    isDefault() {
        return this.loadsAllData() && this.index_ === PRIORITY_INDEX;
    }
    copy() {
        const copy = new QueryParams();
        copy.limitSet_ = this.limitSet_;
        copy.limit_ = this.limit_;
        copy.startSet_ = this.startSet_;
        copy.startAfterSet_ = this.startAfterSet_;
        copy.indexStartValue_ = this.indexStartValue_;
        copy.startNameSet_ = this.startNameSet_;
        copy.indexStartName_ = this.indexStartName_;
        copy.endSet_ = this.endSet_;
        copy.endBeforeSet_ = this.endBeforeSet_;
        copy.indexEndValue_ = this.indexEndValue_;
        copy.endNameSet_ = this.endNameSet_;
        copy.indexEndName_ = this.indexEndName_;
        copy.index_ = this.index_;
        copy.viewFrom_ = this.viewFrom_;
        return copy;
    }
}
function queryParamsGetNodeFilter(queryParams) {
    if (queryParams.loadsAllData()) {
        return new IndexedFilter(queryParams.getIndex());
    }
    else if (queryParams.hasLimit()) {
        return new LimitedFilter(queryParams);
    }
    else {
        return new RangedFilter(queryParams);
    }
}
function queryParamsLimitToFirst(queryParams, newLimit) {
    const newParams = queryParams.copy();
    newParams.limitSet_ = true;
    newParams.limit_ = newLimit;
    newParams.viewFrom_ = "l" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_LEFT */;
    return newParams;
}
function queryParamsLimitToLast(queryParams, newLimit) {
    const newParams = queryParams.copy();
    newParams.limitSet_ = true;
    newParams.limit_ = newLimit;
    newParams.viewFrom_ = "r" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_RIGHT */;
    return newParams;
}
function queryParamsStartAt(queryParams, indexValue, key) {
    const newParams = queryParams.copy();
    newParams.startSet_ = true;
    if (indexValue === undefined) {
        indexValue = null;
    }
    newParams.indexStartValue_ = indexValue;
    if (key != null) {
        newParams.startNameSet_ = true;
        newParams.indexStartName_ = key;
    }
    else {
        newParams.startNameSet_ = false;
        newParams.indexStartName_ = '';
    }
    return newParams;
}
function queryParamsStartAfter(queryParams, indexValue, key) {
    let params;
    if (queryParams.index_ === KEY_INDEX || !!key) {
        params = queryParamsStartAt(queryParams, indexValue, key);
    }
    else {
        params = queryParamsStartAt(queryParams, indexValue, MAX_NAME);
    }
    params.startAfterSet_ = true;
    return params;
}
function queryParamsEndAt(queryParams, indexValue, key) {
    const newParams = queryParams.copy();
    newParams.endSet_ = true;
    if (indexValue === undefined) {
        indexValue = null;
    }
    newParams.indexEndValue_ = indexValue;
    if (key !== undefined) {
        newParams.endNameSet_ = true;
        newParams.indexEndName_ = key;
    }
    else {
        newParams.endNameSet_ = false;
        newParams.indexEndName_ = '';
    }
    return newParams;
}
function queryParamsEndBefore(queryParams, indexValue, key) {
    let params;
    if (queryParams.index_ === KEY_INDEX || !!key) {
        params = queryParamsEndAt(queryParams, indexValue, key);
    }
    else {
        params = queryParamsEndAt(queryParams, indexValue, MIN_NAME);
    }
    params.endBeforeSet_ = true;
    return params;
}
function queryParamsOrderBy(queryParams, index) {
    const newParams = queryParams.copy();
    newParams.index_ = index;
    return newParams;
}
/**
 * Returns a set of REST query string parameters representing this query.
 *
 * @returns query string parameters
 */
function queryParamsToRestQueryStringParameters(queryParams) {
    const qs = {};
    if (queryParams.isDefault()) {
        return qs;
    }
    let orderBy;
    if (queryParams.index_ === PRIORITY_INDEX) {
        orderBy = "$priority" /* REST_QUERY_CONSTANTS.PRIORITY_INDEX */;
    }
    else if (queryParams.index_ === VALUE_INDEX) {
        orderBy = "$value" /* REST_QUERY_CONSTANTS.VALUE_INDEX */;
    }
    else if (queryParams.index_ === KEY_INDEX) {
        orderBy = "$key" /* REST_QUERY_CONSTANTS.KEY_INDEX */;
    }
    else {
        util.assert(queryParams.index_ instanceof PathIndex, 'Unrecognized index type!');
        orderBy = queryParams.index_.toString();
    }
    qs["orderBy" /* REST_QUERY_CONSTANTS.ORDER_BY */] = util.stringify(orderBy);
    if (queryParams.startSet_) {
        const startParam = queryParams.startAfterSet_
            ? "startAfter" /* REST_QUERY_CONSTANTS.START_AFTER */
            : "startAt" /* REST_QUERY_CONSTANTS.START_AT */;
        qs[startParam] = util.stringify(queryParams.indexStartValue_);
        if (queryParams.startNameSet_) {
            qs[startParam] += ',' + util.stringify(queryParams.indexStartName_);
        }
    }
    if (queryParams.endSet_) {
        const endParam = queryParams.endBeforeSet_
            ? "endBefore" /* REST_QUERY_CONSTANTS.END_BEFORE */
            : "endAt" /* REST_QUERY_CONSTANTS.END_AT */;
        qs[endParam] = util.stringify(queryParams.indexEndValue_);
        if (queryParams.endNameSet_) {
            qs[endParam] += ',' + util.stringify(queryParams.indexEndName_);
        }
    }
    if (queryParams.limitSet_) {
        if (queryParams.isViewFromLeft()) {
            qs["limitToFirst" /* REST_QUERY_CONSTANTS.LIMIT_TO_FIRST */] = queryParams.limit_;
        }
        else {
            qs["limitToLast" /* REST_QUERY_CONSTANTS.LIMIT_TO_LAST */] = queryParams.limit_;
        }
    }
    return qs;
}
function queryParamsGetQueryObject(queryParams) {
    const obj = {};
    if (queryParams.startSet_) {
        obj["sp" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_VALUE */] =
            queryParams.indexStartValue_;
        if (queryParams.startNameSet_) {
            obj["sn" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_NAME */] =
                queryParams.indexStartName_;
        }
        obj["sin" /* WIRE_PROTOCOL_CONSTANTS.INDEX_START_IS_INCLUSIVE */] =
            !queryParams.startAfterSet_;
    }
    if (queryParams.endSet_) {
        obj["ep" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_VALUE */] = queryParams.indexEndValue_;
        if (queryParams.endNameSet_) {
            obj["en" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_NAME */] = queryParams.indexEndName_;
        }
        obj["ein" /* WIRE_PROTOCOL_CONSTANTS.INDEX_END_IS_INCLUSIVE */] =
            !queryParams.endBeforeSet_;
    }
    if (queryParams.limitSet_) {
        obj["l" /* WIRE_PROTOCOL_CONSTANTS.LIMIT */] = queryParams.limit_;
        let viewFrom = queryParams.viewFrom_;
        if (viewFrom === '') {
            if (queryParams.isViewFromLeft()) {
                viewFrom = "l" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_LEFT */;
            }
            else {
                viewFrom = "r" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM_RIGHT */;
            }
        }
        obj["vf" /* WIRE_PROTOCOL_CONSTANTS.VIEW_FROM */] = viewFrom;
    }
    // For now, priority index is the default, so we only specify if it's some other index
    if (queryParams.index_ !== PRIORITY_INDEX) {
        obj["i" /* WIRE_PROTOCOL_CONSTANTS.INDEX */] = queryParams.index_.toString();
    }
    return obj;
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An implementation of ServerActions that communicates with the server via REST requests.
 * This is mostly useful for compatibility with crawlers, where we don't want to spin up a full
 * persistent connection (using WebSockets or long-polling)
 */
class ReadonlyRestClient extends ServerActions {
    reportStats(stats) {
        throw new Error('Method not implemented.');
    }
    static getListenId_(query, tag) {
        if (tag !== undefined) {
            return 'tag$' + tag;
        }
        else {
            util.assert(query._queryParams.isDefault(), "should have a tag if it's not a default query.");
            return query._path.toString();
        }
    }
    /**
     * @param repoInfo_ - Data about the namespace we are connecting to
     * @param onDataUpdate_ - A callback for new data from the server
     */
    constructor(repoInfo_, onDataUpdate_, authTokenProvider_, appCheckTokenProvider_) {
        super();
        this.repoInfo_ = repoInfo_;
        this.onDataUpdate_ = onDataUpdate_;
        this.authTokenProvider_ = authTokenProvider_;
        this.appCheckTokenProvider_ = appCheckTokenProvider_;
        /** @private {function(...[*])} */
        this.log_ = logWrapper('p:rest:');
        /**
         * We don't actually need to track listens, except to prevent us calling an onComplete for a listen
         * that's been removed. :-/
         */
        this.listens_ = {};
    }
    /** @inheritDoc */
    listen(query, currentHashFn, tag, onComplete) {
        const pathString = query._path.toString();
        this.log_('Listen called for ' + pathString + ' ' + query._queryIdentifier);
        // Mark this listener so we can tell if it's removed.
        const listenId = ReadonlyRestClient.getListenId_(query, tag);
        const thisListen = {};
        this.listens_[listenId] = thisListen;
        const queryStringParameters = queryParamsToRestQueryStringParameters(query._queryParams);
        this.restRequest_(pathString + '.json', queryStringParameters, (error, result) => {
            let data = result;
            if (error === 404) {
                data = null;
                error = null;
            }
            if (error === null) {
                this.onDataUpdate_(pathString, data, /*isMerge=*/ false, tag);
            }
            if (util.safeGet(this.listens_, listenId) === thisListen) {
                let status;
                if (!error) {
                    status = 'ok';
                }
                else if (error === 401) {
                    status = 'permission_denied';
                }
                else {
                    status = 'rest_error:' + error;
                }
                onComplete(status, null);
            }
        });
    }
    /** @inheritDoc */
    unlisten(query, tag) {
        const listenId = ReadonlyRestClient.getListenId_(query, tag);
        delete this.listens_[listenId];
    }
    get(query) {
        const queryStringParameters = queryParamsToRestQueryStringParameters(query._queryParams);
        const pathString = query._path.toString();
        const deferred = new util.Deferred();
        this.restRequest_(pathString + '.json', queryStringParameters, (error, result) => {
            let data = result;
            if (error === 404) {
                data = null;
                error = null;
            }
            if (error === null) {
                this.onDataUpdate_(pathString, data, 
                /*isMerge=*/ false, 
                /*tag=*/ null);
                deferred.resolve(data);
            }
            else {
                deferred.reject(new Error(data));
            }
        });
        return deferred.promise;
    }
    /** @inheritDoc */
    refreshAuthToken(token) {
        // no-op since we just always call getToken.
    }
    /**
     * Performs a REST request to the given path, with the provided query string parameters,
     * and any auth credentials we have.
     */
    restRequest_(pathString, queryStringParameters = {}, callback) {
        queryStringParameters['format'] = 'export';
        return Promise.all([
            this.authTokenProvider_.getToken(/*forceRefresh=*/ false),
            this.appCheckTokenProvider_.getToken(/*forceRefresh=*/ false)
        ]).then(([authToken, appCheckToken]) => {
            if (authToken && authToken.accessToken) {
                queryStringParameters['auth'] = authToken.accessToken;
            }
            if (appCheckToken && appCheckToken.token) {
                queryStringParameters['ac'] = appCheckToken.token;
            }
            const url = (this.repoInfo_.secure ? 'https://' : 'http://') +
                this.repoInfo_.host +
                pathString +
                '?' +
                'ns=' +
                this.repoInfo_.namespace +
                util.querystring(queryStringParameters);
            this.log_('Sending REST request for ' + url);
            const xhr = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (callback && xhr.readyState === 4) {
                    this.log_('REST Response for ' + url + ' received. status:', xhr.status, 'response:', xhr.responseText);
                    let res = null;
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            res = util.jsonEval(xhr.responseText);
                        }
                        catch (e) {
                            warn$1('Failed to parse JSON response for ' +
                                url +
                                ': ' +
                                xhr.responseText);
                        }
                        callback(null, res);
                    }
                    else {
                        // 401 and 404 are expected.
                        if (xhr.status !== 401 && xhr.status !== 404) {
                            warn$1('Got unsuccessful REST response for ' +
                                url +
                                ' Status: ' +
                                xhr.status);
                        }
                        callback(xhr.status);
                    }
                    callback = null;
                }
            };
            xhr.open('GET', url, /*asynchronous=*/ true);
            xhr.send();
        });
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Mutable object which basically just stores a reference to the "latest" immutable snapshot.
 */
class SnapshotHolder {
    constructor() {
        this.rootNode_ = ChildrenNode.EMPTY_NODE;
    }
    getNode(path) {
        return this.rootNode_.getChild(path);
    }
    updateSnapshot(path, newSnapshotNode) {
        this.rootNode_ = this.rootNode_.updateChild(path, newSnapshotNode);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function newSparseSnapshotTree() {
    return {
        value: null,
        children: new Map()
    };
}
/**
 * Stores the given node at the specified path. If there is already a node
 * at a shallower path, it merges the new data into that snapshot node.
 *
 * @param path - Path to look up snapshot for.
 * @param data - The new data, or null.
 */
function sparseSnapshotTreeRemember(sparseSnapshotTree, path, data) {
    if (pathIsEmpty(path)) {
        sparseSnapshotTree.value = data;
        sparseSnapshotTree.children.clear();
    }
    else if (sparseSnapshotTree.value !== null) {
        sparseSnapshotTree.value = sparseSnapshotTree.value.updateChild(path, data);
    }
    else {
        const childKey = pathGetFront(path);
        if (!sparseSnapshotTree.children.has(childKey)) {
            sparseSnapshotTree.children.set(childKey, newSparseSnapshotTree());
        }
        const child = sparseSnapshotTree.children.get(childKey);
        path = pathPopFront(path);
        sparseSnapshotTreeRemember(child, path, data);
    }
}
/**
 * Purge the data at path from the cache.
 *
 * @param path - Path to look up snapshot for.
 * @returns True if this node should now be removed.
 */
function sparseSnapshotTreeForget(sparseSnapshotTree, path) {
    if (pathIsEmpty(path)) {
        sparseSnapshotTree.value = null;
        sparseSnapshotTree.children.clear();
        return true;
    }
    else {
        if (sparseSnapshotTree.value !== null) {
            if (sparseSnapshotTree.value.isLeafNode()) {
                // We're trying to forget a node that doesn't exist
                return false;
            }
            else {
                const value = sparseSnapshotTree.value;
                sparseSnapshotTree.value = null;
                value.forEachChild(PRIORITY_INDEX, (key, tree) => {
                    sparseSnapshotTreeRemember(sparseSnapshotTree, new Path(key), tree);
                });
                return sparseSnapshotTreeForget(sparseSnapshotTree, path);
            }
        }
        else if (sparseSnapshotTree.children.size > 0) {
            const childKey = pathGetFront(path);
            path = pathPopFront(path);
            if (sparseSnapshotTree.children.has(childKey)) {
                const safeToRemove = sparseSnapshotTreeForget(sparseSnapshotTree.children.get(childKey), path);
                if (safeToRemove) {
                    sparseSnapshotTree.children.delete(childKey);
                }
            }
            return sparseSnapshotTree.children.size === 0;
        }
        else {
            return true;
        }
    }
}
/**
 * Recursively iterates through all of the stored tree and calls the
 * callback on each one.
 *
 * @param prefixPath - Path to look up node for.
 * @param func - The function to invoke for each tree.
 */
function sparseSnapshotTreeForEachTree(sparseSnapshotTree, prefixPath, func) {
    if (sparseSnapshotTree.value !== null) {
        func(prefixPath, sparseSnapshotTree.value);
    }
    else {
        sparseSnapshotTreeForEachChild(sparseSnapshotTree, (key, tree) => {
            const path = new Path(prefixPath.toString() + '/' + key);
            sparseSnapshotTreeForEachTree(tree, path, func);
        });
    }
}
/**
 * Iterates through each immediate child and triggers the callback.
 * Only seems to be used in tests.
 *
 * @param func - The function to invoke for each child.
 */
function sparseSnapshotTreeForEachChild(sparseSnapshotTree, func) {
    sparseSnapshotTree.children.forEach((tree, key) => {
        func(key, tree);
    });
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Returns the delta from the previous call to get stats.
 *
 * @param collection_ - The collection to "listen" to.
 */
class StatsListener {
    constructor(collection_) {
        this.collection_ = collection_;
        this.last_ = null;
    }
    get() {
        const newStats = this.collection_.get();
        const delta = { ...newStats };
        if (this.last_) {
            each(this.last_, (stat, value) => {
                delta[stat] = delta[stat] - value;
            });
        }
        this.last_ = newStats;
        return delta;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Assuming some apps may have a short amount of time on page, and a bulk of firebase operations probably
// happen on page load, we try to report our first set of stats pretty quickly, but we wait at least 10
// seconds to try to ensure the Firebase connection is established / settled.
const FIRST_STATS_MIN_TIME = 10 * 1000;
const FIRST_STATS_MAX_TIME = 30 * 1000;
// We'll continue to report stats on average every 5 minutes.
const REPORT_STATS_INTERVAL = 5 * 60 * 1000;
class StatsReporter {
    constructor(collection, server_) {
        this.server_ = server_;
        this.statsToReport_ = {};
        this.statsListener_ = new StatsListener(collection);
        const timeout = FIRST_STATS_MIN_TIME +
            (FIRST_STATS_MAX_TIME - FIRST_STATS_MIN_TIME) * Math.random();
        setTimeoutNonBlocking(this.reportStats_.bind(this), Math.floor(timeout));
    }
    reportStats_() {
        const stats = this.statsListener_.get();
        const reportedStats = {};
        let haveStatsToReport = false;
        each(stats, (stat, value) => {
            if (value > 0 && util.contains(this.statsToReport_, stat)) {
                reportedStats[stat] = value;
                haveStatsToReport = true;
            }
        });
        if (haveStatsToReport) {
            this.server_.reportStats(reportedStats);
        }
        // queue our next run.
        setTimeoutNonBlocking(this.reportStats_.bind(this), Math.floor(Math.random() * 2 * REPORT_STATS_INTERVAL));
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 *
 * @enum
 */
var OperationType;
(function (OperationType) {
    OperationType[OperationType["OVERWRITE"] = 0] = "OVERWRITE";
    OperationType[OperationType["MERGE"] = 1] = "MERGE";
    OperationType[OperationType["ACK_USER_WRITE"] = 2] = "ACK_USER_WRITE";
    OperationType[OperationType["LISTEN_COMPLETE"] = 3] = "LISTEN_COMPLETE";
})(OperationType || (OperationType = {}));
function newOperationSourceUser() {
    return {
        fromUser: true,
        fromServer: false,
        queryId: null,
        tagged: false
    };
}
function newOperationSourceServer() {
    return {
        fromUser: false,
        fromServer: true,
        queryId: null,
        tagged: false
    };
}
function newOperationSourceServerTaggedQuery(queryId) {
    return {
        fromUser: false,
        fromServer: true,
        queryId,
        tagged: true
    };
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class AckUserWrite {
    /**
     * @param affectedTree - A tree containing true for each affected path. Affected paths can't overlap.
     */
    constructor(
    /** @inheritDoc */ path, 
    /** @inheritDoc */ affectedTree, 
    /** @inheritDoc */ revert) {
        this.path = path;
        this.affectedTree = affectedTree;
        this.revert = revert;
        /** @inheritDoc */
        this.type = OperationType.ACK_USER_WRITE;
        /** @inheritDoc */
        this.source = newOperationSourceUser();
    }
    operationForChild(childName) {
        if (!pathIsEmpty(this.path)) {
            util.assert(pathGetFront(this.path) === childName, 'operationForChild called for unrelated child.');
            return new AckUserWrite(pathPopFront(this.path), this.affectedTree, this.revert);
        }
        else if (this.affectedTree.value != null) {
            util.assert(this.affectedTree.children.isEmpty(), 'affectedTree should not have overlapping affected paths.');
            // All child locations are affected as well; just return same operation.
            return this;
        }
        else {
            const childTree = this.affectedTree.subtree(new Path(childName));
            return new AckUserWrite(newEmptyPath(), childTree, this.revert);
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class ListenComplete {
    constructor(source, path) {
        this.source = source;
        this.path = path;
        /** @inheritDoc */
        this.type = OperationType.LISTEN_COMPLETE;
    }
    operationForChild(childName) {
        if (pathIsEmpty(this.path)) {
            return new ListenComplete(this.source, newEmptyPath());
        }
        else {
            return new ListenComplete(this.source, pathPopFront(this.path));
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Overwrite {
    constructor(source, path, snap) {
        this.source = source;
        this.path = path;
        this.snap = snap;
        /** @inheritDoc */
        this.type = OperationType.OVERWRITE;
    }
    operationForChild(childName) {
        if (pathIsEmpty(this.path)) {
            return new Overwrite(this.source, newEmptyPath(), this.snap.getImmediateChild(childName));
        }
        else {
            return new Overwrite(this.source, pathPopFront(this.path), this.snap);
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class Merge {
    constructor(
    /** @inheritDoc */ source, 
    /** @inheritDoc */ path, 
    /** @inheritDoc */ children) {
        this.source = source;
        this.path = path;
        this.children = children;
        /** @inheritDoc */
        this.type = OperationType.MERGE;
    }
    operationForChild(childName) {
        if (pathIsEmpty(this.path)) {
            const childTree = this.children.subtree(new Path(childName));
            if (childTree.isEmpty()) {
                // This child is unaffected
                return null;
            }
            else if (childTree.value) {
                // We have a snapshot for the child in question.  This becomes an overwrite of the child.
                return new Overwrite(this.source, newEmptyPath(), childTree.value);
            }
            else {
                // This is a merge at a deeper level
                return new Merge(this.source, newEmptyPath(), childTree);
            }
        }
        else {
            util.assert(pathGetFront(this.path) === childName, "Can't get a merge for a child not on the path of the operation");
            return new Merge(this.source, pathPopFront(this.path), this.children);
        }
    }
    toString() {
        return ('Operation(' +
            this.path +
            ': ' +
            this.source.toString() +
            ' merge: ' +
            this.children.toString() +
            ')');
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A cache node only stores complete children. Additionally it holds a flag whether the node can be considered fully
 * initialized in the sense that we know at one point in time this represented a valid state of the world, e.g.
 * initialized with data from the server, or a complete overwrite by the client. The filtered flag also tracks
 * whether a node potentially had children removed due to a filter.
 */
class CacheNode {
    constructor(node_, fullyInitialized_, filtered_) {
        this.node_ = node_;
        this.fullyInitialized_ = fullyInitialized_;
        this.filtered_ = filtered_;
    }
    /**
     * Returns whether this node was fully initialized with either server data or a complete overwrite by the client
     */
    isFullyInitialized() {
        return this.fullyInitialized_;
    }
    /**
     * Returns whether this node is potentially missing children due to a filter applied to the node
     */
    isFiltered() {
        return this.filtered_;
    }
    isCompleteForPath(path) {
        if (pathIsEmpty(path)) {
            return this.isFullyInitialized() && !this.filtered_;
        }
        const childKey = pathGetFront(path);
        return this.isCompleteForChild(childKey);
    }
    isCompleteForChild(key) {
        return ((this.isFullyInitialized() && !this.filtered_) || this.node_.hasChild(key));
    }
    getNode() {
        return this.node_;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An EventGenerator is used to convert "raw" changes (Change) as computed by the
 * CacheDiffer into actual events (Event) that can be raised.  See generateEventsForChanges()
 * for details.
 *
 */
class EventGenerator {
    constructor(query_) {
        this.query_ = query_;
        this.index_ = this.query_._queryParams.getIndex();
    }
}
/**
 * Given a set of raw changes (no moved events and prevName not specified yet), and a set of
 * EventRegistrations that should be notified of these changes, generate the actual events to be raised.
 *
 * Notes:
 *  - child_moved events will be synthesized at this time for any child_changed events that affect
 *    our index.
 *  - prevName will be calculated based on the index ordering.
 */
function eventGeneratorGenerateEventsForChanges(eventGenerator, changes, eventCache, eventRegistrations) {
    const events = [];
    const moves = [];
    changes.forEach(change => {
        if (change.type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
            eventGenerator.index_.indexedValueChanged(change.oldSnap, change.snapshotNode)) {
            moves.push(changeChildMoved(change.childName, change.snapshotNode));
        }
    });
    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_removed" /* ChangeType.CHILD_REMOVED */, changes, eventRegistrations, eventCache);
    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_added" /* ChangeType.CHILD_ADDED */, changes, eventRegistrations, eventCache);
    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_moved" /* ChangeType.CHILD_MOVED */, moves, eventRegistrations, eventCache);
    eventGeneratorGenerateEventsForType(eventGenerator, events, "child_changed" /* ChangeType.CHILD_CHANGED */, changes, eventRegistrations, eventCache);
    eventGeneratorGenerateEventsForType(eventGenerator, events, "value" /* ChangeType.VALUE */, changes, eventRegistrations, eventCache);
    return events;
}
/**
 * Given changes of a single change type, generate the corresponding events.
 */
function eventGeneratorGenerateEventsForType(eventGenerator, events, eventType, changes, registrations, eventCache) {
    const filteredChanges = changes.filter(change => change.type === eventType);
    filteredChanges.sort((a, b) => eventGeneratorCompareChanges(eventGenerator, a, b));
    filteredChanges.forEach(change => {
        const materializedChange = eventGeneratorMaterializeSingleChange(eventGenerator, change, eventCache);
        registrations.forEach(registration => {
            if (registration.respondsTo(change.type)) {
                events.push(registration.createEvent(materializedChange, eventGenerator.query_));
            }
        });
    });
}
function eventGeneratorMaterializeSingleChange(eventGenerator, change, eventCache) {
    if (change.type === 'value' || change.type === 'child_removed') {
        return change;
    }
    else {
        change.prevName = eventCache.getPredecessorChildName(change.childName, change.snapshotNode, eventGenerator.index_);
        return change;
    }
}
function eventGeneratorCompareChanges(eventGenerator, a, b) {
    if (a.childName == null || b.childName == null) {
        throw util.assertionError('Should only compare child_ events.');
    }
    const aWrapped = new NamedNode(a.childName, a.snapshotNode);
    const bWrapped = new NamedNode(b.childName, b.snapshotNode);
    return eventGenerator.index_.compare(aWrapped, bWrapped);
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function newViewCache(eventCache, serverCache) {
    return { eventCache, serverCache };
}
function viewCacheUpdateEventSnap(viewCache, eventSnap, complete, filtered) {
    return newViewCache(new CacheNode(eventSnap, complete, filtered), viewCache.serverCache);
}
function viewCacheUpdateServerSnap(viewCache, serverSnap, complete, filtered) {
    return newViewCache(viewCache.eventCache, new CacheNode(serverSnap, complete, filtered));
}
function viewCacheGetCompleteEventSnap(viewCache) {
    return viewCache.eventCache.isFullyInitialized()
        ? viewCache.eventCache.getNode()
        : null;
}
function viewCacheGetCompleteServerSnap(viewCache) {
    return viewCache.serverCache.isFullyInitialized()
        ? viewCache.serverCache.getNode()
        : null;
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let emptyChildrenSingleton;
/**
 * Singleton empty children collection.
 *
 */
const EmptyChildren = () => {
    if (!emptyChildrenSingleton) {
        emptyChildrenSingleton = new SortedMap(stringCompare);
    }
    return emptyChildrenSingleton;
};
/**
 * A tree with immutable elements.
 */
class ImmutableTree {
    static fromObject(obj) {
        let tree = new ImmutableTree(null);
        each(obj, (childPath, childSnap) => {
            tree = tree.set(new Path(childPath), childSnap);
        });
        return tree;
    }
    constructor(value, children = EmptyChildren()) {
        this.value = value;
        this.children = children;
    }
    /**
     * True if the value is empty and there are no children
     */
    isEmpty() {
        return this.value === null && this.children.isEmpty();
    }
    /**
     * Given a path and predicate, return the first node and the path to that node
     * where the predicate returns true.
     *
     * TODO Do a perf test -- If we're creating a bunch of `{path: value:}`
     * objects on the way back out, it may be better to pass down a pathSoFar obj.
     *
     * @param relativePath - The remainder of the path
     * @param predicate - The predicate to satisfy to return a node
     */
    findRootMostMatchingPathAndValue(relativePath, predicate) {
        if (this.value != null && predicate(this.value)) {
            return { path: newEmptyPath(), value: this.value };
        }
        else {
            if (pathIsEmpty(relativePath)) {
                return null;
            }
            else {
                const front = pathGetFront(relativePath);
                const child = this.children.get(front);
                if (child !== null) {
                    const childExistingPathAndValue = child.findRootMostMatchingPathAndValue(pathPopFront(relativePath), predicate);
                    if (childExistingPathAndValue != null) {
                        const fullPath = pathChild(new Path(front), childExistingPathAndValue.path);
                        return { path: fullPath, value: childExistingPathAndValue.value };
                    }
                    else {
                        return null;
                    }
                }
                else {
                    return null;
                }
            }
        }
    }
    /**
     * Find, if it exists, the shortest subpath of the given path that points a defined
     * value in the tree
     */
    findRootMostValueAndPath(relativePath) {
        return this.findRootMostMatchingPathAndValue(relativePath, () => true);
    }
    /**
     * @returns The subtree at the given path
     */
    subtree(relativePath) {
        if (pathIsEmpty(relativePath)) {
            return this;
        }
        else {
            const front = pathGetFront(relativePath);
            const childTree = this.children.get(front);
            if (childTree !== null) {
                return childTree.subtree(pathPopFront(relativePath));
            }
            else {
                return new ImmutableTree(null);
            }
        }
    }
    /**
     * Sets a value at the specified path.
     *
     * @param relativePath - Path to set value at.
     * @param toSet - Value to set.
     * @returns Resulting tree.
     */
    set(relativePath, toSet) {
        if (pathIsEmpty(relativePath)) {
            return new ImmutableTree(toSet, this.children);
        }
        else {
            const front = pathGetFront(relativePath);
            const child = this.children.get(front) || new ImmutableTree(null);
            const newChild = child.set(pathPopFront(relativePath), toSet);
            const newChildren = this.children.insert(front, newChild);
            return new ImmutableTree(this.value, newChildren);
        }
    }
    /**
     * Removes the value at the specified path.
     *
     * @param relativePath - Path to value to remove.
     * @returns Resulting tree.
     */
    remove(relativePath) {
        if (pathIsEmpty(relativePath)) {
            if (this.children.isEmpty()) {
                return new ImmutableTree(null);
            }
            else {
                return new ImmutableTree(null, this.children);
            }
        }
        else {
            const front = pathGetFront(relativePath);
            const child = this.children.get(front);
            if (child) {
                const newChild = child.remove(pathPopFront(relativePath));
                let newChildren;
                if (newChild.isEmpty()) {
                    newChildren = this.children.remove(front);
                }
                else {
                    newChildren = this.children.insert(front, newChild);
                }
                if (this.value === null && newChildren.isEmpty()) {
                    return new ImmutableTree(null);
                }
                else {
                    return new ImmutableTree(this.value, newChildren);
                }
            }
            else {
                return this;
            }
        }
    }
    /**
     * Gets a value from the tree.
     *
     * @param relativePath - Path to get value for.
     * @returns Value at path, or null.
     */
    get(relativePath) {
        if (pathIsEmpty(relativePath)) {
            return this.value;
        }
        else {
            const front = pathGetFront(relativePath);
            const child = this.children.get(front);
            if (child) {
                return child.get(pathPopFront(relativePath));
            }
            else {
                return null;
            }
        }
    }
    /**
     * Replace the subtree at the specified path with the given new tree.
     *
     * @param relativePath - Path to replace subtree for.
     * @param newTree - New tree.
     * @returns Resulting tree.
     */
    setTree(relativePath, newTree) {
        if (pathIsEmpty(relativePath)) {
            return newTree;
        }
        else {
            const front = pathGetFront(relativePath);
            const child = this.children.get(front) || new ImmutableTree(null);
            const newChild = child.setTree(pathPopFront(relativePath), newTree);
            let newChildren;
            if (newChild.isEmpty()) {
                newChildren = this.children.remove(front);
            }
            else {
                newChildren = this.children.insert(front, newChild);
            }
            return new ImmutableTree(this.value, newChildren);
        }
    }
    /**
     * Performs a depth first fold on this tree. Transforms a tree into a single
     * value, given a function that operates on the path to a node, an optional
     * current value, and a map of child names to folded subtrees
     */
    fold(fn) {
        return this.fold_(newEmptyPath(), fn);
    }
    /**
     * Recursive helper for public-facing fold() method
     */
    fold_(pathSoFar, fn) {
        const accum = {};
        this.children.inorderTraversal((childKey, childTree) => {
            accum[childKey] = childTree.fold_(pathChild(pathSoFar, childKey), fn);
        });
        return fn(pathSoFar, this.value, accum);
    }
    /**
     * Find the first matching value on the given path. Return the result of applying f to it.
     */
    findOnPath(path, f) {
        return this.findOnPath_(path, newEmptyPath(), f);
    }
    findOnPath_(pathToFollow, pathSoFar, f) {
        const result = this.value ? f(pathSoFar, this.value) : false;
        if (result) {
            return result;
        }
        else {
            if (pathIsEmpty(pathToFollow)) {
                return null;
            }
            else {
                const front = pathGetFront(pathToFollow);
                const nextChild = this.children.get(front);
                if (nextChild) {
                    return nextChild.findOnPath_(pathPopFront(pathToFollow), pathChild(pathSoFar, front), f);
                }
                else {
                    return null;
                }
            }
        }
    }
    foreachOnPath(path, f) {
        return this.foreachOnPath_(path, newEmptyPath(), f);
    }
    foreachOnPath_(pathToFollow, currentRelativePath, f) {
        if (pathIsEmpty(pathToFollow)) {
            return this;
        }
        else {
            if (this.value) {
                f(currentRelativePath, this.value);
            }
            const front = pathGetFront(pathToFollow);
            const nextChild = this.children.get(front);
            if (nextChild) {
                return nextChild.foreachOnPath_(pathPopFront(pathToFollow), pathChild(currentRelativePath, front), f);
            }
            else {
                return new ImmutableTree(null);
            }
        }
    }
    /**
     * Calls the given function for each node in the tree that has a value.
     *
     * @param f - A function to be called with the path from the root of the tree to
     * a node, and the value at that node. Called in depth-first order.
     */
    foreach(f) {
        this.foreach_(newEmptyPath(), f);
    }
    foreach_(currentRelativePath, f) {
        this.children.inorderTraversal((childName, childTree) => {
            childTree.foreach_(pathChild(currentRelativePath, childName), f);
        });
        if (this.value) {
            f(currentRelativePath, this.value);
        }
    }
    foreachChild(f) {
        this.children.inorderTraversal((childName, childTree) => {
            if (childTree.value) {
                f(childName, childTree.value);
            }
        });
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * This class holds a collection of writes that can be applied to nodes in unison. It abstracts away the logic with
 * dealing with priority writes and multiple nested writes. At any given path there is only allowed to be one write
 * modifying that path. Any write to an existing path or shadowing an existing path will modify that existing write
 * to reflect the write added.
 */
class CompoundWrite {
    constructor(writeTree_) {
        this.writeTree_ = writeTree_;
    }
    static empty() {
        return new CompoundWrite(new ImmutableTree(null));
    }
}
function compoundWriteAddWrite(compoundWrite, path, node) {
    if (pathIsEmpty(path)) {
        return new CompoundWrite(new ImmutableTree(node));
    }
    else {
        const rootmost = compoundWrite.writeTree_.findRootMostValueAndPath(path);
        if (rootmost != null) {
            const rootMostPath = rootmost.path;
            let value = rootmost.value;
            const relativePath = newRelativePath(rootMostPath, path);
            value = value.updateChild(relativePath, node);
            return new CompoundWrite(compoundWrite.writeTree_.set(rootMostPath, value));
        }
        else {
            const subtree = new ImmutableTree(node);
            const newWriteTree = compoundWrite.writeTree_.setTree(path, subtree);
            return new CompoundWrite(newWriteTree);
        }
    }
}
function compoundWriteAddWrites(compoundWrite, path, updates) {
    let newWrite = compoundWrite;
    each(updates, (childKey, node) => {
        newWrite = compoundWriteAddWrite(newWrite, pathChild(path, childKey), node);
    });
    return newWrite;
}
/**
 * Will remove a write at the given path and deeper paths. This will <em>not</em> modify a write at a higher
 * location, which must be removed by calling this method with that path.
 *
 * @param compoundWrite - The CompoundWrite to remove.
 * @param path - The path at which a write and all deeper writes should be removed
 * @returns The new CompoundWrite with the removed path
 */
function compoundWriteRemoveWrite(compoundWrite, path) {
    if (pathIsEmpty(path)) {
        return CompoundWrite.empty();
    }
    else {
        const newWriteTree = compoundWrite.writeTree_.setTree(path, new ImmutableTree(null));
        return new CompoundWrite(newWriteTree);
    }
}
/**
 * Returns whether this CompoundWrite will fully overwrite a node at a given location and can therefore be
 * considered "complete".
 *
 * @param compoundWrite - The CompoundWrite to check.
 * @param path - The path to check for
 * @returns Whether there is a complete write at that path
 */
function compoundWriteHasCompleteWrite(compoundWrite, path) {
    return compoundWriteGetCompleteNode(compoundWrite, path) != null;
}
/**
 * Returns a node for a path if and only if the node is a "complete" overwrite at that path. This will not aggregate
 * writes from deeper paths, but will return child nodes from a more shallow path.
 *
 * @param compoundWrite - The CompoundWrite to get the node from.
 * @param path - The path to get a complete write
 * @returns The node if complete at that path, or null otherwise.
 */
function compoundWriteGetCompleteNode(compoundWrite, path) {
    const rootmost = compoundWrite.writeTree_.findRootMostValueAndPath(path);
    if (rootmost != null) {
        return compoundWrite.writeTree_
            .get(rootmost.path)
            .getChild(newRelativePath(rootmost.path, path));
    }
    else {
        return null;
    }
}
/**
 * Returns all children that are guaranteed to be a complete overwrite.
 *
 * @param compoundWrite - The CompoundWrite to get children from.
 * @returns A list of all complete children.
 */
function compoundWriteGetCompleteChildren(compoundWrite) {
    const children = [];
    const node = compoundWrite.writeTree_.value;
    if (node != null) {
        // If it's a leaf node, it has no children; so nothing to do.
        if (!node.isLeafNode()) {
            node.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
                children.push(new NamedNode(childName, childNode));
            });
        }
    }
    else {
        compoundWrite.writeTree_.children.inorderTraversal((childName, childTree) => {
            if (childTree.value != null) {
                children.push(new NamedNode(childName, childTree.value));
            }
        });
    }
    return children;
}
function compoundWriteChildCompoundWrite(compoundWrite, path) {
    if (pathIsEmpty(path)) {
        return compoundWrite;
    }
    else {
        const shadowingNode = compoundWriteGetCompleteNode(compoundWrite, path);
        if (shadowingNode != null) {
            return new CompoundWrite(new ImmutableTree(shadowingNode));
        }
        else {
            return new CompoundWrite(compoundWrite.writeTree_.subtree(path));
        }
    }
}
/**
 * Returns true if this CompoundWrite is empty and therefore does not modify any nodes.
 * @returns Whether this CompoundWrite is empty
 */
function compoundWriteIsEmpty(compoundWrite) {
    return compoundWrite.writeTree_.isEmpty();
}
/**
 * Applies this CompoundWrite to a node. The node is returned with all writes from this CompoundWrite applied to the
 * node
 * @param node - The node to apply this CompoundWrite to
 * @returns The node with all writes applied
 */
function compoundWriteApply(compoundWrite, node) {
    return applySubtreeWrite(newEmptyPath(), compoundWrite.writeTree_, node);
}
function applySubtreeWrite(relativePath, writeTree, node) {
    if (writeTree.value != null) {
        // Since there a write is always a leaf, we're done here
        return node.updateChild(relativePath, writeTree.value);
    }
    else {
        let priorityWrite = null;
        writeTree.children.inorderTraversal((childKey, childTree) => {
            if (childKey === '.priority') {
                // Apply priorities at the end so we don't update priorities for either empty nodes or forget
                // to apply priorities to empty nodes that are later filled
                util.assert(childTree.value !== null, 'Priority writes must always be leaf nodes');
                priorityWrite = childTree.value;
            }
            else {
                node = applySubtreeWrite(pathChild(relativePath, childKey), childTree, node);
            }
        });
        // If there was a priority write, we only apply it if the node is not empty
        if (!node.getChild(relativePath).isEmpty() && priorityWrite !== null) {
            node = node.updateChild(pathChild(relativePath, '.priority'), priorityWrite);
        }
        return node;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Create a new WriteTreeRef for the given path. For use with a new sync point at the given path.
 *
 */
function writeTreeChildWrites(writeTree, path) {
    return newWriteTreeRef(path, writeTree);
}
/**
 * Record a new overwrite from user code.
 *
 * @param visible - This is set to false by some transactions. It should be excluded from event caches
 */
function writeTreeAddOverwrite(writeTree, path, snap, writeId, visible) {
    util.assert(writeId > writeTree.lastWriteId, 'Stacking an older write on top of newer ones');
    if (visible === undefined) {
        visible = true;
    }
    writeTree.allWrites.push({
        path,
        snap,
        writeId,
        visible
    });
    if (visible) {
        writeTree.visibleWrites = compoundWriteAddWrite(writeTree.visibleWrites, path, snap);
    }
    writeTree.lastWriteId = writeId;
}
/**
 * Record a new merge from user code.
 */
function writeTreeAddMerge(writeTree, path, changedChildren, writeId) {
    util.assert(writeId > writeTree.lastWriteId, 'Stacking an older merge on top of newer ones');
    writeTree.allWrites.push({
        path,
        children: changedChildren,
        writeId,
        visible: true
    });
    writeTree.visibleWrites = compoundWriteAddWrites(writeTree.visibleWrites, path, changedChildren);
    writeTree.lastWriteId = writeId;
}
function writeTreeGetWrite(writeTree, writeId) {
    for (let i = 0; i < writeTree.allWrites.length; i++) {
        const record = writeTree.allWrites[i];
        if (record.writeId === writeId) {
            return record;
        }
    }
    return null;
}
/**
 * Remove a write (either an overwrite or merge) that has been successfully acknowledge by the server. Recalculates
 * the tree if necessary.  We return true if it may have been visible, meaning views need to reevaluate.
 *
 * @returns true if the write may have been visible (meaning we'll need to reevaluate / raise
 * events as a result).
 */
function writeTreeRemoveWrite(writeTree, writeId) {
    // Note: disabling this check. It could be a transaction that preempted another transaction, and thus was applied
    // out of order.
    //const validClear = revert || this.allWrites_.length === 0 || writeId <= this.allWrites_[0].writeId;
    //assert(validClear, "Either we don't have this write, or it's the first one in the queue");
    const idx = writeTree.allWrites.findIndex(s => {
        return s.writeId === writeId;
    });
    util.assert(idx >= 0, 'removeWrite called with nonexistent writeId.');
    const writeToRemove = writeTree.allWrites[idx];
    writeTree.allWrites.splice(idx, 1);
    let removedWriteWasVisible = writeToRemove.visible;
    let removedWriteOverlapsWithOtherWrites = false;
    let i = writeTree.allWrites.length - 1;
    while (removedWriteWasVisible && i >= 0) {
        const currentWrite = writeTree.allWrites[i];
        if (currentWrite.visible) {
            if (i >= idx &&
                writeTreeRecordContainsPath_(currentWrite, writeToRemove.path)) {
                // The removed write was completely shadowed by a subsequent write.
                removedWriteWasVisible = false;
            }
            else if (pathContains(writeToRemove.path, currentWrite.path)) {
                // Either we're covering some writes or they're covering part of us (depending on which came first).
                removedWriteOverlapsWithOtherWrites = true;
            }
        }
        i--;
    }
    if (!removedWriteWasVisible) {
        return false;
    }
    else if (removedWriteOverlapsWithOtherWrites) {
        // There's some shadowing going on. Just rebuild the visible writes from scratch.
        writeTreeResetTree_(writeTree);
        return true;
    }
    else {
        // There's no shadowing.  We can safely just remove the write(s) from visibleWrites.
        if (writeToRemove.snap) {
            writeTree.visibleWrites = compoundWriteRemoveWrite(writeTree.visibleWrites, writeToRemove.path);
        }
        else {
            const children = writeToRemove.children;
            each(children, (childName) => {
                writeTree.visibleWrites = compoundWriteRemoveWrite(writeTree.visibleWrites, pathChild(writeToRemove.path, childName));
            });
        }
        return true;
    }
}
function writeTreeRecordContainsPath_(writeRecord, path) {
    if (writeRecord.snap) {
        return pathContains(writeRecord.path, path);
    }
    else {
        for (const childName in writeRecord.children) {
            if (writeRecord.children.hasOwnProperty(childName) &&
                pathContains(pathChild(writeRecord.path, childName), path)) {
                return true;
            }
        }
        return false;
    }
}
/**
 * Re-layer the writes and merges into a tree so we can efficiently calculate event snapshots
 */
function writeTreeResetTree_(writeTree) {
    writeTree.visibleWrites = writeTreeLayerTree_(writeTree.allWrites, writeTreeDefaultFilter_, newEmptyPath());
    if (writeTree.allWrites.length > 0) {
        writeTree.lastWriteId =
            writeTree.allWrites[writeTree.allWrites.length - 1].writeId;
    }
    else {
        writeTree.lastWriteId = -1;
    }
}
/**
 * The default filter used when constructing the tree. Keep everything that's visible.
 */
function writeTreeDefaultFilter_(write) {
    return write.visible;
}
/**
 * Static method. Given an array of WriteRecords, a filter for which ones to include, and a path, construct the tree of
 * event data at that path.
 */
function writeTreeLayerTree_(writes, filter, treeRoot) {
    let compoundWrite = CompoundWrite.empty();
    for (let i = 0; i < writes.length; ++i) {
        const write = writes[i];
        // Theory, a later set will either:
        // a) abort a relevant transaction, so no need to worry about excluding it from calculating that transaction
        // b) not be relevant to a transaction (separate branch), so again will not affect the data for that transaction
        if (filter(write)) {
            const writePath = write.path;
            let relativePath;
            if (write.snap) {
                if (pathContains(treeRoot, writePath)) {
                    relativePath = newRelativePath(treeRoot, writePath);
                    compoundWrite = compoundWriteAddWrite(compoundWrite, relativePath, write.snap);
                }
                else if (pathContains(writePath, treeRoot)) {
                    relativePath = newRelativePath(writePath, treeRoot);
                    compoundWrite = compoundWriteAddWrite(compoundWrite, newEmptyPath(), write.snap.getChild(relativePath));
                }
                else ;
            }
            else if (write.children) {
                if (pathContains(treeRoot, writePath)) {
                    relativePath = newRelativePath(treeRoot, writePath);
                    compoundWrite = compoundWriteAddWrites(compoundWrite, relativePath, write.children);
                }
                else if (pathContains(writePath, treeRoot)) {
                    relativePath = newRelativePath(writePath, treeRoot);
                    if (pathIsEmpty(relativePath)) {
                        compoundWrite = compoundWriteAddWrites(compoundWrite, newEmptyPath(), write.children);
                    }
                    else {
                        const child = util.safeGet(write.children, pathGetFront(relativePath));
                        if (child) {
                            // There exists a child in this node that matches the root path
                            const deepNode = child.getChild(pathPopFront(relativePath));
                            compoundWrite = compoundWriteAddWrite(compoundWrite, newEmptyPath(), deepNode);
                        }
                    }
                }
                else ;
            }
            else {
                throw util.assertionError('WriteRecord should have .snap or .children');
            }
        }
    }
    return compoundWrite;
}
/**
 * Given optional, underlying server data, and an optional set of constraints (exclude some sets, include hidden
 * writes), attempt to calculate a complete snapshot for the given path
 *
 * @param writeIdsToExclude - An optional set to be excluded
 * @param includeHiddenWrites - Defaults to false, whether or not to layer on writes with visible set to false
 */
function writeTreeCalcCompleteEventCache(writeTree, treePath, completeServerCache, writeIdsToExclude, includeHiddenWrites) {
    if (!writeIdsToExclude && !includeHiddenWrites) {
        const shadowingNode = compoundWriteGetCompleteNode(writeTree.visibleWrites, treePath);
        if (shadowingNode != null) {
            return shadowingNode;
        }
        else {
            const subMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
            if (compoundWriteIsEmpty(subMerge)) {
                return completeServerCache;
            }
            else if (completeServerCache == null &&
                !compoundWriteHasCompleteWrite(subMerge, newEmptyPath())) {
                // We wouldn't have a complete snapshot, since there's no underlying data and no complete shadow
                return null;
            }
            else {
                const layeredCache = completeServerCache || ChildrenNode.EMPTY_NODE;
                return compoundWriteApply(subMerge, layeredCache);
            }
        }
    }
    else {
        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
        if (!includeHiddenWrites && compoundWriteIsEmpty(merge)) {
            return completeServerCache;
        }
        else {
            // If the server cache is null, and we don't have a complete cache, we need to return null
            if (!includeHiddenWrites &&
                completeServerCache == null &&
                !compoundWriteHasCompleteWrite(merge, newEmptyPath())) {
                return null;
            }
            else {
                const filter = function (write) {
                    return ((write.visible || includeHiddenWrites) &&
                        (!writeIdsToExclude ||
                            !~writeIdsToExclude.indexOf(write.writeId)) &&
                        (pathContains(write.path, treePath) ||
                            pathContains(treePath, write.path)));
                };
                const mergeAtPath = writeTreeLayerTree_(writeTree.allWrites, filter, treePath);
                const layeredCache = completeServerCache || ChildrenNode.EMPTY_NODE;
                return compoundWriteApply(mergeAtPath, layeredCache);
            }
        }
    }
}
/**
 * With optional, underlying server data, attempt to return a children node of children that we have complete data for.
 * Used when creating new views, to pre-fill their complete event children snapshot.
 */
function writeTreeCalcCompleteEventChildren(writeTree, treePath, completeServerChildren) {
    let completeChildren = ChildrenNode.EMPTY_NODE;
    const topLevelSet = compoundWriteGetCompleteNode(writeTree.visibleWrites, treePath);
    if (topLevelSet) {
        if (!topLevelSet.isLeafNode()) {
            // we're shadowing everything. Return the children.
            topLevelSet.forEachChild(PRIORITY_INDEX, (childName, childSnap) => {
                completeChildren = completeChildren.updateImmediateChild(childName, childSnap);
            });
        }
        return completeChildren;
    }
    else if (completeServerChildren) {
        // Layer any children we have on top of this
        // We know we don't have a top-level set, so just enumerate existing children
        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
        completeServerChildren.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
            const node = compoundWriteApply(compoundWriteChildCompoundWrite(merge, new Path(childName)), childNode);
            completeChildren = completeChildren.updateImmediateChild(childName, node);
        });
        // Add any complete children we have from the set
        compoundWriteGetCompleteChildren(merge).forEach(namedNode => {
            completeChildren = completeChildren.updateImmediateChild(namedNode.name, namedNode.node);
        });
        return completeChildren;
    }
    else {
        // We don't have anything to layer on top of. Layer on any children we have
        // Note that we can return an empty snap if we have a defined delete
        const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
        compoundWriteGetCompleteChildren(merge).forEach(namedNode => {
            completeChildren = completeChildren.updateImmediateChild(namedNode.name, namedNode.node);
        });
        return completeChildren;
    }
}
/**
 * Given that the underlying server data has updated, determine what, if anything, needs to be
 * applied to the event cache.
 *
 * Possibilities:
 *
 * 1. No writes are shadowing. Events should be raised, the snap to be applied comes from the server data
 *
 * 2. Some write is completely shadowing. No events to be raised
 *
 * 3. Is partially shadowed. Events
 *
 * Either existingEventSnap or existingServerSnap must exist
 */
function writeTreeCalcEventCacheAfterServerOverwrite(writeTree, treePath, childPath, existingEventSnap, existingServerSnap) {
    util.assert(existingEventSnap || existingServerSnap, 'Either existingEventSnap or existingServerSnap must exist');
    const path = pathChild(treePath, childPath);
    if (compoundWriteHasCompleteWrite(writeTree.visibleWrites, path)) {
        // At this point we can probably guarantee that we're in case 2, meaning no events
        // May need to check visibility while doing the findRootMostValueAndPath call
        return null;
    }
    else {
        // No complete shadowing. We're either partially shadowing or not shadowing at all.
        const childMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, path);
        if (compoundWriteIsEmpty(childMerge)) {
            // We're not shadowing at all. Case 1
            return existingServerSnap.getChild(childPath);
        }
        else {
            // This could be more efficient if the serverNode + updates doesn't change the eventSnap
            // However this is tricky to find out, since user updates don't necessary change the server
            // snap, e.g. priority updates on empty nodes, or deep deletes. Another special case is if the server
            // adds nodes, but doesn't change any existing writes. It is therefore not enough to
            // only check if the updates change the serverNode.
            // Maybe check if the merge tree contains these special cases and only do a full overwrite in that case?
            return compoundWriteApply(childMerge, existingServerSnap.getChild(childPath));
        }
    }
}
/**
 * Returns a complete child for a given server snap after applying all user writes or null if there is no
 * complete child for this ChildKey.
 */
function writeTreeCalcCompleteChild(writeTree, treePath, childKey, existingServerSnap) {
    const path = pathChild(treePath, childKey);
    const shadowingNode = compoundWriteGetCompleteNode(writeTree.visibleWrites, path);
    if (shadowingNode != null) {
        return shadowingNode;
    }
    else {
        if (existingServerSnap.isCompleteForChild(childKey)) {
            const childMerge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, path);
            return compoundWriteApply(childMerge, existingServerSnap.getNode().getImmediateChild(childKey));
        }
        else {
            return null;
        }
    }
}
/**
 * Returns a node if there is a complete overwrite for this path. More specifically, if there is a write at
 * a higher path, this will return the child of that write relative to the write and this path.
 * Returns null if there is no write at this path.
 */
function writeTreeShadowingWrite(writeTree, path) {
    return compoundWriteGetCompleteNode(writeTree.visibleWrites, path);
}
/**
 * This method is used when processing child remove events on a query. If we can, we pull in children that were outside
 * the window, but may now be in the window.
 */
function writeTreeCalcIndexedSlice(writeTree, treePath, completeServerData, startPost, count, reverse, index) {
    let toIterate;
    const merge = compoundWriteChildCompoundWrite(writeTree.visibleWrites, treePath);
    const shadowingNode = compoundWriteGetCompleteNode(merge, newEmptyPath());
    if (shadowingNode != null) {
        toIterate = shadowingNode;
    }
    else if (completeServerData != null) {
        toIterate = compoundWriteApply(merge, completeServerData);
    }
    else {
        // no children to iterate on
        return [];
    }
    toIterate = toIterate.withIndex(index);
    if (!toIterate.isEmpty() && !toIterate.isLeafNode()) {
        const nodes = [];
        const cmp = index.getCompare();
        const iter = reverse
            ? toIterate.getReverseIteratorFrom(startPost, index)
            : toIterate.getIteratorFrom(startPost, index);
        let next = iter.getNext();
        while (next && nodes.length < count) {
            if (cmp(next, startPost) !== 0) {
                nodes.push(next);
            }
            next = iter.getNext();
        }
        return nodes;
    }
    else {
        return [];
    }
}
function newWriteTree() {
    return {
        visibleWrites: CompoundWrite.empty(),
        allWrites: [],
        lastWriteId: -1
    };
}
/**
 * If possible, returns a complete event cache, using the underlying server data if possible. In addition, can be used
 * to get a cache that includes hidden writes, and excludes arbitrary writes. Note that customizing the returned node
 * can lead to a more expensive calculation.
 *
 * @param writeIdsToExclude - Optional writes to exclude.
 * @param includeHiddenWrites - Defaults to false, whether or not to layer on writes with visible set to false
 */
function writeTreeRefCalcCompleteEventCache(writeTreeRef, completeServerCache, writeIdsToExclude, includeHiddenWrites) {
    return writeTreeCalcCompleteEventCache(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerCache, writeIdsToExclude, includeHiddenWrites);
}
/**
 * If possible, returns a children node containing all of the complete children we have data for. The returned data is a
 * mix of the given server data and write data.
 *
 */
function writeTreeRefCalcCompleteEventChildren(writeTreeRef, completeServerChildren) {
    return writeTreeCalcCompleteEventChildren(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerChildren);
}
/**
 * Given that either the underlying server data has updated or the outstanding writes have updated, determine what,
 * if anything, needs to be applied to the event cache.
 *
 * Possibilities:
 *
 * 1. No writes are shadowing. Events should be raised, the snap to be applied comes from the server data
 *
 * 2. Some write is completely shadowing. No events to be raised
 *
 * 3. Is partially shadowed. Events should be raised
 *
 * Either existingEventSnap or existingServerSnap must exist, this is validated via an assert
 *
 *
 */
function writeTreeRefCalcEventCacheAfterServerOverwrite(writeTreeRef, path, existingEventSnap, existingServerSnap) {
    return writeTreeCalcEventCacheAfterServerOverwrite(writeTreeRef.writeTree, writeTreeRef.treePath, path, existingEventSnap, existingServerSnap);
}
/**
 * Returns a node if there is a complete overwrite for this path. More specifically, if there is a write at
 * a higher path, this will return the child of that write relative to the write and this path.
 * Returns null if there is no write at this path.
 *
 */
function writeTreeRefShadowingWrite(writeTreeRef, path) {
    return writeTreeShadowingWrite(writeTreeRef.writeTree, pathChild(writeTreeRef.treePath, path));
}
/**
 * This method is used when processing child remove events on a query. If we can, we pull in children that were outside
 * the window, but may now be in the window
 */
function writeTreeRefCalcIndexedSlice(writeTreeRef, completeServerData, startPost, count, reverse, index) {
    return writeTreeCalcIndexedSlice(writeTreeRef.writeTree, writeTreeRef.treePath, completeServerData, startPost, count, reverse, index);
}
/**
 * Returns a complete child for a given server snap after applying all user writes or null if there is no
 * complete child for this ChildKey.
 */
function writeTreeRefCalcCompleteChild(writeTreeRef, childKey, existingServerCache) {
    return writeTreeCalcCompleteChild(writeTreeRef.writeTree, writeTreeRef.treePath, childKey, existingServerCache);
}
/**
 * Return a WriteTreeRef for a child.
 */
function writeTreeRefChild(writeTreeRef, childName) {
    return newWriteTreeRef(pathChild(writeTreeRef.treePath, childName), writeTreeRef.writeTree);
}
function newWriteTreeRef(path, writeTree) {
    return {
        treePath: path,
        writeTree
    };
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class ChildChangeAccumulator {
    constructor() {
        this.changeMap = new Map();
    }
    trackChildChange(change) {
        const type = change.type;
        const childKey = change.childName;
        util.assert(type === "child_added" /* ChangeType.CHILD_ADDED */ ||
            type === "child_changed" /* ChangeType.CHILD_CHANGED */ ||
            type === "child_removed" /* ChangeType.CHILD_REMOVED */, 'Only child changes supported for tracking');
        util.assert(childKey !== '.priority', 'Only non-priority child changes can be tracked.');
        const oldChange = this.changeMap.get(childKey);
        if (oldChange) {
            const oldType = oldChange.type;
            if (type === "child_added" /* ChangeType.CHILD_ADDED */ &&
                oldType === "child_removed" /* ChangeType.CHILD_REMOVED */) {
                this.changeMap.set(childKey, changeChildChanged(childKey, change.snapshotNode, oldChange.snapshotNode));
            }
            else if (type === "child_removed" /* ChangeType.CHILD_REMOVED */ &&
                oldType === "child_added" /* ChangeType.CHILD_ADDED */) {
                this.changeMap.delete(childKey);
            }
            else if (type === "child_removed" /* ChangeType.CHILD_REMOVED */ &&
                oldType === "child_changed" /* ChangeType.CHILD_CHANGED */) {
                this.changeMap.set(childKey, changeChildRemoved(childKey, oldChange.oldSnap));
            }
            else if (type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
                oldType === "child_added" /* ChangeType.CHILD_ADDED */) {
                this.changeMap.set(childKey, changeChildAdded(childKey, change.snapshotNode));
            }
            else if (type === "child_changed" /* ChangeType.CHILD_CHANGED */ &&
                oldType === "child_changed" /* ChangeType.CHILD_CHANGED */) {
                this.changeMap.set(childKey, changeChildChanged(childKey, change.snapshotNode, oldChange.oldSnap));
            }
            else {
                throw util.assertionError('Illegal combination of changes: ' +
                    change +
                    ' occurred after ' +
                    oldChange);
            }
        }
        else {
            this.changeMap.set(childKey, change);
        }
    }
    getChanges() {
        return Array.from(this.changeMap.values());
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * An implementation of CompleteChildSource that never returns any additional children
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
class NoCompleteChildSource_ {
    getCompleteChild(childKey) {
        return null;
    }
    getChildAfterChild(index, child, reverse) {
        return null;
    }
}
/**
 * Singleton instance.
 */
const NO_COMPLETE_CHILD_SOURCE = new NoCompleteChildSource_();
/**
 * An implementation of CompleteChildSource that uses a WriteTree in addition to any other server data or
 * old event caches available to calculate complete children.
 */
class WriteTreeCompleteChildSource {
    constructor(writes_, viewCache_, optCompleteServerCache_ = null) {
        this.writes_ = writes_;
        this.viewCache_ = viewCache_;
        this.optCompleteServerCache_ = optCompleteServerCache_;
    }
    getCompleteChild(childKey) {
        const node = this.viewCache_.eventCache;
        if (node.isCompleteForChild(childKey)) {
            return node.getNode().getImmediateChild(childKey);
        }
        else {
            const serverNode = this.optCompleteServerCache_ != null
                ? new CacheNode(this.optCompleteServerCache_, true, false)
                : this.viewCache_.serverCache;
            return writeTreeRefCalcCompleteChild(this.writes_, childKey, serverNode);
        }
    }
    getChildAfterChild(index, child, reverse) {
        const completeServerData = this.optCompleteServerCache_ != null
            ? this.optCompleteServerCache_
            : viewCacheGetCompleteServerSnap(this.viewCache_);
        const nodes = writeTreeRefCalcIndexedSlice(this.writes_, completeServerData, child, 1, reverse, index);
        if (nodes.length === 0) {
            return null;
        }
        else {
            return nodes[0];
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function newViewProcessor(filter) {
    return { filter };
}
function viewProcessorAssertIndexed(viewProcessor, viewCache) {
    util.assert(viewCache.eventCache.getNode().isIndexed(viewProcessor.filter.getIndex()), 'Event snap not indexed');
    util.assert(viewCache.serverCache.getNode().isIndexed(viewProcessor.filter.getIndex()), 'Server snap not indexed');
}
function viewProcessorApplyOperation(viewProcessor, oldViewCache, operation, writesCache, completeCache) {
    const accumulator = new ChildChangeAccumulator();
    let newViewCache, filterServerNode;
    if (operation.type === OperationType.OVERWRITE) {
        const overwrite = operation;
        if (overwrite.source.fromUser) {
            newViewCache = viewProcessorApplyUserOverwrite(viewProcessor, oldViewCache, overwrite.path, overwrite.snap, writesCache, completeCache, accumulator);
        }
        else {
            util.assert(overwrite.source.fromServer, 'Unknown source.');
            // We filter the node if it's a tagged update or the node has been previously filtered  and the
            // update is not at the root in which case it is ok (and necessary) to mark the node unfiltered
            // again
            filterServerNode =
                overwrite.source.tagged ||
                    (oldViewCache.serverCache.isFiltered() && !pathIsEmpty(overwrite.path));
            newViewCache = viewProcessorApplyServerOverwrite(viewProcessor, oldViewCache, overwrite.path, overwrite.snap, writesCache, completeCache, filterServerNode, accumulator);
        }
    }
    else if (operation.type === OperationType.MERGE) {
        const merge = operation;
        if (merge.source.fromUser) {
            newViewCache = viewProcessorApplyUserMerge(viewProcessor, oldViewCache, merge.path, merge.children, writesCache, completeCache, accumulator);
        }
        else {
            util.assert(merge.source.fromServer, 'Unknown source.');
            // We filter the node if it's a tagged update or the node has been previously filtered
            filterServerNode =
                merge.source.tagged || oldViewCache.serverCache.isFiltered();
            newViewCache = viewProcessorApplyServerMerge(viewProcessor, oldViewCache, merge.path, merge.children, writesCache, completeCache, filterServerNode, accumulator);
        }
    }
    else if (operation.type === OperationType.ACK_USER_WRITE) {
        const ackUserWrite = operation;
        if (!ackUserWrite.revert) {
            newViewCache = viewProcessorAckUserWrite(viewProcessor, oldViewCache, ackUserWrite.path, ackUserWrite.affectedTree, writesCache, completeCache, accumulator);
        }
        else {
            newViewCache = viewProcessorRevertUserWrite(viewProcessor, oldViewCache, ackUserWrite.path, writesCache, completeCache, accumulator);
        }
    }
    else if (operation.type === OperationType.LISTEN_COMPLETE) {
        newViewCache = viewProcessorListenComplete(viewProcessor, oldViewCache, operation.path, writesCache, accumulator);
    }
    else {
        throw util.assertionError('Unknown operation type: ' + operation.type);
    }
    const changes = accumulator.getChanges();
    viewProcessorMaybeAddValueEvent(oldViewCache, newViewCache, changes);
    return { viewCache: newViewCache, changes };
}
function viewProcessorMaybeAddValueEvent(oldViewCache, newViewCache, accumulator) {
    const eventSnap = newViewCache.eventCache;
    if (eventSnap.isFullyInitialized()) {
        const isLeafOrEmpty = eventSnap.getNode().isLeafNode() || eventSnap.getNode().isEmpty();
        const oldCompleteSnap = viewCacheGetCompleteEventSnap(oldViewCache);
        if (accumulator.length > 0 ||
            !oldViewCache.eventCache.isFullyInitialized() ||
            (isLeafOrEmpty && !eventSnap.getNode().equals(oldCompleteSnap)) ||
            !eventSnap.getNode().getPriority().equals(oldCompleteSnap.getPriority())) {
            accumulator.push(changeValue(viewCacheGetCompleteEventSnap(newViewCache)));
        }
    }
}
function viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, viewCache, changePath, writesCache, source, accumulator) {
    const oldEventSnap = viewCache.eventCache;
    if (writeTreeRefShadowingWrite(writesCache, changePath) != null) {
        // we have a shadowing write, ignore changes
        return viewCache;
    }
    else {
        let newEventCache, serverNode;
        if (pathIsEmpty(changePath)) {
            // TODO: figure out how this plays with "sliding ack windows"
            util.assert(viewCache.serverCache.isFullyInitialized(), 'If change path is empty, we must have complete server data');
            if (viewCache.serverCache.isFiltered()) {
                // We need to special case this, because we need to only apply writes to complete children, or
                // we might end up raising events for incomplete children. If the server data is filtered deep
                // writes cannot be guaranteed to be complete
                const serverCache = viewCacheGetCompleteServerSnap(viewCache);
                const completeChildren = serverCache instanceof ChildrenNode
                    ? serverCache
                    : ChildrenNode.EMPTY_NODE;
                const completeEventChildren = writeTreeRefCalcCompleteEventChildren(writesCache, completeChildren);
                newEventCache = viewProcessor.filter.updateFullNode(viewCache.eventCache.getNode(), completeEventChildren, accumulator);
            }
            else {
                const completeNode = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
                newEventCache = viewProcessor.filter.updateFullNode(viewCache.eventCache.getNode(), completeNode, accumulator);
            }
        }
        else {
            const childKey = pathGetFront(changePath);
            if (childKey === '.priority') {
                util.assert(pathGetLength(changePath) === 1, "Can't have a priority with additional path components");
                const oldEventNode = oldEventSnap.getNode();
                serverNode = viewCache.serverCache.getNode();
                // we might have overwrites for this priority
                const updatedPriority = writeTreeRefCalcEventCacheAfterServerOverwrite(writesCache, changePath, oldEventNode, serverNode);
                if (updatedPriority != null) {
                    newEventCache = viewProcessor.filter.updatePriority(oldEventNode, updatedPriority);
                }
                else {
                    // priority didn't change, keep old node
                    newEventCache = oldEventSnap.getNode();
                }
            }
            else {
                const childChangePath = pathPopFront(changePath);
                // update child
                let newEventChild;
                if (oldEventSnap.isCompleteForChild(childKey)) {
                    serverNode = viewCache.serverCache.getNode();
                    const eventChildUpdate = writeTreeRefCalcEventCacheAfterServerOverwrite(writesCache, changePath, oldEventSnap.getNode(), serverNode);
                    if (eventChildUpdate != null) {
                        newEventChild = oldEventSnap
                            .getNode()
                            .getImmediateChild(childKey)
                            .updateChild(childChangePath, eventChildUpdate);
                    }
                    else {
                        // Nothing changed, just keep the old child
                        newEventChild = oldEventSnap.getNode().getImmediateChild(childKey);
                    }
                }
                else {
                    newEventChild = writeTreeRefCalcCompleteChild(writesCache, childKey, viewCache.serverCache);
                }
                if (newEventChild != null) {
                    newEventCache = viewProcessor.filter.updateChild(oldEventSnap.getNode(), childKey, newEventChild, childChangePath, source, accumulator);
                }
                else {
                    // no complete child available or no change
                    newEventCache = oldEventSnap.getNode();
                }
            }
        }
        return viewCacheUpdateEventSnap(viewCache, newEventCache, oldEventSnap.isFullyInitialized() || pathIsEmpty(changePath), viewProcessor.filter.filtersNodes());
    }
}
function viewProcessorApplyServerOverwrite(viewProcessor, oldViewCache, changePath, changedSnap, writesCache, completeCache, filterServerNode, accumulator) {
    const oldServerSnap = oldViewCache.serverCache;
    let newServerCache;
    const serverFilter = filterServerNode
        ? viewProcessor.filter
        : viewProcessor.filter.getIndexedFilter();
    if (pathIsEmpty(changePath)) {
        newServerCache = serverFilter.updateFullNode(oldServerSnap.getNode(), changedSnap, null);
    }
    else if (serverFilter.filtersNodes() && !oldServerSnap.isFiltered()) {
        // we want to filter the server node, but we didn't filter the server node yet, so simulate a full update
        const newServerNode = oldServerSnap
            .getNode()
            .updateChild(changePath, changedSnap);
        newServerCache = serverFilter.updateFullNode(oldServerSnap.getNode(), newServerNode, null);
    }
    else {
        const childKey = pathGetFront(changePath);
        if (!oldServerSnap.isCompleteForPath(changePath) &&
            pathGetLength(changePath) > 1) {
            // We don't update incomplete nodes with updates intended for other listeners
            return oldViewCache;
        }
        const childChangePath = pathPopFront(changePath);
        const childNode = oldServerSnap.getNode().getImmediateChild(childKey);
        const newChildNode = childNode.updateChild(childChangePath, changedSnap);
        if (childKey === '.priority') {
            newServerCache = serverFilter.updatePriority(oldServerSnap.getNode(), newChildNode);
        }
        else {
            newServerCache = serverFilter.updateChild(oldServerSnap.getNode(), childKey, newChildNode, childChangePath, NO_COMPLETE_CHILD_SOURCE, null);
        }
    }
    const newViewCache = viewCacheUpdateServerSnap(oldViewCache, newServerCache, oldServerSnap.isFullyInitialized() || pathIsEmpty(changePath), serverFilter.filtersNodes());
    const source = new WriteTreeCompleteChildSource(writesCache, newViewCache, completeCache);
    return viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, newViewCache, changePath, writesCache, source, accumulator);
}
function viewProcessorApplyUserOverwrite(viewProcessor, oldViewCache, changePath, changedSnap, writesCache, completeCache, accumulator) {
    const oldEventSnap = oldViewCache.eventCache;
    let newViewCache, newEventCache;
    const source = new WriteTreeCompleteChildSource(writesCache, oldViewCache, completeCache);
    if (pathIsEmpty(changePath)) {
        newEventCache = viewProcessor.filter.updateFullNode(oldViewCache.eventCache.getNode(), changedSnap, accumulator);
        newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventCache, true, viewProcessor.filter.filtersNodes());
    }
    else {
        const childKey = pathGetFront(changePath);
        if (childKey === '.priority') {
            newEventCache = viewProcessor.filter.updatePriority(oldViewCache.eventCache.getNode(), changedSnap);
            newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventCache, oldEventSnap.isFullyInitialized(), oldEventSnap.isFiltered());
        }
        else {
            const childChangePath = pathPopFront(changePath);
            const oldChild = oldEventSnap.getNode().getImmediateChild(childKey);
            let newChild;
            if (pathIsEmpty(childChangePath)) {
                // Child overwrite, we can replace the child
                newChild = changedSnap;
            }
            else {
                const childNode = source.getCompleteChild(childKey);
                if (childNode != null) {
                    if (pathGetBack(childChangePath) === '.priority' &&
                        childNode.getChild(pathParent(childChangePath)).isEmpty()) {
                        // This is a priority update on an empty node. If this node exists on the server, the
                        // server will send down the priority in the update, so ignore for now
                        newChild = childNode;
                    }
                    else {
                        newChild = childNode.updateChild(childChangePath, changedSnap);
                    }
                }
                else {
                    // There is no complete child node available
                    newChild = ChildrenNode.EMPTY_NODE;
                }
            }
            if (!oldChild.equals(newChild)) {
                const newEventSnap = viewProcessor.filter.updateChild(oldEventSnap.getNode(), childKey, newChild, childChangePath, source, accumulator);
                newViewCache = viewCacheUpdateEventSnap(oldViewCache, newEventSnap, oldEventSnap.isFullyInitialized(), viewProcessor.filter.filtersNodes());
            }
            else {
                newViewCache = oldViewCache;
            }
        }
    }
    return newViewCache;
}
function viewProcessorCacheHasChild(viewCache, childKey) {
    return viewCache.eventCache.isCompleteForChild(childKey);
}
function viewProcessorApplyUserMerge(viewProcessor, viewCache, path, changedChildren, writesCache, serverCache, accumulator) {
    // HACK: In the case of a limit query, there may be some changes that bump things out of the
    // window leaving room for new items.  It's important we process these changes first, so we
    // iterate the changes twice, first processing any that affect items currently in view.
    // TODO: I consider an item "in view" if cacheHasChild is true, which checks both the server
    // and event snap.  I'm not sure if this will result in edge cases when a child is in one but
    // not the other.
    let curViewCache = viewCache;
    changedChildren.foreach((relativePath, childNode) => {
        const writePath = pathChild(path, relativePath);
        if (viewProcessorCacheHasChild(viewCache, pathGetFront(writePath))) {
            curViewCache = viewProcessorApplyUserOverwrite(viewProcessor, curViewCache, writePath, childNode, writesCache, serverCache, accumulator);
        }
    });
    changedChildren.foreach((relativePath, childNode) => {
        const writePath = pathChild(path, relativePath);
        if (!viewProcessorCacheHasChild(viewCache, pathGetFront(writePath))) {
            curViewCache = viewProcessorApplyUserOverwrite(viewProcessor, curViewCache, writePath, childNode, writesCache, serverCache, accumulator);
        }
    });
    return curViewCache;
}
function viewProcessorApplyMerge(viewProcessor, node, merge) {
    merge.foreach((relativePath, childNode) => {
        node = node.updateChild(relativePath, childNode);
    });
    return node;
}
function viewProcessorApplyServerMerge(viewProcessor, viewCache, path, changedChildren, writesCache, serverCache, filterServerNode, accumulator) {
    // If we don't have a cache yet, this merge was intended for a previously listen in the same location. Ignore it and
    // wait for the complete data update coming soon.
    if (viewCache.serverCache.getNode().isEmpty() &&
        !viewCache.serverCache.isFullyInitialized()) {
        return viewCache;
    }
    // HACK: In the case of a limit query, there may be some changes that bump things out of the
    // window leaving room for new items.  It's important we process these changes first, so we
    // iterate the changes twice, first processing any that affect items currently in view.
    // TODO: I consider an item "in view" if cacheHasChild is true, which checks both the server
    // and event snap.  I'm not sure if this will result in edge cases when a child is in one but
    // not the other.
    let curViewCache = viewCache;
    let viewMergeTree;
    if (pathIsEmpty(path)) {
        viewMergeTree = changedChildren;
    }
    else {
        viewMergeTree = new ImmutableTree(null).setTree(path, changedChildren);
    }
    const serverNode = viewCache.serverCache.getNode();
    viewMergeTree.children.inorderTraversal((childKey, childTree) => {
        if (serverNode.hasChild(childKey)) {
            const serverChild = viewCache.serverCache
                .getNode()
                .getImmediateChild(childKey);
            const newChild = viewProcessorApplyMerge(viewProcessor, serverChild, childTree);
            curViewCache = viewProcessorApplyServerOverwrite(viewProcessor, curViewCache, new Path(childKey), newChild, writesCache, serverCache, filterServerNode, accumulator);
        }
    });
    viewMergeTree.children.inorderTraversal((childKey, childMergeTree) => {
        const isUnknownDeepMerge = !viewCache.serverCache.isCompleteForChild(childKey) &&
            childMergeTree.value === null;
        if (!serverNode.hasChild(childKey) && !isUnknownDeepMerge) {
            const serverChild = viewCache.serverCache
                .getNode()
                .getImmediateChild(childKey);
            const newChild = viewProcessorApplyMerge(viewProcessor, serverChild, childMergeTree);
            curViewCache = viewProcessorApplyServerOverwrite(viewProcessor, curViewCache, new Path(childKey), newChild, writesCache, serverCache, filterServerNode, accumulator);
        }
    });
    return curViewCache;
}
function viewProcessorAckUserWrite(viewProcessor, viewCache, ackPath, affectedTree, writesCache, completeCache, accumulator) {
    if (writeTreeRefShadowingWrite(writesCache, ackPath) != null) {
        return viewCache;
    }
    // Only filter server node if it is currently filtered
    const filterServerNode = viewCache.serverCache.isFiltered();
    // Essentially we'll just get our existing server cache for the affected paths and re-apply it as a server update
    // now that it won't be shadowed.
    const serverCache = viewCache.serverCache;
    if (affectedTree.value != null) {
        // This is an overwrite.
        if ((pathIsEmpty(ackPath) && serverCache.isFullyInitialized()) ||
            serverCache.isCompleteForPath(ackPath)) {
            return viewProcessorApplyServerOverwrite(viewProcessor, viewCache, ackPath, serverCache.getNode().getChild(ackPath), writesCache, completeCache, filterServerNode, accumulator);
        }
        else if (pathIsEmpty(ackPath)) {
            // This is a goofy edge case where we are acking data at this location but don't have full data.  We
            // should just re-apply whatever we have in our cache as a merge.
            let changedChildren = new ImmutableTree(null);
            serverCache.getNode().forEachChild(KEY_INDEX, (name, node) => {
                changedChildren = changedChildren.set(new Path(name), node);
            });
            return viewProcessorApplyServerMerge(viewProcessor, viewCache, ackPath, changedChildren, writesCache, completeCache, filterServerNode, accumulator);
        }
        else {
            return viewCache;
        }
    }
    else {
        // This is a merge.
        let changedChildren = new ImmutableTree(null);
        affectedTree.foreach((mergePath, value) => {
            const serverCachePath = pathChild(ackPath, mergePath);
            if (serverCache.isCompleteForPath(serverCachePath)) {
                changedChildren = changedChildren.set(mergePath, serverCache.getNode().getChild(serverCachePath));
            }
        });
        return viewProcessorApplyServerMerge(viewProcessor, viewCache, ackPath, changedChildren, writesCache, completeCache, filterServerNode, accumulator);
    }
}
function viewProcessorListenComplete(viewProcessor, viewCache, path, writesCache, accumulator) {
    const oldServerNode = viewCache.serverCache;
    const newViewCache = viewCacheUpdateServerSnap(viewCache, oldServerNode.getNode(), oldServerNode.isFullyInitialized() || pathIsEmpty(path), oldServerNode.isFiltered());
    return viewProcessorGenerateEventCacheAfterServerEvent(viewProcessor, newViewCache, path, writesCache, NO_COMPLETE_CHILD_SOURCE, accumulator);
}
function viewProcessorRevertUserWrite(viewProcessor, viewCache, path, writesCache, completeServerCache, accumulator) {
    let complete;
    if (writeTreeRefShadowingWrite(writesCache, path) != null) {
        return viewCache;
    }
    else {
        const source = new WriteTreeCompleteChildSource(writesCache, viewCache, completeServerCache);
        const oldEventCache = viewCache.eventCache.getNode();
        let newEventCache;
        if (pathIsEmpty(path) || pathGetFront(path) === '.priority') {
            let newNode;
            if (viewCache.serverCache.isFullyInitialized()) {
                newNode = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
            }
            else {
                const serverChildren = viewCache.serverCache.getNode();
                util.assert(serverChildren instanceof ChildrenNode, 'serverChildren would be complete if leaf node');
                newNode = writeTreeRefCalcCompleteEventChildren(writesCache, serverChildren);
            }
            newNode = newNode;
            newEventCache = viewProcessor.filter.updateFullNode(oldEventCache, newNode, accumulator);
        }
        else {
            const childKey = pathGetFront(path);
            let newChild = writeTreeRefCalcCompleteChild(writesCache, childKey, viewCache.serverCache);
            if (newChild == null &&
                viewCache.serverCache.isCompleteForChild(childKey)) {
                newChild = oldEventCache.getImmediateChild(childKey);
            }
            if (newChild != null) {
                newEventCache = viewProcessor.filter.updateChild(oldEventCache, childKey, newChild, pathPopFront(path), source, accumulator);
            }
            else if (viewCache.eventCache.getNode().hasChild(childKey)) {
                // No complete child available, delete the existing one, if any
                newEventCache = viewProcessor.filter.updateChild(oldEventCache, childKey, ChildrenNode.EMPTY_NODE, pathPopFront(path), source, accumulator);
            }
            else {
                newEventCache = oldEventCache;
            }
            if (newEventCache.isEmpty() &&
                viewCache.serverCache.isFullyInitialized()) {
                // We might have reverted all child writes. Maybe the old event was a leaf node
                complete = writeTreeRefCalcCompleteEventCache(writesCache, viewCacheGetCompleteServerSnap(viewCache));
                if (complete.isLeafNode()) {
                    newEventCache = viewProcessor.filter.updateFullNode(newEventCache, complete, accumulator);
                }
            }
        }
        complete =
            viewCache.serverCache.isFullyInitialized() ||
                writeTreeRefShadowingWrite(writesCache, newEmptyPath()) != null;
        return viewCacheUpdateEventSnap(viewCache, newEventCache, complete, viewProcessor.filter.filtersNodes());
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A view represents a specific location and query that has 1 or more event registrations.
 *
 * It does several things:
 *  - Maintains the list of event registrations for this location/query.
 *  - Maintains a cache of the data visible for this location/query.
 *  - Applies new operations (via applyOperation), updates the cache, and based on the event
 *    registrations returns the set of events to be raised.
 */
class View {
    constructor(query_, initialViewCache) {
        this.query_ = query_;
        this.eventRegistrations_ = [];
        const params = this.query_._queryParams;
        const indexFilter = new IndexedFilter(params.getIndex());
        const filter = queryParamsGetNodeFilter(params);
        this.processor_ = newViewProcessor(filter);
        const initialServerCache = initialViewCache.serverCache;
        const initialEventCache = initialViewCache.eventCache;
        // Don't filter server node with other filter than index, wait for tagged listen
        const serverSnap = indexFilter.updateFullNode(ChildrenNode.EMPTY_NODE, initialServerCache.getNode(), null);
        const eventSnap = filter.updateFullNode(ChildrenNode.EMPTY_NODE, initialEventCache.getNode(), null);
        const newServerCache = new CacheNode(serverSnap, initialServerCache.isFullyInitialized(), indexFilter.filtersNodes());
        const newEventCache = new CacheNode(eventSnap, initialEventCache.isFullyInitialized(), filter.filtersNodes());
        this.viewCache_ = newViewCache(newEventCache, newServerCache);
        this.eventGenerator_ = new EventGenerator(this.query_);
    }
    get query() {
        return this.query_;
    }
}
function viewGetServerCache(view) {
    return view.viewCache_.serverCache.getNode();
}
function viewGetCompleteNode(view) {
    return viewCacheGetCompleteEventSnap(view.viewCache_);
}
function viewGetCompleteServerCache(view, path) {
    const cache = viewCacheGetCompleteServerSnap(view.viewCache_);
    if (cache) {
        // If this isn't a "loadsAllData" view, then cache isn't actually a complete cache and
        // we need to see if it contains the child we're interested in.
        if (view.query._queryParams.loadsAllData() ||
            (!pathIsEmpty(path) &&
                !cache.getImmediateChild(pathGetFront(path)).isEmpty())) {
            return cache.getChild(path);
        }
    }
    return null;
}
function viewIsEmpty(view) {
    return view.eventRegistrations_.length === 0;
}
function viewAddEventRegistration(view, eventRegistration) {
    view.eventRegistrations_.push(eventRegistration);
}
/**
 * @param eventRegistration - If null, remove all callbacks.
 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
 * @returns Cancel events, if cancelError was provided.
 */
function viewRemoveEventRegistration(view, eventRegistration, cancelError) {
    const cancelEvents = [];
    if (cancelError) {
        util.assert(eventRegistration == null, 'A cancel should cancel all event registrations.');
        const path = view.query._path;
        view.eventRegistrations_.forEach(registration => {
            const maybeEvent = registration.createCancelEvent(cancelError, path);
            if (maybeEvent) {
                cancelEvents.push(maybeEvent);
            }
        });
    }
    if (eventRegistration) {
        let remaining = [];
        for (let i = 0; i < view.eventRegistrations_.length; ++i) {
            const existing = view.eventRegistrations_[i];
            if (!existing.matches(eventRegistration)) {
                remaining.push(existing);
            }
            else if (eventRegistration.hasAnyCallback()) {
                // We're removing just this one
                remaining = remaining.concat(view.eventRegistrations_.slice(i + 1));
                break;
            }
        }
        view.eventRegistrations_ = remaining;
    }
    else {
        view.eventRegistrations_ = [];
    }
    return cancelEvents;
}
/**
 * Applies the given Operation, updates our cache, and returns the appropriate events.
 */
function viewApplyOperation(view, operation, writesCache, completeServerCache) {
    if (operation.type === OperationType.MERGE &&
        operation.source.queryId !== null) {
        util.assert(viewCacheGetCompleteServerSnap(view.viewCache_), 'We should always have a full cache before handling merges');
        util.assert(viewCacheGetCompleteEventSnap(view.viewCache_), 'Missing event cache, even though we have a server cache');
    }
    const oldViewCache = view.viewCache_;
    const result = viewProcessorApplyOperation(view.processor_, oldViewCache, operation, writesCache, completeServerCache);
    viewProcessorAssertIndexed(view.processor_, result.viewCache);
    util.assert(result.viewCache.serverCache.isFullyInitialized() ||
        !oldViewCache.serverCache.isFullyInitialized(), 'Once a server snap is complete, it should never go back');
    view.viewCache_ = result.viewCache;
    return viewGenerateEventsForChanges_(view, result.changes, result.viewCache.eventCache.getNode(), null);
}
function viewGetInitialEvents(view, registration) {
    const eventSnap = view.viewCache_.eventCache;
    const initialChanges = [];
    if (!eventSnap.getNode().isLeafNode()) {
        const eventNode = eventSnap.getNode();
        eventNode.forEachChild(PRIORITY_INDEX, (key, childNode) => {
            initialChanges.push(changeChildAdded(key, childNode));
        });
    }
    if (eventSnap.isFullyInitialized()) {
        initialChanges.push(changeValue(eventSnap.getNode()));
    }
    return viewGenerateEventsForChanges_(view, initialChanges, eventSnap.getNode(), registration);
}
function viewGenerateEventsForChanges_(view, changes, eventCache, eventRegistration) {
    const registrations = eventRegistration
        ? [eventRegistration]
        : view.eventRegistrations_;
    return eventGeneratorGenerateEventsForChanges(view.eventGenerator_, changes, eventCache, registrations);
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let referenceConstructor$1;
/**
 * SyncPoint represents a single location in a SyncTree with 1 or more event registrations, meaning we need to
 * maintain 1 or more Views at this location to cache server data and raise appropriate events for server changes
 * and user writes (set, transaction, update).
 *
 * It's responsible for:
 *  - Maintaining the set of 1 or more views necessary at this location (a SyncPoint with 0 views should be removed).
 *  - Proxying user / server operations to the views as appropriate (i.e. applyServerOverwrite,
 *    applyUserOverwrite, etc.)
 */
class SyncPoint {
    constructor() {
        /**
         * The Views being tracked at this location in the tree, stored as a map where the key is a
         * queryId and the value is the View for that query.
         *
         * NOTE: This list will be quite small (usually 1, but perhaps 2 or 3; any more is an odd use case).
         */
        this.views = new Map();
    }
}
function syncPointSetReferenceConstructor(val) {
    util.assert(!referenceConstructor$1, '__referenceConstructor has already been defined');
    referenceConstructor$1 = val;
}
function syncPointGetReferenceConstructor() {
    util.assert(referenceConstructor$1, 'Reference.ts has not been loaded');
    return referenceConstructor$1;
}
function syncPointIsEmpty(syncPoint) {
    return syncPoint.views.size === 0;
}
function syncPointApplyOperation(syncPoint, operation, writesCache, optCompleteServerCache) {
    const queryId = operation.source.queryId;
    if (queryId !== null) {
        const view = syncPoint.views.get(queryId);
        util.assert(view != null, 'SyncTree gave us an op for an invalid query.');
        return viewApplyOperation(view, operation, writesCache, optCompleteServerCache);
    }
    else {
        let events = [];
        for (const view of syncPoint.views.values()) {
            events = events.concat(viewApplyOperation(view, operation, writesCache, optCompleteServerCache));
        }
        return events;
    }
}
/**
 * Get a view for the specified query.
 *
 * @param query - The query to return a view for
 * @param writesCache
 * @param serverCache
 * @param serverCacheComplete
 * @returns Events to raise.
 */
function syncPointGetView(syncPoint, query, writesCache, serverCache, serverCacheComplete) {
    const queryId = query._queryIdentifier;
    const view = syncPoint.views.get(queryId);
    if (!view) {
        // TODO: make writesCache take flag for complete server node
        let eventCache = writeTreeRefCalcCompleteEventCache(writesCache, serverCacheComplete ? serverCache : null);
        let eventCacheComplete = false;
        if (eventCache) {
            eventCacheComplete = true;
        }
        else if (serverCache instanceof ChildrenNode) {
            eventCache = writeTreeRefCalcCompleteEventChildren(writesCache, serverCache);
            eventCacheComplete = false;
        }
        else {
            eventCache = ChildrenNode.EMPTY_NODE;
            eventCacheComplete = false;
        }
        const viewCache = newViewCache(new CacheNode(eventCache, eventCacheComplete, false), new CacheNode(serverCache, serverCacheComplete, false));
        return new View(query, viewCache);
    }
    return view;
}
/**
 * Add an event callback for the specified query.
 *
 * @param query
 * @param eventRegistration
 * @param writesCache
 * @param serverCache - Complete server cache, if we have it.
 * @param serverCacheComplete
 * @returns Events to raise.
 */
function syncPointAddEventRegistration(syncPoint, query, eventRegistration, writesCache, serverCache, serverCacheComplete) {
    const view = syncPointGetView(syncPoint, query, writesCache, serverCache, serverCacheComplete);
    if (!syncPoint.views.has(query._queryIdentifier)) {
        syncPoint.views.set(query._queryIdentifier, view);
    }
    // This is guaranteed to exist now, we just created anything that was missing
    viewAddEventRegistration(view, eventRegistration);
    return viewGetInitialEvents(view, eventRegistration);
}
/**
 * Remove event callback(s).  Return cancelEvents if a cancelError is specified.
 *
 * If query is the default query, we'll check all views for the specified eventRegistration.
 * If eventRegistration is null, we'll remove all callbacks for the specified view(s).
 *
 * @param eventRegistration - If null, remove all callbacks.
 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
 * @returns removed queries and any cancel events
 */
function syncPointRemoveEventRegistration(syncPoint, query, eventRegistration, cancelError) {
    const queryId = query._queryIdentifier;
    const removed = [];
    let cancelEvents = [];
    const hadCompleteView = syncPointHasCompleteView(syncPoint);
    if (queryId === 'default') {
        // When you do ref.off(...), we search all views for the registration to remove.
        for (const [viewQueryId, view] of syncPoint.views.entries()) {
            cancelEvents = cancelEvents.concat(viewRemoveEventRegistration(view, eventRegistration, cancelError));
            if (viewIsEmpty(view)) {
                syncPoint.views.delete(viewQueryId);
                // We'll deal with complete views later.
                if (!view.query._queryParams.loadsAllData()) {
                    removed.push(view.query);
                }
            }
        }
    }
    else {
        // remove the callback from the specific view.
        const view = syncPoint.views.get(queryId);
        if (view) {
            cancelEvents = cancelEvents.concat(viewRemoveEventRegistration(view, eventRegistration, cancelError));
            if (viewIsEmpty(view)) {
                syncPoint.views.delete(queryId);
                // We'll deal with complete views later.
                if (!view.query._queryParams.loadsAllData()) {
                    removed.push(view.query);
                }
            }
        }
    }
    if (hadCompleteView && !syncPointHasCompleteView(syncPoint)) {
        // We removed our last complete view.
        removed.push(new (syncPointGetReferenceConstructor())(query._repo, query._path));
    }
    return { removed, events: cancelEvents };
}
function syncPointGetQueryViews(syncPoint) {
    const result = [];
    for (const view of syncPoint.views.values()) {
        if (!view.query._queryParams.loadsAllData()) {
            result.push(view);
        }
    }
    return result;
}
/**
 * @param path - The path to the desired complete snapshot
 * @returns A complete cache, if it exists
 */
function syncPointGetCompleteServerCache(syncPoint, path) {
    let serverCache = null;
    for (const view of syncPoint.views.values()) {
        serverCache = serverCache || viewGetCompleteServerCache(view, path);
    }
    return serverCache;
}
function syncPointViewForQuery(syncPoint, query) {
    const params = query._queryParams;
    if (params.loadsAllData()) {
        return syncPointGetCompleteView(syncPoint);
    }
    else {
        const queryId = query._queryIdentifier;
        return syncPoint.views.get(queryId);
    }
}
function syncPointViewExistsForQuery(syncPoint, query) {
    return syncPointViewForQuery(syncPoint, query) != null;
}
function syncPointHasCompleteView(syncPoint) {
    return syncPointGetCompleteView(syncPoint) != null;
}
function syncPointGetCompleteView(syncPoint) {
    for (const view of syncPoint.views.values()) {
        if (view.query._queryParams.loadsAllData()) {
            return view;
        }
    }
    return null;
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
let referenceConstructor;
function syncTreeSetReferenceConstructor(val) {
    util.assert(!referenceConstructor, '__referenceConstructor has already been defined');
    referenceConstructor = val;
}
function syncTreeGetReferenceConstructor() {
    util.assert(referenceConstructor, 'Reference.ts has not been loaded');
    return referenceConstructor;
}
/**
 * Static tracker for next query tag.
 */
let syncTreeNextQueryTag_ = 1;
/**
 * SyncTree is the central class for managing event callback registration, data caching, views
 * (query processing), and event generation.  There are typically two SyncTree instances for
 * each Repo, one for the normal Firebase data, and one for the .info data.
 *
 * It has a number of responsibilities, including:
 *  - Tracking all user event callbacks (registered via addEventRegistration() and removeEventRegistration()).
 *  - Applying and caching data changes for user set(), transaction(), and update() calls
 *    (applyUserOverwrite(), applyUserMerge()).
 *  - Applying and caching data changes for server data changes (applyServerOverwrite(),
 *    applyServerMerge()).
 *  - Generating user-facing events for server and user changes (all of the apply* methods
 *    return the set of events that need to be raised as a result).
 *  - Maintaining the appropriate set of server listens to ensure we are always subscribed
 *    to the correct set of paths and queries to satisfy the current set of user event
 *    callbacks (listens are started/stopped using the provided listenProvider).
 *
 * NOTE: Although SyncTree tracks event callbacks and calculates events to raise, the actual
 * events are returned to the caller rather than raised synchronously.
 *
 */
class SyncTree {
    /**
     * @param listenProvider_ - Used by SyncTree to start / stop listening
     *   to server data.
     */
    constructor(listenProvider_) {
        this.listenProvider_ = listenProvider_;
        /**
         * Tree of SyncPoints.  There's a SyncPoint at any location that has 1 or more views.
         */
        this.syncPointTree_ = new ImmutableTree(null);
        /**
         * A tree of all pending user writes (user-initiated set()'s, transaction()'s, update()'s, etc.).
         */
        this.pendingWriteTree_ = newWriteTree();
        this.tagToQueryMap = new Map();
        this.queryToTagMap = new Map();
    }
}
/**
 * Apply the data changes for a user-generated set() or transaction() call.
 *
 * @returns Events to raise.
 */
function syncTreeApplyUserOverwrite(syncTree, path, newData, writeId, visible) {
    // Record pending write.
    writeTreeAddOverwrite(syncTree.pendingWriteTree_, path, newData, writeId, visible);
    if (!visible) {
        return [];
    }
    else {
        return syncTreeApplyOperationToSyncPoints_(syncTree, new Overwrite(newOperationSourceUser(), path, newData));
    }
}
/**
 * Apply the data from a user-generated update() call
 *
 * @returns Events to raise.
 */
function syncTreeApplyUserMerge(syncTree, path, changedChildren, writeId) {
    // Record pending merge.
    writeTreeAddMerge(syncTree.pendingWriteTree_, path, changedChildren, writeId);
    const changeTree = ImmutableTree.fromObject(changedChildren);
    return syncTreeApplyOperationToSyncPoints_(syncTree, new Merge(newOperationSourceUser(), path, changeTree));
}
/**
 * Acknowledge a pending user write that was previously registered with applyUserOverwrite() or applyUserMerge().
 *
 * @param revert - True if the given write failed and needs to be reverted
 * @returns Events to raise.
 */
function syncTreeAckUserWrite(syncTree, writeId, revert = false) {
    const write = writeTreeGetWrite(syncTree.pendingWriteTree_, writeId);
    const needToReevaluate = writeTreeRemoveWrite(syncTree.pendingWriteTree_, writeId);
    if (!needToReevaluate) {
        return [];
    }
    else {
        let affectedTree = new ImmutableTree(null);
        if (write.snap != null) {
            // overwrite
            affectedTree = affectedTree.set(newEmptyPath(), true);
        }
        else {
            each(write.children, (pathString) => {
                affectedTree = affectedTree.set(new Path(pathString), true);
            });
        }
        return syncTreeApplyOperationToSyncPoints_(syncTree, new AckUserWrite(write.path, affectedTree, revert));
    }
}
/**
 * Apply new server data for the specified path..
 *
 * @returns Events to raise.
 */
function syncTreeApplyServerOverwrite(syncTree, path, newData) {
    return syncTreeApplyOperationToSyncPoints_(syncTree, new Overwrite(newOperationSourceServer(), path, newData));
}
/**
 * Apply new server data to be merged in at the specified path.
 *
 * @returns Events to raise.
 */
function syncTreeApplyServerMerge(syncTree, path, changedChildren) {
    const changeTree = ImmutableTree.fromObject(changedChildren);
    return syncTreeApplyOperationToSyncPoints_(syncTree, new Merge(newOperationSourceServer(), path, changeTree));
}
/**
 * Apply a listen complete for a query
 *
 * @returns Events to raise.
 */
function syncTreeApplyListenComplete(syncTree, path) {
    return syncTreeApplyOperationToSyncPoints_(syncTree, new ListenComplete(newOperationSourceServer(), path));
}
/**
 * Apply a listen complete for a tagged query
 *
 * @returns Events to raise.
 */
function syncTreeApplyTaggedListenComplete(syncTree, path, tag) {
    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
    if (queryKey) {
        const r = syncTreeParseQueryKey_(queryKey);
        const queryPath = r.path, queryId = r.queryId;
        const relativePath = newRelativePath(queryPath, path);
        const op = new ListenComplete(newOperationSourceServerTaggedQuery(queryId), relativePath);
        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
    }
    else {
        // We've already removed the query. No big deal, ignore the update
        return [];
    }
}
/**
 * Remove event callback(s).
 *
 * If query is the default query, we'll check all queries for the specified eventRegistration.
 * If eventRegistration is null, we'll remove all callbacks for the specified query/queries.
 *
 * @param eventRegistration - If null, all callbacks are removed.
 * @param cancelError - If a cancelError is provided, appropriate cancel events will be returned.
 * @param skipListenerDedup - When performing a `get()`, we don't add any new listeners, so no
 *  deduping needs to take place. This flag allows toggling of that behavior
 * @returns Cancel events, if cancelError was provided.
 */
function syncTreeRemoveEventRegistration(syncTree, query, eventRegistration, cancelError, skipListenerDedup = false) {
    // Find the syncPoint first. Then deal with whether or not it has matching listeners
    const path = query._path;
    const maybeSyncPoint = syncTree.syncPointTree_.get(path);
    let cancelEvents = [];
    // A removal on a default query affects all queries at that location. A removal on an indexed query, even one without
    // other query constraints, does *not* affect all queries at that location. So this check must be for 'default', and
    // not loadsAllData().
    if (maybeSyncPoint &&
        (query._queryIdentifier === 'default' ||
            syncPointViewExistsForQuery(maybeSyncPoint, query))) {
        const removedAndEvents = syncPointRemoveEventRegistration(maybeSyncPoint, query, eventRegistration, cancelError);
        if (syncPointIsEmpty(maybeSyncPoint)) {
            syncTree.syncPointTree_ = syncTree.syncPointTree_.remove(path);
        }
        const removed = removedAndEvents.removed;
        cancelEvents = removedAndEvents.events;
        if (!skipListenerDedup) {
            /**
             * We may have just removed one of many listeners and can short-circuit this whole process
             * We may also not have removed a default listener, in which case all of the descendant listeners should already be
             * properly set up.
             */
            // Since indexed queries can shadow if they don't have other query constraints, check for loadsAllData(), instead of
            // queryId === 'default'
            const removingDefault = -1 !==
                removed.findIndex(query => {
                    return query._queryParams.loadsAllData();
                });
            const covered = syncTree.syncPointTree_.findOnPath(path, (relativePath, parentSyncPoint) => syncPointHasCompleteView(parentSyncPoint));
            if (removingDefault && !covered) {
                const subtree = syncTree.syncPointTree_.subtree(path);
                // There are potentially child listeners. Determine what if any listens we need to send before executing the
                // removal
                if (!subtree.isEmpty()) {
                    // We need to fold over our subtree and collect the listeners to send
                    const newViews = syncTreeCollectDistinctViewsForSubTree_(subtree);
                    // Ok, we've collected all the listens we need. Set them up.
                    for (let i = 0; i < newViews.length; ++i) {
                        const view = newViews[i], newQuery = view.query;
                        const listener = syncTreeCreateListenerForView_(syncTree, view);
                        syncTree.listenProvider_.startListening(syncTreeQueryForListening_(newQuery), syncTreeTagForQuery(syncTree, newQuery), listener.hashFn, listener.onComplete);
                    }
                }
                // Otherwise there's nothing below us, so nothing we need to start listening on
            }
            // If we removed anything and we're not covered by a higher up listen, we need to stop listening on this query
            // The above block has us covered in terms of making sure we're set up on listens lower in the tree.
            // Also, note that if we have a cancelError, it's already been removed at the provider level.
            if (!covered && removed.length > 0 && !cancelError) {
                // If we removed a default, then we weren't listening on any of the other queries here. Just cancel the one
                // default. Otherwise, we need to iterate through and cancel each individual query
                if (removingDefault) {
                    // We don't tag default listeners
                    const defaultTag = null;
                    syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(query), defaultTag);
                }
                else {
                    removed.forEach((queryToRemove) => {
                        const tagToRemove = syncTree.queryToTagMap.get(syncTreeMakeQueryKey_(queryToRemove));
                        syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(queryToRemove), tagToRemove);
                    });
                }
            }
        }
        // Now, clear all of the tags we're tracking for the removed listens
        syncTreeRemoveTags_(syncTree, removed);
    }
    return cancelEvents;
}
/**
 * Apply new server data for the specified tagged query.
 *
 * @returns Events to raise.
 */
function syncTreeApplyTaggedQueryOverwrite(syncTree, path, snap, tag) {
    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
    if (queryKey != null) {
        const r = syncTreeParseQueryKey_(queryKey);
        const queryPath = r.path, queryId = r.queryId;
        const relativePath = newRelativePath(queryPath, path);
        const op = new Overwrite(newOperationSourceServerTaggedQuery(queryId), relativePath, snap);
        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
    }
    else {
        // Query must have been removed already
        return [];
    }
}
/**
 * Apply server data to be merged in for the specified tagged query.
 *
 * @returns Events to raise.
 */
function syncTreeApplyTaggedQueryMerge(syncTree, path, changedChildren, tag) {
    const queryKey = syncTreeQueryKeyForTag_(syncTree, tag);
    if (queryKey) {
        const r = syncTreeParseQueryKey_(queryKey);
        const queryPath = r.path, queryId = r.queryId;
        const relativePath = newRelativePath(queryPath, path);
        const changeTree = ImmutableTree.fromObject(changedChildren);
        const op = new Merge(newOperationSourceServerTaggedQuery(queryId), relativePath, changeTree);
        return syncTreeApplyTaggedOperation_(syncTree, queryPath, op);
    }
    else {
        // We've already removed the query. No big deal, ignore the update
        return [];
    }
}
/**
 * Add an event callback for the specified query.
 *
 * @returns Events to raise.
 */
function syncTreeAddEventRegistration(syncTree, query, eventRegistration, skipSetupListener = false) {
    const path = query._path;
    let serverCache = null;
    let foundAncestorDefaultView = false;
    // Any covering writes will necessarily be at the root, so really all we need to find is the server cache.
    // Consider optimizing this once there's a better understanding of what actual behavior will be.
    syncTree.syncPointTree_.foreachOnPath(path, (pathToSyncPoint, sp) => {
        const relativePath = newRelativePath(pathToSyncPoint, path);
        serverCache =
            serverCache || syncPointGetCompleteServerCache(sp, relativePath);
        foundAncestorDefaultView =
            foundAncestorDefaultView || syncPointHasCompleteView(sp);
    });
    let syncPoint = syncTree.syncPointTree_.get(path);
    if (!syncPoint) {
        syncPoint = new SyncPoint();
        syncTree.syncPointTree_ = syncTree.syncPointTree_.set(path, syncPoint);
    }
    else {
        foundAncestorDefaultView =
            foundAncestorDefaultView || syncPointHasCompleteView(syncPoint);
        serverCache =
            serverCache || syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
    }
    let serverCacheComplete;
    if (serverCache != null) {
        serverCacheComplete = true;
    }
    else {
        serverCacheComplete = false;
        serverCache = ChildrenNode.EMPTY_NODE;
        const subtree = syncTree.syncPointTree_.subtree(path);
        subtree.foreachChild((childName, childSyncPoint) => {
            const completeCache = syncPointGetCompleteServerCache(childSyncPoint, newEmptyPath());
            if (completeCache) {
                serverCache = serverCache.updateImmediateChild(childName, completeCache);
            }
        });
    }
    const viewAlreadyExists = syncPointViewExistsForQuery(syncPoint, query);
    if (!viewAlreadyExists && !query._queryParams.loadsAllData()) {
        // We need to track a tag for this query
        const queryKey = syncTreeMakeQueryKey_(query);
        util.assert(!syncTree.queryToTagMap.has(queryKey), 'View does not exist, but we have a tag');
        const tag = syncTreeGetNextQueryTag_();
        syncTree.queryToTagMap.set(queryKey, tag);
        syncTree.tagToQueryMap.set(tag, queryKey);
    }
    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, path);
    let events = syncPointAddEventRegistration(syncPoint, query, eventRegistration, writesCache, serverCache, serverCacheComplete);
    if (!viewAlreadyExists && !foundAncestorDefaultView && !skipSetupListener) {
        const view = syncPointViewForQuery(syncPoint, query);
        events = events.concat(syncTreeSetupListener_(syncTree, query, view));
    }
    return events;
}
/**
 * Returns a complete cache, if we have one, of the data at a particular path. If the location does not have a
 * listener above it, we will get a false "null". This shouldn't be a problem because transactions will always
 * have a listener above, and atomic operations would correctly show a jitter of <increment value> ->
 *     <incremented total> as the write is applied locally and then acknowledged at the server.
 *
 * Note: this method will *include* hidden writes from transaction with applyLocally set to false.
 *
 * @param path - The path to the data we want
 * @param writeIdsToExclude - A specific set to be excluded
 */
function syncTreeCalcCompleteEventCache(syncTree, path, writeIdsToExclude) {
    const includeHiddenSets = true;
    const writeTree = syncTree.pendingWriteTree_;
    const serverCache = syncTree.syncPointTree_.findOnPath(path, (pathSoFar, syncPoint) => {
        const relativePath = newRelativePath(pathSoFar, path);
        const serverCache = syncPointGetCompleteServerCache(syncPoint, relativePath);
        if (serverCache) {
            return serverCache;
        }
    });
    return writeTreeCalcCompleteEventCache(writeTree, path, serverCache, writeIdsToExclude, includeHiddenSets);
}
function syncTreeGetServerValue(syncTree, query) {
    const path = query._path;
    let serverCache = null;
    // Any covering writes will necessarily be at the root, so really all we need to find is the server cache.
    // Consider optimizing this once there's a better understanding of what actual behavior will be.
    syncTree.syncPointTree_.foreachOnPath(path, (pathToSyncPoint, sp) => {
        const relativePath = newRelativePath(pathToSyncPoint, path);
        serverCache =
            serverCache || syncPointGetCompleteServerCache(sp, relativePath);
    });
    let syncPoint = syncTree.syncPointTree_.get(path);
    if (!syncPoint) {
        syncPoint = new SyncPoint();
        syncTree.syncPointTree_ = syncTree.syncPointTree_.set(path, syncPoint);
    }
    else {
        serverCache =
            serverCache || syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
    }
    const serverCacheComplete = serverCache != null;
    const serverCacheNode = serverCacheComplete
        ? new CacheNode(serverCache, true, false)
        : null;
    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, query._path);
    const view = syncPointGetView(syncPoint, query, writesCache, serverCacheComplete ? serverCacheNode.getNode() : ChildrenNode.EMPTY_NODE, serverCacheComplete);
    return viewGetCompleteNode(view);
}
/**
 * A helper method that visits all descendant and ancestor SyncPoints, applying the operation.
 *
 * NOTES:
 * - Descendant SyncPoints will be visited first (since we raise events depth-first).
 *
 * - We call applyOperation() on each SyncPoint passing three things:
 *   1. A version of the Operation that has been made relative to the SyncPoint location.
 *   2. A WriteTreeRef of any writes we have cached at the SyncPoint location.
 *   3. A snapshot Node with cached server data, if we have it.
 *
 * - We concatenate all of the events returned by each SyncPoint and return the result.
 */
function syncTreeApplyOperationToSyncPoints_(syncTree, operation) {
    return syncTreeApplyOperationHelper_(operation, syncTree.syncPointTree_, 
    /*serverCache=*/ null, writeTreeChildWrites(syncTree.pendingWriteTree_, newEmptyPath()));
}
/**
 * Recursive helper for applyOperationToSyncPoints_
 */
function syncTreeApplyOperationHelper_(operation, syncPointTree, serverCache, writesCache) {
    if (pathIsEmpty(operation.path)) {
        return syncTreeApplyOperationDescendantsHelper_(operation, syncPointTree, serverCache, writesCache);
    }
    else {
        const syncPoint = syncPointTree.get(newEmptyPath());
        // If we don't have cached server data, see if we can get it from this SyncPoint.
        if (serverCache == null && syncPoint != null) {
            serverCache = syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
        }
        let events = [];
        const childName = pathGetFront(operation.path);
        const childOperation = operation.operationForChild(childName);
        const childTree = syncPointTree.children.get(childName);
        if (childTree && childOperation) {
            const childServerCache = serverCache
                ? serverCache.getImmediateChild(childName)
                : null;
            const childWritesCache = writeTreeRefChild(writesCache, childName);
            events = events.concat(syncTreeApplyOperationHelper_(childOperation, childTree, childServerCache, childWritesCache));
        }
        if (syncPoint) {
            events = events.concat(syncPointApplyOperation(syncPoint, operation, writesCache, serverCache));
        }
        return events;
    }
}
/**
 * Recursive helper for applyOperationToSyncPoints_
 */
function syncTreeApplyOperationDescendantsHelper_(operation, syncPointTree, serverCache, writesCache) {
    const syncPoint = syncPointTree.get(newEmptyPath());
    // If we don't have cached server data, see if we can get it from this SyncPoint.
    if (serverCache == null && syncPoint != null) {
        serverCache = syncPointGetCompleteServerCache(syncPoint, newEmptyPath());
    }
    let events = [];
    syncPointTree.children.inorderTraversal((childName, childTree) => {
        const childServerCache = serverCache
            ? serverCache.getImmediateChild(childName)
            : null;
        const childWritesCache = writeTreeRefChild(writesCache, childName);
        const childOperation = operation.operationForChild(childName);
        if (childOperation) {
            events = events.concat(syncTreeApplyOperationDescendantsHelper_(childOperation, childTree, childServerCache, childWritesCache));
        }
    });
    if (syncPoint) {
        events = events.concat(syncPointApplyOperation(syncPoint, operation, writesCache, serverCache));
    }
    return events;
}
function syncTreeCreateListenerForView_(syncTree, view) {
    const query = view.query;
    const tag = syncTreeTagForQuery(syncTree, query);
    return {
        hashFn: () => {
            const cache = viewGetServerCache(view) || ChildrenNode.EMPTY_NODE;
            return cache.hash();
        },
        onComplete: (status) => {
            if (status === 'ok') {
                if (tag) {
                    return syncTreeApplyTaggedListenComplete(syncTree, query._path, tag);
                }
                else {
                    return syncTreeApplyListenComplete(syncTree, query._path);
                }
            }
            else {
                // If a listen failed, kill all of the listeners here, not just the one that triggered the error.
                // Note that this may need to be scoped to just this listener if we change permissions on filtered children
                const error = errorForServerCode(status, query);
                return syncTreeRemoveEventRegistration(syncTree, query, 
                /*eventRegistration*/ null, error);
            }
        }
    };
}
/**
 * Return the tag associated with the given query.
 */
function syncTreeTagForQuery(syncTree, query) {
    const queryKey = syncTreeMakeQueryKey_(query);
    return syncTree.queryToTagMap.get(queryKey);
}
/**
 * Given a query, computes a "queryKey" suitable for use in our queryToTagMap_.
 */
function syncTreeMakeQueryKey_(query) {
    return query._path.toString() + '$' + query._queryIdentifier;
}
/**
 * Return the query associated with the given tag, if we have one
 */
function syncTreeQueryKeyForTag_(syncTree, tag) {
    return syncTree.tagToQueryMap.get(tag);
}
/**
 * Given a queryKey (created by makeQueryKey), parse it back into a path and queryId.
 */
function syncTreeParseQueryKey_(queryKey) {
    const splitIndex = queryKey.indexOf('$');
    util.assert(splitIndex !== -1 && splitIndex < queryKey.length - 1, 'Bad queryKey.');
    return {
        queryId: queryKey.substr(splitIndex + 1),
        path: new Path(queryKey.substr(0, splitIndex))
    };
}
/**
 * A helper method to apply tagged operations
 */
function syncTreeApplyTaggedOperation_(syncTree, queryPath, operation) {
    const syncPoint = syncTree.syncPointTree_.get(queryPath);
    util.assert(syncPoint, "Missing sync point for query tag that we're tracking");
    const writesCache = writeTreeChildWrites(syncTree.pendingWriteTree_, queryPath);
    return syncPointApplyOperation(syncPoint, operation, writesCache, null);
}
/**
 * This collapses multiple unfiltered views into a single view, since we only need a single
 * listener for them.
 */
function syncTreeCollectDistinctViewsForSubTree_(subtree) {
    return subtree.fold((relativePath, maybeChildSyncPoint, childMap) => {
        if (maybeChildSyncPoint && syncPointHasCompleteView(maybeChildSyncPoint)) {
            const completeView = syncPointGetCompleteView(maybeChildSyncPoint);
            return [completeView];
        }
        else {
            // No complete view here, flatten any deeper listens into an array
            let views = [];
            if (maybeChildSyncPoint) {
                views = syncPointGetQueryViews(maybeChildSyncPoint);
            }
            each(childMap, (_key, childViews) => {
                views = views.concat(childViews);
            });
            return views;
        }
    });
}
/**
 * Normalizes a query to a query we send the server for listening
 *
 * @returns The normalized query
 */
function syncTreeQueryForListening_(query) {
    if (query._queryParams.loadsAllData() && !query._queryParams.isDefault()) {
        // We treat queries that load all data as default queries
        // Cast is necessary because ref() technically returns Firebase which is actually fb.api.Firebase which inherits
        // from Query
        return new (syncTreeGetReferenceConstructor())(query._repo, query._path);
    }
    else {
        return query;
    }
}
function syncTreeRemoveTags_(syncTree, queries) {
    for (let j = 0; j < queries.length; ++j) {
        const removedQuery = queries[j];
        if (!removedQuery._queryParams.loadsAllData()) {
            // We should have a tag for this
            const removedQueryKey = syncTreeMakeQueryKey_(removedQuery);
            const removedQueryTag = syncTree.queryToTagMap.get(removedQueryKey);
            syncTree.queryToTagMap.delete(removedQueryKey);
            syncTree.tagToQueryMap.delete(removedQueryTag);
        }
    }
}
/**
 * Static accessor for query tags.
 */
function syncTreeGetNextQueryTag_() {
    return syncTreeNextQueryTag_++;
}
/**
 * For a given new listen, manage the de-duplication of outstanding subscriptions.
 *
 * @returns This method can return events to support synchronous data sources
 */
function syncTreeSetupListener_(syncTree, query, view) {
    const path = query._path;
    const tag = syncTreeTagForQuery(syncTree, query);
    const listener = syncTreeCreateListenerForView_(syncTree, view);
    const events = syncTree.listenProvider_.startListening(syncTreeQueryForListening_(query), tag, listener.hashFn, listener.onComplete);
    const subtree = syncTree.syncPointTree_.subtree(path);
    // The root of this subtree has our query. We're here because we definitely need to send a listen for that, but we
    // may need to shadow other listens as well.
    if (tag) {
        util.assert(!syncPointHasCompleteView(subtree.value), "If we're adding a query, it shouldn't be shadowed");
    }
    else {
        // Shadow everything at or below this location, this is a default listener.
        const queriesToStop = subtree.fold((relativePath, maybeChildSyncPoint, childMap) => {
            if (!pathIsEmpty(relativePath) &&
                maybeChildSyncPoint &&
                syncPointHasCompleteView(maybeChildSyncPoint)) {
                return [syncPointGetCompleteView(maybeChildSyncPoint).query];
            }
            else {
                // No default listener here, flatten any deeper queries into an array
                let queries = [];
                if (maybeChildSyncPoint) {
                    queries = queries.concat(syncPointGetQueryViews(maybeChildSyncPoint).map(view => view.query));
                }
                each(childMap, (_key, childQueries) => {
                    queries = queries.concat(childQueries);
                });
                return queries;
            }
        });
        for (let i = 0; i < queriesToStop.length; ++i) {
            const queryToStop = queriesToStop[i];
            syncTree.listenProvider_.stopListening(syncTreeQueryForListening_(queryToStop), syncTreeTagForQuery(syncTree, queryToStop));
        }
    }
    return events;
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class ExistingValueProvider {
    constructor(node_) {
        this.node_ = node_;
    }
    getImmediateChild(childName) {
        const child = this.node_.getImmediateChild(childName);
        return new ExistingValueProvider(child);
    }
    node() {
        return this.node_;
    }
}
class DeferredValueProvider {
    constructor(syncTree, path) {
        this.syncTree_ = syncTree;
        this.path_ = path;
    }
    getImmediateChild(childName) {
        const childPath = pathChild(this.path_, childName);
        return new DeferredValueProvider(this.syncTree_, childPath);
    }
    node() {
        return syncTreeCalcCompleteEventCache(this.syncTree_, this.path_);
    }
}
/**
 * Generate placeholders for deferred values.
 */
const generateWithValues = function (values) {
    values = values || {};
    values['timestamp'] = values['timestamp'] || new Date().getTime();
    return values;
};
/**
 * Value to use when firing local events. When writing server values, fire
 * local events with an approximate value, otherwise return value as-is.
 */
const resolveDeferredLeafValue = function (value, existingVal, serverValues) {
    if (!value || typeof value !== 'object') {
        return value;
    }
    util.assert('.sv' in value, 'Unexpected leaf node or priority contents');
    if (typeof value['.sv'] === 'string') {
        return resolveScalarDeferredValue(value['.sv'], existingVal, serverValues);
    }
    else if (typeof value['.sv'] === 'object') {
        return resolveComplexDeferredValue(value['.sv'], existingVal);
    }
    else {
        util.assert(false, 'Unexpected server value: ' + JSON.stringify(value, null, 2));
    }
};
const resolveScalarDeferredValue = function (op, existing, serverValues) {
    switch (op) {
        case 'timestamp':
            return serverValues['timestamp'];
        default:
            util.assert(false, 'Unexpected server value: ' + op);
    }
};
const resolveComplexDeferredValue = function (op, existing, unused) {
    if (!op.hasOwnProperty('increment')) {
        util.assert(false, 'Unexpected server value: ' + JSON.stringify(op, null, 2));
    }
    const delta = op['increment'];
    if (typeof delta !== 'number') {
        util.assert(false, 'Unexpected increment value: ' + delta);
    }
    const existingNode = existing.node();
    util.assert(existingNode !== null && typeof existingNode !== 'undefined', 'Expected ChildrenNode.EMPTY_NODE for nulls');
    // Incrementing a non-number sets the value to the incremented amount
    if (!existingNode.isLeafNode()) {
        return delta;
    }
    const leaf = existingNode;
    const existingVal = leaf.getValue();
    if (typeof existingVal !== 'number') {
        return delta;
    }
    // No need to do over/underflow arithmetic here because JS only handles floats under the covers
    return existingVal + delta;
};
/**
 * Recursively replace all deferred values and priorities in the tree with the
 * specified generated replacement values.
 * @param path - path to which write is relative
 * @param node - new data written at path
 * @param syncTree - current data
 */
const resolveDeferredValueTree = function (path, node, syncTree, serverValues) {
    return resolveDeferredValue(node, new DeferredValueProvider(syncTree, path), serverValues);
};
/**
 * Recursively replace all deferred values and priorities in the node with the
 * specified generated replacement values.  If there are no server values in the node,
 * it'll be returned as-is.
 */
const resolveDeferredValueSnapshot = function (node, existing, serverValues) {
    return resolveDeferredValue(node, new ExistingValueProvider(existing), serverValues);
};
function resolveDeferredValue(node, existingVal, serverValues) {
    const rawPri = node.getPriority().val();
    const priority = resolveDeferredLeafValue(rawPri, existingVal.getImmediateChild('.priority'), serverValues);
    let newNode;
    if (node.isLeafNode()) {
        const leafNode = node;
        const value = resolveDeferredLeafValue(leafNode.getValue(), existingVal, serverValues);
        if (value !== leafNode.getValue() ||
            priority !== leafNode.getPriority().val()) {
            return new LeafNode(value, nodeFromJSON(priority));
        }
        else {
            return node;
        }
    }
    else {
        const childrenNode = node;
        newNode = childrenNode;
        if (priority !== childrenNode.getPriority().val()) {
            newNode = newNode.updatePriority(new LeafNode(priority));
        }
        childrenNode.forEachChild(PRIORITY_INDEX, (childName, childNode) => {
            const newChildNode = resolveDeferredValue(childNode, existingVal.getImmediateChild(childName), serverValues);
            if (newChildNode !== childNode) {
                newNode = newNode.updateImmediateChild(childName, newChildNode);
            }
        });
        return newNode;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A light-weight tree, traversable by path.  Nodes can have both values and children.
 * Nodes are not enumerated (by forEachChild) unless they have a value or non-empty
 * children.
 */
class Tree {
    /**
     * @param name - Optional name of the node.
     * @param parent - Optional parent node.
     * @param node - Optional node to wrap.
     */
    constructor(name = '', parent = null, node = { children: {}, childCount: 0 }) {
        this.name = name;
        this.parent = parent;
        this.node = node;
    }
}
/**
 * Returns a sub-Tree for the given path.
 *
 * @param pathObj - Path to look up.
 * @returns Tree for path.
 */
function treeSubTree(tree, pathObj) {
    // TODO: Require pathObj to be Path?
    let path = pathObj instanceof Path ? pathObj : new Path(pathObj);
    let child = tree, next = pathGetFront(path);
    while (next !== null) {
        const childNode = util.safeGet(child.node.children, next) || {
            children: {},
            childCount: 0
        };
        child = new Tree(next, child, childNode);
        path = pathPopFront(path);
        next = pathGetFront(path);
    }
    return child;
}
/**
 * Returns the data associated with this tree node.
 *
 * @returns The data or null if no data exists.
 */
function treeGetValue(tree) {
    return tree.node.value;
}
/**
 * Sets data to this tree node.
 *
 * @param value - Value to set.
 */
function treeSetValue(tree, value) {
    tree.node.value = value;
    treeUpdateParents(tree);
}
/**
 * @returns Whether the tree has any children.
 */
function treeHasChildren(tree) {
    return tree.node.childCount > 0;
}
/**
 * @returns Whether the tree is empty (no value or children).
 */
function treeIsEmpty(tree) {
    return treeGetValue(tree) === undefined && !treeHasChildren(tree);
}
/**
 * Calls action for each child of this tree node.
 *
 * @param action - Action to be called for each child.
 */
function treeForEachChild(tree, action) {
    each(tree.node.children, (child, childTree) => {
        action(new Tree(child, tree, childTree));
    });
}
/**
 * Does a depth-first traversal of this node's descendants, calling action for each one.
 *
 * @param action - Action to be called for each child.
 * @param includeSelf - Whether to call action on this node as well. Defaults to
 *   false.
 * @param childrenFirst - Whether to call action on children before calling it on
 *   parent.
 */
function treeForEachDescendant(tree, action, includeSelf, childrenFirst) {
    if (includeSelf && !childrenFirst) {
        action(tree);
    }
    treeForEachChild(tree, child => {
        treeForEachDescendant(child, action, true, childrenFirst);
    });
    if (includeSelf && childrenFirst) {
        action(tree);
    }
}
/**
 * Calls action on each ancestor node.
 *
 * @param action - Action to be called on each parent; return
 *   true to abort.
 * @param includeSelf - Whether to call action on this node as well.
 * @returns true if the action callback returned true.
 */
function treeForEachAncestor(tree, action, includeSelf) {
    let node = includeSelf ? tree : tree.parent;
    while (node !== null) {
        if (action(node)) {
            return true;
        }
        node = node.parent;
    }
    return false;
}
/**
 * @returns The path of this tree node, as a Path.
 */
function treeGetPath(tree) {
    return new Path(tree.parent === null
        ? tree.name
        : treeGetPath(tree.parent) + '/' + tree.name);
}
/**
 * Adds or removes this child from its parent based on whether it's empty or not.
 */
function treeUpdateParents(tree) {
    if (tree.parent !== null) {
        treeUpdateChild(tree.parent, tree.name, tree);
    }
}
/**
 * Adds or removes the passed child to this tree node, depending on whether it's empty.
 *
 * @param childName - The name of the child to update.
 * @param child - The child to update.
 */
function treeUpdateChild(tree, childName, child) {
    const childEmpty = treeIsEmpty(child);
    const childExists = util.contains(tree.node.children, childName);
    if (childEmpty && childExists) {
        delete tree.node.children[childName];
        tree.node.childCount--;
        treeUpdateParents(tree);
    }
    else if (!childEmpty && !childExists) {
        tree.node.children[childName] = child.node;
        tree.node.childCount++;
        treeUpdateParents(tree);
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * True for invalid Firebase keys
 */
const INVALID_KEY_REGEX_ = /[\[\].#$\/\u0000-\u001F\u007F]/;
/**
 * True for invalid Firebase paths.
 * Allows '/' in paths.
 */
const INVALID_PATH_REGEX_ = /[\[\].#$\u0000-\u001F\u007F]/;
/**
 * Maximum number of characters to allow in leaf value
 */
const MAX_LEAF_SIZE_ = 10 * 1024 * 1024;
const isValidKey = function (key) {
    return (typeof key === 'string' && key.length !== 0 && !INVALID_KEY_REGEX_.test(key));
};
const isValidPathString = function (pathString) {
    return (typeof pathString === 'string' &&
        pathString.length !== 0 &&
        !INVALID_PATH_REGEX_.test(pathString));
};
const isValidRootPathString = function (pathString) {
    if (pathString) {
        // Allow '/.info/' at the beginning.
        pathString = pathString.replace(/^\/*\.info(\/|$)/, '/');
    }
    return isValidPathString(pathString);
};
const isValidPriority = function (priority) {
    return (priority === null ||
        typeof priority === 'string' ||
        (typeof priority === 'number' && !isInvalidJSONNumber(priority)) ||
        (priority &&
            typeof priority === 'object' &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            util.contains(priority, '.sv')));
};
/**
 * Pre-validate a datum passed as an argument to Firebase function.
 */
const validateFirebaseDataArg = function (fnName, value, path, optional) {
    if (optional && value === undefined) {
        return;
    }
    validateFirebaseData(util.errorPrefix(fnName, 'value'), value, path);
};
/**
 * Validate a data object client-side before sending to server.
 */
const validateFirebaseData = function (errorPrefix, data, path_) {
    const path = path_ instanceof Path ? new ValidationPath(path_, errorPrefix) : path_;
    if (data === undefined) {
        throw new Error(errorPrefix + 'contains undefined ' + validationPathToErrorString(path));
    }
    if (typeof data === 'function') {
        throw new Error(errorPrefix +
            'contains a function ' +
            validationPathToErrorString(path) +
            ' with contents = ' +
            data.toString());
    }
    if (isInvalidJSONNumber(data)) {
        throw new Error(errorPrefix +
            'contains ' +
            data.toString() +
            ' ' +
            validationPathToErrorString(path));
    }
    // Check max leaf size, but try to avoid the utf8 conversion if we can.
    if (typeof data === 'string' &&
        data.length > MAX_LEAF_SIZE_ / 3 &&
        util.stringLength(data) > MAX_LEAF_SIZE_) {
        throw new Error(errorPrefix +
            'contains a string greater than ' +
            MAX_LEAF_SIZE_ +
            ' utf8 bytes ' +
            validationPathToErrorString(path) +
            " ('" +
            data.substring(0, 50) +
            "...')");
    }
    // TODO = Perf = Consider combining the recursive validation of keys into NodeFromJSON
    // to save extra walking of large objects.
    if (data && typeof data === 'object') {
        let hasDotValue = false;
        let hasActualChild = false;
        each(data, (key, value) => {
            if (key === '.value') {
                hasDotValue = true;
            }
            else if (key !== '.priority' && key !== '.sv') {
                hasActualChild = true;
                if (!isValidKey(key)) {
                    throw new Error(errorPrefix +
                        ' contains an invalid key (' +
                        key +
                        ') ' +
                        validationPathToErrorString(path) +
                        '.  Keys must be non-empty strings ' +
                        'and can\'t contain ".", "#", "$", "/", "[", or "]"');
                }
            }
            validationPathPush(path, key);
            validateFirebaseData(errorPrefix, value, path);
            validationPathPop(path);
        });
        if (hasDotValue && hasActualChild) {
            throw new Error(errorPrefix +
                ' contains ".value" child ' +
                validationPathToErrorString(path) +
                ' in addition to actual children.');
        }
    }
};
/**
 * Pre-validate paths passed in the firebase function.
 */
const validateFirebaseMergePaths = function (errorPrefix, mergePaths) {
    let i, curPath;
    for (i = 0; i < mergePaths.length; i++) {
        curPath = mergePaths[i];
        const keys = pathSlice(curPath);
        for (let j = 0; j < keys.length; j++) {
            if (keys[j] === '.priority' && j === keys.length - 1) ;
            else if (!isValidKey(keys[j])) {
                throw new Error(errorPrefix +
                    'contains an invalid key (' +
                    keys[j] +
                    ') in path ' +
                    curPath.toString() +
                    '. Keys must be non-empty strings ' +
                    'and can\'t contain ".", "#", "$", "/", "[", or "]"');
            }
        }
    }
    // Check that update keys are not descendants of each other.
    // We rely on the property that sorting guarantees that ancestors come
    // right before descendants.
    mergePaths.sort(pathCompare);
    let prevPath = null;
    for (i = 0; i < mergePaths.length; i++) {
        curPath = mergePaths[i];
        if (prevPath !== null && pathContains(prevPath, curPath)) {
            throw new Error(errorPrefix +
                'contains a path ' +
                prevPath.toString() +
                ' that is ancestor of another path ' +
                curPath.toString());
        }
        prevPath = curPath;
    }
};
/**
 * pre-validate an object passed as an argument to firebase function (
 * must be an object - e.g. for firebase.update()).
 */
const validateFirebaseMergeDataArg = function (fnName, data, path, optional) {
    if (optional && data === undefined) {
        return;
    }
    const errorPrefix = util.errorPrefix(fnName, 'values');
    if (!(data && typeof data === 'object') || Array.isArray(data)) {
        throw new Error(errorPrefix + ' must be an object containing the children to replace.');
    }
    const mergePaths = [];
    each(data, (key, value) => {
        const curPath = new Path(key);
        validateFirebaseData(errorPrefix, value, pathChild(path, curPath));
        if (pathGetBack(curPath) === '.priority') {
            if (!isValidPriority(value)) {
                throw new Error(errorPrefix +
                    "contains an invalid value for '" +
                    curPath.toString() +
                    "', which must be a valid " +
                    'Firebase priority (a string, finite number, server value, or null).');
            }
        }
        mergePaths.push(curPath);
    });
    validateFirebaseMergePaths(errorPrefix, mergePaths);
};
const validatePriority = function (fnName, priority, optional) {
    if (optional && priority === undefined) {
        return;
    }
    if (isInvalidJSONNumber(priority)) {
        throw new Error(util.errorPrefix(fnName, 'priority') +
            'is ' +
            priority.toString() +
            ', but must be a valid Firebase priority (a string, finite number, ' +
            'server value, or null).');
    }
    // Special case to allow importing data with a .sv.
    if (!isValidPriority(priority)) {
        throw new Error(util.errorPrefix(fnName, 'priority') +
            'must be a valid Firebase priority ' +
            '(a string, finite number, server value, or null).');
    }
};
const validateKey = function (fnName, argumentName, key, optional) {
    if (optional && key === undefined) {
        return;
    }
    if (!isValidKey(key)) {
        throw new Error(util.errorPrefix(fnName, argumentName) +
            'was an invalid key = "' +
            key +
            '".  Firebase keys must be non-empty strings and ' +
            'can\'t contain ".", "#", "$", "/", "[", or "]").');
    }
};
/**
 * @internal
 */
const validatePathString = function (fnName, argumentName, pathString, optional) {
    if (optional && pathString === undefined) {
        return;
    }
    if (!isValidPathString(pathString)) {
        throw new Error(util.errorPrefix(fnName, argumentName) +
            'was an invalid path = "' +
            pathString +
            '". Paths must be non-empty strings and ' +
            'can\'t contain ".", "#", "$", "[", or "]"');
    }
};
const validateRootPathString = function (fnName, argumentName, pathString, optional) {
    if (pathString) {
        // Allow '/.info/' at the beginning.
        pathString = pathString.replace(/^\/*\.info(\/|$)/, '/');
    }
    validatePathString(fnName, argumentName, pathString, optional);
};
/**
 * @internal
 */
const validateWritablePath = function (fnName, path) {
    if (pathGetFront(path) === '.info') {
        throw new Error(fnName + " failed = Can't modify data under /.info/");
    }
};
const validateUrl = function (fnName, parsedUrl) {
    // TODO = Validate server better.
    const pathString = parsedUrl.path.toString();
    if (!(typeof parsedUrl.repoInfo.host === 'string') ||
        parsedUrl.repoInfo.host.length === 0 ||
        (!isValidKey(parsedUrl.repoInfo.namespace) &&
            parsedUrl.repoInfo.host.split(':')[0] !== 'localhost') ||
        (pathString.length !== 0 && !isValidRootPathString(pathString))) {
        throw new Error(util.errorPrefix(fnName, 'url') +
            'must be a valid firebase URL and ' +
            'the path can\'t contain ".", "#", "$", "[", or "]".');
    }
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * The event queue serves a few purposes:
 * 1. It ensures we maintain event order in the face of event callbacks doing operations that result in more
 *    events being queued.
 * 2. raiseQueuedEvents() handles being called reentrantly nicely.  That is, if in the course of raising events,
 *    raiseQueuedEvents() is called again, the "inner" call will pick up raising events where the "outer" call
 *    left off, ensuring that the events are still raised synchronously and in order.
 * 3. You can use raiseEventsAtPath and raiseEventsForChangedPath to ensure only relevant previously-queued
 *    events are raised synchronously.
 *
 * NOTE: This can all go away if/when we move to async events.
 *
 */
class EventQueue {
    constructor() {
        this.eventLists_ = [];
        /**
         * Tracks recursion depth of raiseQueuedEvents_, for debugging purposes.
         */
        this.recursionDepth_ = 0;
    }
}
/**
 * @param eventDataList - The new events to queue.
 */
function eventQueueQueueEvents(eventQueue, eventDataList) {
    // We group events by path, storing them in a single EventList, to make it easier to skip over them quickly.
    let currList = null;
    for (let i = 0; i < eventDataList.length; i++) {
        const data = eventDataList[i];
        const path = data.getPath();
        if (currList !== null && !pathEquals(path, currList.path)) {
            eventQueue.eventLists_.push(currList);
            currList = null;
        }
        if (currList === null) {
            currList = { events: [], path };
        }
        currList.events.push(data);
    }
    if (currList) {
        eventQueue.eventLists_.push(currList);
    }
}
/**
 * Queues the specified events and synchronously raises all events (including previously queued ones)
 * for the specified path.
 *
 * It is assumed that the new events are all for the specified path.
 *
 * @param path - The path to raise events for.
 * @param eventDataList - The new events to raise.
 */
function eventQueueRaiseEventsAtPath(eventQueue, path, eventDataList) {
    eventQueueQueueEvents(eventQueue, eventDataList);
    eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, eventPath => pathEquals(eventPath, path));
}
/**
 * Queues the specified events and synchronously raises all events (including previously queued ones) for
 * locations related to the specified change path (i.e. all ancestors and descendants).
 *
 * It is assumed that the new events are all related (ancestor or descendant) to the specified path.
 *
 * @param changedPath - The path to raise events for.
 * @param eventDataList - The events to raise
 */
function eventQueueRaiseEventsForChangedPath(eventQueue, changedPath, eventDataList) {
    eventQueueQueueEvents(eventQueue, eventDataList);
    eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, eventPath => pathContains(eventPath, changedPath) ||
        pathContains(changedPath, eventPath));
}
function eventQueueRaiseQueuedEventsMatchingPredicate(eventQueue, predicate) {
    eventQueue.recursionDepth_++;
    let sentAll = true;
    for (let i = 0; i < eventQueue.eventLists_.length; i++) {
        const eventList = eventQueue.eventLists_[i];
        if (eventList) {
            const eventPath = eventList.path;
            if (predicate(eventPath)) {
                eventListRaise(eventQueue.eventLists_[i]);
                eventQueue.eventLists_[i] = null;
            }
            else {
                sentAll = false;
            }
        }
    }
    if (sentAll) {
        eventQueue.eventLists_ = [];
    }
    eventQueue.recursionDepth_--;
}
/**
 * Iterates through the list and raises each event
 */
function eventListRaise(eventList) {
    for (let i = 0; i < eventList.events.length; i++) {
        const eventData = eventList.events[i];
        if (eventData !== null) {
            eventList.events[i] = null;
            const eventFn = eventData.getEventRunner();
            if (logger) {
                log('event: ' + eventData.toString());
            }
            exceptionGuard(eventFn);
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const INTERRUPT_REASON = 'repo_interrupt';
/**
 * If a transaction does not succeed after 25 retries, we abort it. Among other
 * things this ensure that if there's ever a bug causing a mismatch between
 * client / server hashes for some data, we won't retry indefinitely.
 */
const MAX_TRANSACTION_RETRIES = 25;
/**
 * A connection to a single data repository.
 */
class Repo {
    constructor(repoInfo_, forceRestClient_, authTokenProvider_, appCheckProvider_) {
        this.repoInfo_ = repoInfo_;
        this.forceRestClient_ = forceRestClient_;
        this.authTokenProvider_ = authTokenProvider_;
        this.appCheckProvider_ = appCheckProvider_;
        this.dataUpdateCount = 0;
        this.statsListener_ = null;
        this.eventQueue_ = new EventQueue();
        this.nextWriteId_ = 1;
        this.interceptServerDataCallback_ = null;
        /** A list of data pieces and paths to be set when this client disconnects. */
        this.onDisconnect_ = newSparseSnapshotTree();
        /** Stores queues of outstanding transactions for Firebase locations. */
        this.transactionQueueTree_ = new Tree();
        // TODO: This should be @private but it's used by test_access.js and internal.js
        this.persistentConnection_ = null;
        // This key is intentionally not updated if RepoInfo is later changed or replaced
        this.key = this.repoInfo_.toURLString();
    }
    /**
     * @returns The URL corresponding to the root of this Firebase.
     */
    toString() {
        return ((this.repoInfo_.secure ? 'https://' : 'http://') + this.repoInfo_.host);
    }
}
function repoStart(repo, appId, authOverride) {
    repo.stats_ = statsManagerGetCollection(repo.repoInfo_);
    if (repo.forceRestClient_ || beingCrawled()) {
        repo.server_ = new ReadonlyRestClient(repo.repoInfo_, (pathString, data, isMerge, tag) => {
            repoOnDataUpdate(repo, pathString, data, isMerge, tag);
        }, repo.authTokenProvider_, repo.appCheckProvider_);
        // Minor hack: Fire onConnect immediately, since there's no actual connection.
        setTimeout(() => repoOnConnectStatus(repo, /* connectStatus= */ true), 0);
    }
    else {
        // Validate authOverride
        if (typeof authOverride !== 'undefined' && authOverride !== null) {
            if (typeof authOverride !== 'object') {
                throw new Error('Only objects are supported for option databaseAuthVariableOverride');
            }
            try {
                util.stringify(authOverride);
            }
            catch (e) {
                throw new Error('Invalid authOverride provided: ' + e);
            }
        }
        repo.persistentConnection_ = new PersistentConnection(repo.repoInfo_, appId, (pathString, data, isMerge, tag) => {
            repoOnDataUpdate(repo, pathString, data, isMerge, tag);
        }, (connectStatus) => {
            repoOnConnectStatus(repo, connectStatus);
        }, (updates) => {
            repoOnServerInfoUpdate(repo, updates);
        }, repo.authTokenProvider_, repo.appCheckProvider_, authOverride);
        repo.server_ = repo.persistentConnection_;
    }
    repo.authTokenProvider_.addTokenChangeListener(token => {
        repo.server_.refreshAuthToken(token);
    });
    repo.appCheckProvider_.addTokenChangeListener(result => {
        repo.server_.refreshAppCheckToken(result.token);
    });
    // In the case of multiple Repos for the same repoInfo (i.e. there are multiple Firebase.Contexts being used),
    // we only want to create one StatsReporter.  As such, we'll report stats over the first Repo created.
    repo.statsReporter_ = statsManagerGetOrCreateReporter(repo.repoInfo_, () => new StatsReporter(repo.stats_, repo.server_));
    // Used for .info.
    repo.infoData_ = new SnapshotHolder();
    repo.infoSyncTree_ = new SyncTree({
        startListening: (query, tag, currentHashFn, onComplete) => {
            let infoEvents = [];
            const node = repo.infoData_.getNode(query._path);
            // This is possibly a hack, but we have different semantics for .info endpoints. We don't raise null events
            // on initial data...
            if (!node.isEmpty()) {
                infoEvents = syncTreeApplyServerOverwrite(repo.infoSyncTree_, query._path, node);
                setTimeout(() => {
                    onComplete('ok');
                }, 0);
            }
            return infoEvents;
        },
        stopListening: () => { }
    });
    repoUpdateInfo(repo, 'connected', false);
    repo.serverSyncTree_ = new SyncTree({
        startListening: (query, tag, currentHashFn, onComplete) => {
            repo.server_.listen(query, currentHashFn, tag, (status, data) => {
                const events = onComplete(status, data);
                eventQueueRaiseEventsForChangedPath(repo.eventQueue_, query._path, events);
            });
            // No synchronous events for network-backed sync trees
            return [];
        },
        stopListening: (query, tag) => {
            repo.server_.unlisten(query, tag);
        }
    });
}
/**
 * @returns The time in milliseconds, taking the server offset into account if we have one.
 */
function repoServerTime(repo) {
    const offsetNode = repo.infoData_.getNode(new Path('.info/serverTimeOffset'));
    const offset = offsetNode.val() || 0;
    return new Date().getTime() + offset;
}
/**
 * Generate ServerValues using some variables from the repo object.
 */
function repoGenerateServerValues(repo) {
    return generateWithValues({
        timestamp: repoServerTime(repo)
    });
}
/**
 * Called by realtime when we get new messages from the server.
 */
function repoOnDataUpdate(repo, pathString, data, isMerge, tag) {
    // For testing.
    repo.dataUpdateCount++;
    const path = new Path(pathString);
    data = repo.interceptServerDataCallback_
        ? repo.interceptServerDataCallback_(pathString, data)
        : data;
    let events = [];
    if (tag) {
        if (isMerge) {
            const taggedChildren = util.map(data, (raw) => nodeFromJSON(raw));
            events = syncTreeApplyTaggedQueryMerge(repo.serverSyncTree_, path, taggedChildren, tag);
        }
        else {
            const taggedSnap = nodeFromJSON(data);
            events = syncTreeApplyTaggedQueryOverwrite(repo.serverSyncTree_, path, taggedSnap, tag);
        }
    }
    else if (isMerge) {
        const changedChildren = util.map(data, (raw) => nodeFromJSON(raw));
        events = syncTreeApplyServerMerge(repo.serverSyncTree_, path, changedChildren);
    }
    else {
        const snap = nodeFromJSON(data);
        events = syncTreeApplyServerOverwrite(repo.serverSyncTree_, path, snap);
    }
    let affectedPath = path;
    if (events.length > 0) {
        // Since we have a listener outstanding for each transaction, receiving any events
        // is a proxy for some change having occurred.
        affectedPath = repoRerunTransactions(repo, path);
    }
    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, affectedPath, events);
}
function repoOnConnectStatus(repo, connectStatus) {
    repoUpdateInfo(repo, 'connected', connectStatus);
    if (connectStatus === false) {
        repoRunOnDisconnectEvents(repo);
    }
}
function repoOnServerInfoUpdate(repo, updates) {
    each(updates, (key, value) => {
        repoUpdateInfo(repo, key, value);
    });
}
function repoUpdateInfo(repo, pathString, value) {
    const path = new Path('/.info/' + pathString);
    const newNode = nodeFromJSON(value);
    repo.infoData_.updateSnapshot(path, newNode);
    const events = syncTreeApplyServerOverwrite(repo.infoSyncTree_, path, newNode);
    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
}
function repoGetNextWriteId(repo) {
    return repo.nextWriteId_++;
}
/**
 * The purpose of `getValue` is to return the latest known value
 * satisfying `query`.
 *
 * This method will first check for in-memory cached values
 * belonging to active listeners. If they are found, such values
 * are considered to be the most up-to-date.
 *
 * If the client is not connected, this method will wait until the
 *  repo has established a connection and then request the value for `query`.
 * If the client is not able to retrieve the query result for another reason,
 * it reports an error.
 *
 * @param query - The query to surface a value for.
 */
function repoGetValue(repo, query, eventRegistration) {
    // Only active queries are cached. There is no persisted cache.
    const cached = syncTreeGetServerValue(repo.serverSyncTree_, query);
    if (cached != null) {
        return Promise.resolve(cached);
    }
    return repo.server_.get(query).then(payload => {
        const node = nodeFromJSON(payload).withIndex(query._queryParams.getIndex());
        /**
         * Below we simulate the actions of an `onlyOnce` `onValue()` event where:
         * Add an event registration,
         * Update data at the path,
         * Raise any events,
         * Cleanup the SyncTree
         */
        syncTreeAddEventRegistration(repo.serverSyncTree_, query, eventRegistration, true);
        let events;
        if (query._queryParams.loadsAllData()) {
            events = syncTreeApplyServerOverwrite(repo.serverSyncTree_, query._path, node);
        }
        else {
            const tag = syncTreeTagForQuery(repo.serverSyncTree_, query);
            events = syncTreeApplyTaggedQueryOverwrite(repo.serverSyncTree_, query._path, node, tag);
        }
        /*
         * We need to raise events in the scenario where `get()` is called at a parent path, and
         * while the `get()` is pending, `onValue` is called at a child location. While get() is waiting
         * for the data, `onValue` will register a new event. Then, get() will come back, and update the syncTree
         * and its corresponding serverCache, including the child location where `onValue` is called. Then,
         * `onValue` will receive the event from the server, but look at the syncTree and see that the data received
         * from the server is already at the SyncPoint, and so the `onValue` callback will never get fired.
         * Calling `eventQueueRaiseEventsForChangedPath()` is the correct way to propagate the events and
         * ensure the corresponding child events will get fired.
         */
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, query._path, events);
        syncTreeRemoveEventRegistration(repo.serverSyncTree_, query, eventRegistration, null, true);
        return node;
    }, err => {
        repoLog(repo, 'get for query ' + util.stringify(query) + ' failed: ' + err);
        return Promise.reject(new Error(err));
    });
}
function repoSetWithPriority(repo, path, newVal, newPriority, onComplete) {
    repoLog(repo, 'set', {
        path: path.toString(),
        value: newVal,
        priority: newPriority
    });
    // TODO: Optimize this behavior to either (a) store flag to skip resolving where possible and / or
    // (b) store unresolved paths on JSON parse
    const serverValues = repoGenerateServerValues(repo);
    const newNodeUnresolved = nodeFromJSON(newVal, newPriority);
    const existing = syncTreeCalcCompleteEventCache(repo.serverSyncTree_, path);
    const newNode = resolveDeferredValueSnapshot(newNodeUnresolved, existing, serverValues);
    const writeId = repoGetNextWriteId(repo);
    const events = syncTreeApplyUserOverwrite(repo.serverSyncTree_, path, newNode, writeId, true);
    eventQueueQueueEvents(repo.eventQueue_, events);
    repo.server_.put(path.toString(), newNodeUnresolved.val(/*export=*/ true), (status, errorReason) => {
        const success = status === 'ok';
        if (!success) {
            warn$1('set at ' + path + ' failed: ' + status);
        }
        const clearEvents = syncTreeAckUserWrite(repo.serverSyncTree_, writeId, !success);
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, clearEvents);
        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
    });
    const affectedPath = repoAbortTransactions(repo, path);
    repoRerunTransactions(repo, affectedPath);
    // We queued the events above, so just flush the queue here
    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, affectedPath, []);
}
function repoUpdate(repo, path, childrenToMerge, onComplete) {
    repoLog(repo, 'update', { path: path.toString(), value: childrenToMerge });
    // Start with our existing data and merge each child into it.
    let empty = true;
    const serverValues = repoGenerateServerValues(repo);
    const changedChildren = {};
    each(childrenToMerge, (changedKey, changedValue) => {
        empty = false;
        changedChildren[changedKey] = resolveDeferredValueTree(pathChild(path, changedKey), nodeFromJSON(changedValue), repo.serverSyncTree_, serverValues);
    });
    if (!empty) {
        const writeId = repoGetNextWriteId(repo);
        const events = syncTreeApplyUserMerge(repo.serverSyncTree_, path, changedChildren, writeId);
        eventQueueQueueEvents(repo.eventQueue_, events);
        repo.server_.merge(path.toString(), childrenToMerge, (status, errorReason) => {
            const success = status === 'ok';
            if (!success) {
                warn$1('update at ' + path + ' failed: ' + status);
            }
            const clearEvents = syncTreeAckUserWrite(repo.serverSyncTree_, writeId, !success);
            const affectedPath = clearEvents.length > 0 ? repoRerunTransactions(repo, path) : path;
            eventQueueRaiseEventsForChangedPath(repo.eventQueue_, affectedPath, clearEvents);
            repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
        });
        each(childrenToMerge, (changedPath) => {
            const affectedPath = repoAbortTransactions(repo, pathChild(path, changedPath));
            repoRerunTransactions(repo, affectedPath);
        });
        // We queued the events above, so just flush the queue here
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, []);
    }
    else {
        log("update() called with empty data.  Don't do anything.");
        repoCallOnCompleteCallback(repo, onComplete, 'ok', undefined);
    }
}
/**
 * Applies all of the changes stored up in the onDisconnect_ tree.
 */
function repoRunOnDisconnectEvents(repo) {
    repoLog(repo, 'onDisconnectEvents');
    const serverValues = repoGenerateServerValues(repo);
    const resolvedOnDisconnectTree = newSparseSnapshotTree();
    sparseSnapshotTreeForEachTree(repo.onDisconnect_, newEmptyPath(), (path, node) => {
        const resolved = resolveDeferredValueTree(path, node, repo.serverSyncTree_, serverValues);
        sparseSnapshotTreeRemember(resolvedOnDisconnectTree, path, resolved);
    });
    let events = [];
    sparseSnapshotTreeForEachTree(resolvedOnDisconnectTree, newEmptyPath(), (path, snap) => {
        events = events.concat(syncTreeApplyServerOverwrite(repo.serverSyncTree_, path, snap));
        const affectedPath = repoAbortTransactions(repo, path);
        repoRerunTransactions(repo, affectedPath);
    });
    repo.onDisconnect_ = newSparseSnapshotTree();
    eventQueueRaiseEventsForChangedPath(repo.eventQueue_, newEmptyPath(), events);
}
function repoOnDisconnectCancel(repo, path, onComplete) {
    repo.server_.onDisconnectCancel(path.toString(), (status, errorReason) => {
        if (status === 'ok') {
            sparseSnapshotTreeForget(repo.onDisconnect_, path);
        }
        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
    });
}
function repoOnDisconnectSet(repo, path, value, onComplete) {
    const newNode = nodeFromJSON(value);
    repo.server_.onDisconnectPut(path.toString(), newNode.val(/*export=*/ true), (status, errorReason) => {
        if (status === 'ok') {
            sparseSnapshotTreeRemember(repo.onDisconnect_, path, newNode);
        }
        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
    });
}
function repoOnDisconnectSetWithPriority(repo, path, value, priority, onComplete) {
    const newNode = nodeFromJSON(value, priority);
    repo.server_.onDisconnectPut(path.toString(), newNode.val(/*export=*/ true), (status, errorReason) => {
        if (status === 'ok') {
            sparseSnapshotTreeRemember(repo.onDisconnect_, path, newNode);
        }
        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
    });
}
function repoOnDisconnectUpdate(repo, path, childrenToMerge, onComplete) {
    if (util.isEmpty(childrenToMerge)) {
        log("onDisconnect().update() called with empty data.  Don't do anything.");
        repoCallOnCompleteCallback(repo, onComplete, 'ok', undefined);
        return;
    }
    repo.server_.onDisconnectMerge(path.toString(), childrenToMerge, (status, errorReason) => {
        if (status === 'ok') {
            each(childrenToMerge, (childName, childNode) => {
                const newChildNode = nodeFromJSON(childNode);
                sparseSnapshotTreeRemember(repo.onDisconnect_, pathChild(path, childName), newChildNode);
            });
        }
        repoCallOnCompleteCallback(repo, onComplete, status, errorReason);
    });
}
function repoAddEventCallbackForQuery(repo, query, eventRegistration) {
    let events;
    if (pathGetFront(query._path) === '.info') {
        events = syncTreeAddEventRegistration(repo.infoSyncTree_, query, eventRegistration);
    }
    else {
        events = syncTreeAddEventRegistration(repo.serverSyncTree_, query, eventRegistration);
    }
    eventQueueRaiseEventsAtPath(repo.eventQueue_, query._path, events);
}
function repoRemoveEventCallbackForQuery(repo, query, eventRegistration) {
    // These are guaranteed not to raise events, since we're not passing in a cancelError. However, we can future-proof
    // a little bit by handling the return values anyways.
    let events;
    if (pathGetFront(query._path) === '.info') {
        events = syncTreeRemoveEventRegistration(repo.infoSyncTree_, query, eventRegistration);
    }
    else {
        events = syncTreeRemoveEventRegistration(repo.serverSyncTree_, query, eventRegistration);
    }
    eventQueueRaiseEventsAtPath(repo.eventQueue_, query._path, events);
}
function repoInterrupt(repo) {
    if (repo.persistentConnection_) {
        repo.persistentConnection_.interrupt(INTERRUPT_REASON);
    }
}
function repoResume(repo) {
    if (repo.persistentConnection_) {
        repo.persistentConnection_.resume(INTERRUPT_REASON);
    }
}
function repoLog(repo, ...varArgs) {
    let prefix = '';
    if (repo.persistentConnection_) {
        prefix = repo.persistentConnection_.id + ':';
    }
    log(prefix, ...varArgs);
}
function repoCallOnCompleteCallback(repo, callback, status, errorReason) {
    if (callback) {
        exceptionGuard(() => {
            if (status === 'ok') {
                callback(null);
            }
            else {
                const code = (status || 'error').toUpperCase();
                let message = code;
                if (errorReason) {
                    message += ': ' + errorReason;
                }
                const error = new Error(message);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                error.code = code;
                callback(error);
            }
        });
    }
}
/**
 * Creates a new transaction, adds it to the transactions we're tracking, and
 * sends it to the server if possible.
 *
 * @param path - Path at which to do transaction.
 * @param transactionUpdate - Update callback.
 * @param onComplete - Completion callback.
 * @param unwatcher - Function that will be called when the transaction no longer
 * need data updates for `path`.
 * @param applyLocally - Whether or not to make intermediate results visible
 */
function repoStartTransaction(repo, path, transactionUpdate, onComplete, unwatcher, applyLocally) {
    repoLog(repo, 'transaction on ' + path);
    // Initialize transaction.
    const transaction = {
        path,
        update: transactionUpdate,
        onComplete,
        // One of TransactionStatus enums.
        status: null,
        // Used when combining transactions at different locations to figure out
        // which one goes first.
        order: LUIDGenerator(),
        // Whether to raise local events for this transaction.
        applyLocally,
        // Count of how many times we've retried the transaction.
        retryCount: 0,
        // Function to call to clean up our .on() listener.
        unwatcher,
        // Stores why a transaction was aborted.
        abortReason: null,
        currentWriteId: null,
        currentInputSnapshot: null,
        currentOutputSnapshotRaw: null,
        currentOutputSnapshotResolved: null
    };
    // Run transaction initially.
    const currentState = repoGetLatestState(repo, path, undefined);
    transaction.currentInputSnapshot = currentState;
    const newVal = transaction.update(currentState.val());
    if (newVal === undefined) {
        // Abort transaction.
        transaction.unwatcher();
        transaction.currentOutputSnapshotRaw = null;
        transaction.currentOutputSnapshotResolved = null;
        if (transaction.onComplete) {
            transaction.onComplete(null, false, transaction.currentInputSnapshot);
        }
    }
    else {
        validateFirebaseData('transaction failed: Data returned ', newVal, transaction.path);
        // Mark as run and add to our queue.
        transaction.status = 0 /* TransactionStatus.RUN */;
        const queueNode = treeSubTree(repo.transactionQueueTree_, path);
        const nodeQueue = treeGetValue(queueNode) || [];
        nodeQueue.push(transaction);
        treeSetValue(queueNode, nodeQueue);
        // Update visibleData and raise events
        // Note: We intentionally raise events after updating all of our
        // transaction state, since the user could start new transactions from the
        // event callbacks.
        let priorityForNode;
        if (typeof newVal === 'object' &&
            newVal !== null &&
            util.contains(newVal, '.priority')) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            priorityForNode = util.safeGet(newVal, '.priority');
            util.assert(isValidPriority(priorityForNode), 'Invalid priority returned by transaction. ' +
                'Priority must be a valid string, finite number, server value, or null.');
        }
        else {
            const currentNode = syncTreeCalcCompleteEventCache(repo.serverSyncTree_, path) ||
                ChildrenNode.EMPTY_NODE;
            priorityForNode = currentNode.getPriority().val();
        }
        const serverValues = repoGenerateServerValues(repo);
        const newNodeUnresolved = nodeFromJSON(newVal, priorityForNode);
        const newNode = resolveDeferredValueSnapshot(newNodeUnresolved, currentState, serverValues);
        transaction.currentOutputSnapshotRaw = newNodeUnresolved;
        transaction.currentOutputSnapshotResolved = newNode;
        transaction.currentWriteId = repoGetNextWriteId(repo);
        const events = syncTreeApplyUserOverwrite(repo.serverSyncTree_, path, newNode, transaction.currentWriteId, transaction.applyLocally);
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
        repoSendReadyTransactions(repo, repo.transactionQueueTree_);
    }
}
/**
 * @param excludeSets - A specific set to exclude
 */
function repoGetLatestState(repo, path, excludeSets) {
    return (syncTreeCalcCompleteEventCache(repo.serverSyncTree_, path, excludeSets) ||
        ChildrenNode.EMPTY_NODE);
}
/**
 * Sends any already-run transactions that aren't waiting for outstanding
 * transactions to complete.
 *
 * Externally it's called with no arguments, but it calls itself recursively
 * with a particular transactionQueueTree node to recurse through the tree.
 *
 * @param node - transactionQueueTree node to start at.
 */
function repoSendReadyTransactions(repo, node = repo.transactionQueueTree_) {
    // Before recursing, make sure any completed transactions are removed.
    if (!node) {
        repoPruneCompletedTransactionsBelowNode(repo, node);
    }
    if (treeGetValue(node)) {
        const queue = repoBuildTransactionQueue(repo, node);
        util.assert(queue.length > 0, 'Sending zero length transaction queue');
        const allRun = queue.every((transaction) => transaction.status === 0 /* TransactionStatus.RUN */);
        // If they're all run (and not sent), we can send them.  Else, we must wait.
        if (allRun) {
            repoSendTransactionQueue(repo, treeGetPath(node), queue);
        }
    }
    else if (treeHasChildren(node)) {
        treeForEachChild(node, childNode => {
            repoSendReadyTransactions(repo, childNode);
        });
    }
}
/**
 * Given a list of run transactions, send them to the server and then handle
 * the result (success or failure).
 *
 * @param path - The location of the queue.
 * @param queue - Queue of transactions under the specified location.
 */
function repoSendTransactionQueue(repo, path, queue) {
    // Mark transactions as sent and increment retry count!
    const setsToIgnore = queue.map(txn => {
        return txn.currentWriteId;
    });
    const latestState = repoGetLatestState(repo, path, setsToIgnore);
    let snapToSend = latestState;
    const latestHash = latestState.hash();
    for (let i = 0; i < queue.length; i++) {
        const txn = queue[i];
        util.assert(txn.status === 0 /* TransactionStatus.RUN */, 'tryToSendTransactionQueue_: items in queue should all be run.');
        txn.status = 1 /* TransactionStatus.SENT */;
        txn.retryCount++;
        const relativePath = newRelativePath(path, txn.path);
        // If we've gotten to this point, the output snapshot must be defined.
        snapToSend = snapToSend.updateChild(relativePath /** @type {!Node} */, txn.currentOutputSnapshotRaw);
    }
    const dataToSend = snapToSend.val(true);
    const pathToSend = path;
    // Send the put.
    repo.server_.put(pathToSend.toString(), dataToSend, (status) => {
        repoLog(repo, 'transaction put response', {
            path: pathToSend.toString(),
            status
        });
        let events = [];
        if (status === 'ok') {
            // Queue up the callbacks and fire them after cleaning up all of our
            // transaction state, since the callback could trigger more
            // transactions or sets.
            const callbacks = [];
            for (let i = 0; i < queue.length; i++) {
                queue[i].status = 2 /* TransactionStatus.COMPLETED */;
                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, queue[i].currentWriteId));
                if (queue[i].onComplete) {
                    // We never unset the output snapshot, and given that this
                    // transaction is complete, it should be set
                    callbacks.push(() => queue[i].onComplete(null, true, queue[i].currentOutputSnapshotResolved));
                }
                queue[i].unwatcher();
            }
            // Now remove the completed transactions.
            repoPruneCompletedTransactionsBelowNode(repo, treeSubTree(repo.transactionQueueTree_, path));
            // There may be pending transactions that we can now send.
            repoSendReadyTransactions(repo, repo.transactionQueueTree_);
            eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
            // Finally, trigger onComplete callbacks.
            for (let i = 0; i < callbacks.length; i++) {
                exceptionGuard(callbacks[i]);
            }
        }
        else {
            // transactions are no longer sent.  Update their status appropriately.
            if (status === 'datastale') {
                for (let i = 0; i < queue.length; i++) {
                    if (queue[i].status === 3 /* TransactionStatus.SENT_NEEDS_ABORT */) {
                        queue[i].status = 4 /* TransactionStatus.NEEDS_ABORT */;
                    }
                    else {
                        queue[i].status = 0 /* TransactionStatus.RUN */;
                    }
                }
            }
            else {
                warn$1('transaction at ' + pathToSend.toString() + ' failed: ' + status);
                for (let i = 0; i < queue.length; i++) {
                    queue[i].status = 4 /* TransactionStatus.NEEDS_ABORT */;
                    queue[i].abortReason = status;
                }
            }
            repoRerunTransactions(repo, path);
        }
    }, latestHash);
}
/**
 * Finds all transactions dependent on the data at changedPath and reruns them.
 *
 * Should be called any time cached data changes.
 *
 * Return the highest path that was affected by rerunning transactions. This
 * is the path at which events need to be raised for.
 *
 * @param changedPath - The path in mergedData that changed.
 * @returns The rootmost path that was affected by rerunning transactions.
 */
function repoRerunTransactions(repo, changedPath) {
    const rootMostTransactionNode = repoGetAncestorTransactionNode(repo, changedPath);
    const path = treeGetPath(rootMostTransactionNode);
    const queue = repoBuildTransactionQueue(repo, rootMostTransactionNode);
    repoRerunTransactionQueue(repo, queue, path);
    return path;
}
/**
 * Does all the work of rerunning transactions (as well as cleans up aborted
 * transactions and whatnot).
 *
 * @param queue - The queue of transactions to run.
 * @param path - The path the queue is for.
 */
function repoRerunTransactionQueue(repo, queue, path) {
    if (queue.length === 0) {
        return; // Nothing to do!
    }
    // Queue up the callbacks and fire them after cleaning up all of our
    // transaction state, since the callback could trigger more transactions or
    // sets.
    const callbacks = [];
    let events = [];
    // Ignore all of the sets we're going to re-run.
    const txnsToRerun = queue.filter(q => {
        return q.status === 0 /* TransactionStatus.RUN */;
    });
    const setsToIgnore = txnsToRerun.map(q => {
        return q.currentWriteId;
    });
    for (let i = 0; i < queue.length; i++) {
        const transaction = queue[i];
        const relativePath = newRelativePath(path, transaction.path);
        let abortTransaction = false, abortReason;
        util.assert(relativePath !== null, 'rerunTransactionsUnderNode_: relativePath should not be null.');
        if (transaction.status === 4 /* TransactionStatus.NEEDS_ABORT */) {
            abortTransaction = true;
            abortReason = transaction.abortReason;
            events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
        }
        else if (transaction.status === 0 /* TransactionStatus.RUN */) {
            if (transaction.retryCount >= MAX_TRANSACTION_RETRIES) {
                abortTransaction = true;
                abortReason = 'maxretry';
                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
            }
            else {
                // This code reruns a transaction
                const currentNode = repoGetLatestState(repo, transaction.path, setsToIgnore);
                transaction.currentInputSnapshot = currentNode;
                const newData = queue[i].update(currentNode.val());
                if (newData !== undefined) {
                    validateFirebaseData('transaction failed: Data returned ', newData, transaction.path);
                    let newDataNode = nodeFromJSON(newData);
                    const hasExplicitPriority = typeof newData === 'object' &&
                        newData != null &&
                        util.contains(newData, '.priority');
                    if (!hasExplicitPriority) {
                        // Keep the old priority if there wasn't a priority explicitly specified.
                        newDataNode = newDataNode.updatePriority(currentNode.getPriority());
                    }
                    const oldWriteId = transaction.currentWriteId;
                    const serverValues = repoGenerateServerValues(repo);
                    const newNodeResolved = resolveDeferredValueSnapshot(newDataNode, currentNode, serverValues);
                    transaction.currentOutputSnapshotRaw = newDataNode;
                    transaction.currentOutputSnapshotResolved = newNodeResolved;
                    transaction.currentWriteId = repoGetNextWriteId(repo);
                    // Mutates setsToIgnore in place
                    setsToIgnore.splice(setsToIgnore.indexOf(oldWriteId), 1);
                    events = events.concat(syncTreeApplyUserOverwrite(repo.serverSyncTree_, transaction.path, newNodeResolved, transaction.currentWriteId, transaction.applyLocally));
                    events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, oldWriteId, true));
                }
                else {
                    abortTransaction = true;
                    abortReason = 'nodata';
                    events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, transaction.currentWriteId, true));
                }
            }
        }
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, path, events);
        events = [];
        if (abortTransaction) {
            // Abort.
            queue[i].status = 2 /* TransactionStatus.COMPLETED */;
            // Removing a listener can trigger pruning which can muck with
            // mergedData/visibleData (as it prunes data). So defer the unwatcher
            // until we're done.
            (function (unwatcher) {
                setTimeout(unwatcher, Math.floor(0));
            })(queue[i].unwatcher);
            if (queue[i].onComplete) {
                if (abortReason === 'nodata') {
                    callbacks.push(() => queue[i].onComplete(null, false, queue[i].currentInputSnapshot));
                }
                else {
                    callbacks.push(() => queue[i].onComplete(new Error(abortReason), false, null));
                }
            }
        }
    }
    // Clean up completed transactions.
    repoPruneCompletedTransactionsBelowNode(repo, repo.transactionQueueTree_);
    // Now fire callbacks, now that we're in a good, known state.
    for (let i = 0; i < callbacks.length; i++) {
        exceptionGuard(callbacks[i]);
    }
    // Try to send the transaction result to the server.
    repoSendReadyTransactions(repo, repo.transactionQueueTree_);
}
/**
 * Returns the rootmost ancestor node of the specified path that has a pending
 * transaction on it, or just returns the node for the given path if there are
 * no pending transactions on any ancestor.
 *
 * @param path - The location to start at.
 * @returns The rootmost node with a transaction.
 */
function repoGetAncestorTransactionNode(repo, path) {
    let front;
    // Start at the root and walk deeper into the tree towards path until we
    // find a node with pending transactions.
    let transactionNode = repo.transactionQueueTree_;
    front = pathGetFront(path);
    while (front !== null && treeGetValue(transactionNode) === undefined) {
        transactionNode = treeSubTree(transactionNode, front);
        path = pathPopFront(path);
        front = pathGetFront(path);
    }
    return transactionNode;
}
/**
 * Builds the queue of all transactions at or below the specified
 * transactionNode.
 *
 * @param transactionNode
 * @returns The generated queue.
 */
function repoBuildTransactionQueue(repo, transactionNode) {
    // Walk any child transaction queues and aggregate them into a single queue.
    const transactionQueue = [];
    repoAggregateTransactionQueuesForNode(repo, transactionNode, transactionQueue);
    // Sort them by the order the transactions were created.
    transactionQueue.sort((a, b) => a.order - b.order);
    return transactionQueue;
}
function repoAggregateTransactionQueuesForNode(repo, node, queue) {
    const nodeQueue = treeGetValue(node);
    if (nodeQueue) {
        for (let i = 0; i < nodeQueue.length; i++) {
            queue.push(nodeQueue[i]);
        }
    }
    treeForEachChild(node, child => {
        repoAggregateTransactionQueuesForNode(repo, child, queue);
    });
}
/**
 * Remove COMPLETED transactions at or below this node in the transactionQueueTree_.
 */
function repoPruneCompletedTransactionsBelowNode(repo, node) {
    const queue = treeGetValue(node);
    if (queue) {
        let to = 0;
        for (let from = 0; from < queue.length; from++) {
            if (queue[from].status !== 2 /* TransactionStatus.COMPLETED */) {
                queue[to] = queue[from];
                to++;
            }
        }
        queue.length = to;
        treeSetValue(node, queue.length > 0 ? queue : undefined);
    }
    treeForEachChild(node, childNode => {
        repoPruneCompletedTransactionsBelowNode(repo, childNode);
    });
}
/**
 * Aborts all transactions on ancestors or descendants of the specified path.
 * Called when doing a set() or update() since we consider them incompatible
 * with transactions.
 *
 * @param path - Path for which we want to abort related transactions.
 */
function repoAbortTransactions(repo, path) {
    const affectedPath = treeGetPath(repoGetAncestorTransactionNode(repo, path));
    const transactionNode = treeSubTree(repo.transactionQueueTree_, path);
    treeForEachAncestor(transactionNode, (node) => {
        repoAbortTransactionsOnNode(repo, node);
    });
    repoAbortTransactionsOnNode(repo, transactionNode);
    treeForEachDescendant(transactionNode, (node) => {
        repoAbortTransactionsOnNode(repo, node);
    });
    return affectedPath;
}
/**
 * Abort transactions stored in this transaction queue node.
 *
 * @param node - Node to abort transactions for.
 */
function repoAbortTransactionsOnNode(repo, node) {
    const queue = treeGetValue(node);
    if (queue) {
        // Queue up the callbacks and fire them after cleaning up all of our
        // transaction state, since the callback could trigger more transactions
        // or sets.
        const callbacks = [];
        // Go through queue.  Any already-sent transactions must be marked for
        // abort, while the unsent ones can be immediately aborted and removed.
        let events = [];
        let lastSent = -1;
        for (let i = 0; i < queue.length; i++) {
            if (queue[i].status === 3 /* TransactionStatus.SENT_NEEDS_ABORT */) ;
            else if (queue[i].status === 1 /* TransactionStatus.SENT */) {
                util.assert(lastSent === i - 1, 'All SENT items should be at beginning of queue.');
                lastSent = i;
                // Mark transaction for abort when it comes back.
                queue[i].status = 3 /* TransactionStatus.SENT_NEEDS_ABORT */;
                queue[i].abortReason = 'set';
            }
            else {
                util.assert(queue[i].status === 0 /* TransactionStatus.RUN */, 'Unexpected transaction status in abort');
                // We can abort it immediately.
                queue[i].unwatcher();
                events = events.concat(syncTreeAckUserWrite(repo.serverSyncTree_, queue[i].currentWriteId, true));
                if (queue[i].onComplete) {
                    callbacks.push(queue[i].onComplete.bind(null, new Error('set'), false, null));
                }
            }
        }
        if (lastSent === -1) {
            // We're not waiting for any sent transactions.  We can clear the queue.
            treeSetValue(node, undefined);
        }
        else {
            // Remove the transactions we aborted.
            queue.length = lastSent + 1;
        }
        // Now fire the callbacks.
        eventQueueRaiseEventsForChangedPath(repo.eventQueue_, treeGetPath(node), events);
        for (let i = 0; i < callbacks.length; i++) {
            exceptionGuard(callbacks[i]);
        }
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
function decodePath(pathString) {
    let pathStringDecoded = '';
    const pieces = pathString.split('/');
    for (let i = 0; i < pieces.length; i++) {
        if (pieces[i].length > 0) {
            let piece = pieces[i];
            try {
                piece = decodeURIComponent(piece.replace(/\+/g, ' '));
            }
            catch (e) { }
            pathStringDecoded += '/' + piece;
        }
    }
    return pathStringDecoded;
}
/**
 * @returns key value hash
 */
function decodeQuery(queryString) {
    const results = {};
    if (queryString.charAt(0) === '?') {
        queryString = queryString.substring(1);
    }
    for (const segment of queryString.split('&')) {
        if (segment.length === 0) {
            continue;
        }
        const kv = segment.split('=');
        if (kv.length === 2) {
            results[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
        }
        else {
            warn$1(`Invalid query segment '${segment}' in query '${queryString}'`);
        }
    }
    return results;
}
const parseRepoInfo = function (dataURL, nodeAdmin) {
    const parsedUrl = parseDatabaseURL(dataURL), namespace = parsedUrl.namespace;
    if (parsedUrl.domain === 'firebase.com') {
        fatal(parsedUrl.host +
            ' is no longer supported. ' +
            'Please use <YOUR FIREBASE>.firebaseio.com instead');
    }
    // Catch common error of uninitialized namespace value.
    if ((!namespace || namespace === 'undefined') &&
        parsedUrl.domain !== 'localhost') {
        fatal('Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com');
    }
    if (!parsedUrl.secure) {
        warnIfPageIsSecure();
    }
    const webSocketOnly = parsedUrl.scheme === 'ws' || parsedUrl.scheme === 'wss';
    return {
        repoInfo: new RepoInfo(parsedUrl.host, parsedUrl.secure, namespace, webSocketOnly, nodeAdmin, 
        /*persistenceKey=*/ '', 
        /*includeNamespaceInQueryParams=*/ namespace !== parsedUrl.subdomain),
        path: new Path(parsedUrl.pathString)
    };
};
const parseDatabaseURL = function (dataURL) {
    // Default to empty strings in the event of a malformed string.
    let host = '', domain = '', subdomain = '', pathString = '', namespace = '';
    // Always default to SSL, unless otherwise specified.
    let secure = true, scheme = 'https', port = 443;
    // Don't do any validation here. The caller is responsible for validating the result of parsing.
    if (typeof dataURL === 'string') {
        // Parse scheme.
        let colonInd = dataURL.indexOf('//');
        if (colonInd >= 0) {
            scheme = dataURL.substring(0, colonInd - 1);
            dataURL = dataURL.substring(colonInd + 2);
        }
        // Parse host, path, and query string.
        let slashInd = dataURL.indexOf('/');
        if (slashInd === -1) {
            slashInd = dataURL.length;
        }
        let questionMarkInd = dataURL.indexOf('?');
        if (questionMarkInd === -1) {
            questionMarkInd = dataURL.length;
        }
        host = dataURL.substring(0, Math.min(slashInd, questionMarkInd));
        if (slashInd < questionMarkInd) {
            // For pathString, questionMarkInd will always come after slashInd
            pathString = decodePath(dataURL.substring(slashInd, questionMarkInd));
        }
        const queryParams = decodeQuery(dataURL.substring(Math.min(dataURL.length, questionMarkInd)));
        // If we have a port, use scheme for determining if it's secure.
        colonInd = host.indexOf(':');
        if (colonInd >= 0) {
            secure = scheme === 'https' || scheme === 'wss';
            port = parseInt(host.substring(colonInd + 1), 10);
        }
        else {
            colonInd = host.length;
        }
        const hostWithoutPort = host.slice(0, colonInd);
        if (hostWithoutPort.toLowerCase() === 'localhost') {
            domain = 'localhost';
        }
        else if (hostWithoutPort.split('.').length <= 2) {
            domain = hostWithoutPort;
        }
        else {
            // Interpret the subdomain of a 3 or more component URL as the namespace name.
            const dotInd = host.indexOf('.');
            subdomain = host.substring(0, dotInd).toLowerCase();
            domain = host.substring(dotInd + 1);
            // Normalize namespaces to lowercase to share storage / connection.
            namespace = subdomain;
        }
        // Always treat the value of the `ns` as the namespace name if it is present.
        if ('ns' in queryParams) {
            namespace = queryParams['ns'];
        }
    }
    return {
        host,
        port,
        domain,
        subdomain,
        secure,
        scheme,
        pathString,
        namespace
    };
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Modeled after base64 web-safe chars, but ordered by ASCII.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
/**
 * Fancy ID generator that creates 20-character string identifiers with the
 * following properties:
 *
 * 1. They're based on timestamp so that they sort *after* any existing ids.
 * 2. They contain 72-bits of random data after the timestamp so that IDs won't
 *    collide with other clients' IDs.
 * 3. They sort *lexicographically* (so the timestamp is converted to characters
 *    that will sort properly).
 * 4. They're monotonically increasing. Even if you generate more than one in
 *    the same timestamp, the latter ones will sort after the former ones. We do
 *    this by using the previous random bits but "incrementing" them by 1 (only
 *    in the case of a timestamp collision).
 */
const nextPushId = (function () {
    // Timestamp of last push, used to prevent local collisions if you push twice
    // in one ms.
    let lastPushTime = 0;
    // We generate 72-bits of randomness which get turned into 12 characters and
    // appended to the timestamp to prevent collisions with other clients. We
    // store the last characters we generated because in the event of a collision,
    // we'll use those same characters except "incremented" by one.
    const lastRandChars = [];
    return function (now) {
        const duplicateTime = now === lastPushTime;
        lastPushTime = now;
        let i;
        const timeStampChars = new Array(8);
        for (i = 7; i >= 0; i--) {
            timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
            // NOTE: Can't use << here because javascript will convert to int and lose
            // the upper bits.
            now = Math.floor(now / 64);
        }
        util.assert(now === 0, 'Cannot push at time == 0');
        let id = timeStampChars.join('');
        if (!duplicateTime) {
            for (i = 0; i < 12; i++) {
                lastRandChars[i] = Math.floor(Math.random() * 64);
            }
        }
        else {
            // If the timestamp hasn't changed since last push, use the same random
            // number, except incremented by 1.
            for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
                lastRandChars[i] = 0;
            }
            lastRandChars[i]++;
        }
        for (i = 0; i < 12; i++) {
            id += PUSH_CHARS.charAt(lastRandChars[i]);
        }
        util.assert(id.length === 20, 'nextPushId: Length should be 20.');
        return id;
    };
})();

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Encapsulates the data needed to raise an event
 */
class DataEvent {
    /**
     * @param eventType - One of: value, child_added, child_changed, child_moved, child_removed
     * @param eventRegistration - The function to call to with the event data. User provided
     * @param snapshot - The data backing the event
     * @param prevName - Optional, the name of the previous child for child_* events.
     */
    constructor(eventType, eventRegistration, snapshot, prevName) {
        this.eventType = eventType;
        this.eventRegistration = eventRegistration;
        this.snapshot = snapshot;
        this.prevName = prevName;
    }
    getPath() {
        const ref = this.snapshot.ref;
        if (this.eventType === 'value') {
            return ref._path;
        }
        else {
            return ref.parent._path;
        }
    }
    getEventType() {
        return this.eventType;
    }
    getEventRunner() {
        return this.eventRegistration.getEventRunner(this);
    }
    toString() {
        return (this.getPath().toString() +
            ':' +
            this.eventType +
            ':' +
            util.stringify(this.snapshot.exportVal()));
    }
}
class CancelEvent {
    constructor(eventRegistration, error, path) {
        this.eventRegistration = eventRegistration;
        this.error = error;
        this.path = path;
    }
    getPath() {
        return this.path;
    }
    getEventType() {
        return 'cancel';
    }
    getEventRunner() {
        return this.eventRegistration.getEventRunner(this);
    }
    toString() {
        return this.path.toString() + ':cancel';
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A wrapper class that converts events from the database@exp SDK to the legacy
 * Database SDK. Events are not converted directly as event registration relies
 * on reference comparison of the original user callback (see `matches()`) and
 * relies on equality of the legacy SDK's `context` object.
 */
class CallbackContext {
    constructor(snapshotCallback, cancelCallback) {
        this.snapshotCallback = snapshotCallback;
        this.cancelCallback = cancelCallback;
    }
    onValue(expDataSnapshot, previousChildName) {
        this.snapshotCallback.call(null, expDataSnapshot, previousChildName);
    }
    onCancel(error) {
        util.assert(this.hasCancelCallback, 'Raising a cancel event on a listener with no cancel callback');
        return this.cancelCallback.call(null, error);
    }
    get hasCancelCallback() {
        return !!this.cancelCallback;
    }
    matches(other) {
        return (this.snapshotCallback === other.snapshotCallback ||
            (this.snapshotCallback.userCallback !== undefined &&
                this.snapshotCallback.userCallback ===
                    other.snapshotCallback.userCallback &&
                this.snapshotCallback.context === other.snapshotCallback.context));
    }
}

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * The `onDisconnect` class allows you to write or clear data when your client
 * disconnects from the Database server. These updates occur whether your
 * client disconnects cleanly or not, so you can rely on them to clean up data
 * even if a connection is dropped or a client crashes.
 *
 * The `onDisconnect` class is most commonly used to manage presence in
 * applications where it is useful to detect how many clients are connected and
 * when other clients disconnect. See
 * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
 * for more information.
 *
 * To avoid problems when a connection is dropped before the requests can be
 * transferred to the Database server, these functions should be called before
 * writing any data.
 *
 * Note that `onDisconnect` operations are only triggered once. If you want an
 * operation to occur each time a disconnect occurs, you'll need to re-establish
 * the `onDisconnect` operations each time you reconnect.
 */
class OnDisconnect$1 {
    /** @hideconstructor */
    constructor(_repo, _path) {
        this._repo = _repo;
        this._path = _path;
    }
    /**
     * Cancels all previously queued `onDisconnect()` set or update events for this
     * location and all children.
     *
     * If a write has been queued for this location via a `set()` or `update()` at a
     * parent location, the write at this location will be canceled, though writes
     * to sibling locations will still occur.
     *
     * @returns Resolves when synchronization to the server is complete.
     */
    cancel() {
        const deferred = new util.Deferred();
        repoOnDisconnectCancel(this._repo, this._path, deferred.wrapCallback(() => { }));
        return deferred.promise;
    }
    /**
     * Ensures the data at this location is deleted when the client is disconnected
     * (due to closing the browser, navigating to a new page, or network issues).
     *
     * @returns Resolves when synchronization to the server is complete.
     */
    remove() {
        validateWritablePath('OnDisconnect.remove', this._path);
        const deferred = new util.Deferred();
        repoOnDisconnectSet(this._repo, this._path, null, deferred.wrapCallback(() => { }));
        return deferred.promise;
    }
    /**
     * Ensures the data at this location is set to the specified value when the
     * client is disconnected (due to closing the browser, navigating to a new page,
     * or network issues).
     *
     * `set()` is especially useful for implementing "presence" systems, where a
     * value should be changed or cleared when a user disconnects so that they
     * appear "offline" to other users. See
     * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
     * for more information.
     *
     * Note that `onDisconnect` operations are only triggered once. If you want an
     * operation to occur each time a disconnect occurs, you'll need to re-establish
     * the `onDisconnect` operations each time.
     *
     * @param value - The value to be written to this location on disconnect (can
     * be an object, array, string, number, boolean, or null).
     * @returns Resolves when synchronization to the Database is complete.
     */
    set(value) {
        validateWritablePath('OnDisconnect.set', this._path);
        validateFirebaseDataArg('OnDisconnect.set', value, this._path, false);
        const deferred = new util.Deferred();
        repoOnDisconnectSet(this._repo, this._path, value, deferred.wrapCallback(() => { }));
        return deferred.promise;
    }
    /**
     * Ensures the data at this location is set to the specified value and priority
     * when the client is disconnected (due to closing the browser, navigating to a
     * new page, or network issues).
     *
     * @param value - The value to be written to this location on disconnect (can
     * be an object, array, string, number, boolean, or null).
     * @param priority - The priority to be written (string, number, or null).
     * @returns Resolves when synchronization to the Database is complete.
     */
    setWithPriority(value, priority) {
        validateWritablePath('OnDisconnect.setWithPriority', this._path);
        validateFirebaseDataArg('OnDisconnect.setWithPriority', value, this._path, false);
        validatePriority('OnDisconnect.setWithPriority', priority, false);
        const deferred = new util.Deferred();
        repoOnDisconnectSetWithPriority(this._repo, this._path, value, priority, deferred.wrapCallback(() => { }));
        return deferred.promise;
    }
    /**
     * Writes multiple values at this location when the client is disconnected (due
     * to closing the browser, navigating to a new page, or network issues).
     *
     * The `values` argument contains multiple property-value pairs that will be
     * written to the Database together. Each child property can either be a simple
     * property (for example, "name") or a relative path (for example, "name/first")
     * from the current location to the data to update.
     *
     * As opposed to the `set()` method, `update()` can be use to selectively update
     * only the referenced properties at the current location (instead of replacing
     * all the child properties at the current location).
     *
     * @param values - Object containing multiple values.
     * @returns Resolves when synchronization to the Database is complete.
     */
    update(values) {
        validateWritablePath('OnDisconnect.update', this._path);
        validateFirebaseMergeDataArg('OnDisconnect.update', values, this._path, false);
        const deferred = new util.Deferred();
        repoOnDisconnectUpdate(this._repo, this._path, values, deferred.wrapCallback(() => { }));
        return deferred.promise;
    }
}

/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @internal
 */
class QueryImpl {
    /**
     * @hideconstructor
     */
    constructor(_repo, _path, _queryParams, _orderByCalled) {
        this._repo = _repo;
        this._path = _path;
        this._queryParams = _queryParams;
        this._orderByCalled = _orderByCalled;
    }
    get key() {
        if (pathIsEmpty(this._path)) {
            return null;
        }
        else {
            return pathGetBack(this._path);
        }
    }
    get ref() {
        return new ReferenceImpl(this._repo, this._path);
    }
    get _queryIdentifier() {
        const obj = queryParamsGetQueryObject(this._queryParams);
        const id = ObjectToUniqueKey(obj);
        return id === '{}' ? 'default' : id;
    }
    /**
     * An object representation of the query parameters used by this Query.
     */
    get _queryObject() {
        return queryParamsGetQueryObject(this._queryParams);
    }
    isEqual(other) {
        other = util.getModularInstance(other);
        if (!(other instanceof QueryImpl)) {
            return false;
        }
        const sameRepo = this._repo === other._repo;
        const samePath = pathEquals(this._path, other._path);
        const sameQueryIdentifier = this._queryIdentifier === other._queryIdentifier;
        return sameRepo && samePath && sameQueryIdentifier;
    }
    toJSON() {
        return this.toString();
    }
    toString() {
        return this._repo.toString() + pathToUrlEncodedString(this._path);
    }
}
/**
 * Validates that no other order by call has been made
 */
function validateNoPreviousOrderByCall(query, fnName) {
    if (query._orderByCalled === true) {
        throw new Error(fnName + ": You can't combine multiple orderBy calls.");
    }
}
/**
 * Validates start/end values for queries.
 */
function validateQueryEndpoints(params) {
    let startNode = null;
    let endNode = null;
    if (params.hasStart()) {
        startNode = params.getIndexStartValue();
    }
    if (params.hasEnd()) {
        endNode = params.getIndexEndValue();
    }
    if (params.getIndex() === KEY_INDEX) {
        const tooManyArgsError = 'Query: When ordering by key, you may only pass one argument to ' +
            'startAt(), endAt(), or equalTo().';
        const wrongArgTypeError = 'Query: When ordering by key, the argument passed to startAt(), startAfter(), ' +
            'endAt(), endBefore(), or equalTo() must be a string.';
        if (params.hasStart()) {
            const startName = params.getIndexStartName();
            if (startName !== MIN_NAME) {
                throw new Error(tooManyArgsError);
            }
            else if (typeof startNode !== 'string') {
                throw new Error(wrongArgTypeError);
            }
        }
        if (params.hasEnd()) {
            const endName = params.getIndexEndName();
            if (endName !== MAX_NAME) {
                throw new Error(tooManyArgsError);
            }
            else if (typeof endNode !== 'string') {
                throw new Error(wrongArgTypeError);
            }
        }
    }
    else if (params.getIndex() === PRIORITY_INDEX) {
        if ((startNode != null && !isValidPriority(startNode)) ||
            (endNode != null && !isValidPriority(endNode))) {
            throw new Error('Query: When ordering by priority, the first argument passed to startAt(), ' +
                'startAfter() endAt(), endBefore(), or equalTo() must be a valid priority value ' +
                '(null, a number, or a string).');
        }
    }
    else {
        util.assert(params.getIndex() instanceof PathIndex ||
            params.getIndex() === VALUE_INDEX, 'unknown index type.');
        if ((startNode != null && typeof startNode === 'object') ||
            (endNode != null && typeof endNode === 'object')) {
            throw new Error('Query: First argument passed to startAt(), startAfter(), endAt(), endBefore(), or ' +
                'equalTo() cannot be an object.');
        }
    }
}
/**
 * Validates that limit* has been called with the correct combination of parameters
 */
function validateLimit(params) {
    if (params.hasStart() &&
        params.hasEnd() &&
        params.hasLimit() &&
        !params.hasAnchoredLimit()) {
        throw new Error("Query: Can't combine startAt(), startAfter(), endAt(), endBefore(), and limit(). Use " +
            'limitToFirst() or limitToLast() instead.');
    }
}
/**
 * @internal
 */
class ReferenceImpl extends QueryImpl {
    /** @hideconstructor */
    constructor(repo, path) {
        super(repo, path, new QueryParams(), false);
    }
    get parent() {
        const parentPath = pathParent(this._path);
        return parentPath === null
            ? null
            : new ReferenceImpl(this._repo, parentPath);
    }
    get root() {
        let ref = this;
        while (ref.parent !== null) {
            ref = ref.parent;
        }
        return ref;
    }
}
/**
 * A `DataSnapshot` contains data from a Database location.
 *
 * Any time you read data from the Database, you receive the data as a
 * `DataSnapshot`. A `DataSnapshot` is passed to the event callbacks you attach
 * with `on()` or `once()`. You can extract the contents of the snapshot as a
 * JavaScript object by calling the `val()` method. Alternatively, you can
 * traverse into the snapshot by calling `child()` to return child snapshots
 * (which you could then call `val()` on).
 *
 * A `DataSnapshot` is an efficiently generated, immutable copy of the data at
 * a Database location. It cannot be modified and will never change (to modify
 * data, you always call the `set()` method on a `Reference` directly).
 */
class DataSnapshot$1 {
    /**
     * @param _node - A SnapshotNode to wrap.
     * @param ref - The location this snapshot came from.
     * @param _index - The iteration order for this snapshot
     * @hideconstructor
     */
    constructor(_node, 
    /**
     * The location of this DataSnapshot.
     */
    ref, _index) {
        this._node = _node;
        this.ref = ref;
        this._index = _index;
    }
    /**
     * Gets the priority value of the data in this `DataSnapshot`.
     *
     * Applications need not use priority but can order collections by
     * ordinary properties (see
     * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data |Sorting and filtering data}
     * ).
     */
    get priority() {
        // typecast here because we never return deferred values or internal priorities (MAX_PRIORITY)
        return this._node.getPriority().val();
    }
    /**
     * The key (last part of the path) of the location of this `DataSnapshot`.
     *
     * The last token in a Database location is considered its key. For example,
     * "ada" is the key for the /users/ada/ node. Accessing the key on any
     * `DataSnapshot` will return the key for the location that generated it.
     * However, accessing the key on the root URL of a Database will return
     * `null`.
     */
    get key() {
        return this.ref.key;
    }
    /** Returns the number of child properties of this `DataSnapshot`. */
    get size() {
        return this._node.numChildren();
    }
    /**
     * Gets another `DataSnapshot` for the location at the specified relative path.
     *
     * Passing a relative path to the `child()` method of a DataSnapshot returns
     * another `DataSnapshot` for the location at the specified relative path. The
     * relative path can either be a simple child name (for example, "ada") or a
     * deeper, slash-separated path (for example, "ada/name/first"). If the child
     * location has no data, an empty `DataSnapshot` (that is, a `DataSnapshot`
     * whose value is `null`) is returned.
     *
     * @param path - A relative path to the location of child data.
     */
    child(path) {
        const childPath = new Path(path);
        const childRef = child(this.ref, path);
        return new DataSnapshot$1(this._node.getChild(childPath), childRef, PRIORITY_INDEX);
    }
    /**
     * Returns true if this `DataSnapshot` contains any data. It is slightly more
     * efficient than using `snapshot.val() !== null`.
     */
    exists() {
        return !this._node.isEmpty();
    }
    /**
     * Exports the entire contents of the DataSnapshot as a JavaScript object.
     *
     * The `exportVal()` method is similar to `val()`, except priority information
     * is included (if available), making it suitable for backing up your data.
     *
     * @returns The DataSnapshot's contents as a JavaScript value (Object,
     *   Array, string, number, boolean, or `null`).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportVal() {
        return this._node.val(true);
    }
    /**
     * Enumerates the top-level children in the `IteratedDataSnapshot`.
     *
     * Because of the way JavaScript objects work, the ordering of data in the
     * JavaScript object returned by `val()` is not guaranteed to match the
     * ordering on the server nor the ordering of `onChildAdded()` events. That is
     * where `forEach()` comes in handy. It guarantees the children of a
     * `DataSnapshot` will be iterated in their query order.
     *
     * If no explicit `orderBy*()` method is used, results are returned
     * ordered by key (unless priorities are used, in which case, results are
     * returned by priority).
     *
     * @param action - A function that will be called for each child DataSnapshot.
     * The callback can return true to cancel further enumeration.
     * @returns true if enumeration was canceled due to your callback returning
     * true.
     */
    forEach(action) {
        if (this._node.isLeafNode()) {
            return false;
        }
        const childrenNode = this._node;
        // Sanitize the return value to a boolean. ChildrenNode.forEachChild has a weird return type...
        return !!childrenNode.forEachChild(this._index, (key, node) => {
            return action(new DataSnapshot$1(node, child(this.ref, key), PRIORITY_INDEX));
        });
    }
    /**
     * Returns true if the specified child path has (non-null) data.
     *
     * @param path - A relative path to the location of a potential child.
     * @returns `true` if data exists at the specified child path; else
     *  `false`.
     */
    hasChild(path) {
        const childPath = new Path(path);
        return !this._node.getChild(childPath).isEmpty();
    }
    /**
     * Returns whether or not the `DataSnapshot` has any non-`null` child
     * properties.
     *
     * You can use `hasChildren()` to determine if a `DataSnapshot` has any
     * children. If it does, you can enumerate them using `forEach()`. If it
     * doesn't, then either this snapshot contains a primitive value (which can be
     * retrieved with `val()`) or it is empty (in which case, `val()` will return
     * `null`).
     *
     * @returns true if this snapshot has any children; else false.
     */
    hasChildren() {
        if (this._node.isLeafNode()) {
            return false;
        }
        else {
            return !this._node.isEmpty();
        }
    }
    /**
     * Returns a JSON-serializable representation of this object.
     */
    toJSON() {
        return this.exportVal();
    }
    /**
     * Extracts a JavaScript value from a `DataSnapshot`.
     *
     * Depending on the data in a `DataSnapshot`, the `val()` method may return a
     * scalar type (string, number, or boolean), an array, or an object. It may
     * also return null, indicating that the `DataSnapshot` is empty (contains no
     * data).
     *
     * @returns The DataSnapshot's contents as a JavaScript value (Object,
     *   Array, string, number, boolean, or `null`).
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    val() {
        return this._node.val();
    }
}
/**
 *
 * Returns a `Reference` representing the location in the Database
 * corresponding to the provided path. If no path is provided, the `Reference`
 * will point to the root of the Database.
 *
 * @param db - The database instance to obtain a reference for.
 * @param path - Optional path representing the location the returned
 *   `Reference` will point. If not provided, the returned `Reference` will
 *   point to the root of the Database.
 * @returns If a path is provided, a `Reference`
 *   pointing to the provided path. Otherwise, a `Reference` pointing to the
 *   root of the Database.
 */
function ref(db, path) {
    db = util.getModularInstance(db);
    db._checkNotDeleted('ref');
    return path !== undefined ? child(db._root, path) : db._root;
}
/**
 * Returns a `Reference` representing the location in the Database
 * corresponding to the provided Firebase URL.
 *
 * An exception is thrown if the URL is not a valid Firebase Database URL or it
 * has a different domain than the current `Database` instance.
 *
 * Note that all query parameters (`orderBy`, `limitToLast`, etc.) are ignored
 * and are not applied to the returned `Reference`.
 *
 * @param db - The database instance to obtain a reference for.
 * @param url - The Firebase URL at which the returned `Reference` will
 *   point.
 * @returns A `Reference` pointing to the provided
 *   Firebase URL.
 */
function refFromURL(db, url) {
    db = util.getModularInstance(db);
    db._checkNotDeleted('refFromURL');
    const parsedURL = parseRepoInfo(url, db._repo.repoInfo_.nodeAdmin);
    validateUrl('refFromURL', parsedURL);
    const repoInfo = parsedURL.repoInfo;
    if (!db._repo.repoInfo_.isCustomHost() &&
        repoInfo.host !== db._repo.repoInfo_.host) {
        fatal('refFromURL' +
            ': Host name does not match the current database: ' +
            '(found ' +
            repoInfo.host +
            ' but expected ' +
            db._repo.repoInfo_.host +
            ')');
    }
    return ref(db, parsedURL.path.toString());
}
/**
 * Gets a `Reference` for the location at the specified relative path.
 *
 * The relative path can either be a simple child name (for example, "ada") or
 * a deeper slash-separated path (for example, "ada/name/first").
 *
 * @param parent - The parent location.
 * @param path - A relative path from this location to the desired child
 *   location.
 * @returns The specified child location.
 */
function child(parent, path) {
    parent = util.getModularInstance(parent);
    if (pathGetFront(parent._path) === null) {
        validateRootPathString('child', 'path', path, false);
    }
    else {
        validatePathString('child', 'path', path, false);
    }
    return new ReferenceImpl(parent._repo, pathChild(parent._path, path));
}
/**
 * Returns an `OnDisconnect` object - see
 * {@link https://firebase.google.com/docs/database/web/offline-capabilities | Enabling Offline Capabilities in JavaScript}
 * for more information on how to use it.
 *
 * @param ref - The reference to add OnDisconnect triggers for.
 */
function onDisconnect(ref) {
    ref = util.getModularInstance(ref);
    return new OnDisconnect$1(ref._repo, ref._path);
}
/**
 * Generates a new child location using a unique key and returns its
 * `Reference`.
 *
 * This is the most common pattern for adding data to a collection of items.
 *
 * If you provide a value to `push()`, the value is written to the
 * generated location. If you don't pass a value, nothing is written to the
 * database and the child remains empty (but you can use the `Reference`
 * elsewhere).
 *
 * The unique keys generated by `push()` are ordered by the current time, so the
 * resulting list of items is chronologically sorted. The keys are also
 * designed to be unguessable (they contain 72 random bits of entropy).
 *
 * See {@link https://firebase.google.com/docs/database/web/lists-of-data#append_to_a_list_of_data | Append to a list of data}.
 * See {@link https://firebase.googleblog.com/2015/02/the-2120-ways-to-ensure-unique_68.html | The 2^120 Ways to Ensure Unique Identifiers}.
 *
 * @param parent - The parent location.
 * @param value - Optional value to be written at the generated location.
 * @returns Combined `Promise` and `Reference`; resolves when write is complete,
 * but can be used immediately as the `Reference` to the child location.
 */
function push(parent, value) {
    parent = util.getModularInstance(parent);
    validateWritablePath('push', parent._path);
    validateFirebaseDataArg('push', value, parent._path, true);
    const now = repoServerTime(parent._repo);
    const name = nextPushId(now);
    // push() returns a ThennableReference whose promise is fulfilled with a
    // regular Reference. We use child() to create handles to two different
    // references. The first is turned into a ThennableReference below by adding
    // then() and catch() methods and is used as the return value of push(). The
    // second remains a regular Reference and is used as the fulfilled value of
    // the first ThennableReference.
    const thenablePushRef = child(parent, name);
    const pushRef = child(parent, name);
    let promise;
    if (value != null) {
        promise = set(pushRef, value).then(() => pushRef);
    }
    else {
        promise = Promise.resolve(pushRef);
    }
    thenablePushRef.then = promise.then.bind(promise);
    thenablePushRef.catch = promise.then.bind(promise, undefined);
    return thenablePushRef;
}
/**
 * Removes the data at this Database location.
 *
 * Any data at child locations will also be deleted.
 *
 * The effect of the remove will be visible immediately and the corresponding
 * event 'value' will be triggered. Synchronization of the remove to the
 * Firebase servers will also be started, and the returned Promise will resolve
 * when complete. If provided, the onComplete callback will be called
 * asynchronously after synchronization has finished.
 *
 * @param ref - The location to remove.
 * @returns Resolves when remove on server is complete.
 */
function remove(ref) {
    validateWritablePath('remove', ref._path);
    return set(ref, null);
}
/**
 * Writes data to this Database location.
 *
 * This will overwrite any data at this location and all child locations.
 *
 * The effect of the write will be visible immediately, and the corresponding
 * events ("value", "child_added", etc.) will be triggered. Synchronization of
 * the data to the Firebase servers will also be started, and the returned
 * Promise will resolve when complete. If provided, the `onComplete` callback
 * will be called asynchronously after synchronization has finished.
 *
 * Passing `null` for the new value is equivalent to calling `remove()`; namely,
 * all data at this location and all child locations will be deleted.
 *
 * `set()` will remove any priority stored at this location, so if priority is
 * meant to be preserved, you need to use `setWithPriority()` instead.
 *
 * Note that modifying data with `set()` will cancel any pending transactions
 * at that location, so extreme care should be taken if mixing `set()` and
 * `transaction()` to modify the same data.
 *
 * A single `set()` will generate a single "value" event at the location where
 * the `set()` was performed.
 *
 * @param ref - The location to write to.
 * @param value - The value to be written (string, number, boolean, object,
 *   array, or null).
 * @returns Resolves when write to server is complete.
 */
function set(ref, value) {
    ref = util.getModularInstance(ref);
    validateWritablePath('set', ref._path);
    validateFirebaseDataArg('set', value, ref._path, false);
    const deferred = new util.Deferred();
    repoSetWithPriority(ref._repo, ref._path, value, 
    /*priority=*/ null, deferred.wrapCallback(() => { }));
    return deferred.promise;
}
/**
 * Sets a priority for the data at this Database location.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data | Sorting and filtering data}
 * ).
 *
 * @param ref - The location to write to.
 * @param priority - The priority to be written (string, number, or null).
 * @returns Resolves when write to server is complete.
 */
function setPriority(ref, priority) {
    ref = util.getModularInstance(ref);
    validateWritablePath('setPriority', ref._path);
    validatePriority('setPriority', priority, false);
    const deferred = new util.Deferred();
    repoSetWithPriority(ref._repo, pathChild(ref._path, '.priority'), priority, null, deferred.wrapCallback(() => { }));
    return deferred.promise;
}
/**
 * Writes data the Database location. Like `set()` but also specifies the
 * priority for that data.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sorting_and_filtering_data | Sorting and filtering data}
 * ).
 *
 * @param ref - The location to write to.
 * @param value - The value to be written (string, number, boolean, object,
 *   array, or null).
 * @param priority - The priority to be written (string, number, or null).
 * @returns Resolves when write to server is complete.
 */
function setWithPriority(ref, value, priority) {
    validateWritablePath('setWithPriority', ref._path);
    validateFirebaseDataArg('setWithPriority', value, ref._path, false);
    validatePriority('setWithPriority', priority, false);
    if (ref.key === '.length' || ref.key === '.keys') {
        throw 'setWithPriority failed: ' + ref.key + ' is a read-only object.';
    }
    const deferred = new util.Deferred();
    repoSetWithPriority(ref._repo, ref._path, value, priority, deferred.wrapCallback(() => { }));
    return deferred.promise;
}
/**
 * Writes multiple values to the Database at once.
 *
 * The `values` argument contains multiple property-value pairs that will be
 * written to the Database together. Each child property can either be a simple
 * property (for example, "name") or a relative path (for example,
 * "name/first") from the current location to the data to update.
 *
 * As opposed to the `set()` method, `update()` can be use to selectively update
 * only the referenced properties at the current location (instead of replacing
 * all the child properties at the current location).
 *
 * The effect of the write will be visible immediately, and the corresponding
 * events ('value', 'child_added', etc.) will be triggered. Synchronization of
 * the data to the Firebase servers will also be started, and the returned
 * Promise will resolve when complete. If provided, the `onComplete` callback
 * will be called asynchronously after synchronization has finished.
 *
 * A single `update()` will generate a single "value" event at the location
 * where the `update()` was performed, regardless of how many children were
 * modified.
 *
 * Note that modifying data with `update()` will cancel any pending
 * transactions at that location, so extreme care should be taken if mixing
 * `update()` and `transaction()` to modify the same data.
 *
 * Passing `null` to `update()` will remove the data at this location.
 *
 * See
 * {@link https://firebase.googleblog.com/2015/09/introducing-multi-location-updates-and_86.html | Introducing multi-location updates and more}.
 *
 * @param ref - The location to write to.
 * @param values - Object containing multiple values.
 * @returns Resolves when update on server is complete.
 */
function update(ref, values) {
    validateFirebaseMergeDataArg('update', values, ref._path, false);
    const deferred = new util.Deferred();
    repoUpdate(ref._repo, ref._path, values, deferred.wrapCallback(() => { }));
    return deferred.promise;
}
/**
 * Gets the most up-to-date result for this query.
 *
 * @param query - The query to run.
 * @returns A `Promise` which resolves to the resulting DataSnapshot if a value is
 * available, or rejects if the client is unable to return a value (e.g., if the
 * server is unreachable and there is nothing cached).
 */
function get(query) {
    query = util.getModularInstance(query);
    const callbackContext = new CallbackContext(() => { });
    const container = new ValueEventRegistration(callbackContext);
    return repoGetValue(query._repo, query, container).then(node => {
        return new DataSnapshot$1(node, new ReferenceImpl(query._repo, query._path), query._queryParams.getIndex());
    });
}
/**
 * Represents registration for 'value' events.
 */
class ValueEventRegistration {
    constructor(callbackContext) {
        this.callbackContext = callbackContext;
    }
    respondsTo(eventType) {
        return eventType === 'value';
    }
    createEvent(change, query) {
        const index = query._queryParams.getIndex();
        return new DataEvent('value', this, new DataSnapshot$1(change.snapshotNode, new ReferenceImpl(query._repo, query._path), index));
    }
    getEventRunner(eventData) {
        if (eventData.getEventType() === 'cancel') {
            return () => this.callbackContext.onCancel(eventData.error);
        }
        else {
            return () => this.callbackContext.onValue(eventData.snapshot, null);
        }
    }
    createCancelEvent(error, path) {
        if (this.callbackContext.hasCancelCallback) {
            return new CancelEvent(this, error, path);
        }
        else {
            return null;
        }
    }
    matches(other) {
        if (!(other instanceof ValueEventRegistration)) {
            return false;
        }
        else if (!other.callbackContext || !this.callbackContext) {
            // If no callback specified, we consider it to match any callback.
            return true;
        }
        else {
            return other.callbackContext.matches(this.callbackContext);
        }
    }
    hasAnyCallback() {
        return this.callbackContext !== null;
    }
}
/**
 * Represents the registration of a child_x event.
 */
class ChildEventRegistration {
    constructor(eventType, callbackContext) {
        this.eventType = eventType;
        this.callbackContext = callbackContext;
    }
    respondsTo(eventType) {
        let eventToCheck = eventType === 'children_added' ? 'child_added' : eventType;
        eventToCheck =
            eventToCheck === 'children_removed' ? 'child_removed' : eventToCheck;
        return this.eventType === eventToCheck;
    }
    createCancelEvent(error, path) {
        if (this.callbackContext.hasCancelCallback) {
            return new CancelEvent(this, error, path);
        }
        else {
            return null;
        }
    }
    createEvent(change, query) {
        util.assert(change.childName != null, 'Child events should have a childName.');
        const childRef = child(new ReferenceImpl(query._repo, query._path), change.childName);
        const index = query._queryParams.getIndex();
        return new DataEvent(change.type, this, new DataSnapshot$1(change.snapshotNode, childRef, index), change.prevName);
    }
    getEventRunner(eventData) {
        if (eventData.getEventType() === 'cancel') {
            return () => this.callbackContext.onCancel(eventData.error);
        }
        else {
            return () => this.callbackContext.onValue(eventData.snapshot, eventData.prevName);
        }
    }
    matches(other) {
        if (other instanceof ChildEventRegistration) {
            return (this.eventType === other.eventType &&
                (!this.callbackContext ||
                    !other.callbackContext ||
                    this.callbackContext.matches(other.callbackContext)));
        }
        return false;
    }
    hasAnyCallback() {
        return !!this.callbackContext;
    }
}
function addEventListener(query, eventType, callback, cancelCallbackOrListenOptions, options) {
    let cancelCallback;
    if (typeof cancelCallbackOrListenOptions === 'object') {
        cancelCallback = undefined;
        options = cancelCallbackOrListenOptions;
    }
    if (typeof cancelCallbackOrListenOptions === 'function') {
        cancelCallback = cancelCallbackOrListenOptions;
    }
    if (options && options.onlyOnce) {
        const userCallback = callback;
        const onceCallback = (dataSnapshot, previousChildName) => {
            repoRemoveEventCallbackForQuery(query._repo, query, container);
            userCallback(dataSnapshot, previousChildName);
        };
        onceCallback.userCallback = callback.userCallback;
        onceCallback.context = callback.context;
        callback = onceCallback;
    }
    const callbackContext = new CallbackContext(callback, cancelCallback || undefined);
    const container = eventType === 'value'
        ? new ValueEventRegistration(callbackContext)
        : new ChildEventRegistration(eventType, callbackContext);
    repoAddEventCallbackForQuery(query._repo, query, container);
    return () => repoRemoveEventCallbackForQuery(query._repo, query, container);
}
function onValue(query, callback, cancelCallbackOrListenOptions, options) {
    return addEventListener(query, 'value', callback, cancelCallbackOrListenOptions, options);
}
function onChildAdded(query, callback, cancelCallbackOrListenOptions, options) {
    return addEventListener(query, 'child_added', callback, cancelCallbackOrListenOptions, options);
}
function onChildChanged(query, callback, cancelCallbackOrListenOptions, options) {
    return addEventListener(query, 'child_changed', callback, cancelCallbackOrListenOptions, options);
}
function onChildMoved(query, callback, cancelCallbackOrListenOptions, options) {
    return addEventListener(query, 'child_moved', callback, cancelCallbackOrListenOptions, options);
}
function onChildRemoved(query, callback, cancelCallbackOrListenOptions, options) {
    return addEventListener(query, 'child_removed', callback, cancelCallbackOrListenOptions, options);
}
/**
 * Detaches a callback previously attached with the corresponding `on*()` (`onValue`, `onChildAdded`) listener.
 * Note: This is not the recommended way to remove a listener. Instead, please use the returned callback function from
 * the respective `on*` callbacks.
 *
 * Detach a callback previously attached with `on*()`. Calling `off()` on a parent listener
 * will not automatically remove listeners registered on child nodes, `off()`
 * must also be called on any child listeners to remove the callback.
 *
 * If a callback is not specified, all callbacks for the specified eventType
 * will be removed. Similarly, if no eventType is specified, all callbacks
 * for the `Reference` will be removed.
 *
 * Individual listeners can also be removed by invoking their unsubscribe
 * callbacks.
 *
 * @param query - The query that the listener was registered with.
 * @param eventType - One of the following strings: "value", "child_added",
 * "child_changed", "child_removed", or "child_moved." If omitted, all callbacks
 * for the `Reference` will be removed.
 * @param callback - The callback function that was passed to `on()` or
 * `undefined` to remove all callbacks.
 */
function off(query, eventType, callback) {
    let container = null;
    const expCallback = callback ? new CallbackContext(callback) : null;
    if (eventType === 'value') {
        container = new ValueEventRegistration(expCallback);
    }
    else if (eventType) {
        container = new ChildEventRegistration(eventType, expCallback);
    }
    repoRemoveEventCallbackForQuery(query._repo, query, container);
}
/**
 * A `QueryConstraint` is used to narrow the set of documents returned by a
 * Database query. `QueryConstraint`s are created by invoking {@link endAt},
 * {@link endBefore}, {@link startAt}, {@link startAfter}, {@link
 * limitToFirst}, {@link limitToLast}, {@link orderByChild},
 * {@link orderByChild}, {@link orderByKey} , {@link orderByPriority} ,
 * {@link orderByValue}  or {@link equalTo} and
 * can then be passed to {@link query} to create a new query instance that
 * also contains this `QueryConstraint`.
 */
class QueryConstraint {
}
class QueryEndAtConstraint extends QueryConstraint {
    constructor(_value, _key) {
        super();
        this._value = _value;
        this._key = _key;
        this.type = 'endAt';
    }
    _apply(query) {
        validateFirebaseDataArg('endAt', this._value, query._path, true);
        const newParams = queryParamsEndAt(query._queryParams, this._value, this._key);
        validateLimit(newParams);
        validateQueryEndpoints(newParams);
        if (query._queryParams.hasEnd()) {
            throw new Error('endAt: Starting point was already set (by another call to endAt, ' +
                'endBefore or equalTo).');
        }
        return new QueryImpl(query._repo, query._path, newParams, query._orderByCalled);
    }
}
/**
 * Creates a `QueryConstraint` with the specified ending point.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The ending point is inclusive, so children with exactly the specified value
 * will be included in the query. The optional key argument can be used to
 * further limit the range of the query. If it is specified, then children that
 * have exactly the specified value must also have a key name less than or equal
 * to the specified key.
 *
 * You can read more about `endAt()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to end at. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to end at, among the children with the previously
 * specified priority. This argument is only allowed if ordering by child,
 * value, or priority.
 */
function endAt(value, key) {
    validateKey('endAt', 'key', key, true);
    return new QueryEndAtConstraint(value, key);
}
class QueryEndBeforeConstraint extends QueryConstraint {
    constructor(_value, _key) {
        super();
        this._value = _value;
        this._key = _key;
        this.type = 'endBefore';
    }
    _apply(query) {
        validateFirebaseDataArg('endBefore', this._value, query._path, false);
        const newParams = queryParamsEndBefore(query._queryParams, this._value, this._key);
        validateLimit(newParams);
        validateQueryEndpoints(newParams);
        if (query._queryParams.hasEnd()) {
            throw new Error('endBefore: Starting point was already set (by another call to endAt, ' +
                'endBefore or equalTo).');
        }
        return new QueryImpl(query._repo, query._path, newParams, query._orderByCalled);
    }
}
/**
 * Creates a `QueryConstraint` with the specified ending point (exclusive).
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The ending point is exclusive. If only a value is provided, children
 * with a value less than the specified value will be included in the query.
 * If a key is specified, then children must have a value less than or equal
 * to the specified value and a key name less than the specified key.
 *
 * @param value - The value to end before. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to end before, among the children with the
 * previously specified priority. This argument is only allowed if ordering by
 * child, value, or priority.
 */
function endBefore(value, key) {
    validateKey('endBefore', 'key', key, true);
    return new QueryEndBeforeConstraint(value, key);
}
class QueryStartAtConstraint extends QueryConstraint {
    constructor(_value, _key) {
        super();
        this._value = _value;
        this._key = _key;
        this.type = 'startAt';
    }
    _apply(query) {
        validateFirebaseDataArg('startAt', this._value, query._path, true);
        const newParams = queryParamsStartAt(query._queryParams, this._value, this._key);
        validateLimit(newParams);
        validateQueryEndpoints(newParams);
        if (query._queryParams.hasStart()) {
            throw new Error('startAt: Starting point was already set (by another call to startAt, ' +
                'startBefore or equalTo).');
        }
        return new QueryImpl(query._repo, query._path, newParams, query._orderByCalled);
    }
}
/**
 * Creates a `QueryConstraint` with the specified starting point.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The starting point is inclusive, so children with exactly the specified value
 * will be included in the query. The optional key argument can be used to
 * further limit the range of the query. If it is specified, then children that
 * have exactly the specified value must also have a key name greater than or
 * equal to the specified key.
 *
 * You can read more about `startAt()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to start at. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start at. This argument is only allowed if
 * ordering by child, value, or priority.
 */
function startAt(value = null, key) {
    validateKey('startAt', 'key', key, true);
    return new QueryStartAtConstraint(value, key);
}
class QueryStartAfterConstraint extends QueryConstraint {
    constructor(_value, _key) {
        super();
        this._value = _value;
        this._key = _key;
        this.type = 'startAfter';
    }
    _apply(query) {
        validateFirebaseDataArg('startAfter', this._value, query._path, false);
        const newParams = queryParamsStartAfter(query._queryParams, this._value, this._key);
        validateLimit(newParams);
        validateQueryEndpoints(newParams);
        if (query._queryParams.hasStart()) {
            throw new Error('startAfter: Starting point was already set (by another call to startAt, ' +
                'startAfter, or equalTo).');
        }
        return new QueryImpl(query._repo, query._path, newParams, query._orderByCalled);
    }
}
/**
 * Creates a `QueryConstraint` with the specified starting point (exclusive).
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The starting point is exclusive. If only a value is provided, children
 * with a value greater than the specified value will be included in the query.
 * If a key is specified, then children must have a value greater than or equal
 * to the specified value and a a key name greater than the specified key.
 *
 * @param value - The value to start after. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start after. This argument is only allowed if
 * ordering by child, value, or priority.
 */
function startAfter(value, key) {
    validateKey('startAfter', 'key', key, true);
    return new QueryStartAfterConstraint(value, key);
}
class QueryLimitToFirstConstraint extends QueryConstraint {
    constructor(_limit) {
        super();
        this._limit = _limit;
        this.type = 'limitToFirst';
    }
    _apply(query) {
        if (query._queryParams.hasLimit()) {
            throw new Error('limitToFirst: Limit was already set (by another call to limitToFirst ' +
                'or limitToLast).');
        }
        return new QueryImpl(query._repo, query._path, queryParamsLimitToFirst(query._queryParams, this._limit), query._orderByCalled);
    }
}
/**
 * Creates a new `QueryConstraint` that if limited to the first specific number
 * of children.
 *
 * The `limitToFirst()` method is used to set a maximum number of children to be
 * synced for a given callback. If we set a limit of 100, we will initially only
 * receive up to 100 `child_added` events. If we have fewer than 100 messages
 * stored in our Database, a `child_added` event will fire for each message.
 * However, if we have over 100 messages, we will only receive a `child_added`
 * event for the first 100 ordered messages. As items change, we will receive
 * `child_removed` events for each item that drops out of the active list so
 * that the total number stays at 100.
 *
 * You can read more about `limitToFirst()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param limit - The maximum number of nodes to include in this query.
 */
function limitToFirst(limit) {
    if (typeof limit !== 'number' || Math.floor(limit) !== limit || limit <= 0) {
        throw new Error('limitToFirst: First argument must be a positive integer.');
    }
    return new QueryLimitToFirstConstraint(limit);
}
class QueryLimitToLastConstraint extends QueryConstraint {
    constructor(_limit) {
        super();
        this._limit = _limit;
        this.type = 'limitToLast';
    }
    _apply(query) {
        if (query._queryParams.hasLimit()) {
            throw new Error('limitToLast: Limit was already set (by another call to limitToFirst ' +
                'or limitToLast).');
        }
        return new QueryImpl(query._repo, query._path, queryParamsLimitToLast(query._queryParams, this._limit), query._orderByCalled);
    }
}
/**
 * Creates a new `QueryConstraint` that is limited to return only the last
 * specified number of children.
 *
 * The `limitToLast()` method is used to set a maximum number of children to be
 * synced for a given callback. If we set a limit of 100, we will initially only
 * receive up to 100 `child_added` events. If we have fewer than 100 messages
 * stored in our Database, a `child_added` event will fire for each message.
 * However, if we have over 100 messages, we will only receive a `child_added`
 * event for the last 100 ordered messages. As items change, we will receive
 * `child_removed` events for each item that drops out of the active list so
 * that the total number stays at 100.
 *
 * You can read more about `limitToLast()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param limit - The maximum number of nodes to include in this query.
 */
function limitToLast(limit) {
    if (typeof limit !== 'number' || Math.floor(limit) !== limit || limit <= 0) {
        throw new Error('limitToLast: First argument must be a positive integer.');
    }
    return new QueryLimitToLastConstraint(limit);
}
class QueryOrderByChildConstraint extends QueryConstraint {
    constructor(_path) {
        super();
        this._path = _path;
        this.type = 'orderByChild';
    }
    _apply(query) {
        validateNoPreviousOrderByCall(query, 'orderByChild');
        const parsedPath = new Path(this._path);
        if (pathIsEmpty(parsedPath)) {
            throw new Error('orderByChild: cannot pass in empty path. Use orderByValue() instead.');
        }
        const index = new PathIndex(parsedPath);
        const newParams = queryParamsOrderBy(query._queryParams, index);
        validateQueryEndpoints(newParams);
        return new QueryImpl(query._repo, query._path, newParams, 
        /*orderByCalled=*/ true);
    }
}
/**
 * Creates a new `QueryConstraint` that orders by the specified child key.
 *
 * Queries can only order by one key at a time. Calling `orderByChild()`
 * multiple times on the same query is an error.
 *
 * Firebase queries allow you to order your data by any child key on the fly.
 * However, if you know in advance what your indexes will be, you can define
 * them via the .indexOn rule in your Security Rules for better performance. See
 * the{@link https://firebase.google.com/docs/database/security/indexing-data}
 * rule for more information.
 *
 * You can read more about `orderByChild()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 *
 * @param path - The path to order by.
 */
function orderByChild(path) {
    if (path === '$key') {
        throw new Error('orderByChild: "$key" is invalid.  Use orderByKey() instead.');
    }
    else if (path === '$priority') {
        throw new Error('orderByChild: "$priority" is invalid.  Use orderByPriority() instead.');
    }
    else if (path === '$value') {
        throw new Error('orderByChild: "$value" is invalid.  Use orderByValue() instead.');
    }
    validatePathString('orderByChild', 'path', path, false);
    return new QueryOrderByChildConstraint(path);
}
class QueryOrderByKeyConstraint extends QueryConstraint {
    constructor() {
        super(...arguments);
        this.type = 'orderByKey';
    }
    _apply(query) {
        validateNoPreviousOrderByCall(query, 'orderByKey');
        const newParams = queryParamsOrderBy(query._queryParams, KEY_INDEX);
        validateQueryEndpoints(newParams);
        return new QueryImpl(query._repo, query._path, newParams, 
        /*orderByCalled=*/ true);
    }
}
/**
 * Creates a new `QueryConstraint` that orders by the key.
 *
 * Sorts the results of a query by their (ascending) key values.
 *
 * You can read more about `orderByKey()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 */
function orderByKey() {
    return new QueryOrderByKeyConstraint();
}
class QueryOrderByPriorityConstraint extends QueryConstraint {
    constructor() {
        super(...arguments);
        this.type = 'orderByPriority';
    }
    _apply(query) {
        validateNoPreviousOrderByCall(query, 'orderByPriority');
        const newParams = queryParamsOrderBy(query._queryParams, PRIORITY_INDEX);
        validateQueryEndpoints(newParams);
        return new QueryImpl(query._repo, query._path, newParams, 
        /*orderByCalled=*/ true);
    }
}
/**
 * Creates a new `QueryConstraint` that orders by priority.
 *
 * Applications need not use priority but can order collections by
 * ordinary properties (see
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}
 * for alternatives to priority.
 */
function orderByPriority() {
    return new QueryOrderByPriorityConstraint();
}
class QueryOrderByValueConstraint extends QueryConstraint {
    constructor() {
        super(...arguments);
        this.type = 'orderByValue';
    }
    _apply(query) {
        validateNoPreviousOrderByCall(query, 'orderByValue');
        const newParams = queryParamsOrderBy(query._queryParams, VALUE_INDEX);
        validateQueryEndpoints(newParams);
        return new QueryImpl(query._repo, query._path, newParams, 
        /*orderByCalled=*/ true);
    }
}
/**
 * Creates a new `QueryConstraint` that orders by value.
 *
 * If the children of a query are all scalar values (string, number, or
 * boolean), you can order the results by their (ascending) values.
 *
 * You can read more about `orderByValue()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#sort_data | Sort data}.
 */
function orderByValue() {
    return new QueryOrderByValueConstraint();
}
class QueryEqualToValueConstraint extends QueryConstraint {
    constructor(_value, _key) {
        super();
        this._value = _value;
        this._key = _key;
        this.type = 'equalTo';
    }
    _apply(query) {
        validateFirebaseDataArg('equalTo', this._value, query._path, false);
        if (query._queryParams.hasStart()) {
            throw new Error('equalTo: Starting point was already set (by another call to startAt/startAfter or ' +
                'equalTo).');
        }
        if (query._queryParams.hasEnd()) {
            throw new Error('equalTo: Ending point was already set (by another call to endAt/endBefore or ' +
                'equalTo).');
        }
        return new QueryEndAtConstraint(this._value, this._key)._apply(new QueryStartAtConstraint(this._value, this._key)._apply(query));
    }
}
/**
 * Creates a `QueryConstraint` that includes children that match the specified
 * value.
 *
 * Using `startAt()`, `startAfter()`, `endBefore()`, `endAt()` and `equalTo()`
 * allows you to choose arbitrary starting and ending points for your queries.
 *
 * The optional key argument can be used to further limit the range of the
 * query. If it is specified, then children that have exactly the specified
 * value must also have exactly the specified key as their key name. This can be
 * used to filter result sets with many matches for the same value.
 *
 * You can read more about `equalTo()` in
 * {@link https://firebase.google.com/docs/database/web/lists-of-data#filtering_data | Filtering data}.
 *
 * @param value - The value to match for. The argument type depends on which
 * `orderBy*()` function was used in this query. Specify a value that matches
 * the `orderBy*()` type. When used in combination with `orderByKey()`, the
 * value must be a string.
 * @param key - The child key to start at, among the children with the
 * previously specified priority. This argument is only allowed if ordering by
 * child, value, or priority.
 */
function equalTo(value, key) {
    validateKey('equalTo', 'key', key, true);
    return new QueryEqualToValueConstraint(value, key);
}
/**
 * Creates a new immutable instance of `Query` that is extended to also include
 * additional query constraints.
 *
 * @param query - The Query instance to use as a base for the new constraints.
 * @param queryConstraints - The list of `QueryConstraint`s to apply.
 * @throws if any of the provided query constraints cannot be combined with the
 * existing or new constraints.
 */
function query(query, ...queryConstraints) {
    let queryImpl = util.getModularInstance(query);
    for (const constraint of queryConstraints) {
        queryImpl = constraint._apply(queryImpl);
    }
    return queryImpl;
}
/**
 * Define reference constructor in various modules
 *
 * We are doing this here to avoid several circular
 * dependency issues
 */
syncPointSetReferenceConstructor(ReferenceImpl);
syncTreeSetReferenceConstructor(ReferenceImpl);

/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * This variable is also defined in the firebase Node.js Admin SDK. Before
 * modifying this definition, consult the definition in:
 *
 * https://github.com/firebase/firebase-admin-node
 *
 * and make sure the two are consistent.
 */
const FIREBASE_DATABASE_EMULATOR_HOST_VAR = 'FIREBASE_DATABASE_EMULATOR_HOST';
/**
 * Creates and caches `Repo` instances.
 */
const repos = {};
/**
 * If true, any new `Repo` will be created to use `ReadonlyRestClient` (for testing purposes).
 */
let useRestClient = false;
/**
 * Update an existing `Repo` in place to point to a new host/port.
 */
function repoManagerApplyEmulatorSettings(repo, hostAndPort, emulatorOptions, tokenProvider) {
    const portIndex = hostAndPort.lastIndexOf(':');
    const host = hostAndPort.substring(0, portIndex);
    const useSsl = util.isCloudWorkstation(host);
    repo.repoInfo_ = new RepoInfo(hostAndPort, 
    /* secure= */ useSsl, repo.repoInfo_.namespace, repo.repoInfo_.webSocketOnly, repo.repoInfo_.nodeAdmin, repo.repoInfo_.persistenceKey, repo.repoInfo_.includeNamespaceInQueryParams, 
    /*isUsingEmulator=*/ true, emulatorOptions);
    if (tokenProvider) {
        repo.authTokenProvider_ = tokenProvider;
    }
}
/**
 * This function should only ever be called to CREATE a new database instance.
 * @internal
 */
function repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url, nodeAdmin) {
    let dbUrl = url || app.options.databaseURL;
    if (dbUrl === undefined) {
        if (!app.options.projectId) {
            fatal("Can't determine Firebase Database URL. Be sure to include " +
                ' a Project ID when calling firebase.initializeApp().');
        }
        log('Using default host for project ', app.options.projectId);
        dbUrl = `${app.options.projectId}-default-rtdb.firebaseio.com`;
    }
    let parsedUrl = parseRepoInfo(dbUrl, nodeAdmin);
    let repoInfo = parsedUrl.repoInfo;
    let isEmulator;
    let dbEmulatorHost = undefined;
    if (typeof process !== 'undefined' && process.env) {
        dbEmulatorHost = process.env[FIREBASE_DATABASE_EMULATOR_HOST_VAR];
    }
    if (dbEmulatorHost) {
        isEmulator = true;
        dbUrl = `http://${dbEmulatorHost}?ns=${repoInfo.namespace}`;
        parsedUrl = parseRepoInfo(dbUrl, nodeAdmin);
        repoInfo = parsedUrl.repoInfo;
    }
    else {
        isEmulator = !parsedUrl.repoInfo.secure;
    }
    const authTokenProvider = nodeAdmin && isEmulator
        ? new EmulatorTokenProvider(EmulatorTokenProvider.OWNER)
        : new FirebaseAuthTokenProvider(app.name, app.options, authProvider);
    validateUrl('Invalid Firebase Database URL', parsedUrl);
    if (!pathIsEmpty(parsedUrl.path)) {
        fatal('Database URL must point to the root of a Firebase Database ' +
            '(not including a child path).');
    }
    const repo = repoManagerCreateRepo(repoInfo, app, authTokenProvider, new AppCheckTokenProvider(app, appCheckProvider));
    return new Database$1(repo, app);
}
/**
 * Remove the repo and make sure it is disconnected.
 *
 */
function repoManagerDeleteRepo(repo, appName) {
    const appRepos = repos[appName];
    // This should never happen...
    if (!appRepos || appRepos[repo.key] !== repo) {
        fatal(`Database ${appName}(${repo.repoInfo_}) has already been deleted.`);
    }
    repoInterrupt(repo);
    delete appRepos[repo.key];
}
/**
 * Ensures a repo doesn't already exist and then creates one using the
 * provided app.
 *
 * @param repoInfo - The metadata about the Repo
 * @returns The Repo object for the specified server / repoName.
 */
function repoManagerCreateRepo(repoInfo, app, authTokenProvider, appCheckProvider) {
    let appRepos = repos[app.name];
    if (!appRepos) {
        appRepos = {};
        repos[app.name] = appRepos;
    }
    let repo = appRepos[repoInfo.toURLString()];
    if (repo) {
        fatal('Database initialized multiple times. Please make sure the format of the database URL matches with each database() call.');
    }
    repo = new Repo(repoInfo, useRestClient, authTokenProvider, appCheckProvider);
    appRepos[repoInfo.toURLString()] = repo;
    return repo;
}
/**
 * Forces us to use ReadonlyRestClient instead of PersistentConnection for new Repos.
 */
function repoManagerForceRestClient(forceRestClient) {
    useRestClient = forceRestClient;
}
/**
 * Class representing a Firebase Realtime Database.
 */
class Database$1 {
    /** @hideconstructor */
    constructor(_repoInternal, 
    /** The {@link @firebase/app#FirebaseApp} associated with this Realtime Database instance. */
    app) {
        this._repoInternal = _repoInternal;
        this.app = app;
        /** Represents a `Database` instance. */
        this['type'] = 'database';
        /** Track if the instance has been used (root or repo accessed) */
        this._instanceStarted = false;
    }
    get _repo() {
        if (!this._instanceStarted) {
            repoStart(this._repoInternal, this.app.options.appId, this.app.options['databaseAuthVariableOverride']);
            this._instanceStarted = true;
        }
        return this._repoInternal;
    }
    get _root() {
        if (!this._rootInternal) {
            this._rootInternal = new ReferenceImpl(this._repo, newEmptyPath());
        }
        return this._rootInternal;
    }
    _delete() {
        if (this._rootInternal !== null) {
            repoManagerDeleteRepo(this._repo, this.app.name);
            this._repoInternal = null;
            this._rootInternal = null;
        }
        return Promise.resolve();
    }
    _checkNotDeleted(apiName) {
        if (this._rootInternal === null) {
            fatal('Cannot call ' + apiName + ' on a deleted database.');
        }
    }
}
function checkTransportInit() {
    if (TransportManager.IS_TRANSPORT_INITIALIZED) {
        warn$1('Transport has already been initialized. Please call this function before calling ref or setting up a listener');
    }
}
/**
 * Force the use of websockets instead of longPolling.
 */
function forceWebSockets() {
    checkTransportInit();
    BrowserPollConnection.forceDisallow();
}
/**
 * Force the use of longPolling instead of websockets. This will be ignored if websocket protocol is used in databaseURL.
 */
function forceLongPolling() {
    checkTransportInit();
    WebSocketConnection.forceDisallow();
    BrowserPollConnection.forceAllow();
}
/**
 * Modify the provided instance to communicate with the Realtime Database
 * emulator.
 *
 * <p>Note: This method must be called before performing any other operation.
 *
 * @param db - The instance to modify.
 * @param host - The emulator host (ex: localhost)
 * @param port - The emulator port (ex: 8080)
 * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
 */
function connectDatabaseEmulator(db, host, port, options = {}) {
    db = util.getModularInstance(db);
    db._checkNotDeleted('useEmulator');
    const hostAndPort = `${host}:${port}`;
    const repo = db._repoInternal;
    if (db._instanceStarted) {
        // If the instance has already been started, then silenty fail if this function is called again
        // with the same parameters. If the parameters differ then assert.
        if (hostAndPort === db._repoInternal.repoInfo_.host &&
            util.deepEqual(options, repo.repoInfo_.emulatorOptions)) {
            return;
        }
        fatal('connectDatabaseEmulator() cannot initialize or alter the emulator configuration after the database instance has started.');
    }
    let tokenProvider = undefined;
    if (repo.repoInfo_.nodeAdmin) {
        if (options.mockUserToken) {
            fatal('mockUserToken is not supported by the Admin SDK. For client access with mock users, please use the "firebase" package instead of "firebase-admin".');
        }
        tokenProvider = new EmulatorTokenProvider(EmulatorTokenProvider.OWNER);
    }
    else if (options.mockUserToken) {
        const token = typeof options.mockUserToken === 'string'
            ? options.mockUserToken
            : util.createMockUserToken(options.mockUserToken, db.app.options.projectId);
        tokenProvider = new EmulatorTokenProvider(token);
    }
    // Workaround to get cookies in Firebase Studio
    if (util.isCloudWorkstation(host)) {
        void util.pingServer(host);
        util.updateEmulatorBanner('Database', true);
    }
    // Modify the repo to apply emulator settings
    repoManagerApplyEmulatorSettings(repo, hostAndPort, options, tokenProvider);
}
/**
 * Disconnects from the server (all Database operations will be completed
 * offline).
 *
 * The client automatically maintains a persistent connection to the Database
 * server, which will remain active indefinitely and reconnect when
 * disconnected. However, the `goOffline()` and `goOnline()` methods may be used
 * to control the client connection in cases where a persistent connection is
 * undesirable.
 *
 * While offline, the client will no longer receive data updates from the
 * Database. However, all Database operations performed locally will continue to
 * immediately fire events, allowing your application to continue behaving
 * normally. Additionally, each operation performed locally will automatically
 * be queued and retried upon reconnection to the Database server.
 *
 * To reconnect to the Database and begin receiving remote events, see
 * `goOnline()`.
 *
 * @param db - The instance to disconnect.
 */
function goOffline(db) {
    db = util.getModularInstance(db);
    db._checkNotDeleted('goOffline');
    repoInterrupt(db._repo);
}
/**
 * Reconnects to the server and synchronizes the offline Database state
 * with the server state.
 *
 * This method should be used after disabling the active connection with
 * `goOffline()`. Once reconnected, the client will transmit the proper data
 * and fire the appropriate events so that your client "catches up"
 * automatically.
 *
 * @param db - The instance to reconnect.
 */
function goOnline(db) {
    db = util.getModularInstance(db);
    db._checkNotDeleted('goOnline');
    repoResume(db._repo);
}
function enableLogging(logger, persistent) {
    enableLogging$1(logger, persistent);
}

/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const SERVER_TIMESTAMP = {
    '.sv': 'timestamp'
};
/**
 * Returns a placeholder value for auto-populating the current timestamp (time
 * since the Unix epoch, in milliseconds) as determined by the Firebase
 * servers.
 */
function serverTimestamp() {
    return SERVER_TIMESTAMP;
}
/**
 * Returns a placeholder value that can be used to atomically increment the
 * current database value by the provided delta.
 *
 * @param delta - the amount to modify the current value atomically.
 * @returns A placeholder value for modifying data atomically server-side.
 */
function increment(delta) {
    return {
        '.sv': {
            'increment': delta
        }
    };
}

/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A type for the resolve value of {@link runTransaction}.
 */
class TransactionResult$1 {
    /** @hideconstructor */
    constructor(
    /** Whether the transaction was successfully committed. */
    committed, 
    /** The resulting data snapshot. */
    snapshot) {
        this.committed = committed;
        this.snapshot = snapshot;
    }
    /** Returns a JSON-serializable representation of this object. */
    toJSON() {
        return { committed: this.committed, snapshot: this.snapshot.toJSON() };
    }
}
/**
 * Atomically modifies the data at this location.
 *
 * Atomically modify the data at this location. Unlike a normal `set()`, which
 * just overwrites the data regardless of its previous value, `runTransaction()` is
 * used to modify the existing value to a new value, ensuring there are no
 * conflicts with other clients writing to the same location at the same time.
 *
 * To accomplish this, you pass `runTransaction()` an update function which is
 * used to transform the current value into a new value. If another client
 * writes to the location before your new value is successfully written, your
 * update function will be called again with the new current value, and the
 * write will be retried. This will happen repeatedly until your write succeeds
 * without conflict or you abort the transaction by not returning a value from
 * your update function.
 *
 * Note: Modifying data with `set()` will cancel any pending transactions at
 * that location, so extreme care should be taken if mixing `set()` and
 * `runTransaction()` to update the same data.
 *
 * Note: When using transactions with Security and Firebase Rules in place, be
 * aware that a client needs `.read` access in addition to `.write` access in
 * order to perform a transaction. This is because the client-side nature of
 * transactions requires the client to read the data in order to transactionally
 * update it.
 *
 * @param ref - The location to atomically modify.
 * @param transactionUpdate - A developer-supplied function which will be passed
 * the current data stored at this location (as a JavaScript object). The
 * function should return the new value it would like written (as a JavaScript
 * object). If `undefined` is returned (i.e. you return with no arguments) the
 * transaction will be aborted and the data at this location will not be
 * modified.
 * @param options - An options object to configure transactions.
 * @returns A `Promise` that can optionally be used instead of the `onComplete`
 * callback to handle success and failure.
 */
function runTransaction(ref, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
transactionUpdate, options) {
    ref = util.getModularInstance(ref);
    validateWritablePath('Reference.transaction', ref._path);
    if (ref.key === '.length' || ref.key === '.keys') {
        throw ('Reference.transaction failed: ' + ref.key + ' is a read-only object.');
    }
    const applyLocally = options?.applyLocally ?? true;
    const deferred = new util.Deferred();
    const promiseComplete = (error, committed, node) => {
        let dataSnapshot = null;
        if (error) {
            deferred.reject(error);
        }
        else {
            dataSnapshot = new DataSnapshot$1(node, new ReferenceImpl(ref._repo, ref._path), PRIORITY_INDEX);
            deferred.resolve(new TransactionResult$1(committed, dataSnapshot));
        }
    };
    // Add a watch to make sure we get server updates.
    const unwatcher = onValue(ref, () => { });
    repoStartTransaction(ref._repo, ref._path, transactionUpdate, promiseComplete, unwatcher, applyLocally);
    return deferred.promise;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
PersistentConnection.prototype.simpleListen = function (pathString, onComplete) {
    this.sendRequest('q', { p: pathString }, onComplete);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
PersistentConnection.prototype.echo = function (data, onEcho) {
    this.sendRequest('echo', { d: data }, onEcho);
};
/**
 * @internal
 */
const hijackHash = function (newHash) {
    const oldPut = PersistentConnection.prototype.put;
    PersistentConnection.prototype.put = function (pathString, data, onComplete, hash) {
        if (hash !== undefined) {
            hash = newHash();
        }
        oldPut.call(this, pathString, data, onComplete, hash);
    };
    return function () {
        PersistentConnection.prototype.put = oldPut;
    };
};
/**
 * Forces the RepoManager to create Repos that use ReadonlyRestClient instead of PersistentConnection.
 * @internal
 */
const forceRestClient = function (forceRestClient) {
    repoManagerForceRestClient(forceRestClient);
};

/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Used by console to create a database based on the app,
 * passed database URL and a custom auth implementation.
 * @internal
 * @param app - A valid FirebaseApp-like object
 * @param url - A valid Firebase databaseURL
 * @param version - custom version e.g. firebase-admin version
 * @param customAppCheckImpl - custom app check implementation
 * @param customAuthImpl - custom auth implementation
 */
function _initStandalone({ app, url, version, customAuthImpl, customAppCheckImpl, nodeAdmin = false }) {
    setSDKVersion(version);
    /**
     * ComponentContainer('database-standalone') is just a placeholder that doesn't perform
     * any actual function.
     */
    const componentContainer = new component.ComponentContainer('database-standalone');
    const authProvider = new component.Provider('auth-internal', componentContainer);
    let appCheckProvider;
    if (customAppCheckImpl) {
        appCheckProvider = new component.Provider('app-check-internal', componentContainer);
        appCheckProvider.setComponent(new component.Component('app-check-internal', () => customAppCheckImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    }
    authProvider.setComponent(new component.Component('auth-internal', () => customAuthImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    return repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url, nodeAdmin);
}

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
setWebSocketImpl(Websocket__default["default"].Client);

index_standalone.DataSnapshot = DataSnapshot$1;
index_standalone.Database = Database$1;
var OnDisconnect_1 = index_standalone.OnDisconnect = OnDisconnect$1;
index_standalone.QueryConstraint = QueryConstraint;
index_standalone.TransactionResult = TransactionResult$1;
var _QueryImpl = index_standalone._QueryImpl = QueryImpl;
var _QueryParams = index_standalone._QueryParams = QueryParams;
var _ReferenceImpl = index_standalone._ReferenceImpl = ReferenceImpl;
index_standalone._TEST_ACCESS_forceRestClient = forceRestClient;
index_standalone._TEST_ACCESS_hijackHash = hijackHash;
index_standalone._initStandalone = _initStandalone;
var _repoManagerDatabaseFromApp = index_standalone._repoManagerDatabaseFromApp = repoManagerDatabaseFromApp;
var _setSDKVersion = index_standalone._setSDKVersion = setSDKVersion;
var _validatePathString = index_standalone._validatePathString = validatePathString;
var _validateWritablePath = index_standalone._validateWritablePath = validateWritablePath;
var child_1 = index_standalone.child = child;
var connectDatabaseEmulator_1 = index_standalone.connectDatabaseEmulator = connectDatabaseEmulator;
var enableLogging_1 = index_standalone.enableLogging = enableLogging;
var endAt_1 = index_standalone.endAt = endAt;
var endBefore_1 = index_standalone.endBefore = endBefore;
var equalTo_1 = index_standalone.equalTo = equalTo;
var forceLongPolling_1 = index_standalone.forceLongPolling = forceLongPolling;
var forceWebSockets_1 = index_standalone.forceWebSockets = forceWebSockets;
var get_1 = index_standalone.get = get;
var goOffline_1 = index_standalone.goOffline = goOffline;
var goOnline_1 = index_standalone.goOnline = goOnline;
var increment_1 = index_standalone.increment = increment;
var limitToFirst_1 = index_standalone.limitToFirst = limitToFirst;
var limitToLast_1 = index_standalone.limitToLast = limitToLast;
var off_1 = index_standalone.off = off;
var onChildAdded_1 = index_standalone.onChildAdded = onChildAdded;
var onChildChanged_1 = index_standalone.onChildChanged = onChildChanged;
var onChildMoved_1 = index_standalone.onChildMoved = onChildMoved;
var onChildRemoved_1 = index_standalone.onChildRemoved = onChildRemoved;
index_standalone.onDisconnect = onDisconnect;
var onValue_1 = index_standalone.onValue = onValue;
var orderByChild_1 = index_standalone.orderByChild = orderByChild;
var orderByKey_1 = index_standalone.orderByKey = orderByKey;
var orderByPriority_1 = index_standalone.orderByPriority = orderByPriority;
var orderByValue_1 = index_standalone.orderByValue = orderByValue;
var push_1 = index_standalone.push = push;
var query_1 = index_standalone.query = query;
var ref_1 = index_standalone.ref = ref;
var refFromURL_1 = index_standalone.refFromURL = refFromURL;
var remove_1 = index_standalone.remove = remove;
var runTransaction_1 = index_standalone.runTransaction = runTransaction;
var serverTimestamp_1 = index_standalone.serverTimestamp = serverTimestamp;
var set_1 = index_standalone.set = set;
var setPriority_1 = index_standalone.setPriority = setPriority;
var setWithPriority_1 = index_standalone.setWithPriority = setWithPriority;
var startAfter_1 = index_standalone.startAfter = startAfter;
var startAt_1 = index_standalone.startAt = startAt;
var update_1 = index_standalone.update = update;

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const logClient = new require$$1$3.Logger('@firebase/database-compat');
const warn = function (msg) {
    const message = 'FIREBASE WARNING: ' + msg;
    logClient.warn(message);
};

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const validateBoolean = function (fnName, argumentName, bool, optional) {
    if (optional && bool === undefined) {
        return;
    }
    if (typeof bool !== 'boolean') {
        throw new Error(require$$2$3.errorPrefix(fnName, argumentName) + 'must be a boolean.');
    }
};
const validateEventType = function (fnName, eventType, optional) {
    if (optional && eventType === undefined) {
        return;
    }
    switch (eventType) {
        case 'value':
        case 'child_added':
        case 'child_removed':
        case 'child_changed':
        case 'child_moved':
            break;
        default:
            throw new Error(require$$2$3.errorPrefix(fnName, 'eventType') +
                'must be a valid event type = "value", "child_added", "child_removed", ' +
                '"child_changed", or "child_moved".');
    }
};

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class OnDisconnect {
    constructor(_delegate) {
        this._delegate = _delegate;
    }
    cancel(onComplete) {
        require$$2$3.validateArgCount('OnDisconnect.cancel', 0, 1, arguments.length);
        require$$2$3.validateCallback('OnDisconnect.cancel', 'onComplete', onComplete, true);
        const result = this._delegate.cancel();
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    remove(onComplete) {
        require$$2$3.validateArgCount('OnDisconnect.remove', 0, 1, arguments.length);
        require$$2$3.validateCallback('OnDisconnect.remove', 'onComplete', onComplete, true);
        const result = this._delegate.remove();
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    set(value, onComplete) {
        require$$2$3.validateArgCount('OnDisconnect.set', 1, 2, arguments.length);
        require$$2$3.validateCallback('OnDisconnect.set', 'onComplete', onComplete, true);
        const result = this._delegate.set(value);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    setWithPriority(value, priority, onComplete) {
        require$$2$3.validateArgCount('OnDisconnect.setWithPriority', 2, 3, arguments.length);
        require$$2$3.validateCallback('OnDisconnect.setWithPriority', 'onComplete', onComplete, true);
        const result = this._delegate.setWithPriority(value, priority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    update(objectToMerge, onComplete) {
        require$$2$3.validateArgCount('OnDisconnect.update', 1, 2, arguments.length);
        if (Array.isArray(objectToMerge)) {
            const newObjectToMerge = {};
            for (let i = 0; i < objectToMerge.length; ++i) {
                newObjectToMerge['' + i] = objectToMerge[i];
            }
            objectToMerge = newObjectToMerge;
            warn('Passing an Array to firebase.database.onDisconnect().update() is deprecated. Use set() if you want to overwrite the ' +
                'existing data, or an Object with integer keys if you really do want to only update some of the children.');
        }
        require$$2$3.validateCallback('OnDisconnect.update', 'onComplete', onComplete, true);
        const result = this._delegate.update(objectToMerge);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
class TransactionResult {
    /**
     * A type for the resolve value of Firebase.transaction.
     */
    constructor(committed, snapshot) {
        this.committed = committed;
        this.snapshot = snapshot;
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users
    toJSON() {
        require$$2$3.validateArgCount('TransactionResult.toJSON', 0, 1, arguments.length);
        return { committed: this.committed, snapshot: this.snapshot.toJSON() };
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Class representing a firebase data snapshot.  It wraps a SnapshotNode and
 * surfaces the public methods (val, forEach, etc.) we want to expose.
 */
class DataSnapshot {
    constructor(_database, _delegate) {
        this._database = _database;
        this._delegate = _delegate;
    }
    /**
     * Retrieves the snapshot contents as JSON.  Returns null if the snapshot is
     * empty.
     *
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    val() {
        require$$2$3.validateArgCount('DataSnapshot.val', 0, 0, arguments.length);
        return this._delegate.val();
    }
    /**
     * Returns the snapshot contents as JSON, including priorities of node.  Suitable for exporting
     * the entire node contents.
     * @returns JSON representation of the DataSnapshot contents, or null if empty.
     */
    exportVal() {
        require$$2$3.validateArgCount('DataSnapshot.exportVal', 0, 0, arguments.length);
        return this._delegate.exportVal();
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users
    toJSON() {
        // Optional spacer argument is unnecessary because we're depending on recursion rather than stringifying the content
        require$$2$3.validateArgCount('DataSnapshot.toJSON', 0, 1, arguments.length);
        return this._delegate.toJSON();
    }
    /**
     * Returns whether the snapshot contains a non-null value.
     *
     * @returns Whether the snapshot contains a non-null value, or is empty.
     */
    exists() {
        require$$2$3.validateArgCount('DataSnapshot.exists', 0, 0, arguments.length);
        return this._delegate.exists();
    }
    /**
     * Returns a DataSnapshot of the specified child node's contents.
     *
     * @param path - Path to a child.
     * @returns DataSnapshot for child node.
     */
    child(path) {
        require$$2$3.validateArgCount('DataSnapshot.child', 0, 1, arguments.length);
        // Ensure the childPath is a string (can be a number)
        path = String(path);
        _validatePathString('DataSnapshot.child', 'path', path, false);
        return new DataSnapshot(this._database, this._delegate.child(path));
    }
    /**
     * Returns whether the snapshot contains a child at the specified path.
     *
     * @param path - Path to a child.
     * @returns Whether the child exists.
     */
    hasChild(path) {
        require$$2$3.validateArgCount('DataSnapshot.hasChild', 1, 1, arguments.length);
        _validatePathString('DataSnapshot.hasChild', 'path', path, false);
        return this._delegate.hasChild(path);
    }
    /**
     * Returns the priority of the object, or null if no priority was set.
     *
     * @returns The priority.
     */
    getPriority() {
        require$$2$3.validateArgCount('DataSnapshot.getPriority', 0, 0, arguments.length);
        return this._delegate.priority;
    }
    /**
     * Iterates through child nodes and calls the specified action for each one.
     *
     * @param action - Callback function to be called
     * for each child.
     * @returns True if forEach was canceled by action returning true for
     * one of the child nodes.
     */
    forEach(action) {
        require$$2$3.validateArgCount('DataSnapshot.forEach', 1, 1, arguments.length);
        require$$2$3.validateCallback('DataSnapshot.forEach', 'action', action, false);
        return this._delegate.forEach(expDataSnapshot => action(new DataSnapshot(this._database, expDataSnapshot)));
    }
    /**
     * Returns whether this DataSnapshot has children.
     * @returns True if the DataSnapshot contains 1 or more child nodes.
     */
    hasChildren() {
        require$$2$3.validateArgCount('DataSnapshot.hasChildren', 0, 0, arguments.length);
        return this._delegate.hasChildren();
    }
    get key() {
        return this._delegate.key;
    }
    /**
     * Returns the number of children for this DataSnapshot.
     * @returns The number of children that this DataSnapshot contains.
     */
    numChildren() {
        require$$2$3.validateArgCount('DataSnapshot.numChildren', 0, 0, arguments.length);
        return this._delegate.size;
    }
    /**
     * @returns The Firebase reference for the location this snapshot's data came
     * from.
     */
    getRef() {
        require$$2$3.validateArgCount('DataSnapshot.ref', 0, 0, arguments.length);
        return new Reference(this._database, this._delegate.ref);
    }
    get ref() {
        return this.getRef();
    }
}
/**
 * A Query represents a filter to be applied to a firebase location.  This object purely represents the
 * query expression (and exposes our public API to build the query).  The actual query logic is in ViewBase.js.
 *
 * Since every Firebase reference is a query, Firebase inherits from this object.
 */
class Query {
    constructor(database, _delegate) {
        this.database = database;
        this._delegate = _delegate;
    }
    on(eventType, callback, cancelCallbackOrContext, context) {
        require$$2$3.validateArgCount('Query.on', 2, 4, arguments.length);
        require$$2$3.validateCallback('Query.on', 'callback', callback, false);
        const ret = Query.getCancelAndContextArgs_('Query.on', cancelCallbackOrContext, context);
        const valueCallback = (expSnapshot, previousChildName) => {
            callback.call(ret.context, new DataSnapshot(this.database, expSnapshot), previousChildName);
        };
        valueCallback.userCallback = callback;
        valueCallback.context = ret.context;
        const cancelCallback = ret.cancel?.bind(ret.context);
        switch (eventType) {
            case 'value':
                onValue_1(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_added':
                onChildAdded_1(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_removed':
                onChildRemoved_1(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_changed':
                onChildChanged_1(this._delegate, valueCallback, cancelCallback);
                return callback;
            case 'child_moved':
                onChildMoved_1(this._delegate, valueCallback, cancelCallback);
                return callback;
            default:
                throw new Error(require$$2$3.errorPrefix('Query.on', 'eventType') +
                    'must be a valid event type = "value", "child_added", "child_removed", ' +
                    '"child_changed", or "child_moved".');
        }
    }
    off(eventType, callback, context) {
        require$$2$3.validateArgCount('Query.off', 0, 3, arguments.length);
        validateEventType('Query.off', eventType, true);
        require$$2$3.validateCallback('Query.off', 'callback', callback, true);
        require$$2$3.validateContextObject('Query.off', 'context', context, true);
        if (callback) {
            const valueCallback = () => { };
            valueCallback.userCallback = callback;
            valueCallback.context = context;
            off_1(this._delegate, eventType, valueCallback);
        }
        else {
            off_1(this._delegate, eventType);
        }
    }
    /**
     * Get the server-value for this query, or return a cached value if not connected.
     */
    get() {
        return get_1(this._delegate).then(expSnapshot => {
            return new DataSnapshot(this.database, expSnapshot);
        });
    }
    /**
     * Attaches a listener, waits for the first event, and then removes the listener
     */
    once(eventType, callback, failureCallbackOrContext, context) {
        require$$2$3.validateArgCount('Query.once', 1, 4, arguments.length);
        require$$2$3.validateCallback('Query.once', 'callback', callback, true);
        const ret = Query.getCancelAndContextArgs_('Query.once', failureCallbackOrContext, context);
        const deferred = new require$$2$3.Deferred();
        const valueCallback = (expSnapshot, previousChildName) => {
            const result = new DataSnapshot(this.database, expSnapshot);
            if (callback) {
                callback.call(ret.context, result, previousChildName);
            }
            deferred.resolve(result);
        };
        valueCallback.userCallback = callback;
        valueCallback.context = ret.context;
        const cancelCallback = (error) => {
            if (ret.cancel) {
                ret.cancel.call(ret.context, error);
            }
            deferred.reject(error);
        };
        switch (eventType) {
            case 'value':
                onValue_1(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_added':
                onChildAdded_1(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_removed':
                onChildRemoved_1(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_changed':
                onChildChanged_1(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            case 'child_moved':
                onChildMoved_1(this._delegate, valueCallback, cancelCallback, {
                    onlyOnce: true
                });
                break;
            default:
                throw new Error(require$$2$3.errorPrefix('Query.once', 'eventType') +
                    'must be a valid event type = "value", "child_added", "child_removed", ' +
                    '"child_changed", or "child_moved".');
        }
        return deferred.promise;
    }
    /**
     * Set a limit and anchor it to the start of the window.
     */
    limitToFirst(limit) {
        require$$2$3.validateArgCount('Query.limitToFirst', 1, 1, arguments.length);
        return new Query(this.database, query_1(this._delegate, limitToFirst_1(limit)));
    }
    /**
     * Set a limit and anchor it to the end of the window.
     */
    limitToLast(limit) {
        require$$2$3.validateArgCount('Query.limitToLast', 1, 1, arguments.length);
        return new Query(this.database, query_1(this._delegate, limitToLast_1(limit)));
    }
    /**
     * Given a child path, return a new query ordered by the specified grandchild path.
     */
    orderByChild(path) {
        require$$2$3.validateArgCount('Query.orderByChild', 1, 1, arguments.length);
        return new Query(this.database, query_1(this._delegate, orderByChild_1(path)));
    }
    /**
     * Return a new query ordered by the KeyIndex
     */
    orderByKey() {
        require$$2$3.validateArgCount('Query.orderByKey', 0, 0, arguments.length);
        return new Query(this.database, query_1(this._delegate, orderByKey_1()));
    }
    /**
     * Return a new query ordered by the PriorityIndex
     */
    orderByPriority() {
        require$$2$3.validateArgCount('Query.orderByPriority', 0, 0, arguments.length);
        return new Query(this.database, query_1(this._delegate, orderByPriority_1()));
    }
    /**
     * Return a new query ordered by the ValueIndex
     */
    orderByValue() {
        require$$2$3.validateArgCount('Query.orderByValue', 0, 0, arguments.length);
        return new Query(this.database, query_1(this._delegate, orderByValue_1()));
    }
    startAt(value = null, name) {
        require$$2$3.validateArgCount('Query.startAt', 0, 2, arguments.length);
        return new Query(this.database, query_1(this._delegate, startAt_1(value, name)));
    }
    startAfter(value = null, name) {
        require$$2$3.validateArgCount('Query.startAfter', 0, 2, arguments.length);
        return new Query(this.database, query_1(this._delegate, startAfter_1(value, name)));
    }
    endAt(value = null, name) {
        require$$2$3.validateArgCount('Query.endAt', 0, 2, arguments.length);
        return new Query(this.database, query_1(this._delegate, endAt_1(value, name)));
    }
    endBefore(value = null, name) {
        require$$2$3.validateArgCount('Query.endBefore', 0, 2, arguments.length);
        return new Query(this.database, query_1(this._delegate, endBefore_1(value, name)));
    }
    /**
     * Load the selection of children with exactly the specified value, and, optionally,
     * the specified name.
     */
    equalTo(value, name) {
        require$$2$3.validateArgCount('Query.equalTo', 1, 2, arguments.length);
        return new Query(this.database, query_1(this._delegate, equalTo_1(value, name)));
    }
    /**
     * @returns URL for this location.
     */
    toString() {
        require$$2$3.validateArgCount('Query.toString', 0, 0, arguments.length);
        return this._delegate.toString();
    }
    // Do not create public documentation. This is intended to make JSON serialization work but is otherwise unnecessary
    // for end-users.
    toJSON() {
        // An optional spacer argument is unnecessary for a string.
        require$$2$3.validateArgCount('Query.toJSON', 0, 1, arguments.length);
        return this._delegate.toJSON();
    }
    /**
     * Return true if this query and the provided query are equivalent; otherwise, return false.
     */
    isEqual(other) {
        require$$2$3.validateArgCount('Query.isEqual', 1, 1, arguments.length);
        if (!(other instanceof Query)) {
            const error = 'Query.isEqual failed: First argument must be an instance of firebase.database.Query.';
            throw new Error(error);
        }
        return this._delegate.isEqual(other._delegate);
    }
    /**
     * Helper used by .on and .once to extract the context and or cancel arguments.
     * @param fnName - The function name (on or once)
     *
     */
    static getCancelAndContextArgs_(fnName, cancelOrContext, context) {
        const ret = { cancel: undefined, context: undefined };
        if (cancelOrContext && context) {
            ret.cancel = cancelOrContext;
            require$$2$3.validateCallback(fnName, 'cancel', ret.cancel, true);
            ret.context = context;
            require$$2$3.validateContextObject(fnName, 'context', ret.context, true);
        }
        else if (cancelOrContext) {
            // we have either a cancel callback or a context.
            if (typeof cancelOrContext === 'object' && cancelOrContext !== null) {
                // it's a context!
                ret.context = cancelOrContext;
            }
            else if (typeof cancelOrContext === 'function') {
                ret.cancel = cancelOrContext;
            }
            else {
                throw new Error(require$$2$3.errorPrefix(fnName, 'cancelOrContext') +
                    ' must either be a cancel callback or a context object.');
            }
        }
        return ret;
    }
    get ref() {
        return new Reference(this.database, new _ReferenceImpl(this._delegate._repo, this._delegate._path));
    }
}
class Reference extends Query {
    /**
     * Call options:
     *   new Reference(Repo, Path) or
     *   new Reference(url: string, string|RepoManager)
     *
     * Externally - this is the firebase.database.Reference type.
     */
    constructor(database, _delegate) {
        super(database, new _QueryImpl(_delegate._repo, _delegate._path, new _QueryParams(), false));
        this.database = database;
        this._delegate = _delegate;
    }
    /** @returns {?string} */
    getKey() {
        require$$2$3.validateArgCount('Reference.key', 0, 0, arguments.length);
        return this._delegate.key;
    }
    child(pathString) {
        require$$2$3.validateArgCount('Reference.child', 1, 1, arguments.length);
        if (typeof pathString === 'number') {
            pathString = String(pathString);
        }
        return new Reference(this.database, child_1(this._delegate, pathString));
    }
    /** @returns {?Reference} */
    getParent() {
        require$$2$3.validateArgCount('Reference.parent', 0, 0, arguments.length);
        const parent = this._delegate.parent;
        return parent ? new Reference(this.database, parent) : null;
    }
    /** @returns {!Reference} */
    getRoot() {
        require$$2$3.validateArgCount('Reference.root', 0, 0, arguments.length);
        return new Reference(this.database, this._delegate.root);
    }
    set(newVal, onComplete) {
        require$$2$3.validateArgCount('Reference.set', 1, 2, arguments.length);
        require$$2$3.validateCallback('Reference.set', 'onComplete', onComplete, true);
        const result = set_1(this._delegate, newVal);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    update(values, onComplete) {
        require$$2$3.validateArgCount('Reference.update', 1, 2, arguments.length);
        if (Array.isArray(values)) {
            const newObjectToMerge = {};
            for (let i = 0; i < values.length; ++i) {
                newObjectToMerge['' + i] = values[i];
            }
            values = newObjectToMerge;
            warn('Passing an Array to Firebase.update() is deprecated. ' +
                'Use set() if you want to overwrite the existing data, or ' +
                'an Object with integer keys if you really do want to ' +
                'only update some of the children.');
        }
        _validateWritablePath('Reference.update', this._delegate._path);
        require$$2$3.validateCallback('Reference.update', 'onComplete', onComplete, true);
        const result = update_1(this._delegate, values);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    setWithPriority(newVal, newPriority, onComplete) {
        require$$2$3.validateArgCount('Reference.setWithPriority', 2, 3, arguments.length);
        require$$2$3.validateCallback('Reference.setWithPriority', 'onComplete', onComplete, true);
        const result = setWithPriority_1(this._delegate, newVal, newPriority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    remove(onComplete) {
        require$$2$3.validateArgCount('Reference.remove', 0, 1, arguments.length);
        require$$2$3.validateCallback('Reference.remove', 'onComplete', onComplete, true);
        const result = remove_1(this._delegate);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    transaction(transactionUpdate, onComplete, applyLocally) {
        require$$2$3.validateArgCount('Reference.transaction', 1, 3, arguments.length);
        require$$2$3.validateCallback('Reference.transaction', 'transactionUpdate', transactionUpdate, false);
        require$$2$3.validateCallback('Reference.transaction', 'onComplete', onComplete, true);
        validateBoolean('Reference.transaction', 'applyLocally', applyLocally, true);
        const result = runTransaction_1(this._delegate, transactionUpdate, {
            applyLocally
        }).then(transactionResult => new TransactionResult(transactionResult.committed, new DataSnapshot(this.database, transactionResult.snapshot)));
        if (onComplete) {
            result.then(transactionResult => onComplete(null, transactionResult.committed, transactionResult.snapshot), error => onComplete(error, false, null));
        }
        return result;
    }
    setPriority(priority, onComplete) {
        require$$2$3.validateArgCount('Reference.setPriority', 1, 2, arguments.length);
        require$$2$3.validateCallback('Reference.setPriority', 'onComplete', onComplete, true);
        const result = setPriority_1(this._delegate, priority);
        if (onComplete) {
            result.then(() => onComplete(null), error => onComplete(error));
        }
        return result;
    }
    push(value, onComplete) {
        require$$2$3.validateArgCount('Reference.push', 0, 2, arguments.length);
        require$$2$3.validateCallback('Reference.push', 'onComplete', onComplete, true);
        const expPromise = push_1(this._delegate, value);
        const promise = expPromise.then(expRef => new Reference(this.database, expRef));
        if (onComplete) {
            promise.then(() => onComplete(null), error => onComplete(error));
        }
        const result = new Reference(this.database, expPromise);
        result.then = promise.then.bind(promise);
        result.catch = promise.catch.bind(promise, undefined);
        return result;
    }
    onDisconnect() {
        _validateWritablePath('Reference.onDisconnect', this._delegate._path);
        return new OnDisconnect(new OnDisconnect_1(this._delegate._repo, this._delegate._path));
    }
    get key() {
        return this.getKey();
    }
    get parent() {
        return this.getParent();
    }
    get root() {
        return this.getRoot();
    }
}

/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Class representing a firebase database.
 */
class Database {
    /**
     * The constructor should not be called by users of our public API.
     */
    constructor(_delegate, app) {
        this._delegate = _delegate;
        this.app = app;
        this.INTERNAL = {
            delete: () => this._delegate._delete(),
            forceWebSockets: forceWebSockets_1,
            forceLongPolling: forceLongPolling_1
        };
    }
    /**
     * Modify this instance to communicate with the Realtime Database emulator.
     *
     * <p>Note: This method must be called before performing any other operation.
     *
     * @param host - the emulator host (ex: localhost)
     * @param port - the emulator port (ex: 8080)
     * @param options.mockUserToken - the mock auth token to use for unit testing Security Rules
     */
    useEmulator(host, port, options = {}) {
        connectDatabaseEmulator_1(this._delegate, host, port, options);
    }
    ref(path) {
        require$$2$3.validateArgCount('database.ref', 0, 1, arguments.length);
        if (path instanceof Reference) {
            const childRef = refFromURL_1(this._delegate, path.toString());
            return new Reference(this, childRef);
        }
        else {
            const childRef = ref_1(this._delegate, path);
            return new Reference(this, childRef);
        }
    }
    /**
     * Returns a reference to the root or the path specified in url.
     * We throw a exception if the url is not in the same domain as the
     * current repo.
     * @returns Firebase reference.
     */
    refFromURL(url) {
        const apiName = 'database.refFromURL';
        require$$2$3.validateArgCount(apiName, 1, 1, arguments.length);
        const childRef = refFromURL_1(this._delegate, url);
        return new Reference(this, childRef);
    }
    // Make individual repo go offline.
    goOffline() {
        require$$2$3.validateArgCount('database.goOffline', 0, 0, arguments.length);
        return goOffline_1(this._delegate);
    }
    goOnline() {
        require$$2$3.validateArgCount('database.goOnline', 0, 0, arguments.length);
        return goOnline_1(this._delegate);
    }
}
Database.ServerValue = {
    TIMESTAMP: serverTimestamp_1(),
    increment: (delta) => increment_1(delta)
};

/**
 * Used by console to create a database based on the app,
 * passed database URL and a custom auth implementation.
 *
 * @param app - A valid FirebaseApp-like object
 * @param url - A valid Firebase databaseURL
 * @param version - custom version e.g. firebase-admin version
 * @param customAuthImpl - custom auth implementation
 */
function initStandalone$1({ app, url, version, customAuthImpl, customAppCheckImpl, namespace, nodeAdmin = false }) {
    _setSDKVersion(version);
    const container = new require$$0$2.ComponentContainer('database-standalone');
    /**
     * ComponentContainer('database-standalone') is just a placeholder that doesn't perform
     * any actual function.
     */
    const authProvider = new require$$0$2.Provider('auth-internal', container);
    authProvider.setComponent(new require$$0$2.Component('auth-internal', () => customAuthImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    let appCheckProvider = undefined;
    if (customAppCheckImpl) {
        appCheckProvider = new require$$0$2.Provider('app-check-internal', container);
        appCheckProvider.setComponent(new require$$0$2.Component('app-check-internal', () => customAppCheckImpl, "PRIVATE" /* ComponentType.PRIVATE */));
    }
    return {
        instance: new Database(_repoManagerDatabaseFromApp(app, authProvider, appCheckProvider, url, nodeAdmin), app),
        namespace
    };
}

var INTERNAL = /*#__PURE__*/Object.freeze({
	__proto__: null,
	initStandalone: initStandalone$1
});

/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ServerValue = Database.ServerValue;
/**
 * A one off register function which returns a database based on the app and
 * passed database URL. (Used by the Admin SDK)
 *
 * @param app - A valid FirebaseApp-like object
 * @param url - A valid Firebase databaseURL
 * @param version - custom version e.g. firebase-admin version
 * @param nodeAdmin - true if the SDK is being initialized from Firebase Admin.
 */
function initStandalone(app, url, version, nodeAdmin = true) {
    require$$2$3.CONSTANTS.NODE_ADMIN = nodeAdmin;
    return initStandalone$1({
        app,
        url,
        version,
        // firebase-admin-node's app.INTERNAL implements FirebaseAuthInternal interface
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customAuthImpl: app.INTERNAL,
        namespace: {
            Reference,
            Query,
            Database,
            DataSnapshot,
            enableLogging: enableLogging_1,
            INTERNAL,
            ServerValue
        },
        nodeAdmin
    });
}

exports.DataSnapshot = DataSnapshot;
exports.Database = Database;
exports.OnDisconnect = OnDisconnect_1;
exports.Query = Query;
exports.Reference = Reference;
exports.ServerValue = ServerValue;
exports.enableLogging = enableLogging_1;
exports.initStandalone = initStandalone;
//# sourceMappingURL=index.standalone.js.map
