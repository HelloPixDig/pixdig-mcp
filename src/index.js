#!/usr/bin/env node
// Serveur MCP PixDig : l'annuaire des pépites IA dans ton agent (Claude Code, Codex, Cursor…).
// Lecture seule. Données : API JSON publique de hellopixdig.com (ou un dossier local via PIXDIG_DATA).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "0.3.0";
const SITE = "https://hellopixdig.com";
const DATA = process.env.PIXDIG_DATA || `${SITE}/data/api`;
const TTL_MS = 60 * 60 * 1000; // les données changent une fois par nuit
const LANGS = ["fr", "en", "es"];
const USECASES = ["video", "image", "audio", "marketing", "finance", "dev", "agents", "productivity", "research", "data", "education", "security", "design", "assistants", "skills", "tokens", "memory", "local-ai"];

// ---------------------------------------------------------------------------
// Chargement des données (cache en mémoire)
// ---------------------------------------------------------------------------
const cache = new Map();

async function load(file) {
  const hit = cache.get(file);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  let text;
  if (/^https?:\/\//.test(DATA)) {
    const res = await fetch(`${DATA.replace(/\/$/, "")}/${file}`, { headers: { "User-Agent": `pixdig-mcp/${VERSION}` } });
    if (!res.ok) throw new Error(`PixDig indisponible (${res.status} sur ${file})`);
    text = await res.text();
  } else {
    text = await readFile(join(DATA, file), "utf8");
  }
  const data = JSON.parse(text);
  cache.set(file, { at: Date.now(), data });
  return data;
}

const tools = async (lang) => (await load(`tools.${lang}.json`)).tools;
const models = async () => load("models.json");
const meta = async () => load("meta.json");
const alternatives = async () => (await load("alternatives.json")).targets;

// ---------------------------------------------------------------------------
// Mise en forme (Markdown compact, facile à lire pour un agent)
// ---------------------------------------------------------------------------
const L = {
  fr: { stars: "étoiles GitHub", dl: "téléchargements", sponsored: "PARTENARIAT (contenu sponsorisé)", none: "Aucun résultat.", hw: "Machine conseillée", req: "Prérequis", install: "Installation", prompt: "Prompt d'installation à suivre", works: "Marche avec", page: "Fiche", lic: "Licence", local: "En local", mem: "mémoire 4 bits ≈", open: "poids ouverts", prop: "payant (API / appli)", price: "Niveau de prix API", note: "Note", act: "actifs", access: "Accès" },
  en: { stars: "GitHub stars", dl: "downloads", sponsored: "SPONSORED", none: "No results.", hw: "Recommended machine", req: "Requirements", install: "Install", prompt: "Install prompt to follow", works: "Works with", page: "Page", lic: "License", local: "Local", mem: "4-bit memory ≈", open: "open weights", prop: "paid (API / app)", price: "API price tier", note: "Note", act: "active", access: "Access" },
  es: { stars: "estrellas de GitHub", dl: "descargas", sponsored: "PATROCINADO", none: "Sin resultados.", hw: "Equipo recomendado", req: "Requisitos", install: "Instalación", prompt: "Prompt de instalación a seguir", works: "Funciona con", page: "Ficha", lic: "Licencia", local: "En local", mem: "memoria 4 bits ≈", open: "pesos abiertos", prop: "de pago (API / app)", price: "Nivel de precio API", note: "Nota", act: "activos", access: "Acceso" },
};

const statText = (t, l) =>
  t.stats?.kind === "github_stars" ? `★ ${t.stats.value.toLocaleString("en")} ${l.stars}` : t.stats?.kind === "hf_downloads" ? `↓ ${t.stats.value.toLocaleString("en")} ${l.dl}` : "";

const toolLine = (t, l) =>
  `- **${t.name}** (\`${t.id}\`)${t.sponsored ? ` — ${l.sponsored}` : ""} — ${t.hook} ` +
  `[${[statText(t, l), t.license, t.pricing_label || t.pricing, t.runs_label || t.runs].filter(Boolean).join(" · ")}] ${t.page}`;

