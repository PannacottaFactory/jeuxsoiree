import { describe, expect, it } from 'vitest';
import { serializeLd, faqLd } from './jsonld';

describe('serializeLd', () => {
  it('neutralise les balises fermantes pour éviter une injection dans <script>', () => {
    const out = serializeLd(faqLd([{ question: 'a</script><script>alert(1)', answer: 'b' }]));
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).mainEntity[0].name).toBe('a</script><script>alert(1)');
  });
});
