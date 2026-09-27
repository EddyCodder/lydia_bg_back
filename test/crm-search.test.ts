// LYD-60: npx tsx --test test/crm-search.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSnippet,
  escapeLike,
  normalizeSearchLimit,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
} from '../src/api/services/crm-search.util';

describe('escapeLike', () => {
  it('escapa comodines de LIKE y la barra invertida', () => {
    assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\');
  });

  it('no toca texto normal', () => {
    assert.equal(escapeLike('matricula ingles'), 'matricula ingles');
  });
});

describe('normalizeSearchLimit', () => {
  it('usa el default si no viene o es invalido', () => {
    assert.equal(normalizeSearchLimit(undefined), SEARCH_DEFAULT_LIMIT);
    assert.equal(normalizeSearchLimit('abc'), SEARCH_DEFAULT_LIMIT);
    assert.equal(normalizeSearchLimit('0'), SEARCH_DEFAULT_LIMIT);
    assert.equal(normalizeSearchLimit('-5'), SEARCH_DEFAULT_LIMIT);
  });

  it('respeta el valor pedido con tope maximo', () => {
    assert.equal(normalizeSearchLimit('20'), 20);
    assert.equal(normalizeSearchLimit('9999'), SEARCH_MAX_LIMIT);
  });
});

describe('buildSnippet', () => {
  it('devuelve el texto entero si es corto', () => {
    assert.equal(buildSnippet('Hola, cuanto cuesta el curso?', 'cuesta'), 'Hola, cuanto cuesta el curso?');
  });

  it('recorta alrededor de la coincidencia con elipsis', () => {
    const text = `${'a'.repeat(100)} precio del curso ${'b'.repeat(200)}`;
    const snippet = buildSnippet(text, 'PRECIO', 10, 20);
    assert.ok(snippet.startsWith('…'));
    assert.ok(snippet.endsWith('…'));
    assert.ok(snippet.toLowerCase().includes('precio'));
    assert.ok(snippet.length <= 10 + 'precio'.length + 20 + 2);
  });

  it('colapsa saltos de linea y espacios', () => {
    assert.equal(buildSnippet('hola\n\n  mundo', 'mundo'), 'hola mundo');
  });

  it('cae al inicio del texto si no hay coincidencia literal', () => {
    const text = 'x'.repeat(300);
    const snippet = buildSnippet(text, 'zz', 10, 20);
    assert.equal(snippet, `${'x'.repeat(30)}…`);
  });
});
