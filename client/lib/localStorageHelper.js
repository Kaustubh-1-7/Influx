// lib/localStorageHelper.js
const GITHUB_DATA_KEY = 'repuFiGitHubData';

export const storeGitHubData = (address, data) => {
  if (typeof window !== 'undefined' && address) {
    const allData = JSON.parse(localStorage.getItem(GITHUB_DATA_KEY) || '{}');
    allData[address.toLowerCase()] = { ...data, timestamp: Date.now() };
    localStorage.setItem(GITHUB_DATA_KEY, JSON.stringify(allData));
  }
};

export const getGitHubData = (address) => {
  if (typeof window !== 'undefined' && address) {
    const allData = JSON.parse(localStorage.getItem(GITHUB_DATA_KEY) || '{}');
    const userData = allData[address.toLowerCase()];
    if (userData) {
      // Optional: Check timestamp for expiry (e.g., data older than 1 day is stale)
      // const oneDay = 24 * 60 * 60 * 1000;
      // if (Date.now() - userData.timestamp < oneDay) {
      return userData;
      // }
    }
  }
  return null;
};

export const clearGitHubData = (address) => {
 if (typeof window !== 'undefined' && address) {
     const allData = JSON.parse(localStorage.getItem(GITHUB_DATA_KEY) || '{}');
     delete allData[address.toLowerCase()];
     localStorage.setItem(GITHUB_DATA_KEY, JSON.stringify(allData));
   }
}