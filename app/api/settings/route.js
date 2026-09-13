import { db } from '../../../lib/supabase-admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const doc = await db.doc('settings/main').get();
    if (!doc.exists) {
      return NextResponse.json({ shiftTemplates: [], defaultTemplateId: '', specialDays: {}, cutoffTime: '12:30' });
    }
    const data = doc.data();
    // Solo devolvemos lo necesario para el formulario público
    return NextResponse.json({
      shiftTemplates: data.shiftTemplates || [],
      defaultTemplateId: data.defaultTemplateId || '',
      specialDays: data.specialDays || {},
      cutoffTime: data.cutoffTime || '12:30',
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
