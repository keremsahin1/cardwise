import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { getDb } from '@/db/schema';

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const db = getDb();
  const cards = db.prepare(`
    SELECT c.* FROM cards c
    JOIN user_cards uc ON uc.card_id = c.id
    WHERE uc.user_id = ?
    ORDER BY c.issuer, c.name
  `).all(session.user.id);

  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO user_cards (user_id, card_id) VALUES (?, ?)
  `).run(session.user.id, cardId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  const db = getDb();
  db.prepare(`
    DELETE FROM user_cards WHERE user_id = ? AND card_id = ?
  `).run(session.user.id, cardId);

  return NextResponse.json({ ok: true });
}
