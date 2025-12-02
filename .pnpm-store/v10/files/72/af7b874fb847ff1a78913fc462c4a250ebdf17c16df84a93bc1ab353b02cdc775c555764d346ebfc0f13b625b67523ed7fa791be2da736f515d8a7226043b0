use crate::arc_rwlock_serde;
use serde::{Deserialize, Serialize};
extern crate tokenizers as tk;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use std::sync::{Arc, RwLock};

use tk::decoders::DecoderWrapper;

/// Decoder
#[derive(Clone, Serialize, Deserialize)]
#[napi]
pub struct Decoder {
  #[serde(flatten, with = "arc_rwlock_serde")]
  decoder: Option<Arc<RwLock<DecoderWrapper>>>,
}

#[napi]
impl Decoder {
  #[napi]
  pub fn decode(&self, tokens: Vec<String>) -> Result<String> {
    use tk::Decoder;

    self
      .decoder
      .as_ref()
      .unwrap()
      .read()
      .unwrap()
      .decode(tokens)
      .map_err(|e| Error::from_reason(format!("{}", e)))
  }
}

impl tk::Decoder for Decoder {
  fn decode_chain(&self, tokens: Vec<String>) -> tk::Result<Vec<String>> {
    self
      .decoder
      .as_ref()
      .ok_or("Uninitialized Decoder")?
      .read()
      .unwrap()
      .decode_chain(tokens)
  }
}

#[napi]
pub fn bpe_decoder(suffix: Option<String>) -> Decoder {
  let suffix = suffix.unwrap_or("</w>".to_string());
  let decoder = Some(Arc::new(RwLock::new(
    tk::decoders::bpe::BPEDecoder::new(suffix).into(),
  )));
  Decoder { decoder }
}

#[napi]
pub fn byte_fallback_decoder() -> Decoder {
  Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::decoders::byte_fallback::ByteFallback::new().into(),
    ))),
  }
}

#[napi]
pub fn ctc_decoder(
  #[napi(ts_arg_type = "string = '<pad>'")] pad_token: Option<String>,
  word_delimiter_token: Option<String>,
  cleanup: Option<bool>,
) -> Decoder {
  let pad_token = pad_token.unwrap_or("<pad>".to_string());
  let word_delimiter_token = word_delimiter_token.unwrap_or("|".to_string());
  let cleanup = cleanup.unwrap_or(true);
  let decoder = Some(Arc::new(RwLock::new(
    tk::decoders::ctc::CTC::new(pad_token, word_delimiter_token, cleanup).into(),
  )));
  Decoder { decoder }
}

#[napi]
pub fn fuse_decoder() -> Decoder {
  Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::decoders::fuse::Fuse::new().into(),
    ))),
  }
}

#[napi]
pub fn metaspace_decoder(
  #[napi(ts_arg_type = "string = '▁'")] replacement: Option<String>,
  #[napi(ts_arg_type = "bool = true")] add_prefix_space: Option<bool>,
) -> Result<Decoder> {
  let add_prefix_space = add_prefix_space.unwrap_or(true);
  let replacement = replacement.unwrap_or("▁".to_string());
  if replacement.chars().count() != 1 {
    return Err(Error::from_reason(
      "replacement is supposed to be a single char",
    ));
  }
  let replacement = replacement.chars().next().unwrap();
  Ok(Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::decoders::metaspace::Metaspace::new(replacement, add_prefix_space).into(),
    ))),
  })
}

#[napi]
pub fn replace_decoder(pattern: String, content: String) -> Result<Decoder> {
  Ok(Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::normalizers::replace::Replace::new(pattern, content)
        .map_err(|e| Error::from_reason(e.to_string()))?
        .into(),
    ))),
  })
}

#[napi]
pub fn sequence_decoder(decoders: Vec<&Decoder>) -> Decoder {
  let sequence: Vec<tk::DecoderWrapper> = decoders
    .into_iter()
    .filter_map(|decoder| {
      decoder
        .decoder
        .as_ref()
        .map(|decoder| (**decoder).read().unwrap().clone())
    })
    .clone()
    .collect();
  Decoder {
    decoder: Some(Arc::new(RwLock::new(tk::DecoderWrapper::Sequence(
      tk::decoders::sequence::Sequence::new(sequence),
    )))),
  }
}

#[napi]
pub fn strip_decoder(content: String, left: u32, right: u32) -> Result<Decoder> {
  let content: char = content.chars().next().ok_or(Error::from_reason(
    "Expected non empty string for strip pattern",
  ))?;
  Ok(Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::decoders::strip::Strip::new(content, left as usize, right as usize).into(),
    ))),
  })
}

#[napi]
pub fn word_piece_decoder(
  #[napi(ts_arg_type = "string = '##'")] prefix: Option<String>,
  #[napi(ts_arg_type = "bool = true")] cleanup: Option<bool>,
) -> Decoder {
  let prefix = prefix.unwrap_or("##".to_string());
  let cleanup = cleanup.unwrap_or(true);
  Decoder {
    decoder: Some(Arc::new(RwLock::new(
      tk::decoders::wordpiece::WordPiece::new(prefix, cleanup).into(),
    ))),
  }
}
