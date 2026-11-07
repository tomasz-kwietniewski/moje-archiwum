// Readability keeps the long description of a job offer and drops the short header above it,
// which is where pay, contract type and work mode live. This module reads those facts from the
// schema.org JobPosting data many job boards publish, plus the visible header of Pracuj.pl,
// which is the only place that states the work mode.

const TIME_ZONE='Europe/Warsaw';
const MAX_VALUE=300;
const PERIODS={HOUR:'godz.',DAY:'dzień',WEEK:'tydz.',MONTH:'mies.',YEAR:'rok'};

// Page text ends up inside the note, and images linked from a note are downloaded when it is
// saved, so a value must never be able to form a link, an image or an HTML tag.
function plain(value) {
 if(value===null || value===undefined) return '';
 return String(value)
  .replace(/[–—−]/g,'-')
  .replace(/\s+/g,' ')
  .trim()
  .slice(0,MAX_VALUE)
  .replace(/[\\`[\]<>]/g,'\\$&');
}

function text(element) {
 return element ? String(element.innerText ?? element.textContent ?? '') : '';
}

function isJobPosting(item) {
 const type=item?.['@type'];
 return (Array.isArray(type) ? type : [type]).includes('JobPosting');
}

function searchPostings(item) {
 if(Array.isArray(item)) return item.map(searchPostings).find(Boolean) || null;
 if(!item || typeof item!=='object') return null;
 if(isJobPosting(item)) return item;
 return searchPostings(item['@graph']);
}

export function findJobPosting(doc) {
 for(const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
  try {
   const found=searchPostings(JSON.parse(script.textContent));
   if(found) return found;
  } catch { /* Broken data on a page is not a reason to lose the note. */ }
 }
 return null;
}

export function localDate(value,timeZone=TIME_ZONE) {
 if(!value) return '';
 const date=new Date(value);
 if(Number.isNaN(date.getTime())) return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=type=>parts.find(entry=>entry.type===type).value;
 return part('year')+'-'+part('month')+'-'+part('day');
}

function salaryFromPosting(posting) {
 const base=posting?.baseSalary;
 if(!base || typeof base!=='object') return '';
 const amount=base.value && typeof base.value==='object' ? base.value : base;
 const positive=number=>Number.isFinite(Number(number)) && Number(number)>0 ? Number(number) : 0;
 const min=positive(amount.minValue);
 const max=positive(amount.maxValue) || positive(typeof amount.value==='object' ? 0 : amount.value);
 if(!min && !max) return '';
 const range=min && max && min!==max ? min+'-'+max : String(max || min);
 const period=PERIODS[String(amount.unitText || base.unitText || '').toUpperCase()];
 return [range,base.currency,period ? '/ '+period : ''].filter(Boolean).join(' ');
}

function placeFromPosting(posting) {
 const location=Array.isArray(posting?.jobLocation) ? posting.jobLocation[0] : posting?.jobLocation;
 const address=location?.address;
 if(!address || typeof address!=='object') return '';
 return [address.streetAddress,address.addressLocality].filter(Boolean).join(', ');
}

function contractFromPosting(posting) {
 const type=posting?.employmentType;
 return Array.isArray(type) ? type.join(', ') : type;
}

function organizationName(posting) {
 const organization=posting?.hiringOrganization;
 return typeof organization==='string' ? organization : organization?.name;
}

function remoteFromPosting(posting) {
 return posting?.jobLocationType==='TELECOMMUTE' ? 'praca zdalna' : '';
}

// Facts shown in the Pracuj.pl header. Absent on every other site, so nothing here can misfire.
function pracujHeader(doc) {
 const badge=(selector)=>{
  const element=doc.querySelector('[data-test'+selector+']');
  return text(element?.querySelector('[data-test="offer-badge-title"]') || element);
 };
 const salaries=[...doc.querySelectorAll('[data-test="section-salaryPerContractType"]')]
  .map(element=>plain(text(element))).filter(Boolean);
 return {
  salary:salaries.join('; ') || plain(text(doc.querySelector('[data-test="section-salary"]'))),
  contract:badge('="sections-benefit-contracts"'),
  // The workplace badge has the region on a second line.
  place:badge('="sections-benefit-workplaces"').split('\n')[0],
  schedule:badge('="sections-benefit-work-schedule"'),
  level:badge('="sections-benefit-employment-type-name"'),
  mode:badge('^="sections-benefit-work-modes"')
 };
}

export function jobOfferBlock(doc) {
 const posting=findJobPosting(doc);
 const header=pracujHeader(doc);
 const rows=[
  ['Firma',organizationName(posting)],
  ['Wynagrodzenie',header.salary || salaryFromPosting(posting)],
  ['Umowa',contractFromPosting(posting) || header.contract],
  ['Etat',header.schedule],
  ['Poziom',header.level],
  ['Tryb',header.mode || remoteFromPosting(posting)],
  ['Miejsce',placeFromPosting(posting) || header.place],
  ['Opublikowana',localDate(posting?.datePosted)],
  ['Ważna do',localDate(posting?.validThrough)]
 ].map(([label,value])=>[label,plain(value)]).filter(([,value])=>value);
 // A company name alone says nothing the title does not, and is no sign of a job offer.
 if(!rows.some(([label])=>label!=='Firma')) return '';
 return '## Dane oferty\n\n'+rows.map(([label,value])=>'- '+label+': '+value).join('\n');
}
