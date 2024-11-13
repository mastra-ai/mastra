// import { PostgresEngine } from "./engine";


// const engine = new PostgresEngine({ url: 'postgresql://postgres:postgres@localhost:5433/mastra' });


// async function main() {

//     const result = await engine.createConnection({
//         // Connection details
//         connection: {
//             name: "System",
//             connectionId: "SYSTEM",
//             syncConfig: {
//                 repository: "owner/repo",
//                 branch: "main"
//             },
//             issues: ["config_needed", "suh"],
//             subscriptionId: "sub_123"
//         },
//         // Credential details
//         credential: {
//             type: "oauth",
//             value: {
//                 access_token: "github_pat_xxx",
//                 token_type: "bearer",
//                 expires_in: 3600
//             },
//             scope: ["repo", "user"]
//         }
//     });

//     console.log("created", result)

//     const d = await engine.getConnection({
//         connectionId: 'SYSTEM',
//         name: 'System'
//     })

//     console.log("fetched", d)


//     const del = await engine.deleteConnection({ id: d.id })

    
//     console.log("Deleted", del)

// }

// main().then(() => process.exit(0)).catch(console.error)