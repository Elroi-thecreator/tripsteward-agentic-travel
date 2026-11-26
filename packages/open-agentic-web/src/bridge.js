/**
 * Open Agentic Web — Cross-Origin Action Bridge (nsdeploy-actions-v1 protocol)
 * Enables secure, sandboxed execution of site actions across origins via postMessage & MessageChannel.
 */

import { ActionSecurityError } from "./actions.js";

export const ACTION_BRIDGE_PROTOCOL = "nsdeploy-actions-v1";

/**
 * Sets up an action bridge listener in an iframe (bridge/action-bridge.html).
 * Enforces origin security, human confirmation for irreversible actions, and routes execution to the registry.
 */
export function setupActionBridge({
  registry,
  allowedOrigins = undefined,
  manifestUrl = null,
  onConfirm = null,
  protocol = ACTION_BRIDGE_PROTOCOL,
  windowObj = globalThis.window
} = {}) {
  if (!windowObj) {
    throw new Error("Action bridge requires a browser window environment.");
  }

  // Fail-closed security:
  // If allowedOrigins is explicitly given, use it.
  // If manifestUrl is given, start empty and queue incoming events until policy is loaded.
  // If neither is given, fail-closed to [] (rejecting all cross-origin requests).
  let effectiveAllowedOrigins = allowedOrigins !== undefined
    ? (Array.isArray(allowedOrigins) ? [...allowedOrigins] : [allowedOrigins])
    : (manifestUrl ? [] : []);

  let policyReady = !manifestUrl;
  const queuedEvents = [];

  // Runtime enforcement of agent-manifest.json peer_policy if provided
  if (manifestUrl && typeof windowObj.fetch === "function") {
    windowObj.fetch(manifestUrl)
      .then(res => res.json())
      .then(manifest => {
        const policy = manifest.peer_policy;
        const allowedPeers = manifest.allowed_peers || policy?.allowed_peers;
        if (policy?.mode === "open" || (!policy && !allowedPeers)) {
          effectiveAllowedOrigins = ["*"];
        } else if (Array.isArray(allowedPeers)) {
          effectiveAllowedOrigins = [...allowedPeers];
        } else if (allowedOrigins === undefined) {
          effectiveAllowedOrigins = [];
        }
      })
      .catch(err => {
        console.warn(`[ActionBridge] Unable to load manifest policy from '${manifestUrl}':`, err);
      })
      .finally(() => {
        policyReady = true;
        while (queuedEvents.length > 0) {
          const ev = queuedEvents.shift();
          processEvent(ev);
        }
      });
  }

  if (effectiveAllowedOrigins.includes("*")) {
    console.warn(
      "[ActionBridge Security Warning] allowedOrigins is set to wildcard ('*'). " +
      "Any site can embed this bridge. Irreversible actions will strictly enforce onConfirm approval."
    );
  }

  let isConnected = false;
  let interval = null;

  const isOriginAllowed = (origin) => {
    if (effectiveAllowedOrigins.includes("*")) return true;
    return effectiveAllowedOrigins.includes(origin);
  };

  const executeWithSecurity = async (action, args, origin) => {
    const actionDef = registry.get(action);
    if (!actionDef) {
      throw new Error(`Action '${action}' is not registered in this action registry.`);
    }

    // Irreversible action security check
    if (actionDef.effect === "irreversible") {
      if (typeof onConfirm !== "function") {
        throw new ActionSecurityError(
          `Action '${action}' is marked '${actionDef.effect}' and was rejected: no onConfirm handler is configured on this action bridge.`,
          { action, effect: actionDef.effect, origin }
        );
      }

      const approved = await onConfirm({
        action,
        arguments: args,
        origin,
        definition: actionDef
      });

      if (!approved) {
        throw new ActionSecurityError(
          `Action '${action}' was rejected by user confirmation.`,
          { action, effect: actionDef.effect, origin }
        );
      }
    }

    return registry.execute(action, args, { origin, confirmed: true });
  };

  const processEvent = async (event) => {
    const { data, origin, source, ports } = event;

    if (!data || typeof data !== "object" || data.protocol !== protocol) {
      return;
    }

    if (!isOriginAllowed(origin)) {
      console.warn(`[ActionBridge] Rejected postMessage from untrusted origin: ${origin}`);
      return;
    }

    // Handle handshake request
    if (data.type === "connect" || data.type === "ready") {
      if (ports && ports[0]) {
        const port = ports[0];
        isConnected = true;
        if (interval) {
          clearInterval(interval);
          interval = null;
        }

        port.onmessage = async ({ data: portData }) => {
          if (!portData) return;

          // Catalog discovery RPC
          if (portData.type === "catalog") {
            const { id } = portData;
            const tools = registry.catalog();
            port.postMessage({ id, ok: true, value: tools, tools, protocol });
            return;
          }

          if (portData.type !== "execute" && portData.type !== "call") return;

          const id = portData.id;
          const action = portData.name || portData.action;
          const args = portData.args || portData.arguments || {};
          try {
            const result = await executeWithSecurity(action, args, origin);
            port.postMessage({ id, ok: true, value: result, result, protocol });
          } catch (err) {
            port.postMessage({
              id,
              ok: false,
              error: err.message,
              errors: err.errors || [],
              isSecurityError: err instanceof ActionSecurityError,
              protocol
            });
          }
        };

        port.postMessage({ type: "connected", protocol, ok: true });
        return;
      }
    }

    // Direct fallback catalog discovery if no MessageChannel
    if (data.type === "catalog" && data.id) {
      const tools = registry.catalog();
      source?.postMessage({ id: data.id, ok: true, value: tools, tools, protocol }, origin);
      return;
    }

    // Direct fallback communication if no MessageChannel
    if ((data.type === "execute" || data.type === "call") && data.id) {
      const id = data.id;
      const action = data.name || data.action;
      const args = data.args || data.arguments || {};
      if (action) {
        try {
          const result = await executeWithSecurity(action, args, origin);
          source?.postMessage({ id, ok: true, value: result, result, protocol }, origin);
        } catch (err) {
          source?.postMessage({
            id,
            ok: false,
            error: err.message,
            errors: err.errors || [],
            isSecurityError: err instanceof ActionSecurityError,
            protocol
          }, origin);
        }
      }
    }
  };

  const handleMessage = async (event) => {
    if (!policyReady) {
      queuedEvents.push(event);
      return;
    }
    await processEvent(event);
  };

  windowObj.addEventListener("message", handleMessage);

  // Announce readiness to opener or parent window repeatedly until connected
  const peer = windowObj.opener || (windowObj.parent !== windowObj ? windowObj.parent : null);
  if (peer) {
    const announceReady = () => {
      if (!isConnected) {
        try {
          peer.postMessage({ type: "ready", protocol }, "*");
        } catch {
          // Ignored if peer is cross-origin
        }
      } else if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    interval = setInterval(announceReady, 250);
    announceReady();
    if (typeof windowObj.addEventListener === "function") {
      windowObj.addEventListener("pagehide", () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }, { once: true });
    }
  }

  return {
    dispose() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      windowObj.removeEventListener("message", handleMessage);
    },
    isConnected() {
      return isConnected;
    }
  };
}