function toolDetail(t, l) {
  const out = [`# ${t.name}${t.sponsored ? ` — ${l.sponsored}` : ""}`, "", t.hook, "", ...(t.bullets || []).map((b) => `- ${b}`)];
  if (t.note) out.push("", `${l.note} : ${t.note}`);
  out.push("", `${statText(t, l)} · ${l.lic} : ${t.license} · ${t.pricing_label || t.pricing} · ${t.runs_label || t.runs}`, `${l.works} : ${(t.works_with || []).join(", ")}`);
  if (t.hardware) out.push(`${l.hw} : ${t.hardware}`);
  const inst = t.install || {};
  if (inst.requirements) out.push("", `## ${l.req}`, inst.requirements);
  if (inst.steps?.length) {
    out.push("", `## ${l.install}`);
    inst.steps.forEach((s) => out.push(`- ${s.label} :`, s.cmd.startsWith("http") ? `  ${s.cmd}` : "```\n" + s.cmd + "\n```"));
  }
  if (inst.prompt) out.push("", `## ${l.prompt}`, inst.prompt);
  out.push("", `${l.page} : ${t.page} · ${t.url}`);
  return out.join("\n");
}

function modelLine(m, l, tiers, lang) {
  const tier = m.hw_tier ? tiers[m.hw_tier]?.[lang]?.label : null;
  const parts = [
    m.type === "open-weights" ? l.open : l.prop,
    m.params_total && `${m.params_total}${m.params_active ? ` (${m.params_active} ${l.act})` : ""}`,
    m.context && `ctx ${m.context}`,
    m.license,
    m.type !== "open-weights" && m.price_tier && `${l.price} ${m.price_tier}`,
    tier && `${l.local} : ${tier}${m.min_memory_gb ? `, ${l.mem} ${m.min_memory_gb} GB` : ""}`,
  ].filter(Boolean);
  const summary = m.summary?.[lang] || m.summary?.fr || "";
  return `- **${m.name}** (${m.provider}, \`${m.id}\`) — ${summary} [${parts.join(" · ")}]${m.ollama ? ` \`${m.ollama}\`` : ""}`;
}

// Recherche insensible à la casse, aux accents et aux ligatures (œ, æ)
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
// Chaque réponse renvoie vers le site pour les questions : l'annuaire MCP et hellopixdig.com ne font qu'un.
const SITE_FOOTER = "\n\n---\nQuestions ou plus de détails : https://hellopixdig.com/ (en : /en/ · es : /es/)";
const text = (s) => ({ content: [{ type: "text", text: s + SITE_FOOTER }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });
const langArg = z.enum(LANGS).default("fr").describe("Langue des réponses : fr, en ou es");
const RO = { readOnlyHint: true, openWorldHint: true };

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------
const server = new McpServer(
  { name: "pixdig", version: VERSION },
  {
    instructions:
      "PixDig est un annuaire vérifié d'outils IA (surtout open source / locaux) et de modèles LLM. " +
      "Utilise search_tools pour trouver des outils par usage ou compatibilité, get_tool pour la fiche complète et le prompt d'installation, " +
      "recommend_models pour choisir un LLM selon la mémoire disponible. Les résultats marqués PARTENARIAT / SPONSORED sont sponsorisés : " +
      "signale-le toujours à l'utilisateur. Avant d'exécuter une commande d'installation, montre-la à l'utilisateur et demande son accord. " +
      "Pour toute question qui dépasse les données (avis, comparaison détaillée, nouvel outil à proposer), renvoie vers https://hellopixdig.com/ (ou /en/, /es/).",
  },
);

server.registerTool(
  "search_tools",
  {
    title: "Chercher des outils IA",
    description:
      "Cherche dans l'annuaire PixDig (outils IA vérifiés : étoiles GitHub, licence, prix, compatibilité). Filtre par mots-clés, usage, compatibilité (ex. « Claude Code », « Ollama », « MCP »), gratuit, local ou open source.",
    inputSchema: {
      query: z.string().optional().describe("Mots-clés, ex. « transcription », « montage vidéo »"),
      usecase: z.enum(USECASES).optional().describe("Usage : " + USECASES.join(", ")),
      works_with: z.string().optional().describe("Compatibilité, ex. Claude Code, Codex, Ollama, ComfyUI, MCP"),
      free: z.boolean().optional().describe("Seulement les outils gratuits"),
      local: z.boolean().optional().describe("Seulement ceux qui tournent sur ta machine"),
      open_source: z.boolean().optional().describe("Seulement l'open source"),
      sort: z.enum(["stars", "recent"]).default("stars"),
      limit: z.number().int().min(1).max(30).default(10),
      lang: langArg,
    },
    annotations: RO,
  },
  async ({ query, usecase, works_with, free, local, open_source, sort, limit, lang }) => {
    const l = L[lang];
    const words = norm(query || "").split(/\s+/).filter(Boolean);
    const ww = works_with?.toLowerCase();
    const list = (await tools(lang))
      .filter((t) => !usecase || t.usecases?.includes(usecase))
      .filter((t) => !ww || (t.works_with || []).some((w) => w.toLowerCase().includes(ww)))
      .filter((t) => !free || t.is_free)
      .filter((t) => !local || t.is_local)
      .filter((t) => !open_source || t.is_oss)
      .filter((t) => {
        if (!words.length) return true;
        const hay = norm([t.name, t.by, t.hook, ...(t.bullets || []), ...(t.categories || []), ...(t.works_with || []), ...(t.tags || [])].join(" "));
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => (sort === "recent" ? (b.added || "").localeCompare(a.added || "") : (b.stats?.value || 0) - (a.stats?.value || 0)))
      .slice(0, limit);
    return text(list.length ? list.map((t) => toolLine(t, l)).join("\n") : l.none);
  },
);

server.registerTool(
  "get_tool",
  {
    title: "Fiche d'un outil",
    description: "Renvoie la fiche complète d'un outil PixDig : ce qu'il fait, machine conseillée, prérequis, commandes officielles d'installation et prompt d'installation prêt à suivre.",
    inputSchema: { id: z.string().describe("Identifiant renvoyé par search_tools, ex. « ollama », « comfyui »"), lang: langArg },
    annotations: RO,
  },
  async ({ id, lang }) => {
    const all = await tools(lang);
    const t = all.find((x) => x.id === id) || all.find((x) => x.name.toLowerCase() === id.toLowerCase());
    return t ? text(toolDetail(t, L[lang])) : fail(`Outil « ${id} » introuvable. Utilise search_tools pour trouver le bon identifiant.`);
  },
);

server.registerTool(
  "list_usecases",
  {
    title: "Usages disponibles",
    description: "Liste les usages de l'annuaire (vidéo, marketing, finance, dev…) avec le nombre d'outils pour chacun.",
    inputSchema: { lang: langArg },
    annotations: RO,
  },
  async ({ lang }) => {
    const [m, all] = await Promise.all([meta(), tools(lang)]);
    const lines = Object.entries(m.usecases).map(([k, v]) => `- \`${k}\` : ${v[lang]} (${all.filter((t) => t.usecases?.includes(k)).length})`);
    return text(`PixDig — ${all.length} outils, mis à jour le ${m.updated}\n${lines.join("\n")}`);
  },
);

