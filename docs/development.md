# Development workflow

## Host setup

Install the dependencies and start the development server:

~~~bash
npm install
npm run dev
~~~

The application runs at http://localhost:3000.

Use an ignored .env.local file for local secrets:

~~~dotenv
OPENAI_API_KEY=your_api_key
LOG_LEVEL=debug
~~~

Do not expose the key through a NEXT_PUBLIC_ variable.

## Continuity environment

The project is bound to a local Continuity environment for shared project knowledge and contribution handoffs. Continuity state is stored outside the repository and is not required to run the application.

The environment supports collaboration bookkeeping; it does not replace Git, environment variables, or application runtime configuration.

## Application workflow

The current product flow is intentionally small:

1. Select a primary language.
2. Select a different secondary language.
3. Start a conversation.
4. Grant microphone access.
5. Speak in either selected language.
6. Hear the GPT-Live-1 semantic translation.
7. End the conversation.

The UI does not render transcript text or an agent visualization.

## Code boundaries

### Browser

The browser owns microphone permission, WebRTC negotiation, status state, and audio playback.

### Server

The Next.js route owns API authentication, language validation, GPT-Live session creation, SDP signaling, and structured error reporting.

### OpenAI

GPT-Live-1 owns speech recognition, language direction detection, semantic translation, and spoken output according to the session instructions.

## Useful commands

~~~bash
npm run dev
npm run lint
npm run build
npm run start
git diff --check
~~~

## Verification policy

The repository's static verification is:

- ESLint;
- Next.js production build;
- TypeScript checking performed during build;
- whitespace validation with git diff --check.

A real GPT-Live session is an external integration test. It requires a valid API key, browser microphone permissions, network access, and model access, so it is not part of the default automated build.

## Adding a feature

Before changing the session flow:

1. Update the architecture documentation.
2. Preserve the server-only API key boundary.
3. Avoid logging secrets, SDP, prompts, audio, or transcript content.
4. Run lint and build.
5. Update the relevant decision record if the architecture changes.
6. Keep user-facing errors actionable and referenceable through the wide event ID.
