import { expect, it } from 'vitest';
import { digestMarkdown } from '../src/logic';

it('includes the fleet in the digest', () => {
  const digest = digestMarkdown(['Monitor: idle'], 2, new Date('2026-11-10T00:00:00.000Z'));
  expect(digest.title).toContain('2026-11-10');
  expect(digest.markdown).toContain('Approvals waiting: 2');
  expect(digest.markdown).toContain('Monitor: idle');
});
