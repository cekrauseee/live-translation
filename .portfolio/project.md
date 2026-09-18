---
slug: live-translation
portfolioIndex: 7
name: cekrauseee/live-translation
repositoryUrl: https://github.com/cekrauseee/live-translation
description: >-
  A real-time voice translation experiment built around one full-duplex GPT-Live
  session.
metaDescription: >-
  Live Translation explores bidirectional semantic voice translation with one
  GPT-Live-1 session, WebRTC, and a server-side signaling boundary.
summary: >-
  I built Live Translation to explore a simple question: how far can a single
  full-duplex voice agent carry a translation experience when the application
  keeps orchestration small? The project lets a person choose two languages,
  speak in either one, and hear the semantic translation in the other.
highlights:
  - one full-duplex GPT-Live-1 session over WebRTC
  - semantic translation in both directions
  - server-side session creation and SDP negotiation
  - explicit lifecycle states and wide-event observability
---

I built Live Translation as a focused experiment in real-time voice interaction. A person chooses two languages, speaks in either one, and hears a natural translation in the other. The project stays deliberately narrow because the architecture is the main subject: what belongs in the application, and what can remain inside a realtime model?

## One agent instead of a pipeline

An earlier version split the experience across a transcription session and a separate translation session. That created a boundary between partial and finalized turns, two WebRTC connections, short-lived client credentials, and a queue to coordinate one model with the other.

The current version uses one GPT-Live-1 session instead. The model receives the microphone audio, identifies which of the two configured languages was spoken, and returns the translation as audio. This reduces application-owned synchronization and gives the model responsibility for the part of the interaction that is inherently conversational.

That trade-off is intentional. The application has less control over intermediate text, but the session has fewer moving parts and a smaller failure surface.

## A trusted signaling boundary

The browser owns microphone permission and the WebRTC peer connection. The server receives the SDP offer, validates the language pair, creates the Live session with the project API key, and returns the SDP answer.

This keeps the credential boundary explicit without turning the server into a media proxy. Audio continues over the negotiated WebRTC connection, while the server remains responsible for session configuration and lifecycle initialization.

The route also gives the application one place to observe provider failures. A wide event records the request, selected languages, model, duration, outcome, and safe provider metadata without storing SDP or audio.

## Translation as an agent contract

The language selectors are not only presentation controls. They become part of the session contract passed to the agent.

The instructions define two directions: primary to secondary and secondary to primary. They also define the quality boundary: the response should preserve meaning, intent, tone, names, numbers, and register, while avoiding literal word-for-word output. The agent is told to translate only, not to answer, acknowledge, explain, or start a normal conversation.

That keeps the application policy small and makes the intended behavior legible at the point where the realtime session is created.

## A status-first interface

The visible interface intentionally does not display transcript messages or a reactive agent illustration. It keeps the user oriented with the selected language pair, connection status, start/end controls, and errors.

Audio playback uses a hidden media sink. This leaves the interface quiet while preserving the actual voice interaction. It also makes the boundary between product surface and transport implementation easier to reason about: the browser exposes the session state, while the Live connection carries the conversation.

## An experiment with a clear edge

Live Translation is not yet a public translation service. It has no accounts, persistence, recordings, production rate limiting, or external tools. The next questions are about translation quality, interruption behavior, evaluation, and the operational controls required around a paid realtime session.

For now, the value is in the reduced architecture: one agent, one audio path, one server-side signaling boundary, and a small interface that makes the behavior easy to test.
