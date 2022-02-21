chrome.runtime.onInstalled.addListener(() => {
    let active = false;
    chrome.storage.sync.set({active});
});