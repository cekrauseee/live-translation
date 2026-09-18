"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isTargetLanguage,
  TARGET_LANGUAGES,
  type TargetLanguage,
} from "@/lib/languages";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "closing"
  | "error";

type LiveSessionResponse = {
  session: {
    id: string;
  };
  transport: {
    sdp: string;
    type: "webrtc";
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLiveSessionResponse(value: unknown): value is LiveSessionResponse {
  if (!isRecord(value) || !isRecord(value.session) || !isRecord(value.transport)) {
    return false;
  }

  return (
    typeof value.session.id === "string" &&
    value.transport.type === "webrtc" &&
    typeof value.transport.sdp === "string"
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

async function getResponseError(response: Response) {
  const fallback = `Unable to start the live session (${response.status}).`;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body: unknown = await response.json().catch(() => null);
    if (isRecord(body) && typeof body.error === "string") {
      return body.error;
    }
  }

  return fallback;
}

function getServerEventError(
  value: Record<string, unknown>,
  fallback: string,
) {
  const error = isRecord(value.error) ? value.error : null;
  return error && typeof error.message === "string"
    ? error.message
    : fallback;
}

function createEventId(prefix: string) {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function waitForIceGatheringComplete(connection: RTCPeerConnection) {
  if (connection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      finish(new Error("Timed out while gathering ICE candidates."));
    }, 10_000);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      connection.removeEventListener("icegatheringstatechange", onStateChange);

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const onStateChange = () => {
      if (connection.iceGatheringState === "complete") {
        finish();
      }
    };

    connection.addEventListener("icegatheringstatechange", onStateChange);
    onStateChange();
  });
}

export function LiveConversation() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to connect.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] =
    useState<TargetLanguage>("en");
  const [secondaryLanguage, setSecondaryLanguage] =
    useState<TargetLanguage>("pt");

  const statusRef = useRef<ConnectionStatus>(status);
  const mountedRef = useRef(true);
  const disposedRef = useRef(true);
  const sessionStartedRef = useRef(false);
  const generationRef = useRef(0);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const sessionStartTimeoutRef = useRef<number | null>(null);
  const sessionRequestControllerRef = useRef<AbortController | null>(null);

  const updateStatus = useCallback(
    (nextStatus: ConnectionStatus, message: string) => {
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      setStatusMessage(message);
    },
    [],
  );

  const disposeTransport = useCallback(() => {
    disposedRef.current = true;
    generationRef.current += 1;

    sessionRequestControllerRef.current?.abort();
    sessionRequestControllerRef.current = null;

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (sessionStartTimeoutRef.current !== null) {
      window.clearTimeout(sessionStartTimeoutRef.current);
      sessionStartTimeoutRef.current = null;
    }

    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    sessionStartedRef.current = false;

    const audio = audioElementRef.current;
    audio?.pause();
    if (audio) {
      audio.srcObject = null;
    }
  }, []);

  const failTransport = useCallback(
    (message: string) => {
      if (disposedRef.current) return;

      disposeTransport();
      updateStatus("error", "Session unavailable.");
      setErrorMessage(message);
    },
    [disposeTransport, updateStatus],
  );

  const handleServerEvent = useCallback(
    (value: unknown) => {
      if (disposedRef.current || !isRecord(value)) return;
      if (typeof value.type !== "string") return;

      if (value.type === "session.started") {
        sessionStartedRef.current = true;
        if (sessionStartTimeoutRef.current !== null) {
          window.clearTimeout(sessionStartTimeoutRef.current);
          sessionStartTimeoutRef.current = null;
        }

        updateStatus("connected", "Session connected.");
        setErrorMessage(null);
        return;
      }

      if (value.type === "session.closed") {
        disposeTransport();
        updateStatus("idle", "Session ended.");
        setErrorMessage(null);
        return;
      }

      if (value.type === "error") {
        const message = getServerEventError(
          value,
          "The live session reported an error.",
        );

        if (statusRef.current === "connecting") {
          failTransport(message);
        } else if (statusRef.current === "closing") {
          disposeTransport();
          updateStatus("error", "Session ended with an error.");
          setErrorMessage(message);
        } else {
          setErrorMessage(message);
        }
      }
    },
    [disposeTransport, failTransport, updateStatus],
  );

  const startConversation = useCallback(async () => {
    if (statusRef.current !== "idle" && statusRef.current !== "error") {
      return;
    }

    disposedRef.current = false;
    sessionStartedRef.current = false;
    const generation = ++generationRef.current;
    setErrorMessage(null);
    updateStatus("connecting", "Starting the live session…");

    const isCurrentAttempt = () =>
      generationRef.current === generation && !disposedRef.current;

    try {
      if (typeof RTCPeerConnection === "undefined") {
        throw new Error("This browser does not support WebRTC.");
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost.");
      }

      const audio = audioElementRef.current;
      if (!audio) {
        throw new Error("Audio output is unavailable.");
      }

      const connection = new RTCPeerConnection();
      peerRef.current = connection;

      connection.addEventListener("connectionstatechange", () => {
        if (!isCurrentAttempt() || peerRef.current !== connection) return;

        if (
          connection.connectionState === "failed" ||
          connection.connectionState === "closed"
        ) {
          failTransport("The live connection was lost.");
        }
      });

      connection.addEventListener("iceconnectionstatechange", () => {
        if (!isCurrentAttempt() || peerRef.current !== connection) return;

        if (connection.iceConnectionState === "failed") {
          failTransport("The network connection to the live session failed.");
        }
      });

      connection.addEventListener("track", (event) => {
        if (!isCurrentAttempt()) return;

        const remoteStream =
          event.streams[0] ?? new MediaStream([event.track]);
        audio.srcObject = remoteStream;

        event.track.addEventListener("ended", () => {
          if (isCurrentAttempt()) {
            audio.srcObject = null;
          }
        });

        void audio.play().catch(() => {
          if (!mountedRef.current || disposedRef.current) return;
          setErrorMessage(
            "Audio playback was blocked. Interact with the page and try again.",
          );
        });
      });

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (!isCurrentAttempt()) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      microphoneRef.current = microphone;

      for (const track of microphone.getAudioTracks()) {
        connection.addTrack(track, microphone);
      }

      const dataChannel = connection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;

        try {
          handleServerEvent(JSON.parse(event.data) as unknown);
        } catch {
          failTransport("The live session returned an invalid event.");
        }
      });

      dataChannel.addEventListener("close", () => {
        if (!isCurrentAttempt() || statusRef.current === "closing") return;
        failTransport("The live data channel closed unexpectedly.");
      });

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await waitForIceGatheringComplete(connection);
      if (!isCurrentAttempt()) return;

      const sdp = connection.localDescription?.sdp;
      if (!sdp) {
        throw new Error("The browser did not produce an SDP offer.");
      }

      const requestController = new AbortController();
      sessionRequestControllerRef.current = requestController;
      const response = await fetch("/api/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryLanguage,
          secondaryLanguage,
          sdp,
        }),
        signal: requestController.signal,
      });
      if (!isCurrentAttempt()) return;

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const result: unknown = await response.json();
      if (!isCurrentAttempt()) return;
      if (!isLiveSessionResponse(result)) {
        throw new Error("The server returned an invalid live session.");
      }

      sessionRequestControllerRef.current = null;
      await connection.setRemoteDescription({
        type: "answer",
        sdp: result.transport.sdp,
      });
      if (!isCurrentAttempt()) return;

      sessionStartTimeoutRef.current = window.setTimeout(() => {
        if (sessionStartedRef.current || !isCurrentAttempt()) return;
        failTransport("The live session did not start in time.");
      }, 15_000);
    } catch (error) {
      if (disposedRef.current || generationRef.current !== generation) {
        return;
      }

      disposeTransport();
      updateStatus("error", "Could not start the live session.");
      setErrorMessage(getErrorMessage(error));
    }
  }, [
    disposeTransport,
    failTransport,
    handleServerEvent,
    primaryLanguage,
    secondaryLanguage,
    updateStatus,
  ]);

  const endConversation = useCallback(() => {
    if (
      statusRef.current !== "connecting" &&
      statusRef.current !== "connected" &&
      statusRef.current !== "closing"
    ) {
      return;
    }

    if (!sessionStartedRef.current) {
      disposeTransport();
      updateStatus("idle", "Session ended.");
      setErrorMessage(null);
      return;
    }

    const dataChannel = dataChannelRef.current;
    if (!dataChannel || dataChannel.readyState !== "open") {
      disposeTransport();
      updateStatus("error", "Session could not be closed cleanly.");
      setErrorMessage("The live data channel was not ready to close.");
      return;
    }

    updateStatus("closing", "Ending the live session…");

    try {
      dataChannel.send(
        JSON.stringify({
          event_id: createEventId("close"),
          type: "session.close",
        }),
      );
    } catch {
      disposeTransport();
      updateStatus("error", "Session could not be closed cleanly.");
      setErrorMessage("The live session rejected the close request.");
      return;
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      if (disposedRef.current) return;

      disposeTransport();
      updateStatus("error", "Session finalization timed out.");
      setErrorMessage(
        "The connection closed before the live session confirmed finalization.",
      );
    }, 15_000);
  }, [disposeTransport, updateStatus]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      disposeTransport();
    };
  }, [disposeTransport]);

  const isActive =
    status === "connecting" || status === "connected" || status === "closing";
  const buttonLabel =
    status === "connecting"
      ? "Connecting…"
      : status === "connected" || status === "closing"
        ? "End conversation"
        : "Start conversation";

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-8">
      <div className="flex w-full max-w-xs flex-col items-center gap-4 text-center">
        <h1 className="sr-only">Live translation</h1>

        <div className="flex w-full flex-col gap-2">
          <Select
            value={primaryLanguage}
            onValueChange={(value) => {
              if (isTargetLanguage(value) && value !== secondaryLanguage) {
                setPrimaryLanguage(value);
              }
            }}
            disabled={isActive}
          >
            <SelectTrigger className="w-full" aria-label="Primary language">
              <SelectValue placeholder="Select primary language" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TARGET_LANGUAGES.map((language) => (
                  <SelectItem
                    key={language.value}
                    value={language.value}
                    disabled={language.value === secondaryLanguage}
                  >
                    {language.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={secondaryLanguage}
            onValueChange={(value) => {
              if (isTargetLanguage(value) && value !== primaryLanguage) {
                setSecondaryLanguage(value);
              }
            }}
            disabled={isActive}
          >
            <SelectTrigger className="w-full" aria-label="Secondary language">
              <SelectValue placeholder="Select secondary language" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TARGET_LANGUAGES.map((language) => (
                  <SelectItem
                    key={language.value}
                    value={language.value}
                    disabled={language.value === primaryLanguage}
                  >
                    {language.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={isActive ? endConversation : startConversation}
          disabled={status === "connecting" || status === "closing"}
        >
          {buttonLabel}
        </Button>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {statusMessage}
        </p>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <audio
          ref={audioElementRef}
          autoPlay
          playsInline
          aria-hidden="true"
          hidden
        />
      </div>
    </main>
  );
}
