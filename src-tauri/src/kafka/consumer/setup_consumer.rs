use rdkafka::{ TopicPartitionList, consumer::{ Consumer, StreamConsumer } };
use serde::{ Serialize, Deserialize };

use super::{ create_consumer };
use crate::{ error::Result, configuration::Cluster };

#[derive(Serialize, Deserialize, Debug)]
pub struct ConsumerConfig {
    pub cluster: Cluster,
    pub topic: String,
}

pub(super) fn setup_consumer(config: &ConsumerConfig) -> Result<StreamConsumer> {
    // build the kafka consumer
    let consumer = create_consumer(&config.cluster)?;
    let mut assignment = TopicPartitionList::new();
    assignment.add_partition_offset(&config.topic, 0, rdkafka::Offset::Offset(0))?;
    consumer.assign(&assignment)?;
    Ok(consumer)
}