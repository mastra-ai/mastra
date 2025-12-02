function rand (limit) {
    return Math.floor(Math.random() * limit);
}

function createRandomWord (length) {
    var consonants = 'bcdfghjklmnpqrstvwxyz!@#$%^&*()_+":;\'?><~`';
    var vowels = 'aeiou';
    var word = '';

    // Split
    consonants = consonants.split('');
    vowels = vowels.split('');

    // Create word
    for (var i = 0; i < length / 2; i++) {
        var randConsonant = consonants[rand(consonants.length)];
        var randVowel = vowels[rand(vowels.length)];
        
        word += (i===0) ? randConsonant.toUpperCase() : randConsonant;
        word += i*2<length-1 ? randVowel : '';
    }

    return word;
}

module.exports = function (length) {
    var words = [];
    for (var i = 0; i < length; i++) {
        words.push(createRandomWord(rand(20)));
    }

    return words.join(' ');
};
