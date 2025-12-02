var Stream = require("stream").Stream;
var util = require('util');

// For Node 0.8 users
if (!Stream.Writable) {
  Stream = require('readable-stream')
}

// Internal proto for buffering memory stream
var MemoryStream = function(options) {
  if (!(this instanceof MemoryStream)) {
    return new MemoryStream();
  }

  this.options = options = options || {};
  if (!this.options.encoding && !this.options.objectMode) {
    this.options.encoding = 'Buffer';
  }

  Stream.Writable.call(this, options);
  this.buffer = [];

};

util.inherits(MemoryStream, Stream.Writable);

MemoryStream.prototype._write = function(chunk, encoding, cb) {
  if (!this._writableState.objectMode && this.options.encoding === 'Buffer' && encoding === 'utf8') {
    this.buffer.push(new Buffer(chunk));
  } else if (this._writableState.objectMode) {
    this.buffer.push(Buffer.isBuffer(chunk) ? JSON.parse(chunk) : chunk);
  } else {
    this.buffer.push(chunk);
  }
  cb();
};

MemoryStream.prototype.get = function() {
  if (this._writableState.objectMode) {
    return this.buffer;
  } else {
    return this.toBuffer();
  }
};

MemoryStream.prototype.toString = function() {
  if (this._writableState.objectMode) {
    JSON.stringify(this.buffer);
  } else {
    return this.buffer.join('');
  }
};

MemoryStream.prototype.toBuffer = function() {
  if (this._writableState.objectMode) {
    return new Buffer(this.toString());
  } else {
    return Buffer.concat(this.buffer);
  }
};

module.exports = MemoryStream;