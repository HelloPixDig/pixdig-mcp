# Contributing

Thanks for taking an interest in PixDig MCP.

## Suggest a tool for the directory

The directory itself is edited on the website, not in this repository. To suggest an AI tool, use the form at <https://hellopixdig.com/en/partner> (free listing or paid feature; every application gets a reply, and a listing is never automatic).

To report a wrong figure or a broken link in a tool page, open a **Data issue** here and name the tool.

## Report a bug

Open an issue with the **Bug report** template. Include your agent (Claude Code, Codex, Cursor…), Node.js version, the tool call and the answer you got.

## Propose a code change

1. Open an issue first for anything beyond a small fix.
2. Keep the project small: one file, two dependencies. A new dependency needs a strong reason.
3. These rules are not negotiable: **read-only**, **no telemetry**, **no account or API key**, **no network call other than fetching the public JSON**.
4. Run `npm run check` and `npm test` before opening a pull request.

## Style

Plain modern JavaScript (ES modules), no build step, no transpiler. Tool descriptions are read by language models: keep them precise and short.
