use crate::{ kafka::error::Error as KafkaError, lib::{ Error, schema_registry::SchemaRegistryError } };
use serde::{ Deserialize, Serialize };
pub type Result<T> = std::result::Result<T, TauriError>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TauriError {
    #[serde(rename = "errorType")]
    pub error_type: String,
    pub message: String,
}

impl From<Error> for TauriError {
    fn from(err: Error) -> Self {
        let (error_type, message) = match err {
            Error::AvroParse { message } => ("Avro parser error", message),
            Error::IOError { message } => ("IO error", message),
            Error::JSONSerdeError { message } => ("JSON Serde error", message),
            Error::ConsumerError { message } => ("Kafka Consumer error", message),
            Error::KafkaError { message } => ("Kafka error", message),
        };
        TauriError { error_type: error_type.into(), message }
    }
}

impl From<SchemaRegistryError> for TauriError {
    fn from(err: SchemaRegistryError) -> Self {
        TauriError {
            error_type: "Schema registry error".into(),
            message: match err {
                SchemaRegistryError::HttpClientError { msg } => msg,
                SchemaRegistryError::UrlError => "Invalid url".into(),
            },
        }
    }
}

impl From<KafkaError> for TauriError {
    fn from(error: KafkaError) -> Self {
        match error {
            KafkaError::GenericKafka { msg } =>
                TauriError {
                    error_type: "Generic Kafka Error".into(),
                    message: msg,
                },
            KafkaError::AvroParse { msg } =>
                TauriError {
                    error_type: "Avro Parse Error".into(),
                    message: msg,
                },
        }
    }
}