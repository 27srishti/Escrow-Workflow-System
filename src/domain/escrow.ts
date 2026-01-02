/**
 * Escrow Domain Model
 * 
 * Combines state machine and event sourcing
 */

import {
  EscrowState,
  EscrowAction,
  UserRole,
  transitionState,
} from "./escrow-state";
import {
  EscrowEvent,
  EventType,
  createEscrowCreatedEvent,
  createStateChangedEvent,
  reconstructStateFromEvents,
} from "./events";

export interface Escrow {
  id: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  description: string;
  currentState: EscrowState;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscrowWithHistory extends Escrow {
  events: EscrowEvent[];
}

/**
 * Creates a new escrow
 */
export function createEscrow(
  id: string,
  buyerId: string,
  sellerId: string,
  amount: number,
  description: string
): { escrow: Escrow; event: EscrowEvent } {
  const now = new Date();
  const escrow: Escrow = {
    id,
    buyerId,
    sellerId,
    amount,
    description,
    currentState: EscrowState.PROPOSED,
    createdAt: now,
    updatedAt: now,
  };

  const event = createEscrowCreatedEvent(
    id,
    buyerId,
    sellerId,
    amount,
    description
  );

  return { escrow, event };
}

/**
 * Applies an action to an escrow
 */
export function applyAction(
  escrow: Escrow,
  action: EscrowAction,
  performedBy: string,
  userRole: UserRole,
  reason?: string
): { success: boolean; newEscrow?: Escrow; event?: EscrowEvent; error?: string } {
  const transition = transitionState(escrow.currentState, action, userRole);

  if (!transition.success) {
    return {
      success: false,
      error: transition.error,
    };
  }

  const newEscrow: Escrow = {
    ...escrow,
    currentState: transition.newState!,
    updatedAt: new Date(),
  };

  const event = createStateChangedEvent(
    escrow.id,
    action,
    escrow.currentState,
    transition.newState!,
    performedBy,
    userRole,
    reason
  );

  return {
    success: true,
    newEscrow,
    event,
  };
}

/**
 * Reconstructs escrow from events
 */
export function reconstructEscrow(events: EscrowEvent[]): EscrowWithHistory | null {
  const { state, escrow } = reconstructStateFromEvents(events);

  if (!state || !escrow) {
    return null;
  }

  const createdEvent = events.find(
    (e) => e.type === EventType.ESCROW_CREATED
  ) as EscrowEvent;

  return {
    ...escrow,
    currentState: state,
    createdAt: createdEvent.timestamp,
    updatedAt: events[events.length - 1].timestamp,
    events,
  };
}

