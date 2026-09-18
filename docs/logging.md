# Logging and observability

## Logger

Server-side logging uses Pino.

- Development: Pino Pretty with colorized, indented fields.
- Production: newline-delimited structured JSON.
- Default development level: debug.
- Default non-development level: info.
- Override with LOG_LEVEL.

Pino Pretty is a development dependency and is not used as the production log processor.

## Wide event

The route emits one event named live.session.create for each request to POST /api/realtime/session.

The event is request-scoped and contains:

- event_id: correlation identifier returned with user-facing failures;
- trace_id: same request correlation identifier;
- event_name: stable operation name;
- outcome: success or failure;
- duration_ms: total route duration;
- http: method and route;
- language_pair: validated language values;
- model: gpt-live-1;
- status_code: response status;
- failure_stage: failed operation, when applicable;
- user_message: safe message suitable for the UI;
- steps: ordered operation milestones;
- error: safe OpenAI provider metadata, when available.

Example development rendering:

~~~text
[time] ERROR: Live session creation failed.
    service: "live-translation"
    event_name: "live.session.create"
    failure_stage: "live.session.create"
    status_code: 400
    user_message: "OpenAI rejected a value in the GPT-Live session configuration."
    error: {
      "code": "invalid_value",
      "param": "session.audio.output.voice",
      "request_id": "provider-request-id",
      "status": 400,
      "type": "invalid_request_error"
    }
~~~

Production emits the same fields as JSON for ingestion.

## Safe logging policy

The logger must not record:

- OPENAI_API_KEY;
- client secrets;
- SDP offers or answers;
- agent instructions;
- microphone audio;
- transcript text;
- authentication tokens;
- arbitrary request body values.

Language codes, model names, status codes, provider error codes, provider parameters, and OpenAI request IDs are considered safe operational metadata for this prototype.

## Debugging an error

1. Read the user-facing error and its reference ID.
2. Find the matching event_id or trace_id in the server output.
3. Check failure_stage.
4. Check error.code, error.param, error.message, and error.request_id.
5. Compare the rejected parameter with the current OpenAI API contract.
6. Re-run lint and build after changing the session configuration.

Do not solve a provider configuration error by logging secrets or raw SDP.

## Example failure categories

| Category | Meaning | Typical next step |
| --- | --- | --- |
| invalid_value | OpenAI rejected a configuration value | Inspect error.param and the session payload |
| invalid_api_key | The server key was rejected | Check the server environment |
| model_not_found | The project cannot access the requested model | Check project model access |
| insufficient_quota | The project has no available quota or credits | Check API billing and limits |
| 429 | The request was rate-limited | Retry with pacing and inspect limits |
| 5xx | OpenAI returned a server-side failure | Retry later and preserve the request ID |
