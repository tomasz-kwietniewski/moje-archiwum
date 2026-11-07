import {safeTitle,datePrefix,makeMarkdown,validateTopic} from './core.js';
import {nativeMessage} from './native.js';
const $=id=>document.getElementById(id);
let root=null,draft=null,busy=false;
// The topic of the last saved note is offered again, so a series of notes needs no retyping.
const LAST_TOPIC='lastTopic';
let suggested=false;
const date=new Date();
const key=new URLSearchParams(location.search).get('draft');
const TOPIC_HELP='Wybierz z listy albo wpisz nazwę. Nowy folder powstanie przy zapisie.';
function status(message,error=false) {$('status').textContent=message;$('status').classList.toggle('error',error);}
function update() {
 $('filename').textContent=datePrefix(date)+'_'+safeTitle($('title').value)+'.md';
 $('count').textContent=$('body').value.length.toLocaleString('pl-PL')+' znaków';
 $('save').disabled=busy || !draft || !root || !$('topic').value.trim() || !$('body').value.trim();
}
async function refreshRoot() {
 const selected=await nativeMessage('status');
 root=selected.root;
 if(!root) {
  $('archive-name').textContent='Wybierz miejsce na notatki';
  $('archive-help').textContent='Przy pierwszym zapisie wskaż folder na dysku.';
  $('choose').textContent='Wybierz folder';
  $('topics').replaceChildren();update();return;
 }
 $('archive-name').textContent=root;
 $('choose').textContent='Zmień folder';
 $('archive-help').textContent='Notatki trafią do podfolderów tematycznych.';
 $('topics').replaceChildren();
 const result=await nativeMessage('topics');
 for(const name of result.topics) {
  const option=document.createElement('option');option.value=name;$('topics').append(option);
 }
 update();
}
$('choose').addEventListener('click',async()=>{
 try {
  const selected=await nativeMessage('choose');
  if(selected.cancelled)return;
  await refreshRoot();status('Folder wybrany. Wpisz temat i zapisz notatkę.');
 } catch(error) {
  if(error.name!=='AbortError') status('Nie udało się wybrać folderu: '+error.message,true);
 }
});
$('title').addEventListener('input',update);
$('topic').addEventListener('input',()=>{suggested=false;$('topic-help').textContent=TOPIC_HELP;update();});
// Selecting the suggested topic lets the next keystroke replace it with another one.
$('topic').addEventListener('focus',()=>{if(suggested)$('topic').select();});
$('body').addEventListener('input',update);
$('new-topic').addEventListener('click',()=>{
 suggested=false;$('topic-help').textContent=TOPIC_HELP;
 $('topic').value='';$('topic').placeholder='Nazwa nowego tematu';$('topic').focus();update();
 status('Wpisz nazwę nowego tematu. Folder powstanie przy zapisie.');
});
$('mode').addEventListener('change',()=>{
 // Keep edits when toggling between capture modes.
 const previous=$('mode').value==='body'?'full':'body';
 draft[previous]=$('body').value;
 $('body').value=draft[$('mode').value];$('save-missing').hidden=true;update();
});
// Any edit invalidates the offer to skip images that failed for the previous content.
for(const id of ['title','topic','body']) $(id).addEventListener('input',()=>{$('save-missing').hidden=true;});
async function save(allowMissingImages) {
 if(busy || !root || !draft)return;
 const topic=$('topic').value;
 $('save-missing').hidden=true;
 try {
  validateTopic(topic);
  const content=makeMarkdown({title:$('title').value,url:draft.url,body:$('body').value,date});
  busy=true;update();$('choose').disabled=true;status('Zapisuję...');
  const saved=await nativeMessage('save',{topic,basename:datePrefix(date)+'_'+safeTitle($('title').value),content,source:draft.url,allowMissingImages});
  await chrome.storage.local.set({[LAST_TOPIC]:topic}).catch(()=>{});
  const missing=saved.missingImages?.length || 0;
  status('Zapisano: '+saved.root+'\\'+saved.path+(missing ? '. Obrazy niepobrane ('+missing+') zostały linkami internetowymi.' : ''));
  await refreshRoot().catch(()=>{});
 } catch(error) {
  if(error.missingImages?.length) {
   status('Nie zapisano notatki. '+error.message+'. Możesz zapisać ją bez tych obrazów; zostaną linkami internetowymi.',true);
   $('save-missing').hidden=false;
  } else status('Nie zapisano notatki. '+error.message,true);
 } finally {busy=false;$('choose').disabled=false;update();}
}
$('form').addEventListener('submit',event=>{event.preventDefault();save(false);});
$('save-missing').addEventListener('click',()=>save(true));
async function suggestLastTopic() {
 const stored=await chrome.storage.local.get(LAST_TOPIC);
 const topic=stored[LAST_TOPIC];
 // Only a folder that still exists in the current archive; a deleted one must not come back by itself.
 if(!topic || ![...$('topics').options].some(option=>option.value===topic))return;
 $('topic').value=topic;suggested=true;
 $('topic-help').textContent='Ostatnio użyty temat. Kliknij pole i wpisz inny, żeby zmienić.';
}
async function init() {
 await refreshRoot().catch(error=>{status(error.message,true);root=null;});
 const data=key ? await chrome.storage.session.get(key) : {};
 draft=data[key];
 if(!draft || draft.error) {
  status(draft?.error || 'Ta notatka wygasła. Otwórz stronę i kliknij ikonę wtyczki ponownie.',true);
  $('source').textContent='Nie udało się pobrać treści';draft=null;return;
 }
 $('source').textContent=draft.url;
 $('title').value=draft.title;$('body').value=draft.body;
 for(const id of ['title','topic','mode','body']) $(id).disabled=false;
 $('new-topic').disabled=false;
 await suggestLastTopic().catch(()=>{});
 if(!draft.extracted) status('Nie wykryto osobnego artykułu. Sprawdź treść przed zapisaniem.');
 update();
}
init().catch(error=>status('Nie udało się uruchomić wtyczki: '+error.message,true));
