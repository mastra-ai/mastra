var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var input = 'Hey you worthless scumbag';
var result = sentiment.analyze(input);

test('synchronous negative', function (t) {
    t.type(result, 'object');
    t.equal(result.score, -6);
    t.equal(result.comparative, -1.5);
    t.equal(result.tokens.length, 4);
    t.equal(result.words.length, 2);
    t.end();
});
