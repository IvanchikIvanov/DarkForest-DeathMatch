import { NextResponse } from 'next/server';
import { OpenGameClient } from '@playdotfun/server-sdk';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gameId = process.env.NEXT_PUBLIC_PLAYFUN_GAME_ID;
  const apiKey = process.env.OGP_API_KEY;
  const secretKey = process.env.OGP_API_SECRET_KEY;

  if (!gameId || !apiKey || !secretKey) {
    return NextResponse.json(
      { error: 'Leaderboard not configured (missing OGP_API_KEY, OGP_API_SECRET_KEY)' },
      { status: 503 }
    );
  }

  try {
    const client = new OpenGameClient({ apiKey, secretKey });
    const data = await client.play.getLeaderboard({ gameId });
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error('[API] leaderboard error:', e);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
