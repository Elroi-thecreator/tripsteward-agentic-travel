/**
 * Open Agentic Web SDK (open-agentic-web) — TypeScript Declarations
 * Spec: Cognizant AI Lab / Mozilla Otari / MIT NANDA MVP Profile 0.3
 */

export type ActionEffect = "read" | "irreversible" | "undoable";
export type LLMProvider = "openai" | "anthropic" | "gemini" | "ollama" | "custom";

export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  default?: any;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  description?: string;
  enum?: any[];
  [key: string]: any;
}

export interface ActionDefinition {
  name: string;
  description: string;
  effect?: ActionEffect;
  inputSchema?: JSONSchema;
  confirmsInWindow?: boolean;
  execute: (args: Record<string, any>, context?: any) => Promise<any>;
  undo?: ((args: Record<string, any>, context?: any) => Promise<any>) | null;
  rawExecute?: (args: Record<string, any>, context?: any) => Promise<any>;
}

export interface ActionCatalogEntry {
  name: string;
  description: string;
  effect: ActionEffect;
  inputSchema: JSONSchema;
  confirmsInWindow?: boolean;
}

export interface ActionAuditRecord {
  timestamp: string;
  action: string;
  effect: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
  ok: boolean;
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface ActionRegistry {
  register(actionDef: ActionDefinition | ActionDefinition[]): ActionRegistry;
  get(name: string): ActionDefinition | undefined;
  has(name: string): boolean;
  list(): ActionDefinition[];
  names(): string[];
  catalog(): ActionCatalogEntry[];
  toOpenAITools(): OpenAITool[];
  toMCPTools(): MCPTool[];
  registerWebMCP(): Promise<boolean>;
  getAuditLog(): ActionAuditRecord[];
  execute(name: string, args?: Record<string, any>, context?: any): Promise<any>;
  undo(name: string, args?: Record<string, any>, context?: any): Promise<any>;
}

export class ActionSecurityError extends Error {
  action?: string;
  effect?: ActionEffect;
  origin?: string;
  errors?: string[];
  constructor(message: string, details?: Record<string, any>);
}

export class ActionValidationError extends Error {
  errors: string[];
  constructor(message: string, errors?: string[]);
}

export function defineAction(definition: ActionDefinition): ActionDefinition;
export function createActionRegistry(options?: {
  onActionExecuted?: (record: ActionAuditRecord) => void;
  onActionError?: (record: ActionAuditRecord, error: Error) => void;
}): ActionRegistry;
export function validateSchema(schema: JSONSchema, data: any, path?: string): { valid: boolean; errors: string[] };

export function toA2AAgentCard(manifest: any, options?: { baseUrl?: string }): {
  $schema: string;
  name: string;
  description: string;
  url: string;
  version: string;
  identity: {
    brand: string;
    frontMan: string;
    category: string;
  };
  capabilities: {
    tools: string[];
    networks: string[];
    actionBridgeUrl: string;
  };
  protocols: Array<{ name: string; version: string; endpoint: string }>;
  authentication: { type: string; description?: string };
};

export function createConsentDialog(options?: {
  title?: string;
  message?: string;
  details?: any;
  confirmText?: string;
  cancelText?: string;
  documentObj?: any;
}): Promise<boolean>;

export const ACTION_BRIDGE_PROTOCOL: string;

export interface SetupActionBridgeOptions {
  registry: ActionRegistry;
  allowedOrigins?: string[];
  manifestUrl?: string | null;
  onConfirm?: (details: {
    action: string;
    arguments: Record<string, any>;
    origin: string;
    definition?: ActionDefinition;
  }) => boolean | Promise<boolean>;
  protocol?: string;
  windowObj?: any;
}

export interface ActionBridgeHandle {
  dispose(): void;
  isConnected(): boolean;
}

export function setupActionBridge(options: SetupActionBridgeOptions): ActionBridgeHandle;

export interface ActionBridgeClientOptions {
  bridgeUrl: string;
  brand?: string;
  timeoutMs?: number;
  windowObj?: any;
}

export interface ActionBridgeClient {
  execute(actionName: string, args?: Record<string, any>, options?: { signal?: AbortSignal | null }): Promise<any>;
  getCatalog(options?: { signal?: AbortSignal | null }): Promise<ActionCatalogEntry[]>;
  dispose(): void;
}

export function createActionBridgeClient(options: ActionBridgeClientOptions): ActionBridgeClient;

export interface AgentNode {
  id: string;
  name: string;
  category?: string;
  front_man?: string;
  node_url?: string;
  description?: string;
  tools?: Array<string | { name: string; description?: string; inputSchema?: JSONSchema }>;
  icon?: string;
  _bridgeClient?: ActionBridgeClient | null;
}

export interface AgentSwarmOptions {
  defaultRouter?: string;
  defaultModel?: string;
}

export interface RunTurnOptions {
  prompt?: string;
  messages?: Array<{ role: string; content: string | null; tool_calls?: any[] }>;
  systemInstructions?: string;
  model?: string;
  routerUrl?: string;
  apiKey?: string | null;
  provider?: LLMProvider;
  adapter?: ((params: any) => Promise<any>) | null;
  actionExecutor?: ((
    toolName: string,
    args: Record<string, any>,
    meta?: { nodeId?: string | null; namespacedName?: string; node?: AgentNode | null; signal?: AbortSignal | null }
  ) => Promise<any>) | null;
  maxSteps?: number;
  onStep?: (stepInfo: {
    step: number;
    tool: string;
    namespacedTool?: string;
    arguments: Record<string, any>;
    result: any;
  }) => void;
  stream?: boolean;
  onToken?: (delta: string) => void;
  signal?: AbortSignal | null;
  fetchFn?: typeof fetch;
}

export interface TurnResult {
  ok: boolean;
  text: string;
  messages: any[];
  stepsCount: number;
  toolCallsCount: number;
}

export class AgentSwarm {
  defaultRouter: string;
  defaultModel: string;
  nodes: Map<string, AgentNode>;
  constructor(options?: AgentSwarmOptions);
  registerNode(node: AgentNode): AgentNode;
  unregisterNode(id: string): boolean;
  getNode(id: string): AgentNode | undefined;
  getNodes(): AgentNode[];
  search(filter?: { query?: string; category?: string }): AgentNode[];
  exportLinks(hubNetworkName?: string): { networks: Record<string, Record<string, string>> };
  mountFromUrl(nodeUrl: string, options?: {
    onConsent?: (details: { candidate: AgentNode; manifest: any; origin: string }) => boolean | Promise<boolean>;
    autoWireBridge?: boolean;
    fetchFn?: typeof fetch;
  }): Promise<AgentNode>;
  resolveTool(toolName: string): { node: AgentNode | null; rawName: string; nodeId: string | null; isAmbiguous?: boolean };
  getOpenAITools(toolSubset?: string[] | null, options?: { namespace?: boolean | "auto" }): OpenAITool[];
  runTurn(options: RunTurnOptions): Promise<TurnResult>;
  dispose(): void;
  subscribe(callback: (nodes: AgentNode[]) => void): () => boolean;
}

export interface ValidationItem {
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface ValidationResult {
  target?: string;
  valid: boolean;
  failed: number;
  passed: number;
  warnings: number;
  results: ValidationItem[];
}

export interface FederationReport {
  valid: boolean;
  totalChecks: number;
  totalPassed: number;
  totalFailed: number;
  meshReport?: {
    valid: boolean;
    results: ValidationItem[];
  };
}

export function validateNode(nodeDir: string): Promise<ValidationResult>;
export function validateManifest(manifest: any): ValidationResult;
export function validateNetwork(network: any): ValidationResult;
export function validateFederation(hubDir: string, peerDirs: string[]): Promise<FederationReport>;
