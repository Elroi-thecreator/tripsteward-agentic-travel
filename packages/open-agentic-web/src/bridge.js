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
  allowedOrigins = null,
  onConfirm = null,
  protocol = ACTION_BRIDGE_PROTOCOL,
  windowObj = globalThis.window
} = {}) {
  if (!windowObj) {
    throw new Error("Action bridge requires a browser window environment.");
  }

  // Strict origin security: default to own origin if not specified
  const effectiveAllowedOrigins = allowedOrigins !== null
    ? allowedOrigins
    : [windowObj.location?.origin].filter(Boolean);

  if (effectiveAllowedOrigins.includes("*")) {
    console.warn(
      "[ActionBridge Security Warning] allowedOrigins is set to wildcard ('*'). " +
      "Any site can embed this bridge. Irreversible actions will strictly enforce onConfirm approval."
    );
  }

  let isConnected = false;

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

  const handleMessage = async (event) => {
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

        port.onmessage = async ({ data: portData }) => {
          if (!portData || portData.type !== "call") return;

          const { id, action, arguments: args } = portData;
          try {
            const result = await executeWithSecurity(action, args, origin);
            port.postMessage({ id, ok: true, result, protocol });
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

    // Direct fallback communication if no MessageChannel
    if (data.type === "call" && data.id && data.action) {
      const { id, action, arguments: args } = data;
      try {
        const result = await executeWithSecurity(action, args, origin);
        source?.postMessage({ id, ok: true, result, protocol }, origin);
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
  };

  windowObj.addEventListener("message", handleMessage);

  // Announce readiness to parent window
  if (windowObj.parent && windowObj.parent !== windowObj) {
    try {
      windowObj.parent.postMessage({ type: "ready", protocol }, "*");
    } catch {
      // Ignored if parent is cross-origin
    }
  }

  return {
    dispose() {
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

            if (data?.id && pendingRequests.has(data.id)) {
              const { res, rej } = pendingRequests.get(data.id);
              pendingRequests.delete(data.id);
              if (data.ok) res(data.result);
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
    async execute(actionName, args = {}) {
      await connect();
      const id = `req_${++seq}_${Date.now()}`;

      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          rej(new Error(`Timeout calling action '${actionName}' on '${brand}' (${timeoutMs}ms)`));
        }, timeoutMs);

        pendingRequests.set(id, {
          res: (result) => { clearTimeout(timer); res(result); },
          rej: (err) => { clearTimeout(timer); rej(err); }
        });

        port.postMessage({
          type: "call",
          id,
          action: actionName,
          arguments: args,
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
