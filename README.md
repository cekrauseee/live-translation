# Live Translation

Live Translation is an exploratory real-time voice translation application built with Next.js and OpenAI GPT-Live.

The current runtime uses one gpt-live-1 session over WebRTC. The user selects a primary and secondary language, speaks in either language, and the agent returns a natural semantic translation in the other language. The visible interface intentionally stays small: two language selectors, session controls, status, and hidden audio playback.

## Contents

- [Overview](#overview)
- [Current architecture](#current-architecture)
- [Technology stack](#technology-stack)
- [Requirements](#requirements)
- [Environment variables](#environment-variables)
- [Run on the host](#run-on-the-host)
- [Development commands](#development-commands)
- [Project structure](#project-structure)
- [Logging and observability](#logging-and-observability)
- [Security boundaries](#security-boundaries)
- [Current scope and limitations](#current-scope-and-limitations)
- [Documentation](#documentation)

## Overview

The project explores a small, audio-first translation experience:

- input audio comes from the browser microphone;
- the server creates one trusted GPT-Live-1 WebRTC session;
- the agent decides which configured language was spoken;
- the agent speaks a semantic translation in the other configured language;
- the browser displays only session controls and status.

Transcript messages and visual agent animations are intentionally out of scope for the current iteration.

## Current architecture

The browser establishes one WebRTC peer connection through the trusted Next.js route:

1. The user selects two different languages and starts a conversation.
2. The browser requests microphone access and creates an SDP offer.
3. POST /api/realtime/session validates the language pair and SDP offer.
4. The Next.js route calls client.live.create with model gpt-live-1 and the translation instructions.
5. The route returns the SDP answer.
6. The browser applies the answer and waits for session.started.
7. GPT-Live-1 returns translated audio through the negotiated media track.
8. The user sends session.close from the End conversation button.

The main OpenAI API key is used only by the Node.js route. It is never sent to the browser.

See [docs/architecture.md](docs/architecture.md) for the detailed flow.

## Technology stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- OpenAI Node SDK
- GPT-Live-1 over WebRTC
- Pino structured logging
- Pino Pretty development formatting
- Continuity environment for external project knowledge and contribution handoffs

## Requirements

### Host development

- Node.js 22.6 or newer
- npm
- A browser with microphone support
- An OpenAI API key with access to GPT-Live-1

## Environment variables

The server reads:

| Variable | Required | Description |
| --- | --- | --- |
| OPENAI_API_KEY | Yes for live sessions | Server-side OpenAI API key. Never expose it as a NEXT_PUBLIC_ variable. |
| LOG_LEVEL | No | Pino log level. Defaults to debug in development and info elsewhere. |

For host development, create the ignored .env.local file:

~~~dotenv
OPENAI_API_KEY=your_api_key
LOG_LEVEL=debug
~~~

Never commit .env.local or paste the API key into source files, issues, screenshots, or chat messages.

## Run on the host

Install dependencies and start the development server:

~~~bash
npm install
npm run dev
~~~

Open http://localhost:3000. Browsers normally allow microphone access on localhost. Other origins must use HTTPS.

## Development commands

~~~bash
npm run dev      # Start Next.js development mode
npm run lint     # Run ESLint
npm run build    # Build Next.js and run TypeScript checks
npm run start    # Start the production build
~~~

Recommended checks before delivery:

~~~bash
npm run lint
npm run build
git diff --check
~~~

## Project structure

~~~text
app/
  api/realtime/session/route.ts   # Trusted GPT-Live session creation
  globals.css                     # Tailwind and system color tokens
  layout.tsx                      # Root metadata and document shell
  page.tsx                        # Main application entry point
components/
  live-conversation.tsx           # Browser WebRTC lifecycle and controls
  ui/                             # shadcn/ui components
docs/
  architecture.md                 # Runtime architecture and event flow
  decisions.md                    # Architectural decisions
  development.md                  # Developer workflow
  logging.md                      # Wide events and troubleshooting logs
  project-history.md              # Project evolution and superseded experiments
  troubleshooting.md              # Operational troubleshooting
lib/
  languages.ts                    # Supported language pair
  logger.ts                       # Pino logger and wide-event helper
~~~

## Logging and observability

The route emits one wide event named live.session.create per request. Events include:

- event_id and trace_id;
- language pair;
- model;
- operation outcome;
- total duration;
- HTTP status;
- completed steps;
- safe OpenAI provider metadata.

Development output is colorized and indented with Pino Pretty. Production output remains structured JSON for ingestion. The logger never records API keys, SDP, instructions, transcripts, or audio.

Set LOG_LEVEL=debug for local diagnostics. Use the event reference returned in a user-facing error to find the corresponding server event.

See [docs/logging.md](docs/logging.md).

## Security boundaries

- OPENAI_API_KEY is read only in the Node.js route handler.
- The browser sends SDP and language values to the application server.
- The server sends the SDP offer and Live session configuration to OpenAI.
- The browser receives only the SDP answer and negotiated WebRTC media.
- Session instructions do not include secrets or persistent user data.
- Authentication, authorization, rate limiting, abuse prevention, and production secret management are still required before exposing this prototype publicly.

## Current scope and limitations

Included:

- Primary and secondary language selection
- One GPT-Live-1 full-duplex agent session
- Bidirectional semantic translation instructions
- WebRTC microphone input
- Hidden audio playback
- Session start, status, and end controls
- Structured server-side logging

Not included:

- Transcript rendering
- FluidOrb visualization
- Function calls or external tools
- Conversation persistence
- Recording storage
- User authentication
- Production rate limiting
- Automated end-to-end live API tests

## Documentation

- [Architecture](docs/architecture.md)
- [Development workflow](docs/development.md)
- [Architectural decisions](docs/decisions.md)
- [Logging and observability](docs/logging.md)
- [Project history](docs/project-history.md)
- [Troubleshooting](docs/troubleshooting.md)
