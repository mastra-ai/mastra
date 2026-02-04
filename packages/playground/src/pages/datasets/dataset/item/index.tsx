import { useParams } from 'react-router';
import { useState } from 'react';
import { format } from 'date-fns';
import { ArrowRightToLineIcon, Edit2Icon, EditIcon, FileCodeIcon, Trash2Icon } from 'lucide-react';
import {
  MainContentLayout,
  MainContentContent,
  useDatasetItem,
  useLinkComponent,
  DatasetItemContent,
  DatasetItemVersionsPanel,
  Alert,
  AlertTitle,
  Button,
  Icon,
  type DatasetItemVersion,
  Header,
  HeaderTitle,
  PageHeader,
  cn,
  Popover,
  ButtonsGroup,
} from '@mastra/playground-ui';

function DatasetItemPage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const { Link } = useLinkComponent();

  const { data: item, isLoading: isDatasetItemLoading } = useDatasetItem(datasetId ?? '', itemId ?? '');

  // Version viewing state
  const [activeVersion, setActiveVersion] = useState<Date | string | null>(null);
  const currentVersion = item?.version;

  const handleVersionSelect = (version: DatasetItemVersion) => {
    setActiveVersion(version.isLatest ? null : version.version);
  };

  const handleReturnToLatest = () => {
    setActiveVersion(null);
  };

  // Check if viewing an old version
  const isViewingOldVersion =
    activeVersion != null &&
    currentVersion != null &&
    new Date(activeVersion).getTime() !== new Date(currentVersion).getTime();

  if (isDatasetItemLoading) {
    return null;
  }

  if (!datasetId || !itemId) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral3 p-4">Item not found</div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <>
      <MainContentLayout className="">
        <Header>
          <HeaderTitle>
            <Icon>
              <FileCodeIcon />
            </Icon>
            Dataset Item
          </HeaderTitle>
        </Header>
        <div className="h-full overflow-hidden px-6 pb-4">
          <div className="grid gap-6 max-w-[60rem] mx-auto grid-rows-[auto_1fr] h-full">
            <div className="grid grid-cols-[1fr_auto] gap-6 items-center">
              <PageHeader title="Dataset Item" icon={<FileCodeIcon />} />
              <ButtonsGroup>
                <Button variant="standard" size="default" onClick={handleReturnToLatest}>
                  <Edit2Icon /> Edit
                </Button>
                <Button variant="standard" size="default" onClick={handleReturnToLatest}>
                  <Trash2Icon /> Delete
                </Button>
              </ButtonsGroup>
            </div>

            <div className="grid grid-cols-[1fr_1px_auto] gap-12 overflow-y-auto">
              <div
                className={cn('overflow-y-auto grid gap-6 content-start', {
                  'grid-rows-[auto_1fr]': isViewingOldVersion,
                })}
              >
                {isViewingOldVersion && (
                  <Alert variant="warning">
                    <AlertTitle>
                      Viewing version from {format(new Date(activeVersion), "MMM d, yyyy 'at' h:mm a")}
                    </AlertTitle>
                    <Button variant="standard" size="tiny" className="mt-2 mb-1" onClick={handleReturnToLatest}>
                      <ArrowRightToLineIcon className="inline-block mr-2" /> Return to the latest version
                    </Button>
                  </Alert>
                )}
                {item && (
                  <div className="grid content-start">
                    <DatasetItemContent item={item} Link={Link} />
                  </div>
                )}
              </div>

              <div className="bg-surface5"></div>

              <div className="overflow-y-auto">
                <DatasetItemVersionsPanel
                  datasetId={datasetId}
                  itemId={itemId}
                  onClose={() => {}}
                  onVersionSelect={handleVersionSelect}
                  activeVersion={activeVersion}
                />
              </div>
            </div>
          </div>
        </div>
      </MainContentLayout>
    </>
  );
}

export { DatasetItemPage };
export default DatasetItemPage;
