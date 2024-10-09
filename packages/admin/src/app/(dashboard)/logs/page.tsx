import { getAgentLogs } from "@/domains/workflows/actions";

export default async function Logs() {

  const logs = await getAgentLogs()
  console.log(logs)

  return (
    <section>
      <h1 className="text-mastra-el-6 p-4">Logs</h1>
      <div style={{ overflowY: 'auto' }}>
        {logs.map((log, index) => {
          return (
            <div key={index}>
              <h2>{log.message}</h2>
              <p>{JSON.stringify(log.metadata)}</p>
            </div>
          )
        })}
      </div>
    </section>)
}
