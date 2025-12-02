/**
 * Runs benchmarks against sentiment and Sentimental.
 *
 * @package sentiment
 * @author Andrew Sliwinski <andrewsliwinski@acm.org>
 */

/**
 * Dependencies
 */
var Benchmark = require('benchmark');
var suite = new Benchmark.Suite();

var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();
var sentimental = require('Sentimental');

/**
 * Test data
 */
var stringShort = 'This cat is totally awesome';
var stringLong = require('../fixtures/corpus');

/**
 * Setup
 */
suite
    .add('sentiment (Latest) - Short ', function () {
        sentiment.analyze(stringShort);
    })
    .add('sentiment (Latest) - Long  ', function () {
        sentiment.analyze(stringLong);
    })
    .add('Sentimental (1.0.1) - Short', function () {
        sentimental.analyze(stringShort);
    })
    .add('Sentimental (1.0.1) - Long ', function () {
        sentimental.analyze(stringLong);
    })
    .on('cycle', function (event) {
        process.stdout.write(String(event.target) + '\n');
    })
    .run({
        minSamples: 100,
        delay: 2
    });
