var test = require('tap').test;
var fuzz = require('../fixtures/fuzz');
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = fuzz(1000);

test('synchronous fuzz', function (t) {
    t.type(sentiment.analyze(input), 'object');
    t.end();
});
