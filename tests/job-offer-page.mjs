import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium} from 'playwright';

const description='Opis obowiązków, który czytelnik chce zachować w notatce o ofercie pracy. '.repeat(15);
const posting={
 '@type':'JobPosting',
 hiringOrganization:{name:'Przykładowa Firma'},
 baseSalary:{currency:'PLN',minValue:7000,maxValue:8000,value:8000},
 employmentType:'umowa o pracę',
 datePosted:'2026-10-07T09:00:00Z',
 validThrough:'2026-12-02T22:59:59Z',
 jobLocation:{address:{streetAddress:'Testowa 1',addressLocality:'Warszawa'}}
};
const badge=(name,lines)=>`<li data-test="${name}"><div data-test="offer-badge-title">${lines}</div></li>`;
const header=`<div data-test="section-offerHeader"><h1>Oferta</h1>
 <div data-test="section-salary"><div data-test="section-salaryPerContractType">
  <div data-test="text-earningAmount">7 000 – 8 000 zł</div><div>brutto / mies. | umowa o pracę</div>
 </div></div>
 <ul data-test="sections-benefit-list">
  ${badge('sections-benefit-workplaces','<div>Testowa 1, Warszawa</div><div>mazowieckie</div>')}
  ${badge('sections-benefit-work-schedule','pełny etat')}
  ${badge('sections-benefit-work-modes-hybrid','praca hybrydowa')}
 </ul></div>`;

const browser=await chromium.launch({headless:true});
const capture=async(address,head,body)=>{
 const page=await browser.newPage();
 await page.route(address,route=>route.fulfill({contentType:'text/html; charset=utf-8',
  body:`<!doctype html><html><head><title>Tytuł</title>${head}</head><body>${body}<article><p>${description}</p></article></body></html>`}));
 await page.goto(address);
 await page.addScriptTag({path:path.resolve('dist/capture.js')});
 return page.evaluate(()=>globalThis.__captureMarkdownPage());
};
try {
 const ld=`<script type="application/ld+json">${JSON.stringify(posting)}</script>`;
 const offer=await capture('http://clipper.test/oferta',ld,header);
 for(const mode of ['body','full']) {
  assert.ok(offer[mode].startsWith('## Dane oferty\n\n- Firma: Przykładowa Firma\n'),mode+': blok ma być na początku notatki');
  assert.match(offer[mode],/- Wynagrodzenie: 7 000 - 8 000 zł brutto \/ mies\. \| umowa o pracę\n/);
  assert.match(offer[mode],/- Etat: pełny etat\n/);
  assert.match(offer[mode],/- Tryb: praca hybrydowa\n/);
  assert.match(offer[mode],/- Ważna do: 2026-12-02\n/);
 }
 assert.match(offer.body,/Opis obowiązków/,'opis oferty zostaje w notatce');
 assert.equal(offer.extracted,true);

 const article=await capture('http://clipper.test/artykul','','');
 assert.doesNotMatch(article.body+article.full,/Dane oferty/,'zwykły artykuł nie dostaje bloku');
 console.log('PASS: oferta pracy dostaje blok „Dane oferty”, zwykły artykuł nie.');
} finally {
 await browser.close();
}
