/**
 * JSON-backed Escrow Store (dev)
 * 
 * Persists to .data/escrows.json so API route reloads/HMR don't lose state.
 * The interface remains swappable with a real database for production.
 */

import { Escrow, EscrowWithHistory } from "@/domain/escrow";
import { EscrowEvent } from "@/domain/events";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface EscrowData {
  escrow: Escrow;
  events: EscrowEvent[];
}

// Global singleton state to ensure all route handlers share the same in-process cache
declare global {
  // eslint-disable-next-line no-var
  var __ESCROW_STORE_STATE: { cache: Record<string, EscrowData>; loaded: boolean } | undefined;
}

function getGlobalState(): { cache: Record<string, EscrowData>; loaded: boolean } {
  if (!globalThis.__ESCROW_STORE_STATE) {
    globalThis.__ESCROW_STORE_STATE = { cache: {}, loaded: false };
  }
  return globalThis.__ESCROW_STORE_STATE;
}

class EscrowStore {
private primaryDir: string;
private primaryFile: string;
private secondaryDir: string;
private secondaryFile: string;
private cache: Record<string, EscrowData> = {};

constructor() {
// Primary path: relative to this module's directory
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../../..");
this.primaryDir = path.join(projectRoot, ".data");
this.primaryFile = path.join(this.primaryDir, "escrows.json");

// Secondary path: relative to process cwd (in case some routes resolve from cwd)
const cwdRoot = process.cwd();
this.secondaryDir = path.join(cwdRoot, ".data");
this.secondaryFile = path.join(this.secondaryDir, "escrows.json");

this.ensureLoaded();
}

private readFileIfExists(file: string): Record<string, EscrowData> | null {
try {
if (!fs.existsSync(file)) return null;
const raw = fs.readFileSync(file, "utf-8");
if (!raw) return {};
const parsed = JSON.parse(raw) as Record<string, EscrowData>;
// Revive Date instances
for (const [id, data] of Object.entries(parsed)) {
data.escrow.createdAt = new Date(data.escrow.createdAt);
data.escrow.updatedAt = new Date(data.escrow.updatedAt);
for (const ev of data.events) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(ev as any).timestamp = new Date((ev as any).timestamp);
}
parsed[id] = data;
}
return parsed;
} catch {
return null;
}
}

private ensureDirs() {
try {
if (!fs.existsSync(this.primaryDir)) fs.mkdirSync(this.primaryDir, { recursive: true });
if (!fs.existsSync(this.secondaryDir)) fs.mkdirSync(this.secondaryDir, { recursive: true });
} catch {
// ignore
}
}

private ensureLoaded() {
const state = getGlobalState();
if (state.loaded) {
// Keep this.cache pointing to the same object for convenience
this.cache = state.cache;
return;
}

this.ensureDirs();

// Merge data from both locations, preferring the entry with the latest updatedAt
const a = this.readFileIfExists(this.primaryFile) ?? {};
const b = this.readFileIfExists(this.secondaryFile) ?? {};

const merged: Record<string, EscrowData> = {};
const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
for (const key of allKeys) {
const va = a[key];
const vb = b[key];
if (va && vb) {
merged[key] = va.escrow.updatedAt >= vb.escrow.updatedAt ? va : vb;
} else {
merged[key] = (va ?? vb)!;
}
}

state.cache = merged;
state.loaded = true;
this.cache = state.cache;

// Ensure at least primary file exists
try {
if (!fs.existsSync(this.primaryFile)) {
fs.writeFileSync(this.primaryFile, JSON.stringify(this.cache, null, 2), "utf-8");
}
} catch {
// ignore
}
}

private persist() {
const payload = JSON.stringify(this.cache, null, 2);
try {
fs.writeFileSync(this.primaryFile, payload, "utf-8");
} catch {
// ignore
}
try {
fs.writeFileSync(this.secondaryFile, payload, "utf-8");
} catch {
// ignore
}
}

  /**
   * Creates a new escrow
   */
  create(escrow: Escrow, initialEvent: EscrowEvent): void {
    this.ensureLoaded();
    const state = getGlobalState();
    state.cache[escrow.id] = { escrow, events: [initialEvent] };
    this.cache = state.cache;
    this.persist();
  }

  /**
   * Gets an escrow by ID
   */
  getById(id: string): EscrowWithHistory | null {
    this.ensureLoaded();
    const state = getGlobalState();
    const data = state.cache[id];
    if (!data) return null;
    return {
      ...data.escrow,
      events: [...data.events],
    };
  }

  /**
   * Updates an escrow and appends an event
   */
  update(escrow: Escrow, event: EscrowEvent): void {
    this.ensureLoaded();
    const state = getGlobalState();
    const data = state.cache[escrow.id];
    if (!data) {
      throw new Error(`Escrow ${escrow.id} not found`);
    }
    state.cache[escrow.id] = {
      escrow,
      events: [...data.events, event],
    };
    this.cache = state.cache;
    this.persist();
  }

  /**
   * Lists all escrows
   */
  listAll(): EscrowWithHistory[] {
    this.ensureLoaded();
    const state = getGlobalState();
    return Object.values(state.cache).map((data) => ({
      ...data.escrow,
      events: [...data.events],
    }));
  }

  /**
   * Clears all data (useful for testing)
   */
  clear(): void {
    const state = getGlobalState();
    state.cache = {};
    state.loaded = true;
    this.cache = state.cache;
    this.persist();
  }
}

// Singleton instance
export const escrowStore = new EscrowStore();


