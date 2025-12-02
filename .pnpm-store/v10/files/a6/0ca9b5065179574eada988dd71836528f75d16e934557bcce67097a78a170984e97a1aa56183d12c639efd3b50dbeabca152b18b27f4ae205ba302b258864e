var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'This is so cool 😃';
var result = sentiment.analyze(input);

test('synchronous positive with emoji', function (t) {
    t.type(result, 'object');
    t.equal(result.score, 3);
    t.equal(result.comparative, 0.6);
    t.equal(result.tokens.length, 5);
    t.equal(result.words.length, 2);
    t.end();
});
