"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adverbs = exports.verbs = exports.nouns = exports.adjectives = void 0;
exports.humanId = humanId;
exports.poolSize = poolSize;
exports.maxLength = maxLength;
exports.minLength = minLength;
exports.adjectives = ["afraid", "all", "beige", "better", "big", "blue", "bold", "brave", "breezy", "bright", "brown", "bumpy", "busy", "calm", "chatty", "chilly", "chubby", "clean", "clear", "clever", "cold", "common", "cool", "cozy", "crisp", "cuddly", "curly", "curvy", "cute", "cyan", "dark", "deep", "dirty", "dry", "dull", "eager", "early", "easy", "eight", "eighty", "eleven", "empty", "every", "fair", "famous", "fancy", "fast", "few", "fiery", "fifty", "fine", "five", "flat", "floppy", "fluffy", "forty", "four", "frank", "free", "fresh", "fruity", "full", "funky", "funny", "fuzzy", "gentle", "giant", "gold", "good", "goofy", "great", "green", "grumpy", "happy", "heavy", "hip", "honest", "hot", "huge", "humble", "hungry", "icy", "itchy", "jolly", "khaki", "kind", "large", "late", "lazy", "legal", "lemon", "light", "little", "long", "loose", "loud", "lovely", "lucky", "major", "many", "metal", "mighty", "modern", "moody", "neat", "new", "nice", "nine", "ninety", "odd", "old", "olive", "open", "orange", "perky", "petite", "pink", "plain", "plenty", "polite", "pretty", "proud", "public", "puny", "purple", "quick", "quiet", "rare", "ready", "real", "red", "rich", "ripe", "salty", "seven", "shaggy", "shaky", "sharp", "shiny", "short", "shy", "silent", "silly", "silver", "six", "sixty", "slick", "slimy", "slow", "small", "smart", "smooth", "social", "soft", "solid", "some", "sour", "sparkly", "spicy", "spotty", "stale", "strict", "strong", "sunny", "sweet", "swift", "tall", "tame", "tangy", "tasty", "ten", "tender", "thick", "thin", "thirty", "three", "tidy", "tiny", "tired", "tough", "tricky", "true", "twelve", "twenty", "two", "upset", "vast", "violet", "wacky", "warm", "wet", "whole", "wicked", "wide", "wild", "wise", "witty", "yellow", "young", "yummy"];
exports.nouns = ["apes", "animals", "areas", "bars", "banks", "baths", "breads", "bushes", "cloths", "clowns", "clubs", "hoops", "loops", "memes", "papers", "parks", "paths", "showers", "sides", "signs", "sites", "streets", "teeth", "tires", "webs", "actors", "ads", "adults", "aliens", "ants", "apples", "baboons", "badgers", "bags", "bananas", "bats", "beans", "bears", "beds", "beers", "bees", "berries", "bikes", "birds", "boats", "bobcats", "books", "bottles", "boxes", "brooms", "buckets", "bugs", "buses", "buttons", "camels", "cases", "cameras", "candies", "candles", "carpets", "carrots", "carrots", "cars", "cats", "chairs", "chefs", "chicken", "clocks", "clouds", "coats", "cobras", "coins", "corners", "colts", "comics", "cooks", "cougars", "regions", "results", "cows", "crabs", "crabs", "crews", "cups", "cities", "cycles", "dancers", "days", "deer", "dingos", "dodos", "dogs", "dolls", "donkeys", "donuts", "doodles", "doors", "dots", "dragons", "drinks", "dryers", "ducks", "ducks", "eagles", "ears", "eels", "eggs", "ends", "mammals", "emus", "experts", "eyes", "facts", "falcons", "fans", "feet", "files", "flies", "flowers", "forks", "foxes", "friends", "frogs", "games", "garlics", "geckos", "geese", "ghosts", "ghosts", "gifts", "glasses", "goats", "grapes", "groups", "guests", "hairs", "hands", "hats", "heads", "hornets", "horses", "hotels", "hounds", "houses", "humans", "icons", "ideas", "impalas", "insects", "islands", "items", "jars", "jeans", "jobs", "jokes", "keys", "kids", "kings", "kiwis", "knives", "lamps", "lands", "laws", "lemons", "lies", "lights", "lines", "lions", "lizards", "llamas", "mails", "mangos", "maps", "masks", "meals", "melons", "mice", "mirrors", "moments", "moles", "monkeys", "months", "moons", "moose", "mugs", "nails", "needles", "news", "nights", "numbers", "olives", "onions", "oranges", "otters", "owls", "pandas", "pans", "pants", "papayas", "parents", "parts", "parrots", "paws", "peaches", "pears", "peas", "pens", "pets", "phones", "pianos", "pigs", "pillows", "places", "planes", "planets", "plants", "plums", "poems", "poets", "points", "pots", "pugs", "pumas", "queens", "rabbits", "radios", "rats", "ravens", "readers", "rice", "rings", "rivers", "rockets", "rocks", "rooms", "roses", "rules", "schools", "bats", "seals", "seas", "sheep", "shirts", "shoes", "shrimps", "singers", "sloths", "snails", "snakes", "socks", "spiders", "spies", "spoons", "squids", "stamps", "stars", "states", "steaks", "suits", "suns", "swans", "symbols", "tables", "taxes", "taxis", "teams", "terms", "things", "ties", "tigers", "times", "tips", "toes", "towns", "tools", "toys", "trains", "trams", "trees", "turkeys", "turtles", "vans", "views", "walls", "walls", "wasps", "waves", "ways", "weeks", "windows", "wings", "wolves", "wombats", "words", "worlds", "worms", "yaks", "years", "zebras", "zoos"];
exports.verbs = ["accept", "act", "add", "admire", "agree", "allow", "appear", "argue", "arrive", "ask", "attack", "attend", "bake", "bathe", "battle", "beam", "beg", "begin", "behave", "bet", "boil", "bow", "brake", "brush", "build", "burn", "buy", "call", "camp", "care", "carry", "change", "cheat", "check", "cheer", "chew", "clap", "clean", "cough", "count", "cover", "crash", "create", "cross", "cry", "cut", "dance", "decide", "deny", "design", "dig", "divide", "do", "double", "doubt", "draw", "dream", "dress", "drive", "drop", "drum", "eat", "end", "enter", "enjoy", "exist", "fail", "fall", "feel", "fetch", "film", "find", "fix", "flash", "float", "flow", "fly", "fold", "follow", "fry", "give", "glow", "go", "grab", "greet", "grin", "grow", "guess", "hammer", "hang", "happen", "heal", "hear", "help", "hide", "hope", "hug", "hunt", "invent", "invite", "itch", "jam", "jog", "join", "joke", "judge", "juggle", "jump", "kick", "kiss", "kneel", "knock", "know", "laugh", "lay", "lead", "learn", "leave", "lick", "like", "lie", "listen", "live", "look", "lose", "love", "make", "march", "marry", "mate", "matter", "melt", "mix", "move", "nail", "notice", "obey", "occur", "open", "own", "pay", "peel", "play", "poke", "post", "press", "prove", "pull", "pump", "pick", "punch", "push", "raise", "read", "refuse", "relate", "relax", "remain", "repair", "repeat", "reply", "report", "rescue", "rest", "retire", "return", "rhyme", "ring", "roll", "rule", "run", "rush", "say", "scream", "see", "search", "sell", "send", "serve", "shake", "share", "shave", "shine", "show", "shop", "shout", "sin", "sink", "sing", "sip", "sit", "sleep", "slide", "smash", "smell", "smile", "smoke", "sneeze", "sniff", "sort", "speak", "spend", "stand", "start", "stay", "stick", "stop", "stare", "study", "strive", "swim", "switch", "take", "talk", "tan", "tap", "taste", "teach", "tease", "tell", "thank", "think", "throw", "tickle", "tie", "trade", "train", "travel", "try", "turn", "type", "unite", "vanish", "visit", "wait", "walk", "warn", "wash", "watch", "wave", "wear", "win", "wink", "wish", "wonder", "work", "worry", "write", "yawn", "yell"];
exports.adverbs = ["bravely", "brightly", "busily", "daily", "freely", "hungrily", "joyously", "knowlingly", "lazily", "oddly", "mysteriously", "noisily", "politely", "quickly", "quietly", "rapidly", "safely", "sleepily", "slowly", "truly", "yearly"];
function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function longest(arr) { return arr.reduce(function (a, b) { return a.length > b.length ? a : b; }); }
function shortest(arr) { return arr.reduce(function (a, b) { return a.length < b.length ? a : b; }); }
function humanId(options) {
    if (options === void 0) { options = {}; }
    if (typeof options === 'string')
        options = { separator: options };
    if (typeof options === 'boolean')
        options = { capitalize: options };
    var _a = options.separator, separator = _a === void 0 ? '' : _a, _b = options.capitalize, capitalize = _b === void 0 ? true : _b, _c = options.adjectiveCount, adjectiveCount = _c === void 0 ? 1 : _c, _d = options.addAdverb, addAdverb = _d === void 0 ? false : _d;
    var res = __spreadArray(__spreadArray(__spreadArray([], __spreadArray([], Array(adjectiveCount), true).map(function (_) { return random(exports.adjectives); }), true), [
        random(exports.nouns),
        random(exports.verbs)
    ], false), ((addAdverb) ? [random(exports.adverbs)] : []), true);
    if (capitalize)
        res = res.map(function (r) { return r.charAt(0).toUpperCase() + r.substr(1); });
    return res.join(separator);
}
function poolSize(options) {
    if (options === void 0) { options = {}; }
    var _a = options.adjectiveCount, adjectiveCount = _a === void 0 ? 1 : _a, _b = options.addAdverb, addAdverb = _b === void 0 ? false : _b;
    return (exports.adjectives.length * adjectiveCount) * exports.nouns.length * exports.verbs.length * (addAdverb ? exports.adverbs.length : 1);
}
function maxLength(options) {
    if (options === void 0) { options = {}; }
    var _a = options.adjectiveCount, adjectiveCount = _a === void 0 ? 1 : _a, _b = options.addAdverb, addAdverb = _b === void 0 ? false : _b, _c = options.separator, separator = _c === void 0 ? '' : _c;
    return (longest(exports.adjectives).length * adjectiveCount) +
        (adjectiveCount * separator.length) +
        longest(exports.nouns).length +
        separator.length +
        longest(exports.verbs).length +
        (addAdverb ? longest(exports.adverbs).length + separator.length : 0);
}
function minLength(options) {
    if (options === void 0) { options = {}; }
    var _a = options.adjectiveCount, adjectiveCount = _a === void 0 ? 1 : _a, _b = options.addAdverb, addAdverb = _b === void 0 ? false : _b, _c = options.separator, separator = _c === void 0 ? '' : _c;
    return (shortest(exports.adjectives).length * adjectiveCount) +
        (adjectiveCount * separator.length) +
        shortest(exports.nouns).length +
        separator.length +
        shortest(exports.verbs).length +
        (addAdverb ? shortest(exports.adverbs).length + separator.length : 0);
}
exports.default = humanId;
//# sourceMappingURL=index.js.map