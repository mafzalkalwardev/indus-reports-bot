import { createBotService } from '@indus/bot-core';
import { run } from './logic';

createBotService({
  id: 'reports',
  name: 'Reports',
  description: 'A daily digest of the fleet, shown here and emailed only if you turn that on.',
  accent: '#d4c4a8',
  defaultPort: 41746,
  capabilities: ['digest'],
  defaultSettings: { emailDigest: false, recipient: '' },
  fields: [
    { key: 'emailDigest', label: 'Email the digest', type: 'bool' },
    { key: 'recipient', label: 'Recipient', type: 'text' },
  ],
  desired: [{ key: 'digest', task: 'digest', cron: '15 7 * * *', group: 'llm' }],
  autoTask: 'digest',
  collect: (deps) => {
    deps.db.exec(`CREATE TABLE IF NOT EXISTS digests (id INTEGER PRIMARY KEY, title TEXT, body TEXT, created_at TEXT)`);
    return { latest: deps.db.prepare(`SELECT title, body, created_at FROM digests ORDER BY id DESC LIMIT 1`).get() || null };
  },
  runTask: run,
}).start().catch((error) => { console.error(error); process.exit(1); });
