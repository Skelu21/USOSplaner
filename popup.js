let button = document.querySelector("button");
button.style.fontWeight = "bold";
chrome.storage.sync.get("active", (data) => {
    button.style.border = "0px";
    button.style.fontWeight = "bold";
    button.style.color = "LightGray";
    if (data.active) {
        button.style.backgroundColor = "ForestGreen";
        button.innerHTML = "Aktywne";
    }
    else {
        button.style.backgroundColor = "FireBrick";
        button.innerHTML = "Niekatywne";
    }
});
button.onclick = function() {
    chrome.storage.sync.get("active", (data) => {
        if (data.active) {
            chrome.storage.sync.set({"active": false});
            button.style.backgroundColor = "FireBrick";
            button.innerHTML = "Niekatywne";
        }
        else {
            chrome.storage.sync.set({"active": true});
            button.style.backgroundColor = "ForestGreen";
            button.innerHTML = "Aktywne";
        } 
    });  
}