const fs = require('fs');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const pin = process.env.OPERATOR_PIN || '7788';

const content = `// Автоматически сгенерировано Vercel при сборке
const SUPABASE_URL = "${url}";
const SUPABASE_ANON_KEY = "${key}";
const OPERATOR_PIN = "${pin}";

const { createClient } = supabase;
const clientDb = (SUPABASE_URL && SUPABASE_ANON_KEY) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const adminDb = clientDb;
`;

if (!fs.existsSync('js')) fs.mkdirSync('js');
fs.writeFileSync('js/config.js', content);
console.log('✅ js/config.js успешно сгенерирован из переменных окружения Vercel!');