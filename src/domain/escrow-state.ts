/**
 * Escrow State Machine
 *
 * Centralizes states, actions, roles, and transition rules with invariants.
 */

export enum EscrowState {
  PROPOSED = "PROPOSED",
  FUNDED = "FUNDED",
  RELEASED = "RELEASED",
  DISPUTED = "DISPUTED",
  REFUNDED = "REFUNDED",
}

export enum EscrowAction {
  FUND = "FUND",
  RELEASE = "RELEASE",
  DISPUTE = "DISPUTE",
  RESOLVE_DISPUTE_RELEASE = "RESOLVE_DISPUTE_RELEASE",
  RESOLVE_DISPUTE_REFUND = "RESOLVE_DISPUTE_REFUND",
  // Not exposed through UI; kept here to document rejected path
  REFUND = "REFUND",
}

export enum UserRole {
  BUYER = "BUYER",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
}

export interface TransitionResult {
  success: boolean;
  newState?: EscrowState;
  error?: string;
}

/**
 * Returns true if the given state is terminal (no further actions allowed)
 */
export function isTerminalState(state: EscrowState): boolean {
  return state === EscrowState.RELEASED || state === EscrowState.REFUNDED;
}

/**
 * Validates if a role can perform an action from a given state and returns the next state.
 * Enforces invariants and rejects invalid transitions.
 */
export function transitionState(
  current: EscrowState,
  action: EscrowAction,
  role: UserRole
): TransitionResult {
  // Invariant 5: Once RELEASED or REFUNDED, no further actions are allowed
  if (isTerminalState(current)) {
    return {
      success: false,
      error: `No actions allowed from terminal state ${current}`,
    };
  }

  // Centralized permission rules (Invariants 1-3)
  const permissionMap: Record<EscrowAction, UserRole[]> = {
    [EscrowAction.FUND]: [UserRole.BUYER], // Only buyer can fund
    [EscrowAction.RELEASE]: [UserRole.SELLER], // Seller can release when FUNDED
    [EscrowAction.DISPUTE]: [UserRole.BUYER], // Only buyer can raise dispute
    [EscrowAction.RESOLVE_DISPUTE_RELEASE]: [UserRole.ADMIN], // Only admin resolves
    [EscrowAction.RESOLVE_DISPUTE_REFUND]: [UserRole.ADMIN], // Only admin resolves
    [EscrowAction.REFUND]: [], // Direct refund is not permitted by any role
  };

  const allowedRoles = permissionMap[action] ?? [];
  if (!allowedRoles.includes(role)) {
    return {
      success: false,
      error: `Role ${role} is not allowed to perform action ${action}`,
    };
  }

  // State transition table (Invariant 4: reject invalid transitions)
  switch (current) {
    case EscrowState.PROPOSED:
      if (action === EscrowAction.FUND && role === UserRole.BUYER) {
        return { success: true, newState: EscrowState.FUNDED };
      }
      break;

    case EscrowState.FUNDED:
      if (action === EscrowAction.RELEASE && role === UserRole.SELLER) {
        return { success: true, newState: EscrowState.RELEASED };
      }
      if (action === EscrowAction.DISPUTE && role === UserRole.BUYER) {
        return { success: true, newState: EscrowState.DISPUTED };
      }
      break;

    case EscrowState.DISPUTED:
      if (action === EscrowAction.RESOLVE_DISPUTE_RELEASE && role === UserRole.ADMIN) {
        return { success: true, newState: EscrowState.RELEASED };
      }
      if (action === EscrowAction.RESOLVE_DISPUTE_REFUND && role === UserRole.ADMIN) {
        return { success: true, newState: EscrowState.REFUNDED };
      }
      break;

    // Terminal states are already handled above
    case EscrowState.RELEASED:
    case EscrowState.REFUNDED:
      return { success: false, error: `No actions allowed from terminal state ${current}` };
  }

  return { success: false, error: `Invalid transition: ${current} -> (${action}) by ${role}` };
}
