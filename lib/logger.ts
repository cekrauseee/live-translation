import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import pino from "pino";

const isDevelopment = process.env.NODE_ENV === "development";
const developmentTransport = isDevelopment
  ? {
      transport: {
        target: createRequire(`${process.cwd()}/package.json`).resolve(
          "pino-pretty",
        ),
        options: {
          colorize: true,
          colorizeObjects: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      },
    }
  : {};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  base: {
    service: "live-translation",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...developmentTransport,
});

type WideEventFields = Record<string, unknown>;

type WideEventStep = WideEventFields & {
  duration_ms: number;
  name: string;
  outcome: "failure" | "success";
};

export type WideEvent = ReturnType<typeof createWideEvent>;

export function createWideEvent(
  eventName: string,
  context: WideEventFields = {},
) {
  const eventId = randomUUID();
  const startedAt = Date.now();
  const steps: WideEventStep[] = [];
  let emitted = false;
  let eventContext = { ...context };

  const emit = (
    level: "error" | "info",
    outcome: WideEventStep["outcome"],
    fields: WideEventFields = {},
  ) => {
    if (emitted) return;
    emitted = true;

    const payload = {
      ...eventContext,
      ...fields,
      duration_ms: Date.now() - startedAt,
      event_id: eventId,
      event_name: eventName,
      msg:
        typeof fields.msg === "string"
          ? fields.msg
          : outcome === "success"
            ? "Operation completed."
            : "Operation failed.",
      outcome,
      steps,
      trace_id: eventId,
    };

    if (level === "error") {
      logger.error(payload);
    } else {
      logger.info(payload);
    }
  };

  return {
    addContext(fields: WideEventFields) {
      if (!emitted) {
        eventContext = { ...eventContext, ...fields };
      }
    },
    addStep(
      name: string,
      stepStartedAt: number,
      outcome: WideEventStep["outcome"],
      fields: WideEventFields = {},
    ) {
      if (emitted) return;

      steps.push({
        ...fields,
        duration_ms: Date.now() - stepStartedAt,
        name,
        outcome,
      });
    },
    fail(fields: WideEventFields = {}) {
      emit("error", "failure", fields);
    },
    get id() {
      return eventId;
    },
    succeed(fields: WideEventFields = {}) {
      emit("info", "success", fields);
    },
  };
}

export function getErrorMetadata(error: unknown): WideEventFields {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: "Unknown error",
    name: "UnknownError",
  };
}
