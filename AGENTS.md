# AGENTS.md

## Cursor Cloud specific instructions

This is the **Leadership Signal Intelligence Platform** — an early-stage Python/FastAPI scaffold.

### Project structure

- `requirements.txt` — Python dependencies (FastAPI, Uvicorn, Pydantic, etc.)
- `mcp_server.py` — Stub MCP server (markdown file, **not** executable Python)
- `docs/ARCHITECTURE.md` — High-level architecture documentation
- `.cursor/mcp_config.json` — Cursor MCP server configuration
- `backend/`, `frontend/`, `database/`, `security/` — Empty scaffold directories

### Dependencies

Run `pip install -r requirements.txt` from the workspace root. Packages install to `~/.local/` (user site-packages).

### Running the dev server

The project has no runnable application code yet. To verify the FastAPI environment works:

```
export PATH="$HOME/.local/bin:$PATH"
uvicorn your_app:app --reload --host 0.0.0.0 --port 8000
```

### Caveats

- `~/.local/bin` is **not** on PATH by default in this environment. If `uvicorn` command is not found, prepend it: `export PATH="$HOME/.local/bin:$PATH"`.
- `mcp_server.py` is a markdown file with embedded code blocks, not an executable Python module. Do not attempt to run it directly.
- There are no automated tests, lint configuration, or build scripts in the repository yet.
