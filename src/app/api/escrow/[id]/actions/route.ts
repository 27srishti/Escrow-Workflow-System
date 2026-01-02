/**
 * POST /api/escrow/[id]/actions - Perform an action on an escrow
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { escrowStore } from "@/storage/escrow-store";
import { applyAction } from "@/domain/escrow";
import { performActionSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const validated = performActionSchema.parse(body);

    // Get escrow
    const escrowData = escrowStore.getById(id);
    if (!escrowData) {
      return NextResponse.json(
        { success: false, error: "Escrow not found" },
        { status: 404 }
      );
    }

    // Apply action
    const result = applyAction(
      {
        id: escrowData.id,
        buyerId: escrowData.buyerId,
        sellerId: escrowData.sellerId,
        amount: escrowData.amount,
        description: escrowData.description,
        currentState: escrowData.currentState,
        createdAt: escrowData.createdAt,
        updatedAt: escrowData.updatedAt,
      },
      validated.action,
      validated.performedBy,
      validated.userRole,
      validated.reason
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Update store
    escrowStore.update(result.newEscrow!, result.event!);

    return NextResponse.json({
      success: true,
      escrow: {
        id: result.newEscrow!.id,
        buyerId: result.newEscrow!.buyerId,
        sellerId: result.newEscrow!.sellerId,
        amount: result.newEscrow!.amount,
        description: result.newEscrow!.description,
        currentState: result.newEscrow!.currentState,
        createdAt: result.newEscrow!.createdAt.toISOString(),
        updatedAt: result.newEscrow!.updatedAt.toISOString(),
      },
      event: {
        ...result.event!,
        timestamp: result.event!.timestamp.toISOString(),
      },
    });
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




