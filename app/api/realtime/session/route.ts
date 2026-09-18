import OpenAI from "openai";
import { NextResponse } from "next/server";

import {
  getTargetLanguageLabel,
  isTargetLanguage,
  type TargetLanguage,
} from "@/lib/languages";
import { createWideEvent, getErrorMetadata } from "@/lib/logger";

export const runtime = "nodejs";

const LIVE_MODEL = "gpt-live-1" as const;
const MAX_SDP_LENGTH = 64 * 1024;

type SessionRequest = {
  primaryLanguage: TargetLanguage;
  secondaryLanguage: TargetLanguage;
  sdp: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidSessionRequest(value: unknown): value is SessionRequest {
  return (
    isRecord(value) &&
    typeof value.sdp === "string" &&
    value.sdp.trim().length > 0 &&
    value.sdp.length <= MAX_SDP_LENGTH &&
    isTargetLanguage(value.primaryLanguage) &&
    isTargetLanguage(value.secondaryLanguage) &&
    value.primaryLanguage !== value.secondaryLanguage
  );
}

function jsonError(message: string, status: number, eventId: string) {
  return NextResponse.json(
    { error: message, error_id: eventId },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function buildAgentInstructions(
  primaryLanguage: TargetLanguage,
  secondaryLanguage: TargetLanguage,
) {
  const primaryLabel = getTargetLanguageLabel(primaryLanguage);
  const secondaryLabel = getTargetLanguageLabel(secondaryLanguage);

  return [
    "You are a silent, bidirectional semantic translation agent.",
    `The configured language pair is ${primaryLabel} and ${secondaryLabel}.`,
    `When you hear a phrase in ${primaryLabel}, repeat it in ${secondaryLabel} using a natural semantic translation, not a literal word-for-word translation.`,
    `When you hear a phrase in ${secondaryLabel}, repeat it in ${primaryLabel} using a natural semantic translation, not a literal word-for-word translation.`,
    "Do only this. Do not answer, explain, ask questions, hold a conversation, acknowledge the user, or add commentary.",
    "Preserve meaning, intent, tone, names, numbers, and register. Speak only the translated phrase.",
  ].join("\n");
}

function getOpenAIErrorMetadata(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    return {
      code: error.code,
      message: error.message,
      param: error.param,
      request_id: error.requestID,
      status: error.status,
      type: error.type,
    };
  }

  return getErrorMetadata(error);
}

function getProviderStatus(error: unknown) {
  return error instanceof OpenAI.APIError ? error.status : undefined;
}

function getUserFriendlyErrorMessage(error: unknown, eventId: string) {
  const providerCode = error instanceof OpenAI.APIError ? error.code : null;
  const providerStatus = getProviderStatus(error);
  let message = "The GPT-Live session could not be started.";

  if (providerCode === "invalid_value") {
    message = "OpenAI rejected a value in the GPT-Live session configuration.";
  } else if (providerCode === "invalid_api_key" || providerStatus === 401) {
    message = "OpenAI rejected the API key. Check OPENAI_API_KEY on the server.";
  } else if (providerCode === "model_not_found" || providerStatus === 403) {
    message =
      "The OpenAI project does not have access to the GPT-Live model.";
  } else if (providerCode === "insufficient_quota") {
    message =
      "The OpenAI project has no quota or credits available to start the session.";
  } else if (providerStatus === 429) {
    message =
      "OpenAI is temporarily rate-limiting new sessions. Try again shortly.";
  } else if (providerStatus !== undefined && providerStatus >= 500) {
    message = "OpenAI is temporarily unavailable to start the session.";
  }

  return `${message} Reference: ${eventId}.`;
}

export async function POST(request: Request) {
  const operation = createWideEvent("live.session.create", {
    http: {
      method: "POST",
      route: "/api/realtime/session",
    },
  });
  operation.addStep("request.received", Date.now(), "success");

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message =
      "The OpenAI API key is not configured on the server. Check OPENAI_API_KEY.";
    operation.addStep("configuration.api_key", Date.now(), "failure", {
      reason: "missing",
    });
    operation.fail({
      error: {
        code: "missing_api_key",
        user_message: message,
      },
      failure_stage: "configuration",
      msg: "Live session request failed: API key is not configured.",
      status_code: 503,
      user_message: message,
    });
    return jsonError(message, 503, operation.id);
  }
  operation.addStep("configuration.api_key", Date.now(), "success");

  let body: unknown;
  const parseStartedAt = Date.now();
  try {
    body = await request.json();
  } catch {
    const message = "Send a valid JSON body to start the session.";
    operation.addStep("request.parse", parseStartedAt, "failure", {
      error: { code: "invalid_json" },
    });
    operation.fail({
      error: { code: "invalid_json", user_message: message },
      failure_stage: "request.parse",
      msg: "Live session request failed: invalid JSON body.",
      status_code: 400,
      user_message: message,
    });
    return jsonError(message, 400, operation.id);
  }
  operation.addStep("request.parse", parseStartedAt, "success");

  if (!isValidSessionRequest(body)) {
    const message =
      "A non-empty SDP offer and two different supported languages are required.";
    operation.addStep("request.validate", Date.now(), "failure", {
      reason: "invalid_session_request",
    });
    operation.fail({
      error: {
        code: "invalid_session_request",
        user_message: message,
      },
      failure_stage: "request.validate",
      msg: "Live session request failed: invalid payload.",
      status_code: 400,
      user_message: message,
    });
    return jsonError(message, 400, operation.id);
  }

  operation.addContext({
    language_pair: [body.primaryLanguage, body.secondaryLanguage],
    model: LIVE_MODEL,
  });
  operation.addStep("request.validate", Date.now(), "success");

  try {
    // Live session creation has initialization billing. Do not retry it.
    const client = new OpenAI({ apiKey, maxRetries: 0 });
    const liveStartedAt = Date.now();
    let live;

    try {
      live = await client.live.create({
        session: {
          model: LIVE_MODEL,
          audio: {
            output: {
              voice: "marin",
            },
          },
          instructions: buildAgentInstructions(
            body.primaryLanguage,
            body.secondaryLanguage,
          ),
          client: {
            data_channel: {
              allowed_client_events: ["session.close"],
              allowed_server_events: [
                { type: "session.started" },
                { type: "session.closed" },
                { type: "error" },
              ],
            },
          },
        },
        transport: {
          type: "webrtc",
          sdp: body.sdp,
        },
      });
    } catch (error) {
      operation.addStep("live.session.create", liveStartedAt, "failure", {
        error: getOpenAIErrorMetadata(error),
        model: LIVE_MODEL,
      });
      throw error;
    }

    operation.addStep("live.session.create", liveStartedAt, "success", {
      model: LIVE_MODEL,
      session_type: "live",
    });
    operation.succeed({
      msg: "Live session created.",
      result: {
        session_created: true,
      },
      status_code: 201,
    });

    return NextResponse.json(
      {
        session: live.session,
        transport: live.transport,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const providerStatus = getProviderStatus(error);
    const status =
      typeof providerStatus === "number" &&
      providerStatus >= 400 &&
      providerStatus < 600
        ? providerStatus
        : 502;
    const message = getUserFriendlyErrorMessage(error, operation.id);

    operation.fail({
      error: {
        ...getOpenAIErrorMetadata(error),
        user_message: message,
      },
      failure_stage: "live.session.create",
      msg: "Live session creation failed.",
      status_code: status,
      user_message: message,
    });

    return jsonError(message, status, operation.id);
  }
}
