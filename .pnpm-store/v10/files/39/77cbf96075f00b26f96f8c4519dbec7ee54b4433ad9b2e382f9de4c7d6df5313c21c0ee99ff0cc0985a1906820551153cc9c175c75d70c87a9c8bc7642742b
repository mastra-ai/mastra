use crate::arc_rwlock_serde;
use serde::{Deserialize, Serialize};
extern crate tokenizers as tk;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::{Arc, RwLock};

use tk::processors::PostProcessorWrapper;
use tk::Encoding;

#[derive(Clone, Serialize, Deserialize)]
#[napi]
pub struct Processor {
  #[serde(flatten, with = "arc_rwlock_serde")]
  processor: Option<Arc<RwLock<PostProcessorWrapper>>>,
}

impl tk::PostProcessor for Processor {
  fn added_tokens(&self, is_pair: bool) -> usize {
    self
      .processor
      .as_ref()
      .expect("Uninitialized PostProcessor")
      .read()
      .unwrap()
      .added_tokens(is_pair)
  }

  fn process_encodings(
    &self,
    encodings: Vec<Encoding>,
    add_special_tokens: bool,
  ) -> tk::Result<Vec<Encoding>> {
    self
      .processor
      .as_ref()
      .ok_or("Uninitialized PostProcessor")?
      .read()
      .unwrap()
      .process_encodings(encodings, add_special_tokens)
  }
}

#[napi]
pub fn bert_processing(sep: (String, u32), cls: (String, u32)) -> Result<Processor> {
  Ok(Processor {
    processor: Some(Arc::new(RwLock::new(
      tk::processors::bert::BertProcessing::new(sep, cls).into(),
    ))),
  })
}

#[napi]
pub fn roberta_processing(
  sep: (String, u32),
  cls: (String, u32),
  trim_offsets: Option<bool>,
  add_prefix_space: Option<bool>,
) -> Result<Processor> {
  let trim_offsets = trim_offsets.unwrap_or(true);
  let add_prefix_space = add_prefix_space.unwrap_or(true);

  let mut processor = tk::processors::roberta::RobertaProcessing::new(sep, cls);
  processor = processor.trim_offsets(trim_offsets);
  processor = processor.add_prefix_space(add_prefix_space);

  Ok(Processor {
    processor: Some(Arc::new(RwLock::new(processor.into()))),
  })
}

#[napi]
pub fn byte_level_processing(trim_offsets: Option<bool>) -> Result<Processor> {
  let mut byte_level = tk::processors::byte_level::ByteLevel::default();

  if let Some(trim_offsets) = trim_offsets {
    byte_level = byte_level.trim_offsets(trim_offsets);
  }

  Ok(Processor {
    processor: Some(Arc::new(RwLock::new(byte_level.into()))),
  })
}

#[napi]
pub fn template_processing(
  single: String,
  pair: Option<String>,
  special_tokens: Option<Vec<(String, u32)>>,
) -> Result<Processor> {
  let special_tokens = special_tokens.unwrap_or_default();
  let mut builder = tk::processors::template::TemplateProcessing::builder();
  builder.try_single(single).map_err(Error::from_reason)?;
  builder.special_tokens(special_tokens);
  if let Some(pair) = pair {
    builder.try_pair(pair).map_err(Error::from_reason)?;
  }
  let processor = builder
    .build()
    .map_err(|e| Error::from_reason(e.to_string()))?;

  Ok(Processor {
    processor: Some(Arc::new(RwLock::new(processor.into()))),
  })
}

#[napi]
pub fn sequence_processing(processors: Vec<&Processor>) -> Processor {
  let sequence: Vec<tk::PostProcessorWrapper> = processors
    .into_iter()
    .filter_map(|processor| {
      processor
        .processor
        .as_ref()
        .map(|processor| (**processor).read().unwrap().clone())
    })
    .clone()
    .collect();
  Processor {
    processor: Some(Arc::new(RwLock::new(PostProcessorWrapper::Sequence(
      tk::processors::sequence::Sequence::new(sequence),
    )))),
  }
}
