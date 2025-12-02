var test = require('tap').test;
var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

test('adding a language with no labels attribute should throw', function (t) {
    t.throws(function () {
        sentiment.registerLanguage('xx', {});
    }, new Error('language.labels must be defined!'));
    t.end();
});
