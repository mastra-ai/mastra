// ISO 639-1 codes of supported languages
const supported_language_codes = [
  "ar",
  "cs",
  "da",
  "de",
  "en",
  "es",
  "fa",
  "fr",
  "gl",
  "it",
  "ko",
  "nl",
  "pl",
  "pt",
  "ro",
  "ru",
  "sv",
  "tr",
  "vi"
];

const stopwords = require("./stopwords/stopwords");

function extract(
  str,
  options = {
    remove_digits: true,
    return_changed_case: true,
  }
) {
  if (!str) {
    return [];
  }

  const return_changed_case = options.return_changed_case;
  const return_chained_words = options.return_chained_words;
  const remove_digits = options.remove_digits;
  let _language = options.language || "en";
  const _remove_duplicates = options.remove_duplicates || false;
  const return_max_ngrams = options.return_max_ngrams;

  _language = sanitize_language(_language);

  //  strip any HTML and trim whitespace
  const text = str.replace(/(<([^>]+)>)/gi, "").trim();
  if (!text) {
    return [];
  } else {
    const words = text.split(/\s/);
    const unchanged_words = [];
    const low_words = [];
    //  change the case of all the words
    for (let x = 0; x < words.length; x++) {
      let w = words[x].match(/https?:\/\/.*[\r\n]*/g)
        ? words[x]
        : words[x].replace(/\.|,|;|!|\?|\(|\)|:|"|^'|'$|“|”|‘|’/g, "");
      //  remove periods, question marks, exclamation points, commas, and semi-colons
      //  if this is a short result, make sure it's not a single character or something 'odd'
      if (w.length === 1) {
        w = w.replace(/_|@|&|#/g, "");
      }
      //  if it's a number, remove it
      const digits_match = w.match(/\d/g);
      if (remove_digits && digits_match && digits_match.length === w.length) {
        w = "";
      }
      if (w.length > 0) {
        low_words.push(w.toLowerCase());
        unchanged_words.push(w);
      }
    }
    let results = [];
    const _stopwords =
      options.stopwords || getStopwords({ language: _language });
    let _last_result_word_index = 0;
    let _start_result_word_index = 0;
    let _unbroken_word_chain = false;
    for (let y = 0; y < low_words.length; y++) {
      if (_stopwords.indexOf(low_words[y]) < 0) {
        if (_last_result_word_index !== y - 1) {
          _start_result_word_index = y;
          _unbroken_word_chain = false;
        } else {
          _unbroken_word_chain = true;
        }
        const result_word =
          return_changed_case &&
            !unchanged_words[y].match(/https?:\/\/.*[\r\n]*/g)
            ? low_words[y]
            : unchanged_words[y];

        if (
          return_max_ngrams &&
          _unbroken_word_chain &&
          !return_chained_words &&
          return_max_ngrams > y - _start_result_word_index &&
          _last_result_word_index === y - 1
        ) {
          const change_pos = results.length - 1 < 0 ? 0 : results.length - 1;
          results[change_pos] = results[change_pos]
            ? results[change_pos] + " " + result_word
            : result_word;
        } else if (return_chained_words && _last_result_word_index === y - 1) {
          const change_pos = results.length - 1 < 0 ? 0 : results.length - 1;
          results[change_pos] = results[change_pos]
            ? results[change_pos] + " " + result_word
            : result_word;
        } else {
          results.push(result_word);
        }

        _last_result_word_index = y;
      } else {
        _unbroken_word_chain = false;
      }
    }

    if (_remove_duplicates) {
      results = results.filter((v, i, a) => a.indexOf(v) === i);;
    }

    return results;
  }
}

function getStopwords(options) {
  options = options || {};

  let _language = options.language || "en";
  _language = sanitize_language(_language);

  return stopwords[_language];
}

// Sanitize requested language
function sanitize_language(requested_language) {
  const error_message = "Language must be one of [" +
    supported_language_codes.join(", ") + "]";

  if (typeof requested_language !== "string") {
    throw new Error(error_message);
  }

  // Fallback for old language option format
  const _requested_language = (requested_language.length === 2) ?
    requested_language :
    get_language_mapping(requested_language);

  if (supported_language_codes.indexOf(_requested_language) < 0) {
    throw new Error(error_message);
  }

  return _requested_language;
}

// Support old language option format by mapping to ISO 639-1 codes
function get_language_mapping(requested_language) {
  if (typeof requested_language !== "string") {
    return "";
  }

  const mapping = {
    arabic: "ar",
    czech: "cs",
    danish: "da",
    dutch: "nl",
    english: "en",
    french: "fr",
    galician: "gl",
    german: "de",
    italian: "it",
    korean: "ko",
    persian: "fa",
    polish: "pl",
    portuguese: "pt",
    romanian: "ro",
    russian: "ru",
    spanish: "es",
    swedish: "sv",
    turkish: "tr",
    vietnam: "vt"
  };

  return mapping[requested_language] || "";
}

module.exports = {
  getStopwords,
  extract,
  supported_language_codes
}
