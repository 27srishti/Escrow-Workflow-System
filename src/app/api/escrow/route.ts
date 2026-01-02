/**
 * POST /api/escrow - Create a new escrow
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createEscrow } from "@/domain/escrow";
import { escrowStore } from "@/storage/escrow-store";
import { createEscrowSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createEscrowSchema.parse(body);

    // Generate ID
    const id = `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create escrow
    const { escrow, event } = createEscrow(
      id,
      validated.buyerId,
      validated.sellerId,
      validated.amount,
      validated.description
    );

    // Store
    escrowStore.create(escrow, event);

    return NextResponse.json(
      {
        success: true,
        escrow: {
          id: escrow.id,
          buyerId: escrow.buyerId,
          sellerId: escrow.sellerId,
          amount: escrow.amount,
          description: escrow.description,
          currentState: escrow.currentState,
          createdAt: escrow.createdAt.toISOString(),
          updatedAt: escrow.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation error", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}




