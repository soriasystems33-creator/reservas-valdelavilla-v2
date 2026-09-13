const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://smwmfutnaiwmzsymwhmu.supabase.co';
const supabaseKey = 'sb_publishable_FPn5qkmxLo_I-CPXZVn3hQ_fxjz4jMc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const testData = {
    date: '2026-07-20',
    time: '21:00',
    pax: 2,
    adults: 2,
    children: 0,
    zone: 'interior',
    meal: 'cena',
    client_name: 'Test Client',
    phone: '123456789',
    notes: 'Test notes',
    email: 'test@example.com',
    status: 'confirmed',
    source: 'web',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log("Attempting to insert test booking...");
  const { data, error } = await supabase
    .from('appointments')
    .insert([testData]);

  if (error) {
    console.error("Supabase Error:", error);
  } else {
    console.log("Success! Inserted row:", data);
  }
}

run();
