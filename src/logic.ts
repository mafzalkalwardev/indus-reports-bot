import { sendMail, type TaskContext, type TaskResult } from '@indus/bot-core';

export function digestMarkdown(lines: string[], pending: number, now: Date): { title: string; markdown: string } {
  const day = now.toISOString().slice(0, 10);
  const title = `INDUS Ops digest — ${day}`;
  const markdown = [`# ${title}`, '', `Approvals waiting: ${pending}.`, '', ...lines.map((line) => `- ${line}`), ''].join('\n');
  return { title, markdown };
}

export async function run(ctx: TaskContext): Promise<TaskResult> {
  if (ctx.task === 'instruct') {
    const reply = await ctx.llm('You write a short INDUS digest. Do not claim mail was sent.', String(ctx.payload.message || ''));
    return { summary: reply.text.slice(0, 280) };
  }
  const headers = { authorization: `Bearer ${process.env.INDUS_BOT_TOKEN || 'dev-bot-token'}` };
  const hub = process.env.HUB_URL || 'http://127.0.0.1:41731';
  const lines: string[] = [];
  let pending = 0;
  try {
    const fleet = await fetch(new URL('/api/internal/fleet', hub), { headers, signal: AbortSignal.timeout(3000) });
    const bots = fleet.ok ? ((await fleet.json()) as { bots: { id: string; base_url: string; name: string }[] }).bots : [];
    for (const bot of bots) {
      if (bot.id === 'reports') continue;
      try {
        const stateRes = await fetch(new URL('/api/internal/state', bot.base_url), { headers, signal: AbortSignal.timeout(2500) });
        if (!stateRes.ok) { lines.push(`${bot.name}: no state`); continue; }
        const state = await stateRes.json() as { lastSummary?: string; pendingApprovals?: number; status?: string };
        pending += state.pendingApprovals || 0;
        lines.push(`${bot.name}: ${state.status || 'idle'} — ${state.lastSummary || 'no run yet'}`);
      } catch { lines.push(`${bot.name}: unreachable`); }
    }
  } catch { lines.push('Hub was not reachable.'); }
  const digest = digestMarkdown(lines, pending, ctx.now);
  ctx.db.exec(`CREATE TABLE IF NOT EXISTS digests (id INTEGER PRIMARY KEY, title TEXT, body TEXT, created_at TEXT)`);
  ctx.db.prepare(`INSERT INTO digests (title, body, created_at) VALUES (?, ?, ?)`).run(digest.title, digest.markdown, ctx.now.toISOString());
  const to = String(ctx.settings.recipient || '');
  if (to && ctx.settings.emailDigest && !ctx.dryRun) {
    try {
      await sendMail({
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === '1',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || '',
      }, { to, subject: digest.title, text: digest.markdown });
    } catch (error) {
      ctx.log('warn', error instanceof Error ? error.message : String(error));
    }
  }
  return { summary: digest.title, details: { markdown: digest.markdown } };
}
