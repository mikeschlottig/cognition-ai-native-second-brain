# Cloudflare AI Chat Agent

[cloudflarebutton]

A production-ready, full-stack AI chat application built on Cloudflare Workers. Features persistent chat sessions powered by Durable Objects, AI integration via Cloudflare AI Gateway, tool calling (web search, weather, MCP servers), streaming responses, and a modern React frontend with shadcn/ui.

## ✨ Key Features

- **Multi-Session Chat**: Create, manage, and switch between unlimited chat sessions with automatic title generation.
- **AI-Powered Conversations**: Supports Gemini models (Flash/Pro) with dynamic model switching.
- **Tool Integration**: Built-in tools for web search (SerpAPI), weather lookup, and extensible MCP server support.
- **Streaming Responses**: Real-time message streaming for natural chat experience.
- **Session Persistence**: Durable Objects handle state with automatic activity tracking.
- **Modern UI**: Responsive React app with Tailwind CSS, shadcn/ui components, and dark mode support.
- **Developer-Friendly**: Type-safe TypeScript, Hono routing, TanStack Query, and hot-reload dev server.
- **Production-Ready**: CORS, error handling, logging, and Cloudflare observability.

## 🛠️ Tech Stack

- **Backend**: Cloudflare Workers, Hono, Agents SDK, Durable Objects, OpenAI SDK
- **AI**: Cloudflare AI Gateway (Gemini models), SerpAPI, Model Context Protocol (MCP)
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide React, TanStack Query, React Router, Sonner
- **Build Tools**: Bun, Wrangler, esbuild
- **Utilities**: Immer, Zod, Framer Motion, clsx, tw-merge

## 🚀 Quick Start

1. **Clone & Install**:
   ```bash
   git clone <your-repo>
   cd cognition-ai-notes-ndbnaqebpxz3ac0geh57n
   bun install
   ```

2. **Configure Environment** (edit `wrangler.jsonc`):
   ```json
   "vars": {
     "CF_AI_BASE_URL": "https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai",
     "CF_AI_API_KEY": "{your-cloudflare-ai-key}",
     "SERPAPI_KEY": "{optional-serpapi-key}",
     "OPENROUTER_API_KEY": "{optional-openrouter-key}"
   }
   ```

3. **Development**:
   ```bash
   bun run dev  # Starts at http://localhost:3000 (frontend + worker)
   ```

4. **Type Generation**:
   ```bash
   bun run cf-typegen  # Generate Worker types
   ```

## 📖 Usage

### Chat Sessions
- **Create Session**: `POST /api/sessions` (auto-generates ID/title)
- **List Sessions**: `GET /api/sessions`
- **Delete Session**: `DELETE /api/sessions/{id}`
- **Chat**: `POST /api/chat/{sessionId}/chat` (supports streaming)
- **Get Messages**: `GET /api/chat/{sessionId}/messages`
- **Clear Chat**: `DELETE /api/chat/{sessionId}/clear`
- **Update Model**: `POST /api/chat/{sessionId}/model`

### Frontend Interactions
- Chat interface auto-manages sessions.
- Model selector switches between Gemini variants.
- Tools trigger automatically (e.g., "What's the weather in NYC?", "Search React hooks").

## 💻 Development

- **Hot Reload**: Frontend auto-reloads on changes; Worker updates via `wrangler dev`.
- **Linting**: `bun run lint`
- **Build**: `bun run build` (generates `./dist` for production).
- **Preview**: `bun run preview`
- **Extend Backend**:
  - Add routes: `worker/userRoutes.ts`
  - Custom tools: `worker/tools.ts`
  - MCP Servers: `worker/mcp-client.ts`
- **Extend Frontend**:
  - Pages: `src/pages/`
  - Components: `src/components/`
  - Hooks: `src/hooks/`

## ☁️ Deployment

Deploy to Cloudflare Workers with a single command:

```bash
bun run deploy  # Builds and deploys via Wrangler
```

**Custom Domain**: Update `wrangler.jsonc` with your domain.

**Requirements**:
- Cloudflare account with Workers enabled.
- AI Gateway configured (Workers AI or @cf/meta/* models).
- `wrangler login` and `wrangler whoami` verified.

[cloudflarebutton]

## 🔧 Configuration

### wrangler.jsonc
- `durable_objects`: ChatAgent (sessions), AppController (session management).
- `assets`: Serves React SPA (SPA fallback).
- Migrations handle DO schema updates.

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `CF_AI_BASE_URL` | Yes | AI Gateway endpoint (e.g., `https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openai`) |
| `CF_AI_API_KEY` | Yes | Cloudflare API token |
| `SERPAPI_KEY` | Optional | Web search via SerpAPI |
| `OPENROUTER_API_KEY` | Optional | Alternative LLM provider |

## 🤝 Contributing

1. Fork the repo.
2. Create feature branch: `bun install && bun run dev`.
3. Commit changes: `git commit -m "feat: add X"`.
4. PR to `main`.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

## 🙌 Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Agents SDK](https://developers.cloudflare.com/agents/)
- [shadcn/ui](https://ui.shadcn.com/)

Built with ❤️ by Cloudflare Templates.