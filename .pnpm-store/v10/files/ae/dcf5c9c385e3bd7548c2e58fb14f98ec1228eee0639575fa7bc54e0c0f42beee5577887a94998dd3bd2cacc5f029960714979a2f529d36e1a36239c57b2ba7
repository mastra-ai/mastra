var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = undefined;
var result = sentiment.analyze(input);

test('synchronous undefined', function (t) {
    t.type(result, 'object');
    t.equal(result.score, 0);
    t.equal(result.comparative, 0);
    t.equal(result.tokens.length, 1);
    t.equal(result.words.length, 0);
    t.end();
});
