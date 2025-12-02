var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();
var mock = require('mock-require');

// Mock a supported language
mock('../../languages/yy/index', {
    labels: { 'cool': 20 }
});

var input = 'This is so cool';
var result = sentiment.analyze(input, { language: 'yy' });

test('synchronous positive', function (t) {
    t.type(result, 'object');
    t.equal(result.score, 20);
    t.equal(result.comparative, 5);
    t.equal(result.tokens.length, 4);
    t.equal(result.words.length, 1);
    t.end();
});
