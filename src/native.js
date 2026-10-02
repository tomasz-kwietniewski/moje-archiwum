export const HOST = 'pl.tomaszkwietniewski.moje_archiwum';

export function nativeMessage(op, data = {}) {
 return new Promise((resolve, reject) => {
  chrome.runtime.sendNativeMessage(HOST, {op, ...data}, response => {
   const error = chrome.runtime.lastError;
   if (error) {
    reject(new Error('Brak połączenia z pomocniczym programem Windows. Uruchom instalator z katalogu projektu. Szczegóły: ' + error.message));
    return;
   }
   if (!response?.ok) {
    const failure = new Error(response?.error || 'Program Windows nie zwrócił odpowiedzi.');
    failure.missingImages = response?.missingImages || [];
    reject(failure);
    return;
   }
   resolve(response);
  });
 });
}
