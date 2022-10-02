use std::time::Duration;
use rdkafka::consumer::Consumer;
use rdkafka::statistics::Partition;
use serde::{ Serialize, Deserialize };

use crate::configuration::{ Cluster };
use crate::error::Result;

use super::consumer::create_consumer;

#[derive(Serialize, Deserialize, Debug)]
pub struct PartitionInfo {
    id: i32,
    isr: usize,
    replicas: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TopicInfo {
    name: String,
    partitions: Vec<PartitionInfo>,
}

#[tauri::command]
pub async fn list_topics(cluster: Cluster) -> Result<Vec<TopicInfo>> {
    let topics: Vec<TopicInfo> = create_consumer(&cluster)?
        .fetch_metadata(None, Duration::from_secs(10))?
        .topics()
        .iter()
        .map(|t| TopicInfo {
            name: t.name().to_string(),
            partitions: t
                .partitions()
                .iter()
                .map(|m| PartitionInfo {
                    id: m.id(),
                    isr: m.isr().len(),
                    replicas: m.replicas().len(),
                })
                .collect(),
        })
        .collect();
    Ok(topics)
}