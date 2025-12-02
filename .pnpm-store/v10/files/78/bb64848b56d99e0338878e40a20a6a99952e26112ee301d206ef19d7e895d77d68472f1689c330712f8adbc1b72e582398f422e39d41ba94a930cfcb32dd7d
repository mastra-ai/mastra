'use strict';

module.exports = function (stream) {
  var ended;

  if (typeof stream.ended !== 'undefined') {
    ended = stream.ended;
  } else {
    ended = stream._readableState.ended;
  }

  return Boolean(ended).valueOf();
};
