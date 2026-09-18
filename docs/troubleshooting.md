# Troubleshooting

## The application does not start

### Host

Check the Node.js version and dependencies:

~~~bash
node --version
npm install
npm run lint
~~~

## The server reports that the API key is missing

The route reads OPENAI_API_KEY from the server environment only.

For host development, verify that .env.local exists and restart the development server.

Never add the key to NEXT_PUBLIC_ variables.

## OpenAI returns a 400 configuration error

Read the user-facing reference ID, then locate the matching wide event in the server output. Inspect:

- failure_stage;
- error.code;
- error.param;
- error.message;
- error.request_id.

The parameter path identifies the rejected part of the Live configuration. The application should be updated against the current OpenAI Live API contract rather than hiding the provider error.

## OpenAI returns 401 or 403

A 401 usually means the server key is missing, malformed, or rejected.

A 403 usually means the key's project does not have access to GPT-Live-1 or the requested capability.

Check the server project and key configuration without printing the key.

## The browser cannot access the microphone

Microphone access requires a secure context. localhost is normally allowed during local development. For other hosts, use HTTPS.

Also check:

- browser permission settings;
- whether another application owns the microphone;
- whether the page is using the expected input device;
- whether the browser console reports a WebRTC permission error.

## Audio is not audible

The application uses a hidden audio element. Check:

- browser autoplay policy;
- system output device;
- page mute state;
- whether the peer connection received a remote audio track;
- the status and error message in the UI.

If playback is blocked, interact with the page and start a new session.

## The session does not close

The client sends session.close and waits for session.closed. If the terminal event is not received before the timeout, local resources are still released and the UI reports that finalization was not confirmed.

Check the server wide event and the browser's WebRTC connection state before changing the timeout.

## Logs are too quiet

Set:

~~~bash
LOG_LEVEL=debug npm run dev
~~~

Do not increase logging by including raw request bodies, SDP, audio, or secrets.
