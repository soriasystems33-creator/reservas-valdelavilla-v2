import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase-admin';

function getMadridTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

function isPastCutoff(dateStr, cutoffTime) {
  const [ch, cm] = cutoffTime.split(':').map(Number);
  const cutoffMinutes = ch * 60 + cm;
  const madridNow = getMadridTime();
  const nowMinutes = madridNow.getHours() * 60 + madridNow.getMinutes();
  return nowMinutes >= cutoffMinutes;
}

function formatMadridDate() {
  const madridNow = getMadridTime();
  const y = madridNow.getFullYear();
  const m = String(madridNow.getMonth() + 1).padStart(2, '0');
  const d = String(madridNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayStr() {
  return formatMadridDate();
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { date, time, pax, adults, children, zone, clientName: clientNameRaw, phone, notes, email, name } = body;
    const clientName = clientNameRaw || name;

    if (!date || !time || !pax || !zone || !clientName || !phone || !email) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Leer settings para cutoff
    const settingsDoc = await db.doc('settings/main').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const specialDays = settings.specialDays || {};
    const today = todayStr();
    const meal = body.meal || 'comida';
    
    const defaultCutoff = meal === 'comida' ? '12:30' : '20:00';
    const effectiveCutoff = defaultCutoff;

    if (date === today && isPastCutoff(today, effectiveCutoff)) {
      return NextResponse.json({ error: 'Ya pasó la hora límite para reservar hoy.' }, { status: 403 });
    }

    const timesToBook = [time];
    const docRefs = [];

    for (const t of timesToBook) {
      const reservaData = {
        date,
        time: t,
        pax: Number(pax),
        adults: adults !== undefined ? Number(adults) : Number(pax),
        children: children !== undefined ? Number(children) : 0,
        zone,
        meal: parseInt(t.split(':')[0], 10) >= 17 ? 'cena' : 'comida',
        clientName,
        phone,
        notes: notes || '',
        email,
        status: 'confirmed',
        source: 'web',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await db.collection('appointments').add(reservaData);
      docRefs.push(docRef.id);

      const webhookUrl = process.env.WEBHOOK_URL;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'new',
              id: docRef.id,
              ...reservaData,
            }),
          });
        } catch (webhookError) {
          console.error('Webhook error (no crítico):', webhookError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      id: docRefs[0],
      message: 'Reserva creada correctamente',
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, date, time, pax, adults, children, zone, clientName: clientNameRaw, phone, notes, name } = body;
    const clientName = clientNameRaw || name;

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const settingsDoc = await db.doc('settings/main').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const specialDays = settings.specialDays || {};
    const today = todayStr();
    const docRef = db.collection('appointments').doc(id);
    const doc = await docRef.get();
    const existing = doc.exists ? doc.data() : {};
    const meal = body.meal || existing.meal || 'comida';
    
    const defaultCutoff = meal === 'comida' ? '12:30' : '20:00';
    const effectiveCutoff = defaultCutoff;

    if (date === today && isPastCutoff(today, effectiveCutoff)) {
      return NextResponse.json({ error: 'Ya pasó la hora límite para modificar reservas hoy.' }, { status: 403 });
    }

    if (!doc.exists) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const updateData = {};
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (pax) updateData.pax = Number(pax);
    if (adults !== undefined) updateData.adults = Number(adults);
    if (children !== undefined) updateData.children = Number(children);
    if (zone) updateData.zone = zone;
    if (clientName) updateData.clientName = clientName;
    if (phone) updateData.phone = phone;
    if (notes !== undefined) updateData.notes = notes;
    if (meal) updateData.meal = meal;
    updateData.updatedAt = new Date().toISOString();

    await docRef.update(updateData);

    const existingData = doc.data();
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'modification',
            id,
            email: existingData.email || '',
            clientName: existingData.clientName || '',
            ...updateData,
          }),
        });
      } catch (e) {}
    }

    return NextResponse.json({ success: true, message: 'Reserva actualizada correctamente' });
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json({ error: 'Error al actualizar la reserva' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const docRef = db.collection('appointments').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const existingData = doc.data();
    const resDate = existingData.date;
    const meal = existingData.meal || 'comida';

    const settingsDoc = await db.doc('settings/main').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const specialDays = settings.specialDays || {};
    const today = todayStr();
    
    const defaultCutoff = meal === 'comida' ? '12:30' : '20:00';
    const effectiveCutoff = defaultCutoff;

    if (resDate === today && isPastCutoff(today, effectiveCutoff)) {
      return NextResponse.json({ error: 'Ya pasó la hora límite para cancelar reservas hoy.' }, { status: 403 });
    }

    await docRef.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'cancellation',
            id,
            ...existingData,
            status: 'cancelled',
          }),
        });
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
      }
    }

    

    return NextResponse.json({ success: true, message: 'Reserva cancelada' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return NextResponse.json({ error: 'Error al cancelar la reserva' }, { status: 500 });
  }
}



export const dynamic = 'force-dynamic';