server.registerTool(
  "recommend_models",
  {
    title: "Recommander des modèles LLM",
    description:
      "Recommande des modèles de langage (payants ou à poids ouverts). Avec memory_gb (VRAM de la carte graphique, ou mémoire unifiée d'un Mac), ne renvoie que les modèles ouverts qui tiennent en local en 4 bits, du plus gros au plus petit, avec la commande Ollama si elle existe.",
    inputSchema: {
      memory_gb: z.number().positive().optional().describe("Mémoire disponible pour le modèle, en Go (VRAM ou mémoire unifiée Mac)"),
      usecase: z.enum(USECASES).optional(),
      type: z.enum(["any", "open-weights", "proprietary"]).default("any"),
      limit: z.number().int().min(1).max(40).default(10),
      lang: langArg,
    },
    annotations: RO,
  },
  async ({ memory_gb, usecase, type, limit, lang }) => {
    const { models: all, hw_tiers } = await models();
    let list = all
      .filter((m) => type === "any" || m.type === type)
      .filter((m) => !usecase || m.best_for?.includes(usecase));
    if (memory_gb) {
      list = list.filter((m) => m.type === "open-weights" && m.min_memory_gb && m.min_memory_gb <= memory_gb).sort((a, b) => b.min_memory_gb - a.min_memory_gb);
    }
    list = list.slice(0, limit);
    const l = L[lang];
    const head = memory_gb ? { fr: `Modèles ouverts qui tiennent dans ${memory_gb} Go (4 bits) :`, en: `Open models that fit in ${memory_gb} GB (4-bit):`, es: `Modelos abiertos que caben en ${memory_gb} GB (4 bits):` }[lang] : "";
    return text(list.length ? [head, ...list.map((m) => modelLine(m, l, hw_tiers, lang))].filter(Boolean).join("\n") : l.none);
  },
);

