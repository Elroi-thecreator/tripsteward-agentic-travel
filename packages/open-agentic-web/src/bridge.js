/**
 * Open Agentic Web — Cross-Origin Action Bridge (nsdeploy-actions-v1 protocol)
 * Enables secure, sandboxed execution of site actions across origins via postMessage & MessageChannel.
 */

export const ACTION_BRIDGE_PROTOCOL = "nsdeploy-actions-v1";

/**
 * Sets up an action bridge listener in an iframe (bridge/action-bridge.html).
 * Responds to orchestrator handshake and routes tool execution calls to the registry.
 */
export function setupActionBridge({
  registry,
  allowedOrigins = ["*"],
  protocol = ACTION_BRIDGE_PROTOCOL,
  windowObj = globalThis.window
} = {}) {
  if (!windowObj) {
    throw new Error("Action bridge requires a browser window environment.");
  }

  let isConnected = false;

  const isOriginAllowed = (origin) => {
    if (allowedOrigins.includes("*")) return true;
    return allowedOrigins.includes(origin);
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
            const result = await registry.execute(action, args, { origin });
            port.postMessage({ id, ok: true, result, protocol });
          } catch (err) {
            port.postMessage({ id, ok: false, error: err.message, errors: err.errors || [], protocol });
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
        const result = await registry.execute(action, args, { origin });
        source?.postMessage({ id, ok: true, result, protocol }, origin);
      } catch (err) {
        source?.postMessage({ id, ok: false, error: err.message, errors: err.errors || [], protocol }, origin);
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
  let isConnecting = false;
  const pendingRequests = new Map();
  let seq = 0;

  const targetOrigin = new URL(bridgeUrl, windowObj.location?.href || "http://localhost").origin;

  async function connect() {
    if (port) return port;
    if (isConnecting) {
      // Wait for existing handshake
      await new Promise(r => setTimeout(r, 200));
      return port;
    }

    isConnecting = true;

    return new Promise((resolve, reject) => {
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
              isConnecting = false;
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
        isConnecting = false;
        windowObj.removeEventListener("message", onMessage);
      }

      windowObj.addEventListener("message", onMessage);
      windowObj.document.body.appendChild(iframe);
    });
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
    }
  };
}
