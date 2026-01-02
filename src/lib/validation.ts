/**
 * Zod-based validation schemas
 */

import { z } from "zod";
import { EscrowAction, UserRole } from "@/domain/escrow-state";

export const createEscrowSchema = z.object({
  buyerId: z.string().min(1, "Buyer ID is required"),
  sellerId: z.string().min(1, "Seller ID is required"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
});

export const performActionSchema = z.object({
  action: z.nativeEnum(EscrowAction),
  performedBy: z.string().min(1, "Performed by is required"),
  userRole: z.nativeEnum(UserRole),
  reason: z.string().optional(),
});

export type CreateEscrowInput = z.infer<typeof createEscrowSchema>;
export type PerformActionInput = z.infer<typeof performActionSchema>;




