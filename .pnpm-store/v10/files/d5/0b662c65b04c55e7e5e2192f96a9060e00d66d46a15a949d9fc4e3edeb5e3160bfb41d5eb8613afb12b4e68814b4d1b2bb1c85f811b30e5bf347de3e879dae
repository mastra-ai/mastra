var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'This is so cool';
var result = sentiment.analyze(input);

test('synchronous positive', function (t) {
    t.type(result, 'object');
    t.equal(result.score, 1);
    t.equal(result.comparative, 0.25);
    t.equal(result.tokens.length, 4);
    t.equal(result.words.length, 1);
    t.end();
});
