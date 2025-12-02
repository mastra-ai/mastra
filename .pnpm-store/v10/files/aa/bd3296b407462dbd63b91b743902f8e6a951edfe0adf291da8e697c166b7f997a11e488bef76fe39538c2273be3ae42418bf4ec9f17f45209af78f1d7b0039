var Sentiment = require('../../lib/index');
var sentiment = new Sentiment();

var amazon = require('../fixtures/amazon.json');
var imdb = require('../fixtures/imdb.json');
var yelp = require('../fixtures/yelp.json');

function validate (set) {
    // Storage object
    var obj = {
        pass: 0,
        fail: 0
    };

    // Iterate over each word/class pair in the dataset
    for (var i in set) {
        var score = sentiment.analyze(set[i].text).comparative;
        if (set[i].class === 0) {
            if (score >= 0) obj.fail++;
            if (score < 0) obj.pass++;
        } else {
            if (score >= 0) obj.pass++;
            if (score < 0) obj.fail++;
        }
    }

    // Calculate Rand accuracy
    return obj.pass / (obj.pass + obj.fail);
}

process.stdout.write('Amazon accuracy: ' + validate(amazon) + '\n');
process.stdout.write('IMDB accuracy: ' + validate(imdb) + '\n');
process.stdout.write('Yelp accuracy: ' + validate(yelp) + '\n');
