import { invoke } from "@tauri-apps/api";
import { ConsumerGroupInfo, TopicInfo } from "../models/kafka";
import { addNotification } from "../providers";
import { format, TauriError } from "./error";

export const createConsumerGroup = (clusterId: string, consumerGroupName: string, topics: string[]): Promise<void> => {
  return invoke<void>("create_consumer_group", { clusterId, consumerGroupName, topics }).catch((err: TauriError) => {
    console.error(err);
    addNotification({
      type: "error",
      title: `Unable to create the consumer group ${consumerGroupName}`,
      description: format(err),
    });
    throw err;
  });
};

export const describeConsumerGroup = (clusterId: string, consumerGroupName: string): Promise<ConsumerGroupInfo> => {
  return invoke<ConsumerGroupInfo>("describe_consumer_group", { clusterId, consumerGroupName }).catch(
    (err: TauriError) => {
      console.error(err);
      addNotification({
        type: "error",
        title: `Unable to describe the consumer group`,
        description: format(err),
      });
      throw err;
    }
  );
};

export const getConsumerGroups = (clusterId: string): Promise<string[]> => {
  return invoke<string[]>("list_consumer_groups", { clusterId }).catch((err: TauriError) => {
    console.error(err);
    addNotification({
      type: "error",
      title: `Unable to retrieve the list of consumer groups`,
      description: format(err),
    });
    throw err;
  });
};

export const createTopic = (
  clusterId: string,
  topicName: string,
  partitions: number,
  isr: number,
  compacted: boolean
): Promise<void> => {
  return invoke<void>("create_topic", { clusterId, topicName, partitions, isr, compacted }).catch((err: TauriError) => {
    console.error(err);
    addNotification({
      type: "error",
      title: `Unable to create the new topic`,
      description: format(err),
    });
    throw err;
  });
};

export const listTopics = (clusterId: string): Promise<string[]> =>
  invoke<{ name: string }[]>("list_topics", { clusterId })
    .then((topics) => topics.map((t) => t.name))
    .catch((err: TauriError) => {
      console.error(err);
      addNotification({
        type: "error",
        title: `Unable to retrieve the list of topics`,
        description: format(err),
      });
      throw err;
    });

export const getTopicInfo = (clusterId: string, topicName: string): Promise<TopicInfo> =>
  invoke<TopicInfo>("get_topic_info", { clusterId, topicName }).catch((err: TauriError) => {
    console.error(err);
    addNotification({
      type: "error",
      title: `Unable to retrieve topic info`,
      description: format(err),
    });
    throw err;
  });
