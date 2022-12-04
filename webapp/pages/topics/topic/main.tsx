import { Center, Container, Loader } from "@mantine/core";
import { RecordsList, RecordsListRef } from "./record-list";
import { getConsumerState, stopConsumer } from "../../../tauri/consumer";
import { PageHeader } from "../../../components";
import { openConsumerModal } from "./consumer-modal";
import { useQuery } from "@tanstack/react-query";
import { getLastOffsets, getTopicInfo } from "../../../tauri/admin";
import { Allotment } from "allotment";
import { ToolsMenu } from "./tools-menu";
import { TopicPageMenu } from "./topic-menu";
import { useRef, useState } from "react";
import { useCache } from "../../../hooks";
import { ExportRecordsModal } from "./export-records-modal";

export const Topic = ({ clusterId, topicName }: { clusterId: string; topicName: string }) => {
  // cached query across navigation
  const [queryState, setQueryState] = useCache(
    {
      key: `topic-page-${clusterId}-${topicName}`,
      initialValue: {
        query:
          "SELECT partition, offset, timestamp, key, payload\nFROM {:topic}\nORDER BY timestamp desc LIMIT {:limit} OFFSET {:offset}\n",
      },
    },
    [clusterId, topicName]
  );

  // topic info to populate the topic menu
  const { estimatedRecords, topicInfo } = useTopicInfo(clusterId, topicName);

  // allotment state
  const [paneHeights, setPaneHeights] = useState({ headerHeight: 10, recordsHeight: 10 });

  // consumer
  const { isLoading, isRunning, consumedRecordsCount, toggleConsumer } = useConsumer(clusterId, topicName);

  // reference to trigger the query
  const recordListRef = useRef<RecordsListRef>(null);

  // export records modal
  const [exportModal, setExportModal] = useState({ opened: false });

  return (
    <>
      <Allotment
        vertical
        onChange={([s1, s2]) => setPaneHeights((s) => ({ ...s, headerHeight: s1, recordsHeight: s2 }))}>
        <Allotment.Pane preferredSize={230} minSize={230}>
          <Container style={{ maxWidth: "100%" }}>
            <PageHeader
              title={topicName}
              subtitle={`Estimated Records: ${estimatedRecords ?? "..."}, Cleanup policy: ${
                topicInfo?.cleanupPolicy ?? "..."
              }, Partitions: ${topicInfo?.partitionCount ?? "..."}`}>
              <ToolsMenu clusterId={clusterId} topic={topicName} />
            </PageHeader>
            {isLoading && (
              <Center mt={10}>
                <Loader />
              </Center>
            )}
            {!isLoading && (
              <TopicPageMenu
                topicName={topicName}
                height={paneHeights.headerHeight - 150}
                onConsumerToggle={toggleConsumer}
                consumedRecords={consumedRecordsCount}
                isConsumerRunning={isRunning}
                query={queryState.query}
                onQueryChange={(query) => setQueryState((s) => ({ ...s, query }))}
                onQuery={() => recordListRef.current?.executeQuery(queryState.query)}
                onExportClick={() => setExportModal({ opened: true })}
              />
            )}
          </Container>
        </Allotment.Pane>
        <Allotment.Pane minSize={400}>
          <Container mt={10} style={{ maxWidth: "100%" }}>
            <RecordsList
              ref={recordListRef}
              clusterId={clusterId}
              topic={topicName}
              height={paneHeights.recordsHeight - 20}
            />
          </Container>
        </Allotment.Pane>
      </Allotment>
      <ExportRecordsModal
        clusterId={clusterId}
        topicName={topicName}
        query={queryState.query}
        opened={exportModal.opened}
        onClose={() => setExportModal({ opened: false })}
      />
    </>
  );
};

const useConsumer = (clusterId: string, topicName: string) => {
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);
  const {
    data: consumerState,
    isLoading,
    refetch,
  } = useQuery(
    ["getConsumerState", clusterId, topicName],
    () => {
      console.log("Refetch");
      return getConsumerState(clusterId, topicName);
    },
    { refetchInterval }
  );

  const toggleConsumer = async () => {
    if (!consumerState) return;
    if (consumerState.isRunning) {
      await stopConsumer(clusterId, topicName);
      setRefetchInterval(false);
    } else {
      setRefetchInterval(1000);
      openConsumerModal({ clusterId, topicName });
    }
    refetch();
  };

  return {
    toggleConsumer,
    isRunning: consumerState?.isRunning ?? false,
    consumedRecordsCount: consumerState?.recordCount ?? 0,
    isLoading,
  };
};

const useTopicInfo = (clusterId: string, topicName: string) => {
  const { data: estimatedRecords } = useQuery(["getLastOffsets", clusterId, topicName], () =>
    getLastOffsets(clusterId, [topicName])
      .then((res) => res[topicName].map((po) => po.offset))
      .then((offsets) => offsets.reduce((a, b) => a + b, 0))
  );

  // get topic information to populate the page header
  const { data: topicInfo } = useQuery(["getTopicInfo", clusterId, topicName], async () => {
    const topicInfo = await getTopicInfo(clusterId, topicName);
    return {
      partitionCount: topicInfo.partitions.length,
      cleanupPolicy: topicInfo.configurations["cleanup.policy"] ?? "...",
    };
  });

  return { estimatedRecords, topicInfo };
};