use serde::de::Deserializer;
use serde::ser::Serializer;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

pub fn serialize<S, T>(val: &Option<Arc<RwLock<T>>>, s: S) -> Result<S::Ok, S::Error>
where
  S: Serializer,
  T: Serialize,
{
  T::serialize(&*(val.clone().unwrap()).read().unwrap(), s)
}

pub fn deserialize<'de, D, T>(d: D) -> Result<Option<Arc<RwLock<T>>>, D::Error>
where
  D: Deserializer<'de>,
  T: Deserialize<'de>,
{
  Ok(Some(Arc::new(RwLock::new(T::deserialize(d)?))))
}
