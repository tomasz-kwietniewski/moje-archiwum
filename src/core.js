// Naming rules are implemented in JS (extension, migration), C# (Windows host) and Java (Android).
// All three are checked against tests/vectors/rules.tsv - change the vectors together with the code.
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
// A name must fit the 255-byte limit of Linux/NAS file systems even with "_10000" and "_assets".
const MAX_TITLE_CHARS = 120, MAX_TITLE_BYTES = 180;
// Windows MAX_PATH without the terminating NUL; the reserve covers "_10000" + "_assets\001.webp".
const MAX_PATH = 259, PATH_RESERVE = 22, MIN_BASENAME = 20;
const utf8Length = text => new TextEncoder().encode(text).length;
export function safeTitle(value) {
 // The ASCII apostrophe becomes the typographic one: Synology Drive skips paths with ' (2026-09-27).
 let name=String(value || '').normalize('NFC').replace(/'/g, '\u2019').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
 const chars=Array.from(name).slice(0,MAX_TITLE_CHARS);
 while(utf8Length(chars.join(''))>MAX_TITLE_BYTES) chars.pop();
 name=chars.join('').replace(/[. ]+$/g,'') || 'Bez tytułu';
 return reserved.test(name) ? '_'+name : name;
}
export function fitBasename(directoryLength, basename) {
 const max=MAX_PATH-(directoryLength+1)-PATH_RESERVE;
 if(max<MIN_BASENAME) throw new Error('Ścieżka folderu tematu jest zbyt długa.');
 if(basename.length<=max) return basename;
 let cut=basename.slice(0,max);
 if(/[\uD800-\uDBFF]$/.test(cut)) cut=cut.slice(0,-1);
 return cut.replace(/[. ]+$/g,'');
}
export function datePrefix(date=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=t=>parts.find(p=>p.type===t).value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
export function validateTopic(value) {
 const name=String(value);
 if(!name.trim() || name!==name.trim() || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name) || reserved.test(name) || name==='_resources' || name.startsWith('.') || name.length>100)
  throw new Error('Podaj nazwę tematu bez ukośników i znaków niedozwolonych w Windows (maks. 100 znaków).');
 return name;
}
export function makeMarkdown({title,url,body,date=new Date()}) {
 if(!body?.trim()) throw new Error('Notatka jest pusta. Wybierz tryb „Cała strona” lub uzupełnij treść.');
 const q=JSON.stringify;
 return ['---','title: '+q(title.trim() || 'Bez tytułu'),'created: '+q(date.toISOString()),'updated: '+q(date.toISOString()),'source: '+q(url),'---','',body.trim(),''].join('\n');
}
