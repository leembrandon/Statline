import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://snucfaofcihjazipvird.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNudWNmYW9mY2loamF6aXB2aXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODYzODEsImV4cCI6MjA4OTI2MjM4MX0.nEjx1Lx4i2oruPajbrKwILX5AK1PBfmMqx5PaCL--nQ";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to fetch with error handling
export async function query(table, options = {}) {
  let q = supabase.from(table).select(options.select || "*");

  if (options.eq) {
    for (const [key, val] of Object.entries(options.eq)) {
      q = q.eq(key, val);
    }
  }
  if (options.order) {
    q = q.order(options.order.column, {
      ascending: options.order.ascending ?? true,
    });
  }
  if (options.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
