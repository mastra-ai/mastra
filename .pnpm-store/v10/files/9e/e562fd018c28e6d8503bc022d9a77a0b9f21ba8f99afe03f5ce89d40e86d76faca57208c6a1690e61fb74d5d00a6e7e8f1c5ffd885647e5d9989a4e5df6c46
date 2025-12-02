use crate::arc_rwlock_serde;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tk::pre_tokenizers::PreTokenizerWrapper;
use tk::PreTokenizedString;
use tk::SplitDelimiterBehavior;
use tokenizers as tk;

#[napi(string_enum)]
pub enum JsSplitDelimiterBehavior {
  Removed,
  Isolated,
  MergedWithPrevious,
  MergedWithNext,
  Contiguous,
}

impl TryFrom<String> for JsSplitDelimiterBehavior {
  type Error = Error;

  fn try_from(value: String) -> Result<Self> {
    match &value[..] {
      "removed" => Ok(JsSplitDelimiterBehavior::Removed),
      "isolated" => Ok(JsSplitDelimiterBehavior::Isolated),
      "mergedWithPrevious" => Ok(JsSplitDelimiterBehavior::MergedWithPrevious),
      "mergedWithNext" => Ok(JsSplitDelimiterBehavior::MergedWithNext),
      "contiguous" => Ok(JsSplitDelimiterBehavior::Contiguous),
      _ => Err(Error::from_reason(
        "Wrong value for SplitDelimiterBehavior, expected one of: \
                 `removed, isolated, mergedWithPrevious, mergedWithNext, contiguous`"
          .to_string(),
      )),
    }
  }
}

impl From<JsSplitDelimiterBehavior> for SplitDelimiterBehavior {
  fn from(value: JsSplitDelimiterBehavior) -> Self {
    match value {
      JsSplitDelimiterBehavior::Removed => SplitDelimiterBehavior::Removed,
      JsSplitDelimiterBehavior::Isolated => SplitDelimiterBehavior::Isolated,
      JsSplitDelimiterBehavior::MergedWithPrevious => SplitDelimiterBehavior::MergedWithPrevious,
      JsSplitDelimiterBehavior::MergedWithNext => SplitDelimiterBehavior::MergedWithNext,
      JsSplitDelimiterBehavior::Contiguous => SplitDelimiterBehavior::Contiguous,
    }
  }
}

/// PreTokenizers
#[derive(Clone, Debug, Serialize, Deserialize)]
#[napi]
pub struct PreTokenizer {
  #[serde(flatten, with = "arc_rwlock_serde")]
  pretok: Option<Arc<RwLock<PreTokenizerWrapper>>>,
}

impl tk::PreTokenizer for PreTokenizer {
  fn pre_tokenize(&self, pretokenized: &mut PreTokenizedString) -> tk::Result<()> {
    self
      .pretok
      .as_ref()
      .ok_or("Uninitialized PreTokenizer")?
      .read()
      .unwrap()
      .pre_tokenize(pretokenized)?;

    Ok(())
  }
}

#[napi]
impl PreTokenizer {
  #[napi(ts_return_type = "[string, [number, number]][]")]
  pub fn pre_tokenize_string(&self, sequence: String, env: Env) -> Result<Vec<Array>> {
    use tk::PreTokenizer;

    let mut pretokenized = PreTokenizedString::from(sequence);

    self
      .pre_tokenize(&mut pretokenized)
      .map_err(|e| Error::from_reason(format!("{}", e)))?;

    pretokenized
      .get_splits(tk::OffsetReferential::Original, tk::OffsetType::Char)
      .into_iter()
      .map(|(s, (start, end), _)| -> Result<Array> {
        let mut arr = env.create_array(2)?;
        let mut offset = env.create_array(2)?;
        offset.set(0, env.create_uint32(start as u32)?)?;
        offset.set(1, env.create_uint32(end as u32)?)?;
        arr.set(0, env.create_string(s)?)?;
        arr.set(1, offset)?;
        Ok(arr)
      })
      .collect::<Result<Vec<_>>>()
  }
}

