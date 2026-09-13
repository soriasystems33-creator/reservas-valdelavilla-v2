import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Mapeo bidireccional de campos (camelCase javascript a snake_case postgresql)
function mapFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const mapped = {};
  for (const key in obj) {
    const dbKey = key === 'clientName' ? 'client_name' :
                  key === 'minSeats' ? 'min_seats' :
                  key === 'groupId' ? 'group_id' :
                  key === 'isStool' ? 'is_stool' :
                  key === 'isOccupied' ? 'is_occupied' :
                  key === 'reservationId' ? 'reservation_id' :
                  key === 'createdAt' ? 'created_at' :
                  key === 'updatedAt' ? 'updated_at' :
                  key === 'orderItems' ? 'order_items' :
                  key === 'orderSent' ? 'order_sent' :
                  key === 'orderIndex' ? 'order_index' :
                  key === 'reviewProcessed' ? 'review_processed' :
                  key === 'reviewArchived' ? 'review_archived' : key;
    mapped[dbKey] = obj[key];
  }
  return mapped;
}

function unmapFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const unmapped = {};
  for (const key in obj) {
    const jsKey = key === 'client_name' ? 'clientName' :
                  key === 'min_seats' ? 'minSeats' :
                  key === 'group_id' ? 'groupId' :
                  key === 'is_stool' ? 'isStool' :
                  key === 'is_occupied' ? 'isOccupied' :
                  key === 'reservation_id' ? 'reservationId' :
                  key === 'created_at' ? 'createdAt' :
                  key === 'updated_at' ? 'updatedAt' :
                  key === 'order_items' ? 'orderItems' :
                  key === 'order_sent' ? 'orderSent' :
                  key === 'order_index' ? 'orderIndex' :
                  key === 'review_processed' ? 'reviewProcessed' :
                  key === 'review_archived' ? 'reviewArchived' : key;
    unmapped[jsKey] = obj[key];
  }
  return unmapped;
}

export const db = {
  collection: (collectionName) => {
    return {
      where: (field, op, value) => {
        return {
          get: async () => {
            let query = supabase.from(collectionName).select('*');
            if (op === '==') {
              const dbField = mapFields({ [field]: null });
              const mappedField = Object.keys(dbField)[0];
              query = query.eq(mappedField, value);
            }
            const { data, error } = await query;
            if (error) console.error("Error in where query", collectionName, error);
            
            return {
              docs: (data || []).map(item => ({
                id: item.id,
                data: () => unmapFields(item)
              }))
            };
          }
        };
      },
      add: async (data) => {
        const { data: inserted, error } = await supabase
          .from(collectionName)
          .insert([mapFields(data)])
          .select();
        if (error) {
          console.error("Error adding to collection", collectionName, error);
          throw error;
        }
        return {
          id: inserted && inserted.length > 0 ? inserted[0].id : null
        };
      },
      doc: (docId) => {
        return {
          get: async () => {
            const { data, error } = await supabase
              .from(collectionName)
              .select('*')
              .eq('id', docId)
              .single();
            
            return {
              exists: !error && !!data,
              id: docId,
              data: () => unmapFields(data || {})
            };
          },
          update: async (updates) => {
            const { error } = await supabase
              .from(collectionName)
              .update(mapFields(updates))
              .eq('id', docId);
            if (error) {
              console.error("Error updating doc", collectionName, docId, error);
              throw error;
            }
          }
        };
      }
    };
  },
  doc: (docPath) => {
    const parts = docPath.split('/');
    const tableName = parts[0];
    const docId = parts[1];
    
    return {
      get: async () => {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', docId)
          .single();
        
        return {
          exists: !error && !!data,
          data: () => data?.data || {}
        };
      },
      set: async (data) => {
        const { error } = await supabase
          .from(tableName)
          .upsert({ id: docId, data: data });
        if (error) {
          console.error("Error setting doc", docPath, error);
          throw error;
        }
      },
      update: async (updates) => {
        const { data: current } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', docId)
          .single();
        
        const merged = Object.assign({}, current?.data || {}, updates);
        const { error } = await supabase
          .from(tableName)
          .update({ data: merged })
          .eq('id', docId);
          
        if (error) {
          console.error("Error updating doc", docPath, error);
          throw error;
        }
      }
    };
  }
};
