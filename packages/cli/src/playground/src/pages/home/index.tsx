import { Header } from '@shared/components/ui/header';
import { useAgentTools } from '@shared/hooks/use-agent-tools';

// const tools = [
//   {
//     name: 'get-user-info',
//     description: 'Get user info',
//   },
//   {
//     name: 'get-all-users',
//     description: 'Get all users',
//   },
// ];

const Home = () => {
  const { tools, isLoading } = useAgentTools();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full ">
      <Header title={`Playground`} />
      <div className="w-full h-full grid grid-rows-2 py-6 px-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="px-2 py-2 rounded-md bg-mastra-bg-13 mb-2">
              <div className="flex gap-2 items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
                  />
                </svg>

                <h3 className="text-small text-mastra-el-6">Tools</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(tools).map(([name, tool], index) => (
                <div
                  key={index}
                  className=" hover:bg-mastra-bg-4/80 transition-colors flex flex-col  gap-[0.62rem] bg-mastra-bg-13 px-[0.62rem] py-2 rounded-[0.375rem] cursor-pointer border-[0.5px] border-mastra-border-1"
                >
                  <h3 className="text-small text-mastra-el-6">{name}</h3>
                  <p className="text-small text-mastra-el-2">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="px-2 py-2 rounded-md bg-mastra-bg-13 mb-2">
              <div className="flex gap-2 items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="size-3"
                >
                  <rect width="8" height="8" x="3" y="3" rx="2" />
                  <path d="M7 11v4a2 2 0 0 0 2 2h4" />
                  <rect width="8" height="8" x="13" y="13" rx="2" />
                </svg>

                <h3 className="text-small text-mastra-el-6">Workflows</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