/// byte_level(addPrefixSpace: bool = true, useRegex: bool = true)
#[napi]
pub fn byte_level_pre_tokenizer(
  add_prefix_space: Option<bool>,
  use_regex: Option<bool>,
) -> PreTokenizer {
  let mut byte_level = tk::pre_tokenizers::byte_level::ByteLevel::default();
  if let Some(add_prefix_space) = add_prefix_space {
    byte_level = byte_level.add_prefix_space(add_prefix_space);
  }
  if let Some(use_regex) = use_regex {
    byte_level = byte_level.use_regex(use_regex);
  }

  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(byte_level.into()))),
  }
}

#[napi]
pub fn byte_level_alphabet() -> Vec<String> {
  tk::pre_tokenizers::byte_level::ByteLevel::alphabet()
    .into_iter()
    .map(|c| c.to_string())
    .collect::<Vec<_>>()
}

#[napi]
pub fn whitespace_pre_tokenizer() -> PreTokenizer {
  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::whitespace::Whitespace.into(),
    ))),
  }
}

#[napi]
pub fn whitespace_split_pre_tokenizer() -> PreTokenizer {
  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::whitespace::WhitespaceSplit.into(),
    ))),
  }
}

#[napi]
pub fn bert_pre_tokenizer() -> PreTokenizer {
  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::bert::BertPreTokenizer.into(),
    ))),
  }
}

#[napi]
pub fn metaspace_pre_tokenizer(
  #[napi(ts_arg_type = "string = '▁'")] replacement: Option<String>,
  #[napi(ts_arg_type = "bool = true")] add_prefix_space: Option<bool>,
) -> Result<PreTokenizer> {
  let add_prefix_space = add_prefix_space.unwrap_or(true);
  let replacement = replacement.unwrap_or("▁".to_string());
  if replacement.chars().count() != 1 {
    return Err(Error::from_reason(
      "replacement is supposed to be a single char",
    ));
  }
  let replacement = replacement.chars().next().unwrap();

  Ok(PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::metaspace::Metaspace::new(replacement, add_prefix_space).into(),
    ))),
  })
}

#[napi]
pub fn split_pre_tokenizer(
  pattern: String,
  behavior: String,
  invert: Option<bool>,
) -> Result<PreTokenizer> {
  let behavior: JsSplitDelimiterBehavior = behavior.try_into()?;
  let invert = invert.unwrap_or(false);

  Ok(PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::split::Split::new(pattern, behavior.into(), invert)
        .map_err(|e| Error::from_reason(e.to_string()))?
        .into(),
    ))),
  })
}

#[napi]
pub fn punctuation_pre_tokenizer(behavior: Option<String>) -> Result<PreTokenizer> {
  let behavior = match behavior {
    Some(behavior) => behavior.try_into()?,
    None => JsSplitDelimiterBehavior::Isolated,
  };

  Ok(PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::punctuation::Punctuation::new(behavior.into()).into(),
    ))),
  })
}

#[napi]
pub fn sequence_pre_tokenizer(pre_tokenizers: Vec<&PreTokenizer>) -> PreTokenizer {
  let mut sequence: Vec<PreTokenizerWrapper> = Vec::with_capacity(pre_tokenizers.len());
  pre_tokenizers.into_iter().for_each(|pre_tokenizer| {
    if let Some(pre_tokenizer) = &pre_tokenizer.pretok {
      sequence.push((**pre_tokenizer).read().unwrap().clone())
    }
  });
  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(PreTokenizerWrapper::Sequence(
      tk::pre_tokenizers::sequence::Sequence::new(sequence),
    )))),
  }
}

#[napi]
pub fn char_delimiter_split(delimiter: String) -> Result<PreTokenizer> {
  if delimiter.chars().count() != 1 {
    return Err(Error::from_reason(
      "delimiter is supposed to be a single char",
    ));
  }
  let delimiter = delimiter.chars().next().unwrap();

  Ok(PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::delimiter::CharDelimiterSplit::new(delimiter).into(),
    ))),
  })
}

#[napi]
pub fn digits_pre_tokenizer(individual_digits: Option<bool>) -> PreTokenizer {
  let individual_digits = individual_digits.unwrap_or(false);

  PreTokenizer {
    pretok: Some(Arc::new(RwLock::new(
      tk::pre_tokenizers::digits::Digits::new(individual_digits).into(),
    ))),
  }
}
