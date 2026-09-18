# Project history

This document records the main implementation phases and the reasons the architecture changed.

## Phase 1: Next.js and shadcn/ui foundation

The project began as a Next.js App Router application. The default scaffold was removed and shadcn/ui was initialized through the CLI with the default configuration.

The application adopted:

- Next.js App Router;
- React and TypeScript;
- Tailwind CSS;
- system color preferences through the global CSS tokens;
- shadcn/ui primitives for controls.

## Phase 2: Initial visual shell

The first product shell was a centered language-selection experience. The user could choose a primary and secondary language and start a session. The initial work focused on layout, color tokens, and a minimal interaction surface rather than translation behavior.

## Phase 3: GPT-Live prototype

The project then integrated GPT-Live-1 over WebRTC.

The first runtime prototype included:

- microphone capture;
- server-side SDP negotiation;
- a hidden audio element for agent playback;
- session lifecycle status;
- a visible FluidOrb;
- source and agent transcript rendering.

The visual surfaces were useful during exploration but were later removed so the project could focus on audio translation and session reliability.

## Phase 4: Two-session Realtime experiment

The project briefly moved to a two-session architecture:

1. gpt-live-transcribe captured source transcript deltas;
2. gpt-realtime received finalized text and returned translated audio;
3. the browser managed two WebRTC connections and a translation queue.

This experiment exposed additional complexity around:

- client secrets;
- session coordination;
- finalized turn boundaries;
- transcription model capability differences;
- duplicate and out-of-order failure handling.

In particular, the transcription model rejected the configured automatic turn detection value. The two-session design was therefore removed in favor of a single GPT-Live agent.

## Phase 5: Structured diagnostics

The server session route was instrumented with Pino and Pino Pretty.

The logging design uses one wide event per request so a failure can be traced through:

- request parsing;
- language validation;
- Live session creation;
- provider error metadata;
- response status;
- total duration.

Development output is colorized and readable. Production output remains JSON.

## Phase 6: Current single-agent architecture

The current implementation uses:

- one GPT-Live-1 session;
- one WebRTC peer connection;
- one microphone track;
- one hidden audio sink;
- two configured languages;
- semantic bidirectional translation instructions;
- status-only UI;
- external Continuity environment for project knowledge and contribution handoffs.

The current scope intentionally excludes transcript rendering, visual agent animation, persistence, tools, authentication, and production operations.
