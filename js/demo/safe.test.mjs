// Run: node js/demo/safe.test.mjs
import assert from 'node:assert/strict';
import { cleanText, cleanFirstName, cleanPhone, cleanEmail, cleanSocial, cleanCoords, cleanDomain, isSafeHref } from './safe.mjs';

let n = 0;
function test(name, fn) { fn(); n++; console.log('ok  ' + name); }

test('cleanText', () => {
  assert.equal(cleanText('  Chez   Léa \n'), 'Chez Léa');
  assert.equal(cleanText('a' + String.fromCharCode(0x202E) + 'b' + String.fromCharCode(0) + 'c'), 'a b c');
  assert.equal(cleanText('x'.repeat(500), 10).length, 10);
  assert.equal(cleanText(42), '42');
  for (const v of [null, undefined, {}, [], true, NaN]) assert.equal(cleanText(v), '');
  assert.equal(cleanText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');   // kept as TEXT, rendered via textContent
});

test('cleanFirstName', () => {
  assert.equal(cleanFirstName('Noan'), 'Noan');
  assert.equal(cleanFirstName('Jean-Éric'), 'Jean-Éric');
  assert.equal(cleanFirstName('<b>x</b>'), '');
  assert.equal(cleanFirstName('la Mairie de Paris, service officiel'), '');
  assert.equal(cleanFirstName('http://evil.example'), '');
});

test('cleanPhone', () => {
  assert.deepEqual(cleanPhone('02 47 00 00 00'), { display: '02 47 00 00 00', href: 'tel:+33247000000' });
  assert.deepEqual(cleanPhone('+33 2 47 00 00 00'), { display: '02 47 00 00 00', href: 'tel:+33247000000' });
  assert.deepEqual(cleanPhone('0033247000000'), { display: '02 47 00 00 00', href: 'tel:+33247000000' });
  assert.deepEqual(cleanPhone('02.47.00.00.00; 06 00 00 00 00'), { display: '02 47 00 00 00', href: 'tel:+33247000000' });
  assert.equal(cleanPhone('+32 2 555 12 12').href, 'tel:+3225551212');
  for (const bad of ['', '123', 'javascript:alert(1)', '0247000000" onclick="x', '02 47 00 00 00<script>', '1'.repeat(30), null, {}]) {
    assert.equal(cleanPhone(bad), null, String(bad));
  }
});

test('cleanEmail', () => {
  assert.deepEqual(cleanEmail('Contact@Salon-Lea.fr'), { display: 'contact@salon-lea.fr', href: 'mailto:contact@salon-lea.fr' });
  assert.ok(cleanEmail('a.b+c@ex.co.uk'));
  for (const bad of ['', 'x', 'a@b', 'a@@b.fr', 'a@b..fr', 'a..b@c.fr', 'a@b.fr?bcc=x@evil.fr', 'a%0Abcc@b.fr', 'a@b.fr&cc=x', '"><svg>@b.fr', 'javascript:alert(1)@b.fr', null]) {
    assert.equal(cleanEmail(bad), null, String(bad));
  }
});

test('cleanSocial: host allow-list', () => {
  assert.deepEqual(cleanSocial('https://www.instagram.com/salon.lea/', 'ig'), { href: 'https://www.instagram.com/salon.lea/', label: '@salon.lea', network: 'Instagram' });
  assert.equal(cleanSocial('https://instagram.com/monsalon', 'ig').label, '@monsalon');
  assert.equal(cleanSocial('http://www.facebook.com/monsalon', 'fb').href, 'https://www.facebook.com/monsalon');   // upgraded
  assert.equal(cleanSocial('https://fr-fr.facebook.com/pages/x/123?ref=1', 'fb').href, 'https://fr-fr.facebook.com/pages/x/123?ref=1');
  for (const bad of [
    'javascript:alert(1)', 'data:text/html,<script>1</script>', 'JaVaScRiPt://instagram.com/%0Aalert(1)',
    'https://instagram.com.evil.fr/x', 'https://evilinstagram.com/x', 'https://instagram.com@evil.fr/x',
    'https://user:pw@instagram.com/x', 'https://instagram.com:8443/x', 'https://evil.fr/?instagram.com',
    'https://facebook.com/x', '//instagram.com/x', 'instagram.com/x', 'ftp://instagram.com/x', '', null, {},
  ]) assert.equal(cleanSocial(bad, 'ig'), null, String(bad));
  assert.equal(cleanSocial('https://instagram.com/x', 'fb'), null);
  assert.equal(cleanSocial('https://instagram.com/x', 'website'), null);
});

test('cleanCoords', () => {
  assert.deepEqual(cleanCoords(47.39, 0.68), { lat: 47.39, lon: 0.68 });
  assert.deepEqual(cleanCoords('47.39', '0.68'), { lat: 47.39, lon: 0.68 });
  for (const [a, b] of [[null, 1], [91, 0], [0, 0], [1, 181], ['x', 'y'], [NaN, 1], [Infinity, 1], [{}, []], ['', '']]) {
    assert.equal(cleanCoords(a, b), null);
  }
});

test('cleanDomain', () => {
  assert.equal(cleanDomain('Salon-Lea-Tours.FR'), 'salon-lea-tours.fr');
  for (const bad of ['', 'fr', 'a b.fr', '-a.fr', 'a.fr/<script>', 'javascript:alert(1)', 'a'.repeat(70) + '.fr', null]) assert.equal(cleanDomain(bad), '');
});

test('isSafeHref', () => {
  for (const ok of ['https://www.instagram.com/x', 'tel:+33247000000', 'mailto:a@b.fr', '#carte', '#']) assert.equal(isSafeHref(ok), true, ok);
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'http://x.fr', 'tel:1;ext=<x>', 'mailto:a@b.fr?bcc=c@d.fr', ' https://x.fr', 'vbscript:x', '', null]) {
    assert.equal(isSafeHref(bad), false, String(bad));
  }
});

console.log(`\n${n} tests passed`);
