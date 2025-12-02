var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'self-deluded';
var result = sentiment.analyze(input);

test('synchronous positive', function (t) {
    t.type(result, 'object');
    t.equal(result.score, -2);
    t.equal(result.comparative, -2);
    t.equal(result.tokens.length, 1);
    t.equal(result.words.length, 1);
    t.end();
});
