# Security policy

PixDig MCP is a small, read-only server: it exposes seven tools, runs no command, writes no file and sends no data other than a `User-Agent` header (`pixdig-mcp/<version>`) when it downloads public JSON from `hellopixdig.com`.

## Supported versions

Only the latest release receives fixes.

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| < 0.2 | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

- Use GitHub's private reporting: **Security → Report a vulnerability** on this repository, or
- write to **hello@hellopixdig.com** with the subject `[SECURITY] pixdig-mcp`.

Include the version, what you observed, and how to reproduce it. This is a small independent project: reports are read personally and answered on a best-effort basis, without a guaranteed delay.

## What is in scope

- The server code in `src/index.js` and its packaging (`package.json`, the published archive).
- Anything that could make the server read or write outside its documented behaviour, leak local data, or return content that misleads the agent into running unsafe commands.

## What is not

- The content of the directory (tool descriptions, ratings): report mistakes through an issue.
- Vulnerabilities in the third-party tools listed in the directory, or in the MCP SDK itself: report them to their own maintainers.

## Good practice for users

- Read an install command before your agent runs it. PixDig only provides prompts; it never runs anything for you.
- Pin the version you reviewed if you want stability: `npx -y github:hellopixdig/pixdig-mcp#v0.2.0`.
