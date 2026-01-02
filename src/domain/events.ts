/**
 * Event Sourcing Implementation
 * 
 * All state changes are recorded as immutable events in an append-only log.
 * This allows us to:
 * - Reconstruct state from events
 * - Audit all actions
 * - Time-travel debugging
 */

import { EscrowState, EscrowAction, UserRole } from "./escrow-state";

export enum EventType {
  ESCROW_CREATED = "ESCROW_CREATED",
  STATE_CHANGED = "STATE_CHANGED",
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  escrowId: string;
}

export interface EscrowCreatedEvent extends BaseEvent {
  type: EventType.ESCROW_CREATED;
  buyerId: string;
  sellerId: string;
  amount: number;
  description: string;
}

export interface StateChangedEvent extends BaseEvent {
  type: EventType.STATE_CHANGED;
  action: EscrowAction;
  fromState: EscrowState;
  toState: EscrowState;
  performedBy: string;
  userRole: UserRole;
  reason?: string;
}

export type EscrowEvent = EscrowCreatedEvent | StateChangedEvent;

/**
 * Creates an event ID
 */
export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates an escrow created event
 */
export function createEscrowCreatedEvent(
  escrowId: string,
  buyerId: string,
  sellerId: string,
  amount: number,
  description: string
): EscrowCreatedEvent {
  return {
    id: createEventId(),
    type: EventType.ESCROW_CREATED,
    timestamp: new Date(),
    escrowId,
    buyerId,
    sellerId,
    amount,
    description,
  };
}

/**
 * Creates a state changed event
 */
export function createStateChangedEvent(
  escrowId: string,
  action: EscrowAction,
  fromState: EscrowState,
  toState: EscrowState,
  performedBy: string,
  userRole: UserRole,
  reason?: string
): StateChangedEvent {
  return {
    id: createEventId(),
    type: EventType.STATE_CHANGED,
    timestamp: new Date(),
    escrowId,
    action,
    fromState,
    toState,
    performedBy,
    userRole,
    reason,
  };
}

/**
 * Reconstructs escrow state from events
 */
export function reconstructStateFromEvents(
  events: EscrowEvent[]
): {
  state: EscrowState | null;
  escrow: {
    id: string;
    buyerId: string;
    sellerId: string;
    amount: number;
    description: string;
  } | null;
} {
  if (events.length === 0) {
    return { state: null, escrow: null };
  }

  const createdEvent = events.find(
    (e) => e.type === EventType.ESCROW_CREATED
  ) as EscrowCreatedEvent | undefined;

  if (!createdEvent) {
    return { state: null, escrow: null };
  }

  const escrow = {
    id: createdEvent.escrowId,
    buyerId: createdEvent.buyerId,
    sellerId: createdEvent.sellerId,
    amount: createdEvent.amount,
    description: createdEvent.description,
  };

  const stateChangeEvents = events.filter(
    (e) => e.type === EventType.STATE_CHANGED
  ) as StateChangedEvent[];

  // Start with PROPOSED state
  let currentState: EscrowState = EscrowState.PROPOSED;

  // Apply all state changes in order
  for (const event of stateChangeEvents) {
    currentState = event.toState;
  }

  return { state: currentState, escrow };
}




