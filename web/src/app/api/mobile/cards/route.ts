import { NextRequest, NextResponse } from 'next/server';
import sql from '@/db/schema';

async function verifyGoogleToken(accessToken: string): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, email: data.email, name: data.name };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('x-google-token');
  if (!token) return NextResponse.json([], { status: 401 });

  const user = await verifyGoogleToken(token);
  if (!user) return NextResponse.json([], { status: 401 });

  // Ensure user exists in DB
  await sql`
    INSERT INTO users (id, email, name) VALUES (${user.id}, ${user.email}, ${user.name})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  `;

  const cards = await sql`
    SELECT c.* FROM cards c
    JOIN user_cards uc ON uc.card_id = c.id
    WHERE uc.user_id = ${user.id}
    ORDER BY c.issuer, c.name
  `;
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-google-token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyGoogleToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  await sql`INSERT INTO user_cards (user_id, card_id) VALUES (${user.id}, ${cardId}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('x-google-token');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await verifyGoogleToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  await sql`DELETE FROM user_cards WHERE user_id = ${user.id} AND card_id = ${cardId}`;
  return NextResponse.json({ ok: true });
}
