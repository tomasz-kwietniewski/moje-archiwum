const EDITOR={width:780,height:900,minHeight:680};
// Centred over the browser window and never taller than it, so on a smaller or scaled screen
// the editor does not run below the taskbar. The editor layout fits whatever height it gets.
export async function editorBounds() {
 const size={width:EDITOR.width,height:EDITOR.height};
 try {
  const browser=await chrome.windows.getLastFocused();
  if(!browser?.height || !browser?.width)return size;
  size.height=Math.min(EDITOR.height,Math.max(EDITOR.minHeight,browser.height));
  size.top=Math.round(browser.top+Math.max(0,(browser.height-size.height)/2));
  size.left=Math.round(browser.left+Math.max(0,(browser.width-size.width)/2));
 } catch {}
 return size;
}
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
 const window=await chrome.windows.create({url:chrome.runtime.getURL('editor.html')+'?draft='+key,type:'popup',...await editorBounds()});
 if(window.tabs?.[0]?.id) await chrome.storage.session.set({['window-'+window.id]:key});
 return key;
}
chrome.action.onClicked.addListener(tab=>{captureTab(tab).catch(console.error);});
chrome.windows.onRemoved.addListener(async id=>{
 const map='window-'+id;
 const data=await chrome.storage.session.get(map);
 if(data[map]) await chrome.storage.session.remove([map,data[map]]);
});
