// Browser UI test only. The Windows host has separate direct and Brave tests.
export async function nativeMessage(op, data={}) {
 const root=await navigator.storage.getDirectory();
 if(op==='status') return {ok:true,root:localStorage.getItem('selected') ? 'Test archive' : null};
 if(op==='choose') {localStorage.setItem('selected','yes');return {ok:true,root:'Test archive'};}
 if(op==='topics') {
  const topics=[];
  for await(const [name,handle] of root.entries()) if(handle.kind==='directory')topics.push(name);
  return {ok:true,topics};
 }
 if(op==='save') {
  // Image URLs containing "/missing" simulate a download failure in the real host.
  const missingImages=[...data.content.matchAll(/!\[[^\]]*\]\(([^)\s]*\/missing[^)\s]*)/g)].map(match=>match[1]);
  if(missingImages.length && !data.allowMissingImages) {
   const error=new Error('Nie udało się pobrać '+missingImages.length+' obrazów, np. '+missingImages[0]);
   error.missingImages=missingImages;throw error;
  }
  const dir=await root.getDirectoryHandle(data.topic,{create:true});
  for(let n=1;n<=10000;n++) {
   const name=data.basename+(n===1?'':'_'+n)+'.md';
   try {await dir.getFileHandle(name);continue;} catch(error) {if(error.name!=='NotFoundError')throw error;}
   const file=await dir.getFileHandle(name,{create:true});
   const writer=await file.createWritable();await writer.write(data.content);await writer.close();
   return {ok:true,root:'Test archive',path:data.topic+'/'+name,name,missingImages};
  }
 }
 throw new Error('Unknown test operation');
}
