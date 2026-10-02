export async function captureTab(tab) {
 let draft;
 try {
  if(!tab?.id || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Otwórz artykuł na stronie internetowej. Stron przeglądarki, sklepu rozszerzeń i wbudowanego podglądu PDF nie można przechwycić.');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['capture.js']});
  const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.__captureMarkdownPage()});
  draft=results[0]?.result;
  if(!draft) throw new Error('Nie udało się odczytać strony. Odśwież ją i spróbuj ponownie.');
 } catch(error) { draft={error:error.message}; }
 const key='draft-'+crypto.randomUUID();
 await chrome.storage.session.set({[key]:draft});
 const window=await chrome.windows.create({url:chrome.runtime.getURL('editor.html')+'?draft='+key,type:'popup',width:780,height:900});
 if(window.tabs?.[0]?.id) await chrome.storage.session.set({['window-'+window.id]:key});
 return key;
}
chrome.action.onClicked.addListener(tab=>{captureTab(tab).catch(console.error);});
chrome.windows.onRemoved.addListener(async id=>{
 const map='window-'+id;
 const data=await chrome.storage.session.get(map);
 if(data[map]) await chrome.storage.session.remove([map,data[map]]);
});
