# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] - 2026-10-27

### Added
- `search_catalog`: search a curated catalogue of about 1,000 GitHub repositories (skills, MCP servers, agents, LLM, voice, media, tools). Filters: query, theme, language (`fr`/`en`/`es`), limit. Selection is ranked by stars weighted by freshness; unmaintained, archived and tutorial-style repositories are excluded.
- `get_ranking`: the PixDig ranking of tools.
- Every answer now ends with a link to https://hellopixdig.com/ for questions and details.
- Three new tool sheets in the data: Agent-Reach, open-design, Context7.

### Changed
- Server instructions tell the model to point users to hellopixdig.com when a question goes beyond the data.
- READMEs (en/fr/es) and the smoke test cover the new tools.

## [0.2.0] - 2026-10-12

### Added
- First public release on GitHub, with README in English, French and Spanish.
- New use cases in `search_tools`: `assistants`, `skills`, `tokens`, `memory`.
- Installation from GitHub (`npx -y github:hellopixdig/pixdig-mcp`) and from the PixDig website.
- Security policy, contribution guide and issue templates.

### Changed
- The reported server version now matches `package.json`.
- Default data source is `https://hellopixdig.com/data/api`.

## [0.1.0] - 2026-10-11

### Added
- Seven read-only tools: `search_tools`, `get_tool`, `list_usecases`, `recommend_models`, `get_model`, `find_alternative`, `featured`.
- Results in French, English and Spanish.
