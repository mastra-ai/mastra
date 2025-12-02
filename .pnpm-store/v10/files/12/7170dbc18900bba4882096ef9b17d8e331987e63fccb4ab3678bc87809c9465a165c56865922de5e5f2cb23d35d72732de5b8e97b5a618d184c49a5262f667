var test = require('tap').test;
var corpus = require('../fixtures/corpus');
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var dataset = corpus;
var result = sentiment.analyze(dataset);

test('synchronous corpus', function (t) {
    t.type(result, 'object');
    t.equal(result.score, -4);
    t.equal(result.tokens.length, 1428);
    t.equal(result.words.length, 74);
    t.end();
});
