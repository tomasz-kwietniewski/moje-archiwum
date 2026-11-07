import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { jobOfferBlock } from './job-offer.js';

globalThis.__captureMarkdownPage = () => {
 if(!/^https?:$/.test(location.protocol)) throw new Error('Otwórz zwykłą stronę internetową (HTTP lub HTTPS).');
 const clone=document.cloneNode(true);
 const originals=[...document.querySelectorAll('img')];
 const imageSources=new WeakMap();
 const MAX_ICON=48;
 const small=(width,height)=>width>0 && height>0 && width<=MAX_ICON && height<=MAX_ICON;
 clone.querySelectorAll('img').forEach((img,index)=>{
  const original=originals[index];
  const loaded=original?.currentSrc || '';
  const lazy=original?.getAttribute('data-src') || original?.getAttribute('data-original') || '';
  const selected=loaded && !loaded.startsWith('data:') ? loaded : lazy || original?.getAttribute('src') || '';
  // Share buttons, logos and tracking pixels are not article content. Natural size is only
  // trusted for the image actually shown, not for a lazy-loading placeholder.
  const icon=selected===loaded && original?.naturalWidth>0 ? small(original.naturalWidth,original.naturalHeight)
   : small(Number(original?.getAttribute('width')),Number(original?.getAttribute('height')));
  imageSources.set(img,icon ? '' : selected);
 });
 clone.querySelectorAll('script,style,noscript,iframe,object,embed,form,input,button,select,textarea,[hidden],[aria-hidden="true"]').forEach(e=>e.remove());
 // Resolve relative links while the source document URL is still available.
 clone.querySelectorAll('a[href]').forEach(a=>{
  try {
   const url=new URL(a.getAttribute('href'),document.baseURI);
   if(['http:','https:','mailto:','tel:'].includes(url.protocol)) a.setAttribute('href',url.href);
   else a.removeAttribute('href');
  } catch { a.removeAttribute('href'); }
 });
 clone.querySelectorAll('img').forEach(img=>{
  const src=imageSources.get(img) || '';
  try {
   const url=new URL(src,document.baseURI);
   if(!['http:','https:'].includes(url.protocol) || !src) img.remove();
   else {img.setAttribute('src',url.href);img.removeAttribute('srcset');}
  } catch { img.remove(); }
 });
 // Links left without text or image (social icons removed above) would become empty "[](...)".
 clone.querySelectorAll('a').forEach(a=>{if(!a.textContent.trim() && !a.querySelector('img')) a.remove();});
 const converter=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
 converter.use(gfm);
 converter.remove(['script','style','noscript','iframe','form']);
 const article=new Readability(clone.cloneNode(true),{charThreshold:120}).parse();
 const main=clone.querySelector('main,[role="main"],article') || clone.body;
 let full=converter.turndown(clone.body?.innerHTML || '').trim();
 let body=converter.turndown(article?.content || main?.innerHTML || '').trim();
 // Some publishers place the lead photo beside the article rather than inside it.
 const lead=[...clone.querySelectorAll('figure[class*="main-image" i] img, figure[class*="hero" i] img, figure[class*="lead" i] img, figure[class*="featured" i] img')]
  .find(img=>!img.closest('aside,nav,footer'));
 const leadSrc=lead?.getAttribute('src') || '';
 if(leadSrc && !body.includes(leadSrc)) {
  const leadMarkdown=converter.turndown(lead.outerHTML).trim();
  if(leadMarkdown) body=leadMarkdown+'\n\n'+body;
 }
 // Read from the live document: the clone has lost its scripts, and with them the JobPosting data.
 const offer=jobOfferBlock(document);
 if(offer) {
  body=offer+'\n\n'+body;
  full=offer+'\n\n'+full;
 }
 if(body.length+full.length>2500000) throw new Error('Ta strona jest zbyt duża. Wybierz krótszą podstronę.');
 if(!body && !full) throw new Error('Na tej stronie nie znaleziono treści do zapisania.');
 // Soft hyphens (rp.pl puts them inside words) are invisible, but a note with "Grec\u00adki" is not found
 // when searching the archive for "Grecki". In the title they would also end up in the file name.
 const clean=text=>text.replace(/\u00ad/g,'');
 return {title:clean(article?.title || document.title || location.hostname),url:location.href,body:clean(body),full:clean(full),extracted:Boolean(article),capturedAt:new Date().toISOString()};
};
