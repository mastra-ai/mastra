var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'Hey you worthless scumbag 😦';

sentiment.analyze(input, function (err, result) {
    test('asynchronous negative text and emoji', function (t) {
        t.type(result, 'object');
        t.equal(result.score, -8);
        t.equal(result.comparative, -1.6);
        t.equal(result.tokens.length, 5);
        t.equal(result.words.length, 3);
        t.end();
    });
});