/**
 * Creates a client in the parent orchestrator to invoke actions on a peer bridge.
 * Concurrency-safe: multiple parallel execute() calls await a single in-flight connection promise.
 */
export function createActionBridgeClient({
  bridgeUrl,
  brand = "Peer Node",
  timeoutMs = 15000,
  windowObj = globalThis.window
} = {}) {
  if (!windowObj) {
    throw new Error("Action bridge client requires a browser window environment.");
  }

  let port = null;
  let iframe = null;
  let connectionPromise = null;
  const pendingRequests = new Map();
  let seq = 0;

  const targetOrigin = new URL(bridgeUrl, windowObj.location?.href || "http://localhost").origin;

  function connect() {
    if (port) return Promise.resolve(port);
    if (connectionPromise) return connectionPromise;

    connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out connecting to action bridge at '${bridgeUrl}' (${brand})`));
      }, timeoutMs);

      iframe = windowObj.document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = bridgeUrl;

      function onMessage(event) {
        if (event.origin !== targetOrigin || event.data?.protocol !== ACTION_BRIDGE_PROTOCOL) return;

        if (event.data?.type === "ready") {
          const channel = new MessageChannel();
          port = channel.port1;

          port.onmessage = ({ data }) => {
            if (data?.type === "connected") {
              clearTimeout(timeout);
              cleanup();
              resolve(port);
              return;
            }

            if (data?.id !== undefined && pendingRequests.has(data.id)) {
              const { res, rej } = pendingRequests.get(data.id);
              pendingRequests.delete(data.id);
              if (data.ok) res(data.value !== undefined ? data.value : (data.tools !== undefined ? data.tools : data.result));
              else rej(new Error(data.error || "Action execution failed."));
            }
          };

          iframe.contentWindow?.postMessage(
            { type: "connect", protocol: ACTION_BRIDGE_PROTOCOL },
            targetOrigin,
            [channel.port2]
          );
        }
      }

      function cleanup() {
        windowObj.removeEventListener("message", onMessage);
      }

      windowObj.addEventListener("message", onMessage);
      windowObj.document.body.appendChild(iframe);
    }).catch(err => {
      connectionPromise = null;
      throw err;
    });

    return connectionPromise;
  }

  return {
    async execute(actionName, args = {}, { signal = null } = {}) {
      if (signal?.aborted) {
        throw new DOMException("The action execution was aborted.", "AbortError");
      }
      await connect();
      const id = ++seq;
      const requestId = `req_${id}_${Date.now()}`;

      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          rej(new Error(`Timeout calling action '${actionName}' on '${brand}' (${timeoutMs}ms)`));
        }, timeoutMs);

        let abortHandler = null;
        if (signal) {
          abortHandler = () => {
            clearTimeout(timer);
            pendingRequests.delete(id);
            rej(new DOMException("The action execution was aborted.", "AbortError"));
          };
          signal.addEventListener("abort", abortHandler, { once: true });
        }

        pendingRequests.set(id, {
          res: (result) => {
            clearTimeout(timer);
            if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
            res(result);
          },
          rej: (err) => {
            clearTimeout(timer);
            if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
            rej(err);
          }
        });

        port.postMessage({
          type: "execute",
          id,
          name: actionName,
          action: actionName,
          args,
          arguments: args,
          requestId,
          protocol: ACTION_BRIDGE_PROTOCOL
        });
      });
    },

    /**
     * Fetch runtime action catalog with full inputSchema parameter definitions from remote bridge.
     */
    async getCatalog({ signal = null } = {}) {
      if (signal?.aborted) {
        throw new DOMException("The catalog request was aborted.", "AbortError");
      }
      await connect();
      const id = ++seq;

      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          rej(new Error(`Timeout fetching catalog from '${brand}' (${timeoutMs}ms)`));
        }, timeoutMs);

        let abortHandler = null;
        if (signal) {
          abortHandler = () => {
            clearTimeout(timer);
            pendingRequests.delete(id);
            rej(new DOMException("The catalog request was aborted.", "AbortError"));
          };
          signal.addEventListener("abort", abortHandler, { once: true });
        }

        pendingRequests.set(id, {
          res: (tools) => {
            clearTimeout(timer);
            if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
            res(tools);
          },
          rej: (err) => {
            clearTimeout(timer);
            if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
            rej(err);
          }
        });

        port.postMessage({
          type: "catalog",
          id,
          protocol: ACTION_BRIDGE_PROTOCOL
        });
      });
    },

    dispose() {
      if (port) {
        try { port.close(); } catch {}
        port = null;
      }
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
        iframe = null;
      }
      connectionPromise = null;
    }
  };
}
