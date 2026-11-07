import test from 'node:test';
import assert from 'node:assert/strict';
import domino from '@mixmark-io/domino';
import {findJobPosting,jobOfferBlock,localDate} from '../src/job-offer.js';

const page=(ld,body='')=>domino.createDocument(`<!doctype html><html><head>${
 ld===null ? '' : `<script type="application/ld+json">${typeof ld==='string' ? ld : JSON.stringify(ld)}</script>`
}</head><body>${body}</body></html>`);

const badge=(name,value)=>`<div data-test="${name}"><div data-test="offer-badge-title">${value}</div></div>`;

const posting={
 '@type':'JobPosting',
 hiringOrganization:{name:'Przykładowa Firma'},
 baseSalary:{currency:'PLN',minValue:7600,maxValue:8200,value:8200},
 employmentType:'umowa o pracę, kontrakt B2B',
 datePosted:'2026-10-07T09:06:29.03Z',
 validThrough:'2026-12-02T22:59:59Z',
 jobLocation:{address:{streetAddress:'Testowa 1',addressLocality:'Warszawa'}}
};

test('oferta z danymi strukturalnymi daje blok ze wszystkimi polami',()=>{
 assert.equal(jobOfferBlock(page(posting)),[
  '## Dane oferty','',
  '- Firma: Przykładowa Firma',
  '- Wynagrodzenie: 7600-8200 PLN',
  '- Umowa: umowa o pracę, kontrakt B2B',
  '- Miejsce: Testowa 1, Warszawa',
  '- Opublikowana: 2026-10-07',
  '- Ważna do: 2026-12-02'
 ].join('\n'));
});

test('nagłówek Pracuj.pl dodaje tryb, etat i poziom oraz ma pierwszeństwo przy wynagrodzeniu',()=>{
 const block=jobOfferBlock(page(posting,
  `<div data-test="section-salary"><div data-test="section-salaryPerContractType">7 600 – 8 200 zł brutto / mies.</div></div>`
  +badge('sections-benefit-work-schedule','pełny etat')
  +badge('sections-benefit-employment-type-name','młodszy specjalista')
  +badge('sections-benefit-work-modes-many','praca stacjonarna, praca hybrydowa')));
 assert.match(block,/- Wynagrodzenie: 7 600 - 8 200 zł brutto \/ mies\.\n/);
 assert.match(block,/- Etat: pełny etat\n/);
 assert.match(block,/- Poziom: młodszy specjalista\n/);
 assert.match(block,/- Tryb: praca stacjonarna, praca hybrydowa\n/);
});

test('kilka wynagrodzeń dla różnych umów trafia do jednego wiersza',()=>{
 const block=jobOfferBlock(page(posting,
  `<div data-test="section-salaryPerContractType">8 000 zł | umowa o pracę</div>`
  +`<div data-test="section-salaryPerContractType">60 zł/godz. | kontrakt B2B</div>`));
 assert.match(block,/- Wynagrodzenie: 8 000 zł \| umowa o pracę; 60 zł\/godz\. \| kontrakt B2B\n/);
});

test('brak kwoty nie tworzy wiersza wynagrodzenia',()=>{
 for(const baseSalary of [null,undefined,{},{currency:'PLN',minValue:0,maxValue:0,value:0}]) {
  const block=jobOfferBlock(page({...posting,baseSalary}));
  assert.doesNotMatch(block,/Wynagrodzenie/);
  assert.match(block,/- Umowa:/);
 }
});

test('wynagrodzenie w standardowym układzie schema.org ma okres',()=>{
 const block=jobOfferBlock(page({...posting,baseSalary:{currency:'PLN',value:{minValue:50,maxValue:50,unitText:'HOUR'}}}));
 assert.match(block,/- Wynagrodzenie: 50 PLN \/ godz\.\n/);
});

test('zwykły artykuł nie dostaje bloku',()=>{
 assert.equal(jobOfferBlock(page(null,'<article><p>Treść</p></article>')),'');
 assert.equal(jobOfferBlock(page({'@type':'NewsArticle',headline:'Tytuł',datePublished:'2026-01-01'})),'');
});

test('sama nazwa firmy nie wystarcza do utworzenia bloku',()=>{
 assert.equal(jobOfferBlock(page({'@type':'JobPosting',hiringOrganization:{name:'Firma'}})),'');
});

test('uszkodzone dane strukturalne nie przerywają zapisu',()=>{
 assert.equal(jobOfferBlock(page('{"@type":"JobPosting",')),'');
});

test('oferta znajduje się także w tablicy, w @graph i przy wielu typach',()=>{
 assert.ok(findJobPosting(page([{'@type':'WebPage'},posting])));
 assert.ok(findJobPosting(page({'@graph':[{'@type':'WebPage'},posting]})));
 assert.ok(findJobPosting(page({...posting,'@type':['Thing','JobPosting']})));
});

test('data jest liczona w czasie polskim, także przy zmianie doby i czasu',()=>{
 assert.equal(localDate('2026-12-02T22:59:59Z'),'2026-12-02');
 assert.equal(localDate('2026-12-02T23:00:00Z'),'2026-12-03');
 assert.equal(localDate('2026-07-14T22:00:00Z'),'2026-07-15');
 assert.equal(localDate('2026-12-02'),'2026-12-02');
 assert.equal(localDate('nie data'),'');
 assert.equal(localDate(''),'');
});

test('tekst ze strony nie może utworzyć obrazu, linku ani znacznika',()=>{
 const block=jobOfferBlock(page({...posting,employmentType:'![x](https://example.test/a.png) [l](https://example.test) <img src=x>'}));
 assert.doesNotMatch(block,/[^\\]\]\(|[^\\]<img/);
 assert.match(block,/- Umowa: !\\\[x\\\]\(https:\/\/example\.test\/a\.png\) \\\[l\\\]\(https:\/\/example\.test\) \\<img src=x\\>\n/);
});

test('wartość jest w jednym wierszu i bez długich myślników',()=>{
 const block=jobOfferBlock(page({...posting,employmentType:'umowa\n- Ważna do: 1999-01-01 — fałsz'}));
 assert.match(block,/- Umowa: umowa - Ważna do: 1999-01-01 - fałsz\n/);
 assert.equal(block.match(/^- Ważna do:/gm).length,1);
});
