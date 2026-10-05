// === ШАБЛОН КОНФИГУРАЦИИ ===
// Скопируйте этот файл как config.js и укажите свои ключи от Supabase:
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-public-key-here";
const OPERATOR_PIN = "7788";

const { createClient } = supabase;
const clientDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminDb = clientDb;