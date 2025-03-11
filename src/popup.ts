/// <reference types="chrome"/>

// Popup script
document.addEventListener('DOMContentLoaded', () => {
  // Add your popup logic here
  console.log('Popup opened');
  
  // Example: Send a message to the background script
  chrome.runtime.sendMessage({ action: 'popupOpened' }, (response: any) => {
    console.log('Response:', response);
  });
}); 