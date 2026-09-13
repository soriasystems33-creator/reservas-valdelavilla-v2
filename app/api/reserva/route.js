import { db } from '../../../lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const doc = await db.collection('appointments').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const data = doc.data();

    // Validar si el estado es cancelado
    if (data.status === 'cancelled' || data.status === 'noshow') {
      return NextResponse.json({ error: 'Esta reserva ya no se puede modificar' }, { status: 403 });
    }

    return NextResponse.json({
      id: doc.id,
      ...data
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ error: 'Error al recuperar la reserva' }, { status: 500 });
  }
}
