import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons";
import { RecordsList } from "./record-list";
import { getConsumerState, stopConsumer } from "../../tauri/consumer";
import { PageHeader } from "../../components";
import { openConsumerModal } from "./consumer-modal";
import { useQuery } from "@tanstack/react-query";
import { getLastOffsets, getTopicInfo } from "../../tauri/admin";
import { useState } from "react";

export const Topic = ({ clusterId, topicName }: { clusterId: string; topicName: string }) => {
  const { data, isLoading } = useQuery(
    ["getConsumerState", clusterId, topicName],
    () => getConsumerState(clusterId, topicName),
    { refetchInterval: 500 }
  );

  const { data: estimatedRecord } = useQuery(["getLastOffsets", clusterId, topicName], () =>
    getLastOffsets(clusterId, [topicName])
      .then((res) => res[topicName].map((po) => po.offset))
      .then((offsets) => offsets.reduce((a, b) => a + b, 0))
  );
  const { data: topicInfo } = useQuery(["getTopicInfo", clusterId, topicName], async () => {
    const topicInfo = await getTopicInfo(clusterId, topicName);
    return {
      partitionCount: topicInfo.partitions.length,
      cleanupPolicy: topicInfo.configurations["cleanup.policy"] ?? "...",
    };
  });

  const toggleConsumerRunning = async () => {
    if (!data) return;
    data.isRunning ? await stopConsumer(clusterId, topicName) : openConsumerModal({ clusterId, topicName });
  };

  const defaultQuery =
    "SELECT partition, offset, timestamp, key, payload FROM {:topic} ORDER BY timestamp desc LIMIT {:limit} OFFSET {:offset}";
  const [query, setQuery] = useState<string>(defaultQuery);
  const [modalState, setModalState] = useState<{ opened: boolean; query: string }>({ opened: false, query });

  return (
    <>
      <Modal
        title="Set the query to use to show the data"
        opened={modalState.opened}
        closeOnEscape={false}
        closeOnClickOutside={false}
        onClose={() => setModalState({ ...modalState, opened: false })}>
        <Textarea
          autosize
          value={modalState.query}
          onChange={(e) => setModalState({ ...modalState, query: e.currentTarget.value })}></Textarea>
        <Group position="right">
          <Button
            mt={10}
            size="xs"
            onClick={() => {
              setQuery(modalState.query);
              setModalState({ ...modalState, opened: false });
            }}>
            Save
          </Button>
        </Group>
      </Modal>
      <Container>
        <Group noWrap style={{ maxHeight: 50 }} position={"apart"}>
          <PageHeader
            title={topicName}
            subtitle={`Estimated Records: ${estimatedRecord ?? "..."}, Cleanup policy: ${
              topicInfo?.cleanupPolicy ?? "..."
            }, Partitions: ${topicInfo?.partitionCount ?? "..."}`}
          />
          <Tooltip position="bottom" label="Topic info">
            <ActionIcon>
              <IconInfoCircle />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider my={10} />
        {isLoading && (
          <Center mt={10}>
            <Loader />
          </Center>
        )}
        {!isLoading && data && (
          <>
            <Group>
              <Button
                mb={10}
                size="xs"
                onClick={toggleConsumerRunning}
                rightIcon={
                  <Badge variant="filled" color={"red"}>
                    {data.recordCount}
                  </Badge>
                }>
                {data.isRunning ? "Stop" : "Consume"}
              </Button>
              <Button mb={10} size="xs" onClick={() => setModalState({ ...modalState, opened: true })}>
                Query
              </Button>
              {/* <SearchInput/> */}
            </Group>
            <RecordsList clusterId={clusterId} topic={topicName} heightOffset={140} query={query} />
          </>
        )}
      </Container>
    </>
  );
};
