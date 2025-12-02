var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'constructor';
var result = sentiment.analyze(input);

test('synchronous positive', function (t) {
    t.type(result, 'object');
    t.equal(result.score, 0);
    t.equal(result.comparative, 0);
    t.equal(result.tokens.length, 1);
    t.equal(result.words.length, 0);
    t.end();
});