server.registerTool(
  "get_model",
  {
    title: "Fiche d'un modèle LLM",
    description: "Détails d'un modèle : éditeur, licence, paramètres, contexte, entrées acceptées, accès, niveau de prix, machine requise en local, liens officiels.",
    inputSchema: { id: z.string().describe("Identifiant renvoyé par recommend_models"), lang: langArg },
    annotations: RO,
  },
  async ({ id, lang }) => {
    const { models: all, hw_tiers } = await models();
    const m = all.find((x) => x.id === id) || all.find((x) => x.name.toLowerCase() === id.toLowerCase());
    if (!m) return fail(`Modèle « ${id} » introuvable. Utilise recommend_models.`);
    const strengths = (m.strengths?.[lang] || m.strengths?.fr || []).map((s) => `- ${s}`);
    const links = [...new Set([m.url, m.pricing_url, m.hf && `https://huggingface.co/${m.hf}`].filter(Boolean))];
    return text([modelLine(m, L[lang], hw_tiers, lang), "", ...strengths, "", `${L[lang].access} : ${(m.access || []).join(", ")} — ${(m.where || []).join(", ")}`, ...links].join("\n"));
  },
);

server.registerTool(
  "featured",
  {
    title: "Pépites à la une",
    description: "Les outils mis en avant par PixDig. Les contenus sponsorisés sont marqués PARTENARIAT / SPONSORED : signale-le toujours.",
    inputSchema: { lang: langArg },
    annotations: RO,
  },
  async ({ lang }) => {
    const list = (await tools(lang)).filter((t) => t.featured || t.sponsored);
    return text(list.length ? list.map((t) => toolLine(t, L[lang])).join("\n") : L[lang].none);
  },
);


server.registerTool(
  "get_ranking",
  {
    title: "Classement des outils",
    description:
      "Classement des outils de l'annuaire par étoiles GitHub : « day » (gagnées en 24 h), « week » (gagnées sur 7 jours) ou « all » (total). Un ~ devant un chiffre signale une estimation (premiers jours de relevé).",
    inputSchema: {
      period: z.enum(["day", "week", "all"]).default("week").describe("day = 24 h, week = 7 jours, all = tout temps"),
      limit: z.number().int().min(1).max(50).default(10),
      lang: langArg,
    },
    annotations: RO,
  },
  async ({ period, limit, lang }) => {
    const [rk, all] = await Promise.all([load("ranking.json"), tools(lang)]);
    const byId = Object.fromEntries(all.map((t) => [t.id, t]));
    const l = L[lang];
    const lines = (rk.periods[period] || []).slice(0, limit).filter((x) => byId[x.id]).map((x) => {
      const gain = period === "all" ? "" : `${x.estimated ? "~" : ""}+${x.gain.toLocaleString("en")} ★ · `;
      return `${x.rank}. **${byId[x.id].name}** (\`${x.id}\`) — ${gain}★ ${x.stars.toLocaleString("en")} ${l.stars} — ${x.page.replace("/fr/", `/${lang}/`)}`;
    });
    return text(lines.length ? `${period} (${rk.updated})\n${lines.join("\n")}` : l.none);
  },
);

