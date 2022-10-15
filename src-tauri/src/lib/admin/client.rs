use async_trait::async_trait;
use log::{ debug, warn };
use std::{ time::Duration, vec };

use super::{ types::{ PartitionInfo, TopicInfo }, ConsumerGroupInfo };
use crate::lib::{ configuration::{ build_kafka_client_config, ClusterConfig }, error::{ Error, Result } };
use rdkafka::admin::AdminClient;
use rdkafka::{
    admin::{ AdminOptions, NewTopic, TopicReplication },
    client::DefaultClientContext,
    consumer::{ Consumer, StreamConsumer },
};

#[async_trait]
pub trait Admin {
    fn list_topics(&self) -> Result<Vec<TopicInfo>>;
    fn get_topic_info(&self, topic_name: &str) -> Result<TopicInfo>;
    async fn create_topic(&self, topic_name: &str, partitions: i32, isr: i32, compacted: bool) -> Result<()>;
    fn list_consumer_groups(&self) -> Result<Vec<ConsumerGroupInfo>>;
}

pub struct KafkaAdmin {
    timeout: Duration,
    consumer: StreamConsumer,
    admin_client: AdminClient<DefaultClientContext>,
}

impl KafkaAdmin {
    pub fn new(config: &ClusterConfig) -> KafkaAdmin {
        KafkaAdmin {
            timeout: Duration::from_secs(30),
            consumer: build_kafka_client_config(config)
                .create()
                .expect("Unable to create a consumer for the admin client."),
            admin_client: build_kafka_client_config(config).create().expect("Unable to build the admin client"),
        }
    }
}

#[async_trait]
impl Admin for KafkaAdmin {
    fn list_topics(&self) -> Result<Vec<TopicInfo>> {
        self.list_topics(None)
    }

    fn get_topic_info(&self, topic_name: &str) -> Result<TopicInfo> {
        let info = self.list_topics(Some(topic_name))?;
        if info.len() == 1 {
            Ok(info.get(0).unwrap().clone())
        } else {
            warn!("Topic not found or more than one topic with the same name {}", topic_name);
            Err(Error::Kafka {
                message: "Topic not found".into(),
            })
        }
    }

    async fn create_topic(&self, name: &str, num_partitions: i32, isr: i32, compacted: bool) -> Result<()> {
        let new_topic = NewTopic {
            name,
            num_partitions,
            config: vec![("cleanup.policy", if compacted { "compact" } else { "delete" })],
            replication: TopicReplication::Fixed(isr),
        };
        let opts = AdminOptions::new();
        let res = self.admin_client.create_topics(vec![&new_topic], &opts).await?;
        let res = res.get(0).expect("Create topic: missing result");
        match res {
            Ok(_) => {
                debug!("Topic created successfully");
                Ok(())
            }
            Err(err) => {
                warn!("{:?}", err);
                Err(Error::Kafka {
                    message: format!("Unable to create the topic. {} {}", err.0, err.1),
                })
            }
        }
    }

    fn list_consumer_groups(&self) -> Result<Vec<ConsumerGroupInfo>> {
        let groups = self.consumer.fetch_group_list(None, self.timeout)?;
        debug!("{:?}", groups.groups());
        let groups_info: Vec<ConsumerGroupInfo> = groups
            .groups()
            .iter()
            .map(|g| ConsumerGroupInfo {
                name: g.name().into(),
            })
            .collect();
        Ok(groups_info)
    }
}

impl KafkaAdmin {
    fn list_topics(&self, topic: Option<&str>) -> Result<Vec<TopicInfo>> {
        //todo: cache them
        let topics: Vec<TopicInfo> = self.consumer
            .fetch_metadata(topic, self.timeout)?
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
}