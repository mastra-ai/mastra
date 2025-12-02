use crate::arc_rwlock_serde;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tk::normalizers::NormalizerWrapper;
use tk::NormalizedString;
use tokenizers as tk;

/// Normalizer
#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi]
pub struct Normalizer {
  #[serde(flatten, with = "arc_rwlock_serde")]
  normalizer: Option<Arc<RwLock<NormalizerWrapper>>>,
}

#[napi]
impl Normalizer {
  #[napi]
  pub fn normalize_string(&self, sequence: String) -> Result<String> {
    use tk::Normalizer;

    let mut normalized = NormalizedString::from(sequence);

    self
      .normalize(&mut normalized)
      .map_err(|e| Error::from_reason(format!("{}", e)))?;

    Ok(normalized.get().to_string())
  }
}

impl tk::Normalizer for Normalizer {
  fn normalize(&self, normalized: &mut NormalizedString) -> tk::Result<()> {
    self
      .normalizer
      .as_ref()
      .ok_or("Uninitialized Normalizer")?
      .read()
      .unwrap()
      .normalize(normalized)?;
    Ok(())
  }
}

#[napi]
pub fn prepend_normalizer(prepend: String) -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::prepend::Prepend::new(prepend).into(),
    ))),
  }
}

#[napi]
pub fn strip_accents_normalizer() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::strip::StripAccents.into(),
    ))),
  }
}

#[napi(object)]
#[derive(Default)]
pub struct BertNormalizerOptions {
  pub clean_text: Option<bool>,
  pub handle_chinese_chars: Option<bool>,
  pub strip_accents: Option<bool>,
  pub lowercase: Option<bool>,
}

/// bert_normalizer(options?: {
///   cleanText?: bool = true,
///   handleChineseChars?: bool = true,
///   stripAccents?: bool = true,
///   lowercase?: bool = true
/// })
#[napi]
pub fn bert_normalizer(options: Option<BertNormalizerOptions>) -> Normalizer {
  let options = options.unwrap_or_default();

  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::bert::BertNormalizer::new(
        options.clean_text.unwrap_or(true),
        options.handle_chinese_chars.unwrap_or(true),
        options.strip_accents,
        options.lowercase.unwrap_or(true),
      )
      .into(),
    ))),
  }
}

#[napi]
pub fn nfd_normalizer() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(tk::normalizers::unicode::NFD.into()))),
  }
}

#[napi]
pub fn nfkd_normalizer() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(tk::normalizers::unicode::NFKD.into()))),
  }
}

#[napi]
pub fn nfc_normalizer() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(tk::normalizers::unicode::NFC.into()))),
  }
}

#[napi]
pub fn nfkc_normalizer() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(tk::normalizers::unicode::NFKC.into()))),
  }
}

// /// strip(left?: boolean, right?: boolean)
#[napi]
pub fn strip_normalizer(left: Option<bool>, right: Option<bool>) -> Normalizer {
  let left = left.unwrap_or(true);
  let right = right.unwrap_or(true);

  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::strip::Strip::new(left, right).into(),
    ))),
  }
}

#[napi]
pub fn sequence_normalizer(normalizers: Vec<&Normalizer>) -> Normalizer {
  let mut sequence: Vec<NormalizerWrapper> = Vec::with_capacity(normalizers.len());
  normalizers.into_iter().for_each(|normalizer| {
    if let Some(normalizer) = &normalizer.normalizer {
      sequence.push((**normalizer).read().unwrap().clone())
    }
  });
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(NormalizerWrapper::Sequence(
      tk::normalizers::Sequence::new(sequence),
    )))),
  }
}
#[napi]
pub fn lowercase() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::utils::Lowercase.into(),
    ))),
  }
}

#[napi]
pub fn replace(pattern: String, content: String) -> Result<Normalizer> {
  Ok(Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::replace::Replace::new(pattern, content)
        .map_err(|e| Error::from_reason(e.to_string()))?
        .into(),
    ))),
  })
}

#[napi]
pub fn nmt() -> Normalizer {
  Normalizer {
    normalizer: Some(Arc::new(RwLock::new(tk::normalizers::unicode::Nmt.into()))),
  }
}

#[napi]
pub fn precompiled(bytes: Vec<u8>) -> Result<Normalizer> {
  Ok(Normalizer {
    normalizer: Some(Arc::new(RwLock::new(
      tk::normalizers::precompiled::Precompiled::from(&bytes)
        .map_err(|e| Error::from_reason(e.to_string()))?
        .into(),
    ))),
  })
}
