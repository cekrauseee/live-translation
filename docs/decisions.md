# Architectural decisions

## ADR-001: Use Next.js App Router

Status: accepted

The project uses Next.js 16 App Router with React Server Components as the application shell and a client component for browser WebRTC state.

Reasoning:

- the project started from the Next.js App Router scaffold;
- route handlers provide a natural trusted server boundary;
- the browser-only WebRTC lifecycle remains isolated behind a client component.

## ADR-002: Use shadcn/ui as the UI foundation

Status: accepted

The project uses the default shadcn/ui setup and generated components for controls. Styling remains intentionally minimal while the runtime architecture is explored.

## ADR-003: Use two explicit language selectors

Status: accepted

The user chooses a primary and secondary language before starting a session. The pair is passed to the GPT-Live instructions so the agent knows the two valid translation directions.

The current supported values are English, Portuguese, Spanish, French, and German.

## ADR-004: Use one GPT-Live-1 agent session

Status: accepted

The current architecture uses one GPT-Live-1 session rather than separate transcription and translation sessions.

Reasoning:

- GPT-Live-1 already accepts audio and produces audio in a full-duplex session;
- semantic translation can be expressed directly in the agent instructions;
- one session reduces signaling, synchronization, and failure modes;
- the UI does not need transcript text for the current scope.

## ADR-005: Keep SDP negotiation on the server

Status: accepted

The browser sends its SDP offer to the Next.js route. The server calls client.live.create with the main API key and returns the SDP answer.

This keeps the main API key out of the browser and makes session creation auditable in one server-side operation.

## ADR-006: Keep audio playback hidden

Status: accepted

The application uses a hidden HTML audio element as the WebRTC media sink. It is not part of the visible interface.

Reasoning:

- the user asked not to render a visible audio control;
- native media playback remains reliable;
- the visible UI can focus on status and session controls.

## ADR-007: Use a status-only interface

Status: accepted

The current interface renders language selectors, start/end controls, connection status, and errors. It does not render transcript messages or an agent orb.

This keeps the first implementation focused on session stability and translation behavior.

## ADR-008: Use wide events with Pino

Status: accepted

The session route emits one wide event per request. The event includes request context, duration, outcome, completed steps, and safe provider metadata.

Development logs use colorized Pino Pretty output. Production logs remain structured JSON.

## Superseded experiment: two Realtime sessions

Status: superseded

An earlier experiment used:

- gpt-live-transcribe for microphone transcription;
- gpt-realtime for text-to-speech translation;
- two client secrets;
- two WebRTC peer connections;
- a client-side translation queue.

That design was removed in favor of one GPT-Live-1 session. The experiment introduced additional synchronization and turn-finalization complexity without being necessary for the current product scope.

## Superseded experiment: transcript messages and FluidOrb

Status: superseded

An earlier UI rendered source and translated transcript deltas as animated messages and used FluidOrb to visualize agent speech. The current product direction removes both surfaces and retains only status and controls.
