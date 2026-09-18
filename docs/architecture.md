# Architecture

## Overview

Live Translation is a browser-based voice experience with one OpenAI GPT-Live-1 session. The application does not create a separate transcription pipeline or a second translation model.

The browser owns the WebRTC peer connection and microphone permission. The Next.js route acts as the trusted signaling boundary: it receives the browser's SDP offer, creates the Live session with the server-side API key, and returns the SDP answer.

~~~text
┌──────────────────────┐       SDP offer        ┌────────────────────────┐
│ Browser              │ ─────────────────────> │ Next.js route           │
│                      │                         │ /api/realtime/session  │
│ microphone + WebRTC │ <───────────────────── │ client.live.create      │
└──────────┬───────────┘       SDP answer        └────────────┬───────────┘
           │                                                  │
           │ negotiated WebRTC media + events                  │ server API key
           │                                                  ▼
           └──────────────────────────────────────────> OpenAI GPT-Live-1
                                                        translated audio
~~~

## Runtime components

### Browser

components/live-conversation.tsx is a client component responsible for:

- primary and secondary language selection;
- microphone permission and local audio track creation;
- RTCPeerConnection lifecycle;
- oai-events data channel lifecycle;
- SDP offer generation and answer application;
- hidden audio playback;
- session status and error presentation;
- clean session shutdown.

The browser does not receive the main OpenAI API key.

### Next.js route handler

app/api/realtime/session/route.ts is a Node.js route handler. It:

1. validates the request body;
2. rejects empty or oversized SDP offers;
3. validates that both languages are supported and different;
4. builds the GPT-Live translation instructions;
5. calls client.live.create;
6. returns the session metadata and SDP answer;
7. emits a structured wide event for the entire request.

The route uses maxRetries: 0 because creating a Live session has initialization cost and should not be repeated implicitly.

### OpenAI GPT-Live-1

The single agent is configured with:

- model: "gpt-live-1";
- the selected primary and secondary languages;
- semantic, non-literal translation instructions in both directions;
- a voice output;
- a restricted browser data channel.

The agent is instructed to translate only. It must not answer questions, acknowledge the speaker, explain its work, or behave as a conversational assistant.

## Session lifecycle

### Start

1. The user selects two different languages.
2. The browser requests microphone access.
3. The browser adds the microphone track to a new peer connection.
4. The browser creates the oai-events data channel.
5. The browser creates an SDP offer and waits for ICE gathering.
6. The browser sends { primaryLanguage, secondaryLanguage, sdp } to the Next.js route.
7. The server creates the GPT-Live-1 session and returns an SDP answer.
8. The browser applies the answer.
9. The Live session emits session.started.
10. The UI changes from Connecting… to Session connected.

### Active conversation

The microphone track and remote audio track use the negotiated WebRTC media connection.

The data channel is reserved for lifecycle and failure events:

- session.started;
- session.closed;
- error.

The UI does not render transcript deltas. The translated response is heard through a hidden audio element.

### End

1. The user selects End conversation.
2. The browser sends session.close through the data channel.
3. The UI waits for session.closed.
4. The browser closes the data channel and peer connection.
5. Microphone tracks are stopped.
6. Hidden audio playback is paused and detached.

If session.closed is not received within the timeout, the local resources are still released and the UI reports that finalization could not be confirmed.

## Request and response boundary

The route accepts:

~~~json
{
  "primaryLanguage": "en",
  "secondaryLanguage": "pt",
  "sdp": "<browser-generated SDP offer>"
}
~~~

The successful response contains the Live session metadata and SDP answer:

~~~json
{
  "session": {
    "id": "live_session_id"
  },
  "transport": {
    "type": "webrtc",
    "sdp": "<OpenAI SDP answer>"
  }
}
~~~

The application does not persist either SDP payload.

## Failure handling

The route returns a user-facing message and a reference ID. The matching server event contains:

- the model;
- the selected language pair;
- the failed stage;
- provider error code;
- provider parameter;
- provider request ID;
- HTTP status;
- total request duration;
- completed steps.

The application intentionally avoids logging the API key, SDP, instructions, transcripts, or audio.

## Deliberate non-goals

The current architecture does not include:

- a separate transcription session;
- a second translation model;
- deterministic language classification;
- transcript rendering;
- FluidOrb rendering;
- function calls or external tools;
- persisted conversations or recordings;
- user authentication;
- production rate limiting.