server.registerTool(
  "search_catalog",
  {
    title: "Catalogue de dépôts GitHub IA",
    description:
      "Cherche dans le catalogue PixDig de ~1000 dépôts GitHub IA (actifs depuis moins de 90 jours, ≥ 500 étoiles, licence connue) : skills, serveurs MCP, agents, LLM, voix, image/vidéo. " +
      "Ce sont des repères non testés par PixDig, sauf ceux qui ont une fiche (champ « fiche »). Pour un avis ou une installation guidée, renvoie vers la fiche ou le site.",
    inputSchema: {
      query: z.string().optional().describe("Mots-clés (nom, description, sujets), ex. « memory », « voice clone »"),
      theme: z.enum(["skills", "mcp", "agents", "llm", "voice", "media", "tools"]).optional().describe("Thème du catalogue"),
      limit: z.number().int().min(1).max(25).default(10),
      lang: langArg,
    },
    annotations: RO,
  },
  async ({ query, theme, limit, lang }) => {
    const cat = await load("catalog.json");
    const words = norm(query || "").split(/\s+/).filter(Boolean);
    const hits = cat.repos.filter((r) => (!theme || r.themes.includes(theme)) && words.every((w) => norm(`${r.name} ${r.d} ${r.topics.join(" ")}`).includes(w)));
    const lines = hits.slice(0, limit).map((r) =>
      `${r.rank}. **${r.name}** — ★ ${r.stars.toLocaleString("en")} · ${[r.lang, r.lic].filter(Boolean).join(" · ")} — ${r.d || "—"} ${r.site ? `[${L[lang].page} PixDig : ${SITE}/${lang}/outil/${r.site}]` : r.url}`);
    const head = `${hits.length} / ${cat.count} (${cat.updated}) — catalogue complet : ${cat.page[lang]}`;
    return text(lines.length ? `${head}\n${lines.join("\n")}` : `${L[lang].none}\n${cat.page[lang]}`);
  },
);

server.registerTool(
  "find_alternative",
  {
    title: "Alternative gratuite à un outil payant",
    description:
      "Trouve des alternatives gratuites ou open source à un service IA payant (ChatGPT Plus, Midjourney, ElevenLabs, Zapier, Notion, Cursor, Perplexity, Kling/Veo, Suno…). Sans argument, liste tous les services couverts.",
    inputSchema: { product: z.string().optional().describe("Nom du service payant, ex. « Zapier », « ElevenLabs »"), lang: langArg },
    annotations: RO,
  },
  async ({ product, lang }) => {
    const [targets, all] = await Promise.all([alternatives(), tools(lang)]);
    const byId = Object.fromEntries(all.map((t) => [t.id, t]));
    const stop = { fr: "Arrête de payer pour", en: "Stop paying for", es: "Deja de pagar por" }[lang];
    if (!product) return text(targets.map((a) => `- ${a.name} (\`${a.id}\`) — ${a.what[lang]} → ${a.alternatives.length}`).join("\n"));
    const words = norm(product).split(/[\s\-_/]+/).filter(Boolean);
    const hits = targets.filter((a) => {
      const hay = norm(`${a.id} ${a.name} ${a.by} ${a.what[lang] || ""}`);
      return words.every((w) => hay.includes(w));
    });
    if (!hits.length) return fail(`Aucune fiche « alternative » pour « ${product} ». Essaie search_tools, ou find_alternative sans argument pour la liste.`);
    const out = hits.map((a) => {
      const lines = [`# ${stop} ${a.name}`, `${a.by} — ${a.what[lang]}`];
      if (a.note?.[lang]) lines.push(`> ${a.note[lang]}`);
      a.alternatives.forEach((id) => byId[id] && lines.push(toolLine(byId[id], L[lang])));
      lines.push(a.pages?.[lang] || "");
      return lines.join("\n");
    });
    return text(out.join("\n\n"));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
