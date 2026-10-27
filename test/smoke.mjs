// Test de fumée : lance le serveur en stdio et appelle chaque outil.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["src/index.js"], env: { ...process.env } });
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
console.log("outils :", tools.map((t) => t.name).join(", "));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n=== ${name} ${JSON.stringify(args)}${r.isError ? " (ERREUR)" : ""}\n` + r.content[0].text.slice(0, 700));
};
await call("list_usecases", { lang: "fr" });
await call("search_tools", { usecase: "video", local: true, limit: 4 });
await call("search_tools", { works_with: "Claude Code", lang: "en", limit: 3 });
await call("get_tool", { id: "ollama", lang: "es" });
await call("recommend_models", { memory_gb: 12, limit: 5 });
await call("get_model", { id: "gpt-oss-20b", lang: "en" });
await call("featured", {});
await call("get_ranking", { period: "day", limit: 3 });
await call("get_ranking", { period: "all", limit: 3, lang: "en" });
await call("get_tool", { id: "nexiste-pas" });
await call("search_catalog", { query: "memory", limit: 3 });
await client.close();
